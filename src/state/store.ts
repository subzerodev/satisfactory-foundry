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
import type { PlanFileV2, PlanListEntry } from "../data/plan-store.ts";

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
}

/**
 * A directed item feed: `from`'s output belts of `itemId` feed `to`'s input
 * lane of `itemId`. Item-level, not belt-level (physical routing is Stage 4).
 */
export interface StageLink {
  id: string;
  fromStageId: string;
  itemId: string;
  toStageId: string;
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
}

export interface Actions {
  init(): Promise<void>;
  uploadDocsText(text: string): Promise<void>;
  selectRecipe(recipeId: string | null): void;
  setMachineCount(n: number): void;
  setClockPercentText(text: string): void;
  setUnlockedTiers(t: { belt: number; pipe: number }): void;
  setOverride(
    side: "feeds" | "outputs",
    itemId: string,
    beltIndex: number,
    capacityText: string | null,
  ): void;
  clearOverrides(): void;
  // Graph actions (Stage 3 / Phase 1) — all synchronous (no IDB this phase):
  // mutate-then-recompute, no plan-op chain.
  addStage(): void;
  removeStage(id: string): void;
  renameStage(id: string, name: string): void;
  setActiveStage(id: string): void;
  addLink(link: Omit<StageLink, "id">): void;
  removeLink(id: string): void;
  setStagePosition(id: string, pos: { x: number; y: number }): void;
  refreshPlans(): Promise<void>;
  savePlanAs(name: string): Promise<void>;
  loadPlan(id: string): Promise<void>;
  renamePlan(id: string, name: string): Promise<void>;
  deletePlan(id: string): Promise<void>;
  /** Serialize a stored plan (migrated to v2) as pretty JSON, or null if the
   *  row is missing/corrupt. Headless — App owns the Blob/anchor download. */
  exportPlan(id: string): Promise<string | null>;
  /** Validate + save an exported plan file's text under the save-over model.
   *  Never auto-loads (the live graph is untouched). Failures → planError. */
  importPlan(text: string): Promise<void>;
}

export type Store = AppState & Actions;

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
      parsed[i] = cell === null ? null : Fraction.parse(cell);
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

  // Clock text → positive Fraction, or 'bad-clock'.
  let clockPercent: Fraction;
  try {
    clockPercent = Fraction.parse(selection.clockPercentText);
  } catch {
    return {
      status: "invalid",
      reason: "bad-clock",
      detail: `clock percent must be a positive number; got ${JSON.stringify(selection.clockPercentText)}.`,
    };
  }
  if (clockPercent.lte(Fraction.from(0))) {
    return {
      status: "invalid",
      reason: "bad-clock",
      detail: `clock percent must be > 0; got ${JSON.stringify(selection.clockPercentText)}.`,
    };
  }

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
  | "selection"
  | "solve"
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
    return { linkId: link.id, supply, demand };
  });
}

/** Recompute reconciliation from the current stage solves + links. */
function recomputeReconciliation(slice: GraphSlice): GraphSlice {
  return { ...slice, reconciliation: reconcileLinks(mapLinkInputs(slice)) };
}

/**
 * Write a new selection into the ACTIVE stage, re-derive that stage, mirror it
 * up, and recompute reconciliation. The single-stage-mutation path used by the
 * six v1 setters + loadPlan.
 */
function applyActiveSelection(slice: GraphSlice, next: Selection): GraphSlice {
  const active = slice.stages[slice.activeStageId]!;
  const stage = deriveStage(slice.catalog, { ...active, selection: next });
  const stages = { ...slice.stages, [stage.id]: stage };
  return recomputeReconciliation(mirrorActive({ ...slice, stages }));
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
 * Whole-graph replacement from a loaded `PlanFileV2` (Stage 3 / Phase 3, frozen
 * Axis 4). Builds a fresh graph — new stage/link uuids — and applies the frozen
 * load treatments per stage:
 *
 * - machineCount `null → NaN` (plans persist via IDB structured clone, which
 *   keeps a live NaN — the null edge arises from hand-authored/imported/legacy
 *   JSON files, and isSelectionShape accepts it; such a stage must load
 *   rendered-invalid, matching the single-stage coercion this replaces);
 * - the CURRENT global unlockedTiers are stamped over every stage (tiers are
 *   progression, not plan content — the file's stored tiers are dead-on-read);
 * - recipeId re-validated against the current catalog (absent → null); overrides
 *   apply VERBATIM (the load posture — the #5 override-CLEAR is upload-only);
 * - positions from the file entry, else the auto-slot for the entry's index;
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
  plan: PlanFileV2,
): GraphSlice & { placementSeq: number } {
  const { catalog } = slice;
  // Current global tiers (the active mirror holds the canonical global value).
  const globalTiers = slice.selection.unlockedTiers;
  const ids = plan.stages.map(() => crypto.randomUUID());
  const stages: Record<string, StageNode> = {};
  const stageOrder: string[] = [];
  const positions: Record<string, { x: number; y: number }> = {};
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
    stages[id] = { id, name: entry.name, selection, solve: { status: "idle" } };
    stageOrder.push(id);
    positions[id] = entry.position ?? placementSlot(i);
  });
  const links: StageLink[] = plan.links.map((l) => ({
    id: crypto.randomUUID(),
    fromStageId: ids[l.from]!,
    toStageId: ids[l.to]!,
    itemId: l.itemId,
  }));
  const rebuilt: GraphSlice = {
    ...slice,
    stages,
    stageOrder,
    links,
    positions,
    activeStageId: ids[0]!,
  };
  // deriveAllStages overwrites the seeded-idle solves, mirrors the active stage,
  // and recomputes reconciliation — the full-recompute cadence for a
  // state-replacing mutation. placementSeq re-seeds to the next fresh slot.
  return {
    ...deriveAllStages(rebuilt, (sel) => sel),
    placementSeq: plan.stages.length,
  };
}

