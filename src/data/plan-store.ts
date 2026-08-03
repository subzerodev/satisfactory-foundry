/**
 * Named-plan persistence (ticket #11), mirroring catalog-store's posture: a
 * versioned, JSON-safe file shape + a small reviver-style shape check, over the
 * `plans` IDB store. A plan stores USER INTENT only — exactly the `Selection`
 * shape (strings/numbers/null arrays, never Fractions) — so exactness is trivial:
 * rates are never stored, only the user's own input text. Plans reference recipes
 * by id against whatever catalog is live at load time.
 *
 * `stages` is an array from day one and `links` a reserved empty array, so
 * Stage 3 adds nodes/edges without a format break (`format_version` bumps only
 * if a field's MEANING changes).
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

/** A list-row projection — enough to render + address a plan without loading it. */
export interface PlanListEntry {
  id: string;
  name: string;
  updatedAt: string;
}

/** Persist a plan file under `id` (create or overwrite). */
export async function savePlan(plan: PlanFileV1, id: string): Promise<void> {
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
    if (isPlanFileV1(value)) {
      entries.push({ id: key, name: value.name, updatedAt: value.updatedAt });
    }
  }
  entries.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return entries;
}

/** Load + validate one plan. Returns null on missing OR corrupt-for-this-build. */
export async function loadPlan(id: string): Promise<PlanFileV1 | null> {
  const db = await openDb();
  const value = await db.get<unknown>(PLANS_STORE, id);
  return isPlanFileV1(value) ? value : null;
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
  if (!Array.isArray(v.stages)) return false;
  return v.stages.every(isStageShape);
}

function isStageShape(stage: unknown): boolean {
  if (stage === null || typeof stage !== "object") return false;
  const selection = (stage as Record<string, unknown>).selection;
  return isSelectionShape(selection);
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
