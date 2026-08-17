import {
  delay,
  evaluate,
  navigatePage,
  pressKey,
  runBrowserCheck,
  screenshot as captureScreenshot,
  waitForExpression,
} from "./browser-check-runtime.mjs";

const outputDir = "/tmp/satisfactory-foundry-112-browser";

async function selectAll(cdp) {
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Control",
    code: "ControlLeft",
    modifiers: 2,
    windowsVirtualKeyCode: 17,
    nativeVirtualKeyCode: 17,
  });
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
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Control",
    code: "ControlLeft",
    windowsVirtualKeyCode: 17,
    nativeVirtualKeyCode: 17,
  });
}

async function pointerFocusControl(cdp, selector, label) {
  const selectorText = JSON.stringify(selector);
  const measurement = await evaluate(
    cdp,
    `(() => {
      const control = document.querySelector(${selectorText});
      const panel = document.querySelector('.graph-top-right-stack');
      if (!control || !panel) return { found: false };
      control.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = control.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      return {
        found: true,
        rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom },
        panel: { left: p.left, right: p.right, top: p.top, bottom: p.bottom },
        scrollTop: panel.scrollTop,
        contained: r.left >= p.left && r.right <= p.right && r.top >= p.top && r.bottom <= p.bottom && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
        center: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
      };
    })()`,
  );
  if (!measurement.found || !measurement.contained) {
    throw new Error(
      `${label} is not fully contained before interaction ${JSON.stringify(measurement)}`,
    );
  }
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: measurement.center.x,
    y: measurement.center.y,
    button: "left",
    clickCount: 1,
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: measurement.center.x,
    y: measurement.center.y,
    button: "left",
    clickCount: 1,
  });
  await waitForExpression(
    cdp,
    `document.activeElement === document.querySelector(${selectorText})`,
    `${label} pointer focus`,
  );
  return measurement;
}

async function documentWidth(cdp) {
  return evaluate(
    cdp,
    `(() => ({
      document: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth },
      body: { scrollWidth: document.body.scrollWidth, clientWidth: document.body.clientWidth },
    }))()`,
  );
}

function documentFits(measurement) {
  return (
    measurement.document.scrollWidth <= measurement.document.clientWidth &&
    measurement.body.scrollWidth <= measurement.body.clientWidth
  );
}

async function navigate(cdp, url, width, height = 520) {
  await navigatePage(cdp, url, width, height);
}

