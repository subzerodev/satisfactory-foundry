import { describe, it, expect } from "vitest";
import { fitScale, MIN_PX_PER_DM } from "./svg-scale.ts";
import { LAYOUT } from "./layout.ts";

/**
 * The shared dm→px scale floor (Stage 12 P1 Axis 2). fitScale is the min of the
 * fixed-reference width fit (960/vbW) and the height-cap fit (capH/vbH), floored
 * at MIN_PX_PER_DM. The three arms — width-governed, height-governed, and floored
 * — are each pinned, plus the per-call-site capH parameterization (520 vs 640).
 */
describe("fitScale — the shared scale floor", () => {
  it("keeps a sub-cap plan at natural size (the smelter case)", () => {
    // Smelter ×2 viewBox 200×280 under cap 520: the height term is
    // min(280,520)/280 = 1 — today's height attribute was min(h,cap), so a
    // sub-cap plan NEVER enlarges (the boundary review caught cap/vbH
    // silently rendering it 1.86× today's size).
    const scale = fitScale(200, 280, 520);
    expect(scale).toBe(1);
    expect(scale).toBeLessThan(LAYOUT.viewW / 200);
  });

  it("caps a DEEPER-than-cap plan exactly as today's min(h,cap) attribute", () => {
    // vbH 800 over cap 520: height term = 520/800 = 0.65 — identical to
    // today's capped meet for cap-hitting plans.
    expect(fitScale(200, 800, 520)).toBeCloseTo(520 / 800, 10);
  });

  it("is width-governed when the fixed reference is the tighter fit", () => {
    // A wide-but-shallow plan: 3000×100 under cap 520. min(960/3000=0.32,
    // 520/100=5.2) → width governs at 0.32, still above the 0.06 floor.
    const scale = fitScale(3000, 100, 520);
    expect(scale).toBeCloseTo(LAYOUT.viewW / 3000, 10);
    expect(scale).toBeGreaterThan(MIN_PX_PER_DM);
  });

  it("clamps to MIN_PX_PER_DM when a very wide plan would fit below the floor", () => {
    // The 161-machine row is ~17710 dm wide: 960/17710 ≈ 0.054 < 0.06, so the
    // floor engages and the render scrolls at exactly MIN_PX_PER_DM.
    const scale = fitScale(17710, 800, 520);
    expect(960 / 17710).toBeLessThan(MIN_PX_PER_DM); // guards the premise
    expect(scale).toBe(MIN_PX_PER_DM);
  });

  it("floors at exactly 6px for a 100dm-deep oil_refinery (the rationale)", () => {
    // MIN_PX_PER_DM is tuned so a 100 dm machine keeps ≥6px: 100 × 0.06 = 6.
    expect(100 * MIN_PX_PER_DM).toBe(6);
  });

  it("takes capH per call site: 520 vs 640 diverge for cap-hitting plans", () => {
    // A 700dm-deep plan hits both caps differently: 520/700 vs 640/700; a
    // sub-cap plan (280dm) is 1 under either cap (natural size, no enlarge).
    expect(fitScale(200, 700, 520)).toBeCloseTo(520 / 700, 10);
    expect(fitScale(200, 700, 640)).toBeCloseTo(640 / 700, 10);
    expect(fitScale(200, 280, 640)).toBe(1);
  });
});
