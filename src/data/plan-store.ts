/**
 * Named-plan persistence (ticket #11), mirroring catalog-store's posture: a
 * versioned, JSON-safe file shape + a small reviver-style shape check, over the
 * `plans` IDB store. A plan stores USER INTENT only — exactly the `Selection`
 * shape (strings/numbers/null arrays, never Fractions) — so exactness is trivial:
 * rates are never stored, only the user's own input text. Plans reference recipes
 * by id against whatever catalog is live at load time.
 *
 * `stages` is an array from day one and `links` a reserved empty array in v1, so
 * Stage 3 adds nodes/edges WITH a format bump: `PlanFileV2` carries the whole
 * graph (per-stage name + position, index-encoded links). Save always writes v2;
 * read accepts both, migrating v1 in memory (`migrateV1`). The v1-era validator
 * structurally rejects populated links, so a multi-stage file honestly stamps
 * `format_version: 2`.
 */

import type { Selection } from "../state/store.ts";
import { openDb } from "./db.ts";

const PLANS_STORE = "plans";

export interface PlanFileV1 {
  format_version: 1;
  name: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  stages: { selection: Selection }[]; // exactly 1 entry in Stage 2
  links: never[]; // reserved: Stage-3 edges (empty array now)
}

/** One stage entry in a v2 file: name + selection, optional canvas position. */
export interface PlanStageV2 {
  name: string;
  selection: Selection;
  /** Canvas coordinates. Absent for v1-migrated files → auto-slotted on load. */
  position?: { x: number; y: number };
}

/**
 * One graph edge in a v2 file. Stage references are ARRAY INDICES into `stages`
 * (id-free, stable across saves/devices; array order IS stageOrder). The
 * validator pins `from`/`to` in range, `from !== to`, and no duplicate
 * `(to, itemId)` — the file-boundary form of the frozen P1 refusal invariants.
 */
export interface PlanLinkV2 {
  from: number;
  to: number;
  itemId: string;
}

/**
 * Stage 3 / Phase 3: the whole-graph file. Same header fields as v1; `stages`
 * now carry names + positions and `links` reference stages by index. Save always
 * writes this; `loadPlanFile` returns it directly (v2) or via `migrateV1` (v1).
 */
export interface PlanFileV2 {
  format_version: 2;
  name: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  stages: PlanStageV2[];
  links: PlanLinkV2[];
}

/** A list-row projection — enough to render + address a plan without loading it. */
export interface PlanListEntry {
  id: string;
  name: string;
  updatedAt: string;
}

/** Persist a plan file under `id` (create or overwrite). Always v2. */
export async function savePlan(plan: PlanFileV2, id: string): Promise<void> {
  const db = await openDb();
  await db.put(PLANS_STORE, plan, id);
}

/**
 * List every saved plan as a lightweight `{ id, name, updatedAt }` row, sorted
 * by `updatedAt` descending. A row that fails the shape check is SKIPPED (a
 * corrupt or foreign row is never a crash) — the list is best-effort by design.
 */
export async function listPlans(): Promise<PlanListEntry[]> {
  const db = await openDb();
  const rows = await db.getAllWithKeys<unknown>(PLANS_STORE);
  const entries: PlanListEntry[] = [];
  for (const { key, value } of rows) {
    // Either format renders a row: a v1 file is still loadable (via migration),
    // and a v2 file is the current shape. Header fields co-locate in both.
    if (isPlanFileV2(value) || isPlanFileV1(value)) {
      entries.push({ id: key, name: value.name, updatedAt: value.updatedAt });
    }
  }
  entries.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return entries;
}

/**
 * Validate an arbitrary value as a plan file THIS build can use, returning a
 * `PlanFileV2` (migrating a valid v1 in memory) or null on corrupt/foreign.
 * The single acceptance rule shared by `loadPlan` (IDB rows) and `importPlan`
 * (uploaded exports): v2 first, else a valid v1 via `migrateV1`.
 */
export function validatePlanFile(value: unknown): PlanFileV2 | null {
  if (isPlanFileV2(value)) return value;
  if (isPlanFileV1(value)) return migrateV1(value);
  return null;
}

/**
 * Load + validate one plan, returning a `PlanFileV2` (migrating a v1 file in
 * memory). Returns null on missing OR corrupt-for-this-build. V2 is tried first;
 * a valid v1 file falls back to `migrateV1`. Migration is read-side only — the
 * stored row is untouched until the next save-over (which writes v2).
 */
export async function loadPlan(id: string): Promise<PlanFileV2 | null> {
  const db = await openDb();
  const value = await db.get<unknown>(PLANS_STORE, id);
  return validatePlanFile(value);
}

/**
 * Migrate a validated v1 file to v2 in memory: exactly one stage named
 * "Stage 1" (v1 entries are `{selection}` only — no persisted name to carry),
 * no position (→ auto-slotted on load), empty links. `createdAt`/`updatedAt` are
 * carried VERBATIM — the save-over path reads the prior file for `createdAt`, so
 * a migrated row must not reset its creation time.
 */
export function migrateV1(plan: PlanFileV1): PlanFileV2 {
  return {
    format_version: 2,
    name: plan.name,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    stages: [{ name: "Stage 1", selection: plan.stages[0]!.selection }],
    links: [],
  };
}

