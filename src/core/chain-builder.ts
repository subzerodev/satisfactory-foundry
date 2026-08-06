/**
 * Auto-chain builder (Stage 8 / Phase 3, ticket #39). Given a target item + a
 * requested rate, propose a complete multi-stage production chain — one stage
 * per distinct item in the closure, machine counts as exact minimal integers,
 * links following recipe inputs — that the caller applies into the ordinary
 * editable graph.
 *
 * Pure, exact core (the reconcile.ts LinkInput precedent): imports ONLY Fraction
 * and defines its OWN narrow input interface (`BuilderRecipe`), so it takes no
 * dependency on data/state/ui. CatalogRecipe is structurally assignable to
 * BuilderRecipe, so the ui adapter is a type-level pass-through.
 *
 * Frozen design: features/planner-intelligence/phase-3/brainstorm.md (v3).
 */

import { Fraction } from "./fraction.ts";

/** One recipe input/output at 100% clock (structurally a data `RecipeIO`). */
export interface BuilderIO {
  itemId: string;
  perMinute: Fraction;
}

/**
 * The minimal recipe shape the solver needs — its OWN narrow type (the
 * LinkInput precedent), so core never imports the catalog. `CatalogRecipe` is
 * structurally assignable to this.
 */
export interface BuilderRecipe {
  id: string;
  machineId: string;
  isAlternate: boolean;
  /** = outputs[0].itemId (the port's primary-output rule). */
  primaryOutputId: string;
  inputs: BuilderIO[];
  outputs: BuilderIO[];
}

/**
 * One proposed stage: run `recipeId` in `machineCount` machines at 100% clock,
 * producing `outputRate` of the primary item. `outputRate = machineCount ×
 * primaryOutput.perMinute` — matches manifold's `totalOutput` at clock 100
 * exactly, so the built chain arrives self-consistent. `machineCount` is a
 * bigint (ceilDiv output); the apply narrows it to a safe-integer number.
 */
export interface ProposedStage {
  itemId: string;
  recipeId: string;
  machineCount: bigint;
  outputRate: Fraction;
}

/**
 * A directed feed between two proposed stages, keyed by ITEM. Two fields: the
 * flowing item ≡ `fromItemId` by construction (one-stage-per-item +
 * primary-output selection), so a separate itemId field would be redundant.
 * The apply maps `fromItemId`/`toItemId` to the fresh stage uuids and sets
 * `StageLink.itemId = fromItemId`.
 */
export interface ProposedLink {
  fromItemId: string;
  toItemId: string;
}

/** A rate against a named item (raw-input totals, byproduct surpluses). */
export interface ItemRate {
  itemId: string;
  rate: Fraction;
}

/**
 * The full proposal. `stages`/`links` build the graph; `rawInputs` are the
 * unlinked leaf feeds (ores, raw fluids, excluded forms) the chain expects from
 * extraction; `byproducts` are the non-primary outputs of proposed stages,
 * reported but never routed.
 */
export interface ChainProposal {
  stages: ProposedStage[];
  links: ProposedLink[];
  rawInputs: ItemRate[];
  byproducts: ItemRate[];
}

/**
 * Select the producer recipe for item X.
 *
 * An OVERRIDE is consulted first (Stage 8 / Phase 4, the comparison seam): if
 * `overrides` names a recipe for X AND that recipe primary-produces X, it IS
 * the producer — the isAlternate + machine-exclusion filters are BYPASSED (an
 * override is the user's explicit opt-in to a specific recipe, including an
 * alternate). An override that names an unknown recipe, or one whose primary
 * output is NOT X, is IGNORED — the selection falls back to the default policy,
 * so an invalid override never breaks totality. The cycle/self-consume guard at
 * the call site applies to whatever recipe is chosen here, override or not.
 *
 * Default policy (no applicable override): candidates are recipes with
 * `primaryOutputId === X`, `isAlternate === false`, and machine NOT in
 * `excludedMachineIds`. Multiple → the first by ascending recipe id
 * (deterministic). Zero → null (X is RAW).
 */
