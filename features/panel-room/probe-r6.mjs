/**
 * #134 grounding probe — measures "variant D", the shape both r4 reviewers
 * proposed independently and both explicitly flagged as CSS-derived and
 * UNMEASURED. Nothing here ships; it exists so the design adopts D on evidence
 * or rejects it on evidence. Written for r6 and still current through r8 — the
 * CSS has not changed since r5.
 *
 * Variant D: cap the WRAPPER (.react-flow__panel.top.right) as a percentage of
 * .react-flow, leaving it height:auto so it still shrink-wraps to
 * min(content, cap), and move the scroll container up to it. If that resolves,
 * it deletes r4's two riskiest parts — the pointer-events rule (a behavioural
 * change in a layout-only ticket) and the rebinding of check.mjs:122 — because
 * the wrapper stays the visible box and never covers canvas furniture.
 *
 * Clearance is asymmetric, because the binding furniture differs by width:
 *   desktop  K = 78  -> cap = H - 80   (260 at H=340: exactly today's cap)
 *   narrow   K = 169 -> cap = H - 171  (169 at H=340)
 *
 * Runs the FULL geometry matrix including state=notice, which probe-r4 skipped.
 */
import {
  evaluate,
  navigatePage,
  runBrowserCheck,
  waitForExpression,
} from "../../scripts/browser-check-runtime.mjs";

