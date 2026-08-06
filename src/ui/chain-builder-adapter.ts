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
import type {
  ChainProposal,
  ItemRate,
  ProposedStage,
} from "../core/chain-builder.ts";
import { Fraction } from "../core/fraction.ts";
import type { Catalog, CatalogRecipe } from "../data/types.ts";
import { formatRate } from "./format.ts";
import { stagePowerText } from "./advice.ts";

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
  /**
   * Topological depth from the target: longest path from the target down to
   * this stage over `proposal.links` (T0 = target, T1 = its direct feeders, …).
   * Longest-path (not shortest) guarantees no producer ever renders in a
   * shallower tier than any consumer. Rows are emitted in (depth asc, existing
   * order); the tier marker is drawn on the first row of each depth. Unreachable
   * stages get Number.MAX_SAFE_INTEGER so they totalize last (defensive — the
   * target is the unique sink, so every stage is reachable in practice). S20 P0
   * Axis 2.
   */
  depth: number;
  /**
   * The display names of the items this stage FEEDS (its direct consumers) —
   * the named adjacency the DAG needs (a fan-out producer is legible only here,
   * not in the depth marker). Empty for the target (feeds nothing) and for any
   * stage with no consumer link. S20 P0 Axis 2.
   */
  feeds: string[];
  /**
   * How many candidate producer recipes exist for this item
   * (candidateRecipesFor length — 0 or ≥2 by construction). Nonzero ⇒ the
   * "N recipes" chip; this is exactly what P1's picker will offer. S20 P0 Axis 3.
   */
  candidateCount: number;
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
  /** Stage rows in (depth asc, existing order); tier boundaries are derivable
   *  from consecutive rows' `depth`. */
  rows: PreviewRow[];
  rawInputs: ItemRateRow[];
  byproducts: ItemRateRow[];
  /** true ⇒ nothing to build (no proposed stages); Apply is a no-op. */
  isEmpty: boolean;
  /** The cost-sheet totals (Σ power / Σ machines / raw) rendered above the rows. */
  metrics: ProposalMetrics;
}

/**
 * Longest-path depth from `targetItemId` to every item over `links`, keyed by
 * item id. Links point input-item → consumer-item (chain-builder.ts:245), so a
 * feed edge `from → to` means `to` is one hop SHALLOWER than `from`; the
 * traversal walks `to → from` outward from the target (depth 0).
 *
 * Longest-path (max over incoming consumer depths + 1), NOT shortest: on a
 * diamond DAG with a shortcut edge, shortest-path would place a producer
 * shallower than one of its consumers and break the "feeds" reading. A queue
 * relaxation over the DAG suffices (the proposal is acyclic — the builder's
 * cycle guard). Items unreachable from the target never appear in the map;
 * callers render them last (Number.MAX_SAFE_INTEGER). Pure + unit-testable.
 */
function depthsFromTarget(
  targetItemId: string,
  links: ChainProposal["links"],
): Map<string, number> {
  // Consumer (to) → producers (from): the outward adjacency the traversal walks.
  const producersOf = new Map<string, string[]>();
  for (const link of links) {
    const list = producersOf.get(link.toItemId);
    if (list === undefined) producersOf.set(link.toItemId, [link.fromItemId]);
    else list.push(link.fromItemId);
  }
  const depth = new Map<string, number>([[targetItemId, 0]]);
  // Relax outward: whenever a producer can be reached at a deeper level than
  // recorded, raise it and re-enqueue. Acyclic ⇒ this settles; the deepest path
  // to each item wins (longest-path). Ties keep the caller's row order (this map
  // only assigns depths; row emission does the stable sort).
  const queue: string[] = [targetItemId];
  while (queue.length > 0) {
    const item = queue.shift()!;
    const here = depth.get(item)!;
    for (const producer of producersOf.get(item) ?? []) {
      const candidate = here + 1;
      if (candidate > (depth.get(producer) ?? -1)) {
        depth.set(producer, candidate);
        queue.push(producer);
      }
    }
  }
  return depth;
}