async function screenshot(cdp, name) {
  await captureScreenshot(cdp, outputDir, name);
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
  const documentWidth = {
    document: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth },
    body: { scrollWidth: document.body.scrollWidth, clientWidth: document.body.clientWidth },
  };
  if (documentWidth.document.scrollWidth > documentWidth.document.clientWidth || documentWidth.body.scrollWidth > documentWidth.body.clientWidth) {
    errors.push('document has horizontal overflow');
  }
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
  const state = new URLSearchParams(location.search).get('state');
  const expectedCap = innerWidth <= 720 ? 170 : 260;
  const scrollable = content
    ? ['auto', 'scroll'].includes(getComputedStyle(content).overflowY) && content.scrollHeight > content.clientHeight
    : false;
  if (state !== 'notice' && !scrollable) errors.push('expanded extraction stack is not internally scrollable');
  if (state !== 'notice' && Math.abs(s.height - expectedCap) > 0.5) errors.push('expanded extraction stack does not reach its responsive height cap');
  const controlMeasurements = [];
  if (state !== 'notice') {
    const purityInputs = ['Impure nodes', 'Normal nodes', 'Pure nodes'];
    for (const label of purityInputs) {
      if (!document.querySelector('[aria-label="' + label + '"]')) errors.push('missing ' + label);
    }
    if (!document.querySelector('.extraction-purity-result')) errors.push('missing expanded purity result');
    for (const control of document.querySelectorAll('.extraction-panel select, .extraction-panel input')) {
      control.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = rect(control), visible = rect(content);
      const name = control.getAttribute('aria-label') || control.closest('label')?.querySelector('span')?.textContent || control.tagName;
      const contained = r.left >= visible.left && r.right <= visible.right && r.top >= visible.top && r.bottom <= visible.bottom;
      const avoidsChrome = !overlap(r, t) && !overlap(r, ctl) && !overlap(r, p);
      if (!contained) errors.push(name + ' leaves visible panel bounds');
      if (!avoidsChrome) errors.push(name + ' overlaps chain controls');
      controlMeasurements.push({ name, contained, avoidsChrome, rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, panel: { left: visible.left, right: visible.right, top: visible.top, bottom: visible.bottom } });
    }
  }
  return { errors, scrollable, documentWidth, controlMeasurements,
    canvas: { width: c.width, height: c.height },
    stack: { top: s.top-c.top, bottom: s.bottom-c.top, height: s.height },
    controls: { top: ctl.top-c.top, bottom: ctl.bottom-c.top },
    power: { top: p.top-c.top, bottom: p.bottom-c.top } };
})()`;

async function main({ cdp, vitePort }) {
  const base = `http://127.0.0.1:${vitePort}/features/extraction-planning/phase-1/browser-harness.html`;
  for (const width of [360, 720, 1280]) {
    for (const state of ["notice", "extraction", "combined"]) {
      await navigate(cdp, `${base}?mode=geometry&state=${state}`, width);
      await waitForExpression(
        cdp,
        `document.querySelector('[data-harness-ready="geometry"]') !== null`,
        `${width}/${state}`,
      );
      const result = await evaluate(cdp, geometryCheck);
      if (result.errors.length > 0) {
        throw new Error(
          `${width}/${state}: ${result.errors.join("; ")} ${JSON.stringify(result)}`,
        );
      }
      await screenshot(cdp, `${width}-${state}`);
      process.stdout.write(
        `PASS geometry ${width}px ${state} ${JSON.stringify(result.stack)} document=${result.documentWidth.document.scrollWidth}/${result.documentWidth.document.clientWidth} controls=${result.controlMeasurements.length}\n`,
      );
    }
  }

  for (const width of [360, 720, 1280]) {
    await navigate(cdp, `${base}?mode=interaction`, width, 700);
    await waitForExpression(
      cdp,
      `document.querySelector('[data-harness-ready="interaction"] .raw-feed-node-button') !== null`,
      "interaction raw feed",
    );
    const initialDocumentWidth = await documentWidth(cdp);
    await evaluate(
      cdp,
      `(() => {
    window.__rawClicks = 0;
    document.querySelectorAll('.raw-feed-node-button').forEach((button) => button.addEventListener('click', () => window.__rawClicks++));
    return true;
  })()`,
    );
    const center = await evaluate(
      cdp,
      `(() => { const r=document.querySelector('.raw-feed-node-button').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`,
    );
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: center.x,
      y: center.y,
      button: "left",
      clickCount: 1,
    });
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: center.x,
      y: center.y,
      button: "left",
      clickCount: 1,
    });
    await waitForExpression(
      cdp,
      `document.querySelector('[role="dialog"]') !== null`,
      "pointer dialog",
    );
    const solidSelection = await evaluate(
      cdp,
      `window.__extractionSelection('stone')`,
    );
    if (solidSelection !== undefined) {
      throw new Error(
        "Limestone auto-seeded instead of awaiting an explicit Miner choice",
      );
    }
    let clicks = await evaluate(cdp, `window.__rawClicks`);
    if (clicks !== 1)
      throw new Error(`pointer activation fired ${clicks} clicks`);
    await evaluate(
      cdp,
      `document.querySelector('[aria-label="Close extraction planning"]').click()`,
    );
    await delay(100);
    const restored = await evaluate(
      cdp,
      `document.activeElement === document.querySelectorAll('.raw-feed-node-button')[0]`,
    );
    if (!restored)
      throw new Error("close did not restore focus to the surviving opener");

    await evaluate(
      cdp,
      `document.querySelector('.raw-feed-node-button').focus()`,
    );
    await pressKey(cdp, "Enter", "Enter", "\r", 13);
    await waitForExpression(
      cdp,
      `document.querySelector('[role="dialog"]') !== null`,
      "Enter dialog",
    );
    clicks = await evaluate(cdp, `window.__rawClicks`);
    if (clicks !== 2)
      throw new Error(`Enter activation total was ${clicks}, expected 2`);
    await evaluate(
      cdp,
      `document.querySelector('[aria-label="Close extraction planning"]').click()`,
    );
    await delay(100);

    await evaluate(
      cdp,
      `document.querySelector('.raw-feed-node-button').focus()`,
    );
    await pressKey(cdp, " ", "Space", " ", 32);
    await waitForExpression(
      cdp,
      `document.querySelector('[role="dialog"]') !== null`,
      "Space dialog",
    );
    clicks = await evaluate(cdp, `window.__rawClicks`);
    if (clicks !== 3)
      throw new Error(`Space activation total was ${clicks}, expected 3`);
    const extractorGeometry = await pointerFocusControl(
      cdp,
      '[role="dialog"] select',
      "Extractor select",
    );
    await pressKey(cdp, "ArrowDown", "ArrowDown", "", 40);
    await pressKey(cdp, "Enter", "Enter", "\r", 13);
    await waitForExpression(
      cdp,
      `document.querySelector('[role="dialog"] select')?.value === 'miner_mk3' && window.__extractionSelection('stone')?.machineId === 'miner_mk3' && window.__extractionSelection('stone')?.clockPercentText === '100' && document.querySelector('[role="dialog"]')?.textContent.includes('1000/min required') === true && document.querySelector('[role="dialog"]')?.textContent.includes('Normal baseline') === true && document.querySelector('[role="dialog"]')?.textContent.includes('5 × Miner Mk.3') === true`,
      "Limestone Normal baseline",
    );
    const toggleGeometry = await pointerFocusControl(
      cdp,
      '[role="dialog"] [aria-label="Use node mix"]',
      "Use node mix checkbox",
    );
    await waitForExpression(
      cdp,
      `(() => {
    const mix = window.__extractionSelection('stone')?.purityMix;
    const toggle = document.querySelector('[role="dialog"] [aria-label="Use node mix"]');
    const inputs = [...document.querySelectorAll('[role="dialog"] .extraction-purity-fields input')].map((input) => input.value);
    return toggle?.checked === true && mix?.impure === '0' && mix.normal === '5' && mix.pure === '0' && inputs.join('/') === '0/5/0';
  })()`,
      "seeded Limestone purity mix",
    );
    const purityControlGeometry = [];
    for (const [label, field] of [
      ["Impure nodes", "impure"],
      ["Normal nodes", "normal"],
      ["Pure nodes", "pure"],
    ]) {
      purityControlGeometry.push(
        await pointerFocusControl(
          cdp,
          `[role="dialog"] [aria-label="${label}"]`,
          label,
        ),
      );
      await selectAll(cdp);
      await cdp.send("Input.insertText", { text: "1" });
      await waitForExpression(
        cdp,
        `(() => {
    const input = document.querySelector('[role="dialog"] [aria-label="${label}"]');
    return input?.value === '1' && window.__extractionSelection('stone')?.purityMix?.${field} === '1';
  })()`,
        `${label} edit`,
      );
    }
    await waitForExpression(
      cdp,
      `(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const mix = window.__extractionSelection('stone')?.purityMix;
    return mix?.impure === '1' && mix.normal === '1' && mix.pure === '1' && dialog?.textContent.includes('840/min supplied · 160/min shortfall') === true;
  })()`,
      "exact Limestone purity supply and shortfall",
    );
    await evaluate(
      cdp,
      `document.querySelector('[aria-label="Close extraction planning"]').click()`,
    );
    await delay(100);
    await evaluate(
      cdp,
      `document.querySelector('.raw-feed-node-button[data-raw-item="stone"]').click()`,
    );
    await waitForExpression(
      cdp,
      `(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const values = [...dialog?.querySelectorAll('.extraction-purity-fields input') ?? []].map((input) => input.value);
    return dialog?.textContent.includes('EXTRACTION - Limestone') === true && values.join('/') === '1/1/1' && dialog.textContent.includes('840/min supplied · 160/min shortfall');
  })()`,
      "persisted Limestone purity mix",
    );
    const pureVisibility = purityControlGeometry[2];
    await evaluate(cdp, `window.__setMachineCount(36)`);
    await waitForExpression(
      cdp,
      `document.querySelector('[role="dialog"]')?.textContent.includes('1800/min required') === true`,
      "live demand update",
    );
    await evaluate(
      cdp,
      `document.querySelectorAll('.raw-feed-node-button')[1].click()`,
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[role="dialog"]')?.textContent.includes('EXTRACTION - Water') === true`,
      "replacement Water dialog",
    );
    clicks = await evaluate(cdp, `window.__rawClicks`);
    if (clicks !== 5)
      throw new Error(
        `replacement activations total was ${clicks}, expected 5`,
      );
    const replacementFocused = await evaluate(
      cdp,
      `document.querySelector('[role="dialog"]').contains(document.activeElement)`,
    );
    if (!replacementFocused)
      throw new Error("replacement did not focus the new panel");
    await waitForExpression(
      cdp,
      `window.__extractionSelection('water')?.machineId === 'water_pump'`,
      "Water auto-seed persistence",
    );
    const waterHasMix = await evaluate(
      cdp,
      `document.querySelector('[role="dialog"] [aria-label="Use node mix"]') !== null`,
    );
    if (waterHasMix)
      throw new Error("Water exposed a Use node mix checkbox");
    await evaluate(cdp, `window.__suppressRaw('water')`);
    await waitForExpression(
      cdp,
      `document.querySelector('[role="dialog"]') === null && [...document.querySelectorAll('.raw-feed-node-button')].every((button) => button.dataset.rawItem !== 'water')`,
      "raw disappearance closure",
    );
    await evaluate(
      cdp,
      `document.querySelector('.raw-feed-node-button[data-raw-item="liquid_oil"]').click()`,
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[role="dialog"]')?.textContent.includes('EXTRACTION - Crude Oil') === true`,
      "Crude Oil dialog",
    );
    await waitForExpression(
      cdp,
      `window.__extractionSelection('liquid_oil')?.machineId === 'oil_pump'`,
      "Crude Oil auto-seed persistence",
    );
    const oilHasMix = await evaluate(
      cdp,
      `document.querySelector('[role="dialog"] [aria-label="Use node mix"]') !== null`,
    );
    if (!oilHasMix)
      throw new Error("Crude Oil did not expose a Use node mix checkbox");
    const oilText = await evaluate(
      cdp,
      `document.querySelector('[role="dialog"]').textContent`,
    );
    if (
      !oilText.includes("Oil Extractor") ||
      !oilText.includes("Normal baseline")
    ) {
      throw new Error(
        "Crude Oil did not render its Normal-baseline Oil Extractor plan",
      );
    }
    if (oilText.includes("one extractor exceeds")) {
      throw new Error(
        "Crude Oil emitted a false total-demand transport warning",
      );
    }
    await evaluate(
      cdp,
      `document.querySelector('.raw-feed-node-button[data-raw-item="nitrogen_gas"]').click()`,
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[role="dialog"]')?.textContent.includes('EXTRACTION - Nitrogen Gas') === true`,
      "Nitrogen dialog",
    );
    const nitrogen = await evaluate(
      cdp,
      `(() => { const dialog = document.querySelector('[role="dialog"]'); return { text: dialog.textContent, hasSelect: dialog.querySelector('select') !== null }; })()`,
    );
    if (
      nitrogen.hasSelect ||
      !nitrogen.text.includes("Resource Well Pressurizer") ||
      nitrogen.text.includes("Miner")
    ) {
      throw new Error(
        "Nitrogen did not render the explicit Resource Well-only state",
      );
    }
    clicks = await evaluate(cdp, `window.__rawClicks`);
    if (clicks !== 7)
      throw new Error(
        `all-resource activations total was ${clicks}, expected 7`,
      );
    const finalDocumentWidth = await documentWidth(cdp);
    if (!documentFits(initialDocumentWidth) || !documentFits(finalDocumentWidth)) {
      throw new Error(
        `${width}px interaction document has horizontal overflow initial=${JSON.stringify(initialDocumentWidth)} final=${JSON.stringify(finalDocumentWidth)}`,
      );
    }
    await screenshot(cdp, `interaction-${width}`);
    process.stdout.write(
      `PASS interaction ${width}px pointer/Enter/Space, realistic controls, Limestone purity 0/5/0 -> 1/1/1 = 840/min supplied + 160/min shortfall, persistence, controls contained (extractor scroll ${extractorGeometry.scrollTop}, toggle ${toggleGeometry.scrollTop}, Pure ${pureVisibility.scrollTop}), document=${finalDocumentWidth.document.scrollWidth}/${finalDocumentWidth.document.clientWidth}, Water no mix, Oil mix, Nitrogen refusal, replacement, live update, disappearance, focus\n`,
    );
  }
}

await runBrowserCheck({ outputDir, check: main });
