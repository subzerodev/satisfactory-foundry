import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const outputDir = "/tmp/satisfactory-foundry-112-browser";
const profileDir = `${outputDir}/chromium-profile`;
const processes = [];

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
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
  throw new Error(`${label} did not become ready: ${String(lastError ?? "timeout")}`);
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

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? "browser evaluation failed");
  }
  return result.result.value;
}

async function waitForExpression(cdp, expression, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate(cdp, expression)) return;
    await delay(50);
  }
  throw new Error(`browser timeout waiting for ${label}`);
}

async function navigate(cdp, url, width, height = 520) {
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

async function screenshot(cdp, name) {
  const result = await cdp.send("Page.captureScreenshot", { format: "png" });
  await writeFile(`${outputDir}/${name}.png`, Buffer.from(result.data, "base64"));
}

const geometryCheck = `(() => {
  const canvas = document.querySelector('[data-browser-canvas]');
  const stack = document.querySelector('.react-flow__panel.top.right');
  const topLeft = document.querySelector('.react-flow__panel.top.left');
  const controls = document.querySelector('.react-flow__controls');
  const power = document.querySelector('.graph-chain-power')?.closest('.react-flow__panel');
  if (!canvas || !stack || !topLeft || !controls || !power) return { errors: ['missing production chrome'] };
  const rect = (el) => el.getBoundingClientRect();
  const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const c = rect(canvas), s = rect(stack), t = rect(topLeft), ctl = rect(controls), p = rect(power);
  const errors = [];
  if (Math.abs(c.height - 340) > 0.5) errors.push('canvas height is not 340px');
  if (s.left < c.left + 7 || s.right > c.right - 7) errors.push('top-right stack leaves side gutters');
  if (s.top < c.top + 7 || s.bottom > c.bottom - 7) errors.push('top-right stack leaves canvas bounds');
  if (overlap(s, t)) errors.push('top-right stack overlaps top-left controls');
  if (overlap(s, ctl)) errors.push('top-right stack overlaps bottom-left controls');
  if (overlap(s, p)) errors.push('top-right stack overlaps bottom-right power');
  const overflow = [...document.querySelectorAll('.extraction-panel h3, .extraction-panel p, .extraction-panel select, .extraction-panel input, .graph-canvas-notice')]
    .filter((el) => el.scrollWidth > el.clientWidth + 1)
    .map((el) => el.className || el.tagName);
  if (overflow.length) errors.push('text overflow: ' + overflow.join(','));
  const content = document.querySelector('.graph-top-right-stack');
  return { errors, scrollable: content ? content.scrollHeight >= content.clientHeight : false,
    canvas: { width: c.width, height: c.height }, stack: { top: s.top-c.top, bottom: s.bottom-c.top, height: s.height } };
})()`;

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(profileDir, { recursive: true });
  const vitePort = await freePort();
  const debugPort = await freePort();
  const vite = spawn(
    "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(vitePort), "--strictPort"],
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
  await waitFor(`http://127.0.0.1:${debugPort}/json/version`, "Chromium CDP");
  const targets = await (await waitFor(`http://127.0.0.1:${debugPort}/json/list`, "Chromium page target")).json();
  const page = targets.find((target) => target.type === "page");
  if (page === undefined) throw new Error("Chromium exposed no page target");
  const cdp = new Cdp(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  const base = `http://127.0.0.1:${vitePort}/features/extraction-planning/phase-1/browser-harness.html`;
  for (const width of [360, 720]) {
    for (const state of ["notice", "extraction", "combined"]) {
      await navigate(cdp, `${base}?mode=geometry&state=${state}`, width);
      await waitForExpression(cdp, `document.querySelector('[data-harness-ready="geometry"]') !== null`, `${width}/${state}`);
      const result = await evaluate(cdp, geometryCheck);
      if (result.errors.length > 0) {
        throw new Error(`${width}/${state}: ${result.errors.join("; ")}`);
      }
      await screenshot(cdp, `${width}-${state}`);
      process.stdout.write(`PASS geometry ${width}px ${state} ${JSON.stringify(result.stack)}\n`);
    }
  }

  await navigate(cdp, `${base}?mode=interaction`, 720, 700);
  await waitForExpression(cdp, `document.querySelector('[data-harness-ready="interaction"] .raw-feed-node-button') !== null`, "interaction raw feed");
  await evaluate(cdp, `(() => {
    window.__rawClicks = 0;
    document.querySelectorAll('.raw-feed-node-button').forEach((button) => button.addEventListener('click', () => window.__rawClicks++));
    return true;
  })()`);
  const center = await evaluate(cdp, `(() => { const r=document.querySelector('.raw-feed-node-button').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: center.x, y: center.y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: center.x, y: center.y, button: "left", clickCount: 1 });
  await waitForExpression(cdp, `document.querySelector('[role="dialog"]') !== null`, "pointer dialog");
  let clicks = await evaluate(cdp, `window.__rawClicks`);
  if (clicks !== 1) throw new Error(`pointer activation fired ${clicks} clicks`);
  await evaluate(cdp, `document.querySelector('[aria-label="Close extraction planning"]').click()`);
  await delay(100);
  const restored = await evaluate(cdp, `document.activeElement === document.querySelectorAll('.raw-feed-node-button')[0]`);
  if (!restored) throw new Error("close did not restore focus to the surviving opener");

  await evaluate(cdp, `document.querySelector('.raw-feed-node-button').focus()`);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", text: "\r", unmodifiedText: "\r", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await waitForExpression(cdp, `document.querySelector('[role="dialog"]') !== null`, "Enter dialog");
  clicks = await evaluate(cdp, `window.__rawClicks`);
  if (clicks !== 2) throw new Error(`Enter activation total was ${clicks}, expected 2`);
  await evaluate(cdp, `document.querySelector('[aria-label="Close extraction planning"]').click()`);
  await delay(100);

  await evaluate(cdp, `document.querySelector('.raw-feed-node-button').focus()`);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", text: " ", unmodifiedText: " ", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
  await waitForExpression(cdp, `document.querySelector('[role="dialog"]') !== null`, "Space dialog");
  clicks = await evaluate(cdp, `window.__rawClicks`);
  if (clicks !== 3) throw new Error(`Space activation total was ${clicks}, expected 3`);
  await evaluate(cdp, `window.__setMachineCount(40)`);
  await waitForExpression(cdp, `document.querySelector('[role="dialog"]')?.textContent.includes('1800/min required') === true`, "live demand update");
  await evaluate(cdp, `document.querySelector('[aria-label="Close extraction planning"]').click()`);
  await delay(100);

  await evaluate(cdp, `document.querySelectorAll('.raw-feed-node-button')[0].click()`);
  await waitForExpression(cdp, `document.querySelector('[role="dialog"]') !== null`, "replacement source dialog");
  await evaluate(cdp, `document.querySelectorAll('.raw-feed-node-button')[1].click()`);
  await waitForExpression(cdp, `document.querySelector('[role="dialog"]')?.textContent.includes('EXTRACTION - Water') === true`, "replacement Water dialog");
  clicks = await evaluate(cdp, `window.__rawClicks`);
  if (clicks !== 5) throw new Error(`replacement activations total was ${clicks}, expected 5`);
  const replacementFocused = await evaluate(cdp, `document.querySelector('[role="dialog"]').contains(document.activeElement)`);
  if (!replacementFocused) throw new Error("replacement did not focus the new panel");
  await waitForExpression(cdp, `window.__extractionSelection('water')?.machineId === 'water_pump'`, "Water auto-seed persistence");
  await evaluate(cdp, `window.__suppressRaw('water')`);
  await waitForExpression(cdp, `document.querySelector('[role="dialog"]') === null && [...document.querySelectorAll('.raw-feed-node-button')].every((button) => button.dataset.rawItem !== 'water')`, "raw disappearance closure");
  await screenshot(cdp, "interaction");
  process.stdout.write("PASS interaction pointer/Enter/Space, replacement, live update, disappearance, focus\n");
  cdp.close();
}

try {
  await main();
} finally {
  for (const child of processes.reverse()) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
  await delay(200);
  for (const child of processes) {
    if (child.exitCode === null) child.kill("SIGKILL");
  }
  await rm(profileDir, { recursive: true, force: true });
}
