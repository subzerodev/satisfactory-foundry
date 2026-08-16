import {
  delay,
  evaluate,
  navigatePage,
  pressKey,
  runBrowserCheck,
  screenshot as captureScreenshot,
  waitForExpression,
} from "./browser-check-runtime.mjs";

const outputDir = "/tmp/satisfactory-foundry-113-browser";

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
  await navigatePage(cdp, url, width, height);
  await waitForExpression(
    cdp,
    `document.querySelector('[data-harness-ready="packaging"]') !== null`,
    `${width}px harness`,
  );
  await evaluate(cdp, `document.fonts.ready.then(() => true)`);
}

async function screenshot(cdp, name) {
  await captureScreenshot(cdp, outputDir, name);
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

async function main({ cdp, vitePort }) {
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
  await evaluate(cdp, `window.scrollTo(0, 0)`);
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
  await delay(100);
  await evaluate(
    cdp,
    `(() => { window.scrollTo(0, 0); document.scrollingElement.scrollTop = 0; return document.scrollingElement.scrollTop; })()`,
  );
  await screenshot(cdp, "recovered-1280");
  process.stdout.write(
    `PASS workflow 1280px enable, clock=125, forward=train/900m, return=truck/750m, stale error, Tab+Space recovery=pipe, panel=${Math.round(workflowGeometry.panel.width)}x${Math.round(workflowGeometry.panel.height)}, no JS value assignment\n`,
  );
}

await runBrowserCheck({ outputDir, check: main });