function selectProducer(
  itemId: string,
  recipes: BuilderRecipe[],
  excludedMachineIds: ReadonlySet<string>,
  overrides: ReadonlyMap<string, string>,
): BuilderRecipe | null {
  // Override consult: a validated named recipe wins over the default policy,
  // lifting the isAlternate/exclusion filters. Invalid (unknown id / non-primary)
  // falls through to the default scan below — validate-and-fall-back keeps the
  // solver total.
  const overrideId = overrides.get(itemId);
  if (overrideId !== undefined) {
    const named = recipes.find((r) => r.id === overrideId);
    if (named !== undefined && named.primaryOutputId === itemId) {
      return named;
    }
  }

  let chosen: BuilderRecipe | null = null;
  for (const r of recipes) {
    if (r.primaryOutputId !== itemId) continue;
    if (r.isAlternate) continue;
    if (excludedMachineIds.has(r.machineId)) continue;
    // Ascending recipe id: keep the lexicographically-smallest candidate.
    if (chosen === null || r.id < chosen.id) {
      chosen = r;
    }
  }
  return chosen;
}

/**
 * Internal per-item planning node built during the closure walk. `recipe` is
 * the selected producer (null ⇒ raw leaf); `demand` accumulates the summed
 * consumption across every consumer before the count is fixed.
 */
interface Plan {
  itemId: string;
  recipe: BuilderRecipe | null;
  demand: Fraction;
}

/**
 * Propose a complete chain for `targetItemId` at `rate` per minute.
 *
 * The algorithm is demand-driven with a two-pass shape so counts are only
 * ceil'd after demand is fully aggregated (the fan-in ordering constraint):
 *
 * 1. DFS the item DAG from the target, selecting a producer per item and wiring
 *    the closure + links (no counts yet). The DFS path item-set is the cycle
 *    guard: a candidate whose inputs revisit an on-path item is skipped (no
 *    further candidates modeled — single-producer selection means the next
 *    fallback is RAW; a guard hit is a SILENT demotion to raw).
 * 2. Size each produced item in consumers-first topological order: `count =
 *    ceilDiv(fully-summed demand, primaryOutput.perMinute)`. The CEIL'D
 *    consumption (`count × input.perMinute`) is what propagates into each
 *    input's demand, so every link arrives ok-or-surplus by construction (ceil
 *    only ever over-produces). Byproducts and raw leaves fall out of the finished
 *    plans.
 *
 * `overrides` (Stage 8 / Phase 4) is an optional itemId→recipeId map consulted
 * BEFORE the default producer policy at each item: a valid entry forces that
 * item's producer to the named recipe (alternate/excluded machines allowed);
 * an invalid entry is ignored (default policy applies). Absent/empty ⇒ the
 * proposal is byte-identical to the pre-P4 behavior.
 *
 * `rawItemIds` (S20 / P1) is an optional set of user-forced-raw item ids
 * consulted BEFORE producer selection at each item: a member (other than the
 * target — see below) is a raw leaf, exactly like a natural no-producer item —
 * its demand aggregates into `rawInputs` and its subtree never enters the
 * closure. Precedence is raw > override > default policy: raw is the stronger,
 * later user intent, so it wins over an override for the same item. **The
 * target is immune**: `targetItemId ∈ rawItemIds` is IGNORED (a chain that
 * produces nothing is not a chain) — the guard keeps the function total and the
 * UI honest, silently. Absent/empty ⇒ the proposal is byte-identical to the
 * pre-P1 behavior.
 *
 * Determinism: same target + rate + recipes + exclusions + overrides +
 * rawItemIds ⇒ identical proposal.
 */