const outputDir = "/tmp/satisfactory-foundry-134-probe-r6";

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
  .graph-canvas .react-flow__panel.top.right { max-height: calc(100% - 169px); }
}
`;

const inject = `(() => {
  const style = document.createElement('style');
  style.id = 'probe-r6-variant-d';
  style.textContent = ${JSON.stringify(VARIANT_D_CSS)};
  document.head.appendChild(style);
  return document.getElementById('probe-r6-variant-d') !== null;
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
  /*
   * r5's belowWrapper sampled at w.bottom + 20, which TRACKS the wrapper, so it
   * structurally could not sample the band the change newly covers.
   * newlyCovered samples a FIXED canvas-local y just under where the shipped
   * wrapper ends: baseline shows what is there today, variant shows what now
   * sits on top of it. Fixed in y ONLY — x is the wrapper's own centre, so it
   * differs between arms wherever the wrapper's width does (1280 interaction:
   * 1086.5 baseline vs 1094 variant). Both x values fall inside both boxes, so
   * the readings still compare, but this is not literally the same point. Two
   * y values are
   * needed because the shipped wrapper ends at a different y per width —
   * 219 narrow, 276 desktop — so y=239 probes the narrow band and y=296 the
   * desktop one. r6's reviewers caught that a single y=239 sample sits INSIDE
   * the shipped desktop wrapper and therefore witnesses nothing there.
   */
  const hits = {
    belowWrapper: w ? hitAt((w.left + w.right) / 2, Math.min(w.bottom + 20, c.height - 2)) : null,
    newlyCovered: w ? hitAt((w.left + w.right) / 2, 239) : null,
    newlyCoveredDesktop: w ? hitAt((w.left + w.right) / 2, 296) : null,
    controlsBtn: ctl ? hitAt((ctl.left + ctl.right) / 2, ctl.top + 10) : null,
    attribution: attr ? hitAt((attr.left + attr.right) / 2, (attr.top + attr.bottom) / 2) : null,
    grip: hitAt(c.width - 6, c.height - 6),
  };

  /*
   * The dead-zone measure that actually matters. r4 failed because the wrapper
   * grew past its content, leaving TRANSPARENT area that swallowed canvas
   * clicks. Here the wrapper should always be exactly filled by the stack.
   */
  const deadZone = w && s ? Math.round(w.height - Math.min(s.height, w.height)) : null;

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
    deadZone,
    hits,
  };
})()`;

function line(tag, m) {
  if (m.missing) return `${tag} MISSING ${JSON.stringify(m.missing)}`;
  const c = m.collide, cl = m.clearance;
  return [
    tag,
    `canvas=${m.canvas.height}x${m.canvas.width}`,
    `flow=${m.flow.top}..${m.flow.bottom}`,
    `wrapper=${m.wrapper.top}..${m.wrapper.bottom}(h${m.wrapper.height} x${m.wrapper.left}..${m.wrapper.right})`,
    `stack=${m.stack.top}..${m.stack.bottom}(h${m.stack.height} x${m.stack.left}..${m.stack.right})`,
    `deadZone=${m.deadZone}`,
    `wrapMaxH=${m.wrapperStyle.maxHeight}`,
    `wrapOverflowY=${m.wrapperStyle.overflowY}`,
    `wrapOverscroll=${m.wrapperStyle.overscroll}`,
    `stackMaxH=${m.stackStyle.maxHeight}`,
    `content=${m.wrapperScroll.scrollHeight}/${m.wrapperScroll.clientHeight}`,
    `overflowing=${m.wrapperScroll.overflowing}`,
    `ctl=${m.controls ? m.controls.top + ".." + m.controls.bottom : "none"}`,
    `pwr=${m.power ? m.power.top + ".." + m.power.bottom : "none"}`,
    `clear[pwr=${cl.toPower} ctl=${cl.toControls} canvas=${cl.toCanvas}]`,
    `collide[tl/ctl/pwr=${c.wrapperVsTopLeft}/${c.wrapperVsControls}/${c.wrapperVsPower}]`,
    `hit[below=${m.hits.belowWrapper?.cls}/${m.hits.belowWrapper?.insideWrapper}` +
      ` newly239=${m.hits.newlyCovered?.cls}/${m.hits.newlyCovered?.insideWrapper}` +
      ` newly296=${m.hits.newlyCoveredDesktop?.cls}/${m.hits.newlyCoveredDesktop?.insideWrapper}` +
      ` ctlBtn=${m.hits.controlsBtn?.insideWrapper} attr=${m.hits.attribution?.insideWrapper}` +
      ` grip=${m.hits.grip?.insideWrapper}]`,
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
  // Both stack declarations are guarded, not just max-height: r4's reviewers
  // caught exactly this single-sibling gap, and r6's caught the comment above
  // claiming a completeness the guard set did not have.
  if (after.stackStyle.overflowY !== "visible") {
    throw new Error(`${tag}: stack overflow-y override lost — ${after.stackStyle.overflowY}`);
  }
  if (after.wrapperStyle.overflowY !== "auto") {
    throw new Error(`${tag}: wrapper overflow-y did not apply — ${after.wrapperStyle.overflowY}`);
  }
  // r5 compared an unresolved `calc(...)` string against a px string here, so
  // the check could never fire. `overflowing` already reports at-cap, so the
  // replacement guards something real instead: overscroll must move with the
  // scroll container, or the stack keeps a containment rule it can no longer act on.
  if (after.wrapperStyle.overscroll !== "contain") {
    throw new Error(`${tag}: wrapper overscroll-behavior did not apply — ${after.wrapperStyle.overscroll}`);
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

    /*
     * Grounding for GATE CHANGE 7 (r8 numbering; this block was written when it
     * was change 6): containment asserted BEFORE any scrollIntoView, at the real
     * 560px canvas where the content fits.
     *
     * Scope this narrowly. It says nothing about check.mjs:163-171, which runs
     * only in the pinned-340px geometry matrix — a world where this design
     * deliberately overflows and pre-scroll containment is therefore FALSE, not
     * merely untested. r6 cited these rows as proof that :167 could be made
     * non-tautological; r7's reviewers showed that inference crosses world
     * states, and the spec retracts it. These rows support change 7 only.
     */
    const pure = await evaluate(
      cdp,
      `(() => {
        const input = document.querySelector('[role="dialog"] [aria-label="Pure nodes"]');
        const wrapper = document.querySelector('.react-flow__panel.top.right');
        if (!input || !wrapper) return { found: false };
        const r = input.getBoundingClientRect(), w = wrapper.getBoundingClientRect();
        return {
          found: true,
          containedNoScroll: r.top >= w.top && r.bottom <= w.bottom && r.left >= w.left && r.right <= w.right,
          overhang: Math.round(r.bottom - w.bottom),
          wrapperScrollTop: wrapper.scrollTop,
        };
      })()`,
    );
    if (!pure.found) throw new Error(`${width}px: Pure input not found`);
    process.stdout.write(
      `PURE-NOSCROLL ${width}px contained=${pure.containedNoScroll} overhang=${pure.overhang} scrollTop=${pure.wrapperScrollTop}\n\n`,
    );
  }
}

await runBrowserCheck({ outputDir, check: main });
