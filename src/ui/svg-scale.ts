/**
 * Shared dm→px scale for the Blueprint + Combined floor plans (Stage 12 P1
 * Axis 2). Both views draw a decimeter-native viewBox and, until now, restated
 * the same `width="100%"` + `preserveAspectRatio="xMidYMid meet"` fit logic —
 * which compresses a 161-machine row until its machine rects are hairlines,
 * with NO scale floor. This one helper replaces both restatements with an
 * explicit-pixel scale that (a) reproduces today's effective meet scale when it
 * disengages and (b) refuses to shrink machines below a readable floor.
 */

import { LAYOUT } from "./layout.ts";

/**
 * The fixed reference width the fit computes against — the Schematic's own
 * posture (LAYOUT.viewW = 960), NOT a measured container. `width="100%"` needed
 * no measurement, and a live-containerW formula would need ResizeObserver
 * plumbing this design never specified; the Schematic already renders fixed-960
 * in the same content column, so the Blueprint matches it. Consequence: a
 * width-governed plan is pixel-identical to today only in a 960-wide column —
 * narrower columns render larger (toward readability), wider ~6.25% smaller.
 */
const REF_W = LAYOUT.viewW;

/**
 * Readability floor: the minimum px per decimeter the plan may render at. Tuned
 * so an oil_refinery (100 dm deep) keeps ≥6px machine rects (100 × 0.06 = 6).
 * Below the floor a wide plan renders at the floor and scrolls, rather than
 * compressing its machines to hairlines.
 */
export const MIN_PX_PER_DM = 0.06;

/**
 * The dm→px scale for a viewBox of `vbW × vbH` decimeters under a per-call-site
 * height cap `capH` (Blueprint 520, ChainBlueprint 640). The height term is
 * `min(vbH, capH) / vbH` — TODAY'S height attribute was `min(h, cap)`, so the
 * term never exceeds 1 and a sub-cap plan keeps its natural size (the boundary
 * review caught `capH / vbH` silently ENLARGING every plan shorter than the
 * cap — the smelter by 1.86×). Disengaged plans thus render as today does,
 * modulo the enumerated fixed-960 width delta; `scale = max(fit,
 * MIN_PX_PER_DM)` lifts only unreadably-wide plans off the floor. The caller
 * renders explicit `width = vbW * scale`, `height = vbH * scale` — both axes
 * from the one scale, so preserveAspectRatio is no longer needed.
 */
export function fitScale(vbW: number, vbH: number, capH: number): number {
  const fit = Math.min(REF_W / vbW, Math.min(vbH, capH) / vbH);
  return Math.max(fit, MIN_PX_PER_DM);
}
