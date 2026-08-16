import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const outputDir = "/tmp/satisfactory-foundry-113-browser";
const profileDir = `${outputDir}/chromium-profile`;
const processes = [];

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

async function evaluate(cdp, expression) {
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

async function waitForExpression(cdp, expression, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate(cdp, expression)) return;
    await delay(50);
  }
  throw new Error(`browser timeout waiting for ${label}`);
}

async function pressKey(cdp, key, code, text = "", keyCode = 0, modifiers = 0) {
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

async function selectAll(cdp) {
  await pressKey(cdp, "Control", "ControlLeft", "", 17, 2);
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "a",
    code: "KeyA",
    modifiers: 2,
    windowsVirtualKeyCode: 65,
    nativeVirtualKeyCode: 65,
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "a",
    code: "KeyA",
    modifiers: 2,
    windowsVirtualKeyCode: 65,
    nativeVirtualKeyCode: 65,
  });
}

async function navigate(cdp, url, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const loaded = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url });
  await loaded;
  await waitForExpression(
    cdp,
    `document.querySelector('[data-harness-ready="packaging"]') !== null`,
    `${width}px harness`,
  );
  await evaluate(cdp, `document.fonts.ready.then(() => true)`);
}

async function screenshot(cdp, name) {
  const result = await cdp.send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    `${outputDir}/${name}.png`,
    Buffer.from(result.data, "base64"),
  );
}

async function pointerClick(cdp, selector, label) {
  const selectorText = JSON.stringify(selector);
  const result = await evaluate(
    cdp,
    `(() => {
      const element = document.querySelector(${selectorText});
      if (!element) return { found: false };
      element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = element.getBoundingClientRect();
      return {
        found: true,
        contained: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
        center: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
        rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
      };
    })()`,
  );
  if (!result.found || !result.contained) {
    throw new Error(
      `${label} is not pointer-reachable ${JSON.stringify(result)}`,
    );
  }
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: result.center.x,
    y: result.center.y,
    button: "left",
    clickCount: 1,
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: result.center.x,
    y: result.center.y,
    button: "left",
    clickCount: 1,
  });
  return result;
}

async function editText(cdp, selector, value, label) {
  await pointerClick(cdp, selector, label);
  await selectAll(cdp);
  await cdp.send("Input.insertText", { text: value });
  await waitForExpression(
    cdp,
    `document.querySelector(${JSON.stringify(selector)})?.value === ${JSON.stringify(value)}`,
    `${label} value`,
  );
}

async function chooseOption(cdp, selector, value, label) {
  await pointerClick(cdp, selector, label);
  const index = await evaluate(
    cdp,
    `(() => [...document.querySelector(${JSON.stringify(selector)}).options].findIndex((option) => option.value === ${JSON.stringify(value)}))()`,
  );
  if (index < 0) throw new Error(`${label} has no ${value} option`);
  await pressKey(cdp, "Home", "Home", "", 36);
  for (let current = 0; current < index; current += 1) {
    await pressKey(cdp, "ArrowDown", "ArrowDown", "", 40);
  }
  await pressKey(cdp, "Enter", "Enter", "\r", 13);
  await waitForExpression(
    cdp,
    `document.querySelector(${JSON.stringify(selector)})?.value === ${JSON.stringify(value)}`,
    `${label} ${value}`,
  );
}

async function geometry(cdp, width) {
  const result = await evaluate(
    cdp,
    `(() => {
      const panel = document.querySelector('.link-inspector');
      if (!panel) return { errors: ['missing LinkInspector'] };
      const rect = (element) => element.getBoundingClientRect();
      const visible = (element) => {
        const style = getComputedStyle(element);
        const r = rect(element);
        return style.visibility !== 'hidden' && style.display !== 'none' && r.width > 0 && r.height > 0;
      };
      const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const errors = [];
      const p = rect(panel);
      if (p.left < 0 || p.top < 0 || p.right > innerWidth || p.bottom > innerHeight) errors.push('panel leaves viewport');
      const controls = [...panel.querySelectorAll('button, input, select')].filter(visible);
      const rows = controls.map((control) => {
        const r = rect(control);
        const name = control.getAttribute('aria-label') || control.closest('label')?.textContent?.trim() || control.title || control.tagName;
        const contained = r.left >= p.left && r.top >= p.top && r.right <= p.right && r.bottom <= p.bottom && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
        if (!contained) errors.push(name + ' leaves panel or viewport');
        return { name, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      });
      for (let i = 0; i < rows.length; i += 1) {
        for (let j = i + 1; j < rows.length; j += 1) {
          if (overlaps(rows[i], rows[j])) errors.push(rows[i].name + ' overlaps ' + rows[j].name);
        }
      }
      const wrapping = [...panel.querySelectorAll('.link-inspector-interstep-summary, .link-inspector-advisories, .link-inspector-basis')]
        .map((element) => ({ className: element.className, flexWrap: getComputedStyle(element).flexWrap }));
      if (wrapping.some((row) => row.flexWrap !== 'wrap')) errors.push('responsive groups do not wrap');
      const overflowingText = [...panel.querySelectorAll('p, h3, label')]
        .filter(visible)
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map((element) => element.textContent.trim());
      if (overflowingText.length) errors.push('text overflow: ' + overflowingText.join(' | '));
      const documentWidth = {
        document: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth },
        body: { scrollWidth: document.body.scrollWidth, clientWidth: document.body.clientWidth },
      };
      if (documentWidth.document.scrollWidth > documentWidth.document.clientWidth || documentWidth.body.scrollWidth > documentWidth.body.clientWidth) errors.push('document has horizontal overflow');
      return {
        errors,
        panel: { left: p.left, top: p.top, right: p.right, bottom: p.bottom, width: p.width, height: p.height },
        controls: rows.length,
        wrapping,
        documentWidth,
      };
    })()`,
  );
  if (result.errors.length > 0) {
    throw new Error(
      `${width}px geometry: ${result.errors.join("; ")} ${JSON.stringify(result)}`,
    );
  }
  return result;
}

