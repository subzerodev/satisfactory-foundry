/**
 * Build-chain panel (Stage 8 / Phase 3, ticket #39; S20 P1 customization, #100).
 * Pick a target item + a rate, Propose → a component-local PREVIEW (one row per
 * proposed stage + the raw-inputs / byproducts lines + the cost sheet), then
 * shape it before Apply: pick the recipe per stage (incl. alternates), mark
 * items treat-as-raw, and edit which machines the proposer may use. Every change
 * re-proposes synchronously; Apply is unchanged (applies the CUSTOMIZED chain).
 *
 * The proposal + the customization choices are ephemeral — component-local
 * state, no store field (the store only gains the apply action; choice
 * persistence is P3). Apply clears the preview but KEEPS the choices (session
 * intent); Discard likewise clears the preview, keeps the choices. Solver runs
 * are a synchronous catalog-sized DFS. Frozen design: features/propose-grows-up/
 * p1-brainstorm.md (v7).
 */

import { useState } from "react";

import { Fraction } from "../core/fraction.ts";
import type { ChainProposal } from "../core/chain-builder.ts";
import { useAppStore } from "../state/store.ts";
import { formatRate } from "./format.ts";
import {
  EXCLUDED_MACHINE_IDS,
  proposeChainForCatalog,
  toProposalPreview,
  previewRowText,
  itemRateLineText,
  metricsPowerText,
  effectiveDefaultRecipe,
  producerRecipesFor,
  pickerOptionsFor,
  excludableMachines,
  byproductSuggestions,
} from "./chain-builder-adapter.ts";
import type { ProposalPreview } from "./chain-builder-adapter.ts";
import type { Catalog, CatalogRecipe } from "../data/types.ts";

/**
 * Parse the raw rate text into a positive Fraction, or a labeled error (the
 * Selection idiom — raw text, parsed at propose time). Pure + exported so the
 * node-env suite can pin the error wording without rendering the component.
 */
export function parseRateText(
  text: string,
): { ok: true; value: Fraction } | { ok: false; error: string } {
  let value: Fraction;
  try {
    value = Fraction.parse(text);
  } catch {
    return { ok: false, error: "rate must be a positive number" };
  }
  if (value.lte(Fraction.from(0))) {
    return { ok: false, error: "rate must be greater than 0" };
  }
  return { ok: true, value };
}

/**
 * Parse the CLOCK % text into a Fraction in (0, 250] — the game's shard-boosted
 * max (S20 P2). Same raw-text-parsed-at-propose-time idiom as `parseRateText`;
 * pure + exported so the node-env suite can pin the wording without rendering.
 */
export function parseClockText(
  text: string,
): { ok: true; value: Fraction } | { ok: false; error: string } {
  let value: Fraction;
  try {
    value = Fraction.parse(text);
  } catch {
    return { ok: false, error: "clock % must be a number in (0, 250]" };
  }
  if (value.lte(Fraction.from(0))) {
    return { ok: false, error: "clock % must be greater than 0" };
  }
  if (value.gt(Fraction.from(250))) {
    return { ok: false, error: "clock % must be at most 250" };
  }
  return { ok: true, value };
}

/** The preview + the proposal it came from (Apply hands the proposal to the store). */
interface Preview {
  proposal: ChainProposal;
  view: ProposalPreview;
}

/** The stage row for `itemId` in the current preview, or undefined. */
function stageRecipeId(
  proposal: ChainProposal,
  itemId: string,
): string | undefined {
  return proposal.stages.find((s) => s.itemId === itemId)?.recipeId;
}

