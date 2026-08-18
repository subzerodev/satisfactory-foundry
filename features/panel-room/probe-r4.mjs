/**
 * #134 r4 grounding probe — measures a CANDIDATE rule set against the live
 * harness. Nothing here ships; it exists so r4's numbers are measured rather
 * than derived. r1/r2/r3 were each killed by a layout claim read off CSS.
 *
 * Candidate under test ("variant C"):
 *   .graph-canvas .react-flow__panel.top.right { bottom: 0; pointer-events: none }
 *   .graph-top-right-stack { max-height: calc(100% - 42px); pointer-events: auto }
 *   @media (max-width: 720px) {
 *     .graph-canvas .react-flow__panel.top.right { bottom: 8px }
 *     .graph-top-right-stack { max-height: calc(100% - 111px) }
 *   }
 *
 * `bottom` rather than `height: calc(...)` because the wrapper already carries
 * `top` + `margin` in both the desktop and narrow rules; top+bottom on an
 * absolutely positioned box yields a definite used height without restating
 * either, so the narrow rule's different top/margin needs no second subtrahend.
 *
 * Every measurement is taken TWICE — once before injection, once after — so a
 * silently-failed injection shows as an unchanged pair rather than a pass.
 */
import {
  evaluate,
  navigatePage,
  runBrowserCheck,
  waitForExpression,
} from "../../scripts/browser-check-runtime.mjs";

const outputDir = "/tmp/satisfactory-foundry-134-probe";

/* Arm 1 — sizing only. Isolated from the pointer-events rule so the probe can
   show whether that rule is actually load-bearing rather than assuming it. */
const SIZING_CSS = `
.graph-canvas .react-flow__panel.top.right {
  bottom: 0;
}
.graph-top-right-stack {
  max-height: calc(100% - 42px);
}
@media (max-width: 720px) {
  .graph-canvas .react-flow__panel.top.right { bottom: 8px; }
  .graph-top-right-stack { max-height: calc(100% - 111px); }
}
`;

/* Arm 2 — the pointer-events half, applied on top of arm 1. */
const POINTER_CSS = `
.graph-canvas .react-flow__panel.top.right { pointer-events: none; }
.graph-top-right-stack { pointer-events: auto; }
`;

/** Injected verbatim; returns the marker so a failed injection is visible. */
const injectStyle = (id, css) => `(() => {
  const style = document.createElement('style');
  style.id = ${JSON.stringify(id)};
  style.textContent = ${JSON.stringify(css)};
  document.head.appendChild(style);
  return document.getElementById(${JSON.stringify(id)}) !== null;
})()`;

const injectSizing = injectStyle("probe-r4-sizing", SIZING_CSS);
const injectPointer = injectStyle("probe-r4-pointer", POINTER_CSS);

/**
 * Measures the wrapper and the stack SEPARATELY. The checked-in gate binds
 * `s` to `.react-flow__panel.top.right` under the name `stack`; the whole r3
 * failure turns on those being two different boxes once the wrapper is sized,
 * so the probe never conflates them.
 */
const measure = `(() => {
  const canvas = document.querySelector('[data-browser-canvas]') || document.querySelector('.graph-canvas');
  const flow = document.querySelector('.react-flow');
  const wrapper = document.querySelector('.react-flow__panel.top.right');
  const stack = document.querySelector('.graph-top-right-stack');
  const topLeft = document.querySelector('.react-flow__panel.top.left');
  const controls = document.querySelector('.react-flow__controls');
  const power = document.querySelector('.graph-chain-power')?.closest('.react-flow__panel');
  if (!canvas || !flow || !wrapper || !stack) {
    return { missing: { canvas: !canvas, flow: !flow, wrapper: !wrapper, stack: !stack } };
  }
  const c = canvas.getBoundingClientRect();
  /** canvas-local, so numbers are comparable across viewport scroll positions */
  const local = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top - c.top, bottom: r.bottom - c.top, left: r.left - c.left, right: r.right - c.left, height: r.height, width: r.width };
  };
  const overlap = (a, b) => !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const w = local(wrapper), s = local(stack), t = local(topLeft), ctl = local(controls), p = local(power);

  /* Hit test: a point inside the wrapper but BELOW the visible stack. If the
     wrapper eats it, node interaction under the panel is dead. */
  let hit = null;
  if (w && s && w.bottom - s.bottom > 12) {
    const x = c.left + (w.left + w.right) / 2;
    const y = c.top + s.bottom + Math.min(24, (w.bottom - s.bottom) / 2);
    const el = document.elementFromPoint(x, y);
    hit = el ? { tag: el.tagName, cls: String(el.className).slice(0, 90),
                 insideWrapper: wrapper.contains(el) } : { tag: null };
  }

  const cs = getComputedStyle(stack);
  const cw = getComputedStyle(wrapper);
  return {
    canvas: { height: c.height, width: c.width },
    flow: local(flow),
    wrapper: w, stack: s, topLeft: t, controls: ctl, power: p,
    stackStyle: { maxHeight: cs.maxHeight, overflowY: cs.overflowY, pointerEvents: cs.pointerEvents },
    wrapperStyle: { bottom: cw.bottom, height: cw.height, pointerEvents: cw.pointerEvents, position: cw.position },
    scroll: { scrollHeight: stack.scrollHeight, clientHeight: stack.clientHeight,
              overflowing: stack.scrollHeight > stack.clientHeight + 1 },
    collide: {
      stackVsTopLeft: overlap(s, t), stackVsControls: overlap(s, ctl), stackVsPower: overlap(s, p),
      wrapperVsTopLeft: overlap(w, t), wrapperVsControls: overlap(w, ctl), wrapperVsPower: overlap(w, p),
    },
    hit,
  };
})()`;

