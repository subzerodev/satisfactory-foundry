/**
 * UI adapter tests (Stage 8 / Phase 3, ticket #39): the catalog→core narrowing
 * + exclusion resolution, the preview shaping, and the bundled-catalog closure
 * smoke (real-target acyclicity/termination + supply≥demand + the exclusion-id
 * pins). This file may import data — the same rows can't live in the core test
 * (src/core/** is a lint-enforced no-data-import purity zone). Node env, no React.
 */

import { describe, it, expect } from "vitest";

import { Fraction } from "../core/fraction.ts";
import type { BuilderRecipe, ChainProposal } from "../core/chain-builder.ts";
import { parseCatalogFromText } from "../data/catalog.ts";
import type {
  Catalog,
  CatalogItem,
  CatalogMachine,
  CatalogRecipe,
} from "../data/types.ts";
import type { RawInputRow } from "./chain-builder-adapter.ts";
import {
  EXCLUDED_MACHINE_IDS,
  proposeChainForCatalog,
  toProposalPreview,
  previewRowText,
  itemRateLineText,
  metricsPowerText,
  proposalMetrics,
  byproductSuggestions,
  candidateRecipesFor,
  candidateRowsFor,
  swapMachineCountFor,
  effectiveDefaultRecipe,
  producerRecipesFor,
  pickerOptionsFor,
  excludableMachines,
  gateCatalog,
} from "./chain-builder-adapter.ts";
// The real bundled snapshot as raw text (Vite ?raw), parsed through the SAME
// pipeline the app uses — the rows guard catalog drift (renamed ids, a new
// cycle) as much as solver drift.
import bundledDocsText from "../../public/bundled-docs/en-US.json?raw";

const F = (n: number): Fraction => Fraction.from(n);

const catalog: Catalog = parseCatalogFromText(bundledDocsText);
const recipeArr: BuilderRecipe[] = Object.values(catalog.recipes);

// ---------------------------------------------------------------------------
// Exclusion-id resolution + the bundled-catalog machine pins.
// ---------------------------------------------------------------------------

describe("adapter — exclusion ids", () => {
  it("resolves the normalized converter/packager ids", () => {
    expect(EXCLUDED_MACHINE_IDS).toEqual(["converter", "packager"]);
  });

  it("pins the converter/packager machines exist in the bundled catalog", () => {
    // normalizeClassName lowercases/snake-cases Build_Converter_C/Build_Packager_C.
    expect(catalog.machines["converter"]).toBeDefined();
    expect(catalog.machines["packager"]).toBeDefined();
  });
});

describe("S20 P3 — recipeUnlocks against the REAL bundled snapshot", () => {
  // Every other FGSchematic pin in the suite is synthetic, so a future Docs
  // export that changed the mUnlocks/mRecipes shape would leave them all green
  // while gating silently no-ops in production — precisely the failure class
  // this phase exists to close, on the one path the synthetic fixtures cannot
  // guard. The assertions are deliberately structural, not exact-value: they
  // must survive a game rebalance but not a shape change. Three of the four
  // bite on a mutation TODAY (each recorded in the phase's verification log);
  // the fourth is a FORWARD CANARY over data this snapshot cannot produce, and
  // is labeled as one rather than claimed as a pin.
  const unlockIds = Object.keys(catalog.recipeUnlocks);

  it("parses unlock tiers for most of the real catalog's recipes", () => {
    expect(unlockIds.length).toBeGreaterThan(
      Object.keys(catalog.recipes).length / 2,
    );
  });

  it("keys them by real catalog recipe ids — never the empty string", () => {
    // MEASURED bite: deleting the unresolvable-ref skip in docs-loader, which
    // is what keeps building/cosmetic refs (and any id that normalizes to "")
    // out of the map. NOT the r4 apostrophe bug — under r4 the map comes out
    // EMPTY, so both assertions below hold vacuously and this row stays green;
    // r4 is caught by the two rows that require the map to be populated.
    expect(catalog.recipeUnlocks[""]).toBeUndefined();
    for (const id of unlockIds) expect(catalog.recipes[id]).toBeDefined();
  });

  it("carries only non-negative integer tiers (FORWARD CANARY, not a pin)", () => {
    // Cannot fail against this snapshot in either direction: parseTechTier
    // forces the invariant for every input, and every mTechTier here is a
    // plain "0".."9". Kept deliberately, to catch a FUTURE export carrying
    // fractional/negative tiers — which would reach the TIER option list. It
    // earns no entry in the verification log, because no mutation makes it red.
    for (const id of unlockIds) {
      const tier = catalog.recipeUnlocks[id]!;
      expect(Number.isInteger(tier) && tier >= 0, `${id} → ${tier}`).toBe(true);
    }
  });

  it("actually GATES most of the real catalog at tier 0", () => {
    // The end-to-end proof that gating bites on shipped data. The share is
    // asserted, not just non-emptiness: tier 0 must leave under half the
    // catalog standing (measured: 87 of 290 remain), while "all" removes none.
    const atZero = Object.keys(gateCatalog(catalog, 0).recipes).length;
    const all = Object.keys(catalog.recipes).length;
    expect(atZero).toBeGreaterThan(0);
    expect(atZero * 2).toBeLessThan(all);
    expect(Object.keys(gateCatalog(catalog, null).recipes)).toHaveLength(all);
  });
});

// ---------------------------------------------------------------------------
// Bundled-catalog full-closure smoke: a deep real target terminates, is
// deterministic, and every link arrives supply ≥ demand exactly.
// ---------------------------------------------------------------------------

describe("adapter — bundled catalog closure", () => {
  const TARGET = "modular_frame_heavy"; // Heavy Modular Frame.

  it("the deep target item exists (guards a future catalog rename)", () => {
    expect(catalog.items[TARGET]).toBeDefined();
  });

  it("builds the deep target @ 10/min: terminates with a multi-stage closure", () => {
    const p = proposeChainForCatalog(catalog, TARGET, F(10));
    expect(p.stages.length).toBeGreaterThan(1);
    // Ores/water terminate as raw leaves.
    expect(p.rawInputs.length).toBeGreaterThan(0);
    // The explicit acyclicity regression pin (boundary fold): one stage per
    // item, no item repeated anywhere in the closure — a cycle in the bundled
    // catalog under the exclusion policy would trip this before it hangs.
    const items = p.stages.map((s) => s.itemId);
    expect(new Set(items).size).toBe(items.length);
    expect(p.rawInputs.every((r) => !items.includes(r.itemId))).toBe(true);
  });

  it("no link is short — every producer supply ≥ its item's summed demand", () => {
    const p = proposeChainForCatalog(catalog, TARGET, F(10));

    // Recompute demand from the built counts: target external demand + Σ each
    // stage's ceil'd input consumption.
    const stageByItem = new Map(p.stages.map((s) => [s.itemId, s]));
    const demand = new Map<string, Fraction>();
    demand.set(TARGET, F(10));
    for (const s of p.stages) {
      const r = catalog.recipes[s.recipeId]!;
      for (const input of r.inputs) {
        const consumed = Fraction.from(s.machineCount).mul(input.perMinute);
        const prev = demand.get(input.itemId) ?? F(0);
        demand.set(input.itemId, prev.add(consumed));
      }
    }
    for (const link of p.links) {
      const producer = stageByItem.get(link.fromItemId)!;
      const need = demand.get(link.fromItemId)!;
      expect(producer.outputRate.gte(need)).toBe(true);
    }
  });

  it("is deterministic — a second run is byte-identical", () => {
    const a = proposeChainForCatalog(catalog, TARGET, F(10));
    const b = proposeChainForCatalog(catalog, TARGET, F(10));
    expect(b).toEqual(a);
  });

  it("never selects a converter or packager recipe in the closure", () => {
    const p = proposeChainForCatalog(catalog, TARGET, F(10));
    for (const s of p.stages) {
      const machineId = catalog.recipes[s.recipeId]!.machineId;
      expect(machineId).not.toBe("converter");
      expect(machineId).not.toBe("packager");
    }
  });

  it("recipes narrow to BuilderRecipe with no copying (structural pass-through)", () => {
    // The adapter passes catalog recipes straight to the solver — the array IS
    // the catalog's own recipe objects. This is a compile-time guarantee; the
    // runtime check just confirms the reference identity holds.
    const first = recipeArr[0]!;
    expect(catalog.recipes[first.id]).toBe(first);
  });
});

// ---------------------------------------------------------------------------
// Preview shaping + row wording.
// ---------------------------------------------------------------------------

describe("adapter — preview shaping", () => {
  it("shapes stage rows with catalog names + exact rates", () => {
    // iron_plate @ 60/min → constructor stage + smelter ingot stage.
    const p = proposeChainForCatalog(catalog, "iron_plate", F(60));
    const preview = toProposalPreview(p, catalog);
    expect(preview.isEmpty).toBe(false);

    const plateRow = preview.rows.find((r) => r.itemName === "Iron Plate")!;
    expect(plateRow.machineName).toBe("Constructor");
    expect(plateRow.machineCount).toBe("3");
    expect(plateRow.outputRate).toBe("60");
    expect(previewRowText(plateRow)).toBe(
      "Iron Plate — Constructor ×3 — 60/min",
    );

    // Raw input line: Iron Ore at the summed rate.
    expect(preview.rawInputs.some((r) => r.itemName === "Iron Ore")).toBe(true);
    expect(itemRateLineText(preview.rawInputs)).toContain("Iron Ore");
  });

  it("marks an all-raw proposal empty (the target itself is raw)", () => {
    // Iron Ore has no non-excluded producer → the proposal is all raw.
    const p = proposeChainForCatalog(catalog, "ore_iron", F(120));
    const preview = toProposalPreview(p, catalog);
    expect(preview.isEmpty).toBe(true);
    expect(preview.rows).toEqual([]);
    // S20 P1 widened the raw-input row: it now carries itemId + the
    // reconstructed cause. Iron Ore's SOLE producer in the bundled catalog is a
    // converter recipe (iron_limestone), excluded by default policy — so
    // through S20 this classified "constrained"/lever "machine".
    //
    // S21 P0 (#104) REVERSED that: Iron Ore is `isRawResource` and its only
    // producer is excluded under BOTH the default constant AND the live set,
    // so the constrained label was technically true but useless — its lone
    // "recovery" was to re-enable the converter, the very machine the default
    // excludes on purpose. It now classifies "natural" (lever null, since
    // levers annotate constrained rows only), and Iron Ore renders on the
    // plain RAW line. `coal` is the deliberate counterexample that keeps this
    // from being a blanket `isRawResource ⇒ natural` rule — see the S21 P0
    // block below.
    expect(preview.rawInputs).toEqual([
      {
        itemId: "ore_iron",
        itemName: "Iron Ore",
        rate: "120",
        cause: "natural",
        lever: null,
      },
    ]);
  });

  it("itemRateLineText joins multiple items with commas", () => {
    const line = itemRateLineText([
      { itemName: "Iron Ore", rate: "780" },
      { itemName: "Water", rate: "360" },
    ]);
    expect(line).toBe("Iron Ore 780/min, Water 360/min");
  });
});

