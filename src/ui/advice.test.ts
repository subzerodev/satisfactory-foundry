/**
 * Table-driven tests for the pure advisory helpers (Stage 6 / Phase 2, frozen
 * Axis 5). The exact-arithmetic surface (suggestSupply/tierFixHint) is pinned
 * against Fractions; the approximation surface (stagePowerText/chainPowerText)
 * pins the exact-at-100% strings and the ≈-prefixed float strings.
 */

import { describe, it, expect } from "vitest";
import { Fraction } from "../core/fraction.ts";
import type { MachinePower } from "../data/types.ts";
import { TIER_TABLE } from "../data/tiers.ts";
import {
  suggestSupply,
  tierFixHint,
  stagePowerText,
  chainPowerText,
} from "./advice.ts";
import type { ChainStage, ChainCatalog } from "./advice.ts";

const f = (n: number) => Fraction.from(n);
const frac = (n: number, d: number) => Fraction.of(n, d);

// ---------------------------------------------------------------------------
// suggestSupply — exact ceil-division + surplus.
// ---------------------------------------------------------------------------

describe("suggestSupply", () => {
  it("the live case: demand 140, perMachine 7.5 → 19 machines, 5/2 surplus", () => {
    const got = suggestSupply(f(140), frac(15, 2));
    expect(got).not.toBeNull();
    expect(got!.machines).toBe(19);
    // 19 × 7.5 = 142.5; 142.5 − 140 = 2.5 = 5/2, exact.
    expect(got!.surplus.eq(frac(5, 2))).toBe(true);
  });

  it("an exact divide leaves zero surplus", () => {
    // 150 / 30 = 5 exactly, no remainder.
    const got = suggestSupply(f(150), f(30));
    expect(got).not.toBeNull();
    expect(got!.machines).toBe(5);
    expect(got!.surplus.isZero()).toBe(true);
  });

  it("zero perMachine → null (no invented count)", () => {
    expect(suggestSupply(f(140), f(0))).toBeNull();
  });

  it("negative perMachine → null (invalid lane)", () => {
    expect(suggestSupply(f(140), f(-5))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// tierFixHint — smallest full-table tier ≥ peak AND > binding.
// ---------------------------------------------------------------------------

describe("tierFixHint", () => {
  it("peak 80 on a Mk1 (60) binding → Mk2 (120), full-table index 1", () => {
    // Belt tiers: 60/120/270/480/780/1200. Smallest ≥ 80 AND > 60 is 120 (Mk2).
    const got = tierFixHint(f(80), "belt", f(60), TIER_TABLE);
    expect(got).not.toBeNull();
    expect(got!.capacity.eq(f(120))).toBe(true);
    expect(got!.tierIndex).toBe(1);
  });

  it("a peak beyond the top tier → null (no invented fix)", () => {
    // 1500 exceeds the top belt tier (1200), so no tier carries it.
    expect(tierFixHint(f(1500), "belt", f(60), TIER_TABLE)).toBeNull();
  });

  it("the override branch: binding below best-unlocked still yields a > binding tier", () => {
    // The output-side overridden-DOWN case: a Mk4 (480) lane overridden to
    // 90/min carries a 100/min span. peak 100 needs a tier ≥ 100 AND > 90 —
    // that is Mk2 (120), which sits BELOW the notionally-unlocked Mk4. The hint
    // binds to the finding's own busCapacity (90), so Mk2 is reachable.
    const got = tierFixHint(f(100), "belt", f(90), TIER_TABLE);
    expect(got).not.toBeNull();
    expect(got!.capacity.eq(f(120))).toBe(true);
    expect(got!.tierIndex).toBe(1);
  });

  it("a tier that carries the peak but does not exceed the binding is rejected", () => {
    // peak 60 on a 120 binding: 60 ≤ 120 so 60 is a carrier, but 60 is NOT
    // > 120. The smallest tier both ≥ 60 AND > 120 is 270 (Mk3).
    const got = tierFixHint(f(60), "belt", f(120), TIER_TABLE);
    expect(got).not.toBeNull();
    expect(got!.capacity.eq(f(270))).toBe(true);
    expect(got!.tierIndex).toBe(2);
  });

  it("resolves against the pipe table for a pipe lane", () => {
    // Pipe tiers: 300/600. peak 350 on a 300 binding → Mk2 (600), index 1.
    const got = tierFixHint(f(350), "pipe", f(300), TIER_TABLE);
    expect(got).not.toBeNull();
    expect(got!.capacity.eq(f(600))).toBe(true);
    expect(got!.tierIndex).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// stagePowerText — exact at 100%, ≈-labeled otherwise, variable suffix.
// ---------------------------------------------------------------------------

const constantPower: MachinePower = {
  mw: f(4),
  variable: false,
  // The bundled snapshot's common exponent (1.321929).
  exponent: frac(1321929, 1000000),
};

const variablePower: MachinePower = {
  // Midpoint of 250–1500 = 875.
  mw: frac(875, 1),
  variable: true,
  minMw: f(250),
  maxMw: f(1500),
  exponent: frac(16, 10),
};

describe("stagePowerText", () => {
  it("100% clock → the exact draw string, no ≈", () => {
    // 20 machines × 4 MW = 80 MW, exact.
    expect(stagePowerText(constantPower, 20, f(100))).toBe("80 MW");
  });

  it("100% clock, fractional total renders exactly", () => {
    // 3 machines × 4 MW = 12 MW.
    expect(stagePowerText(constantPower, 3, f(100))).toBe("12 MW");
  });

  it("other clocks → the ≈ prefix with a 1-decimal float value", () => {
    // 1 machine × 4 MW × (150/100)^1.321929 ≈ 4 × 1.6939… ≈ 6.8 MW.
    const got = stagePowerText(constantPower, 1, f(150));
    expect(got.startsWith("≈ ")).toBe(true);
    expect(got.endsWith(" MW")).toBe(true);
    // Pin the value: 4 × 1.5^1.321929 to one decimal.
    const factor = 1.5 ** (1321929 / 1000000);
    expect(got).toBe(`≈ ${(4 * factor).toFixed(1)} MW`);
  });

  it("count scaling holds at other clocks", () => {
    // The total scales linearly in the machine count for a fixed clock/exponent.
    const one = stagePowerText(constantPower, 1, f(150));
    const ten = stagePowerText(constantPower, 10, f(150));
    const oneVal = Number(one.replace("≈ ", "").replace(" MW", ""));
    const tenVal = Number(ten.replace("≈ ", "").replace(" MW", ""));
    // 10× the machines ≈ 10× the draw (allowing the 1-decimal rounding).
    expect(tenVal).toBeCloseTo(oneVal * 10, 0);
  });

  it("variable machine: midpoint drives the number, suffix from exact bounds", () => {
    // 2 machines at 100%: 2 × 875 = 1750 MW exact; suffix 2×250–2×1500.
    expect(stagePowerText(variablePower, 2, f(100))).toBe(
      "1750 MW (varies 500–3000 MW)",
    );
  });

  it("overclocked variable machine scales the varies-range by the same factor", () => {
    // 200% @ exponent 1.321929: factor = 2^1.321929 ≈ 2.5 — the leading ≈
    // number must sit INSIDE the stated (varies ≈ lo–hi) envelope.
    const power = {
      mw: Fraction.from(875),
      variable: true,
      minMw: Fraction.from(250),
      maxMw: Fraction.from(1500),
      exponent: Fraction.parse("1.321929"),
    };
    const text = stagePowerText(power, 1, Fraction.from(200));
    expect(text).toContain("≈");
    expect(text).toContain("(varies ≈ ");
    const nums = [...text.matchAll(/([\d.]+)/g)].map((x) => Number(x[1]));
    // nums: [total, lo, hi] — total within [lo, hi]
    const [total, lo, hi] = nums;
    expect(total).toBeDefined();
    expect(total!).toBeGreaterThanOrEqual(lo!);
    expect(total!).toBeLessThanOrEqual(hi!);
  });
});

// ---------------------------------------------------------------------------
// chainPowerText — Σ over solved+powered stages only, null when none.
// ---------------------------------------------------------------------------

const chainCatalog: ChainCatalog = {
  recipes: {
    ingot: { machineId: "smelter" },
    plate: { machineId: "constructor" },
  },
  machines: {
    smelter: { power: constantPower },
    constructor: {
      power: { mw: f(4), variable: false, exponent: frac(16, 10) },
    },
  },
};

function chainStage(
  recipeId: string | null,
  machineCount: number,
  clockPercentText: string,
  status: "idle" | "solved" | "invalid",
): ChainStage {
  return {
    selection: { recipeId, machineCount, clockPercentText },
    solve: { status },
  };
}

describe("chainPowerText", () => {
  it("sums only the solved+powered stages, ≈-labeled", () => {
    // Two solved smelter-ish stages at 100%: 20×4 + 10×4 = 120 MW.
    const stages: ChainStage[] = [
      chainStage("ingot", 20, "100", "solved"),
      chainStage("plate", 10, "100", "solved"),
    ];
    expect(chainPowerText(stages, chainCatalog)).toBe("Σ ≈ 120 MW");
  });

  it("skips idle and invalid stages", () => {
    // Only the first (solved) stage bills: 20×4 = 80 MW. The idle + invalid
    // stages have no running machines and contribute nothing.
    const stages: ChainStage[] = [
      chainStage("ingot", 20, "100", "solved"),
      chainStage("plate", 999, "100", "idle"),
      chainStage("plate", 999, "abc", "invalid"),
    ];
    expect(chainPowerText(stages, chainCatalog)).toBe("Σ ≈ 80 MW");
  });

  it("null when no solved stage has power", () => {
    const stages: ChainStage[] = [
      chainStage(null, 5, "100", "idle"),
      chainStage("plate", 5, "100", "invalid"),
    ];
    expect(chainPowerText(stages, chainCatalog)).toBeNull();
  });

  it("null on an empty stage list", () => {
    expect(chainPowerText([], chainCatalog)).toBeNull();
  });
});
