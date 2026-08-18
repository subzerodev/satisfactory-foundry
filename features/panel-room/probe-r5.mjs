/**
 * #134 r5 grounding probe — measures "variant D", the shape both r4 reviewers
 * proposed independently and both explicitly flagged as CSS-derived and
 * UNMEASURED. Nothing here ships; it exists so r5 adopts D on evidence or
 * rejects it on evidence.
 *
 * Variant D: cap the WRAPPER (.react-flow__panel.top.right) as a percentage of
 * .react-flow, leaving it height:auto so it still shrink-wraps to
 * min(content, cap), and move the scroll container up to it. If that resolves,
 * it deletes r4's two riskiest parts — the pointer-events rule (a behavioural
 * change in a layout-only ticket) and the rebinding of check.mjs:122 — because
 * the wrapper stays the visible box and never covers canvas furniture.
 *
 * Constants carry a 6px clearance, which r4 spent to zero:
 *   desktop  K = 78  -> cap = H - 80   (260 at H=340: exactly today's cap)
 *   narrow   K = 173 -> cap = H - 175  (165 at H=340)
 *
 * Runs the FULL geometry matrix including state=notice, which probe-r4 skipped.
 */
import {
  evaluate,
  navigatePage,
  runBrowserCheck,
  waitForExpression,
} from "../../scripts/browser-check-runtime.mjs";

const outputDir = "/tmp/satisfactory-foundry-134-probe-r5";

/**
 * `max-height: none` / `overflow-y: visible` on the stack stand in for DELETING
 * the shipped declarations — an injected sheet cannot remove a rule, only
 * override it. The computed-value guards below assert the override actually won,
 * so this substitution cannot silently fail to represent the real edit.
 */
const VARIANT_D_CSS = `
.graph-canvas .react-flow__panel.top.right {
  max-height: calc(100% - 78px);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.graph-top-right-stack {
  max-height: none;
  overflow-y: visible;
}
@media (max-width: 720px) {
  .graph-canvas .react-flow__panel.top.right { max-height: calc(100% - 173px); }
}
`;

const inject = `(() => {
  const style = document.createElement('style');
  style.id = 'probe-r5-variant-d';
  style.textContent = ${JSON.stringify(VARIANT_D_CSS)};
  document.head.appendChild(style);
  return document.getElementById('probe-r5-variant-d') !== null;
})()`;

const measure = `(() => {
  const canvas = document.querySelector('[data-browser-canvas]') || document.querySelector('.graph-canvas');
  const flow = document.querySelector('.react-flow');
  const wrapper = document.querySelector('.react-flow__panel.top.right');
  const stack = document.querySelector('.graph-top-right-stack');
  const topLeft = document.querySelector('.react-flow__panel.top.left');
  const controls = document.querySelector('.react-flow__controls');
  const attribution = document.querySelector('.react-flow__attribution');
  const power = document.querySelector('.graph-chain-power')?.closest('.react-flow__panel');
  if (!canvas || !flow || !wrapper || !stack) {
    return { missing: { canvas: !canvas, flow: !flow, wrapper: !wrapper, stack: !stack } };
  }
  const c = canvas.getBoundingClientRect();
  const local = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top - c.top, bottom: r.bottom - c.top, left: r.left - c.left, right: r.right - c.left, height: r.height, width: r.width };
  };
  const overlap = (a, b) => !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const w = local(wrapper), s = local(stack), t = local(topLeft),
        ctl = local(controls), p = local(power), attr = local(attribution);

  /* Hit-test helper in canvas-local coords. */
  const hitAt = (lx, ly) => {
    const el = document.elementFromPoint(c.left + lx, c.top + ly);
    return el ? { cls: String(el.className || el.tagName).slice(0, 60), insideWrapper: wrapper.contains(el) } : null;
  };
  /* The regions r4's reviewers flagged as untested when the wrapper inflates. */
  const hits = {
    belowWrapper: w ? hitAt((w.left + w.right) / 2, Math.min(w.bottom + 20, c.height - 2)) : null,
    controlsBtn: ctl ? hitAt((ctl.left + ctl.right) / 2, ctl.top + 10) : null,
    attribution: attr ? hitAt((attr.left + attr.right) / 2, (attr.top + attr.bottom) / 2) : null,
    grip: hitAt(c.width - 6, c.height - 6),
  };

  const cwS = getComputedStyle(stack), cwW = getComputedStyle(wrapper);
  return {
    canvas: { height: c.height, width: c.width },
    flow: local(flow),
    wrapper: w, stack: s, topLeft: t, controls: ctl, power: p, attribution: attr,
    wrapperStyle: { maxHeight: cwW.maxHeight, overflowY: cwW.overflowY, overscroll: cwW.overscrollBehaviorY, height: cwW.height },
    stackStyle: { maxHeight: cwS.maxHeight, overflowY: cwS.overflowY },
    wrapperScroll: { scrollHeight: wrapper.scrollHeight, clientHeight: wrapper.clientHeight,
                     overflowing: wrapper.scrollHeight > wrapper.clientHeight + 1, scrollTop: wrapper.scrollTop },
    /* Positive numbers = gap; 0 = tangent; negative = collision. */
    clearance: {
      toPower: p && w ? p.top - w.bottom : null,
      toControls: ctl && w ? ctl.top - w.bottom : null,
      toCanvas: w ? c.height - w.bottom : null,
    },
    collide: {
      wrapperVsTopLeft: overlap(w, t), wrapperVsControls: overlap(w, ctl), wrapperVsPower: overlap(w, p),
    },
    hits,
  };
})()`;

