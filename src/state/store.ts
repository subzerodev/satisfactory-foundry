/**
 * The v1 app store: recipe selection + solver inputs, the catalog lifecycle,
 * and the eagerly-derived solve result. One Zustand vanilla store (headless-
 * testable) wrapped with a one-line React hook for Phase 4; unlocked tiers are
 * the only slice persisted (localStorage), via the persist middleware.
 *
 * Frozen design: features/manifold-visualizer/phase-3/{brainstorm,spec}.md.
 * The store adapts to the frozen data/core contracts (src/data/*,
 * src/core/manifold.ts) — never the reverse.
 */

import { createStore } from "zustand/vanilla";
import { useStore } from "zustand/react";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";

import { Fraction } from "../core/fraction.ts";
import { solveStage } from "../core/manifold.ts";
import type { StageSolveResult } from "../core/manifold.ts";
import { reconcileLinks } from "../core/reconcile.ts";
import type { LinkInput, LinkFinding } from "../core/reconcile.ts";
import { deriveLinkPlan } from "../core/link-plan.ts";
import { parseClockText } from "../core/clock.ts";
import type { ChainProposal } from "../core/chain-builder.ts";
import {
  canonicalizeLinkTransport,
  canonicalizePackagingInterstep,
  type LinkTransport,
  type PackagingInterstep,
} from "../core/link-transport.ts";
import type { Catalog } from "../data/types.ts";
import { TIER_TABLE } from "../data/tiers.ts";
import { parseCatalogFromText } from "../data/catalog.ts";
import { loadCatalog, saveCatalog } from "../data/catalog-store.ts";
import type { CatalogSource } from "../data/catalog-store.ts";
import { toStageInput } from "../data/stage-input.ts";
import type { StageOptions } from "../data/stage-input.ts";
import {
  savePlan as savePlanFile,
  listPlans as listPlanFiles,
  loadPlan as loadPlanFile,
  deletePlan as deletePlanFile,
  validatePlanFile,
} from "../data/plan-store.ts";
import type {
  PlanFileV8,
  PlanStageV7,
  PlanListEntry,
} from "../data/plan-store.ts";

// ---------------------------------------------------------------------------
// State shape (frozen brainstorm Axis 2)
// ---------------------------------------------------------------------------

export type CatalogState =
  | { status: "initializing" }
  | {
      status: "needs-upload";
      reason: "empty" | "stale" | "upload-error";
      message?: string;
    }
  | { status: "ready"; catalog: Catalog };

export interface Selection {
  recipeId: string | null;
  /** UI-facing integer, default 1. */
  machineCount: number;
  /** Raw user input; parsed at derive time. Default "100". */
  clockPercentText: string;
  /** Prefix count of unlocked tiers per kind; default the full table. */
  unlockedTiers: { belt: number; pipe: number };
  /** Per-belt capacity overrides as exact decimal strings; arrays ALWAYS dense
   *  (null-padded). Keyed by lane itemId. */
  overrides: {
    feeds: Record<string, (string | null)[]>;
    outputs: Record<string, (string | null)[]>;
  };
}

export type SolveState =
  | { status: "idle" }
  | { status: "solved"; result: StageSolveResult }
  | {
      status: "invalid";
      reason: "bad-clock" | "bad-machine-count" | "bad-override";
      detail: string;
    };

/**
 * One node in the stage graph. The v1 single-stage case IS a one-node graph.
 * `id` is a stable uuid (survives renames); `selection`/`solve` carry the
 * frozen v1 per-stage shapes, each stage solved eagerly with v1 semantics.
 */
export interface StageNode {
  id: string;
  name: string;
  selection: Selection;
  solve: SolveState;
  extraction?: Record<string, ExtractionSelection>;
}

export interface ExtractionSelection {
  machineId: string;
  clockPercentText: string;
  purityMix?: PurityMixText;
}

export interface PurityMixText {
  impure: string;
  normal: string;
  pure: string;
}

function copyExtractionSelection(
  selection: ExtractionSelection,
): ExtractionSelection {
  return {
    ...selection,
    ...(selection.purityMix ? { purityMix: { ...selection.purityMix } } : {}),
  };
}

/**
 * The flow-chart orientation (Stage 10 / Phase 1): "LR" lays the chain
 * left-to-right (today's implicit orientation, handles on the left/right edges),
 * "TB" top-to-bottom (handles on the top/bottom). Drives auto-placement + the
 * rendered handle sides; user-positioned nodes stay put across a switch.
 */
export type FlowDirection = "LR" | "TB";

/**
 * A directed item feed: `from`'s output belts of `itemId` feed `to`'s input
 * lane of `itemId`. Item-level, not belt-level (physical routing is Stage 4).
 * `transport` is OPTIONAL; absent ⇒ `mode: "belt"` (today's implicit default —
 * every existing link keeps its exact current meaning and rendering).
 */
export interface StageLink {
  id: string;
  fromStageId: string;
  itemId: string;
  toStageId: string;
  transport?: LinkTransport;
  interstep?: PackagingInterstep;
}

export type NewStageLink = Omit<StageLink, "id" | "interstep"> & {
  interstep?: never;
};

export interface ProposedByproductRoute {
  fromItemId: string;
  itemId: string;
  toItemId: string;
}

export interface ApplyChainProposalOptions {
  clockPercentText?: string;
  byproductRoutes?: ProposedByproductRoute[];
  catalog?: Catalog;
}

export interface AppState {
  catalog: CatalogState;
  /**
   * The stage graph (Stage 3 / Phase 1). `stages` is keyed by node id;
   * `stageOrder` is insertion order (canvas + list stability); `activeStageId`
   * is the stage the v1 UI edits — it ALWAYS resolves (removeStage moves the
   * cursor; the last stage can't be removed).
   */
  stages: Record<string, StageNode>;
  stageOrder: string[];
  activeStageId: string;
  links: StageLink[];
  /** Derived per-link reconciliation findings (see src/core/reconcile.ts). */
  reconciliation: LinkFinding[];
  /**
   * The link whose LinkInspector is open (Stage 7 / Phase 2), or null when none
   * is selected. Set by the canvas edge-select arm; cleared on deselect and when
   * the selected link is removed (a dangling id would open an empty inspector).
   */
  selectedLinkId: string | null;
  /**
   * Canvas node positions, keyed by stage id (Stage 3 / Phase 2). Session state
   * this phase — persisting them is Phase 3's plan-format decision (deferred,
   * mirroring the P1 links posture). `removeStage` prunes the removed id so no
   * orphan entries accumulate.
   */
  positions: Record<string, { x: number; y: number }>;
  /**
   * Monotonic auto-placement counter (never reused, immune to stageOrder
   * compaction). `addStage` maps the current value to a column-flow slot, then
   * increments. Never-reused means two auto-placed nodes cannot share a slot by
   * construction, so no collision handling is needed (frozen Axis 2 simplify).
   */
  placementSeq: number;
  /**
   * The flow-chart orientation (Stage 10 / Phase 1), default "LR". Persists
   * per-plan in the current file (orientation is a property of the drawing, like
   * positions); a switch re-slots every NON-userPlaced stage + flips the handle
   * sides. The store stays window-free — the plan file is its only persistence.
   */
  flowDirection: FlowDirection;
  /**
   * The set of stage ids the user hand-dragged (Stage 10 / Phase 1). `true`-valued
   * membership only; set by `setStagePosition` (the drag-END commit), pruned with
   * the stage on remove, and seeded from the required per-stage boolean. Legacy
   * migration materializes the original position-based intent before rebuild. A
   * direction switch re-slots only NON-members; save writes the required boolean
   * because position presence alone cannot distinguish auto from user placement.
   */
  userPlaced: Record<string, true>;
  /**
   * The active stage's selection/solve, MIRRORED at top level so the frozen v1
   * UI + the existing store suite read `selection`/`solve` unchanged. Kept
   * byte-identical to `stages[activeStageId]` after every mutation; the
   * `activeSelection`/`activeSolve` selectors are the canonical read path.
   */
  selection: Selection;
  solve: SolveState;
  /**
   * Provenance of the current 'ready' catalog: null until it resolves, then
   * { kind: 'user' } for an upload or { kind: 'bundled', … } for the bundled
   * snapshot. A sibling field, orthogonal to the frozen CatalogState union —
   * it drives the ticket #9 provenance banner (bundled only).
   */
  catalogSource: CatalogSource | null;
  /**
   * Transient last upload/persist failure while a working catalog stayed
   * 'ready'; cleared on the next upload attempt. Fresh-boot upload failure
   * (no prior catalog) lands in needs-upload{'upload-error'} instead — the two
   * cases are DISJOINT by construction.
   */
  uploadError: string | null;
  /**
   * The saved-plan list — a DISPLAY CACHE only, refreshed after every plan
   * mutation. null = not-yet-listed (transient: App refreshes on ready-mount);
   * [] = listed, none. Name→id lookups NEVER read this (it's nullable/stale) —
   * they read a fresh listPlans() at op time (ticket #11 uniqueness mechanism).
   */
  plans: PlanListEntry[] | null;
  /**
   * Transient last plan-op failure, mirroring uploadError's posture (set by a
   * failed plan op, cleared at the next plan op). Kept SEPARATE from
   * uploadError, whose semantics are catalog-specific.
   */
  planError: string | null;
  /**
   * User-global Propose preferences (S20 P3, ticket #102) — persisted beside
   * `unlockedTiers`, and the SEED for ChainBuilder's component-local controls
   * (which remain the live per-run truth; these are the seed + the sink).
   *
   * Deliberately NOT per-plan: the ticket's framing is "applied to every future
   * Propose", so they are a property of the USER, not of the open plan.
   */
  proposePrefs: ProposePrefs;
}

/**
 * The persisted Propose preferences. Only these three: raw markings are a
 * per-plan boundary intent ("I make this elsewhere" — about a factory, not the
 * user) and the clock is a per-run target, so both stay ephemeral.
 */
export interface ProposePrefs {
  /** Item id → chosen recipe id. Stale ids need no validation — the core's
   *  validate-and-ignore totality makes them inert (P1 frozen). */
  overrides: Record<string, string>;
  /** Machine ids the proposer may not use. An EMPTY array is a legitimate
   *  user choice (both defaults unchecked), distinct from an absent field. */
  excludedMachineIds: string[];
  /** The propose tier gate: `null` = "all" (no gating, the default and the
   *  byte-stable pre-P3 behavior); otherwise recipes whose min unlock tier
   *  exceeds it are filtered out of the propose world. */
  unlockedTier: number | null;
}

