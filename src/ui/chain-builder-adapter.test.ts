/**
 * UI adapter tests (Stage 8 / Phase 3, ticket #39): the catalog→core narrowing
 * + exclusion resolution, the preview shaping, and the bundled-catalog closure
 * smoke (real-target acyclicity/termination + supply≥demand + the exclusion-id
 * pins). This file may import data — the same rows can't live in the core test
 * (src/core/** is a lint-enforced no-data-import purity zone). Node env, no React.
 */

import { describe, it, expect } from "vitest";

import { Fraction } from "../core/fraction.ts";
import type { BuilderRecipe } from "../core/chain-builder.ts";
import { parseCatalogFromText } from "../data/catalog.ts";
import type {
  Catalog,
  CatalogItem,
  CatalogMachine,
  CatalogRecipe,
} from "../data/types.ts";
import {
  EXCLUDED_MACHINE_IDS,
  proposeChainForCatalog,
  toProposalPreview,
  previewRowText,
  itemRateLineText,
  candidateRecipesFor,
  candidateRowsFor,
  swapMachineCountFor,
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
    expect(preview.rawInputs).toEqual([{ itemName: "Iron Ore", rate: "120" }]);
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
): Catalog {
  return {
    items: Object.fromEntries(items.map((i) => [i.id, i])),
    machines: Object.fromEntries(machines.map((m) => [m.id, m])),
    recipes: Object.fromEntries(recipes.map((r) => [r.id, r])),
    tiers: { belt: [F(60)], pipe: [F(300)] },
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
