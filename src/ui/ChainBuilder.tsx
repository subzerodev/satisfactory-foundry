/**
 * Build-chain panel (Stage 8 / Phase 3, ticket #39; S20 P1 customization, #100).
 * Pick a target item + a rate, Propose → a component-local PREVIEW (one row per
 * proposed stage + the raw-inputs / byproducts lines + the cost sheet), then
 * shape it before Apply: pick the recipe per stage (incl. alternates), mark
 * items treat-as-raw, and edit which machines the proposer may use. Every change
 * re-proposes synchronously; Apply is unchanged (applies the CUSTOMIZED chain).
 *
 * The proposal is ephemeral — component-local state, cleared by Apply and
 * Discard alike (both KEEP the choices: session intent). The customization
 * choices are component state too, but as of S20 P3 (#102) the overrides, the
 * machine exclusions and the TIER gate are SEEDED from the persisted
 * `proposePrefs` and MIRRORED back on every change, so they survive a restart
 * and seed every future Propose; raw markings and the clock stay ephemeral (a
 * per-plan boundary intent and a per-run target respectively). Solver runs are
 * a synchronous catalog-sized DFS. Frozen design: features/propose-grows-up/
 * p1-brainstorm.md (v7), p3-brainstorm.md (v12).
 */

import { useState } from "react";

import { Fraction } from "../core/fraction.ts";
import type { ChainProposal } from "../core/chain-builder.ts";
import { useAppStore } from "../state/store.ts";
import { formatRate } from "./format.ts";
import {
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
  byproductRouteSuggestions,
  gateCatalog,
} from "./chain-builder-adapter.ts";
import type {
  ProposalPreview,
  PreviewRow,
  ConstrainedLever,
} from "./chain-builder-adapter.ts";
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

/** The cost sheet's OUTPUT total: the target row's actual output, with the
 *  requested preview snapshot shown only when integer machine counts overshoot. */
export function totalOutputText(
  rows: Pick<PreviewRow, "depth" | "outputRate">[],
  requestedRate: string,
): string {
  const target = rows.find((r) => r.depth === 0);
  if (target === undefined) return "—";
  const actual = `${target.outputRate}/min`;
  return target.outputRate === requestedRate
    ? actual
    : `${actual} (asked ${requestedRate}/min)`;
}

/** The preview + the proposal it came from (Apply hands the proposal to the store). */
interface Preview {
  proposal: ChainProposal;
  view: ProposalPreview;
  /** The requested rate this preview was solved against, formatted exactly. */
  rateText: string;
  /**
   * The raw clock text the proposal was SOLVED at. Apply seeds from this
   * snapshot, never the live input: clock (like Rate) does not re-propose on
   * edit, so the live text can drift from the counts the proposal was sized
   * for — the applied graph must carry the clock its counts assumed.
   */
  clockText: string;
  /**
   * The tier-gated catalog this proposal was SOLVED against — the same
   * snapshot posture as `clockText`, for the same reason. Derived once, in
   * `repropose`, and read by every gate-sensitive render site, so the STAGE
   * PICKERS, the CONSTRAINED ROWS and the proposal always describe ONE world:
   * a tier change that cannot re-propose (an unparseable Rate makes
   * `repropose` return early) leaves this untouched, rather than re-rendering
   * those surfaces against a world the rows were never solved in.
   *
   * The TIER `<select>` is deliberately NOT covered: it binds the live
   * `unlockedTier`, so in exactly that stalled case the control leads the
   * solved world until the next successful propose. That is the honest
   * reading — the control reports what the user chose, these surfaces report
   * what was solved — and it is pinned by its own test.
   */
  gated: Catalog;
  /** Base catalog identity used to solve this preview. A successful Docs
   * replacement creates a new object; Apply must not mix those two worlds. */
  sourceCatalog: Catalog;
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
  // The persisted Propose preferences (S20 P3): the SEED for the three
  // persisted controls below, and the sink every change mirrors back to.
  const proposePrefs = useAppStore((s) => s.proposePrefs);
  const setProposePrefs = useAppStore((s) => s.setProposePrefs);

