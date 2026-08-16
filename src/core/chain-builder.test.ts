/**
 * Auto-chain builder tests (Stage 8 / Phase 3, ticket #39). The bulk of the
 * phase's behavior lives here — the solver is pure and exact, so it's pinned
 * against synthetic recipe sets (each isolating one policy) plus the real
 * bundled catalog (acyclicity + full-closure supply≥demand smoke).
 *
 * Frozen design + test plan: features/planner-intelligence/phase-3/brainstorm.md.
 */

// No vitest / data-layer imports: src/core/** is a lint-enforced purity zone
// (globals: true supplies describe/it/expect). The bundled-catalog rows that
// need a real Catalog live in the ui adapter test (src/ui/chain-builder-adapter),
// where importing data is allowed.

import { Fraction } from "./fraction.ts";
import { proposeChain } from "./chain-builder.ts";
import type { BuilderRecipe, ChainProposal } from "./chain-builder.ts";

const F = (n: number): Fraction => Fraction.from(n);

/** Terse synthetic recipe builder (all rates per-minute, primary = outputs[0]). */
function recipe(
  id: string,
  machineId: string,
  outputs: Array<[string, number]>,
  inputs: Array<[string, number]>,
  isAlternate = false,
): BuilderRecipe {
  const out = outputs.map(([itemId, perMinute]) => ({
    itemId,
    perMinute: F(perMinute),
  }));
  return {
    id,
    machineId,
    isAlternate,
    primaryOutputId: out[0]!.itemId,
    outputs: out,
    inputs: inputs.map(([itemId, perMinute]) => ({
      itemId,
      perMinute: F(perMinute),
    })),
  };
}

/** Pull a stage by its produced item id (proposals are item-keyed). */
function stageFor(p: ChainProposal, itemId: string) {
  return p.stages.find((s) => s.itemId === itemId);
}

// ---------------------------------------------------------------------------
// Single-recipe chain: target → producer stage → raw ore.
// ---------------------------------------------------------------------------

