import { describe, it, expect } from "vitest";
import { Fraction } from "../core/fraction.ts";
import { solveStage } from "../core/manifold.ts";
import type { Catalog, CatalogRecipe } from "./types.ts";
import { TIER_TABLE } from "./tiers.ts";
import { toStageInput, parseRational } from "./stage-input.ts";

// A minimal catalog carrying just the items the fixtures reference; recipes is
// empty because toStageInput reads only recipe.inputs/outputs + catalog.items.
function catalogWith(items: Record<string, { isFluid: boolean }>): Catalog {
  const full: Catalog["items"] = {};
  for (const [id, { isFluid }] of Object.entries(items)) {
    // stackSize is irrelevant to toStageInput (it reads only isFluid); null.
    full[id] = { id, displayName: id, isFluid, stackSize: null };
  }
  return {
    items: full,
    machines: {},
    recipes: {},
    tiers: TIER_TABLE,
    recipeUnlocks: {},
    extractors: {},
  };
}

function io(itemId: string, perMinute: Fraction) {
  return { itemId, perMinute };
}

// The Phase 1 20-smelter worked example, reproduced through a recipe: one solid
// ingredient at 30/min and one solid product at 30/min. dur "2", Amount "1" on
// both sides gives 1×60/2 = 30 (mirrored so BOTH feed and output sides match
// the known result).
const IRON: CatalogRecipe = {
  id: "ingot_iron",
  displayName: "Iron Ingot",
  machineId: "smelter_mk1",
  isAlternate: false,
  inputs: [io("ore_iron", Fraction.from(30))],
  outputs: [io("iron_ingot", Fraction.from(30))],
  primaryOutputId: "iron_ingot",
};
const IRON_CATALOG = catalogWith({
  ore_iron: { isFluid: false },
  iron_ingot: { isFluid: false },
});

describe("toStageInput — live-solver integration proof (spec row 5)", () => {
  it("reproduces the Phase 1 20-smelter result on the REAL solver (both sides)", () => {
    const input = toStageInput(IRON, IRON_CATALOG, {
      machineCount: 20,
      clockPercent: Fraction.from(100),
      unlockedTiers: { belt: 4, pipe: 2 },
    });
    // Capacities are the sliced belt table [60,120,270,480].
    expect(input.capacities.belt.map((c) => c.toString())).toEqual([
      "60",
      "120",
      "270",
      "480",
    ]);

    const result = solveStage(input);
    expect(result.findings).toEqual([]);

    // FEED lane: belts [480, 120@after-16]; segments [1..16]@480 / [17..20]@120.
    const feed = result.feeds[0]!;
    expect(feed.findings).toEqual([]);
    expect(feed.belts.map((b) => b.capacity.toString())).toEqual([
      "480",
      "120",
    ]);
    expect(feed.belts.map((b) => b.entersAfterMachine)).toEqual([0, 16]);
    expect(
      feed.segments.map((s) => [
        s.fromMachine,
        s.toMachine,
        s.peakFlow.toString(),
      ]),
    ).toEqual([
      [1, 16, "480"],
      [17, 20, "120"],
    ]);

    // OUTPUT mirror: breakouts after 16, loads 480/120, capacities 480/120.
    const out = result.outputs[0]!;
    expect(out.findings).toEqual([]);
    expect(out.breakouts.map((b) => b.capacity.toString())).toEqual([
      "480",
      "120",
    ]);
    expect(out.breakouts.map((b) => b.startsAfterMachine)).toEqual([0, 16]);
    expect(out.breakouts.map((b) => b.load.toString())).toEqual(["480", "120"]);
  });

  it("maps a fluid ingredient onto a pipe lane with pipe capacities", () => {
    const recipe: CatalogRecipe = {
      id: "wet_concrete",
      displayName: "Wet Concrete",
      machineId: "oil_refinery",
      isAlternate: true,
      inputs: [
        io("water", Fraction.from(100)),
        io("stone", Fraction.from(120)),
      ],
      outputs: [io("concrete", Fraction.from(80))],
      primaryOutputId: "concrete",
    };
    const catalog = catalogWith({
      water: { isFluid: true },
      stone: { isFluid: false },
      concrete: { isFluid: false },
    });
    const input = toStageInput(recipe, catalog, {
      machineCount: 3,
      clockPercent: Fraction.from(100),
      unlockedTiers: { belt: 4, pipe: 2 },
    });
    const waterLane = input.feeds.find((l) => l.itemId === "water")!;
    const stoneLane = input.feeds.find((l) => l.itemId === "stone")!;
    expect(waterLane.kind).toBe("pipe");
    expect(stoneLane.kind).toBe("belt");
    expect(input.capacities.pipe.map((c) => c.toString())).toEqual([
      "300",
      "600",
    ]);
    // Base rate is the 100%-clock perMinute; the solver applies clock.
    expect(waterLane.perMachineRate.eq(Fraction.from(100))).toBe(true);
  });
});