  const [targetItemId, setTargetItemId] = useState("");
  const [rateText, setRateText] = useState("");
  // The global overclock target (S20 P2); default "100" ⇒ pre-P2 behavior.
  const [clockText, setClockText] = useState("100");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selectedRouteKeys, setSelectedRouteKeys] = useState<Set<string>>(
    () => new Set(),
  );

  // The customization controls. Component state remains the live per-run truth;
  // the three PERSISTED ones (overrides, exclusions, tier) are seeded from
  // proposePrefs via lazy initializers and mirrored back in the same handlers
  // that re-propose. Stale entries are KEPT: the core validate-and-ignore
  // totality makes an override/raw whose item has left the closure inert, and a
  // choice "comes back" correctly if the item re-enters.
  const [overrides, setOverrides] = useState<Map<string, string>>(
    () => new Map(Object.entries(proposePrefs.overrides)),
  );
  // rawItemIds is deliberately NOT persisted — a raw marking is a statement
  // about one factory ("I make this elsewhere"), not about the user.
  const [rawItemIds, setRawItemIds] = useState<Set<string>>(() => new Set());
  const [excludedMachineIds, setExcludedMachineIds] = useState<Set<string>>(
    () => new Set(proposePrefs.excludedMachineIds),
  );
  // The propose tier gate (S20 P3); null = "all", the byte-stable default.
  const [unlockedTier, setUnlockedTier] = useState<number | null>(
    () => proposePrefs.unlockedTier,
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
      unlockedTier?: number | null;
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
    // The ONE gating derivation. The tier for this propose rides the patch like
    // every other control: a React binding is stale within the tick, and here
    // that skew is dangerous — the stale world's stage recipe can be ABSENT
    // from the new one, defeating pickerOptionsFor's force-include and leaving
    // the picker <select> with no matching option. `!== undefined`, NOT `??`,
    // because `null` is the meaningful "all" value. The result is snapshotted
    // onto the preview below, so every render site reads this exact world.
    const tier =
      patch.unlockedTier !== undefined ? patch.unlockedTier : unlockedTier;
    const gatedCat = gateCatalog(cat, tier);
    const proposal = proposeChainForCatalog(
      gatedCat,
      targetItemId,
      parsed.value,
      opts,
    );
    const routeKeys = new Set(
      byproductRouteSuggestions(proposal, gatedCat).map((r) => r.key),
    );
    setSelectedRouteKeys(
      (prev) => new Set([...prev].filter((key) => routeKeys.has(key))),
    );
    setPreview({
      proposal,
      view: toProposalPreview(proposal, gatedCat, {
        excludedMachineIds: opts.excludedMachineIds,
        rawItemIds: opts.rawItemIds,
        clockPercent: opts.clockPercent,
        // The UNGATED world, for the cause split + the lever matrix.
        ungatedCatalog: cat,
      }),
      rateText: formatRate(parsed.value),
      clockText,
      gated: gatedCat,
      sourceCatalog: cat,
    });
  }

  function onPropose() {
    setError(null);
    setPreview(null);
    setSelectedRouteKeys(new Set());
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
    if (catalog !== preview.sourceCatalog) {
      setError("catalog changed; propose again");
      setPreview(null);
      setSelectedRouteKeys(new Set());
      setPickerItemId(null);
      return;
    }
    const byproductRoutes = byproductRouteSuggestions(
      preview.proposal,
      preview.gated,
    )
      .filter((route) => selectedRouteKeys.has(route.key))
      .map(({ fromItemId, itemId, toItemId }) => ({
        fromItemId,
        itemId,
        toItemId,
      }));
    // Seed the applied stages with the SNAPSHOT clock text (S20 P2) — the one
    // the proposal's counts were solved at. The live input may have drifted
    // since propose (clock, like Rate, only takes effect on the next Propose).
    applyChainProposal(preview.proposal, {
      clockPercentText: preview.clockText,
      byproductRoutes,
      catalog: preview.gated,
    });
    // Clear the preview so a double-apply is an explicit re-propose (Axis 6);
    // KEEP the customization choices (the user's session intent — Axis 3).
    setPreview(null);
    setSelectedRouteKeys(new Set());
    setPickerItemId(null);
  }

  function onDiscard() {
    // Clear the preview, KEEP the choices (Axis 3).
    setPreview(null);
    setSelectedRouteKeys(new Set());
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
    // Only ever reached from the picker or a constrained row, both of which
    // render inside the preview block — so the preview (and its gated world)
    // always exists here; the guard is for narrowing, in the same idiom as the
    // catalog check above.
    if (preview === null) return;
    // The clear rule resolves against the GATED default: the user is choosing
    // from the gated option list, so clearing must compare against what that
    // list calls the default — otherwise picking the gated default would set a
    // spurious override that outlives the tier change.
    const dflt = effectiveDefaultRecipe(
      preview.gated,
      itemId,
      excludedMachineIds,
    );
    const next = new Map(overrides);
    if (dflt !== null && recipeId === dflt.id) {
      next.delete(itemId);
    } else {
      next.set(itemId, recipeId);
    }
    setOverrides(next);
    setProposePrefs({ overrides: Object.fromEntries(next) });
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
    setProposePrefs({ excludedMachineIds: [...next] });
    repropose(catalog, { excludedMachineIds: next });
  }

  /**
   * Change the propose TIER gate. A discrete control, so it re-proposes
   * immediately (the P1 auto-repropose idiom, not the Rate/Clock text idiom),
   * and the new tier MUST ride the patch — see `repropose`.
   */
  function onTierChange(raw: string): void {
    if (catalog === null) return;
    const next = raw === "" ? null : Number(raw);
    setUnlockedTier(next);
    setProposePrefs({ unlockedTier: next });
    repropose(catalog, { unlockedTier: next });
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
  // UNGATED on purpose (Axis 4 carve-out): gating this list would DELETE the
  // checkbox for an already-excluded high-tier machine, stranding that id in
  // excludedMachineIds with no way to clear it — and the recovery wording would
  // then point at a control the user cannot reach.
  const machines = excludableMachines(catalog);

  // The TIER select's options: "all" plus 0..max, where max is DERIVED from the
  // catalog's own unlock data — never hardcoded (the max tier actually present
  // among unlock-bearing recipes may be lower than the game's nominal range).
  const unlockTiers = Object.values(catalog.recipeUnlocks);
  const tierOptions =
    unlockTiers.length === 0
      ? []
      : Array.from({ length: Math.max(...unlockTiers) + 1 }, (_, i) => i);
  // Render normalization (Axis 1): a persisted tier with no matching option —
  // above the range, or an empty unlock map — renders as "all", which is what a
  // too-high tier already BEHAVES as (it gates nothing). Bound EXPLICITLY
  // rather than left to `value={unlockedTier}`: the select must carry a value
  // some option actually matches. No clamp, no write-back — nothing persists a
  // value the user did not choose.
  const tierSelectValue =
    unlockedTier !== null && tierOptions.includes(unlockedTier)
      ? String(unlockedTier)
      : "";
  const routeableSuggestions =
    preview === null
      ? new Map<string, ReturnType<typeof byproductRouteSuggestions>[number]>()
      : new Map(
          byproductRouteSuggestions(preview.proposal, preview.gated).map(
            (route) => [`${route.itemId} ${route.toItemId}`, route],
          ),
        );
  const byproductSuggestionRows =
    preview === null
      ? []
      : byproductSuggestions(preview.proposal, preview.gated);

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
        <label>
          TIER
          <select
            className="chain-builder-tier-select"
            value={tierSelectValue}
            onChange={(e) => onTierChange(e.target.value)}
          >
            <option value="">all</option>
            {tierOptions.map((t) => (
              <option key={t} value={String(t)}>
                {t}
              </option>
            ))}
          </select>
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
              <div>
                <dt>OUTPUT</dt>
                <dd>{totalOutputText(view.rows, preview.rateText)}</dd>
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
                      catalog={preview.gated}
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
            // GATED: an ungated list here would offer recipes the gated solve
            // then validate-and-ignores — a dead control contradicting the
            // recovery wording's own "raise TIER" advice.
            const options = producerRecipesFor(
              preview.gated,
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
                            preview.gated,
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
                    {constrainedHintText(r.lever)}
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
          {byproductSuggestionRows.map((s) => {
            const key = `${s.itemId} ${s.toItemId}`;
            const route = routeableSuggestions.get(key);
            return (
              <p key={key} className="chain-builder-suggestion">
                {route === undefined ? (
                  <>
                    {preview.gated.items[s.itemId]?.displayName ?? s.itemId}{" "}
                    {formatRate(s.rate)}/min could feed {s.toItemName}
                  </>
                ) : (
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedRouteKeys.has(route.key)}
                      aria-label={`route ${route.itemName} from ${route.fromItemName} to ${route.toItemName}`}
                      onChange={() => {
                        setSelectedRouteKeys((prev) => {
                          const next = new Set(prev);
                          if (next.has(route.key)) next.delete(route.key);
                          else next.add(route.key);
                          return next;
                        });
                      }}
                    />
                    ROUTE {formatRate(route.rate)}/min from {route.fromItemName}
                    : {route.itemName} could feed {route.toItemName}
                  </label>
                )}
              </p>
            );
          })}
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
 * The recovery wording for a constrained raw whose inline picker is empty,
 * chosen by WHICH lever actually recovers it (S20 P3's four-cell matrix). Every
 * cell names a control that can really fix the row: a lone MACHINE EXCLUSIONS
 * hint on a tier-blocked item would point at a control that cannot.
 *
 * The "machine" cell is P1's exact string. At tier "all" the tier lever can
 * never fire, so that is the ONLY reachable cell and the pre-P3 wording is
 * preserved byte-for-byte — an exact reduction, not a refinement. A null lever
 * is unreachable here (a non-empty picker renders the select branch instead);
 * it shares the machine wording so the function stays total.
 */
function constrainedHintText(lever: ConstrainedLever | null): string {
  switch (lever) {
    case "tier":
      return " — locked behind the TIER gate; raise TIER to recover.";
    case "either":
      return " — raise TIER or edit MACHINE EXCLUSIONS to recover.";
    case "both":
      return " — blocked by BOTH the TIER gate and MACHINE EXCLUSIONS; change both.";
    case "machine":
    case null:
      return " — every producer's machine is excluded; edit MACHINE EXCLUSIONS to recover.";
  }
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