export function proposeChain(
  targetItemId: string,
  rate: Fraction,
  recipes: BuilderRecipe[],
  excludedMachineIds: Iterable<string>,
  overrides: ReadonlyMap<string, string> = new Map(),
  rawItemIds: ReadonlySet<string> = new Set(),
): ChainProposal {
  const excluded = new Set(excludedMachineIds);
  // Every item that has appeared in the closure, produced or raw.
  const plans = new Map<string, Plan>();
  // Fixed machine count per produced item (sized consumers-first in phase 2).
  const counts = new Map<string, bigint>();
  const links: ProposedLink[] = [];
  // De-dup: one lane per (fromItem, toItem) pair — a defensive backstop should a
  // recipe ever list the same input item twice (real Docs.json doesn't). Keeps
  // the store's one-feed-lane-per-(to,itemId) invariant satisfied on the built
  // links by construction.
  const linkSeen = new Set<string>();

  /**
   * DFS walk (phase 1): resolve `itemId`'s producer, recurse into its inputs,
   * and record the closure + links. No counts here — sizing is deferred to the
   * consumers-first pass so a stage's demand is complete first. `path` is the
   * on-DFS item-set for the cycle guard. Returns the plan (recipe null ⇒ raw).
   */
  function visit(itemId: string, path: Set<string>): Plan {
    const existing = plans.get(itemId);
    if (existing !== undefined) {
      return existing;
    }

    // Forced-raw guard (S20 P1): a user-forced-raw item is a raw leaf BEFORE
    // any producer selection — its demand aggregates into rawInputs exactly
    // like a natural no-producer leaf, and its subtree never enters the
    // closure. Raw > override > default (raw is the later, stronger user
    // intent). The TARGET is immune: forcing the target raw would produce an
    // empty chain, so `targetItemId ∈ rawItemIds` is silently ignored (keeps
    // the function total).
    if (itemId !== targetItemId && rawItemIds.has(itemId)) {
      const plan: Plan = { itemId, recipe: null, demand: Fraction.from(0) };
      plans.set(itemId, plan);
      return plan;
    }

    // Cycle guard: if selecting a producer would route back onto the current
    // DFS path — INCLUDING the item itself (a self-consuming recipe would
    // otherwise emit a from===to link, bypassing addLink's self-link refusal
    // at apply) — demote to raw (silent — the item lands in rawInputs). With
    // converters/packagers excluded the bundled catalog is acyclic, so this is
    // a pinned backstop, not a common path.
    let recipe = selectProducer(itemId, recipes, excluded, overrides);
    if (
      recipe !== null &&
      recipe.inputs.some((io) => io.itemId === itemId || path.has(io.itemId))
    ) {
      recipe = null;
    }

    const plan: Plan = { itemId, recipe, demand: Fraction.from(0) };
    plans.set(itemId, plan);

    if (recipe === null) {
      // Raw leaf: no stage, no link, no recursion. Demand accrues from callers.
      return plan;
    }

    // The primary output's per-machine rate at 100% clock. Guaranteed present:
    // primaryOutputId === outputs[0].itemId by the catalog invariant, but read
    // defensively so a malformed recipe demotes to raw rather than throwing.
    const primary = recipe.outputs.find((o) => o.itemId === itemId);
    if (primary === undefined) {
      plan.recipe = null;
      return plan;
    }

    // Wire the DAG + recurse only — counts are fixed in the post-walk sizing
    // pass (topoOrderConsumersFirst below), so a stage's count is never fixed
    // before every consumer has contributed its demand (the fan-in rule).
    const nextPath = new Set(path);
    nextPath.add(itemId);
    for (const input of recipe.inputs) {
      const inputPlan = visit(input.itemId, nextPath);
      // A raw input (no producer stage) is left un-fed — no link, exactly like
      // a hand-built stage before its supply exists. Only produced inputs link.
      if (inputPlan.recipe === null) continue;
      const linkKey = `${input.itemId} ${itemId}`;
      if (!linkSeen.has(linkKey)) {
        linkSeen.add(linkKey);
        links.push({ fromItemId: input.itemId, toItemId: itemId });
      }
    }
    return plan;
  }

  // Phase 1: build the closure + producer selection + DAG edges (no counts yet).
  visit(targetItemId, new Set());

  // Phase 2: size each stage in consumers-first topological order. The target's
  // external demand is the requested rate; each produced item's count =
  // ceilDiv(its fully-summed demand, primaryPerMinute); that count's CEIL'D
  // input consumption then flows into each input's demand. Processing an item
  // only after every item that consumes it has been sized guarantees its demand
  // is complete before its count is fixed (the fan-in-before-ceil rule).

  // Seed the target's external demand.
  const target = plans.get(targetItemId)!;
  target.demand = target.demand.add(rate);

  const producedOrder = topoOrderConsumersFirst(targetItemId, plans);

  for (const itemId of producedOrder) {
    const plan = plans.get(itemId)!;
    if (plan.recipe === null) continue; // raw: no count, demand just totals.
    const primary = plan.recipe.outputs.find((o) => o.itemId === itemId)!;
    const count = plan.demand.ceilDiv(primary.perMinute);
    counts.set(itemId, count);
    // Propagate the CEIL'D consumption to each input's demand.
    const nCount = Fraction.from(count);
    for (const input of plan.recipe.inputs) {
      const consumed = nCount.mul(input.perMinute);
      const inPlan = plans.get(input.itemId)!;
      inPlan.demand = inPlan.demand.add(consumed);
    }
  }

  // Emit stages, raw inputs, byproducts from the finished plans.
  const stages: ProposedStage[] = [];
  const rawInputs: ItemRate[] = [];
  const byproducts: ItemRate[] = [];
  for (const [itemId, plan] of plans) {
    if (plan.recipe === null) {
      // Raw leaf: report its total demand (a stage only accrues demand if a
      // producer consumes it; the target-as-raw edge case still reports rate).
      rawInputs.push({ itemId, rate: plan.demand });
      continue;
    }
    const primary = plan.recipe.outputs.find((o) => o.itemId === itemId)!;
    const count = counts.get(itemId)!;
    const outputRate = Fraction.from(count).mul(primary.perMinute);
    stages.push({
      itemId,
      recipeId: plan.recipe.id,
      machineCount: count,
      outputRate,
    });
    // Byproducts: non-primary outputs, at the built rate. Reported, never routed.
    for (const out of plan.recipe.outputs) {
      if (out.itemId === itemId) continue;
      byproducts.push({
        itemId: out.itemId,
        rate: Fraction.from(count).mul(out.perMinute),
      });
    }
  }

  // Stable output order: ascending item id everywhere (deterministic on repeat).
  stages.sort((a, b) => cmp(a.itemId, b.itemId));
  rawInputs.sort((a, b) => cmp(a.itemId, b.itemId));
  byproducts.sort((a, b) => cmp(a.itemId, b.itemId));
  links.sort(
    (a, b) => cmp(a.fromItemId, b.fromItemId) || cmp(a.toItemId, b.toItemId),
  );

  return { stages, links, rawInputs, byproducts };
}

/** Lexicographic compare returning the -1/0/1 a sort comparator expects. */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Topological order of PRODUCED items such that every item precedes the items
 * it consumes (consumers-first). Sizing in this order guarantees a stage's
 * demand is complete before its count is fixed. Raw leaves are skipped (no
 * count). The DAG is guard-guaranteed acyclic, so a standard DFS post-order
 * (reversed) is a valid topological order.
 */
function topoOrderConsumersFirst(
  targetItemId: string,
  plans: Map<string, Plan>,
): string[] {
  const order: string[] = [];
  const visited = new Set<string>();
  function dfs(itemId: string): void {
    if (visited.has(itemId)) return;
    visited.add(itemId);
    const plan = plans.get(itemId);
    if (plan === undefined || plan.recipe === null) return;
    for (const input of plan.recipe.inputs) {
      dfs(input.itemId);
    }
    // Post-order push, then reverse → consumers before the items they consume.
    order.push(itemId);
  }
  dfs(targetItemId);
  order.reverse();
  return order;
}