describe("toStageInput — tier slicing + overrides (spec row 5)", () => {
  it("slices the first N belt tiers ({belt:4} → [60,120,270,480])", () => {
    const input = toStageInput(IRON, IRON_CATALOG, {
      machineCount: 1,
      clockPercent: Fraction.from(100),
      unlockedTiers: { belt: 4, pipe: 1 },
    });
    expect(input.capacities.belt.map((c) => c.toString())).toEqual([
      "60",
      "120",
      "270",
      "480",
    ]);
    expect(input.capacities.pipe.map((c) => c.toString())).toEqual(["300"]);
  });

  it("lands a lane-addressed override on the matching lane", () => {
    const input = toStageInput(IRON, IRON_CATALOG, {
      machineCount: 20,
      clockPercent: Fraction.from(100),
      unlockedTiers: { belt: 4, pipe: 1 },
      overrides: {
        feeds: { ore_iron: [null, Fraction.from(270)] },
        outputs: { iron_ingot: [Fraction.from(480)] },
      },
    });
    const feed = input.feeds.find((l) => l.itemId === "ore_iron")!;
    expect(feed.overrides).toBeDefined();
    expect(feed.overrides![0]).toBeNull();
    expect(feed.overrides![1]!.eq(Fraction.from(270))).toBe(true);
    const out = input.outputs.find((l) => l.itemId === "iron_ingot")!;
    expect(out.overrides![0]!.eq(Fraction.from(480))).toBe(true);
  });

  it("throws on a duplicate (itemId, side) lane", () => {
    const dup: CatalogRecipe = {
      ...IRON,
      inputs: [
        io("ore_iron", Fraction.from(30)),
        io("ore_iron", Fraction.from(10)),
      ],
    };
    expect(() => toStageInput(dup, IRON_CATALOG, base())).toThrow(/duplicate/i);
  });

  it("throws on an override for an unknown item", () => {
    expect(() =>
      toStageInput(IRON, IRON_CATALOG, {
        ...base(),
        overrides: { feeds: { not_a_lane: [Fraction.from(60)] } },
      }),
    ).toThrow(/unknown/i);
  });

  it("throws when unlockedTiers < 1", () => {
    expect(() =>
      toStageInput(IRON, IRON_CATALOG, {
        ...base(),
        unlockedTiers: { belt: 0, pipe: 1 },
      }),
    ).toThrow(RangeError);
  });

  it("throws when unlockedTiers exceeds the table length", () => {
    expect(() =>
      toStageInput(IRON, IRON_CATALOG, {
        ...base(),
        unlockedTiers: { belt: 7, pipe: 1 },
      }),
    ).toThrow(RangeError);
    expect(() =>
      toStageInput(IRON, IRON_CATALOG, {
        ...base(),
        unlockedTiers: { belt: 4, pipe: 3 },
      }),
    ).toThrow(RangeError);
  });
});

function base() {
  return {
    machineCount: 20,
    clockPercent: Fraction.from(100),
    unlockedTiers: { belt: 4, pipe: 2 },
  };
}

describe("parseRational — round-trip reviver (spec row 6)", () => {
  it("revives Fraction.toString() output exactly", () => {
    expect(parseRational("75/2").eq(Fraction.of(75, 2))).toBe(true);
    expect(parseRational("120").eq(Fraction.from(120))).toBe(true);
    expect(parseRational("-3/4").eq(Fraction.of(-3, 4))).toBe(true);
    expect(parseRational("0").eq(Fraction.from(0))).toBe(true);
  });

  it("round-trips through toString() for representative values", () => {
    for (const f of [
      Fraction.of(75, 2),
      Fraction.from(120),
      Fraction.of(-3, 4),
      Fraction.from(0),
    ]) {
      expect(parseRational(f.toString()).eq(f)).toBe(true);
    }
  });

  it("throws on garbage (never a Fraction.toString() form)", () => {
    for (const bad of [
      "",
      " ",
      "abc",
      "1.5",
      "0x10",
      "+3",
      "1/2/3",
      "/2",
      "3/",
      "5 ",
    ]) {
      expect(
        () => parseRational(bad),
        `expected throw for ${JSON.stringify(bad)}`,
      ).toThrow();
    }
  });
});