function line(tag, m) {
  if (m.missing) return `${tag} MISSING ${JSON.stringify(m.missing)}`;
  const c = m.collide;
  return [
    tag,
    `canvas=${m.canvas.height}`,
    `flow=${m.flow.top}..${m.flow.bottom}`,
    `wrapper=${m.wrapper.top}..${m.wrapper.bottom}(h${m.wrapper.height})`,
    `stack=${m.stack.top}..${m.stack.bottom}(h${m.stack.height})`,
    `maxH=${m.stackStyle.maxHeight}`,
    `content=${m.scroll.scrollHeight}/${m.scroll.clientHeight}`,
    `overflowing=${m.scroll.overflowing}`,
    `ctl=${m.controls ? m.controls.top + ".." + m.controls.bottom : "none"}`,
    `pwr=${m.power ? m.power.top + ".." + m.power.bottom : "none"}`,
    `collide[stack tl/ctl/pwr=${c.stackVsTopLeft}/${c.stackVsControls}/${c.stackVsPower}` +
      ` wrapper=${c.wrapperVsTopLeft}/${c.wrapperVsControls}/${c.wrapperVsPower}]`,
    `wrapperPE=${m.wrapperStyle.pointerEvents}`,
    `hit=${m.hit ? m.hit.cls || m.hit.tag : "n/a"}`,
  ].join(" ");
}

/**
 * Baseline → sizing-only → sizing+pointer-events, measuring after each.
 * The middle arm is the control: it shows what the sizing change alone does to
 * hit-testing, so the pointer-events rule is justified by a measurement rather
 * than by a plausible story about z-index.
 */
async function runArms(cdp, tag) {
  const before = await evaluate(cdp, measure);

  if ((await evaluate(cdp, injectSizing)) !== true) {
    throw new Error(`${tag}: sizing injection failed`);
  }
  const sized = await evaluate(cdp, measure);
  if (before.stackStyle.maxHeight === sized.stackStyle.maxHeight) {
    throw new Error(
      `${tag}: sizing injection inert — max-height stayed ${before.stackStyle.maxHeight}`,
    );
  }

  if ((await evaluate(cdp, injectPointer)) !== true) {
    throw new Error(`${tag}: pointer-events injection failed`);
  }
  const full = await evaluate(cdp, measure);
  if (sized.wrapperStyle.pointerEvents === full.wrapperStyle.pointerEvents) {
    throw new Error(
      `${tag}: pointer-events injection inert — stayed ${sized.wrapperStyle.pointerEvents}`,
    );
  }

  process.stdout.write(`${line(`BASELINE  ${tag}`, before)}\n`);
  process.stdout.write(`${line(`SIZE-ONLY ${tag}`, sized)}\n`);
  process.stdout.write(`${line(`SIZE+PE   ${tag}`, full)}\n\n`);
}

/** Drives the interaction harness to the state where the mix row is rendered. */
async function expandMix(cdp) {
  await evaluate(
    cdp,
    `document.querySelector('.raw-feed-node-button[data-raw-item="stone"]').click()`,
  );
  await waitForExpression(
    cdp,
    `document.querySelector('[role="dialog"] select') !== null`,
    "extraction dialog",
  );
  // React tracks the DOM value node-side; a bare `.value =` is not observed.
  await evaluate(
    cdp,
    `(() => {
      const sel = document.querySelector('[role="dialog"] select');
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, 'miner_mk3');
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return sel.value;
    })()`,
  );
  await waitForExpression(
    cdp,
    `document.querySelector('[role="dialog"] [aria-label="Use node mix"]') !== null`,
    "mix checkbox present",
  );
  await evaluate(
    cdp,
    `document.querySelector('[role="dialog"] [aria-label="Use node mix"]').click()`,
  );
  // Hard liveness gate: if the mix never renders, the 380px number would be
  // measured against a collapsed panel and silently under-report.
  await waitForExpression(
    cdp,
    `document.querySelectorAll('[role="dialog"] .extraction-purity-fields input').length === 3`,
    "mix fields rendered",
  );
}

async function main({ cdp, vitePort }) {
  const base = `http://127.0.0.1:${vitePort}/features/extraction-planning/phase-1/browser-harness.html`;

  process.stdout.write("== GEOMETRY (harness pins canvas 340) ==\n");
  for (const width of [360, 720, 1280]) {
    for (const state of ["extraction", "combined"]) {
      await navigatePage(cdp, `${base}?mode=geometry&state=${state}`, width, 520);
      await waitForExpression(
        cdp,
        `document.querySelector('[data-harness-ready="geometry"]') !== null`,
        `${width}/${state}`,
      );
      await runArms(cdp, `${width}px ${state}`);
    }
  }

  process.stdout.write("== INTERACTION (real .graph-canvas height, mix expanded) ==\n");
  for (const width of [360, 720, 1280]) {
    await navigatePage(cdp, `${base}?mode=interaction`, width, 700);
    await waitForExpression(
      cdp,
      `document.querySelector('[data-harness-ready="interaction"] .raw-feed-node-button') !== null`,
      "interaction ready",
    );
    await expandMix(cdp);
    await runArms(cdp, `${width}px interaction`);
  }
}

await runBrowserCheck({ outputDir, check: main });