function line(tag, m) {
  if (m.missing) return `${tag} MISSING ${JSON.stringify(m.missing)}`;
  const c = m.collide, cl = m.clearance;
  return [
    tag,
    `canvas=${m.canvas.height}`,
    `wrapper=${m.wrapper.top}..${m.wrapper.bottom}(h${m.wrapper.height})`,
    `wrapMaxH=${m.wrapperStyle.maxHeight}`,
    `wrapOverflowY=${m.wrapperStyle.overflowY}`,
    `stackMaxH=${m.stackStyle.maxHeight}`,
    `content=${m.wrapperScroll.scrollHeight}/${m.wrapperScroll.clientHeight}`,
    `overflowing=${m.wrapperScroll.overflowing}`,
    `clear[pwr=${cl.toPower} ctl=${cl.toControls} canvas=${cl.toCanvas}]`,
    `collide[tl/ctl/pwr=${c.wrapperVsTopLeft}/${c.wrapperVsControls}/${c.wrapperVsPower}]`,
    `hit[below=${m.hits.belowWrapper?.cls} ctlBtn=${m.hits.controlsBtn?.cls} attr=${m.hits.attribution?.cls} grip=${m.hits.grip?.cls}]`,
  ].join(" ");
}

async function runArms(cdp, tag) {
  const before = await evaluate(cdp, measure);
  if ((await evaluate(cdp, inject)) !== true) throw new Error(`${tag}: injection failed`);
  const after = await evaluate(cdp, measure);

  // Three independent inertness guards. r4's reviewers caught that a single
  // guard on one declaration lets a silently-inert sibling look like success.
  if (before.wrapperStyle.maxHeight === after.wrapperStyle.maxHeight) {
    throw new Error(`${tag}: wrapper max-height inert — stayed ${before.wrapperStyle.maxHeight}`);
  }
  if (after.stackStyle.maxHeight !== "none") {
    throw new Error(`${tag}: stack max-height override lost — ${after.stackStyle.maxHeight}`);
  }
  if (after.wrapperStyle.overflowY !== "auto") {
    throw new Error(`${tag}: wrapper overflow-y did not apply — ${after.wrapperStyle.overflowY}`);
  }
  // The whole point of D: the wrapper must NOT become a fixed-height box.
  if (after.wrapperStyle.maxHeight === after.wrapperStyle.height) {
    process.stdout.write(`${tag}: NOTE wrapper is at its cap (content exceeds it)\n`);
  }

  process.stdout.write(`${line(`BASELINE ${tag}`, before)}\n`);
  process.stdout.write(`${line(`VARIANT-D ${tag}`, after)}\n\n`);
}

async function expandMix(cdp) {
  await evaluate(cdp, `document.querySelector('.raw-feed-node-button[data-raw-item="stone"]').click()`);
  await waitForExpression(cdp, `document.querySelector('[role="dialog"] select') !== null`, "extraction dialog");
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
  await waitForExpression(cdp, `document.querySelector('[role="dialog"] [aria-label="Use node mix"]') !== null`, "mix checkbox");
  await evaluate(cdp, `document.querySelector('[role="dialog"] [aria-label="Use node mix"]').click()`);
  await waitForExpression(
    cdp,
    `document.querySelectorAll('[role="dialog"] .extraction-purity-fields input').length === 3`,
    "mix fields rendered",
  );
}

async function main({ cdp, vitePort }) {
  const base = `http://127.0.0.1:${vitePort}/features/extraction-planning/phase-1/browser-harness.html`;

  process.stdout.write("== GEOMETRY (canvas pinned 340) — full matrix incl. notice ==\n");
  for (const width of [360, 720, 1280]) {
    for (const state of ["notice", "extraction", "combined"]) {
      await navigatePage(cdp, `${base}?mode=geometry&state=${state}`, width, 520);
      await waitForExpression(
        cdp,
        `document.querySelector('[data-harness-ready="geometry"]') !== null`,
        `${width}/${state}`,
      );
      await runArms(cdp, `${width}px ${state}`);
    }
  }

  process.stdout.write("== INTERACTION (real 560 canvas, mix expanded) ==\n");
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
