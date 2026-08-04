/**
 * UI adapter for the auto-chain builder (Stage 8 / Phase 3, ticket #39). The
 * thin seam between the catalog (data layer) and the pure core solver: narrows
 * catalog recipes to the core's `BuilderRecipe` shape (a type-level pass-through
 * — CatalogRecipe is structurally assignable), resolves the excluded-machine id
 * set, and shapes the proposal into preview rows + apply payload.
 *
 * Core knows no catalog ids (`converter`/`packager` are data knowledge), so the
 * exclusion set is resolved HERE and passed as data — mirroring how tier rates
 * are caller-supplied. Frozen design Axis 2 + Axis 7.
 */

import { proposeChain } from "../core/chain-builder.ts";
import type { ChainProposal, ProposedStage } from "../core/chain-builder.ts";
import { Fraction } from "../core/fraction.ts";
import type { Catalog } from "../data/types.ts";
import { formatRate } from "./format.ts";

/**
 * The normalized machine ids excluded from producer selection. normalizeClassName
 * lowercases + snake-cases `Build_Converter_C`/`Build_Packager_C` to these forms.
 * Excluded because the Converter's resource-conversion recipes form dense ore
 * cycles and the Packager's package/unpackage pairs form fluid 2-cycles — both
 * invert what a player means by a production chain (Axis 2).
 */
export const EXCLUDED_MACHINE_IDS: readonly string[] = [
  "converter",
  "packager",
];

/**
 * Propose a chain for `targetItemId` at `rate` against the catalog. A thin
 * pass-through: catalog recipes ARE BuilderRecipes structurally, so no copying.
 * The exclusion set is resolved from the module constant (intersected with the
 * catalog's actual machines is unnecessary — an absent id simply never matches).
 */
export function proposeChainForCatalog(
  catalog: Catalog,
  targetItemId: string,
  rate: Fraction,
): ChainProposal {
  return proposeChain(
    targetItemId,
    rate,
    Object.values(catalog.recipes),
    EXCLUDED_MACHINE_IDS,
  );
}

/** One preview row per proposed stage — pure data → display strings. */
export interface PreviewRow {
  /** The produced item's display name (falls back to id). */
  itemName: string;
  /** The producing machine's display name (falls back to id). */
  machineName: string;
  /** Machine count as a plain decimal string (bigint → string, exact). */
  machineCount: string;
  /** The stage's primary output rate, formatted (exact). */
  outputRate: string;
}

/** One item + rate line (raw inputs / byproducts) — pure data → strings. */
export interface ItemRateRow {
  itemName: string;
  rate: string;
}

/**
 * The whole proposal shaped for the preview list: stage rows + the raw-inputs
 * line + the byproducts line, plus an emptiness flag (an all-raw proposal — the
 * target itself is raw — has no stages). Names resolve through the catalog.
 */
export interface ProposalPreview {
  rows: PreviewRow[];
  rawInputs: ItemRateRow[];
  byproducts: ItemRateRow[];
  /** true ⇒ nothing to build (no proposed stages); Apply is a no-op. */
  isEmpty: boolean;
}

/** Build the display-ready preview from a proposal + the catalog for names. */
export function toProposalPreview(
  proposal: ChainProposal,
  catalog: Catalog,
): ProposalPreview {
  const itemName = (id: string): string => catalog.items[id]?.displayName ?? id;
  const machineNameFor = (stage: ProposedStage): string => {
    const machineId = catalog.recipes[stage.recipeId]?.machineId;
    if (machineId === undefined) return stage.recipeId;
    return catalog.machines[machineId]?.displayName ?? machineId;
  };
  return {
    rows: proposal.stages.map((s) => ({
      itemName: itemName(s.itemId),
      machineName: machineNameFor(s),
      machineCount: s.machineCount.toString(),
      outputRate: formatRate(s.outputRate),
    })),
    rawInputs: proposal.rawInputs.map((r) => ({
      itemName: itemName(r.itemId),
      rate: formatRate(r.rate),
    })),
    byproducts: proposal.byproducts.map((b) => ({
      itemName: itemName(b.itemId),
      rate: formatRate(b.rate),
    })),
    isEmpty: proposal.stages.length === 0,
  };
}

/** A single preview row as one sentence: "Iron Ingot — Smelter ×12 — 360/min". */
export function previewRowText(row: PreviewRow): string {
  return `${row.itemName} — ${row.machineName} ×${row.machineCount} — ${row.outputRate}/min`;
}

/** The raw-inputs / byproducts line: "Iron Ore 780/min, Water 360/min". */
export function itemRateLineText(rows: ItemRateRow[]): string {
  return rows.map((r) => `${r.itemName} ${r.rate}/min`).join(", ");
}