/**
 * Build the display-ready preview from a proposal + the catalog for names.
 * Rows gain depth (longest-path tier from the target), feeds (direct-consumer
 * display names), and candidateCount (alternate-recipe count) — S20 P0. Rows are
 * ordered by (depth asc, existing stage order); the target unique sink is the
 * root, so it renders T0 first. `metrics` carries the cost-sheet totals.
 */
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

  // The target is the proposal's unique sink: the item that no link feeds (no
  // `from` edge originates it — equivalently, it is never a `fromItemId`). The
  // builder constructs demand-driven from the target, so it is always present;
  // absent an unreachable-edge pathology, exactly one such stage exists. Fall
  // back to the first stage's item (row order) so depth stays total.
  const producedIds = new Set(proposal.links.map((l) => l.fromItemId));
  const targetItemId =
    proposal.stages.find((s) => !producedIds.has(s.itemId))?.itemId ??
    proposal.stages[0]?.itemId ??
    "";
  const depthOf = depthsFromTarget(targetItemId, proposal.links);
  // Direct consumers per producer item (from → to): the "feeds" adjacency.
  const consumersOf = new Map<string, string[]>();
  for (const link of proposal.links) {
    const list = consumersOf.get(link.fromItemId);
    if (list === undefined) consumersOf.set(link.fromItemId, [link.toItemId]);
    else list.push(link.toItemId);
  }

  const rows: PreviewRow[] = proposal.stages.map((s) => ({
    itemName: itemName(s.itemId),
    machineName: machineNameFor(s),
    machineCount: s.machineCount.toString(),
    outputRate: formatRate(s.outputRate),
    depth: depthOf.get(s.itemId) ?? Number.MAX_SAFE_INTEGER,
    feeds: (consumersOf.get(s.itemId) ?? []).map(itemName),
    candidateCount: candidateRecipesFor(catalog, s.itemId).length,
  }));
  // Stable sort by depth (asc); Array.prototype.sort is stable, so equal-depth
  // rows keep their existing stage order (frozen: ties broken by row order).
  rows.sort((a, b) => a.depth - b.depth);

  return {
    rows,
    rawInputs: proposal.rawInputs.map((r) => ({
      itemName: itemName(r.itemId),
      rate: formatRate(r.rate),
    })),
    byproducts: proposal.byproducts.map((b) => ({
      itemName: itemName(b.itemId),
      rate: formatRate(b.rate),
    })),
    isEmpty: proposal.stages.length === 0,
    metrics: proposalMetrics(proposal, catalog),
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

/**
 * The cost sheet's Σ POWER line: "<n> MW" exact (the 100%-clock exact branch —
 * proposal stages are always 100% clock, so `formatRate` renders the Fraction
 * verbatim), with a bare " (varies)" flag when any machine is variable-power.
 * The flag is a warning, not the bounds range (the compare rows carry the full
 * "(varies A–B MW)"; the sheet stays compact). S20 P0 Axis 4.
 */
export function metricsPowerText(metrics: ProposalMetrics): string {
  return `${formatRate(metrics.powerMw)} MW${metrics.powerVaries ? " (varies)" : ""}`;
}

// ---------------------------------------------------------------------------
// Alternate-recipe comparison (Stage 8 / Phase 4, ticket #40).
//
// Candidate enumeration for an item X = every catalog recipe that
// primary-produces X on a NON-excluded machine — the isAlternate filter is
// LIFTED (that is the whole phase), the converter/packager exclusion stands.
// Each candidate's metrics come from ONE proposeChain run with the item pinned
// to that candidate (overrides = {X: candidateId}) — N runs of the SAME builder,
// no comparison-specific solver (the epic-mandated one-traversal reuse).
// ---------------------------------------------------------------------------

/** One comparison row: a candidate recipe scored against the compared demand. */
export interface CandidateRow {
  /** The candidate recipe id (the applyRecipeSwap payload key). */
  recipeId: string;
  /** The candidate recipe's display name (falls back to id). */
  recipeName: string;
  /** true ⇒ this row IS the stage's current recipe (marked, no Apply). */
  isCurrent: boolean;
  /** Total machine count across the candidate's whole subtree (Σ, exact). */
  machines: string;
  /** The candidate's actual produced rate of the compared item — the PRIMARY
   *  stage's exact, ceil-overshooting `outputRate` ("N/min"), or "—" when the
   *  candidate is self-consuming and gets demoted to raw (no stage for itemId).
   *  Sourced from the stage, NOT machines × perMinute — `machines` is the whole
   *  subtree Σ, so recomputing would be wrong for any multi-stage candidate. */
  output: string;
  /** Total power draw across the subtree — the S6 display discipline (exact at
   *  100% clock; a "(varies …)" suffix when any machine is variable-power). */
  power: string;
  /** The subtree's raw-resource draw as compact text ("Iron Ore 780/min · …"),
   *  or "—" when the candidate draws nothing raw (all inputs are produced). */
  rawDraw: string;
  /** The subtree's byproducts as compact text, or null when there are none
   *  (a note, never a cost column — byproducts are a bonus, not ranked). */
  byproducts: string | null;
}

/**
 * Every candidate recipe for item X, ordered default (non-alternate) first then
 * alternates ascending by recipe id — the enumeration the comparison table maps
 * over. Excluded-machine recipes (converter/packager) are never candidates.
 * Fewer than 2 candidates ⇒ empty (nothing to compare; the UI gate).
 */
export function candidateRecipesFor(
  catalog: Catalog,
  itemId: string,
): CatalogRecipe[] {
  const excluded = new Set(EXCLUDED_MACHINE_IDS);
  const candidates = Object.values(catalog.recipes).filter(
    (r) => r.primaryOutputId === itemId && !excluded.has(r.machineId),
  );
  if (candidates.length < 2) return [];
  // Non-alternate before alternate; within each group, ascending recipe id. The
  // default candidate is the baseline row, so it leads.
  return candidates.sort((a, b) => {
    if (a.isAlternate !== b.isAlternate) return a.isAlternate ? 1 : -1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * The whole-proposal metrics — the cost-sheet totals for a ChainProposal.
 *
 * A whole proposal IS the target's subtree, so this is the shared metric core
 * for BOTH the P0 cost sheet (over the applied proposal) and the alt-compare
 * candidate rows (over each candidate's subtree, which this function powers
 * unchanged — S20 P0 Axis 1, reuse-first). Extracted from the former
 * `subtreePower`; the compare path re-composes over it byte-identically.
 *
 * - `powerMw` — Σ over each stage of machineCount × the machine's exact
 *   `power.mw`; `powerVaries` set when ANY contributing machine is
 *   variable-power (so the row/sheet can carry the varies labeling).
 * - `minMw`/`maxMw` — the summed power envelope; a variable machine contributes
 *   its exact bounds, a constant one its `mw` as BOTH bounds (the `?? power.mw`
 *   fallback). On a fully-constant chain minMw === maxMw === powerMw — the
 *   degenerate envelope, never an absent state (frozen v3, r3 fold).
 * - `machineCount` — Σ machineCount across the subtree (bigint, exact).
 * - `rawInputs` — the proposal's RAW `{ itemId, rate }` rows, verbatim (rendered
 *   at the consumer via itemRateLineText / itemRateDot).
 *
 * A stage whose recipe/machine/power does not resolve contributes nothing to the
 * power sums (defensive — a proposal stage always resolves in practice); its
 * machineCount still counts.
 */
export interface ProposalMetrics {
  powerMw: Fraction;
  powerVaries: boolean;
  minMw: Fraction;
  maxMw: Fraction;
  machineCount: bigint;
  rawInputs: ItemRate[];
}

export function proposalMetrics(
  proposal: ChainProposal,
  catalog: Catalog,
): ProposalMetrics {
  let powerMw = Fraction.from(0);
  let powerVaries = false;
  // The min/max bounds accumulate in the SAME loop (diff-simplify fold): a
  // variable machine contributes its bounds, a constant one its mw as both —
  // so the mixed-subtree envelope stays honest and the two sums cannot drift
  // on which stages they skip.
  let minMw = Fraction.from(0);
  let maxMw = Fraction.from(0);
  let machineCount = 0n;
  for (const stage of proposal.stages) {
    machineCount += stage.machineCount;
    const machineId = catalog.recipes[stage.recipeId]?.machineId;
    if (machineId === undefined) continue;
    const power = catalog.machines[machineId]?.power;
    if (power === undefined) continue;
    const count = Fraction.from(stage.machineCount);
    powerMw = powerMw.add(count.mul(power.mw));
    if (power.variable) powerVaries = true;
    minMw = minMw.add(count.mul(power.minMw ?? power.mw));
    maxMw = maxMw.add(count.mul(power.maxMw ?? power.mw));
  }
  return {
    powerMw,
    powerVaries,
    minMw,
    maxMw,
    machineCount,
    rawInputs: proposal.rawInputs,
  };
}

/**
 * The subtree power total as the labeled display string — reusing
 * `stagePowerText` (the S6 discipline) at 100% clock, so the exact-Fraction
 * rendering AND the "(varies A–B MW)" suffix come from ONE source. Proposal
 * stages are always 100% clock (ProposedStage produces at 100), so the exact
 * branch always applies. `minMw/maxMw` are the summed variable bounds (the
 * degenerate min===max===total on a constant chain), matching stagePowerText's
 * varies-suffix contract.
 */
function subtreePowerText(proposal: ChainProposal, catalog: Catalog): string {
  const {
    powerMw: total,
    powerVaries: variable,
    minMw,
    maxMw,
  } = proposalMetrics(proposal, catalog);
  // Pure formatting over the one-loop struct: the constant total renders exact
  // via the count=1 identity; the variable total carries the summed bounds so
  // the varies suffix brackets the same number the leading figure shows.
  return variable
    ? stagePowerText(
        { mw: total, variable: true, minMw, maxMw, exponent: Fraction.from(1) },
        1,
        Fraction.from(100),
      )
    : stagePowerText(
        { mw: total, variable: false, exponent: Fraction.from(1) },
        1,
        Fraction.from(100),
      );
}

/** Compact "Item A/min · Item B/min" text from a proposal's item-rate list, or
 *  "—" when empty (no raw draw / no byproducts). formatRate keeps rates exact. */
function itemRateDot(
  rates: ChainProposal["rawInputs"],
  catalog: Catalog,
): string {
  if (rates.length === 0) return "—";
  const itemName = (id: string): string => catalog.items[id]?.displayName ?? id;
  return rates
    .map((r) => `${itemName(r.itemId)} ${formatRate(r.rate)}/min`)
    .join(" · ");
}

/**
 * The comparison rows for the item X currently produced by `currentRecipeId`, at
 * demand `rate` (the compared stage's current primary-output rate). One row per
 * candidate (default first, alternates ascending); each scored from a single
 * `proposeChain(X, rate, …, {X: candidate})` run. Empty when X has <2 candidates
 * (nothing to compare — the caller gates the whole block on this).
 */
export function candidateRowsFor(
  catalog: Catalog,
  itemId: string,
  currentRecipeId: string,
  rate: Fraction,
): CandidateRow[] {
  const candidates = candidateRecipesFor(catalog, itemId);
  const recipes = Object.values(catalog.recipes);
  return candidates.map((candidate) => {
    const proposal = proposeChain(
      itemId,
      rate,
      recipes,
      EXCLUDED_MACHINE_IDS,
      new Map([[itemId, candidate.id]]),
    );
    // Σ machineCount across the subtree (bigint → decimal string, exact).
    const machines = proposal.stages.reduce(
      (sum, s) => sum + s.machineCount,
      0n,
    );
    // The compared item's own produced rate = its PRIMARY stage's outputRate
    // (exact, ceil-overshooting). Guarded: a self-consuming candidate (one
    // listing its own primary output among its inputs) passes candidacy but is
    // demoted to raw by proposeChain's cycle guard, leaving NO stage for itemId
    // — the file's never-throw idiom degrades it to "—" rather than deref-throw.
    const primaryStage = proposal.stages.find((s) => s.itemId === itemId);
    const output =
      primaryStage === undefined
        ? "—"
        : formatRate(primaryStage.outputRate) + "/min";
    return {
      recipeId: candidate.id,
      recipeName: candidate.displayName,
      isCurrent: candidate.id === currentRecipeId,
      machines: machines.toString(),
      output,
      power: subtreePowerText(proposal, catalog),
      rawDraw: itemRateDot(proposal.rawInputs, catalog),
      byproducts:
        proposal.byproducts.length === 0
          ? null
          : itemRateDot(proposal.byproducts, catalog),
    };
  });
}

/**
 * The applyRecipeSwap payload for a candidate row: the machine count that keeps
 * the stage producing (at least) its compared output `rate` via `candidate` —
 * `ceilDiv(rate, candidate's primary perMinute)` (the arc's integer rule; ceil
 * only ever over-produces). The primary output is guaranteed present
 * (primaryOutputId ≡ outputs[0]); read defensively so a malformed recipe yields
 * a 1-machine floor rather than throwing.
 */
export function swapMachineCountFor(
  candidate: CatalogRecipe,
  rate: Fraction,
): number {
  const primary = candidate.outputs.find(
    (o) => o.itemId === candidate.primaryOutputId,
  );
  if (primary === undefined) return 1;
  return Number(rate.ceilDiv(primary.perMinute));
}