async function main() {
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
  await waitFor(`http://127.0.0.1:${debugPort}/json/version`, "Chromium CDP");
  const targets = await (
    await waitFor(
      `http://127.0.0.1:${debugPort}/json/list`,
      "Chromium page target",
    )
  ).json();
  const page = targets.find((target) => target.type === "page");
  if (page === undefined) throw new Error("Chromium exposed no page target");
  const cdp = new Cdp(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  const base = `http://127.0.0.1:${vitePort}/features/packaging-intersteps/browser-harness.html`;
  for (const width of [360, 720, 1280]) {
    await navigate(cdp, base, width, 1100);
    await pointerClick(
      cdp,
      ".link-inspector-package-toggle input",
      `${width}px package toggle`,
    );
    await waitForExpression(
      cdp,
      `JSON.parse(document.querySelector('[data-browser-state]').textContent).interstep?.packageRecipeId === 'package_water'`,
      `${width}px packaged activation`,
    );
    const result = await geometry(cdp, width);
    await screenshot(cdp, `geometry-${width}`);
    process.stdout.write(
      `PASS geometry ${width}px activation=package_water panel=${Math.round(result.panel.width)}x${Math.round(result.panel.height)} controls=${result.controls} document=${result.documentWidth.document.scrollWidth}/${result.documentWidth.document.clientWidth} wrapping=${result.wrapping.length}\n`,
    );
  }

  await navigate(cdp, base, 1280, 1500);
  await pointerClick(
    cdp,
    ".link-inspector-package-toggle input",
    "package toggle",
  );
  await waitForExpression(
    cdp,
    `document.querySelector('.link-inspector-interstep-summary')?.textContent.includes('10 package · 5 unpackage · 150 MW') === true`,
    "initial exact package plan",
  );
  await editText(
    cdp,
    '.link-inspector-field input[inputmode="decimal"]',
    "125",
    "Packager clock",
  );
  await waitForExpression(
    cdp,
    `document.querySelector('.link-inspector-interstep-summary')?.textContent.includes('8 package · 4 unpackage') === true`,
    "125 percent machine counts",
  );
  await chooseOption(
    cdp,
    '[aria-label="Forward mode"] select',
    "train",
    "Forward mode",
  );
  await editText(
    cdp,
    '[aria-label="Forward mode"] input[inputmode="decimal"]',
    "900",
    "Forward distance",
  );
  await chooseOption(
    cdp,
    '[aria-label="Empty return mode"] select',
    "truck",
    "Empty return mode",
  );
  await editText(
    cdp,
    '[aria-label="Empty return mode"] input[inputmode="decimal"]',
    "750",
    "Empty return distance",
  );
  await waitForExpression(
    cdp,
    `(() => { const s=JSON.parse(document.querySelector('[data-browser-state]').textContent); return s.transport?.mode === 'train' && s.transport.trip?.distanceText === '900' && s.interstep?.returnTransport?.mode === 'truck' && s.interstep.returnTransport.trip?.distanceText === '750'; })()`,
    "independent route persistence",
  );
  const workflowGeometry = await geometry(cdp, 1280);
  await screenshot(cdp, "workflow-1280");

  await pointerClick(
    cdp,
    ".packaging-browser-actions button:nth-child(2)",
    "Remove packaging catalog",
  );
  await waitForExpression(
    cdp,
    `document.querySelector('.link-inspector-error')?.textContent.includes('packaging pair is unavailable') === true`,
    "stale intent error",
  );
  await screenshot(cdp, "stale-1280");
  await pressKey(cdp, "Tab", "Tab", "", 9);
  await pressKey(cdp, "Tab", "Tab", "", 9);
  const keyboardTarget = await evaluate(
    cdp,
    `document.activeElement === document.querySelector('.link-inspector-package-toggle input')`,
  );
  if (!keyboardTarget)
    throw new Error("Tab traversal did not reach the package checkbox");
  await pressKey(cdp, " ", "Space", "", 32);
  await waitForExpression(
    cdp,
    `(() => { const s=JSON.parse(document.querySelector('[data-browser-state]').textContent); return s.interstep === null && s.transport?.mode === 'pipe' && document.querySelector('.link-inspector-package-toggle input') === null; })()`,
    "keyboard stale recovery",
  );
  await screenshot(cdp, "recovered-1280");
  process.stdout.write(
    `PASS workflow 1280px enable, clock=125, forward=train/900m, return=truck/750m, stale error, Tab+Space recovery=pipe, panel=${Math.round(workflowGeometry.panel.width)}x${Math.round(workflowGeometry.panel.height)}, no JS value assignment\n`,
  );
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