// ---------------------------------------------------------------------------
// Canvas helpers (Stage 3 / Phase 2)
// ---------------------------------------------------------------------------

/**
 * The column-flow slot a monotonic placement sequence maps to: four columns
 * 260px apart, rows 140px apart (frozen Axis 2). Never-reused seq → no two
 * auto-placed nodes share a slot, so no collision handling.
 */
function placementSlot(seq: number): { x: number; y: number } {
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

// ---------------------------------------------------------------------------
// Persistence (frozen brainstorm Axis 5)
// ---------------------------------------------------------------------------

/** localStorage key for the persisted tiers slice (v1). */
const PERSIST_KEY = "satis_foundry:tiers";

/** The persisted projection: top-level `{ unlockedTiers }` only. */
interface PersistedShape {
  unlockedTiers: { belt: number; pipe: number };
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
          // The default stage auto-places at seq 0's slot; placementSeq then
          // points at the next free slot (Stage 3 / Phase 2).
          positions: { [firstStage.id]: placementSlot(0) },
          placementSeq: 1,
          selection: firstStage.selection,
          solve: firstStage.solve,
          catalogSource: null,
          uploadError: null,
          plans: null,
          planError: null,

          async init() {
            const result = await loadCatalog();
            if (result.status === "hit") {
              // Cache wins: a user upload or a previously-cached bundled catalog
              // never regresses. The persisted row's source drives the banner.
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
              let bundled: { text: string; provenance: Provenance } | null;
              try {
                bundled = await bundledDocsProvider();
              } catch {
                bundled = null;
              }

              let ready = false;
              if (bundled !== null) {
                try {
                  const catalog = parseCatalogFromText(bundled.text);
                  const source: CatalogSource = {
                    kind: "bundled",
                    steamBuild: bundled.provenance.steamBuild,
                    extractedAt: bundled.provenance.extractedAt,
                  };
                  set({
                    catalog: { status: "ready", catalog },
                    catalogSource: source,
                  });
                  ready = true;
                  if (unavailable) {
                    // Do NOT save: the unreadable row stays intact for a later
                    // boot that can read it again (proven by the data-
                    // preservation test).
                    set({
                      uploadError:
                        "cached data couldn't be read this session — using bundled data",
                    });
                  } else {
                    // empty / stale: cache the bundled catalog so later boots hit
                    // the fast path (and keep the banner). Never-block save: a
                    // failure leaves it usable this session, merely uncached,
                    // with an uploadError note — same semantics as the upload path.
                    try {
                      await saveCatalog(bundled.text, catalog, source);
                    } catch (err) {
                      const message =
                        err instanceof Error ? err.message : String(err);
                      set({
                        uploadError: `bundled catalog loaded but could not be cached: ${message}`,
                      });
                    }
                  }
                } catch {
                  // A corrupt bundled asset degrades to needs-upload below.
                  ready = false;
                }
              }

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
              await saveCatalog(text, catalog, { kind: "user" });
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
              // Auto-place at the current monotonic seq slot; bump the counter
              // (never reused, so no collision handling — frozen Axis 2).
              return {
                stages: { ...s.stages, [derived.id]: derived },
                stageOrder: [...s.stageOrder, derived.id],
                positions: {
                  ...s.positions,
                  [derived.id]: placementSlot(s.placementSeq),
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
              // Cascade: links touching the removed stage go with it (structure
              // the user explicitly deleted), unlike a recipe-change dangling.
              const links = s.links.filter(
                (l) => l.fromStageId !== id && l.toStageId !== id,
              );
              // Cursor moves to the first remaining stage if the active one went.
              const activeStageId =
                s.activeStageId === id ? stageOrder[0]! : s.activeStageId;
              return recomputeReconciliation(
                mirrorActive({
                  ...s,
                  stages,
                  stageOrder,
                  positions,
                  links,
                  activeStageId,
                }),
              );
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

          addLink(link: Omit<StageLink, "id">) {
            set((s) => {
              // Hard refusals: self-link, and duplicate (toStageId,itemId) — a
              // feed lane has exactly one upstream source in v1 chaining.
              if (link.fromStageId === link.toStageId) return {};
              const duplicate = s.links.some(
                (l) =>
                  l.toStageId === link.toStageId && l.itemId === link.itemId,
              );
              if (duplicate) return {};
              const links = [...s.links, { ...link, id: crypto.randomUUID() }];
              // Dangling ends (a stage not producing/consuming itemId) are KEPT
              // and surface as findings, not refused.
              return recomputeReconciliation({ ...s, links });
            });
          },

          removeLink(id: string) {
            set((s) =>
              recomputeReconciliation({
                ...s,
                links: s.links.filter((l) => l.id !== id),
              }),
            );
          },

          setStagePosition(id: string, pos: { x: number; y: number }) {
            // Pure position write — no derive, no reconciliation (cadence row:
            // none/none). The canvas commits this once on drag-end.
            set((s) => {
              if (s.stages[id] === undefined) return {};
              return { positions: { ...s.positions, [id]: pos } };
            });
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
                const s = get();
                const indexOf = new Map(s.stageOrder.map((id, i) => [id, i]));
                const stages = s.stageOrder.map((id) => {
                  const node = s.stages[id]!;
                  return {
                    name: node.name,
                    selection: node.selection,
                    position: s.positions[id],
                  };
                });
                const links = s.links.map((l) => ({
                  from: indexOf.get(l.fromStageId)!,
                  to: indexOf.get(l.toStageId)!,
                  itemId: l.itemId,
                }));
                if (match) {
                  const prior = await loadPlanFile(match.id);
                  const plan: PlanFileV2 = {
                    format_version: 2,
                    name: trimmed,
                    createdAt: prior?.createdAt ?? now,
                    updatedAt: now,
                    stages,
                    links,
                  };
                  await savePlanFile(plan, match.id);
                } else {
                  const plan: PlanFileV2 = {
                    format_version: 2,
                    name: trimmed,
                    createdAt: now,
                    updatedAt: now,
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
                const plan = await loadPlanFile(id);
                if (plan === null) {
                  // Corrupt/missing → planError, state untouched.
                  set({ planError: "plan could not be loaded" });
                  return;
                }
                // Whole-graph replacement (Stage 3 / Phase 3, frozen Axis 4).
                set((s) => rebuildFromPlan(s, plan));
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
                // loadPlanFile returns v2 (migrating a v1 row), so this spread
                // widens to v2 — renaming a v1 row rewrites it as v2, consistent
                // with the save-over model (any write persists v2).
                const renamed: PlanFileV2 = {
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

          // Pure read: loadPlanFile already migrates a v1 row to v2 in memory,
          // so the export is what a LOAD would see (the honest v2 form). Returns
          // null on missing/corrupt; no enqueue (writes nothing, sets no error)
          // and no DOM — App does the Blob/anchor download. (Frozen Axis 3.)
          async exportPlan(id: string): Promise<string | null> {
            const plan = await loadPlanFile(id);
            if (plan === null) return null;
            return JSON.stringify(plan, null, 2);
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
                // The SAME acceptance loadPlanFile uses (v2, else v1→migrateV1):
                // a foreign/corrupt payload is refused, nothing written.
                const file = validatePlanFile(parsed);
                if (file === null) {
                  set({ planError: "import failed: not a valid plan file" });
                  return;
                }
                // OUR name rules (imports were never validated by them): trim,
                // refuse-empty. The trimmed form is what saves AND what
                // collision-matches — mirroring savePlanAs exactly.
                const trimmed = file.name.trim();
                if (trimmed === "") {
                  set({ planError: "plan name required" });
                  return;
                }
                const existing = await listPlanFiles();
                const match = existing.find((p) => p.name === trimmed);
                const now = new Date().toISOString();
                if (match) {
                  // Overwrite the existing row: keep ITS createdAt (a foreign
                  // payload's timestamp is untrusted), stamp updatedAt now.
                  const prior = await loadPlanFile(match.id);
                  const plan: PlanFileV2 = {
                    ...file,
                    name: trimmed,
                    createdAt: prior?.createdAt ?? now,
                    updatedAt: now,
                  };
                  await savePlanFile(plan, match.id);
                } else {
                  // New row: createdAt now (savePlanAs precedent — new names get
                  // now, never the untrusted foreign timestamp).
                  const plan: PlanFileV2 = {
                    ...file,
                    name: trimmed,
                    createdAt: now,
                    updatedAt: now,
                  };
                  await savePlanFile(plan, crypto.randomUUID());
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
