/**
 * AltCompare (Stage 8 / Phase 4, ticket #40) — the alternate-recipe comparison
 * block on the ACTIVE stage. For an item with ≥2 producing recipes, it lists the
 * alternatives on what a builder weighs — machines, power, raw draw, byproducts —
 * across each candidate's WHOLE subtree at the stage's current output rate, as
 * comparable rows (the trainOptions idiom: options, no "best"). Each non-current
 * row's Apply swaps the stage's recipe through the ordinary editable graph.
 *
 * A thin shell (the LinkInspector precedent): all logic lives in the pure
 * exported helpers (altCompareModel + swapPayloadFor) — node-testable, no DOM —
 * so the component is a render pass over the model. It reads the store directly
 * and self-gates (renders nothing when there is nothing to compare).
 *
 * Frozen design: features/planner-intelligence/phase-4/brainstorm.md (v3).
 */

import { useAppStore } from "../state/store.ts";
import type { Selection, SolveState } from "../state/store.ts";
import type { Catalog, CatalogRecipe } from "../data/types.ts";
import { Fraction } from "../core/fraction.ts";
import {
  candidateRecipesFor,
  candidateRowsFor,
  swapMachineCountFor,
} from "./chain-builder-adapter.ts";
import type { CandidateRow } from "./chain-builder-adapter.ts";

/** The applyRecipeSwap payload for a candidate row (built pure, applied by the
 *  component's Apply button). machineCount keeps the stage producing (at least)
 *  its compared output rate via the candidate. */
export interface SwapPayload {
  stageId: string;
  recipeId: string;
  machineCount: number;
}

/** One rendered comparison row: the candidate metrics + (for non-current rows)
 *  the ready apply payload. The current row carries no payload (marked, no
 *  button). */
export interface CompareRow {
  row: CandidateRow;
  /** null on the current row (no Apply); the swap payload otherwise. */
  apply: SwapPayload | null;
}

/** The whole comparison model, or null when there is nothing to compare (the
 *  presence gate). */
export interface AltCompareModel {
  /** The compared item's display name (the block heading). */
  itemName: string;
  rows: CompareRow[];
}

/**
 * The comparison model for a stage, or null when the block must not render.
 *
 * Presence gate (all must hold): the stage is SOLVED; it has a recipe; that
 * recipe's PRIMARY item has ≥2 candidate producers. The compared demand R is the
 * primary-output LANE's totalOutput — `solve.result.outputs` is per-lane
 * (OutputLaneResult.totalOutput); there is no scalar. An absent primary lane (a
 * degenerate solve) gates the block off rather than guessing a rate.
 *
 * Pure over the passed slice — no store, no DOM (tested directly). The rows come
 * from the adapter (candidateRowsFor); each non-current row's apply payload is
 * built here from the candidate's ceil'd resize at R.
 */
export function altCompareModel(
  catalog: Catalog,
  stageId: string,
  selection: Selection,
  solve: SolveState,
): AltCompareModel | null {
  if (solve.status !== "solved") return null;
  const recipeId = selection.recipeId;
  if (recipeId === null) return null;
  const recipe = catalog.recipes[recipeId];
  if (recipe === undefined) return null;

  const itemId = recipe.primaryOutputId;
  const candidates = candidateRecipesFor(catalog, itemId);
  if (candidates.length < 2) return null; // nothing to compare

  // R = the primary output lane's totalOutput (per-lane; no scalar). Gate off if
  // the primary lane is absent (a solve with no output lane for its own item).
  const lane = solve.result.outputs.find((o) => o.itemId === itemId);
  if (lane === undefined) return null;
  const rate = lane.totalOutput;

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const rows = candidateRowsFor(catalog, itemId, recipeId, rate).map(
    (row): CompareRow => ({
      row,
      apply: row.isCurrent
        ? null
        : swapPayloadFor(stageId, byId.get(row.recipeId)!, rate),
    }),
  );

  return { itemName: catalog.items[itemId]?.displayName ?? itemId, rows };
}

/** The applyRecipeSwap payload for a candidate at the compared rate: the count
 *  is ceilDiv(rate, candidate primary perMinute) — same-output premise, ceil per
 *  the arc's integer rule. */
export function swapPayloadFor(
  stageId: string,
  candidate: CatalogRecipe,
  rate: Fraction,
): SwapPayload {
  return {
    stageId,
    recipeId: candidate.id,
    machineCount: swapMachineCountFor(candidate, rate),
  };
}

/** The active-stage alternate-recipe comparison block. Self-gates: renders
 *  nothing unless the active stage is solved with a ≥2-candidate primary item. */
export function AltCompare() {
  const catalog = useAppStore((s) =>
    s.catalog.status === "ready" ? s.catalog.catalog : null,
  );
  const activeStageId = useAppStore((s) => s.activeStageId);
  const selection = useAppStore((s) => s.selection);
  const solve = useAppStore((s) => s.solve);
  const applyRecipeSwap = useAppStore((s) => s.applyRecipeSwap);

  if (catalog === null) return null;
  const model = altCompareModel(catalog, activeStageId, selection, solve);
  if (model === null) return null;

  return (
    <div className="alt-compare">
      <header className="alt-compare-head">
        Alternate recipes for {model.itemName}
      </header>
      <table className="alt-compare-table">
        <thead>
          <tr>
            <th>recipe</th>
            <th>machines</th>
            <th>output</th>
            <th>power</th>
            <th>raw draw</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {model.rows.map(({ row, apply }) => (
            <tr
              key={row.recipeId}
              className={row.isCurrent ? "alt-compare-current" : ""}
            >
              <td>
                {row.recipeName}
                {row.isAlternate && (
                  <span className="alt-compare-mark"> (alt)</span>
                )}
                {row.byproducts !== null && (
                  <span className="alt-compare-byproducts">
                    {" "}
                    · +{row.byproducts}
                  </span>
                )}
              </td>
              <td>{row.machines}</td>
              <td>{row.output}</td>
              <td>{row.power}</td>
              <td>{row.rawDraw}</td>
              <td>
                {apply === null ? (
                  <span className="alt-compare-mark">current</span>
                ) : (
                  <button
                    type="button"
                    className="alt-compare-apply"
                    onClick={() =>
                      applyRecipeSwap(
                        apply.stageId,
                        apply.recipeId,
                        apply.machineCount,
                      )
                    }
                  >
                    apply
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