export interface Actions {
  init(): Promise<void>;
  uploadDocsText(text: string): Promise<void>;
  selectRecipe(recipeId: string | null): void;
  setMachineCount(n: number): void;
  /** Set a NAMED stage's machine count + re-derive (the active mirror is
   *  preserved unless that stage is active). The apply affordance's writer —
   *  targets the under-supplied link's PRODUCER, which is often not active. */
  setStageMachineCount(stageId: string, n: number): void;
  /** Swap a NAMED stage's recipe AND resize its machine count in ONE atomic
   *  write + re-derive (Stage 8 / Phase 4, the alt-recipe apply). No existing
   *  action writes recipeId + machineCount together; a two-step
   *  selectRecipe-then-count would derive an intermediate wrong-sized state.
   *  Clears lane overrides (they address the OLD recipe's items — selectRecipe's
   *  posture); preserves clock + tiers. Unknown stageId is a no-op. */
  applyRecipeSwap(
    stageId: string,
    recipeId: string,
    machineCount: number,
  ): void;
  setClockPercentText(text: string): void;
  setUnlockedTiers(t: { belt: number; pipe: number }): void;
  /** Partial-update the persisted Propose preferences (S20 P3). ChainBuilder
   *  mirrors each control change here from the same handler that re-proposes. */
  setProposePrefs(patch: Partial<ProposePrefs>): void;
  setOverride(
    side: "feeds" | "outputs",
    itemId: string,
    beltIndex: number,
    capacityText: string | null,
  ): void;
  clearOverrides(): void;
  setExtractionSelection(
    stageId: string,
    itemId: string,
    selection: ExtractionSelection | null,
  ): void;
  // Graph actions (Stage 3 / Phase 1) — all synchronous (no IDB this phase):
  // mutate-then-recompute, no plan-op chain.
  addStage(): void;
  removeStage(id: string): void;
  renameStage(id: string, name: string): void;
  setActiveStage(id: string): void;
  addLink(link: NewStageLink): void;
  removeLink(id: string): void;
  /** Set a link's transport config (mode + trip). Absent-`transport` ⇒ belt
   *  default, so passing `{ mode: "belt" }` and clearLinkTransport are
   *  equivalent; both restore the default rendering. */
  setLinkTransport(linkId: string, transport: LinkTransport): void;
  /** Clear a link's transport config back to the belt default (drops the key). */
  clearLinkTransport(linkId: string): void;
  setLinkInterstep(linkId: string, interstep: PackagingInterstep | null): void;
  /** Open the LinkInspector for a link (null closes it). */
  selectLink(linkId: string | null): void;
  setStagePosition(id: string, pos: { x: number; y: number }): void;
  /**
   * Set the flow-chart orientation (Stage 10 / Phase 1). Same-direction is a
   * no-op. Otherwise writes `flowDirection` and re-slots every NON-userPlaced
   * stage to its order-index slot in the new direction (a pure position write —
   * no derive, no reconciliation; positions are presentation). userPlaced stages
   * keep their exact positions; re-slotted stages are NOT marked userPlaced.
   */
  setFlowDirection(dir: FlowDirection): void;
  /**
   * Apply an auto-chain proposal (Stage 8 / Phase 3): APPEND its stages/links to
   * the current graph with fresh uuids, then derive + reconcile + mirror. The
   * proposal's target stage becomes active. Existing stages/links are untouched
   * (append-only, collision-free by construction — all new links are between
   * fresh ids). An empty proposal (no stages) is a no-op.
   *
   * `clockPercentText` (S20 P2) seeds every applied stage's per-stage clock —
   * the raw user text validated at propose time (e.g. "150"), preserving the
   * user-intent-text idiom. The applied graph then solves each stage at that
   * clock natively (existing per-stage clock support). Defaults to "100".
   */
  applyChainProposal(
    proposal: ChainProposal,
    options?: ApplyChainProposalOptions,
  ): void;
  refreshPlans(): Promise<void>;
  savePlanAs(name: string): Promise<void>;
  loadPlan(id: string): Promise<void>;
  renamePlan(id: string, name: string): Promise<void>;
  deletePlan(id: string): Promise<void>;
  /** Serialize a stored plan (migrated to v8) as pretty JSON, or null if the
   *  row is missing/corrupt. Headless — App owns the Blob/anchor download. */
  exportPlan(id: string): Promise<string | null>;
  /** Validate + save an exported plan file's text under the save-over model.
   *  Sniffs a bundle envelope (Stage 19 / #92) and imports every entry, else
   *  the single-file arm. Never auto-loads (the live graph is untouched).
   *  Failures → planError. */
  importPlan(text: string): Promise<void>;
  /** Serialize EVERY stored plan as one re-importable bundle (Stage 19 / #92),
   *  or null when no plans exist. Reads all rows inside one enqueue slot for a
   *  consistent point-in-time snapshot. Headless — App owns the download. */
  exportAllPlans(): Promise<string | null>;
}

export type Store = AppState & Actions;

/**
 * Stage 19 (#92): the export-all bundle envelope. A distinct `kind` string makes
 * single-file-vs-bundle sniffing exact (a per-plan file has no `kind`), and
 * `format_version` reserves bundle evolution independently of the per-plan file
 * versions. Each `plans[]` entry is EXACTLY a per-plan file object (latest v8 as
 * written by exportPlan's source), revived on import through the SAME
 * `validatePlanFile` path — one migration surface, no second format to version.
 */
export interface PlanBundle {
  kind: "foundry-plan-bundle";
  format_version: 1;
  exportedAt: string; // ISO
  plans: PlanFileV8[];
}

/** The sniff constant (Axis 3): import branches to the bundle arm iff a parsed
 *  object carries this exact `kind`. */
const PLAN_BUNDLE_KIND = "foundry-plan-bundle";

/** Sniff a parsed value as a bundle envelope by its `kind` (Axis 3): a per-plan
 *  file has no `kind` field, so the sniff cannot misfire. Entry validation is
 *  the bundle arm's job (via `validatePlanFile` per entry) — this only routes. */
function isPlanBundle(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as Record<string, unknown>).kind === PLAN_BUNDLE_KIND
  );
}

// ---------------------------------------------------------------------------
// Active-stage selectors — the canonical v1 read path (Stage 3 / Phase 1)
// ---------------------------------------------------------------------------

/** The active stage's selection (== the top-level mirror, kept identical). */
export function activeSelection(s: AppState): Selection {
  return s.selection;
}

/** The active stage's solve (== the top-level mirror, kept identical). */
export function activeSolve(s: AppState): SolveState {
  return s.solve;
}

// ---------------------------------------------------------------------------
// Defaults (frozen spec §Defaults)
// ---------------------------------------------------------------------------

function defaultSelection(): Selection {
  return {
    recipeId: null,
    machineCount: 1,
    clockPercentText: "100",
    unlockedTiers: {
      belt: TIER_TABLE.belt.length,
      pipe: TIER_TABLE.pipe.length,
    },
    overrides: { feeds: {}, outputs: {} },
  };
}

/** A fresh default stage node ("Stage N"), solve idle until derived. */
function defaultStage(name: string): StageNode {
  return {
    id: crypto.randomUUID(),
    name,
    selection: defaultSelection(),
    solve: { status: "idle" },
  };
}

// ---------------------------------------------------------------------------
// Derivation (frozen brainstorm Axis 3)
// ---------------------------------------------------------------------------

/**
 * Densify + parse one side's override strings into the solver's
 * `(Fraction | null)[]` shape. Arrays are already dense (null-padded) by
 * setOverride, but holes/null map to null defensively; a malformed capacity
 * string throws (routed to `invalid 'bad-override'` by the caller).
 */
function parseOverrideSide(
  side: Record<string, (string | null)[]>,
): Record<string, (Fraction | null)[]> {
  const out: Record<string, (Fraction | null)[]> = {};
  for (const [itemId, arr] of Object.entries(side)) {
    const parsed: (Fraction | null)[] = [];
    for (let i = 0; i < arr.length; i++) {
      const cell = arr[i] ?? null;
      // A malformed string throws here — Fraction.parse rejects it — and the
      // derive() catch routes it to 'bad-override'.
      if (cell === null) {
        parsed[i] = null;
        continue;
      }
      const value = Fraction.parse(cell);
      if (value.isNegative()) {
        throw new RangeError(
          `lane ${itemId} override ${i + 1} must be zero or positive; got ${value.toString()}.`,
        );
      }
      parsed[i] = value;
    }
    out[itemId] = parsed;
  }
  return out;
}

/**
 * Compute `solve` from `catalog` + `selection`. Pure over the passed state:
 * every mutating action applies its change fully, then calls this once, so
 * derive never observes an intermediate state.
 */
