import { useState } from "react";
import { fitScale } from "./svg-scale.ts";

/**
 * The [FIT | DETAIL] zoom control shared by both blueprint views (Stage 12 P3
 * Axis C2). Big plans open zoomed IN (readable, Michael's "we need to start
 * zoomed in"); small plans (fit ≥ 1) open exactly as today and show NO toggle.
 *
 * DETAIL = 1 px/dm (natural size — making the toggle label honest);
 * FIT     = the P1 fit/floor scale.
 *
 * The mode is per-view presentation-only state (useState, not the store, not
 * persisted). Both views mount this via the ONE canonical gate:
 * fitScale(w, h, cap) < 1 — small plans render at natural size and never mount
 * the toggle at all. Pan is native scroll (head-anchored passively: scrollLeft
 * is naturally 0, no scroll-management JS).
 */
export type ZoomMode = "fit" | "detail";

/** DETAIL = 1 px/dm — the natural-size scale the "DETAIL" label promises. */
const READABLE_PX_PER_DM = 1.0;

/**
 * The pure scale decision — the active render scale + whether the toggle
 * should mount, from a viewBox's dm dimensions and the view's height cap.
 * Factored out of the hook so it is unit-testable without a renderer.
 * `showToggle` is the one canonical gate (fit < 1); `mode` is the per-view
 * state. When mounted the DEFAULT mode is DETAIL; when not, the view IS
 * already at natural/detail scale (fit ≥ 1), so `atDetail` is true and any
 * DETAIL-only chrome (Blueprint's gutter labels) renders.
 */
export function readableScaleFor(
  w: number,
  h: number,
  capH: number,
  mode: ZoomMode,
) {
  const fit = fitScale(w, h, capH);
  const showToggle = fit < 1;
  // When no toggle is mounted the view is fixed at fit (= natural size, ≥ 1);
  // the per-view `mode` only takes effect while the toggle is present.
  const effectiveMode: ZoomMode = showToggle ? mode : "fit";
  const scale =
    effectiveMode === "detail" ? Math.max(fit, READABLE_PX_PER_DM) : fit;
  // Gutter labels render only at DETAIL (fit ≥ 1 IS detail — natural size).
  const atDetail = effectiveMode === "detail" || fit >= 1;
  return { scale, atDetail, showToggle };
}

export function useReadableScale(w: number, h: number, capH: number) {
  // DEFAULT mode when the toggle mounts: DETAIL (open big plans readable).
  const [mode, setMode] = useState<ZoomMode>("detail");
  const { scale, atDetail, showToggle } = readableScaleFor(w, h, capH, mode);
  return { scale, atDetail, showToggle, mode, setMode };
}

export function ZoomToggle({
  mode,
  setMode,
}: {
  mode: ZoomMode;
  setMode: (m: ZoomMode) => void;
}) {
  return (
    <div className="bp-zoom-toggle">
      <button
        type="button"
        className={mode === "fit" ? "bp-zoom-btn active" : "bp-zoom-btn"}
        aria-pressed={mode === "fit"}
        onClick={() => setMode("fit")}
      >
        FIT
      </button>
      <button
        type="button"
        className={mode === "detail" ? "bp-zoom-btn active" : "bp-zoom-btn"}
        aria-pressed={mode === "detail"}
        onClick={() => setMode("detail")}
      >
        DETAIL
      </button>
    </div>
  );
}