export function ChainBuilder() {
  const catalog = useAppStore((s) =>
    s.catalog.status === "ready" ? s.catalog.catalog : null,
  );
  const applyChainProposal = useAppStore((s) => s.applyChainProposal);

  const [targetItemId, setTargetItemId] = useState("");
  const [rateText, setRateText] = useState("");
  // The global overclock target (S20 P2); default "100" ⇒ pre-P2 behavior.
  const [clockText, setClockText] = useState("100");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  // The three customization controls (component-local; no store surface, no
  // persistence — P3). Stale entries are KEPT: the core validate-and-ignore
  // totality makes an override/raw whose item has left the closure inert, and a
  // choice "comes back" correctly if the item re-enters. excludedMachineIds is
  // seeded from the module constant (converter/packager).
  const [overrides, setOverrides] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [rawItemIds, setRawItemIds] = useState<Set<string>>(() => new Set());
  const [excludedMachineIds, setExcludedMachineIds] = useState<Set<string>>(
    () => new Set(EXCLUDED_MACHINE_IDS),
  );
  // The one open picker at a time (component-local).
  const [pickerItemId, setPickerItemId] = useState<string | null>(null);

  if (catalog === null) return null;

  // All catalog items, sorted by display name (the select's option list).
  const items = Object.values(catalog.items).sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );

  /**
   * Re-run the solver with the current target/rate/choices and set the preview
   * — THE single propose path (simplify fold: one body serves Propose and every
   * control change, so the option-building can never desync between them).
   * Deterministic, synchronous, no debounce (a catalog-sized DFS per click).
   * Returns silently when there is no valid target/rate.
   */
  function repropose(
    cat: Catalog,
    patch: {
      overrides?: Map<string, string>;
      rawItemIds?: Set<string>;
      excludedMachineIds?: Set<string>;
    } = {},
    force = false,
  ): void {
    // force = true only on the initial Propose (builds the first preview);
    // control-change re-proposes are inert until a preview is live. The patch
    // carries a just-computed control value React state can't expose yet.
    if (!force && preview === null) return;
    if (targetItemId === "") return;
    const parsed = parseRateText(rateText);
    if (!parsed.ok) return;
    const parsedClock = parseClockText(clockText);
    if (!parsedClock.ok) return;
    // The clock joins the SAME options plumbing as the other controls (P1's
    // single-path invariant): one bag threads to both the core solve and the
    // preview's metrics, so they can never desync on the clock.
    const opts = {
      overrides: patch.overrides ?? overrides,
      rawItemIds: patch.rawItemIds ?? rawItemIds,
      excludedMachineIds: patch.excludedMachineIds ?? excludedMachineIds,
      clockPercent: parsedClock.value,
    };
    const proposal = proposeChainForCatalog(
      cat,
      targetItemId,
      parsed.value,
      opts,
    );
    setPreview({
      proposal,
      view: toProposalPreview(proposal, cat, {
        excludedMachineIds: opts.excludedMachineIds,
        rawItemIds: opts.rawItemIds,
        clockPercent: opts.clockPercent,
      }),
    });
  }

  function onPropose() {
    setError(null);
    setPreview(null);
    if (catalog === null) return;
    if (targetItemId === "") {
      setError("pick a target item");
      return;
    }
    const parsed = parseRateText(rateText);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const parsedClock = parseClockText(clockText);
    if (!parsedClock.ok) {
      setError(parsedClock.error);
      return;
    }
    repropose(catalog, {}, true);
  }

  function onApply() {
    if (preview === null) return;
    // Seed the applied stages with the propose-time clock text (S20 P2). A live
    // preview implies a valid clock (repropose bails on an invalid one), so the
    // raw text carries straight through as the user-intent-text idiom.
    applyChainProposal(preview.proposal, clockText);
    // Clear the preview so a double-apply is an explicit re-propose (Axis 6);
    // KEEP the customization choices (the user's session intent — Axis 3).
    setPreview(null);
    setPickerItemId(null);
  }

  function onDiscard() {
    // Clear the preview, KEEP the choices (Axis 3).
    setPreview(null);
    setPickerItemId(null);
  }

  /**
   * Choose `recipeId` for `itemId` from the picker. SET an override UNLESS the
   * chosen id equals the effective default's id (then CLEAR — the map holds only
   * true deviations, and clearing can never move the proposal away from the shown
   * selection). A null effective default (fully-excluded / alternate-only) ⇒
   * EVERY choice is an explicit override, nothing clears. Then re-propose.
   */
  function chooseRecipe(itemId: string, recipeId: string): void {
    if (catalog === null) return;
    const dflt = effectiveDefaultRecipe(catalog, itemId, excludedMachineIds);
    const next = new Map(overrides);
    if (dflt !== null && recipeId === dflt.id) {
      next.delete(itemId);
    } else {
      next.set(itemId, recipeId);
    }
    setOverrides(next);
    setPickerItemId(null);
    repropose(catalog, { overrides: next });
  }

  function toggleRaw(itemId: string): void {
    if (catalog === null) return;
    const next = new Set(rawItemIds);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setRawItemIds(next);
    repropose(catalog, { rawItemIds: next });
  }

  function toggleExclusion(machineId: string): void {
    if (catalog === null) return;
    const next = new Set(excludedMachineIds);
    if (next.has(machineId)) next.delete(machineId);
    else next.add(machineId);
    setExcludedMachineIds(next);
    repropose(catalog, { excludedMachineIds: next });
  }

  const view = preview?.view ?? null;
  // The forced (user-raw) rows drive the RAW OVERRIDES strip; natural and
  // constrained rows render on their own lines (forced rows excluded — the strip
  // is their sole surface, no double display).
  const forcedRaws = view?.rawInputs.filter((r) => r.cause === "forced") ?? [];
  const naturalRaws =
    view?.rawInputs.filter((r) => r.cause === "natural") ?? [];
  const constrainedRaws =
    view?.rawInputs.filter((r) => r.cause === "constrained") ?? [];
  const machines = excludableMachines(catalog);

  return (
    <div className="chain-builder">
      <div className="chain-builder-controls">
        <label>
          Build chain
          <select
            value={targetItemId}
            onChange={(e) => setTargetItemId(e.target.value)}
          >
            <option value="">— pick a target item —</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rate /min
          <input
            type="text"
            inputMode="decimal"
            value={rateText}
            onChange={(e) => setRateText(e.target.value)}
          />
        </label>
        <label>
          Clock %
          <input
            type="text"
            inputMode="decimal"
            value={clockText}
            onChange={(e) => setClockText(e.target.value)}
          />
        </label>
        <button type="button" onClick={onPropose}>
          Propose
        </button>
      </div>

      {/* Machine exclusions — the <details> disclosure; changes re-propose. */}
      <details className="chain-builder-exclusions">
        <summary>MACHINE EXCLUSIONS ({excludedMachineIds.size})</summary>
        <ul>
          {machines.map((m) => (
            <li key={m.machineId}>
              <label>
                <input
                  type="checkbox"
                  checked={excludedMachineIds.has(m.machineId)}
                  onChange={() => toggleExclusion(m.machineId)}
                />
                {m.displayName}
              </label>
            </li>
          ))}
        </ul>
      </details>

      {error !== null && <p className="chain-builder-error">{error}</p>}
      {preview !== null && view !== null && (
        <div className="chain-builder-preview">
          {!view.isEmpty && (
            <dl className="chain-builder-metrics">
              <div>
                <dt>Σ POWER</dt>
                <dd>{metricsPowerText(view.metrics)}</dd>
              </div>
              <div>
                <dt>Σ MACHINES</dt>
                <dd>{view.metrics.machineCount.toString()}</dd>
              </div>
              <div>
                <dt>RAW</dt>
                <dd>
                  {naturalRaws.length > 0 ? itemRateLineText(naturalRaws) : "—"}
                </dd>
              </div>
            </dl>
          )}
          {view.isEmpty ? (
            /* Constrained/forced targets already render on their labeled raw
               line with a recovery surface — a second generic message would
               double-speak (boundary r1 NIT). Only a NATURAL raw target gets
               the plain explanation. */
            view.rawInputs.every((r) => r.cause === "natural") ? (
              <p className="chain-builder-empty">
                Nothing to build — the target is a raw input.
              </p>
            ) : null
          ) : (
            <ul className="chain-builder-rows">
              {view.rows.map((row, i) => {
                const itemId = row.itemId;
                return (
                  <li key={row.itemId}>
                    {/* Tier marker on the first row of each depth (rows are
                        depth-asc, so a depth change === a new tier). */}
                    {(i === 0 || view.rows[i - 1]!.depth !== row.depth) && (
                      <span className="chain-builder-tier">T{row.depth}</span>
                    )}
                    {previewRowText(row)}
                    {row.feeds.length > 0 && (
                      <span className="chain-builder-feeds">
                        {" → feeds "}
                        {row.feeds.join(", ")}
                      </span>
                    )}
                    <RecipePicker
                      catalog={catalog}
                      itemId={itemId}
                      candidateCount={row.candidateCount}
                      currentRecipeId={stageRecipeId(preview.proposal, itemId)}
                      excludedMachineIds={excludedMachineIds}
                      open={pickerItemId === itemId}
                      onToggle={() =>
                        setPickerItemId(pickerItemId === itemId ? null : itemId)
                      }
                      onChoose={(recipeId) => chooseRecipe(itemId, recipeId)}
                    />
                    {/* RAW toggle — never on the T0 target row (depth 0). */}
                    {row.depth !== 0 && (
                      <button
                        type="button"
                        className="chain-builder-rawtoggle"
                        onClick={() => toggleRaw(itemId)}
                      >
                        RAW
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Constrained raws: a producer exists but none is eligible under the
              current exclusions — their OWN labeled line, in the notice styling,
              each with an inline recovery affordance. */}
          {constrainedRaws.map((r) => {
            const options = producerRecipesFor(
              catalog,
              r.itemId,
              excludedMachineIds,
            );
            return (
              <p key={r.itemId} className="chain-builder-constrained">
                RAW (no eligible producer): {r.itemName} {r.rate}/min
                {options.length > 0 ? (
                  <>
                    {" — "}
                    <select
                      aria-label={`pick a recipe for ${r.itemName}`}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value !== "")
                          chooseRecipe(r.itemId, e.target.value);
                      }}
                    >
                      <option value="">pick recipe…</option>
                      {options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {recipeLabel(
                            catalog,
                            o,
                            r.itemId,
                            excludedMachineIds,
                          )}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <span className="chain-builder-constrained-hint">
                    {" "}
                    — every producer's machine is excluded; edit MACHINE
                    EXCLUSIONS to recover.
                  </span>
                )}
              </p>
            );
          })}

          {/* RAW OVERRIDES strip — user-forced raws only; × to remove. Visible
              only when nonempty; also where a stale raw mark is removed. */}
          {forcedRaws.length > 0 && (
            <p className="chain-builder-rawstrip">
              RAW OVERRIDES:{" "}
              {forcedRaws.map((r, i) => (
                <span key={r.itemId}>
                  {i > 0 && ", "}
                  {r.itemName} {r.rate}/min
                  <button
                    type="button"
                    aria-label={`remove raw override for ${r.itemName}`}
                    onClick={() => toggleRaw(r.itemId)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </p>
          )}

          {view.byproducts.length > 0 && (
            <p className="chain-builder-byproducts">
              Byproducts: {itemRateLineText(view.byproducts)}
            </p>
          )}
          {/* Byproduct-feed suggestions (S20 P2) — DISPLAY-ONLY: a surplus
              byproduct that could feed a proposed stage. No toggle, no routing
              (that is #105); recomputed per re-propose (pure derivation). */}
          {byproductSuggestions(preview.proposal, catalog).map((s) => (
            <p
              key={`${s.itemId} ${s.toItemId}`}
              className="chain-builder-suggestion"
            >
              {catalog.items[s.itemId]?.displayName ?? s.itemId}{" "}
              {formatRate(s.rate)}/min could feed {s.toItemName}
            </p>
          ))}
          <div className="chain-builder-actions">
            <button type="button" onClick={onApply} disabled={view.isEmpty}>
              Apply
            </button>
            <button type="button" onClick={onDiscard}>
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The compose-able option label for a picker recipe (Axis 4): "(alt)" on an
 * alternate, "(default)" on the effective default when non-null, "(machine
 * excluded)" on a force-included recipe whose machine is excluded — labels
 * COMPOSE ("(alt) (machine excluded)" is the one reachable pairing). The
 * recipe's display name leads.
 */
function recipeLabel(
  catalog: Catalog,
  recipe: CatalogRecipe,
  itemId: string,
  excludedMachineIds: ReadonlySet<string>,
): string {
  const dflt = effectiveDefaultRecipe(catalog, itemId, excludedMachineIds);
  const tags: string[] = [];
  if (recipe.isAlternate) tags.push("(alt)");
  if (dflt !== null && recipe.id === dflt.id) tags.push("(default)");
  if (excludedMachineIds.has(recipe.machineId)) tags.push("(machine excluded)");
  return tags.length > 0
    ? `${recipe.displayName} ${tags.join(" ")}`
    : recipe.displayName;
}

interface RecipePickerProps {
  catalog: Catalog;
  itemId: string;
  candidateCount: number;
  currentRecipeId: string | undefined;
  excludedMachineIds: ReadonlySet<string>;
  open: boolean;
  onToggle: () => void;
  onChoose: (recipeId: string) => void;
}

/**
 * The per-stage recipe picker (Axis 4). The affordance renders iff
 * pickerOptionsFor(...).length ≥ 2 OR the current recipe is force-included —
 * NEVER gated on candidateCount (so an excluded override is always reachable
 * from its row). The chip reads "N recipes" when candidateCount ≥ 2 (P0
 * semantics unchanged); when the affordance must render WITHOUT a ≥2 count chip
 * it renders as a "machine excluded" chip in notice styling. Clicking toggles an
 * inline <select> whose options come from pickerOptionsFor ALONE, labeled on the
 * unified list; current selection = the stage's recipeId.
 */
function RecipePicker(props: RecipePickerProps) {
  const {
    catalog,
    itemId,
    candidateCount,
    currentRecipeId,
    excludedMachineIds,
    open,
    onToggle,
    onChoose,
  } = props;

  const options = pickerOptionsFor(
    catalog,
    itemId,
    excludedMachineIds,
    currentRecipeId,
  );
  const forceIncluded =
    currentRecipeId !== undefined &&
    catalog.recipes[currentRecipeId] !== undefined &&
    !producerRecipesFor(catalog, itemId, excludedMachineIds).some(
      (r) => r.id === currentRecipeId,
    );

  // Affordance reachability (r4): options ≥ 2 OR the current recipe is
  // force-included. Decoupled from candidateCount.
  if (options.length < 2 && !forceIncluded) return null;

  // The chip: the P0 "N recipes" count when candidateCount ≥ 2; otherwise (the
  // affordance renders without a ≥2 count chip — e.g. an excluded override with
  // ≤1 other eligible producer) a "machine excluded" notice chip.
  const chipLabel =
    candidateCount >= 2 ? `${candidateCount} recipes` : "machine excluded";
  const chipClass =
    candidateCount >= 2
      ? "chain-builder-picker"
      : "chain-builder-picker-notice";

  return (
    <span className="chain-builder-picker-wrap">
      {" "}
      <button
        type="button"
        className={chipClass}
        onClick={onToggle}
        aria-expanded={open}
      >
        {chipLabel}
      </button>
      {open && (
        <select
          aria-label="pick a recipe for this stage"
          value={currentRecipeId ?? ""}
          onChange={(e) => onChoose(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {recipeLabel(catalog, o, itemId, excludedMachineIds)}
            </option>
          ))}
        </select>
      )}
    </span>
  );
}