function derive(catalog: CatalogState, selection: Selection): SolveState {
  // No catalog, no recipeId, or a dangling id (recipe absent from the current
  // catalog) → idle. The dangling-id guard is belt-and-braces: re-upload
  // re-validation already resets a dropped recipeId to null.
  if (catalog.status !== "ready" || selection.recipeId === null) {
    return { status: "idle" };
  }
  const recipe = catalog.catalog.recipes[selection.recipeId];
  if (recipe === undefined) {
    return { status: "idle" };
  }

  // Clock text → Fraction in [1, 250], or 'bad-clock'. parseClockText is the
  // single owner of the clock range (ticket #143) — the derive must accept and
  // reject exactly what the chain builder and extraction panel do.
  const clockResult = parseClockText(selection.clockPercentText);
  if (!clockResult.ok) {
    return {
      status: "invalid",
      reason: "bad-clock",
      detail: `${clockResult.error}; got ${JSON.stringify(selection.clockPercentText)}.`,
    };
  }
  const clockPercent = clockResult.value;

  // machineCount: non-negative safe integer. 0 is VALID (solver-degenerate).
  if (
    !Number.isSafeInteger(selection.machineCount) ||
    selection.machineCount < 0
  ) {
    return {
      status: "invalid",
      reason: "bad-machine-count",
      detail: `machine count must be a non-negative integer; got ${selection.machineCount}.`,
    };
  }

  // Densify + parse overrides; a malformed capacity string → 'bad-override'.
  let overrides: StageOptions["overrides"];
  try {
    overrides = {
      feeds: parseOverrideSide(selection.overrides.feeds),
      outputs: parseOverrideSide(selection.overrides.outputs),
    };
  } catch (err) {
    return {
      status: "invalid",
      reason: "bad-override",
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  // Build opts → toStageInput. Its SHAPE throws (unknown override key,
  // duplicate lane; tier-range is unreachable — clamped at the setter) →
  // 'bad-override'. Then solveStage: count-excess overrides surface as a
  // solver VALUE finding INSIDE result, i.e. 'solved' — the routing split.
  try {
    const input = toStageInput(recipe, catalog.catalog, {
      machineCount: selection.machineCount,
      clockPercent,
      unlockedTiers: selection.unlockedTiers,
      overrides,
    });
    return { status: "solved", result: solveStage(input) };
  } catch (err) {
    return {
      status: "invalid",
      reason: "bad-override",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Graph recompute helpers (Stage 3 / Phase 1) — pure over the state slice.
// Actions mutate stages/links, then compose these to re-derive solves + the
// top-level active mirror + reconciliation, so no action observes a half-state.
// ---------------------------------------------------------------------------

/** The subset of AppState these helpers read/rewrite. */
type GraphSlice = Pick<
  AppState,
  | "catalog"
  | "stages"
  | "stageOrder"
  | "activeStageId"
  | "links"
  | "reconciliation"
  | "positions"
  | "flowDirection"
  | "userPlaced"
  | "selection"
  | "solve"
  | "selectedLinkId"
>;

/** Re-derive one stage's solve against the current catalog (v1 semantics). */
function deriveStage(catalog: CatalogState, stage: StageNode): StageNode {
  return { ...stage, solve: derive(catalog, stage.selection) };
}

/**
 * Mirror the active stage's selection/solve up to the top-level fields the v1
 * UI + the store suite read. Called after any mutation that could change which
 * stage is active or the active stage's contents.
 */
function mirrorActive(slice: GraphSlice): GraphSlice {
  const active = slice.stages[slice.activeStageId]!;
  return { ...slice, selection: active.selection, solve: active.solve };
}

/**
 * Map the current graph to reconcile inputs: for each link, look up the
 * producer's totalOutput and the consumer's totalDemand for the flowing item
 * (a lookup, never math). A missing stage / non-solved stage / absent lane →
 * null (surfaces as dangling-link). Order follows `links` for determinism.
 */
function mapLinkInputs(slice: GraphSlice): LinkInput[] {
  return slice.links.map((link) => {
    const from = slice.stages[link.fromStageId];
    const to = slice.stages[link.toStageId];
    const supply =
      from !== undefined && from.solve.status === "solved"
        ? (from.solve.result.outputs.find((o) => o.itemId === link.itemId)
            ?.totalOutput ?? null)
        : null;
    const demand =
      to !== undefined && to.solve.status === "solved"
        ? (to.solve.result.feeds.find((f) => f.itemId === link.itemId)
            ?.totalDemand ?? null)
        : null;
    let interstepProblem: string | null = null;
    if (link.interstep !== undefined) {
      if (slice.catalog.status !== "ready") {
        interstepProblem = "packaging catalog is unavailable";
      } else {
        const plan = deriveLinkPlan(slice.catalog.catalog, link, slice.stages);
        interstepProblem = plan.status === "unavailable" ? plan.error : null;
      }
    }
    return { linkId: link.id, supply, demand, interstepProblem };
  });
}

/** Recompute reconciliation from the current stage solves + links. */
function recomputeReconciliation(slice: GraphSlice): GraphSlice {
  return { ...slice, reconciliation: reconcileLinks(mapLinkInputs(slice)) };
}

/**
 * Write a new selection into a NAMED stage, re-derive that stage, mirror the
 * ACTIVE stage up, and recompute reconciliation. The single-stage-mutation path
 * used by the six v1 setters + loadPlan (active-keyed, via applyActiveSelection)
 * and by setStageMachineCount (any stage — the apply affordance's producer).
 *
 * mirrorActive stays ACTIVE-keyed by design: the top-level mirror always tracks
 * the active stage, never the mutated one — writing a non-active producer must
 * not steal the active mirror (frozen S8P1 proof). When stageId === activeStageId
 * the two coincide, which is exactly the active-setter case.
 */
function applyStageSelection(
  slice: GraphSlice,
  stageId: string,
  next: Selection,
): GraphSlice {
  const target = slice.stages[stageId]!;
  const stage = deriveStage(slice.catalog, { ...target, selection: next });
  const stages = { ...slice.stages, [stage.id]: stage };
  return recomputeReconciliation(mirrorActive({ ...slice, stages }));
}

/**
 * Write a new selection into the ACTIVE stage, re-derive that stage, mirror it
 * up, and recompute reconciliation. The single-stage-mutation path used by the
 * six v1 setters + loadPlan — the activeStageId case of applyStageSelection.
 */
function applyActiveSelection(slice: GraphSlice, next: Selection): GraphSlice {
  return applyStageSelection(slice, slice.activeStageId, next);
}

/**
 * Re-derive EVERY stage against the current catalog, mirror the active stage
 * up, and recompute reconciliation. The multi-stage-derive path (cadence
 * table): setUnlockedTiers (tiers-global), uploadDocsText parse-success, init.
 * `mapSelection` optionally rewrites each stage's selection first — the #5
 * treatment (recipeId re-validation + override clear) on upload passes it;
 * setUnlockedTiers passes the all-stages tier write; init passes identity.
 */
function deriveAllStages(
  slice: GraphSlice,
  mapSelection: (sel: Selection) => Selection,
): GraphSlice {
  const stages: Record<string, StageNode> = {};
  for (const id of Object.keys(slice.stages)) {
    const node = slice.stages[id]!;
    stages[id] = deriveStage(slice.catalog, {
      ...node,
      selection: mapSelection(node.selection),
    });
  }
  return recomputeReconciliation(mirrorActive({ ...slice, stages }));
}

/**
 * Whole-graph replacement from a loaded `PlanFileV8` (Stage 3 / Phase 3, frozen
 * Axis 4; Stage 10 / Phase 1 adds direction + userPlaced). Builds a fresh graph —
 * new stage/link uuids — and applies the frozen load treatments per stage:
 *
 * - machineCount `null → NaN` (plans persist via IDB structured clone, which
 *   keeps a live NaN — the null edge arises from hand-authored/imported/legacy
 *   JSON files, and isSelectionShape accepts it; such a stage must load
 *   rendered-invalid, matching the single-stage coercion this replaces);
 * - the CURRENT global unlockedTiers are stamped over every stage (tiers are
 *   progression, not plan content — the file's stored tiers are dead-on-read);
 * - recipeId re-validated against the current catalog (absent → null); overrides
 *   apply VERBATIM (the load posture — the #5 override-CLEAR is upload-only);
 * - positions from the file entry, else the auto-slot for the entry's index (in
 *   the FILE's direction — a v1-migrated positionless stage must slot per the
 *   orientation the file was saved in);
 * - flowDirection restored from the file (v1-v4 migration defaults to "LR"); userPlaced
 *   read directly from v8's required boolean. Legacy migration materializes the
 *   conservative original-position rule before this rebuild, so no transient
 *   source-version flag is needed;
 * - stageOrder = array order; links rebuilt from indices; placementSeq =
 *   stages.length; activeStageId = first (matches removeStage's cursor-to-first).
 *
 * Links are NOT pruned by recipe re-validation: a link whose endpoint went
 * recipe-less flags as dangling (frozen P1), never silently dropped. The final
 * deriveAllStages overwrites the seeded-idle solves + recomputes reconciliation;
 * mirrorActive re-points the top-level v1 mirror.
 */
function rebuildFromPlan(
  slice: GraphSlice,
  plan: PlanFileV8,
): GraphSlice & { placementSeq: number } {
  const { catalog } = slice;
  // Current global tiers (the active mirror holds the canonical global value).
  const globalTiers = slice.selection.unlockedTiers;
  const ids = plan.stages.map(() => crypto.randomUUID());
  const stages: Record<string, StageNode> = {};
  const stageOrder: string[] = [];
  const positions: Record<string, { x: number; y: number }> = {};
  const userPlaced: Record<string, true> = {};
  plan.stages.forEach((entry, i) => {
    const id = ids[i]!;
    const saved = entry.selection;
    const recipeId =
      saved.recipeId !== null &&
      catalog.status === "ready" &&
      catalog.catalog.recipes[saved.recipeId] !== undefined
        ? saved.recipeId
        : null;
    const machineCount = saved.machineCount === null ? NaN : saved.machineCount;
    const selection: Selection = {
      recipeId,
      machineCount,
      clockPercentText: saved.clockPercentText,
      unlockedTiers: { ...globalTiers },
      overrides: saved.overrides,
    };
    const extraction: Record<string, ExtractionSelection> = Object.create(null);
    for (const [itemId, savedSelection] of Object.entries(
      entry.extraction ?? {},
    )) {
      extraction[itemId] = { ...savedSelection };
    }
    stages[id] = {
      id,
      name: entry.name,
      selection,
      solve: { status: "idle" },
      ...(Object.keys(extraction).length > 0 ? { extraction } : {}),
    };
    stageOrder.push(id);
    // Positionless entries (v1-migrated) auto-slot in the FILE's direction; a
    // saved position restores exactly. The fallback direction is plan-level.
    positions[id] = entry.position ?? placementSlot(i, plan.flowDirection);
    // Validation always returns v8; legacy migration has already materialized
    // placement origin into this required boolean.
    if (entry.userPlaced) userPlaced[id] = true;
  });
  const links: StageLink[] = plan.links.map((l) => ({
    id: crypto.randomUUID(),
    fromStageId: ids[l.from]!,
    toStageId: ids[l.to]!,
    itemId: l.itemId,
    // Transport payload carries verbatim from the file (raw user text — the
    // Selection precedent); absent ⇒ belt default. Fresh link ids, so the prior
    // inspector selection is stale — reset below.
    ...(l.transport !== undefined ? { transport: l.transport } : {}),
    ...(l.interstep !== undefined
      ? {
          interstep: {
            ...l.interstep,
            returnTransport: l.interstep.returnTransport,
          },
        }
      : {}),
  }));
  const rebuilt: GraphSlice = {
    ...slice,
    stages,
    stageOrder,
    links,
    positions,
    flowDirection: plan.flowDirection,
    userPlaced,
    activeStageId: ids[0]!,
    selectedLinkId: null,
  };
  // deriveAllStages overwrites the seeded-idle solves, mirrors the active stage,
  // and recomputes reconciliation — the full-recompute cadence for a
  // state-replacing mutation. placementSeq re-seeds to the next fresh slot.
  return {
    ...deriveAllStages(rebuilt, (sel) => sel),
    placementSeq: plan.stages.length,
  };
}

/**
 * Narrow a proposed stage's bigint machineCount to a Selection's safe-integer
 * number, THROWING (never truncating) past MAX_SAFE_INTEGER — the manifold
 * `toIndex` precedent. An implausibly-large proposal is a hard error, not a
 * silently-corrupted plan.
 */
function machineCountToNumber(count: bigint): number {
  if (count > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(
      `applyChainProposal: machine count ${count} exceeds ` +
        "Number.MAX_SAFE_INTEGER; proposal is implausibly large.",
    );
  }
  return Number(count);
}

/**
 * Apply an auto-chain proposal (Stage 8 / Phase 3, frozen Axis 5) by APPENDING
 * its stages/links to the current graph — the rebuildFromPlan composition, made
 * additive. Each proposed stage gets a fresh uuid, a name from its recipe's
 * display name, a consecutive placementSlot, and a Selection seeded from the
 * ACTIVE stage's tiers (the tiers-global invariant — addStage's own rule) with
 * clock "100" + empty overrides. Links map the proposal's item keys to the fresh
 * uuids (StageLink.itemId === fromItemId). Then ONE deriveAllStages +
 * reconciliation + mirrorActive; the proposal's target stage becomes active.
 *
 * Append-only ⇒ collision-free: every new link is between fresh ids, so no
 * `(toStageId, itemId)` clash with an existing link is possible, and one stage
 * per proposed item forbids duplicate lanes internally. An empty proposal (no
 * stages) is a no-op — returns the slice unchanged with its placementSeq.
 */
function applyProposalToSlice(
  slice: GraphSlice,
  placementSeq: number,
  proposal: ChainProposal,
  options: ApplyChainProposalOptions,
): GraphSlice & { placementSeq: number } {
  if (proposal.stages.length === 0) {
    return { ...slice, placementSeq };
  }
  const { catalog } = slice;
  const recipeDisplayName = (recipeId: string): string =>
    catalog.status === "ready"
      ? (catalog.catalog.recipes[recipeId]?.displayName ?? recipeId)
      : recipeId;
  // Tiers seed from the active stage (the canonical global tiers value).
  const globalTiers = slice.selection.unlockedTiers;
  const clockPercentText = options.clockPercentText ?? "100";

  // Fresh uuid per proposed item, keyed by item id (links resolve through this).
  const idByItem = new Map<string, string>();
  for (const stage of proposal.stages) {
    idByItem.set(stage.itemId, crypto.randomUUID());
  }

  const stages: Record<string, StageNode> = { ...slice.stages };
  const stageOrder = [...slice.stageOrder];
  const positions: Record<string, { x: number; y: number }> = {
    ...slice.positions,
  };
  let seq = placementSeq;
  for (const stage of proposal.stages) {
    const id = idByItem.get(stage.itemId)!;
    const selection: Selection = {
      recipeId: stage.recipeId,
      machineCount: machineCountToNumber(stage.machineCount),
      // S20 P2: seed the propose-time clock (was hardcoded "100"). The proposal
      // was solved at this clock, so the applied graph re-solves each stage at
      // the same clock and the two agree.
      clockPercentText,
      unlockedTiers: { ...globalTiers },
      overrides: { feeds: {}, outputs: {} },
    };
    stages[id] = {
      id,
      name: recipeDisplayName(stage.recipeId),
      selection,
      solve: { status: "idle" },
    };
    stageOrder.push(id);
    // Consecutive monotonic slots in the current direction — never reused, so no
    // collision handling. Appended stages are auto-placed (not userPlaced).
    positions[id] = placementSlot(seq, slice.flowDirection);
    seq += 1;
  }

  // Links: item keys → fresh stage uuids. Both ends are proposed items (raw
  // leaves emit no link), so both ids resolve. StageLink.itemId === fromItemId.
  const newLinks: StageLink[] = proposal.links.map((l) => ({
    id: crypto.randomUUID(),
    fromStageId: idByItem.get(l.fromItemId)!,
    toStageId: idByItem.get(l.toItemId)!,
    itemId: l.fromItemId,
  }));
  const usedTargetLanes = new Set(
    newLinks.map((l) => `${l.toStageId} ${l.itemId}`),
  );
  const usedSourceOutputs = new Set<string>();
  const catalogSnapshot = options.catalog;
  if (catalogSnapshot !== undefined) {
    for (const route of options.byproductRoutes ?? []) {
      const fromStage = proposal.stages.find(
        (stage) => stage.itemId === route.fromItemId,
      );
      const toStage = proposal.stages.find(
        (stage) => stage.itemId === route.toItemId,
      );
      if (fromStage === undefined || toStage === undefined) continue;
      const fromId = idByItem.get(route.fromItemId);
      const toId = idByItem.get(route.toItemId);
      if (fromId === undefined || toId === undefined || fromId === toId) {
        continue;
      }
      const fromRecipe = catalogSnapshot.recipes[fromStage.recipeId];
      const toRecipe = catalogSnapshot.recipes[toStage.recipeId];
      if (fromRecipe === undefined || toRecipe === undefined) continue;
      if (!fromRecipe.outputs.some((o) => o.itemId === route.itemId)) continue;
      if (!toRecipe.inputs.some((i) => i.itemId === route.itemId)) continue;
      const targetKey = `${toId} ${route.itemId}`;
      if (usedTargetLanes.has(targetKey)) continue;
      const sourceKey = `${fromId} ${route.itemId}`;
      if (usedSourceOutputs.has(sourceKey)) continue;
      const link: StageLink = {
        id: crypto.randomUUID(),
        fromStageId: fromId,
        toStageId: toId,
        itemId: route.itemId,
      };
      newLinks.push(link);
      usedTargetLanes.add(targetKey);
      usedSourceOutputs.add(sourceKey);
    }
  }

  // Target stage becomes active (focus lands on the user's intent). The proposal
  // doesn't carry the target id, but the target is the unique produced item that
  // no link consumes: every other produced item is in the closure ONLY because
  // some stage consumes it (so it appears as a link's fromItemId), while the
  // target is the sole sink. The `?? stages[0]` fallback is belt-and-braces for
  // a degenerate single-stage proposal with no links.
  const consumedItems = new Set(proposal.links.map((l) => l.fromItemId));
  const targetStage =
    proposal.stages.find((s) => !consumedItems.has(s.itemId)) ??
    proposal.stages[0]!;
  const activeStageId = idByItem.get(targetStage.itemId)!;

  const appended: GraphSlice = {
    ...slice,
    stages,
    stageOrder,
    positions,
    links: [...slice.links, ...newLinks],
    activeStageId,
    selectedLinkId: null,
  };
  return {
    ...deriveAllStages(appended, (sel) => sel),
    placementSeq: seq,
  };
}

// ---------------------------------------------------------------------------
// Canvas helpers (Stage 3 / Phase 2)
// ---------------------------------------------------------------------------

/**
 * The auto-placement slot a monotonic placement sequence maps to, oriented by
 * `dir` (Stage 10 / Phase 1). LR keeps today's grid — four COLUMNS 260px apart,
 * rows 140px apart, reading right-then-wrap. TB transposes it — four ROWS 140px
 * apart, columns 260px apart, so a growing chain flows downward. Never-reused seq
 * → no two auto-placed nodes share a slot, so no collision handling.
 */
function placementSlot(
  seq: number,
  dir: FlowDirection,
): { x: number; y: number } {
  if (dir === "TB") {
    return {
      x: 40 + Math.floor(seq / 4) * 260,
      y: 40 + (seq % 4) * 140,
    };
  }
  return {
    x: 40 + (seq % 4) * 260,
    y: 40 + Math.floor(seq / 4) * 140,
  };
}

/**
 * Pure READ mirror of `addLink`'s hard refusals (Stage 3 / Phase 2): "ok" when
 * the link would be accepted, "self" for a self-link, "duplicate" for an
 * existing (toStageId, itemId) feed lane. The canvas consults this to surface a
 * notice BEFORE calling addLink; the enforcement itself stays in addLink.
 *
 * canLink and addLink MUST stay in lockstep — a drift degrades only to a stale
 * notice (never a bad write), since addLink remains the sole enforcer, but the
 * two refusal sets are meant to be identical. Any change to addLink's refusals
 * must be mirrored here (and vice versa).
 */
export function canLink(
  links: StageLink[],
  from: string,
  to: string,
  itemId: string,
): "ok" | "self" | "duplicate" {
  if (from === to) return "self";
  const duplicate = links.some(
    (l) => l.toStageId === to && l.itemId === itemId,
  );
  if (duplicate) return "duplicate";
  return "ok";
}

function isIllegalPackagedTransport(
  transport: LinkTransport | undefined,
): boolean {
  return transport?.mode === "pipe" || transport?.mode === "fluid-truck";
}

function currentLinkItem(
  catalog: CatalogState,
  link: StageLink,
): { isFluid: boolean } | undefined {
  return catalog.status === "ready"
    ? catalog.catalog.items[link.itemId]
    : undefined;
}

function linkWithoutInterstep(
  link: StageLink,
  item: { isFluid: boolean } | undefined,
): StageLink {
  return {
    id: link.id,
    fromStageId: link.fromStageId,
    itemId: link.itemId,
    toStageId: link.toStageId,
    ...(item !== undefined
      ? { transport: { mode: item.isFluid ? "pipe" : "belt" } as LinkTransport }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Persistence (frozen brainstorm Axis 5)
// ---------------------------------------------------------------------------

/** localStorage key for the persisted tiers slice (v1). */
const PERSIST_KEY = "satis_foundry:tiers";

/** The persisted projection: `{ unlockedTiers, proposePrefs }` (S20 P3 widened
 *  this from tiers alone; the localStorage key is unchanged). */
interface PersistedShape {
  unlockedTiers: { belt: number; pipe: number };
  proposePrefs: ProposePrefs;
}

/**
 * The default Propose preferences: no overrides, today's converter/packager
 * exclusions, no tier gate — i.e. byte-identical to pre-P3 Propose.
 *
 * The exclusion ids are duplicated from `EXCLUDED_MACHINE_IDS`
 * (src/ui/chain-builder-adapter.ts) rather than imported: the store is a lower
 * layer than the UI and imports nothing from it. store.test.ts pins the two
 * lists equal, so the duplication cannot drift silently.
 */
function defaultProposePrefs(): ProposePrefs {
  return {
    overrides: {},
    excludedMachineIds: ["converter", "packager"],
    unlockedTier: null,
  };
}

/**
 * Validate persisted Propose preferences on read — the `clampTier` discipline
 * applied per field: a field whose container is the wrong shape falls back to
 * its default, and within a well-shaped container non-conforming entries are
 * dropped. Total: any input yields a usable ProposePrefs.
 */
function validateProposePrefs(value: unknown): ProposePrefs {
  const fallback = defaultProposePrefs();
  if (typeof value !== "object" || value === null) return fallback;
  const p = value as Partial<Record<keyof ProposePrefs, unknown>>;

  const overrides: Record<string, string> = {};
  if (
    typeof p.overrides === "object" &&
    p.overrides !== null &&
    !Array.isArray(p.overrides)
  ) {
    for (const [itemId, recipeId] of Object.entries(p.overrides)) {
      if (typeof recipeId === "string") overrides[itemId] = recipeId;
    }
  }

  // An empty array survives as empty (the user unchecked everything); only a
  // non-array falls back to the converter/packager default.
  const excludedMachineIds = Array.isArray(p.excludedMachineIds)
    ? p.excludedMachineIds.filter((id): id is string => typeof id === "string")
    : fallback.excludedMachineIds;

  return {
    overrides,
    excludedMachineIds,
    unlockedTier: validTier(p.unlockedTier),
  };
}

/**
 * A persisted tier value, or `null` for "all". CATALOG-INDEPENDENT by design —
 * module-level facts only, so it has none of the hydration-order problem a
 * catalog-derived bound would have (persist hydrates during `createAppStore`,
 * while the catalog is still `initializing`).
 *
 * This half is NOT optional: a persisted `-1`, `2.5` or `NaN` would otherwise
 * survive, render as "all" (no such option exists) while gating filtered out
 * every unlock-bearing recipe — the display lying about the world, and STICKY,
 * since nothing writes back and selecting "all" fires no change event (the
 * control already shows it). An ABOVE-range tier is deliberately NOT clamped
 * here: it gates nothing, so it already behaves as "all", and the render
 * normalizes it (no write-back, no catalog dependency).
 */
function validTier(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= 0
    ? (value as number)
    : null;
}

/** Clamp a tier count to `[1, TIER_TABLE.<kind>.length]`, defaulting a corrupt
 *  or missing value to the full table length. */
function clampTier(kind: "belt" | "pipe", value: unknown): number {
  const max = TIER_TABLE[kind].length;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return max;
  }
  if (value < 1) return 1;
  if (value > max) return max;
  return value;
}

/** Normalize a caught plan-op failure to a string for `planError`. */
function planErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * The store's `storage` is injectable so tests supply a plain-object stub and
 * the app supplies localStorage. A module-level slot lets `createAppStore`
 * take the storage per-instance without threading it through persist's typed
 * options (which key storage by the whole store type).
 */
let storageProvider: () => StateStorage = () => localStorage;

// ---------------------------------------------------------------------------
// Bundled-catalog boot seam (frozen brainstorm Axis 2, ticket #9)
// ---------------------------------------------------------------------------

/** The bundled snapshot's provenance, carried alongside its raw Docs text. */
export interface Provenance {
  steamBuild: string;
  extractedAt: string;
}

/**
 * Injection seam for the bundled default catalog, mirroring `storageProvider`:
 * the app wires a fetch of the static asset + provenance sidecar; tests inject
 * fixture text or `null`. Resolves `{ text, provenance }` as a UNIT — a
 * provenance-fetch failure collapses the whole result to null (no half-loaded
 * banner state). A `null` result — or a REJECTED promise — is the same degrade
 * path: init falls back to the v1 needs-upload behavior. The default returns
 * null so a store built without wiring (all current tests) simply degrades.
 */
let bundledDocsProvider: () => Promise<{
  text: string;
  provenance: Provenance;
} | null> = async () => null;

/** Wire the bundled-docs provider (the app calls this once; tests inject
 *  fixtures or a rejecting/null provider to exercise the degrade paths). */
export function setBundledDocsProvider(
  provider: () => Promise<{ text: string; provenance: Provenance } | null>,
): void {
  bundledDocsProvider = provider;
}

/**
 * Provenance-only seam (#144): the bundled-staleness comparison needs the
 * ~200-byte provenance sidecar, never the 5.3 MB docs text — routing the check
 * through bundledDocsProvider would re-download the catalog on every bundled
 * boot, which is exactly what the cache exists to avoid. Default resolves null
 * (unwired = no comparison, today's behaviour).
 */
let bundledProvenanceProvider: () => Promise<Provenance | null> = async () =>
  null;

export function setBundledProvenanceProvider(
  provider: () => Promise<Provenance | null>,
): void {
  bundledProvenanceProvider = provider;
}

/**
 * The detached bundled-refresh continuation, retained for the harness (#144):
 * production never awaits it; tests await it to observe the refresh
 * deterministically instead of polling. Null when no refresh was detached.
 */
let pendingRefresh: Promise<void> | null = null;

export function pendingBundledRefresh(): Promise<void> | null {
  return pendingRefresh;
}

/**
 * Catalog-save serialization (#144): one last-writer-wins IDB row, three async
 * writers (init's non-hit load, the detached refresh, user uploads). The queue
 * makes row-write order equal set order, so the last set on any interleaving —
 * always the user's — wins the row (never-evict). The chain itself never
 * poisons (both outcomes settle it); the returned promise carries the op's
 * real outcome so each caller keeps its own error handling. The planOpChain
 * totality discipline, applied module-wide.
 */
let catalogSaveQueue: Promise<void> = Promise.resolve();

function enqueueCatalogSave<T>(op: () => Promise<T>): Promise<T> {
  const result = catalogSaveQueue.then(op);
  catalogSaveQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/**
 * Test-only reset of the three #144 module-level bindings (leak hygiene, spec
 * D1b): per-link totality already rules out queue poisoning and every enqueue
 * is awaited before its action returns, so this is hygiene, not correctness.
 */
export function resetBundledRefreshSeams(): void {
  bundledProvenanceProvider = async () => null;
  pendingRefresh = null;
  catalogSaveQueue = Promise.resolve();
}

// ---------------------------------------------------------------------------
// Store construction (frozen brainstorm Axis 1)
// ---------------------------------------------------------------------------

/**
 * Build a fresh store instance. Tests call this per-case (with an injected
 * storage stub) to get isolated state; the app uses the singleton below.
 * With a synchronous storage, persist hydrates DURING creation — before any
 * action runs — so the first derive (in init()) already sees hydrated tiers.
 */
export function createAppStore(storage?: StateStorage) {
  if (storage) {
    storageProvider = () => storage;
  }

  // Plan-op serialization (frozen Axis 3). A fresh listPlans() read alone is not
  // atomic — two savePlanAs("A") calls interleaving across its await boundary (a
  // double-click) would both see no "A" and both create. So all EXTERNALLY-
  // initiated plan ops enqueue on this per-store chain, and each enqueued op is
  // TOTAL by construction (it catches its own failure into planError and always
  // resolves), so the value reassigned to the chain is always fulfilled —
  // poisoning is impossible, and each op observes the committed result of every
  // prior op. Cross-tab writes are out of scope (plans are a single-tab surface).
  let planOpChain: Promise<void> = Promise.resolve();

  return createStore<Store>()(
    persist(
      (set, get) => {
        // The one non-enqueuing refresh, shared by the refreshPlans action and
        // every op's terminal inline refresh (a re-entrant refreshPlans() enqueue
        // would await a chained op that can't start until the current op resolves
        // — self-deadlock). Op bodies compose plan-store MODULE primitives only,
        // never the identically-named enqueuing store actions.
        const doRefresh = async (): Promise<void> => {
          const list = await listPlanFiles();
          set({ plans: list });
        };

        // Enqueue an externally-initiated op. The op body owns the entire
        // read→decide→write→refresh sequence AND its own catch-into-planError,
        // so this wrapper never adds a .catch that would poison the chain.
        const enqueue = (op: () => Promise<void>): Promise<void> => {
          planOpChain = planOpChain.then(op);
          return planOpChain;
        };

        // The one per-plan save path shared by importPlan's single arm AND its
        // bundle arm (Stage 19 / #92, frozen Axis 3): OUR name rules on a
        // VALIDATED file — trim, refuse-empty, then collision-overwrite (keep
        // the existing row's createdAt; a foreign payload's stamp is untrusted)
        // or create a fresh row (createdAt now). Behavior is byte-for-byte the
        // pre-Stage-19 single-arm logic, just extracted.
        //
        // The collision read is a FRESH listPlanFiles() per call (never hoisted
        // above the bundle loop): within one bundle, two entries sharing a
        // trimmed name resolve last-entry-wins into ONE row — the second call
        // sees the first's just-committed row and overwrites it, preserving the
        // by-construction name-uniqueness invariant (store.ts collision idiom,
        // savePlanAs). Returns "empty-name" for a whitespace name (caller shapes
        // the message) or "saved" once the row is committed.
        const savePlanFromFile = async (
          file: PlanFileV8,
        ): Promise<"saved" | "empty-name"> => {
          const trimmed = file.name.trim();
          if (trimmed === "") return "empty-name";
          const existing = await listPlanFiles();
          const match = existing.find((p) => p.name === trimmed);
          const now = new Date().toISOString();
          if (match) {
            const prior = await loadPlanFile(match.id);
            const plan: PlanFileV8 = {
              ...file,
              name: trimmed,
              createdAt: prior?.createdAt ?? now,
              updatedAt: now,
            };
            await savePlanFile(plan, match.id);
          } else {
            const plan: PlanFileV8 = {
              ...file,
              name: trimmed,
              createdAt: now,
              updatedAt: now,
            };
            await savePlanFile(plan, crypto.randomUUID());
          }
          return "saved";
        };

        // The default stage lives in the INITIAL-STATE LITERAL (not init()):
        // persist's `merge` runs synchronously during createAppStore, before
        // init(), and must find stages[activeStageId].selection to hydrate the
        // tiers into. The v1 single-stage case IS this one-node graph. Its
        // selection/solve are mirrored to the top-level fields below.
        const firstStage = defaultStage("Stage 1");

        return {
          catalog: { status: "initializing" },
          stages: { [firstStage.id]: firstStage },
          stageOrder: [firstStage.id],
          activeStageId: firstStage.id,
          links: [],
          reconciliation: [],
          selectedLinkId: null,
          // The default stage auto-places at seq 0's slot in the default LR
          // direction; placementSeq then points at the next free slot (Stage 3 /
          // Phase 2). flowDirection boots "LR" (today's orientation); userPlaced
          // is empty — the default stage is auto-placed (Stage 10 / Phase 1).
          positions: { [firstStage.id]: placementSlot(0, "LR") },
          placementSeq: 1,
          flowDirection: "LR",
          userPlaced: {},
          selection: firstStage.selection,
          solve: firstStage.solve,
          catalogSource: null,
          uploadError: null,
          plans: null,
          planError: null,
          // Overwritten by persist's `merge` during createAppStore when a
          // stored projection exists (validated on the way in).
          proposePrefs: defaultProposePrefs(),

          async init() {
            // The bundled load+parse+save sequence, shared by the non-hit
            // fallback and the #144 staleness refresh. Parameterized by its
            // APPLY (each caller decides how — and whether — a parsed catalog
            // enters the store; returning false declines it) with the FAILURE
            // fallback left to the caller. `unavailable` keeps the boundary-r1
            // no-save carve-out: an unreadable row must not be clobbered, so
            // that caller applies WITHOUT saving. Saves go through
            // enqueueCatalogSave — the #144 row-write serialization.
            const loadBundled = async (opts: {
              unavailable: boolean;
              apply: (catalog: Catalog, source: CatalogSource) => boolean;
            }): Promise<boolean> => {
              let bundled: { text: string; provenance: Provenance } | null;
              try {
                bundled = await bundledDocsProvider();
              } catch {
                bundled = null;
              }
              if (bundled === null) return false;
              try {
                const catalog = parseCatalogFromText(bundled.text);
                const source: CatalogSource = {
                  kind: "bundled",
                  steamBuild: bundled.provenance.steamBuild,
                  extractedAt: bundled.provenance.extractedAt,
                };
                if (!opts.apply(catalog, source)) return false;
                if (opts.unavailable) {
                  // Do NOT save: the unreadable row stays intact for a later
                  // boot that can read it again (proven by the data-
                  // preservation test).
                  set({
                    uploadError:
                      "cached data couldn't be read this session — using bundled data",
                  });
                } else {
                  // Cache the bundled catalog so later boots hit the fast
                  // path (and keep the banner). Never-block save: a failure
                  // leaves it usable this session, merely uncached, with an
                  // uploadError note — same semantics as the upload path.
                  try {
                    await enqueueCatalogSave(() =>
                      saveCatalog(bundled.text, catalog, source),
                    );
                  } catch (err) {
                    const message =
                      err instanceof Error ? err.message : String(err);
                    set({
                      uploadError: `bundled catalog loaded but could not be cached: ${message}`,
                    });
                  }
                }
                return true;
              } catch {
                // A corrupt bundled asset: the caller's failure fallback runs.
                return false;
              }
            };

            const result = await loadCatalog();
            if (result.status === "hit") {
              // Cache wins: a user upload or a previously-cached bundled catalog
              // never regresses. The persisted row's source drives the banner.
              // #144 set-first ordering: this fires before ANY network — the
              // staleness check below is a detached continuation.
              set({
                catalog: { status: "ready", catalog: result.catalog },
                catalogSource: result.source,
              });
            } else {
              // empty / stale / unavailable → try the bundled default before
              // giving up. The provider call is try/caught: a REJECTED promise
              // degrades exactly like a resolved null.
              //
              // The 'unavailable' carve-out (boundary r1 fold): the cache row
              // may be a valid, possibly newer user catalog we merely couldn't
              // READ this session. empty/stale rows are absent or genuinely
              // unusable, so bundled data may replace them (SAVE). But an
              // unavailable row must NOT be overwritten — because openDb is
              // memoized, a get-failure leaves a healthy connection through which
              // a save would DESTRUCTIVELY clobber that row. So on 'unavailable'
              // we run bundled WITHOUT saving (usable this session, cache
              // untouched) and note it distinctly.
              const unavailable = result.status === "unavailable";
              const ready = await loadBundled({
                unavailable,
                apply: (catalog, source) => {
                  set({
                    catalog: { status: "ready", catalog },
                    catalogSource: source,
                  });
                  return true;
                },
              });

              if (!ready) {
                // 'unavailable' is not a UI reason (the frozen union has only
                // empty / stale / upload-error); map it to 'stale' so the degrade
                // lands on the generic re-upload screen.
                const reason = unavailable ? "stale" : result.status;
                set({
                  catalog: { status: "needs-upload", reason },
                });
              }
            }
            // First derive, after hydration + the catalog resolves. Re-derive
            // ALL stages (cadence table): hydration is tiers-only and every
            // stage boots default, so no #5 override-clear is needed — identity.
            set((s) => deriveAllStages(s, (sel) => sel));

            // #144 bundled-staleness self-heal: DETACHED continuation — init()
            // resolves here; production never awaits this chain (tests do, via
            // pendingBundledRefresh). It swallows every error. A user row never
            // enters (never-evict by construction); a legacy backfilled row
            // reads {kind:"user"} and correctly never auto-refreshes.
            if (result.status === "hit" && result.source.kind === "bundled") {
              const cachedBuild = result.source.steamBuild;
              pendingRefresh = (async () => {
                try {
                  let prov: Provenance | null;
                  try {
                    prov = await bundledProvenanceProvider();
                  } catch {
                    prov = null;
                  }
                  // Fetch failed / unwired / equal build → keep the hit.
                  if (prov === null || prov.steamBuild === cachedBuild) return;
                  await loadBundled({
                    unavailable: false,
                    apply: (catalog, source) => {
                      // Never-evict guard (spec D1b): a user upload may have
                      // landed during the refresh window — apply only if the
                      // live source is still bundled. Check and set share one
                      // microtask; the save-vs-save race is closed separately
                      // by enqueueCatalogSave (row-write order = set order).
                      if (get().catalogSource?.kind !== "bundled") return false;
                      // Apply like a live upload (the replace-while-ready
                      // precedent): one set carrying the new catalog AND the
                      // full re-derive, else stages stay solved against the
                      // old catalog. Bundled swaps are same-schema, so unlike
                      // an upload no recipeId re-validation is needed — but
                      // the #5 treatment is kept identical to the upload path
                      // for the same reason it exists there.
                      set((s) => {
                        const withCatalog: GraphSlice = {
                          ...s,
                          catalog: { status: "ready", catalog },
                        };
                        return {
                          ...deriveAllStages(withCatalog, (sel) => ({
                            ...sel,
                            recipeId:
                              sel.recipeId !== null &&
                              catalog.recipes[sel.recipeId] !== undefined
                                ? sel.recipeId
                                : null,
                            overrides: { feeds: {}, outputs: {} },
                          })),
                          catalogSource: source,
                        };
                      });
                      return true;
                    },
                  });
                } catch {
                  // Detached chain: nothing may escape to an unhandled
                  // rejection (spec D1b promise boundary).
                }
              })();
            }
          },

          async uploadDocsText(text: string) {
            // Clear any prior transient error at entry — both the success and
            // failure paths start clean (frozen Axis 4).
            set({ uploadError: null });
            const hadReadyCatalog = get().catalog.status === "ready";

            let catalog: Catalog;
            try {
              // parseCatalogFromText = JSON.parse + parseDocsJson: a non-JSON
              // file throws SyntaxError, a bad schema throws DocsParseError.
              catalog = parseCatalogFromText(text);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              // Parse FAILURE: the in-memory catalog is NOT replaced, so
              // overrides are kept. Route by whether a working catalog existed.
              if (hadReadyCatalog) {
                set({ uploadError: message });
              } else {
                set({
                  catalog: {
                    status: "needs-upload",
                    reason: "upload-error",
                    message,
                  },
                });
              }
              // Parse FAILURE (cadence table): solves none, reconciliation
              // none. Re-derive the active stage only, to reflect any catalog
              // change (needs-upload on a fresh-boot failure).
              set((s) => applyActiveSelection(s, s.selection));
              return;
            }

            // Parse SUCCESS: the in-memory catalog IS replaced this session,
            // regardless of the save outcome. The catalog replacement affects
            // EVERY stage, so each gets the #5 treatment (recipeId re-validated
            // against the new catalog + overrides cleared) and ALL stages
            // re-derive; reconciliation recomputes (cadence table).
            set((s) => {
              const withCatalog: GraphSlice = {
                ...s,
                catalog: { status: "ready", catalog },
              };
              return {
                ...deriveAllStages(withCatalog, (sel) => ({
                  ...sel,
                  recipeId:
                    sel.recipeId !== null &&
                    catalog.recipes[sel.recipeId] !== undefined
                      ? sel.recipeId
                      : null,
                  overrides: { feeds: {}, outputs: {} },
                })),
                // An upload flips provenance to user, hiding the bundled banner.
                catalogSource: { kind: "user" },
              };
            });

            // Persist to the cache. A save failure does NOT block 'ready' — the
            // catalog is usable this session, merely uncached — with uploadError
            // noting the cache miss (frozen Axis 4 wide catch).
            try {
              await enqueueCatalogSave(() =>
                saveCatalog(text, catalog, { kind: "user" }),
              );
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              set({
                uploadError: `catalog loaded but could not be cached: ${message}`,
              });
            }
          },

          selectRecipe(recipeId: string | null) {
            // Overrides are lane-addressed per recipe; carrying them across
            // recipes would misaddress lanes, so a recipe change clears them.
            set((s) =>
              applyActiveSelection(s, {
                ...s.selection,
                recipeId,
                overrides: { feeds: {}, outputs: {} },
              }),
            );
          },

          setMachineCount(n: number) {
            set((s) =>
              applyActiveSelection(s, { ...s.selection, machineCount: n }),
            );
          },

          setStageMachineCount(stageId: string, n: number) {
            set((s) => {
              const stage = s.stages[stageId];
              if (stage === undefined) return {};
              // Write the NAMED stage's machineCount (not the active mirror) so
              // an edge-driven apply mutates the producer without stealing the
              // cursor. applyStageSelection re-mirrors the ACTIVE stage.
              return applyStageSelection(s, stageId, {
                ...stage.selection,
                machineCount: n,
              });
            });
          },

          applyRecipeSwap(
            stageId: string,
            recipeId: string,
            machineCount: number,
          ) {
            set((s) => {
              const stage = s.stages[stageId];
              if (stage === undefined) return {};
              // ONE atomic write of the full composed selection: recipe +
              // resized count together (a two-step selectRecipe-then-count would
              // derive an intermediate wrong-sized state). Overrides clear per
              // selectRecipe's posture — they lane-address the OLD recipe's
              // items. clockPercentText + unlockedTiers ride the spread. Written
              // to the NAMED stage (not the active mirror) so a table-row Apply
              // on a non-active stage does not steal the cursor
              // (setStageMachineCount precedent).
              return applyStageSelection(s, stageId, {
                ...stage.selection,
                recipeId,
                machineCount,
                overrides: { feeds: {}, outputs: {} },
              });
            });
          },

          setClockPercentText(text: string) {
            set((s) =>
              applyActiveSelection(s, {
                ...s.selection,
                clockPercentText: text,
              }),
            );
          },

          setUnlockedTiers(t: { belt: number; pipe: number }) {
            // Tiers are GLOBAL (game progression, not per-stage config): a tier
            // change writes ALL stages and re-derives every one (cadence table).
            // Clamp at the action boundary so toStageInput's tier-range throw is
            // unreachable from store-driven flows (derive still catches).
            const clamped = {
              belt: clampTier("belt", t.belt),
              pipe: clampTier("pipe", t.pipe),
            };
            set((s) =>
              deriveAllStages(s, (sel) => ({
                ...sel,
                unlockedTiers: clamped,
              })),
            );
          },

          setProposePrefs(patch: Partial<ProposePrefs>) {
            // A plain merge — no derive: these are Propose-time preferences,
            // not solver inputs, so no stage re-solves. The persist middleware
            // writes the widened projection on the resulting state change.
            set((s) => ({ proposePrefs: { ...s.proposePrefs, ...patch } }));
          },

          setOverride(
            side: "feeds" | "outputs",
            itemId: string,
            beltIndex: number,
            capacityText: string | null,
          ) {
            set((s) => {
              const sideMap = s.selection.overrides[side];
              const existing = sideMap[itemId] ?? [];
              // Dense write: grow to beltIndex, padding intermediate slots with
              // null. Never sparse — a sparse array's .length counts holes and
              // would trip the solver's overrides-exceed-belt-count check.
              const next = existing.slice();
              while (next.length <= beltIndex) {
                next.push(null);
              }
              next[beltIndex] = capacityText;
              return applyActiveSelection(s, {
                ...s.selection,
                overrides: {
                  ...s.selection.overrides,
                  [side]: { ...sideMap, [itemId]: next },
                },
              });
            });
          },

          clearOverrides() {
            set((s) =>
              applyActiveSelection(s, {
                ...s.selection,
                overrides: { feeds: {}, outputs: {} },
              }),
            );
          },

          setExtractionSelection(
            stageId: string,
            itemId: string,
            selection: ExtractionSelection | null,
          ) {
            set((s) => {
              const stage = s.stages[stageId];
              if (stage === undefined || itemId === "") return {};
              const extraction: Record<string, ExtractionSelection> =
                Object.create(null);
              for (const [key, value] of Object.entries(
                stage.extraction ?? {},
              )) {
                extraction[key] = value;
              }
              if (selection === null) delete extraction[itemId];
              else extraction[itemId] = copyExtractionSelection(selection);
              const nextStage: StageNode = {
                ...stage,
                ...(Object.keys(extraction).length > 0
                  ? { extraction }
                  : { extraction: undefined }),
              };
              return { stages: { ...s.stages, [stageId]: nextStage } };
            });
          },

          // --- Graph actions (Stage 3 / Phase 1) -----------------------------
          // Synchronous, mutate-then-recompute (no IDB this phase). Reconcile
          // recompute follows the cadence table: rename/cursor/addStage don't
          // affect flows; add/remove link + removeStage do.

          addStage() {
            set((s) => {
              // Seed the new stage's tiers from the ACTIVE stage so the
              // tiers-global invariant holds on the create path too; everything
              // else is default. No links yet, so reconciliation is unaffected.
              const active = s.stages[s.activeStageId]!;
              const n = s.stageOrder.length + 1;
              const stage = defaultStage(`Stage ${n}`);
              stage.selection = {
                ...stage.selection,
                unlockedTiers: { ...active.selection.unlockedTiers },
              };
              const derived = deriveStage(s.catalog, stage);
              // Auto-place at the current monotonic seq slot in the current
              // direction; bump the counter (never reused, so no collision
              // handling — frozen Axis 2). A fresh stage is auto-placed, so it
              // is NOT added to userPlaced — a later direction switch re-grids it.
              return {
                stages: { ...s.stages, [derived.id]: derived },
                stageOrder: [...s.stageOrder, derived.id],
                positions: {
                  ...s.positions,
                  [derived.id]: placementSlot(s.placementSeq, s.flowDirection),
                },
                placementSeq: s.placementSeq + 1,
              };
            });
          },

          removeStage(id: string) {
            set((s) => {
              // The ≥1-stage invariant: removing the last stage is a no-op (the
              // cursor read stages[activeStageId] must always resolve).
              if (s.stageOrder.length <= 1) return {};
              if (s.stages[id] === undefined) return {};
              const stages = { ...s.stages };
              delete stages[id];
              const stageOrder = s.stageOrder.filter((x) => x !== id);
              // Prune the removed stage's canvas position (Stage 3 / Phase 2) —
              // a P2 extension of this action body; the frozen P1 cascade/
              // cursor/last-stage rules below are unchanged. No orphan entries.
              const positions = { ...s.positions };
              delete positions[id];
              // Prune its userPlaced entry too (Stage 10 / Phase 1) — the flag
              // rides with the stage, so no orphan pins accumulate.
              const userPlaced = { ...s.userPlaced };
              delete userPlaced[id];
              // Cascade: links touching the removed stage go with it (structure
              // the user explicitly deleted), unlike a recipe-change dangling.
              const links = s.links.filter(
                (l) => l.fromStageId !== id && l.toStageId !== id,
              );
              // If the open inspector's link was cascaded away, close it.
              const selectedLinkId = links.some(
                (l) => l.id === s.selectedLinkId,
              )
                ? s.selectedLinkId
                : null;
              // Cursor moves to the first remaining stage if the active one went.
              const activeStageId =
                s.activeStageId === id ? stageOrder[0]! : s.activeStageId;
              return {
                ...recomputeReconciliation(
                  mirrorActive({
                    ...s,
                    stages,
                    stageOrder,
                    positions,
                    userPlaced,
                    links,
                    activeStageId,
                  }),
                ),
                selectedLinkId,
              };
            });
          },

          renameStage(id: string, name: string) {
            set((s) => {
              const stage = s.stages[id];
              if (stage === undefined) return {};
              // Rename doesn't affect flows → no reconciliation recompute.
              return { stages: { ...s.stages, [id]: { ...stage, name } } };
            });
          },

          setActiveStage(id: string) {
            set((s) => {
              if (s.stages[id] === undefined) return {};
              // Cursor move → re-mirror the newly-active stage; flows unchanged.
              return mirrorActive({ ...s, activeStageId: id });
            });
          },

          addLink(link: NewStageLink) {
            set((s) => {
              if (Object.hasOwn(link, "interstep")) return {};
              // Hard refusals: self-link, and duplicate (toStageId,itemId) — a
              // feed lane has exactly one upstream source in v1 chaining.
              if (link.fromStageId === link.toStageId) return {};
              const duplicate = s.links.some(
                (l) =>
                  l.toStageId === link.toStageId && l.itemId === link.itemId,
              );
              if (duplicate) return {};
              const next: StageLink = {
                id: crypto.randomUUID(),
                fromStageId: link.fromStageId,
                itemId: link.itemId,
                toStageId: link.toStageId,
                ...(link.transport !== undefined
                  ? { transport: link.transport }
                  : {}),
              };
              const links = [...s.links, next];
              // Dangling ends (a stage not producing/consuming itemId) are KEPT
              // and surface as findings, not refused.
              return recomputeReconciliation({ ...s, links });
            });
          },

          removeLink(id: string) {
            set((s) => ({
              // Transport config is link-attached and does not change supply/
              // demand, so removal only re-runs reconciliation (a link went) and
              // clears selection if the removed link was the open inspector.
              ...recomputeReconciliation({
                ...s,
                links: s.links.filter((l) => l.id !== id),
              }),
              selectedLinkId: s.selectedLinkId === id ? null : s.selectedLinkId,
            }));
          },

          setLinkTransport(linkId: string, transport: LinkTransport) {
            // Numeric text remains raw until derive, but the public action
            // rebuilds the structural shape so wider/type-erased callers cannot
            // create a plan that strict v8 persistence later refuses.
            set((s) => {
              const canonical = canonicalizeLinkTransport(transport);
              if (canonical === null) return {};
              const link = s.links.find((l) => l.id === linkId);
              if (link === undefined) return {};
              if (
                link.interstep !== undefined &&
                isIllegalPackagedTransport(canonical)
              ) {
                return {};
              }
              return recomputeReconciliation({
                ...s,
                links: s.links.map((l) =>
                  l.id === linkId ? { ...l, transport: canonical } : l,
                ),
              });
            });
          },

          clearLinkTransport(linkId: string) {
            // Drop the transport key entirely → the belt default (absent means
            // belt), restoring today's rendering with zero new UI noise.
            set((s) => {
              const link = s.links.find((l) => l.id === linkId);
              if (link === undefined) return {};
              return recomputeReconciliation({
                ...s,
                links: s.links.map((l) => {
                  if (l.id !== linkId) return l;
                  if (l.interstep !== undefined) {
                    return { ...l, transport: { mode: "belt" } };
                  }
                  // Rebuild without the transport key (absent ⇒ belt default).
                  return {
                    id: l.id,
                    fromStageId: l.fromStageId,
                    itemId: l.itemId,
                    toStageId: l.toStageId,
                  };
                }),
              });
            });
          },

          setLinkInterstep(
            linkId: string,
            interstep: PackagingInterstep | null,
          ) {
            set((s) => {
              const link = s.links.find((candidate) => candidate.id === linkId);
              if (link === undefined) return {};
              const canonical =
                interstep === null
                  ? null
                  : canonicalizePackagingInterstep(interstep);
              if (interstep !== null && canonical === null) return {};
              if (
                canonical !== null &&
                link.interstep !== undefined &&
                isIllegalPackagedTransport(link.transport)
              ) {
                return {};
              }

              const next =
                canonical === null
                  ? linkWithoutInterstep(link, currentLinkItem(s.catalog, link))
                  : {
                      ...link,
                      transport:
                        link.interstep === undefined
                          ? ({ mode: "belt" } as const)
                          : link.transport,
                      interstep:
                        link.interstep === undefined
                          ? {
                              ...canonical,
                              returnTransport: { mode: "belt" } as const,
                            }
                          : canonical,
                    };
              return recomputeReconciliation({
                ...s,
                links: s.links.map((candidate) =>
                  candidate.id === linkId ? next : candidate,
                ),
              });
            });
          },

          selectLink(linkId: string | null) {
            // A select on a vanished link is ignored (belt-and-braces: the canvas
            // only selects live edges). null always closes the inspector.
            set((s) => {
              if (linkId !== null && !s.links.some((l) => l.id === linkId)) {
                return {};
              }
              return { selectedLinkId: linkId };
            });
          },

          setStagePosition(id: string, pos: { x: number; y: number }) {
            // Pure position write — no derive, no reconciliation (cadence row:
            // none/none). The canvas commits this once on drag-end. The drag is
            // the user's intent, so mark the stage userPlaced (Stage 10 / P1) —
            // a subsequent direction switch then leaves it pinned.
            set((s) => {
              if (s.stages[id] === undefined) return {};
              return {
                positions: { ...s.positions, [id]: pos },
                userPlaced: { ...s.userPlaced, [id]: true },
              };
            });
          },

          setFlowDirection(dir: FlowDirection) {
            set((s) => {
              // Same-direction set is a no-op (avoids a needless re-slot render).
              if (s.flowDirection === dir) return {};
              // Re-slot every NON-userPlaced stage by its stageOrder index in the
              // new direction. Order-index re-gridding is deterministic, compacts
              // removal gaps, and only ever touches nodes the user never moved
              // (original placement seqs aren't retained). Pure position write —
              // no derive, no reconciliation (positions are presentation, the
              // setStagePosition cadence). Re-slotted stages are NOT marked
              // userPlaced — the switch never pollutes that set.
              const positions = { ...s.positions };
              s.stageOrder.forEach((id, i) => {
                if (s.userPlaced[id] === true) return;
                positions[id] = placementSlot(i, dir);
              });
              return { flowDirection: dir, positions };
            });
          },

          applyChainProposal(
            proposal: ChainProposal,
            options: ApplyChainProposalOptions = {},
          ) {
            // Append the proposed stages/links (fresh uuids), derive + reconcile
            // + mirror, and focus the target stage. Additive rebuildFromPlan
            // idiom; empty proposal is a no-op. Threads placementSeq through the
            // helper so the monotonic counter stays never-reused. The clock text
            // (S20 P2) seeds every applied stage's clockPercentText.
            set((s) =>
              applyProposalToSlice(s, s.placementSeq, proposal, options),
            );
          },

          // --- Plan lifecycle (frozen Axis 3) --------------------------------
          // All five enqueue on planOpChain via `enqueue`; each op body is total
          // (own catch-into-planError, always resolves) and composes plan-store
          // MODULE primitives only. The terminal refresh is the inline doRefresh,
          // never the enqueuing refreshPlans() action (would self-deadlock).

          refreshPlans() {
            return enqueue(async () => {
              set({ planError: null });
              try {
                await doRefresh();
              } catch (err) {
                set({ planError: planErrorMessage(err) });
              }
            });
          },

          savePlanAs(name: string) {
            return enqueue(async () => {
              set({ planError: null });
              try {
                const trimmed = name.trim();
                if (trimmed === "") {
                  set({ planError: "plan name required" });
                  return;
                }
                // Name→id lookup against a FRESH read (never state.plans — nullable
                // /stale, the null-window duplicate trace). Overwrite the unique
                // holder or create; uniqueness is preserved by construction.
                const existing = await listPlanFiles();
                const match = existing.find((p) => p.name === trimmed);
                const now = new Date().toISOString();
                // Capture the WHOLE graph (Stage 3 / Phase 3): stages in
                // stageOrder (array order IS stageOrder), each carrying name +
                // selection + position; links index-encoded (stage id → index).
                // Position is written unconditionally for exact restoration;
                // v8 also writes the required placement boolean because position
                // presence alone cannot distinguish auto from user placement.
                const s = get();
                const indexOf = new Map(s.stageOrder.map((id, i) => [id, i]));
                const stages: PlanStageV7[] = s.stageOrder.map((id) => {
                  const node = s.stages[id]!;
                  return {
                    name: node.name,
                    selection: node.selection,
                    position: s.positions[id],
                    userPlaced: s.userPlaced[id] === true,
                    ...(node.extraction !== undefined
                      ? { extraction: node.extraction }
                      : {}),
                  };
                });
                // Links index-encoded; the transport payload carries verbatim
                // (raw user text — the Selection precedent), absent for belt
                // links so the file stays clean.
                const links = s.links.map((l) => ({
                  from: indexOf.get(l.fromStageId)!,
                  to: indexOf.get(l.toStageId)!,
                  itemId: l.itemId,
                  ...(l.transport !== undefined
                    ? { transport: l.transport }
                    : {}),
                  ...(l.interstep !== undefined
                    ? { interstep: l.interstep }
                    : {}),
                }));
                if (match) {
                  const prior = await loadPlanFile(match.id);
                  const plan: PlanFileV8 = {
                    format_version: 8,
                    name: trimmed,
                    createdAt: prior?.createdAt ?? now,
                    updatedAt: now,
                    flowDirection: s.flowDirection,
                    stages,
                    links,
                  };
                  await savePlanFile(plan, match.id);
                } else {
                  const plan: PlanFileV8 = {
                    format_version: 8,
                    name: trimmed,
                    createdAt: now,
                    updatedAt: now,
                    flowDirection: s.flowDirection,
                    stages,
                    links,
                  };
                  await savePlanFile(plan, crypto.randomUUID());
                }
                await doRefresh();
              } catch (err) {
                set({ planError: planErrorMessage(err) });
              }
            });
          },

          loadPlan(id: string) {
            return enqueue(async () => {
              set({ planError: null });
              try {
                // Load with origin: validation returns v8, whose required
                // userPlaced flag already materializes native or migrated origin.
                const file = await loadPlanFile(id);
                if (file === null) {
                  // Corrupt/missing → planError, state untouched.
                  set({ planError: "plan could not be loaded" });
                  return;
                }
                // Whole-graph replacement (Stage 3 / Phase 3, frozen Axis 4).
                set((s) => rebuildFromPlan(s, file));
                // Loading a plan never touches the catalog or catalogSource.
              } catch (err) {
                set({ planError: planErrorMessage(err) });
              }
            });
          },

          renamePlan(id: string, name: string) {
            return enqueue(async () => {
              set({ planError: null });
              try {
                const trimmed = name.trim();
                if (trimmed === "") {
                  set({ planError: "plan name required" });
                  return;
                }
                // Uniqueness invariant: renaming to a name held by a DIFFERENT
                // plan is refused (an op refusal that resolves, not a rejection).
                const existing = await listPlanFiles();
                const collision = existing.find(
                  (p) => p.name === trimmed && p.id !== id,
                );
                if (collision) {
                  set({
                    planError: `a plan named "${trimmed}" already exists`,
                  });
                  return;
                }
                // Load via the plan-store MODULE fn, never the enqueuing action.
                const plan = await loadPlanFile(id);
                if (plan === null) {
                  set({ planError: "plan could not be loaded" });
                  return;
                }
                // loadPlanFile returns v8 (migrating older rows), so renaming an
                // older row rewrites it as v8 under the save-over model.
                const renamed: PlanFileV8 = {
                  ...plan,
                  name: trimmed,
                  updatedAt: new Date().toISOString(),
                };
                await savePlanFile(renamed, id);
                await doRefresh();
              } catch (err) {
                set({ planError: planErrorMessage(err) });
              }
            });
          },

          deletePlan(id: string) {
            return enqueue(async () => {
              set({ planError: null });
              try {
                await deletePlanFile(id);
                await doRefresh();
              } catch (err) {
                set({ planError: planErrorMessage(err) });
              }
            });
          },

          // Pure read: loadPlanFile already migrates an older row to the latest
          // format in memory, so the export is what a LOAD would see. Returns
          // null on missing/corrupt; no enqueue (writes nothing, sets no error)
          // and no DOM — App does the Blob/anchor download. (Frozen Axis 3.)
          async exportPlan(id: string): Promise<string | null> {
            const plan = await loadPlanFile(id);
            if (plan === null) return null;
            return JSON.stringify(plan, null, 2);
          },

          async exportAllPlans(): Promise<string | null> {
            // DELIBERATE divergence from exportPlan's no-enqueue posture
            // (exportPlan is a single-row read, torn-snapshot-immune by size).
            // A BUNDLE is a multi-row read across await boundaries: without the
            // enqueue slot, a concurrent savePlanAs/deletePlan could interleave
            // between the list and the per-row loads, yielding a TORN
            // point-in-time snapshot (a row listed but since-deleted, or two
            // rows from different instants). So the ENTIRE read runs inside ONE
            // enqueue slot — serialized w.r.t. other plan ops — making the
            // bundle a consistent snapshot. The op is TOTAL (returns a value via
            // the captured `result`, sets no planError) so it never poisons the
            // chain. Returns null when no plans exist (App suppresses download).
            let result: string | null = null;
            await enqueue(async () => {
              const metas = await listPlanFiles();
              if (metas.length === 0) return; // result stays null
              const plans: PlanFileV8[] = [];
              for (const meta of metas) {
                const file = await loadPlanFile(meta.id);
                // A row that fails to load (corrupt/foreign) is skipped rather
                // than aborting the whole backup — listPlanFiles already only
                // returns loadable rows, so this is defense in depth.
                if (file !== null) plans.push(file);
              }
              const bundle: PlanBundle = {
                kind: PLAN_BUNDLE_KIND,
                format_version: 1,
                exportedAt: new Date().toISOString(),
                plans,
              };
              result = JSON.stringify(bundle, null, 2);
            });
            return result;
          },

          importPlan(text: string) {
            return enqueue(async () => {
              set({ planError: null });
              try {
                // Our own UTF-8 JSON exports — file.text() upstream is correct
                // (the UTF-16 decodeBytes hazard is Docs.json-only).
                let parsed: unknown;
                try {
                  parsed = JSON.parse(text);
                } catch {
                  set({ planError: "import failed: not valid JSON" });
                  return;
                }

                // Sniff bundle-vs-single (Axis 3): a bundle envelope carries the
                // exact `kind`; a per-plan file has no `kind`, so the single arm
                // below stays byte-identical for every existing input.
                if (isPlanBundle(parsed)) {
                  // Bundle arm. The whole loop runs inside THIS one enqueue slot
                  // — serialized w.r.t. other plan ops. Each entry is still its
                  // own IDB put (no bundle-wide transaction, no rollback): the
                  // skip-invalid policy covers the expected validation-failure
                  // path, and a mid-loop I/O error leaves prior entries
                  // committed. Does NOT auto-load; one doRefresh() at the end.
                  const raw = (parsed as PlanBundle).plans;
                  const entries = Array.isArray(raw) ? raw : [];
                  const total = entries.length;
                  let imported = 0;
                  for (const entry of entries) {
                    const file = validatePlanFile(entry);
                    if (file === null) continue; // corrupt/foreign entry: skip
                    // savePlanFromFile re-reads listPlanFiles per call, so two
                    // same-named entries resolve last-entry-wins into ONE row
                    // (the second sees the first's committed row). An empty name
                    // is skipped like any other invalid entry.
                    const result = await savePlanFromFile(file);
                    if (result === "saved") imported += 1;
                  }
                  if (imported === 0) {
                    // Zero valid entries (incl. an empty plans[]): nothing was
                    // written, so no refresh needed — report the failure.
                    set({
                      planError: "import failed: no valid plans in bundle",
                    });
                    return;
                  }
                  const skipped = total - imported;
                  if (skipped > 0) {
                    // Partial success: extend the error channel to carry a
                    // partial-success caveat (uploadError's precedent — the red
                    // banner is the accepted surface). Only when K>0.
                    set({
                      planError: `imported ${imported} of ${total} plans (${skipped} invalid skipped)`,
                    });
                  }
                  await doRefresh();
                  return;
                }

                // Single-file arm (unchanged behavior, byte-for-byte error
                // strings). The SAME acceptance loadPlanFile uses: a
                // foreign/corrupt payload is refused, nothing written.
                const file = validatePlanFile(parsed);
                if (file === null) {
                  set({ planError: "import failed: not a valid plan file" });
                  return;
                }
                // OUR name rules via the shared helper (trim, refuse-empty,
                // collision-overwrite-or-new — mirroring savePlanAs exactly).
                const result = await savePlanFromFile(file);
                if (result === "empty-name") {
                  set({ planError: "plan name required" });
                  return;
                }
                // Import does NOT auto-load: saving ≠ switching the working
                // graph. The live graph is untouched; only the list refreshes.
                await doRefresh();
              } catch (err) {
                set({ planError: planErrorMessage(err) });
              }
            });
          },
        };
      },
      {
        name: PERSIST_KEY,
        storage: createJSONStorage<PersistedShape>(() => storageProvider()),
        // Persist the ACTIVE stage's tiers (all stages hold identical tiers by
        // the tiers-global invariant, so the active stage's copy is canonical).
        partialize: (s): PersistedShape => ({
          unlockedTiers: s.stages[s.activeStageId]!.selection.unlockedTiers,
          // User-global, already flat — projected verbatim (S20 P3).
          proposePrefs: s.proposePrefs,
        }),
        // Validating merge (runs synchronously during createAppStore, before
        // init): write the persisted tiers, clamped/defaulted, into EVERY stage
        // (tiers-global) + the top-level mirror. At merge time only the default
        // stage exists, but writing all stages keeps the invariant honest.
        merge: (persisted, current): Store => {
          const p = persisted as Partial<PersistedShape> | undefined;
          const tiers = p?.unlockedTiers;
          const unlockedTiers = {
            belt: clampTier("belt", tiers?.belt),
            pipe: clampTier("pipe", tiers?.pipe),
          };
          const stages: Record<string, StageNode> = {};
          for (const id of Object.keys(current.stages)) {
            const node = current.stages[id]!;
            stages[id] = {
              ...node,
              selection: { ...node.selection, unlockedTiers },
            };
          }
          const active = stages[current.activeStageId]!;
          return {
            ...current,
            stages,
            // Value-validated on read, exactly like the tiers above (S20 P3):
            // a corrupt field falls back to its default rather than reaching
            // the propose path.
            proposePrefs: validateProposePrefs(p?.proposePrefs),
            selection: active.selection,
            solve: active.solve,
          };
        },
      },
    ),
  );
}

/** The app-wide singleton (localStorage-backed). */
export const appStore = createAppStore();

/** React hook (unconsumed until Phase 4). */
export function useAppStore(): Store;
export function useAppStore<U>(selector: (state: Store) => U): U;
export function useAppStore<U>(selector?: (state: Store) => U): Store | U {
  return selector ? useStore(appStore, selector) : useStore(appStore);
}
