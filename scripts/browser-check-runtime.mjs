import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

export { delay };

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port =
    typeof address === "object" && address !== null ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitFor(url, label) {
  let lastError;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(
    `${label} did not become ready: ${String(lastError ?? "timeout")}`,
  );
}

class Cdp {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
    this.socket = new WebSocket(url);
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        if (pending === undefined) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      const listeners = this.events.get(message.method) ?? [];
      this.events.delete(message.method);
      for (const resolve of listeners) resolve(message.params);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method) {
    return new Promise((resolve) => {
      const listeners = this.events.get(method) ?? [];
      listeners.push(resolve);
      this.events.set(method, listeners);
    });
  }

  close() {
    this.socket.close();
  }
}

export async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.text ?? "browser evaluation failed",
    );
  }
  return result.result.value;
}

export async function waitForExpression(cdp, expression, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate(cdp, expression)) return;
    await delay(50);
  }
  throw new Error(`browser timeout waiting for ${label}`);
}

export async function pressKey(
  cdp,
  key,
  code,
  text = "",
  keyCode = 0,
  modifiers = 0,
) {
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key,
    code,
    text,
    unmodifiedText: text,
    modifiers,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key,
    code,
    modifiers,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  });
}

export async function navigatePage(cdp, url, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const loaded = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url });
  await loaded;
}

export async function screenshot(cdp, outputDir, name) {
  const result = await cdp.send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    `${outputDir}/${name}.png`,
    Buffer.from(result.data, "base64"),
  );
}

export async function runBrowserCheck({ outputDir, check }) {
  const profileDir = `${outputDir}/chromium-profile`;
  const processes = [];
  let cdp;

  try {
    await rm(outputDir, { recursive: true, force: true });
    await mkdir(profileDir, { recursive: true });
    const vitePort = await freePort();
    const debugPort = await freePort();
    const vite = spawn(
      "npm",
      [
        "run",
        "dev",
        "--",
        "--host",
        "127.0.0.1",
        "--port",
        String(vitePort),
        "--strictPort",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    processes.push(vite);
    await waitFor(`http://127.0.0.1:${vitePort}/`, "Vite");

    const chromium = spawn(
      "/usr/bin/chromium",
      [
        "--headless=new",
        "--no-sandbox",
        `--remote-debugging-port=${debugPort}`,
        `--user-data-dir=${profileDir}`,
        "--disable-gpu",
        "--no-first-run",
        "about:blank",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    processes.push(chromium);
    await waitFor(
      `http://127.0.0.1:${debugPort}/json/version`,
      "Chromium CDP",
    );
    const targets = await (
      await waitFor(
        `http://127.0.0.1:${debugPort}/json/list`,
        "Chromium page target",
      )
    ).json();
    const page = targets.find((target) => target.type === "page");
    if (page === undefined) throw new Error("Chromium exposed no page target");
    cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    await check({ cdp, vitePort });
  } finally {
    cdp?.close();
    for (const child of processes.reverse()) {
      if (child.exitCode === null) child.kill("SIGTERM");
    }
    await delay(200);
    for (const child of processes) {
      if (child.exitCode === null) child.kill("SIGKILL");
    }
    await rm(profileDir, { recursive: true, force: true });
  }
}