/** Delete a plan by id (no-op if absent). */
export async function deletePlan(id: string): Promise<void> {
  const db = await openDb();
  await db.delete(PLANS_STORE, id);
}

/**
 * Reviver-style shape check: is `value` a PlanFileV1 THIS build can use? An
 * unknowingly-newer `format_version` fails here — treated as
 * corrupt-for-this-build (reported, never crashed), not silently coerced.
 */
function isPlanFileV1(value: unknown): value is PlanFileV1 {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.format_version !== 1) return false;
  if (typeof v.name !== "string") return false;
  if (typeof v.createdAt !== "string" || typeof v.updatedAt !== "string") {
    return false;
  }
  // `links` is reserved for Stage-3 edges: a populated links in a v1 file is
  // corrupt-for-this-build (reserved means reserved).
  if (!Array.isArray(v.links) || v.links.length !== 0) return false;
  // At least one stage: Stage 2 writes exactly one, and loadPlan's
  // stages[0] access is only sound when non-empty (a foreign empty-stages
  // file must read as corrupt, not as a cryptic runtime error).
  if (!Array.isArray(v.stages) || v.stages.length < 1) return false;
  return v.stages.every(isStageShape);
}

function isStageShape(stage: unknown): boolean {
  if (stage === null || typeof stage !== "object") return false;
  const selection = (stage as Record<string, unknown>).selection;
  return isSelectionShape(selection);
}

/**
 * Reviver-style shape check for a PlanFileV2 (Stage 3 / Phase 3). Structural
 * invariants are corrupt-class, in the spirit of the v1 validator's strictness:
 *
 * - `format_version === 2`; name/createdAt/updatedAt strings;
 * - `stages` ≥1 entry, each `{ name: string, selection: Selection-shape,
 *   position?: {x,y} numbers }` (position optional — v2 saves always write it,
 *   but optional keeps the validator honest about what load actually requires);
 * - `links` (may be empty), each `{ from, to, itemId }` with `from`/`to` INTEGER
 *   indices in range, `from !== to`, and no duplicate `(to, itemId)` pair.
 *
 * These pins are the SOLE guard for the frozen P1 refusal invariants at load:
 * the store's load rebuild constructs link records DIRECTLY from these indices —
 * it never routes through `addLink` — so a file violating them is corrupt (load
 * refused, nothing destroyed), matching the v1 "populated links ⇒ corrupt"
 * precedent. Do NOT "simplify" them away. A link's `itemId` not matching the
 * current catalog is NOT corrupt — that is the catalog-relative dangling-link
 * case, handled at load, not a file-structural condition.
 */
function isPlanFileV2(value: unknown): value is PlanFileV2 {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.format_version !== 2) return false;
  if (typeof v.name !== "string") return false;
  if (typeof v.createdAt !== "string" || typeof v.updatedAt !== "string") {
    return false;
  }
  if (!Array.isArray(v.stages) || v.stages.length < 1) return false;
  if (!v.stages.every(isStageV2Shape)) return false;
  if (!Array.isArray(v.links)) return false;
  const stageCount = v.stages.length;
  const seen = new Set<string>();
  for (const link of v.links) {
    if (link === null || typeof link !== "object") return false;
    const l = link as Record<string, unknown>;
    if (typeof l.itemId !== "string") return false;
    if (!Number.isInteger(l.from) || !Number.isInteger(l.to)) return false;
    const from = l.from as number;
    const to = l.to as number;
    if (from < 0 || from >= stageCount || to < 0 || to >= stageCount) {
      return false;
    }
    if (from === to) return false; // self-link (frozen P1 refusal)
    const key = `${to} ${l.itemId}`; // duplicate (to, itemId) feed lane
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

/** A v2 stage entry: `{ name, selection, position? }` (position optional). */
function isStageV2Shape(stage: unknown): boolean {
  if (stage === null || typeof stage !== "object") return false;
  const s = stage as Record<string, unknown>;
  if (typeof s.name !== "string") return false;
  if (!isSelectionShape(s.selection)) return false;
  if (s.position !== undefined) {
    const p = s.position as Record<string, unknown> | null;
    if (
      p === null ||
      typeof p !== "object" ||
      typeof p.x !== "number" ||
      typeof p.y !== "number"
    ) {
      return false;
    }
  }
  return true;
}

function isSelectionShape(value: unknown): value is Selection {
  if (value === null || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  if (s.recipeId !== null && typeof s.recipeId !== "string") return false;
  // machineCount accepts number | null: a live selection can legitimately hold
  // NaN (only derive validates it), and JSON.stringify(NaN) emits null — so the
  // check must accept what save can produce. loadPlan's caller coerces null→NaN.
  if (typeof s.machineCount !== "number" && s.machineCount !== null) {
    return false;
  }
  if (typeof s.clockPercentText !== "string") return false;
  const tiers = s.unlockedTiers as Record<string, unknown> | null;
  if (
    tiers === null ||
    typeof tiers !== "object" ||
    typeof tiers.belt !== "number" ||
    typeof tiers.pipe !== "number"
  ) {
    return false;
  }
  const overrides = s.overrides as Record<string, unknown> | null;
  if (
    overrides === null ||
    typeof overrides !== "object" ||
    typeof overrides.feeds !== "object" ||
    overrides.feeds === null ||
    typeof overrides.outputs !== "object" ||
    overrides.outputs === null
  ) {
    return false;
  }
  return true;
}