// ---------------------------------------------------------------------------
// Alternate-recipe comparison (Stage 8 / Phase 4, ticket #40): candidate
// enumeration + per-candidate metrics. The metric-sum rows run against a
// SYNTHETIC catalog (exact expected machines/power); the enumeration + a
// distinct-metrics row run against the real bundled Iron Ingot alternates.
// ---------------------------------------------------------------------------

/** Terse synthetic catalog builders — enough shape for the alt-compare helpers
 *  (items for names, machines for power, recipes for enumeration + subtree). */
function item(id: string, displayName: string): CatalogItem {
  return { id, displayName, isFluid: false, stackSize: F(100) };
}
function machine(
  id: string,
  mw: number,
  opts?: { variable?: boolean; minMw?: number; maxMw?: number },
): CatalogMachine {
  const power = {
    mw: F(mw),
    variable: opts?.variable ?? false,
    exponent: F(1),
    ...(opts?.minMw !== undefined ? { minMw: F(opts.minMw) } : {}),
    ...(opts?.maxMw !== undefined ? { maxMw: F(opts.maxMw) } : {}),
  };
  return { id, displayName: id, power };
}
function crecipe(
  id: string,
  displayName: string,
  machineId: string,
  outputs: Array<[string, number]>,
  inputs: Array<[string, number]>,
  isAlternate = false,
): CatalogRecipe {
  const out = outputs.map(([itemId, perMinute]) => ({
    itemId,
    perMinute: F(perMinute),
  }));
  return {
    id,
    displayName,
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
function synthCatalog(
  items: CatalogItem[],
  machines: CatalogMachine[],
  recipes: CatalogRecipe[],
  // Recipe id → min unlock tier (S20 P3). Empty ⇒ no recipe is gated at any
  // tier, which is what every pre-P3 fixture wants.
  recipeUnlocks: Record<string, number> = {},
): Catalog {
  return {
    items: Object.fromEntries(items.map((i) => [i.id, i])),
    machines: Object.fromEntries(machines.map((m) => [m.id, m])),
    recipes: Object.fromEntries(recipes.map((r) => [r.id, r])),
    tiers: { belt: [F(60)], pipe: [F(300)] },
    recipeUnlocks,
  };
}

describe("alt-compare — candidate enumeration", () => {
  it("lists default (non-alternate) first, then alternates ascending by id", () => {
    const cat = synthCatalog(
      [item("ingot", "Ingot"), item("ore", "Ore")],
      [machine("smelter", 4)],
      [
        crecipe(
          "r_alt_z",
          "Alt Z",
          "smelter",
          [["ingot", 45]],
          [["ore", 40]],
          true,
        ),
        crecipe("r_std", "Standard", "smelter", [["ingot", 30]], [["ore", 30]]),
        crecipe(
          "r_alt_a",
          "Alt A",
          "smelter",
          [["ingot", 50]],
          [["ore", 50]],
          true,
        ),
      ],
    );
    const ids = candidateRecipesFor(cat, "ingot").map((r) => r.id);
    // Default first; alternates ascending (r_alt_a before r_alt_z).
    expect(ids).toEqual(["r_std", "r_alt_a", "r_alt_z"]);
  });

  it("excludes converter/packager recipes from candidacy", () => {
    const cat = synthCatalog(
      [item("ingot", "Ingot"), item("ore", "Ore")],
      [machine("smelter", 4), machine("converter", 0), machine("packager", 0)],
      [
        crecipe("r_std", "Standard", "smelter", [["ingot", 30]], [["ore", 30]]),
        crecipe(
          "r_conv",
          "Conv",
          "converter",
          [["ingot", 60]],
          [["ore", 60]],
          true,
        ),
        crecipe(
          "r_pack",
          "Pack",
          "packager",
          [["ingot", 60]],
          [["ore", 60]],
          true,
        ),
      ],
    );
    const ids = candidateRecipesFor(cat, "ingot").map((r) => r.id);
    // Converter/packager never listed → only the smelter recipe survives → <2 →
    // empty (nothing to compare against).
    expect(ids).toEqual([]);
  });

  it("returns empty when the item has fewer than 2 candidates", () => {
    const cat = synthCatalog(
      [item("ingot", "Ingot"), item("ore", "Ore")],
      [machine("smelter", 4)],
      [crecipe("r_std", "Standard", "smelter", [["ingot", 30]], [["ore", 30]])],
    );
    expect(candidateRecipesFor(cat, "ingot")).toEqual([]);
  });
});

describe("alt-compare — per-candidate metrics (synthetic, exact)", () => {
  // ingot has TWO producers: standard (30/min, smelter 4 MW) and a faster
  // alternate (60/min, foundry 16 MW). Both draw ore (raw). At R=120: standard
  // needs 4 smelters (4×4=16 MW); alternate needs 2 foundries (2×16=32 MW).
  const cat = synthCatalog(
    [item("ingot", "Ingot"), item("ore", "Ore")],
    [machine("smelter", 4), machine("foundry", 16)],
    [
      crecipe("r_std", "Standard", "smelter", [["ingot", 30]], [["ore", 30]]),
      crecipe(
        "r_alt",
        "Alternate",
        "foundry",
        [["ingot", 60]],
        [["ore", 45]],
        true,
      ),
    ],
  );

  it("sums machines + power exactly across the subtree per candidate", () => {
    const rows = candidateRowsFor(cat, "ingot", "r_std", F(120));
    expect(rows).toHaveLength(2);
    const [std, alt] = rows;

    expect(std!.recipeId).toBe("r_std");
    expect(std!.isCurrent).toBe(true); // current recipe marked
    expect(std!.machines).toBe("4"); // ceil(120/30)
    expect(std!.power).toBe("16 MW"); // 4 × 4 MW, exact
    expect(std!.rawDraw).toBe("Ore 120/min"); // 4 × 30 ore

    expect(alt!.recipeId).toBe("r_alt");
    expect(alt!.isCurrent).toBe(false);
    expect(alt!.machines).toBe("2"); // ceil(120/60)
    expect(alt!.power).toBe("32 MW"); // 2 × 16 MW, exact
    expect(alt!.rawDraw).toBe("Ore 90/min"); // 2 × 45 ore
  });

  it("pins each candidate's OUTPUT as its own actual produced rate, incl. the current row + a ceil-overshoot (#83)", () => {
    // R=100 is NOT a multiple of either producer's per-machine rate, so both
    // ceil-overshoot: std 30/min → ceil(100/30)=4 → 120/min; alt 60/min →
    // ceil(100/60)=2 → 120/min. The OUTPUT column shows each candidate's actual
    // produced rate — uniformly, INCLUDING the current row (v1's "current row
    // shows R exactly" claim was dropped: the current ceil overshoots too).
    const rows = candidateRowsFor(cat, "ingot", "r_std", F(100));
    const std = rows.find((r) => r.recipeId === "r_std")!;
    const alt = rows.find((r) => r.recipeId === "r_alt")!;
    expect(std.isCurrent).toBe(true);
    expect(std.output).toBe("120/min"); // 4 × 30, the current row's own actual
    expect(alt.output).toBe("120/min"); // 2 × 60, the alternate's overshoot
    // The overshoot is real: R was 100, both produce 120 — not clamped to R.
    expect(std.output).not.toBe("100/min");
  });

  it("propagates the variable-power flag with the varies suffix", () => {
    // A candidate whose machine is variable-power → the row power carries the
    // "(varies A–B MW)" suffix from the summed exact bounds.
    const varCat = synthCatalog(
      [item("ingot", "Ingot"), item("ore", "Ore")],
      [
        machine("smelter", 4),
        machine("refinery", 30, { variable: true, minMw: 20, maxMw: 40 }),
      ],
      [
        crecipe("r_std", "Standard", "smelter", [["ingot", 30]], [["ore", 30]]),
        crecipe(
          "r_var",
          "Variable",
          "refinery",
          [["ingot", 60]],
          [["ore", 45]],
          true,
        ),
      ],
    );
    const rows = candidateRowsFor(varCat, "ingot", "r_std", F(120));
    const varRow = rows.find((r) => r.recipeId === "r_var")!;
    // 2 refineries: 2×30 = 60 midpoint, bounds 2×20=40 .. 2×40=80.
    expect(varRow.power).toBe("60 MW (varies 40–80 MW)");
    // The non-variable candidate carries NO varies suffix.
    const stdRow = rows.find((r) => r.recipeId === "r_std")!;
    expect(stdRow.power).toBe("16 MW");
  });

  it("notes byproducts compactly; '—' when there is no raw draw", () => {
    // A candidate whose sole input is itself produced (no raw), and which emits a
    // byproduct. widget ← gadget (produced) ; widget recipe also outputs scrap.
    const bpCat = synthCatalog(
      [
        item("widget", "Widget"),
        item("gadget", "Gadget"),
        item("scrap", "Scrap"),
        item("ore", "Ore"),
      ],
      [machine("assembler", 10), machine("smelter", 4)],
      [
        crecipe(
          "r_widget_a",
          "Widget A",
          "assembler",
          [["widget", 30]],
          [["gadget", 30]],
        ),
        crecipe(
          "r_widget_b",
          "Widget B",
          "assembler",
          [
            ["widget", 30],
            ["scrap", 15],
          ],
          [["gadget", 30]],
          true,
        ),
        crecipe(
          "r_gadget",
          "Gadget",
          "smelter",
          [["gadget", 30]],
          [["ore", 30]],
        ),
      ],
    );
    const rows = candidateRowsFor(bpCat, "widget", "r_widget_a", F(30));
    const bRow = rows.find((r) => r.recipeId === "r_widget_b")!;
    // widget's only input (gadget) is produced → no raw at the widget stage, but
    // the gadget subtree draws ore → raw draw is Ore. Byproduct scrap noted.
    expect(bRow.rawDraw).toBe("Ore 30/min");
    expect(bRow.byproducts).toBe("Scrap 15/min");
    // The plain candidate has no byproducts → null.
    const aRow = rows.find((r) => r.recipeId === "r_widget_a")!;
    expect(aRow.byproducts).toBeNull();
  });

  it("MULTI-STAGE OUTPUT is the PRIMARY stage's rate, NOT machines × perMinute (#83, the v1-formula-catcher)", () => {
    // widget ← gadget: a 2-stage subtree. At R=30, the widget stage is 1 machine
    // producing 30/min, but `machines` is the SUBTREE Σ (widget 1 + gadget 1 =
    // 2). v1's WRONG formula (machines × perMinute) would give 2 × 30 = "60/min";
    // the honest OUTPUT is the widget primary stage's own outputRate = 30/min.
    // This is the test the multi-stage divergence demanded (r1 BLOCKER).
    const bpCat = synthCatalog(
      [item("widget", "Widget"), item("gadget", "Gadget"), item("ore", "Ore")],
      [machine("assembler", 10), machine("smelter", 4)],
      [
        crecipe(
          "r_widget_a",
          "Widget A",
          "assembler",
          [["widget", 30]],
          [["gadget", 30]],
        ),
        crecipe(
          "r_widget_b",
          "Widget B",
          "assembler",
          [["widget", 30]],
          [["gadget", 30]],
          true,
        ),
        crecipe(
          "r_gadget",
          "Gadget",
          "smelter",
          [["gadget", 30]],
          [["ore", 30]],
        ),
      ],
    );
    const rows = candidateRowsFor(bpCat, "widget", "r_widget_a", F(30));
    const aRow = rows.find((r) => r.recipeId === "r_widget_a")!;
    // Subtree Σ is 2 machines, but OUTPUT is the widget primary stage's rate.
    expect(aRow.machines).toBe("2");
    expect(aRow.output).toBe("30/min"); // the primary stage, NOT 2 × 30 = 60
    expect(aRow.output).not.toBe("60/min"); // the v1 formula would have said 60
  });

  it("SELF-CONSUMING candidate: OUTPUT is '—' WITHOUT throwing (#83, the v2-deref-catcher)", () => {
    // A recipe listing its own primary output among its inputs passes candidacy
    // but is demoted to RAW by proposeChain's cycle guard — leaving NO stage for
    // itemId. The guarded lookup degrades to "—"; an unguarded .find().outputRate
    // would TypeError inside the render (r2 IMPORTANT/MAJOR). Two candidates so
    // the item is comparable at all (candidateRecipesFor needs ≥2).
    const selfCat = synthCatalog(
      [item("ingot", "Ingot"), item("ore", "Ore")],
      [machine("smelter", 4)],
      [
        crecipe("r_std", "Standard", "smelter", [["ingot", 30]], [["ore", 30]]),
        // r_loop consumes its OWN primary output (ingot) → self-consuming.
        crecipe(
          "r_loop",
          "Looping",
          "smelter",
          [["ingot", 60]],
          [["ingot", 10]],
          true,
        ),
      ],
    );
    let rows!: ReturnType<typeof candidateRowsFor>;
    expect(() => {
      rows = candidateRowsFor(selfCat, "ingot", "r_std", F(30));
    }).not.toThrow();
    const loop = rows.find((r) => r.recipeId === "r_loop")!;
    expect(loop.output).toBe("—"); // demoted to raw, no stage for ingot
    // The non-self-consuming candidate still shows its real rate.
    const std = rows.find((r) => r.recipeId === "r_std")!;
    expect(std.output).toBe("30/min");
  });
});

describe("alt-compare — bundled Iron Ingot alternates", () => {
  it("surfaces exactly 5 candidates: default + Iron Alloy, Basic, Leached, Pure Iron", () => {
    const cands = candidateRecipesFor(catalog, "iron_ingot");
    expect(cands.map((c) => c.id)).toEqual([
      "ingot_iron", // default (Smelter), non-alternate → first
      "alternate_ingot_iron", // Iron Alloy Ingot
      "alternate_iron_ingot_basic", // Basic Iron Ingot
      "alternate_iron_ingot_leached", // Leached Iron Ingot
      "alternate_pure_iron_ingot", // Pure Iron Ingot
    ]);
    // The default leads; the four alternates follow ascending by id.
    expect(cands[0]!.isAlternate).toBe(false);
    expect(cands.slice(1).every((c) => c.isAlternate)).toBe(true);
  });

  it("scores the 5 rows with distinct, plausible metrics", () => {
    const rows = candidateRowsFor(catalog, "iron_ingot", "ingot_iron", F(60));
    expect(rows).toHaveLength(5);
    // The current (default) row is marked and carries no Apply-changing flag.
    expect(rows[0]!.isCurrent).toBe(true);
    expect(rows.slice(1).every((r) => !r.isCurrent)).toBe(true);
    // Every row reports a positive machine count and a power string.
    for (const r of rows) {
      expect(Number(r.machines)).toBeGreaterThan(0);
      expect(r.power).toMatch(/MW/);
      expect(r.rawDraw.length).toBeGreaterThan(0);
    }
    // Distinct configurations → not every row is byte-identical (the whole point
    // of the comparison): at least two rows differ on machines OR raw draw.
    const fingerprints = new Set(rows.map((r) => `${r.machines}|${r.rawDraw}`));
    expect(fingerprints.size).toBeGreaterThan(1);
  });
});

describe("alt-compare — swap machine count (ceil at compared rate)", () => {
  it("ceilDivs the compared rate by the candidate's primary perMinute", () => {
    const r = crecipe("r", "R", "m", [["ingot", 65]], [["ore", 7]], true);
    // 60/min via a 65/machine recipe → ceil(60/65) = 1.
    expect(swapMachineCountFor(r, F(60))).toBe(1);
    // 130/min → ceil(130/65) = 2 exactly.
    expect(swapMachineCountFor(r, F(130))).toBe(2);
    // 131/min → ceil(131/65) = 3 (ceil over-produces).
    expect(swapMachineCountFor(r, F(131))).toBe(3);
  });
});

// ===========================================================================
// S20 P0 — Propose info layer (ticket #99). Four spec families:
//   1. proposalMetrics exact totals (varies flag + degenerate envelope);
//   2. depth on a diamond DAG (longest-path + feeds names);
//   3. candidateCount against known-alternate fixtures;
//   4. compare-path regression (candidateRowsFor outputs unchanged).
// ===========================================================================

// A ProposalStage literal — the pieces proposalMetrics/toProposalPreview read.
function stage(
  itemId: string,
  recipeId: string,
  machineCount: bigint,
  outputRate: number,
): ChainProposal["stages"][number] {
  return { itemId, recipeId, machineCount, outputRate: F(outputRate) };
}

describe("S20 P0 — proposalMetrics (exact totals)", () => {
  // Two stages: a smelter (4 MW, constant) ×3 and a foundry (16 MW, constant)
  // ×2 → power 3×4 + 2×16 = 44 MW; machines 5; raw ore 120.
  const cat = synthCatalog(
    [item("ingot", "Ingot"), item("plate", "Plate"), item("ore", "Ore")],
    [machine("smelter", 4), machine("foundry", 16)],
    [
      crecipe("r_ingot", "Ingot", "smelter", [["ingot", 30]], [["ore", 30]]),
      crecipe("r_plate", "Plate", "foundry", [["plate", 20]], [["ingot", 45]]),
    ],
  );
  const proposal: ChainProposal = {
    stages: [
      stage("plate", "r_plate", 2n, 40),
      stage("ingot", "r_ingot", 3n, 90),
    ],
    links: [{ fromItemId: "ingot", toItemId: "plate" }],
    rawInputs: [{ itemId: "ore", rate: F(120) }],
    byproducts: [],
  };

  it("sums power + machines + raw exactly over the whole proposal", () => {
    const m = proposalMetrics(proposal, cat);
    expect(m.powerMw.eq(F(44))).toBe(true); // 3×4 + 2×16
    expect(m.machineCount).toBe(5n); // 3 + 2
    expect(m.powerVaries).toBe(false);
    expect(m.rawInputs).toEqual([{ itemId: "ore", rate: F(120) }]);
    expect(metricsPowerText(m)).toBe("44 MW"); // exact, no varies flag
  });

  it("on a fully-constant chain the envelope is degenerate: min===max===power", () => {
    // The `?? power.mw` fallback makes a constant machine contribute mw as BOTH
    // bounds — so min/max collapse onto the exact total, never an absent state.
    const m = proposalMetrics(proposal, cat);
    expect(m.minMw.eq(m.powerMw)).toBe(true);
    expect(m.maxMw.eq(m.powerMw)).toBe(true);
    expect(m.minMw.eq(F(44))).toBe(true);
  });

  it("sets powerVaries + widens the envelope when a machine is variable-power", () => {
    const varCat = synthCatalog(
      [item("ingot", "Ingot"), item("ore", "Ore")],
      [machine("refinery", 30, { variable: true, minMw: 20, maxMw: 40 })],
      [crecipe("r_ingot", "Ingot", "refinery", [["ingot", 30]], [["ore", 30]])],
    );
    const varProposal: ChainProposal = {
      stages: [stage("ingot", "r_ingot", 2n, 60)],
      links: [],
      rawInputs: [{ itemId: "ore", rate: F(60) }],
      byproducts: [],
    };
    const m = proposalMetrics(varProposal, varCat);
    expect(m.powerVaries).toBe(true);
    expect(m.powerMw.eq(F(60))).toBe(true); // 2 × 30 midpoint
    expect(m.minMw.eq(F(40))).toBe(true); // 2 × 20
    expect(m.maxMw.eq(F(80))).toBe(true); // 2 × 40
    // The sheet flags variance without repeating the bounds (compact).
    expect(metricsPowerText(m)).toBe("60 MW (varies)");
  });
});

describe("S20 P0 — depth on a diamond DAG (longest-path + feeds)", () => {
  // Diamond WITH a shortcut edge, the case shortest-path gets wrong:
  //   base → left → top   (base at depth 2 via this arm)
  //   base → right → top
  //   base → top          (shortcut: base at depth 1 via this arm)
  // Longest-path must place `base` at depth 2 (deeper than the shortcut's 1) so
  // no producer renders shallower than any consumer. Links point input → consumer.
  const cat = synthCatalog(
    [
      item("top", "Top"),
      item("left", "Left"),
      item("right", "Right"),
      item("base", "Base"),
      item("ore", "Ore"),
    ],
    [machine("m", 1)],
    [
      crecipe(
        "r_top",
        "Top",
        "m",
        [["top", 10]],
        [
          ["left", 10],
          ["right", 10],
          ["base", 10],
        ],
      ),
      crecipe("r_left", "Left", "m", [["left", 10]], [["base", 10]]),
      crecipe("r_right", "Right", "m", [["right", 10]], [["base", 10]]),
      crecipe("r_base", "Base", "m", [["base", 30]], [["ore", 30]]),
    ],
  );
  const proposal: ChainProposal = {
    // Stage order deliberately NOT depth order — the sort must reorder.
    stages: [
      stage("top", "r_top", 1n, 10),
      stage("base", "r_base", 1n, 30),
      stage("left", "r_left", 1n, 10),
      stage("right", "r_right", 1n, 10),
    ],
    links: [
      { fromItemId: "left", toItemId: "top" },
      { fromItemId: "right", toItemId: "top" },
      { fromItemId: "base", toItemId: "top" }, // the shortcut
      { fromItemId: "base", toItemId: "left" },
      { fromItemId: "base", toItemId: "right" },
    ],
    rawInputs: [{ itemId: "ore", rate: F(30) }],
    byproducts: [],
  };

  it("assigns longest-path depth (target T0; base T2 despite the shortcut)", () => {
    const view = toProposalPreview(proposal, cat);
    const depthByName = new Map(view.rows.map((r) => [r.itemName, r.depth]));
    expect(depthByName.get("Top")).toBe(0); // the unique sink = target
    expect(depthByName.get("Left")).toBe(1);
    expect(depthByName.get("Right")).toBe(1);
    // Longest-path: base→left→top is 2 hops; the shortcut base→top is 1. The
    // MAX wins → 2. Shortest-path would wrongly say 1 (shallower than left/right
    // which base feeds), breaking the "feeds" reading.
    expect(depthByName.get("Base")).toBe(2);
  });

  it("orders rows depth-asc with the target first, ties keeping stage order", () => {
    const view = toProposalPreview(proposal, cat);
    expect(view.rows.map((r) => r.itemName)).toEqual([
      "Top", // depth 0
      "Left", // depth 1 (before Right — stage order among the depth-1 tie)
      "Right", // depth 1
      "Base", // depth 2
    ]);
  });

  it("names every direct consumer in feeds (fan-out shows both consumers)", () => {
    const view = toProposalPreview(proposal, cat);
    const feedsByName = new Map(view.rows.map((r) => [r.itemName, r.feeds]));
    // base fans out to left, right, AND top (the shortcut) — all three named.
    expect(feedsByName.get("Base")).toEqual(["Top", "Left", "Right"]);
    expect(feedsByName.get("Left")).toEqual(["Top"]);
    expect(feedsByName.get("Right")).toEqual(["Top"]);
    // The target feeds nothing.
    expect(feedsByName.get("Top")).toEqual([]);
  });
});

describe("S20 P0 — candidateCount on preview rows", () => {
  it("counts candidates per item (0 or >=2 by construction) from the catalog", () => {
    // ingot has TWO producers (default + alternate) → count 2; plate has one →
    // count 0 (candidateRecipesFor returns [] below 2).
    const cat = synthCatalog(
      [item("plate", "Plate"), item("ingot", "Ingot"), item("ore", "Ore")],
      [machine("m", 4)],
      [
        crecipe("r_plate", "Plate", "m", [["plate", 20]], [["ingot", 30]]),
        crecipe("r_ingot", "Ingot", "m", [["ingot", 30]], [["ore", 30]]),
        crecipe(
          "r_ingot_alt",
          "Ingot Alt",
          "m",
          [["ingot", 45]],
          [["ore", 40]],
          true,
        ),
      ],
    );
    // proposeChain picks the default ingot recipe; the preview still counts BOTH
    // ingot candidates (the count P1's picker will offer).
    const p = proposeChainForCatalog(cat, "plate", F(20));
    const view = toProposalPreview(p, cat);
    const countByName = new Map(
      view.rows.map((r) => [r.itemName, r.candidateCount]),
    );
    expect(countByName.get("Ingot")).toBe(2); // default + alternate
    expect(countByName.get("Plate")).toBe(0); // single producer → []
    // Never a bare 1 — candidateRecipesFor returns [] below 2.
    expect([...countByName.values()].every((c) => c === 0 || c >= 2)).toBe(
      true,
    );
  });

  it("counts the real bundled Iron Ingot alternates (5) on its preview row", () => {
    const p = proposeChainForCatalog(catalog, "iron_plate", F(60));
    const view = toProposalPreview(p, catalog);
    const ingotRow = view.rows.find((r) => r.itemName === "Iron Ingot")!;
    // Matches the alt-compare enumeration (default + 4 alternates).
    expect(ingotRow.candidateCount).toBe(5);
  });
});

describe("S20 P0 — compare-path regression (candidateRowsFor unchanged)", () => {
  it("re-composes proposalMetrics into byte-identical compare rows", () => {
    // The extraction moved subtreePower's body into proposalMetrics; the compare
    // path (subtreePowerText → candidateRowsFor) must render identically. Pin the
    // exact strings the pre-extraction code produced for the synthetic cat.
    const cat = synthCatalog(
      [item("ingot", "Ingot"), item("ore", "Ore")],
      [machine("smelter", 4), machine("foundry", 16)],
      [
        crecipe("r_std", "Standard", "smelter", [["ingot", 30]], [["ore", 30]]),
        crecipe(
          "r_alt",
          "Alternate",
          "foundry",
          [["ingot", 60]],
          [["ore", 45]],
          true,
        ),
      ],
    );
    const rows = candidateRowsFor(cat, "ingot", "r_std", F(120));
    const std = rows.find((r) => r.recipeId === "r_std")!;
    const alt = rows.find((r) => r.recipeId === "r_alt")!;
    expect(std.power).toBe("16 MW"); // unchanged from the pre-S20 pin
    expect(std.machines).toBe("4");
    expect(alt.power).toBe("32 MW");
    expect(alt.machines).toBe("2");
  });
});

// ===========================================================================
// S20 P1 — Propose customization core (ticket #100). Adapter families per the
// frozen spec item 5: options plumbing, candidateRecipesFor exclusions param,
// excludableMachines, effectiveDefaultRecipe (incl. null), producerRecipesFor
// (UNGATED), pickerOptionsFor (TOTAL + the reachability pin), toProposalPreview
// candidateCount under exclusions, and the rawInputs cause annotation.
// ===========================================================================

// A three-producer ingot catalog reused across the picker/helper families:
//   r_std   — smelter, non-alternate  (the effective default)
//   r_alt_a — foundry, alternate
//   r_alt_z — refinery, alternate
// plus a plate that consumes ingot, so a full chain exists.
function ingotCatalog(): Catalog {
  return synthCatalog(
    [item("plate", "Plate"), item("ingot", "Ingot"), item("ore", "Ore")],
    [
      machine("constructor", 4),
      machine("smelter", 4),
      machine("foundry", 16),
      machine("refinery", 30),
    ],
    [
      crecipe(
        "r_plate",
        "Plate",
        "constructor",
        [["plate", 20]],
        [["ingot", 30]],
      ),
      crecipe(
        "r_std",
        "Standard Ingot",
        "smelter",
        [["ingot", 30]],
        [["ore", 30]],
      ),
      crecipe(
        "r_alt_a",
        "Alt A Ingot",
        "foundry",
        [["ingot", 45]],
        [["ore", 40]],
        true,
      ),
      crecipe(
        "r_alt_z",
        "Alt Z Ingot",
        "refinery",
        [["ingot", 60]],
        [["ore", 50]],
        true,
      ),
    ],
  );
}

describe("S20 P1 — proposeChainForCatalog options plumbing", () => {
  it("an override + a raw + an exclusion each deterministically change the proposal", () => {
    const cat = ingotCatalog();
    const base = proposeChainForCatalog(cat, "plate", F(60));
    // Baseline: ingot produced by the default (r_std).
    expect(base.stages.find((s) => s.itemId === "ingot")!.recipeId).toBe(
      "r_std",
    );

    // Override ingot → an alternate.
    const overridden = proposeChainForCatalog(cat, "plate", F(60), {
      overrides: new Map([["ingot", "r_alt_a"]]),
    });
    expect(overridden.stages.find((s) => s.itemId === "ingot")!.recipeId).toBe(
      "r_alt_a",
    );

    // Force ingot raw → its stage vanishes, its subtree pruned.
    const forced = proposeChainForCatalog(cat, "plate", F(60), {
      rawItemIds: new Set(["ingot"]),
    });
    expect(forced.stages.find((s) => s.itemId === "ingot")).toBeUndefined();
    expect(forced.rawInputs.some((r) => r.itemId === "ingot")).toBe(true);

    // Exclude the smelter → the default (r_std, smelter) is gone; ingot falls to
    // its next non-alternate producer — none exists here, so ingot is raw.
    const excluded = proposeChainForCatalog(cat, "plate", F(60), {
      excludedMachineIds: ["smelter"],
    });
    expect(excluded.stages.find((s) => s.itemId === "ingot")).toBeUndefined();
    expect(excluded.rawInputs.some((r) => r.itemId === "ingot")).toBe(true);

    // Determinism: same options ⇒ byte-identical.
    const again = proposeChainForCatalog(cat, "plate", F(60), {
      overrides: new Map([["ingot", "r_alt_a"]]),
    });
    expect(again).toEqual(overridden);
  });

  it("absent options is byte-identical to the 3-arg call (P0 unchanged)", () => {
    const cat = ingotCatalog();
    const threeArg = proposeChainForCatalog(cat, "plate", F(60));
    const emptyOpts = proposeChainForCatalog(cat, "plate", F(60), {});
    expect(emptyOpts).toEqual(threeArg);
  });
});

describe("S20 P1 — candidateRecipesFor custom exclusions", () => {
  it("an excluded machine's recipe drops out of candidacy", () => {
    // ingot has 3 producers (std + 2 alternates). Excluding the foundry drops
    // r_alt_a → 2 remain (still ≥2, so a non-empty list).
    const cat = ingotCatalog();
    const all = candidateRecipesFor(cat, "ingot").map((r) => r.id);
    expect(all).toEqual(["r_std", "r_alt_a", "r_alt_z"]);
    const excl = candidateRecipesFor(cat, "ingot", ["foundry"]).map(
      (r) => r.id,
    );
    expect(excl).toEqual(["r_std", "r_alt_z"]);
  });

  it("the default-arg call is unchanged (module constant — AltCompare/P0)", () => {
    // The default exclusion set is the module constant (converter/packager);
    // an unexcluded synthetic catalog is unaffected either way.
    const cat = ingotCatalog();
    const dflt = candidateRecipesFor(cat, "ingot").map((r) => r.id);
    const explicit = candidateRecipesFor(
      cat,
      "ingot",
      EXCLUDED_MACHINE_IDS,
    ).map((r) => r.id);
    expect(dflt).toEqual(explicit);
  });
});

describe("S20 P1 — excludableMachines", () => {
  it("lists only recipe-referenced machines, name-resolved, sorted by name", () => {
    const cat = synthCatalog(
      [item("ingot", "Ingot"), item("ore", "Ore")],
      [
        machine("smelter", 4),
        machine("foundry", 16),
        // An UNREFERENCED machine (no recipe uses it) — must be omitted.
        machine("orphan", 0),
      ],
      [
        crecipe("r_std", "Standard", "smelter", [["ingot", 30]], [["ore", 30]]),
        crecipe(
          "r_alt",
          "Alt",
          "foundry",
          [["ingot", 60]],
          [["ore", 45]],
          true,
        ),
      ],
    );
    // displayName falls back to id (the synth machine() sets displayName = id).
    const list = excludableMachines(cat);
    expect(list.map((m) => m.machineId)).toEqual(["foundry", "smelter"]);
    expect(list.every((m) => m.displayName === m.machineId)).toBe(true);
    // orphan is never listed (no recipe references it).
    expect(list.some((m) => m.machineId === "orphan")).toBe(false);
  });

  it("resolves display names from the catalog machines", () => {
    const cat: Catalog = {
      items: { ingot: item("ingot", "Ingot"), ore: item("ore", "Ore") },
      machines: {
        sm: { id: "sm", displayName: "Smelter", power: machine("sm", 4).power },
      },
      recipes: {
        r: crecipe("r", "R", "sm", [["ingot", 30]], [["ore", 30]]),
      },
      tiers: { belt: [F(60)], pipe: [F(300)] },
      recipeUnlocks: {},
    };
    expect(excludableMachines(cat)).toEqual([
      { machineId: "sm", displayName: "Smelter" },
    ]);
  });
});

describe("S20 P1 — effectiveDefaultRecipe (matches selectProducer)", () => {
  it("picks the non-alternate, non-excluded, ascending-id recipe", () => {
    const cat = ingotCatalog();
    expect(effectiveDefaultRecipe(cat, "ingot")!.id).toBe("r_std");
  });

  it("returns null when every non-alternate producer's machine is excluded", () => {
    // Excluding the smelter removes r_std (the only non-alternate) → the default
    // policy has no candidate (alternates never default) → null.
    const cat = ingotCatalog();
    expect(effectiveDefaultRecipe(cat, "ingot", ["smelter"])).toBeNull();
  });

  it("returns null for an alternate-only item (alternates never default)", () => {
    const cat = synthCatalog(
      [item("ingot", "Ingot"), item("ore", "Ore")],
      [machine("foundry", 16)],
      [
        crecipe(
          "r_alt",
          "Alt",
          "foundry",
          [["ingot", 60]],
          [["ore", 45]],
          true,
        ),
      ],
    );
    expect(effectiveDefaultRecipe(cat, "ingot")).toBeNull();
  });
});

describe("S20 P1 — producerRecipesFor (UNGATED eligible list)", () => {
  it("lists a LONE eligible candidate (no ≥2 gate, unlike candidateRecipesFor)", () => {
    const cat = synthCatalog(
      [item("ingot", "Ingot"), item("ore", "Ore")],
      [machine("smelter", 4)],
      [crecipe("r_std", "Standard", "smelter", [["ingot", 30]], [["ore", 30]])],
    );
    // candidateRecipesFor gates at ≥2 → []; producerRecipesFor lists the one.
    expect(candidateRecipesFor(cat, "ingot")).toEqual([]);
    expect(producerRecipesFor(cat, "ingot").map((r) => r.id)).toEqual([
      "r_std",
    ]);
  });

  it("orders effective-default first, then ascending id", () => {
    const cat = ingotCatalog();
    // Default (r_std) leads; the two alternates ascending (r_alt_a, r_alt_z).
    expect(producerRecipesFor(cat, "ingot").map((r) => r.id)).toEqual([
      "r_std",
      "r_alt_a",
      "r_alt_z",
    ]);
  });

  it("an alternate-only item returns its alternates (null default → ascending id)", () => {
    const cat = synthCatalog(
      [item("ingot", "Ingot"), item("ore", "Ore")],
      [machine("foundry", 16), machine("refinery", 30)],
      [
        crecipe(
          "r_alt_z",
          "Alt Z",
          "refinery",
          [["ingot", 60]],
          [["ore", 50]],
          true,
        ),
        crecipe(
          "r_alt_a",
          "Alt A",
          "foundry",
          [["ingot", 45]],
          [["ore", 40]],
          true,
        ),
      ],
    );
    // No effective default (all alternate) → the ordering degenerates to plain
    // ascending id (r_alt_a before r_alt_z), NOT array order.
    expect(producerRecipesFor(cat, "ingot").map((r) => r.id)).toEqual([
      "r_alt_a",
      "r_alt_z",
    ]);
  });

  it("a fully-excluded item returns [] (every producer's machine excluded)", () => {
    const cat = ingotCatalog();
    expect(
      producerRecipesFor(cat, "ingot", ["smelter", "foundry", "refinery"]),
    ).toEqual([]);
  });
});

describe("S20 P1 — pickerOptionsFor (TOTAL + reachability)", () => {
  it("in-list current recipe adds nothing (bare eligible list)", () => {
    const cat = ingotCatalog();
    // current = r_std, which IS in the eligible list → no force-include.
    expect(
      pickerOptionsFor(cat, "ingot", EXCLUDED_MACHINE_IDS, "r_std").map(
        (r) => r.id,
      ),
    ).toEqual(["r_std", "r_alt_a", "r_alt_z"]);
  });

  it("force-includes a current recipe absent from the eligible list (excluded machine)", () => {
    const cat = ingotCatalog();
    // Exclude the foundry AND make r_alt_a the current recipe. It is no longer
    // eligible → force-included (appended last).
    const opts = pickerOptionsFor(cat, "ingot", ["foundry"], "r_alt_a");
    expect(opts.map((r) => r.id)).toEqual(["r_std", "r_alt_z", "r_alt_a"]);
    // The force-included recipe is the last entry (the deviation, not a default).
    expect(opts[opts.length - 1]!.id).toBe("r_alt_a");
  });

  it("TOTAL: undefined currentRecipeId → the bare eligible list", () => {
    const cat = ingotCatalog();
    expect(
      pickerOptionsFor(cat, "ingot", EXCLUDED_MACHINE_IDS, undefined).map(
        (r) => r.id,
      ),
    ).toEqual(["r_std", "r_alt_a", "r_alt_z"]);
  });

  it("TOTAL: a catalog-absent currentRecipeId fabricates nothing → bare list", () => {
    const cat = ingotCatalog();
    expect(
      pickerOptionsFor(
        cat,
        "ingot",
        EXCLUDED_MACHINE_IDS,
        "r_does_not_exist",
      ).map((r) => r.id),
    ).toEqual(["r_std", "r_alt_a", "r_alt_z"]);
  });

  it("REACHABILITY pin: at 0/1 eligible with an excluded override the predicate is TRUE", () => {
    // The dead-end the r4 fold killed: an override to an excluded-machine recipe
    // with ≤1 OTHER eligible producer. The affordance predicate
    // (options.length ≥ 2 OR current force-included) must be TRUE so the row is
    // reachable and fixable.

    // Case A — ZERO other eligible producers. Single-producer catalog; exclude
    // its machine; override to it. Eligible = [] but the current is force-
    // included → options = [current], force-included = true.
    const single = synthCatalog(
      [item("ingot", "Ingot"), item("ore", "Ore")],
      [machine("smelter", 4)],
      [crecipe("r_std", "Standard", "smelter", [["ingot", 30]], [["ore", 30]])],
    );
    const optsA = pickerOptionsFor(single, "ingot", ["smelter"], "r_std");
    expect(optsA.map((r) => r.id)).toEqual(["r_std"]); // just the force-include
    const forceIncludedA = !producerRecipesFor(single, "ingot", [
      "smelter",
    ]).some((r) => r.id === "r_std");
    expect(optsA.length >= 2 || forceIncludedA).toBe(true);

    // Case B — ONE other eligible producer. ingot has r_std (smelter) + r_alt_a
    // (foundry); exclude the foundry, override to the (now-ineligible) r_alt_a.
    // Eligible = [r_std] (length 1), current force-included → predicate TRUE.
    const two = synthCatalog(
      [item("ingot", "Ingot"), item("ore", "Ore")],
      [machine("smelter", 4), machine("foundry", 16)],
      [
        crecipe("r_std", "Standard", "smelter", [["ingot", 30]], [["ore", 30]]),
        crecipe(
          "r_alt_a",
          "Alt A",
          "foundry",
          [["ingot", 45]],
          [["ore", 40]],
          true,
        ),
      ],
    );
    const optsB = pickerOptionsFor(two, "ingot", ["foundry"], "r_alt_a");
    expect(optsB.map((r) => r.id)).toEqual(["r_std", "r_alt_a"]);
    const eligibleB = producerRecipesFor(two, "ingot", ["foundry"]);
    const forceIncludedB = !eligibleB.some((r) => r.id === "r_alt_a");
    expect(eligibleB.length).toBe(1); // only ONE other eligible
    expect(optsB.length >= 2 || forceIncludedB).toBe(true);
  });
});

describe("S20 P1 — toProposalPreview candidateCount under exclusions", () => {
  it("counts eligible candidates with the CURRENT exclusions (chip == picker)", () => {
    // ingot has 3 candidates by default. Excluding the foundry drops one → 2.
    // The chip must reflect the CURRENT set, else it disagrees with the picker.
    const cat = ingotCatalog();
    const base = toProposalPreview(
      proposeChainForCatalog(cat, "plate", F(60)),
      cat,
    );
    expect(base.rows.find((r) => r.itemName === "Ingot")!.candidateCount).toBe(
      3,
    );

    const excludedOpts = { excludedMachineIds: ["foundry"] };
    const excl = toProposalPreview(
      proposeChainForCatalog(cat, "plate", F(60), excludedOpts),
      cat,
      excludedOpts,
    );
    expect(excl.rows.find((r) => r.itemName === "Ingot")!.candidateCount).toBe(
      2,
    );
  });

  it("keeps the P0 ≥2-gate semantics (a lone candidate → 0)", () => {
    // Excluding two of the three producers leaves ONE eligible → the ≥2 gate in
    // candidateRecipesFor returns [] → candidateCount 0 (P0 chip semantics).
    const cat = ingotCatalog();
    const opts = { excludedMachineIds: ["foundry", "refinery"] };
    const view = toProposalPreview(
      proposeChainForCatalog(cat, "plate", F(60), opts),
      cat,
      opts,
    );
    expect(view.rows.find((r) => r.itemName === "Ingot")!.candidateCount).toBe(
      0,
    );
  });
});

describe("S20 P1 — rawInputs cause annotation", () => {
  it("natural: a genuine no-producer leaf (ore) is 'natural'", () => {
    const cat = ingotCatalog();
    const view = toProposalPreview(
      proposeChainForCatalog(cat, "plate", F(60)),
      cat,
    );
    const ore = view.rawInputs.find((r) => r.itemId === "ore")!;
    expect(ore.cause).toBe("natural");
  });

  it("forced: a user-raw-marked item is 'forced'", () => {
    const cat = ingotCatalog();
    const opts = { rawItemIds: new Set(["ingot"]) };
    const view = toProposalPreview(
      proposeChainForCatalog(cat, "plate", F(60), opts),
      cat,
      opts,
    );
    const ingot = view.rawInputs.find((r) => r.itemId === "ingot")!;
    expect(ingot.cause).toBe("forced");
  });

  it("constrained: a producer exists but none is eligible under exclusions", () => {
    // Exclude every ingot producer → ingot has recipes but none eligible → its
    // demand collapses to raw, classified 'constrained' (NOT natural, NOT forced).
    const cat = ingotCatalog();
    const opts = { excludedMachineIds: ["smelter", "foundry", "refinery"] };
    const view = toProposalPreview(
      proposeChainForCatalog(cat, "plate", F(60), opts),
      cat,
      opts,
    );
    const ingot = view.rawInputs.find((r) => r.itemId === "ingot")!;
    expect(ingot.cause).toBe("constrained");
  });

  it("constrained (boundary r1 fix): an ALTERNATE-ONLY collapse is 'constrained', with live recovery options", () => {
    // Exclude only the smelter (the default r_std's machine): ingot's remaining
    // producers are the two ALTERNATES on non-excluded machines. The core's
    // default policy skips alternates → ingot collapses to raw. The classifier
    // must mirror that policy: effective default null + producers exist ⇒
    // "constrained" — and producerRecipesFor must still OFFER those alternates
    // (the constrained row's inline recovery is live, not dead code). The
    // pre-fix classifier keyed on the alternates-INCLUSIVE list and mislabeled
    // this exact case "natural" with no recovery surface.
    const cat = ingotCatalog();
    const opts = { excludedMachineIds: ["smelter"] };
    const view = toProposalPreview(
      proposeChainForCatalog(cat, "plate", F(60), opts),
      cat,
      opts,
    );
    const ingot = view.rawInputs.find((r) => r.itemId === "ingot")!;
    expect(ingot.cause).toBe("constrained");
    const recovery = producerRecipesFor(cat, "ingot", new Set(["smelter"]));
    expect(recovery.map((r) => r.id)).toEqual(["r_alt_a", "r_alt_z"]);
  });

  it("target immunity in causeOf: a stale target raw-mark never labels the target 'forced'", () => {
    // The core ignores a target raw-mark; the adapter must mirror it, or the
    // RAW OVERRIDES strip would offer an inert x for the target (boundary r1
    // NIT). ore has no producers, so a raw-target proposal exercises the path.
    const cat = ingotCatalog();
    const opts = { rawItemIds: new Set(["ore"]) };
    const view = toProposalPreview(
      proposeChainForCatalog(cat, "ore", F(60), opts),
      cat,
      opts,
    );
    const ore = view.rawInputs.find((r) => r.itemId === "ore")!;
    expect(ore.cause).toBe("natural");
  });

  it("OVERLAP: a forced item with NO eligible producer reports 'forced' (precedence)", () => {
    // ingot is BOTH force-marked raw AND fully excluded. Precedence forced >
    // constrained → 'forced' (the strip carries its ×, not the constrained line).
    const cat = ingotCatalog();
    const opts = {
      rawItemIds: new Set(["ingot"]),
      excludedMachineIds: ["smelter", "foundry", "refinery"],
    };
    const view = toProposalPreview(
      proposeChainForCatalog(cat, "plate", F(60), opts),
      cat,
      opts,
    );
    const ingot = view.rawInputs.find((r) => r.itemId === "ingot")!;
    expect(ingot.cause).toBe("forced");
  });

  it("forced raws are DISTINGUISHABLE so the caller excludes them from other lines", () => {
    // The natural/constrained display lines filter by cause !== 'forced'. Verify
    // the forced row is present with cause 'forced' AND the natural ore row is
    // present with cause 'natural' — the two are separable by the consumer.
    const cat = ingotCatalog();
    const opts = { rawItemIds: new Set(["ingot"]) };
    const view = toProposalPreview(
      proposeChainForCatalog(cat, "plate", F(60), opts),
      cat,
      opts,
    );
    const byCause = new Map(view.rawInputs.map((r) => [r.itemId, r.cause]));
    expect(byCause.get("ingot")).toBe("forced");
    // ore is no longer in the closure (ingot's subtree pruned) — so the only raw
    // is the forced ingot. The forced row is cleanly separable.
    expect(view.rawInputs.filter((r) => r.cause === "natural")).toEqual([]);
    expect(view.rawInputs.filter((r) => r.cause === "forced")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// S20 P3 — tier gating (ticket #102): gateCatalog, the both-worlds cause split,
// and the four-cell recovery lever matrix.
// ---------------------------------------------------------------------------

/** ingotCatalog with unlock tiers attached. */
function gatedIngotCatalog(recipeUnlocks: Record<string, number>): Catalog {
  return { ...ingotCatalog(), recipeUnlocks };
}

/** ingot is produced ONLY by alternates (no non-alternate producer exists at
 *  all) — the shape the v2 alternate-blind predicates dropped silently. */
function altOnlyIngotCatalog(recipeUnlocks: Record<string, number>): Catalog {
  return synthCatalog(
    [item("plate", "Plate"), item("ingot", "Ingot"), item("ore", "Ore")],
    [
      machine("constructor", 4),
      machine("foundry", 16),
      machine("refinery", 30),
    ],
    [
      crecipe(
        "r_plate",
        "Plate",
        "constructor",
        [["plate", 20]],
        [["ingot", 30]],
      ),
      crecipe(
        "r_alt_a",
        "Alt A",
        "foundry",
        [["ingot", 45]],
        [["ore", 40]],
        true,
      ),
      crecipe(
        "r_alt_z",
        "Alt Z",
        "refinery",
        [["ingot", 30]],
        [["ore", 35]],
        true,
      ),
    ],
    recipeUnlocks,
  );
}

describe("S20 P3 — gateCatalog", () => {
  it("returns the SAME REFERENCE at unlockedTier null (byte-stable no-gating path)", () => {
    const cat = gatedIngotCatalog({ r_std: 5 });
    // Identity, not a structural copy: this is what makes the null-tier path
    // byte-stable and the render-time derivation trivially memoizable.
    expect(gateCatalog(cat, null)).toBe(cat);
  });

  it("filters recipes whose min unlock tier exceeds the tier", () => {
    const cat = gatedIngotCatalog({ r_std: 0, r_alt_a: 3, r_alt_z: 7 });
    const gated = gateCatalog(cat, 3);
    expect(Object.keys(gated.recipes).sort()).toEqual([
      "r_alt_a", // unlock 3 ≤ 3 — available
      "r_plate", // NO unlock entry — nothing gates it, always available
      "r_std", // unlock 0
    ]);
  });

  it("carries items/machines/tiers/recipeUnlocks through untouched", () => {
    const cat = gatedIngotCatalog({ r_std: 9 });
    const gated = gateCatalog(cat, 0);
    expect(gated.items).toBe(cat.items);
    expect(gated.machines).toBe(cat.machines);
    expect(gated.tiers).toBe(cat.tiers);
    expect(gated.recipeUnlocks).toBe(cat.recipeUnlocks);
  });

  it("builds the gated recipes map with a null prototype (#28, third construction site)", () => {
    // The parse and revive boundaries are pinned elsewhere; gateCatalog is a
    // THIRD site, and a natural Object.fromEntries/spread would silently
    // regress it for every non-null tier with no existing test to catch it.
    const gated = gateCatalog(gatedIngotCatalog({ r_std: 0 }), 5);
    expect(Object.getPrototypeOf(gated.recipes)).toBeNull();
    expect(gated.recipes["constructor"]).toBeUndefined();
  });
});

describe("S20 P3 — cause classification across the two worlds", () => {
  it("every producer tier-gated → 'constrained', NOT 'natural'", () => {
    // hasAnyProducer must read the UNGATED world. Against the gated world this
    // item would look producer-less and classify "natural", silently losing
    // its recovery line — the whole reason causeOf takes both catalogs.
    const cat = gatedIngotCatalog({ r_std: 5, r_alt_a: 5, r_alt_z: 5 });
    const gated = gateCatalog(cat, 0);
    const opts = { excludedMachineIds: [] as string[] };
    const view = toProposalPreview(
      proposeChainForCatalog(gated, "plate", F(60), opts),
      gated,
      { ...opts, ungatedCatalog: cat },
    );
    const ingot = view.rawInputs.find((r) => r.itemId === "ingot")!;
    expect(ingot.cause).toBe("constrained");
  });

  it("an item with no producer in EITHER world stays 'natural'", () => {
    // The ALTERNATES are gated, not the default — so ingot is still produced at
    // tier 0 and the closure actually reaches ore. (Gating r_std instead would
    // collapse ingot to raw, prune ore from the closure entirely, and leave
    // this row asserting nothing at all.)
    const cat = gatedIngotCatalog({ r_alt_a: 5, r_alt_z: 5 });
    const gated = gateCatalog(cat, 0);
    const view = toProposalPreview(
      proposeChainForCatalog(gated, "plate", F(60)),
      gated,
      { ungatedCatalog: cat },
    );
    // ore is a genuine extraction leaf — gating cannot make it constrained.
    // Asserted through optional chaining, not an `if`: were ore to stop
    // appearing among the raw inputs, a guarded assertion would pass vacuously.
    expect(view.rawInputs.find((r) => r.itemId === "ore")?.cause).toBe(
      "natural",
    );
  });

  it("at tier null the classification is byte-identical to P1 (regression)", () => {
    // gated ≡ ungated ⇒ every P1 classification is reproduced exactly. This is
    // an exact reduction, not a refinement.
    const cat = gatedIngotCatalog({ r_std: 5, r_alt_a: 5, r_alt_z: 5 });
    const opts = { excludedMachineIds: ["smelter", "foundry", "refinery"] };
    const p1 = toProposalPreview(
      proposeChainForCatalog(ingotCatalog(), "plate", F(60), opts),
      ingotCatalog(),
      opts,
    );
    const gated = gateCatalog(cat, null);
    const p3 = toProposalPreview(
      proposeChainForCatalog(gated, "plate", F(60), opts),
      gated,
      { ...opts, ungatedCatalog: cat },
    );
    expect(p3.rawInputs).toEqual(p1.rawInputs);
  });
});

describe("S20 P3 — the four-cell recovery lever matrix", () => {
  /** The constrained ingot row's lever under `unlocks` at `tier` + exclusions. */
  function leverFor(
    cat: Catalog,
    tier: number | null,
    excludedMachineIds: string[],
  ) {
    const gated = gateCatalog(cat, tier);
    const opts = { excludedMachineIds };
    const view = toProposalPreview(
      proposeChainForCatalog(gated, "plate", F(60), opts),
      gated,
      { ...opts, ungatedCatalog: cat },
    );
    return view.rawInputs.find((r) => r.itemId === "ingot")!;
  }

  it("TIER-only: every producer is gated out, nothing is machine-excluded", () => {
    const row = leverFor(
      gatedIngotCatalog({ r_std: 5, r_alt_a: 5, r_alt_z: 5 }),
      0,
      [],
    );
    expect(row.cause).toBe("constrained");
    expect(row.lever).toBe("tier");
  });

  it("MACHINE-only: every producer's machine is excluded, nothing is gated", () => {
    const row = leverFor(
      gatedIngotCatalog({ r_std: 0, r_alt_a: 0, r_alt_z: 0 }),
      9,
      ["smelter", "foundry", "refinery"],
    );
    expect(row.cause).toBe("constrained");
    expect(row.lever).toBe("machine");
  });

  it("EITHER: producers split across the two levers, so each alone recovers", () => {
    // r_std is tier-gated but its machine is free; r_alt_a is available but its
    // machine is excluded. Raising the tier restores r_std; clearing exclusions
    // restores r_alt_a. r_alt_z is blocked both ways so it forces neither cell.
    const row = leverFor(
      gatedIngotCatalog({ r_std: 5, r_alt_a: 0, r_alt_z: 5 }),
      0,
      ["foundry", "refinery"],
    );
    expect(row.cause).toBe("constrained");
    expect(row.lever).toBe("either");
  });

  it("BOTH: a machine-excluded producer whose recipe is ALSO tier-gated", () => {
    // The compound case. Neither lever alone recovers, so a lone MACHINE
    // EXCLUSIONS hint would point at a control that cannot fix it.
    const row = leverFor(
      gatedIngotCatalog({ r_std: 5, r_alt_a: 5, r_alt_z: 5 }),
      0,
      ["smelter", "foundry", "refinery"],
    );
    expect(row.cause).toBe("constrained");
    expect(row.lever).toBe("both");
  });

  it("ALTERNATE-ONLY with every alternate tier-gated → TIER, and raising the tier restores the picker", () => {
    // v2's silent-drop cell: the branch entry is alternate-INCLUSIVE, so
    // effectiveDefaultRecipe-based predicates left this item with NO line at
    // all — regressing the message P1 always emits.
    const cat = altOnlyIngotCatalog({ r_alt_a: 5, r_alt_z: 5 });
    const row = leverFor(cat, 0, []);
    expect(row.cause).toBe("constrained");
    expect(row.lever).toBe("tier");
    // "Recovery" means the inline picker becomes non-empty again — P1's actual
    // affordance, which alternates participate in.
    expect(producerRecipesFor(gateCatalog(cat, 0), "ingot", []).length).toBe(0);
    expect(
      producerRecipesFor(gateCatalog(cat, 5), "ingot", []).map((r) => r.id),
    ).toEqual(["r_alt_a", "r_alt_z"]);
  });

  it("lever is null while the inline picker still has options (P1 recovery stands)", () => {
    // Only the smelter is excluded, so the alternates remain offerable: the
    // picker IS the recovery and no lever wording is needed.
    const row = leverFor(
      gatedIngotCatalog({ r_std: 0, r_alt_a: 0, r_alt_z: 0 }),
      9,
      ["smelter"],
    );
    expect(row.cause).toBe("constrained");
    expect(row.lever).toBe(null);
  });

  it("lever is null on non-constrained rows", () => {
    const cat = gatedIngotCatalog({});
    const view = toProposalPreview(
      proposeChainForCatalog(cat, "plate", F(60)),
      cat,
    );
    expect(view.rawInputs.every((r) => r.lever === null)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// S20 P2 — powerAtClockMw: the float overclock-power sum, PER-STAGE with each
// stage's OWN exponent (non-uniform in the snapshot). null at exactly 100.
// ---------------------------------------------------------------------------

/** A machine with a SPECIFIC power exponent (the default helper flattens to 1);
 *  needed to prove the per-stage-exponent sum uses each stage's own exponent. */
function machineWithExponent(
  id: string,
  mw: number,
  exponent: Fraction,
): CatalogMachine {
  return {
    id,
    displayName: id,
    power: { mw: F(mw), variable: false, exponent },
  };
}

describe("S20 P2 — proposalMetrics.powerAtClockMw (per-stage exponent)", () => {
  // Two stages on machines with DIFFERENT exponents: smelter 1.321929, foundry
  // 1.6 — the two the snapshot actually carries. The float sum must apply EACH
  // stage's own exponent, never one chain-wide value.
  const smelterExp = Fraction.of(1321929, 1000000);
  const foundryExp = Fraction.of(16, 10);
  const cat = synthCatalog(
    [item("ingot", "Ingot"), item("plate", "Plate"), item("ore", "Ore")],
    [
      machineWithExponent("smelter", 4, smelterExp),
      machineWithExponent("foundry", 16, foundryExp),
    ],
    [
      crecipe("r_ingot", "Ingot", "smelter", [["ingot", 30]], [["ore", 30]]),
      crecipe("r_plate", "Plate", "foundry", [["plate", 20]], [["ingot", 45]]),
    ],
  );
  const proposal: ChainProposal = {
    stages: [
      stage("plate", "r_plate", 2n, 40),
      stage("ingot", "r_ingot", 3n, 90),
    ],
    links: [{ fromItemId: "ingot", toItemId: "plate" }],
    rawInputs: [{ itemId: "ore", rate: F(120) }],
    byproducts: [],
  };

  it("is null at exactly 100 (the exact powerMw stands, no float)", () => {
    const m = proposalMetrics(proposal, cat, F(100));
    expect(m.powerAtClockMw).toBeNull();
    expect(m.clockPercent.eq(F(100))).toBe(true);
    // The exact 100%-basis figure is unchanged: 3×4 + 2×16 = 44.
    expect(m.powerMw.eq(F(44))).toBe(true);
    // The default arg is also 100 → null.
    expect(proposalMetrics(proposal, cat).powerAtClockMw).toBeNull();
  });

  it("at 150 sums each stage with its OWN exponent (not one chain-wide)", () => {
    const m = proposalMetrics(proposal, cat, F(150));
    const ratio = 1.5;
    // Per-stage: smelter 3 × 4 × 1.5^1.321929 + foundry 2 × 16 × 1.5^1.6.
    const expected =
      3 * 4 * ratio ** (1321929 / 1000000) + 2 * 16 * ratio ** 1.6;
    expect(m.powerAtClockMw).not.toBeNull();
    expect(m.powerAtClockMw!).toBeCloseTo(expected, 6);
    // The exact 100%-basis figures are UNTOUCHED by the clock.
    expect(m.powerMw.eq(F(44))).toBe(true);
    // A single chain-wide exponent (e.g. 1.6 for both) would give a DIFFERENT
    // number — prove the per-stage sum is not that.
    const uniform = 3 * 4 * ratio ** 1.6 + 2 * 16 * ratio ** 1.6;
    expect(m.powerAtClockMw!).not.toBeCloseTo(uniform, 6);
    // metricsPowerText renders the ≈ float idiom at ≠100.
    expect(metricsPowerText(m)).toBe(`≈ ${expected.toFixed(1)} MW`);
  });

  it("renders exact (no ≈) at 100 via metricsPowerText", () => {
    const m = proposalMetrics(proposal, cat, F(100));
    expect(metricsPowerText(m)).toBe("44 MW");
  });
});

// ---------------------------------------------------------------------------
// S20 P2 — byproductSuggestions: aggregate-then-match, unique on (itemId,
// toItemId) by construction. Match found / none / two-producers-one-consumer /
// one-byproduct-two-consumers.
// ---------------------------------------------------------------------------

describe("S20 P2 — byproductSuggestions", () => {
  it("emits a suggestion when a byproduct matches another stage's recipe input", () => {
    // fuel stage makes a resin byproduct; a rubber stage consumes resin.
    const cat = synthCatalog(
      [
        item("fuel", "Fuel"),
        item("resin", "Resin"),
        item("rubber", "Rubber"),
        item("oil", "Oil"),
      ],
      [machine("refinery", 30)],
      [
        crecipe(
          "r_fuel",
          "Fuel",
          "refinery",
          [
            ["fuel", 20],
            ["resin", 10],
          ],
          [["oil", 30]],
        ),
        crecipe(
          "r_rubber",
          "Rubber",
          "refinery",
          [["rubber", 20]],
          [["resin", 30]],
        ),
      ],
    );
    const proposal: ChainProposal = {
      stages: [
        stage("fuel", "r_fuel", 1n, 20),
        stage("rubber", "r_rubber", 1n, 20),
      ],
      links: [],
      byproducts: [{ itemId: "resin", rate: F(10) }],
      rawInputs: [{ itemId: "oil", rate: F(30) }],
    };
    const s = byproductSuggestions(proposal, cat);
    expect(s).toEqual([
      {
        itemId: "resin",
        rate: F(10),
        toItemId: "rubber",
        toItemName: "Rubber",
      },
    ]);
  });

  it("returns empty when no proposed stage consumes the byproduct", () => {
    const cat = synthCatalog(
      [item("fuel", "Fuel"), item("resin", "Resin"), item("oil", "Oil")],
      [machine("refinery", 30)],
      [
        crecipe(
          "r_fuel",
          "Fuel",
          "refinery",
          [
            ["fuel", 20],
            ["resin", 10],
          ],
          [["oil", 30]],
        ),
      ],
    );
    const proposal: ChainProposal = {
      stages: [stage("fuel", "r_fuel", 1n, 20)],
      links: [],
      byproducts: [{ itemId: "resin", rate: F(10) }],
      rawInputs: [{ itemId: "oil", rate: F(30) }],
    };
    expect(byproductSuggestions(proposal, cat)).toEqual([]);
  });

  it("TWO producers of one byproduct toward one consumer → ONE summed suggestion, keys unique", () => {
    // Two stages each emit resin as a byproduct (the byproducts array has NO
    // per-item merge — two entries for resin). One rubber stage consumes resin.
    // Aggregate-then-match must sum the rates into ONE suggestion.
    const cat = synthCatalog(
      [
        item("fuel", "Fuel"),
        item("plastic", "Plastic"),
        item("resin", "Resin"),
        item("rubber", "Rubber"),
        item("oil", "Oil"),
      ],
      [machine("refinery", 30)],
      [
        crecipe(
          "r_fuel",
          "Fuel",
          "refinery",
          [
            ["fuel", 20],
            ["resin", 10],
          ],
          [["oil", 30]],
        ),
        crecipe(
          "r_plastic",
          "Plastic",
          "refinery",
          [
            ["plastic", 20],
            ["resin", 5],
          ],
          [["oil", 30]],
        ),
        crecipe(
          "r_rubber",
          "Rubber",
          "refinery",
          [["rubber", 20]],
          [["resin", 30]],
        ),
      ],
    );
    const proposal: ChainProposal = {
      stages: [
        stage("fuel", "r_fuel", 1n, 20),
        stage("plastic", "r_plastic", 1n, 20),
        stage("rubber", "r_rubber", 1n, 20),
      ],
      links: [],
      // Two resin entries, no merge (as the core emits them).
      byproducts: [
        { itemId: "resin", rate: F(10) },
        { itemId: "resin", rate: F(5) },
      ],
      rawInputs: [{ itemId: "oil", rate: F(60) }],
    };
    const s = byproductSuggestions(proposal, cat);
    // ONE suggestion with the EXACT summed rate 10 + 5 = 15.
    expect(s).toHaveLength(1);
    expect(s[0]!.itemId).toBe("resin");
    expect(s[0]!.toItemId).toBe("rubber");
    expect(s[0]!.rate.eq(F(15))).toBe(true);
    // The (itemId, toItemId) key is unique.
    const keys = s.map((x) => `${x.itemId} ${x.toItemId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("ONE byproduct feeding TWO consumers → two suggestions with distinct toItemId keys", () => {
    // resin byproduct from fuel; TWO stages (rubber + plastic) consume resin.
    const cat = synthCatalog(
      [
        item("fuel", "Fuel"),
        item("resin", "Resin"),
        item("rubber", "Rubber"),
        item("plastic", "Plastic"),
        item("oil", "Oil"),
      ],
      [machine("refinery", 30)],
      [
        crecipe(
          "r_fuel",
          "Fuel",
          "refinery",
          [
            ["fuel", 20],
            ["resin", 10],
          ],
          [["oil", 30]],
        ),
        crecipe(
          "r_rubber",
          "Rubber",
          "refinery",
          [["rubber", 20]],
          [["resin", 30]],
        ),
        crecipe(
          "r_plastic",
          "Plastic",
          "refinery",
          [["plastic", 20]],
          [["resin", 20]],
        ),
      ],
    );
    const proposal: ChainProposal = {
      stages: [
        stage("fuel", "r_fuel", 1n, 20),
        stage("plastic", "r_plastic", 1n, 20),
        stage("rubber", "r_rubber", 1n, 20),
      ],
      links: [],
      byproducts: [{ itemId: "resin", rate: F(10) }],
      rawInputs: [{ itemId: "oil", rate: F(30) }],
    };
    const s = byproductSuggestions(proposal, cat);
    // Two suggestions, same itemId + rate, DISTINCT toItemId (the stable key).
    expect(s).toHaveLength(2);
    expect(s.every((x) => x.itemId === "resin" && x.rate.eq(F(10)))).toBe(true);
    const toIds = s.map((x) => x.toItemId).sort();
    expect(toIds).toEqual(["plastic", "rubber"]);
    // Unique on (itemId, toItemId).
    const keys = s.map((x) => `${x.itemId} ${x.toItemId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ---------------------------------------------------------------------------
// S21 P0 (ticket #104): vacuously-constrained extraction resources classify
// "natural". Every row here runs against the REAL bundled catalog — the claim
// is data-shaped ("which ores does the game only let you make in a Converter")
// and a synthetic fixture would pin the rule's algebra while proving nothing
// about the items the user actually sees.
//
// Sets are asserted BY NAME, never by count: a `length === 11` row would go
// green on the wrong eleven items and would churn on every catalog update.
// ---------------------------------------------------------------------------

describe("S21 P0 — vacuous raw resources classify natural", () => {
  /**
   * The raw-input row for `itemId` proposed AS THE TARGET (an all-raw
   * proposal, so the item is its own sole raw leaf). Mirrors the app's wiring:
   * propose + preview both see the GATED world, and the ungated one is threaded
   * through so the two-world classification is exercised, not bypassed.
   */
  function rawRowFor(
    itemId: string,
    tier: number | null = null,
    excludedMachineIds: string[] = [...EXCLUDED_MACHINE_IDS],
  ): RawInputRow {
    const gated = gateCatalog(catalog, tier);
    const opts = { excludedMachineIds };
    const view = toProposalPreview(
      proposeChainForCatalog(gated, itemId, F(60), opts),
      gated,
      { ...opts, ungatedCatalog: catalog },
    );
    return view.rawInputs.find((r) => r.itemId === itemId)!;
  }

  /** Every `isRawResource` item in the bundled catalog, by id. */
  const rawFlagged = Object.values(catalog.items)
    .filter((i) => i.isRawResource === true)
    .map((i) => i.id)
    .sort();

  it("natural-izes exactly the vacuous eleven — coal is the sole holdout", () => {
    // THE central pin, stated as two named sets over the raw-flagged items.
    // Before S21 P0 all twelve of these classified "constrained"; `coal` is
    // the one the design deliberately spares, because its Charcoal/Biocoal
    // constructor alternates are a recovery worth offering.
    const byCause = (want: string): string[] =>
      rawFlagged.filter((id) => rawRowFor(id).cause === want).sort();

    expect(byCause("natural")).toEqual([
      "liquid_oil",
      "nitrogen_gas",
      "ore_bauxite",
      "ore_copper",
      "ore_gold",
      "ore_iron",
      "ore_uranium",
      "raw_quartz",
      "sam", // no producer at all — "natural" via the pre-existing branch
      "stone",
      "sulfur",
      "water",
    ]);
    expect(byCause("constrained")).toEqual(["coal"]);
  });

  it("pins the CONVERTER case (ore_iron) and the PACKAGER case (water)", () => {
    // Both machines in EXCLUDED_MACHINE_IDS must reach the rule — an earlier
    // draft of this design was glossed as "converter-only", which would have
    // missed water/liquid_oil/nitrogen_gas entirely.
    const iron = rawRowFor("ore_iron"); // sole producer: iron_limestone @ converter
    expect(iron.cause).toBe("natural");
    expect(iron.lever).toBe(null); // levers annotate constrained rows only

    const water = rawRowFor("water"); // sole producer: unpackage_water @ packager
    expect(water.cause).toBe("natural");
    expect(water.lever).toBe(null);
  });

  it("leaves the 20 non-raw constrained items alone (spot-pin: polymer_resin)", () => {
    // The rule can only reach isRawResource items, so the genuinely
    // constrained non-raw population is untouched by construction. Pinned
    // anyway — "by construction" is what the two dead rules also claimed.
    expect(catalog.items["polymer_resin"]!.isRawResource).toBeUndefined();
    expect(rawRowFor("polymer_resin").cause).toBe("constrained");
  });

  // -- The load-bearing PAIR ------------------------------------------------
  // The rule is the CONJUNCTION of two vacuity tests. Two single-keyed rules
  // were proposed and killed during design; these two rows are what keep them
  // from returning silently. Each MUST fail against its respective dead rule:
  // drop the constant conjunct and the first goes red; drop the live conjunct
  // and the second does.

  it("coal stays constrained when the user EXCLUDES Constructor (kills the live-set-only rule)", () => {
    // Under a live-set-keyed rule, ticking Constructor empties coal's live
    // producer set, coal natural-izes, and the user silently loses BOTH the
    // picker and the "edit MACHINE EXCLUSIONS" hint — the exact regression at
    // the hero item that the refinement exists to prevent. The CONSTANT
    // conjunct is what saves it: charcoal/biocoal sit outside
    // EXCLUDED_MACHINE_IDS, so P(CONST) is false and the rule stays silent.
    const row = rawRowFor("coal", null, [
      ...EXCLUDED_MACHINE_IDS,
      "constructor_mk1",
    ]);
    expect(row.cause).toBe("constrained");
    expect(row.lever).toBe("machine");
  });

  it("ore_iron stays constrained with the TIER lever when the user UN-EXCLUDES Converter below tier 9 (kills the constant-only rule)", () => {
    // iron_limestone is a converter recipe unlocked at tier 9. With the
    // Converter re-enabled at tier ≤ 8 the user has a REAL "raise TIER"
    // recovery, which a constant-only rule would suppress (the converter is
    // still inside EXCLUDED_MACHINE_IDS, so P(CONST) holds). The LIVE conjunct
    // is what saves it — and it is definitionally ¬tierLever, which is why no
    // row with a tier-ALONE recovery can ever natural-ize.
    const row = rawRowFor("ore_iron", 8, ["packager"]);
    expect(row.cause).toBe("constrained");
    expect(row.lever).toBe("tier");
  });

  it("coal at TIER ≤ 2 classifies constrained with the TIER lever", () => {
    // The Axis 3 tier pin, and the only construction the shipped data allows:
    // both coal alternates unlock at tier 3, so tier 2 gates them out while
    // leaving them present in the ungated world. The rule stays silent because
    // it reads the UNGATED catalog for both conjuncts — gating alone must never
    // natural-ize anything.
    const row = rawRowFor("coal", 2);
    expect(row.cause).toBe("constrained");
    expect(row.lever).toBe("tier");
  });

  it("coal still offers its constructor alternates (kills the blanket isRawResource rule)", () => {
    // The picker IS the recovery here, hence lever null — which is precisely
    // why a blanket "raw ⇒ natural" rule would be a regression rather than
    // polish: it would delete a live, useful choice.
    const row = rawRowFor("coal");
    expect(row.cause).toBe("constrained");
    expect(row.lever).toBe(null);
    expect(
      producerRecipesFor(catalog, "coal", EXCLUDED_MACHINE_IDS).map(
        (r) => r.id,
      ),
    ).toEqual(["alternate_coal_1", "alternate_coal_2"]);
  });

  it("the P1 alternate-only collapse still classifies constrained (S20, unchanged)", () => {
    // The pin the P1 boundary fix exists for, re-asserted against the NARROWED
    // biconditional: the synthetic fixture sets no isRawResource, so the new
    // conjuncts cannot reach it and the recovery line stays live.
    const cat = altOnlyIngotCatalog({});
    const view = toProposalPreview(
      proposeChainForCatalog(cat, "plate", F(60)),
      cat,
      { ungatedCatalog: cat },
    );
    expect(view.rawInputs.find((r) => r.itemId === "ingot")!.cause).toBe(
      "constrained",
    );
  });
});