describe("proposeChain — single-recipe chain", () => {
  // plate: 20/machine from 30 ingot; ingot: 30/machine from 30 ore.
  const recipes = [
    recipe("r_plate", "constructor", [["plate", 20]], [["ingot", 30]]),
    recipe("r_ingot", "smelter", [["ingot", 30]], [["ore", 30]]),
  ];

  it("sizes each stage by ceil'd demand and links producer→consumer", () => {
    const p = proposeChain("plate", F(60), recipes, []);

    // plate: 60/20 = 3 machines exactly; ingot demand = 3×30 = 90 → 90/30 = 3.
    expect(stageFor(p, "plate")).toMatchObject({
      recipeId: "r_plate",
      machineCount: 3n,
    });
    expect(stageFor(p, "plate")!.outputRate.eq(F(60))).toBe(true);
    expect(stageFor(p, "ingot")).toMatchObject({
      recipeId: "r_ingot",
      machineCount: 3n,
    });
    expect(stageFor(p, "ingot")!.outputRate.eq(F(90))).toBe(true);

    // One link ingot→plate; ore is raw so no ore→ingot link.
    expect(p.links).toEqual([{ fromItemId: "ingot", toItemId: "plate" }]);
  });

  it("reports the raw ore total, no byproducts", () => {
    const p = proposeChain("plate", F(60), recipes, []);
    // 3 ingot machines × 30 ore = 90.
    expect(p.rawInputs).toEqual([{ itemId: "ore", rate: F(90) }]);
    expect(p.byproducts).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Fan-in aggregation: ONE shared stage sized for the SUMMED demand.
// ---------------------------------------------------------------------------

describe("proposeChain — fan-in aggregation (ceil after aggregate)", () => {
  // widget needs 10 ingot + 1 frame; frame needs 20 ingot. Both consumers pull
  // ingot — the single ingot stage must be sized for the SUM, ceil'd once.
  const recipes = [
    recipe(
      "r_widget",
      "assembler",
      [["widget", 5]],
      [
        ["ingot", 10],
        ["frame", 1],
      ],
    ),
    recipe("r_frame", "constructor", [["frame", 2]], [["ingot", 20]]),
    recipe("r_ingot", "smelter", [["ingot", 30]], [["ore", 30]]),
  ];

  it("sizes the shared ingot stage from the summed consumer demand, ceil'd once", () => {
    // widget @5/min → 1 widget machine (5/5). It consumes 10 ingot + 1 frame.
    // frame demand 1 → ceil(1/2) = 1 frame machine, which consumes 20 ingot.
    // ingot demand = 10 (widget) + 20 (frame) = 30 → 30/30 = 1 ingot machine.
    // If the ceil were applied per-consumer (ceil(10/30)+ceil(20/30) = 1+1 = 2)
    // the aggregate would be over-built; ceil-after-aggregate gives exactly 1.
    const p = proposeChain("widget", F(5), recipes, []);
    const ingot = stageFor(p, "ingot")!;
    expect(ingot.machineCount).toBe(1n);
    expect(ingot.outputRate.eq(F(30))).toBe(true);

    // Exactly one ingot stage (not one-per-consumer).
    expect(p.stages.filter((s) => s.itemId === "ingot")).toHaveLength(1);
    // Both consumers link to the one ingot stage.
    expect(p.links).toEqual(
      expect.arrayContaining([
        { fromItemId: "ingot", toItemId: "widget" },
        { fromItemId: "ingot", toItemId: "frame" },
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// Demand-model proof: model (b) (fractional need) would under-supply; model (a)
// (ceil'd consumption propagates) covers it. A fixture where the ceil surplus
// bumps the upstream count.
// ---------------------------------------------------------------------------

describe("proposeChain — demand model (a): ceil'd consumption propagates", () => {
  // target: 10/machine, consumes 7 mid. mid: 10/machine, consumes 10 base.
  // At target rate 10/min → 1 target machine (10/10), consuming 7 mid.
  //  - model (b) fractional need: mid = 7/min → base 7/min → ceil(7/10)=1 base.
  //  - but mid @ 7 → ceil(7/10) = 1 mid machine, which CONSUMES 10 base (not 7).
  //    So base demand is really 10 → still 1 base machine here. Push it harder:
  // Use mid: 4/machine so ceil(7/4)=2 mid machines, consuming 2×10 = 20 base.
  //  - model (b) would size base for 7 (mid's fractional need) → ceil(7/10)=1
  //    base machine = 10 base, but the 2 mid machines actually eat 20 → SHORT.
  //  - model (a) sizes base for 20 → ceil(20/10)=2 → 20 base, exactly covers.
  const recipes = [
    recipe("r_target", "assembler", [["target", 10]], [["mid", 7]]),
    recipe("r_mid", "constructor", [["mid", 4]], [["base", 10]]),
    recipe("r_base", "smelter", [["base", 10]], [["ore", 10]]),
  ];

  it("sizes upstream from the built (ceil'd) consumption, not the fractional need", () => {
    const p = proposeChain("target", F(10), recipes, []);
    // 1 target machine → 7 mid demand → ceil(7/4) = 2 mid machines.
    expect(stageFor(p, "mid")!.machineCount).toBe(2n);
    // 2 mid machines consume 2×10 = 20 base → ceil(20/10) = 2 base machines.
    // (Model (b) would give 1 here and under-supply.)
    expect(stageFor(p, "base")!.machineCount).toBe(2n);
    expect(stageFor(p, "base")!.outputRate.eq(F(20))).toBe(true);
  });

  it("every link arrives supply ≥ demand (ok-or-surplus by construction)", () => {
    const p = proposeChain("target", F(10), recipes, []);
    assertLinksNotShort(p, recipes, "target", F(10));
  });
});

// ---------------------------------------------------------------------------
// Byproduct reporting: non-primary outputs listed, never routed.
// ---------------------------------------------------------------------------

describe("proposeChain — byproducts reported, never routed", () => {
  const recipes = [
    // Refinery-style: primary fuel + byproduct residue.
    recipe(
      "r_fuel",
      "refinery",
      [
        ["fuel", 40],
        ["residue", 30],
      ],
      [["oil", 60]],
    ),
    recipe("r_oil", "extractor", [["oil", 120]], [["crude", 120]]),
  ];

  it("lists the non-primary output at its built rate", () => {
    // fuel @ 40/min → 1 fuel machine → 30 residue byproduct.
    const p = proposeChain("fuel", F(40), recipes, []);
    expect(p.byproducts).toEqual([
      { fromItemId: "fuel", itemId: "residue", rate: F(30) },
    ]);
    // No stage or link for residue — reported only.
    expect(stageFor(p, "residue")).toBeUndefined();
    expect(p.links.some((l) => l.fromItemId === "residue")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Raw termination: leaves with no producer report totals, no stages/links.
// ---------------------------------------------------------------------------

describe("proposeChain — raw termination", () => {
  it("a target with no producer is itself raw (no stages, reported at rate)", () => {
    const p = proposeChain("ore", F(120), [], []);
    expect(p.stages).toEqual([]);
    expect(p.links).toEqual([]);
    expect(p.rawInputs).toEqual([{ itemId: "ore", rate: F(120) }]);
  });

  it("multiple raw leaves each report their summed total", () => {
    const recipes = [
      recipe(
        "r_alloy",
        "foundry",
        [["alloy", 45]],
        [
          ["iron", 30],
          ["copper", 30],
        ],
      ),
    ];
    // alloy @ 45/min → 1 machine → 30 iron + 30 copper, both raw.
    const p = proposeChain("alloy", F(45), recipes, []);
    expect(p.rawInputs).toEqual([
      { itemId: "copper", rate: F(30) },
      { itemId: "iron", rate: F(30) },
    ]);
    expect(p.links).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Exclusion policy: excluded-machine recipes never selected; only-excluded → raw.
// ---------------------------------------------------------------------------

describe("proposeChain — machine exclusion policy", () => {
  const recipes = [
    // A converter recipe that would make ore from limestone (the dense-cycle
    // trap the exclusion exists to break).
    recipe("r_ore_conv", "converter", [["ore", 60]], [["limestone", 90]]),
    recipe("r_ingot", "smelter", [["ingot", 30]], [["ore", 30]]),
  ];

  it("never selects an excluded-machine recipe; its output becomes raw", () => {
    const p = proposeChain("ingot", F(30), recipes, ["converter"]);
    // ore has only a converter producer → excluded → ore is RAW.
    expect(stageFor(p, "ore")).toBeUndefined();
    expect(p.rawInputs).toEqual([{ itemId: "ore", rate: F(30) }]);
    // limestone never enters the closure (the converter recipe was never taken).
    expect(p.rawInputs.some((r) => r.itemId === "limestone")).toBe(false);
  });

  it("WITHOUT the exclusion the same recipe IS selected (exclusion is load-bearing)", () => {
    const p = proposeChain("ingot", F(30), recipes, []);
    // Now ore is produced by the converter recipe → limestone is the raw leaf.
    // 30 ore demand → ceil(30/60) = 1 converter machine → consumes 90 limestone.
    expect(stageFor(p, "ore")).toMatchObject({ recipeId: "r_ore_conv" });
    expect(p.rawInputs).toEqual([{ itemId: "limestone", rate: F(90) }]);
  });
});

// ---------------------------------------------------------------------------
// Alternate exclusion: isAlternate recipes never selected.
// ---------------------------------------------------------------------------

describe("proposeChain — alternate exclusion", () => {
  it("skips an isAlternate producer even when it is the only candidate", () => {
    const recipes = [
      recipe("r_alt_ingot", "smelter", [["ingot", 45]], [["ore", 30]], true),
    ];
    const p = proposeChain("ingot", F(45), recipes, []);
    // Only producer is alternate → ingot is RAW (no stage).
    expect(stageFor(p, "ingot")).toBeUndefined();
    expect(p.rawInputs).toEqual([{ itemId: "ingot", rate: F(45) }]);
  });

  it("prefers the standard recipe over an alternate for the same item", () => {
    const recipes = [
      recipe("r_alt_ingot", "smelter", [["ingot", 45]], [["ore", 30]], true),
      recipe("r_std_ingot", "smelter", [["ingot", 30]], [["ore", 30]]),
    ];
    const p = proposeChain("ingot", F(30), recipes, []);
    expect(stageFor(p, "ingot")).toMatchObject({ recipeId: "r_std_ingot" });
  });
});

// ---------------------------------------------------------------------------
// Deterministic ascending-id tie-break.
// ---------------------------------------------------------------------------

describe("proposeChain — deterministic ascending-id tie-break", () => {
  it("picks the lexicographically-smallest recipe id and repeats identically", () => {
    // Two standard producers of ingot; input order shuffled to prove the pick is
    // by id, not by array position.
    const recipes = [
      recipe("r_ingot_z", "smelter", [["ingot", 30]], [["ore", 30]]),
      recipe("r_ingot_a", "foundry", [["ingot", 45]], [["ore", 40]]),
    ];
    const p1 = proposeChain("ingot", F(90), recipes, []);
    const p2 = proposeChain("ingot", F(90), recipes, []);
    expect(stageFor(p1, "ingot")).toMatchObject({ recipeId: "r_ingot_a" });
    // Repeat run: byte-identical (deterministic invariant).
    expect(p2).toEqual(p1);
  });
});

// ---------------------------------------------------------------------------
// Cycle guard: a synthetic 2-cycle silently demotes to RAW, never hangs.
// ---------------------------------------------------------------------------

describe("proposeChain — cycle guard", () => {
  it("a 2-cycle silently demotes to RAW (no error, no hang)", () => {
    // a made from b, b made from a — a mutual dependency the guard must break.
    const recipes = [
      recipe("r_a", "m", [["a", 10]], [["b", 10]]),
      recipe("r_b", "m", [["b", 10]], [["a", 10]]),
    ];
    // Target a: producer r_a needs b; b's producer r_b needs a (on-path) → guard
    // demotes b to RAW. a is then a normal one-input stage fed by raw b.
    const p = proposeChain("a", F(10), recipes, []);
    expect(stageFor(p, "a")).toMatchObject({
      recipeId: "r_a",
      machineCount: 1n,
    });
    // b lands in rawInputs (silent demotion) — b's demand = 1×10 = 10.
    expect(p.rawInputs).toEqual([{ itemId: "b", rate: F(10) }]);
    // No b stage, no b→a... wait: a IS fed by b, but b is raw so no link.
    expect(stageFor(p, "b")).toBeUndefined();
    expect(p.links).toEqual([]);
  });

  it("a SELF-consuming recipe demotes to RAW (never a from===to link)", () => {
    // s made from s + ore: the guard must catch the item's own presence in
    // the candidate's inputs — a from===to link would bypass addLink's
    // self-link refusal at apply (boundary-review fold).
    const recipes = [
      recipe(
        "r_s",
        "m",
        [["s", 10]],
        [
          ["s", 5],
          ["ore", 5],
        ],
      ),
    ];
    const p = proposeChain("s", F(10), recipes, []);
    expect(p.stages).toEqual([]);
    expect(p.links).toEqual([]);
    expect(p.rawInputs).toEqual([{ itemId: "s", rate: F(10) }]);
  });
});

// ---------------------------------------------------------------------------
// Shared assertion: recompute demand from the built counts and prove every link
// producer's outputRate covers the total demand for its item (supply ≥ demand).
// (The real bundled-catalog closure smoke lives in the ui adapter test, which
// may import data; the same assertion is duplicated there.)
// ---------------------------------------------------------------------------

function assertLinksNotShort(
  p: ChainProposal,
  recipes: BuilderRecipe[],
  targetItemId: string,
  targetRate: Fraction,
): void {
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const stageByItem = new Map(p.stages.map((s) => [s.itemId, s]));

  // Demand per item = target external demand + Σ over every built stage's ceil'd
  // input consumption.
  const demand = new Map<string, Fraction>();
  demand.set(targetItemId, targetRate);
  for (const s of p.stages) {
    const r = recipeById.get(s.recipeId)!;
    for (const input of r.inputs) {
      const consumed = Fraction.from(s.machineCount).mul(input.perMinute);
      const prev = demand.get(input.itemId) ?? Fraction.from(0);
      demand.set(input.itemId, prev.add(consumed));
    }
  }

  for (const link of p.links) {
    const producer = stageByItem.get(link.fromItemId)!;
    const need = demand.get(link.fromItemId)!;
    // supply ≥ demand: producer.outputRate.gte(need).
    expect(producer.outputRate.gte(need)).toBe(true);
  }
}

// ---------------------------------------------------------------------------
// Recipe overrides (Stage 8 / Phase 4, the comparison seam): the optional 5th
// param forces a named recipe for an item, BEFORE the default policy, lifting
// the isAlternate + machine-exclusion filters — but the cycle guard still
// applies, and an invalid override falls back to the default (keeps totality).
// ---------------------------------------------------------------------------

describe("proposeChain — recipe overrides", () => {
  // ingot has a standard (r_std) and an ALTERNATE (r_alt) producer; the
  // alternate is faster (45 vs 30) but the default policy skips alternates.
  const recipes = [
    recipe("r_std_ingot", "smelter", [["ingot", 30]], [["ore", 30]]),
    recipe("r_alt_ingot", "foundry", [["ingot", 45]], [["ore", 40]], true),
  ];

  it("selects the NAMED alternate for the target, bypassing the isAlternate filter", () => {
    // Override ingot → the alternate. 45/machine ⇒ ceil(45/45)=1 machine.
    const overrides = new Map([["ingot", "r_alt_ingot"]]);
    const p = proposeChain("ingot", F(45), recipes, [], overrides);
    expect(stageFor(p, "ingot")).toMatchObject({
      recipeId: "r_alt_ingot",
      machineCount: 1n,
    });
    // The default (no override) picks the standard recipe — proves the override
    // is what flipped it, not the fixture.
    const dflt = proposeChain("ingot", F(45), recipes, []);
    expect(stageFor(dflt, "ingot")).toMatchObject({ recipeId: "r_std_ingot" });
  });

  it("overrides an item deep in the closure; unoverridden items keep the default", () => {
    // plate ← ingot ← ore. Override ONLY the deeper ingot to its alternate; the
    // top-level plate resolves by default policy (its own standard recipe).
    const deep = [
      recipe("r_plate", "constructor", [["plate", 20]], [["ingot", 30]]),
      recipe("r_std_ingot", "smelter", [["ingot", 30]], [["ore", 30]]),
      recipe("r_alt_ingot", "foundry", [["ingot", 45]], [["ore", 40]], true),
    ];
    const overrides = new Map([["ingot", "r_alt_ingot"]]);
    const p = proposeChain("plate", F(60), deep, [], overrides);
    // plate: unoverridden → its standard recipe.
    expect(stageFor(p, "plate")).toMatchObject({ recipeId: "r_plate" });
    // ingot: overridden → the alternate.
    expect(stageFor(p, "ingot")).toMatchObject({ recipeId: "r_alt_ingot" });
    // Every link still arrives supply ≥ demand under the swapped deep recipe.
    assertLinksNotShort(p, deep, "plate", F(60));
  });

  it("respects a machine-excluded recipe when it is the override target", () => {
    // ore's only producer is a converter (excluded by default → ore is RAW).
    // An override naming that converter recipe LIFTS the exclusion.
    const withConv = [
      recipe("r_ore_conv", "converter", [["ore", 60]], [["limestone", 90]]),
      recipe("r_ingot", "smelter", [["ingot", 30]], [["ore", 30]]),
    ];
    const overrides = new Map([["ore", "r_ore_conv"]]);
    const p = proposeChain("ingot", F(30), withConv, ["converter"], overrides);
    // ore is now produced by the excluded converter (override wins over exclusion).
    expect(stageFor(p, "ore")).toMatchObject({ recipeId: "r_ore_conv" });
    expect(p.rawInputs).toEqual([{ itemId: "limestone", rate: F(90) }]);
  });

  it("IGNORES an override naming an unknown recipe id (falls back to default)", () => {
    const overrides = new Map([["ingot", "r_does_not_exist"]]);
    const p = proposeChain("ingot", F(30), recipes, [], overrides);
    // Unknown id → invalid → default policy picks the standard recipe.
    expect(stageFor(p, "ingot")).toMatchObject({ recipeId: "r_std_ingot" });
  });

  it("IGNORES an override whose recipe does NOT primary-produce the item", () => {
    // r_plate primary-produces plate, not ingot — naming it for ingot is invalid.
    const withPlate = [
      recipe("r_plate", "constructor", [["plate", 20]], [["ingot", 30]]),
      recipe("r_std_ingot", "smelter", [["ingot", 30]], [["ore", 30]]),
    ];
    const overrides = new Map([["ingot", "r_plate"]]);
    const p = proposeChain("ingot", F(30), withPlate, [], overrides);
    // Non-primary override → invalid → default policy picks the standard recipe.
    expect(stageFor(p, "ingot")).toMatchObject({ recipeId: "r_std_ingot" });
  });

  it("still demotes a CYCLING override recipe to RAW (the guard outlives the override)", () => {
    // a's default is r_a (needs b, acyclic). An override forces a to r_a_cyc,
    // which self-consumes a — the guard must catch it exactly as for a
    // default-selected cycling recipe, silently demoting a to RAW.
    const cyc = [
      recipe("r_a", "m", [["a", 10]], [["ore", 10]]),
      recipe(
        "r_a_cyc",
        "m",
        [["a", 10]],
        [
          ["a", 5],
          ["ore", 5],
        ],
      ),
    ];
    const overrides = new Map([["a", "r_a_cyc"]]);
    const p = proposeChain("a", F(10), cyc, [], overrides);
    // The overridden recipe self-consumes a → guard demotes a to RAW.
    expect(p.stages).toEqual([]);
    expect(p.links).toEqual([]);
    expect(p.rawInputs).toEqual([{ itemId: "a", rate: F(10) }]);
  });

  it("an ABSENT/EMPTY override map is byte-identical to the 4-arg call", () => {
    const deep = [
      recipe("r_plate", "constructor", [["plate", 20]], [["ingot", 30]]),
      recipe("r_ingot", "smelter", [["ingot", 30]], [["ore", 30]]),
    ];
    const noArg = proposeChain("plate", F(60), deep, []);
    const emptyMap = proposeChain("plate", F(60), deep, [], new Map());
    expect(emptyMap).toEqual(noArg);
  });
});

// ---------------------------------------------------------------------------
// Forced-raw items (S20 / P1, ticket #100): the optional 6th param marks an item
// treat-as-raw BEFORE producer selection — a raw leaf whose demand aggregates
// into rawInputs and whose subtree is pruned. Precedence raw > override; the
// TARGET is immune (silently ignored); default-empty ⇒ byte-identical.
// ---------------------------------------------------------------------------

describe("proposeChain — forced-raw items (rawItemIds)", () => {
  // plate ← ingot ← ore. Forcing ingot raw must vanish the ingot stage AND its
  // ore subtree, aggregating the ingot demand into rawInputs.
  const deep = [
    recipe("r_plate", "constructor", [["plate", 20]], [["ingot", 30]]),
    recipe("r_ingot", "smelter", [["ingot", 30]], [["ore", 30]]),
  ];

  it("forces a mid-chain item raw: its subtree vanishes into rawInputs", () => {
    // plate @ 60/min → 3 plate machines consuming 3×30 = 90 ingot.
    const raw = new Set(["ingot"]);
    const p = proposeChain("plate", F(60), deep, [], new Map(), raw);
    // plate still built; ingot is now a raw leaf at its full demand (90).
    expect(stageFor(p, "plate")).toMatchObject({
      recipeId: "r_plate",
      machineCount: 3n,
    });
    expect(stageFor(p, "ingot")).toBeUndefined();
    // ore (ingot's input) never enters the closure — the subtree is pruned.
    expect(stageFor(p, "ore")).toBeUndefined();
    expect(p.rawInputs).toEqual([{ itemId: "ingot", rate: F(90) }]);
    // No ingot→plate link (ingot is raw, exactly like a natural leaf).
    expect(p.links).toEqual([]);
  });

  it("is byte-identical to a natural leaf: forced-raw ingot === no ingot recipe", () => {
    // Dropping r_ingot makes ingot a NATURAL raw leaf. Forcing it raw with the
    // recipe present must produce the SAME proposal (the guard mimics a leaf).
    const raw = new Set(["ingot"]);
    const forced = proposeChain("plate", F(60), deep, [], new Map(), raw);
    const noRecipe = proposeChain(
      "plate",
      F(60),
      [recipe("r_plate", "constructor", [["plate", 20]], [["ingot", 30]])],
      [],
    );
    expect(forced).toEqual(noRecipe);
  });

  it("TARGET immunity: forcing the target raw is silently ignored", () => {
    // targetItemId ∈ rawItemIds must NOT collapse the chain — the target is
    // still produced normally (an empty chain is not a chain).
    const raw = new Set(["plate"]);
    const p = proposeChain("plate", F(60), deep, [], new Map(), raw);
    expect(stageFor(p, "plate")).toMatchObject({ recipeId: "r_plate" });
    // The rest of the chain is unaffected: ingot still built, ore still raw.
    expect(stageFor(p, "ingot")).toMatchObject({ recipeId: "r_ingot" });
    expect(p.rawInputs).toEqual([{ itemId: "ore", rate: F(90) }]);
  });

  it("raw > override: a forced-raw item ignores its override and is raw", () => {
    // ingot has a std + an alternate; override it to the alternate AND force it
    // raw. Raw is the stronger, later intent → ingot is raw, the override loses.
    const withAlt = [
      recipe("r_plate", "constructor", [["plate", 20]], [["ingot", 30]]),
      recipe("r_std_ingot", "smelter", [["ingot", 30]], [["ore", 30]]),
      recipe("r_alt_ingot", "foundry", [["ingot", 45]], [["ore", 40]], true),
    ];
    const overrides = new Map([["ingot", "r_alt_ingot"]]);
    const raw = new Set(["ingot"]);
    const p = proposeChain("plate", F(60), withAlt, [], overrides, raw);
    expect(stageFor(p, "ingot")).toBeUndefined();
    expect(p.rawInputs).toEqual([{ itemId: "ingot", rate: F(90) }]);
    // Proof the override WOULD have applied without the raw mark.
    const noRaw = proposeChain("plate", F(60), withAlt, [], overrides);
    expect(stageFor(noRaw, "ingot")).toMatchObject({ recipeId: "r_alt_ingot" });
  });

  it("an ABSENT/EMPTY rawItemIds set is byte-identical to the 5-arg call", () => {
    const fiveArg = proposeChain("plate", F(60), deep, [], new Map());
    const emptySet = proposeChain(
      "plate",
      F(60),
      deep,
      [],
      new Map(),
      new Set(),
    );
    expect(emptySet).toEqual(fiveArg);
  });
});

// ---------------------------------------------------------------------------
// S20 P2 — clockPercent (7th positional). Per-machine primary rates scale
// `perMinute × clockPercent/100` (linear, exact) in BOTH the count-fix pass and
// the outputRate; ceilDiv counts stay exact; the 100% default is byte-identical.
// ---------------------------------------------------------------------------

describe("proposeChain — clockPercent scaling (S20 P2)", () => {
  const F32 = (n: number, d: number): Fraction => Fraction.of(n, d);
  // ingot: 30/machine from 30 ore, at 100%.
  const recipes = [
    recipe("r_ingot", "smelter", [["ingot", 30]], [["ore", 30]]),
  ];

  it("150% scales the per-machine rate so fewer machines cover the demand", () => {
    // At 100%: ceil(120/30) = 4 machines. At 150%: each machine makes 45/min, so
    // ceil(120 / (30 × 3/2)) = ceil(120/45) = 3 — the spec's exact example.
    const at100 = proposeChain("ingot", F(120), recipes, []);
    expect(stageFor(at100, "ingot")!.machineCount).toBe(4n);

    const at150 = proposeChain(
      "ingot",
      F(120),
      recipes,
      [],
      new Map(),
      new Set(),
      F(150),
    );
    expect(stageFor(at150, "ingot")!.machineCount).toBe(3n);
    // outputRate = 3 × (30 × 3/2) = 3 × 45 = 135 (exact; the ceil overshoot).
    expect(stageFor(at150, "ingot")!.outputRate.eq(F(135))).toBe(true);
    // Input consumption also scales: 3 machines × (30 × 3/2) = 135 ore raw.
    expect(at150.rawInputs).toEqual([{ itemId: "ore", rate: F(135) }]);
  });

  it("a non-integer clock keeps rates EXACT (no float creep)", () => {
    // 133⅓% = 400/300 = 4/3. Per-machine ingot = 30 × 4/3 = 40/min.
    // ceil(120 / 40) = 3; outputRate = 3 × 40 = 120 exactly.
    const p = proposeChain(
      "ingot",
      F(120),
      recipes,
      [],
      new Map(),
      new Set(),
      F32(400, 3),
    );
    expect(stageFor(p, "ingot")!.machineCount).toBe(3n);
    expect(stageFor(p, "ingot")!.outputRate.eq(F(120))).toBe(true);
  });

  it("scales byproduct rates by the clock too", () => {
    // A recipe with a byproduct: 20 primary + 10 byproduct per machine from ore.
    const bp = [
      recipe(
        "r_fuel",
        "refinery",
        [
          ["fuel", 20],
          ["resin", 10],
        ],
        [["oil", 30]],
      ),
    ];
    // At 150%: 1 machine makes 30 fuel (ceil(20/(20×3/2)) = ceil(20/30) = 1),
    // and the byproduct resin scales to 10 × 3/2 = 15/min.
    const p = proposeChain("fuel", F(20), bp, [], new Map(), new Set(), F(150));
    expect(stageFor(p, "fuel")!.machineCount).toBe(1n);
    expect(p.byproducts).toEqual([
      { fromItemId: "fuel", itemId: "resin", rate: F(15) },
    ]);
  });

  it("the 100% DEFAULT is byte-identical to the 6-arg call (regression pin)", () => {
    const sixArg = proposeChain(
      "ingot",
      F(120),
      recipes,
      [],
      new Map(),
      new Set(),
    );
    const explicit100 = proposeChain(
      "ingot",
      F(120),
      recipes,
      [],
      new Map(),
      new Set(),
      F(100),
    );
    // The absent 7th arg and an explicit Fraction.from(100) must both equal the
    // pre-P2 output exactly (the epic's byte-stability acceptance).
    expect(explicit100).toEqual(sixArg);
    expect(stageFor(sixArg, "ingot")!.machineCount).toBe(4n);
  });
});
