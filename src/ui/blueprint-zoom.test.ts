/**
 * The pure zoom-scale decision (Stage 12 P3 Axis C2). `readableScaleFor` is the
 * renderer-free core of useReadableScale: the toggle mount gate (fit < 1), the
 * FIT/DETAIL scale, and the gutter-visibility flag. Both blueprint views share
 * it; the hook only adds the per-view useState around it.
 */

import { describe, it, expect } from "vitest";
import { readableScaleFor } from "./blueprint-zoom.tsx";
import { fitScale } from "./svg-scale.ts";

describe("readableScaleFor — the toggle gate + FIT/DETAIL scale", () => {
  // A sub-cap plan (the smelter's 200×280 viewBox under cap 520) fits ≥ 1.
  const smallW = 200;
  const smallH = 280;
  // A floored wide plan (a 60-machine smelter row): w ≫ 960 → fit < 1.
  const wideW = 3640;
  const wideH = 280;
  const cap = 520;

  it("no toggle for a sub-cap plan (fit ≥ 1) — it opens at natural size", () => {
    const fit = fitScale(smallW, smallH, cap);
    expect(fit).toBe(1); // the smelter sits at exactly natural size
    const r = readableScaleFor(smallW, smallH, cap, "detail");
    expect(r.showToggle).toBe(false);
    expect(r.scale).toBe(1);
    // fit ≥ 1 IS detail — the gutter labels render even with no toggle mounted.
    expect(r.atDetail).toBe(true);
  });

  it("mounts the toggle for a floored plan (fit < 1)", () => {
    const fit = fitScale(wideW, wideH, cap);
    expect(fit).toBeLessThan(1);
    expect(readableScaleFor(wideW, wideH, cap, "detail").showToggle).toBe(true);
    expect(readableScaleFor(wideW, wideH, cap, "fit").showToggle).toBe(true);
  });

  it("DETAIL scale is 1 px/dm; FIT scale is the floored fit — floored plan", () => {
    const fit = fitScale(wideW, wideH, cap);
    const detail = readableScaleFor(wideW, wideH, cap, "detail");
    const fitMode = readableScaleFor(wideW, wideH, cap, "fit");
    // DETAIL = max(fit, 1) = 1 px/dm (natural, readable).
    expect(detail.scale).toBe(1);
    // FIT = the fit/floor scale, strictly below 1 here.
    expect(fitMode.scale).toBe(fit);
    expect(fitMode.scale).toBeLessThan(1);
  });

  it("gutter labels: PRESENT at DETAIL, ABSENT at FIT (floored plan)", () => {
    // The DETAIL-only rule: at FIT a floored plan's adjacent lanes sit sub-pixel
    // apart, so names are DETAIL's job and the gutter collapses.
    expect(readableScaleFor(wideW, wideH, cap, "detail").atDetail).toBe(true);
    expect(readableScaleFor(wideW, wideH, cap, "fit").atDetail).toBe(false);
  });
});
