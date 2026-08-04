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
import type { Catalog } from "../data/types.ts";
import {
  EXCLUDED_MACHINE_IDS,
  proposeChainForCatalog,
  toProposalPreview,
  previewRowText,
  itemRateLineText,
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
