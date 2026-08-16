/**
 * Named-plan persistence (ticket #11), mirroring catalog-store's posture: a
 * versioned, JSON-safe file shape + a small reviver-style shape check, over the
 * `plans` IDB store. A plan stores USER INTENT only — exactly the `Selection`
 * shape (strings/numbers/null arrays, never Fractions) — so exactness is trivial:
 * rates are never stored, only the user's own input text. Plans reference recipes
 * by id against whatever catalog is live at load time.
 *
 * `stages` is an array from day one and `links` a reserved empty array in v1, so
 * Stage 3 added nodes/edges WITH a format bump: `PlanFileV2` carries the whole
 * graph (per-stage name + position, index-encoded links). Stage 7 / Phase 2 adds
 * `PlanFileV3` — the same graph plus optional per-link `transport`. Stage 8 /
 * Phase 2 adds `PlanFileV4` — the same graph, now with the transport union's two
 * S8P2 extensions (pipe `deratePercentText`, train `sharedEnds`) legal in the
 * per-link config. Stage 10 / Phase 1 adds `PlanFileV5` — the same graph plus a
 * top-level `flowDirection` ("LR"|"TB") and an optional per-stage `userPlaced?:
 * true` flag. Extraction planning adds `PlanFileV6`, with required placement
 * origin and optional per-resource extractor intent. Purity mixes add
 * `PlanFileV7`. Packaging intersteps add the closed-world `PlanFileV8`; save
 * always writes v8, while reads accept v1-v8 and migrate older files in memory.
 *
 * WHY a v5 bump and not v4-in-place (both new fields are optional-shaped): a
 * pre-Stage-10 build's v4 validator IGNORES the top-level `flowDirection` and the
 * per-stage `userPlaced`, so a TB-laid, position-pinned file would validate under
 * the old build and SILENTLY DROP both — it would render the chart's vertical
 * layout with LR handles, and lose the auto-vs-user placement distinction on the
 * next direction switch. A v5 header makes the old build reject the file loudly
 * (load → null) instead. Same silent-drop argument recorded for v4 (and v3).
 *
 * WHY a v4 bump and not v3-in-place (both new fields are optional): a pre-P2
 * build's v3 validator IGNORES the new fields (`isTransportShape`'s pipe arm
 * returned `true` bare), so a file carrying a derate would validate under the
 * old build and SILENTLY DROP the user's derate — the plan would render with a
 * different meaning than saved. A v4 header makes the old build reject the file
 * loudly (load → null) instead. Same argument recorded when v3 was affirmed.
 */

import type {
  Selection,
  FlowDirection,
  ExtractionSelection,
} from "../state/store.ts";
import type {
  LinkTransport,
  PackagingInterstep,
  TransportMode,
} from "../core/link-transport.ts";
import type { DroneFuel } from "../core/transport-facts.ts";
import { Fraction } from "../core/fraction.ts";
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
 * now carry names + positions and `links` reference stages by index. Version 2
 * writers emitted this shape; current reads migrate it to v8.
 */
export interface PlanFileV2 {
  format_version: 2;
  name: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  stages: PlanStageV2[];
  links: PlanLinkV2[];
}

/**
 * Stage 7 / Phase 2: one graph edge in a v3 file — a `PlanLinkV2` plus optional
 * per-link `transport`. The stage-reference identity (index-based `{from, to,
 * itemId}`) is UNTOUCHED; only the transport PAYLOAD is added, carried verbatim
 * as the same raw user text the state link holds (the Selection precedent).
 */
export interface PlanLinkV3 extends PlanLinkV2 {
  transport?: LinkTransport;
}

/**
 * Stage 7 / Phase 2: the whole-graph file with per-link transport. Same header +
 * stages as v2; `links` are `PlanLinkV3`. Version 3 writers emitted this shape;
 * current reads migrate it to v8.
 */
export interface PlanFileV3 {
  format_version: 3;
  name: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  stages: PlanStageV2[];
  links: PlanLinkV3[];
}

/**
 * Stage 8 / Phase 2: one graph edge in a v4 file — a `PlanLinkV3` whose
 * `transport` may now carry the S8P2 extensions (pipe `deratePercentText`, train
 * `sharedEnds`). The shape is identical to V3 at the type level (both reference
 * the one `LinkTransport` union, whose extensions ARE the v4 change), so this is
 * a documentation-carrying alias — the validator (`isPlanFileV4`) is where v4
 * actually admits the new fields.
 */
export type PlanLinkV4 = PlanLinkV3;

/**
 * Stage 8 / Phase 2: the whole-graph file with the extended transport union.
 * Same header + stages as v3; `links` are `PlanLinkV4`. Version 4 writers
 * emitted this shape; current reads migrate it to v8. State and file keep
 * sharing the ONE `LinkTransport`
 * union (the S7P2 verbatim-boundary invariant) — nothing to map at the edge.
 */
export interface PlanFileV4 {
  format_version: 4;
  name: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  stages: PlanStageV2[];
  links: PlanLinkV4[];
}

/**
 * Stage 10 / Phase 1: a v5 stage entry — a v2 stage (name + selection +
 * optional position) plus an optional `userPlaced?: true` flag. The flag marks a
 * stage the user hand-dragged, so the direction switch leaves it pinned while
 * re-gridding the auto-placed ones. It PERSISTS because save writes `position`
 * unconditionally: position-presence alone can't survive a round-trip as an
 * auto-vs-user signal (every auto slot materializes into a file position), so
 * the flag is the only durable carrier of the distinction. Written ONLY for
 * user-placed stages; absent ⇒ auto-placed.
 */
export interface PlanStageV5 extends PlanStageV2 {
  userPlaced?: true;
}

/**
 * Stage 10 / Phase 1: the whole-graph file with a persisted flow direction and
 * per-stage placement intent. Same header + links as v4; `stages` are
 * `PlanStageV5` and a top-level `flowDirection` ("LR"|"TB") records the chart's
 * orientation. Version 5 writers emitted this shape; current reads migrate it
 * to v7, with older files defaulting `flowDirection: "LR"`.
 * Orientation is a property of the drawing (like positions), so it persists
 * per-plan — a TB chart reloaded must come back TB, not render vertical with
 * left/right handles.
 */
export interface PlanFileV5 {
  format_version: 5;
  name: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  flowDirection: FlowDirection;
  stages: PlanStageV5[];
  links: PlanLinkV4[];
}

interface ExtractionSelectionV6 {
  machineId: string;
  clockPercentText: string;
}

export interface PlanStageV6 extends PlanStageV2 {
  userPlaced: boolean;
  extraction?: Record<string, ExtractionSelectionV6>;
}

export interface PlanFileV6 {
  format_version: 6;
  name: string;
  createdAt: string;
  updatedAt: string;
  flowDirection: FlowDirection;
  stages: PlanStageV6[];
  links: PlanLinkV4[];
}

export interface PlanStageV7 extends PlanStageV2 {
  userPlaced: boolean;
  extraction?: Record<string, ExtractionSelection>;
}

export interface PlanFileV7 {
  format_version: 7;
  name: string;
  createdAt: string;
  updatedAt: string;
  flowDirection: FlowDirection;
  stages: PlanStageV7[];
  links: PlanLinkV4[];
}

export interface PlanLinkV8 extends PlanLinkV2 {
  transport?: LinkTransport;
  interstep?: PackagingInterstep;
}

export interface PlanFileV8 {
  format_version: 8;
  name: string;
  createdAt: string;
  updatedAt: string;
  flowDirection: FlowDirection;
  stages: PlanStageV7[];
  links: PlanLinkV8[];
}

/** The 7-key `DroneFuel` union as a validator lookup set (the file validator
 *  pins the drone arm's `fuel` ∈ these). */
const DRONE_FUELS: ReadonlySet<string> = new Set<DroneFuel>([
  "packaged-fuel",
  "packaged-turbofuel",
  "battery",
  "packaged-rocket-fuel",
  "uranium-fuel-rod",
  "packaged-ionized-fuel",
  "plutonium-fuel-rod",
]);

/** The road+train modes whose arm carries a `trip` (not belt/pipe, not drone). */
const VEHICLE_MODES: ReadonlySet<string> = new Set<TransportMode>([
  "truck",
  "tractor",
  "explorer",
  "fluid-truck",
  "train",
]);

/** A list-row projection — enough to render + address a plan without loading it. */
export interface PlanListEntry {
  id: string;
  name: string;
  updatedAt: string;
}

/** Persist a plan file under `id` (create or overwrite). Always v8. */
export async function savePlan(plan: PlanFileV8, id: string): Promise<void> {
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
    // Any loadable format renders a row. Header fields co-locate across all
    // eight versions.
    if (
      isPlanFileV8(value) ||
      isPlanFileV7(value) ||
      isPlanFileV6(value) ||
      isPlanFileV5(value) ||
      isPlanFileV4(value) ||
      isPlanFileV3(value) ||
      isPlanFileV2(value) ||
      isPlanFileV1(value)
    ) {
      entries.push({ id: key, name: value.name, updatedAt: value.updatedAt });
    }
  }
  entries.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return entries;
}

/**
 * Validate an arbitrary value as a plan file THIS build can use, returning a
 * `PlanFileV8` (migrating a valid v7/v6/v5/v4/v3/v2/v1 in memory) or null on
 * corrupt/foreign. The single acceptance rule shared by `loadPlan` (IDB rows)
 * and `importPlan` (uploaded exports): v8 first, then each older format through
 * its migration chain.
 */
export function validatePlanFile(value: unknown): PlanFileV8 | null {
  if (isPlanFileV8(value)) return value;
  if (isPlanFileV7(value)) return migrateV7(value);
  if (isPlanFileV6(value)) return migrateV7(migrateV6(value));
  if (isPlanFileV5(value)) return migrateV7(migrateV6(migrateV5(value)));
  if (isPlanFileV4(value)) {
    return migrateV7(migrateV6(migrateLegacyV4(value)));
  }
  if (isPlanFileV3(value)) {
    return migrateV7(migrateV6(migrateLegacyV4(migrateV3(value))));
  }
  if (isPlanFileV2(value)) {
    return migrateV7(migrateV6(migrateLegacyV4(migrateV3(migrateV2(value)))));
  }
  if (isPlanFileV1(value)) {
    return migrateV7(
      migrateV6(migrateLegacyV4(migrateV3(migrateV2(migrateV1(value))))),
    );
  }
  return null;
}

/**
 * Load + validate one plan, returning a `PlanFileV8` (migrating v7 and older
 * files in memory). Returns null on missing OR corrupt-for-this-build. V8 is
 * tried first; older files follow their migration chain. Migration is read-side
 * only — the stored row is untouched until the next save-over (v8).
 */
export async function loadPlan(id: string): Promise<PlanFileV8 | null> {
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

/**
 * Migrate a validated v2 file to v3 in memory (Stage 7 / Phase 2): mechanical —
 * stages carry over unchanged; each link maps to itself with `transport` absent
 * (⇒ the belt default). Timestamps carry VERBATIM (the save-over path reads the
 * prior file's createdAt, so a migrated row must not reset its creation time).
 */
export function migrateV2(plan: PlanFileV2): PlanFileV3 {
  return {
    format_version: 3,
    name: plan.name,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    stages: plan.stages,
    links: plan.links.map((l) => ({
      from: l.from,
      to: l.to,
      itemId: l.itemId,
    })),
  };
}

/**
 * Migrate a validated v3 file to v4 in memory (Stage 8 / Phase 2): IDENTITY on
 * the graph — the v4 transport extensions are additive and OPTIONAL, so a v3
 * link (which never carried them) maps to itself with the new fields absent.
 * Only the version header flips. Timestamps carry VERBATIM (the save-over path
 * reads the prior file's createdAt, so a migrated row must not reset it).
 */
export function migrateV3(plan: PlanFileV3): PlanFileV4 {
  return {
    format_version: 4,
    name: plan.name,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    stages: plan.stages,
    links: plan.links,
  };
}

/**
 * Migrate a validated v4 file to v5 in memory (Stage 10 / Phase 1): IDENTITY on
 * the graph — a v4 file never carried a direction, so it migrates as `"LR"`,
 * which is exactly how it was laid out (the implicit pre-v5 orientation). Stages
 * carry over unchanged (no `userPlaced` flag — a pre-v5 file's seeding falls back
 * to position-presence at load, the store's conservative pinning cost). Only the
 * version header flips + the direction defaults. Timestamps carry VERBATIM (the
 * save-over path reads the prior file's createdAt, so a migrated row must not
 * reset it).
 */
export function migrateV4(plan: PlanFileV4): PlanFileV5 {
  return {
    format_version: 5,
    name: plan.name,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    flowDirection: "LR",
    stages: plan.stages,
    links: plan.links,
  };
}

export function migrateV5(plan: PlanFileV5): PlanFileV6 {
  return {
    format_version: 6,
    name: plan.name,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    flowDirection: plan.flowDirection,
    stages: plan.stages.map((stage) => ({
      name: stage.name,
      selection: stage.selection,
      ...(stage.position !== undefined ? { position: stage.position } : {}),
      userPlaced: stage.userPlaced === true,
    })),
    links: plan.links,
  };
}

export function migrateV6(plan: PlanFileV6): PlanFileV7 {
  return {
    ...plan,
    format_version: 7,
    stages: plan.stages.map((stage) => ({
      ...stage,
      extraction: copyHistoricalExtraction(stage.extraction),
    })),
  };
}

export function migrateV7(plan: PlanFileV7): PlanFileV8 {
  return {
    format_version: 8,
    name: plan.name,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    flowDirection: plan.flowDirection,
    stages: plan.stages,
    links: plan.links.map((link) => ({
      from: link.from,
      to: link.to,
      itemId: link.itemId,
      ...(link.transport !== undefined
        ? { transport: canonicalLegacyTransport(link.transport) }
        : {}),
    })),
  };
}

function canonicalLegacyTransport(transport: LinkTransport): LinkTransport {
  switch (transport.mode) {
    case "belt":
      return { mode: "belt" };
    case "pipe":
      return {
        mode: "pipe",
        ...(transport.deratePercentText !== undefined
          ? { deratePercentText: transport.deratePercentText }
          : {}),
      };
    case "truck":
    case "tractor":
    case "explorer":
    case "fluid-truck":
      return {
        mode: transport.mode,
        trip: canonicalVehicleTrip(transport.trip),
      };
    case "train": {
      const sharedEnds = transport.sharedEnds;
      return {
        mode: "train",
        trip: canonicalVehicleTrip(transport.trip),
        ...(sharedEnds !== undefined
          ? {
              sharedEnds: {
                ...(sharedEnds.from === true ? { from: true as const } : {}),
                ...(sharedEnds.to === true ? { to: true as const } : {}),
              },
            }
          : {}),
      };
    }
    case "drone":
      return {
        mode: "drone",
        fuel: transport.fuel,
        trip:
          transport.trip.kind === "estimated"
            ? {
                kind: "estimated",
                flightMetersText: transport.trip.flightMetersText,
              }
            : {
                kind: "measured",
                roundTripSecondsText: transport.trip.roundTripSecondsText,
                ...(transport.trip.flightMetersText !== undefined
                  ? { flightMetersText: transport.trip.flightMetersText }
                  : {}),
              },
      };
  }
}

function canonicalVehicleTrip(
  trip:
    | { kind: "measured"; roundTripSecondsText: string }
    | { kind: "estimated"; distanceText: string },
) {
  return trip.kind === "measured"
    ? {
        kind: "measured" as const,
        roundTripSecondsText: trip.roundTripSecondsText,
      }
    : { kind: "estimated" as const, distanceText: trip.distanceText };
}

function copyHistoricalExtraction(
  extraction: Record<string, ExtractionSelectionV6> | undefined,
): Record<string, ExtractionSelection> | undefined {
  if (extraction === undefined) return undefined;
  const copied: Record<string, ExtractionSelection> = Object.create(null);
  for (const [itemId, selection] of Object.entries(extraction)) {
    copied[itemId] = {
      machineId: selection.machineId,
      clockPercentText: selection.clockPercentText,
    };
  }
  return copied;
}

function migrateLegacyV4(plan: PlanFileV4): PlanFileV6 {
  return {
    format_version: 6,
    name: plan.name,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    flowDirection: "LR",
    stages: plan.stages.map((stage) => ({
      name: stage.name,
      selection: stage.selection,
      ...(stage.position !== undefined ? { position: stage.position } : {}),
      userPlaced: stage.position !== undefined,
    })),
    links: plan.links,
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

/**
 * Reviver-style shape check for a PlanFileV3 (Stage 7 / Phase 2). Identical to
 * the v2 check on header/stages/link-index invariants (self-link, in-range,
 * duplicate `(to, itemId)` — the frozen P1 refusals at the file boundary), PLUS
 * an optional per-link `transport` validated by {@link isTransportShape}:
 *
 * - `mode` ∈ the 8-mode enum;
 * - belt/pipe carry no `trip`;
 * - road+train modes carry a measured (roundTripSecondsText) or estimated
 *   (distanceText) trip, whose string must `Fraction.parse` to a POSITIVE value;
 * - drone carries `fuel` ∈ the 7-key `DroneFuel` union + its own measured/
 *   estimated trip (positive-Fraction strings; the measured arm's optional
 *   flightMetersText, when present, positive too).
 *
 * Invalid transport on an otherwise-valid link FAILS validation (the file
 * validator's strictness elsewhere — no silent dropping).
 */
function isPlanFileV3(value: unknown): value is PlanFileV3 {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.format_version !== 3) return false;
  return isGraphFileBody(v, isTransportShape);
}

/**
 * Reviver-style shape check for a PlanFileV4 (Stage 8 / Phase 2). Identical to
 * the v3 header/stages/link-index invariants; the ONLY difference is the
 * transport checker — v4 admits (and strictly validates) the two S8P2
 * extensions via {@link isTransportShapeV4}: pipe `deratePercentText` must parse
 * to (0,100]; train `sharedEnds` keys must be literally `true`; both are legal
 * ONLY on their own arm (a derate on belt/train, a `sharedEnds` on pipe/road →
 * validation FAILS, the strictness posture). A v3 file (which never carried the
 * fields) still loads — via `migrateV3`, not this check.
 */
function isPlanFileV4(value: unknown): value is PlanFileV4 {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.format_version !== 4) return false;
  return isGraphFileBody(v, isTransportShapeV4);
}

/**
 * Reviver-style shape check for a PlanFileV5 (Stage 10 / Phase 1). Identical to
 * the v4 header/stages/link-index invariants (same transport checker), PLUS a
 * top-level `flowDirection` that must be literally `"LR"` or `"TB"` and, on each
 * stage, an OPTIONAL `userPlaced` that — when present — must be literally `true`.
 * A malformed direction or a `userPlaced` that isn't `true` FAILS validation
 * (the strictness posture — no silent coercion). The per-stage `userPlaced`
 * check rides on `isStageV2Shape` via the extended {@link isStageV5Shape}.
 */
function isPlanFileV5(value: unknown): value is PlanFileV5 {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.format_version !== 5) return false;
  if (v.flowDirection !== "LR" && v.flowDirection !== "TB") return false;
  return isGraphFileBody(v, isTransportShapeV4, isStageV5Shape);
}

function isPlanFileV6(value: unknown): value is PlanFileV6 {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.format_version !== 6) return false;
  if (v.flowDirection !== "LR" && v.flowDirection !== "TB") return false;
  return isGraphFileBody(v, isTransportShapeV4, isStageV6Shape);
}

function isPlanFileV7(value: unknown): value is PlanFileV7 {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.format_version !== 7) return false;
  if (v.flowDirection !== "LR" && v.flowDirection !== "TB") return false;
  return isGraphFileBody(v, isTransportShapeV4, isStageV7Shape);
}

function isPlanFileV8(value: unknown): value is PlanFileV8 {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.format_version !== 8) return false;
  if (v.flowDirection !== "LR" && v.flowDirection !== "TB") return false;
  return isGraphFileBody(
    v,
    isRawTransportShapeV8,
    isStageV7Shape,
    isPlanLinkV8Shape,
  );
}

/**
 * The shared header/stages/link-index validation for whole-graph files v3-v7,
 * identical except for version-specific top-level fields checked by
 * the caller, the per-link transport checker, and the per-stage shape checker
 * passed in. Pins the frozen P1 refusals at the file boundary: self-link,
 * in-range indices, no duplicate `(to, itemId)` feed lane. `stageShape` defaults
 * to the v2/v3/v4 stage shape; v5-v7 pass their stricter stage checkers.
 */
function isGraphFileBody(
  v: Record<string, unknown>,
  transportShape: (t: unknown) => boolean,
  stageShape: (s: unknown) => boolean = isStageV2Shape,
  linkShape?: (link: Record<string, unknown>) => boolean,
): boolean {
  if (typeof v.name !== "string") return false;
  if (typeof v.createdAt !== "string" || typeof v.updatedAt !== "string") {
    return false;
  }
  if (!Array.isArray(v.stages) || v.stages.length < 1) return false;
  if (!v.stages.every(stageShape)) return false;
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
    const key = `${to} ${l.itemId}`; // duplicate (to, itemId) feed lane
    if (seen.has(key)) return false;
    seen.add(key);
    // transport is OPTIONAL; present ⇒ must pass the version's transport shape.
    if (l.transport !== undefined && !transportShape(l.transport)) {
      return false;
    }
    if (linkShape !== undefined && !linkShape(l)) return false;
  }
  return true;
}

function isPlanLinkV8Shape(link: Record<string, unknown>): boolean {
  if (
    !hasExactKeys(link, ["from", "to", "itemId"], ["transport", "interstep"])
  ) {
    return false;
  }
  if (link.interstep === undefined) return true;
  if (!isPackagingInterstepShape(link.interstep)) return false;
  return !isIllegalPackagedRoute(link.transport);
}

function isPackagingInterstepShape(
  value: unknown,
): value is PackagingInterstep {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(value, [
      "packageRecipeId",
      "clockPercentText",
      "returnTransport",
    ]) ||
    typeof value.packageRecipeId !== "string" ||
    typeof value.clockPercentText !== "string" ||
    !isRawTransportShapeV8(value.returnTransport)
  ) {
    return false;
  }
  return !isIllegalPackagedRoute(value.returnTransport);
}

function isIllegalPackagedRoute(value: unknown): boolean {
  if (value === undefined) return false;
  if (!isRecord(value)) return true;
  return value.mode === "pipe" || value.mode === "fluid-truck";
}

function isRawTransportShapeV8(value: unknown): value is LinkTransport {
  if (!isRecord(value) || typeof value.mode !== "string") return false;
  switch (value.mode) {
    case "belt":
      return hasExactKeys(value, ["mode"]);
    case "pipe":
      return (
        hasExactKeys(value, ["mode"], ["deratePercentText"]) &&
        (value.deratePercentText === undefined ||
          typeof value.deratePercentText === "string")
      );
    case "truck":
    case "tractor":
    case "explorer":
    case "fluid-truck":
      return (
        hasExactKeys(value, ["mode", "trip"]) &&
        isRawVehicleTripShape(value.trip)
      );
    case "train":
      return (
        hasExactKeys(value, ["mode", "trip"], ["sharedEnds"]) &&
        isRawVehicleTripShape(value.trip) &&
        (value.sharedEnds === undefined ||
          isStrictSharedEndsShape(value.sharedEnds))
      );
    case "drone":
      return (
        hasExactKeys(value, ["mode", "fuel", "trip"]) &&
        typeof value.fuel === "string" &&
        DRONE_FUELS.has(value.fuel) &&
        isRawDroneTripShape(value.trip)
      );
    default:
      return false;
  }
}

function isRawVehicleTripShape(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.kind === "measured") {
    return (
      hasExactKeys(value, ["kind", "roundTripSecondsText"]) &&
      typeof value.roundTripSecondsText === "string"
    );
  }
  if (value.kind === "estimated") {
    return (
      hasExactKeys(value, ["kind", "distanceText"]) &&
      typeof value.distanceText === "string"
    );
  }
  return false;
}

function isRawDroneTripShape(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.kind === "measured") {
    return (
      hasExactKeys(
        value,
        ["kind", "roundTripSecondsText"],
        ["flightMetersText"],
      ) &&
      typeof value.roundTripSecondsText === "string" &&
      (value.flightMetersText === undefined ||
        typeof value.flightMetersText === "string")
    );
  }
  if (value.kind === "estimated") {
    return (
      hasExactKeys(value, ["kind", "flightMetersText"]) &&
      typeof value.flightMetersText === "string"
    );
  }
  return false;
}

function isStrictSharedEndsShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, [], ["from", "to"]) &&
    (value.from === undefined || value.from === true) &&
    (value.to === undefined || value.to === true)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  for (const key of required) {
    if (!Object.hasOwn(value, key)) return false;
  }
  const allowed = new Set([...required, ...optional]);
  return Object.keys(value).every((key) => allowed.has(key));
}

/** A trip-string field: present, a string, and `Fraction.parse`-positive. */
function isPositiveFractionText(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  try {
    return Fraction.parse(raw).gt(Fraction.from(0));
  } catch {
    return false;
  }
}

/**
 * Validate a file link's `transport` against the frozen `LinkTransport` union.
 * The mode discriminant selects the arm; each arm's trip/flight strings must be
 * positive Fractions, and the drone arm's `fuel` must be a known `DroneFuel`.
 */
function isTransportShape(value: unknown): value is LinkTransport {
  if (value === null || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  const mode = t.mode;
  if (typeof mode !== "string") return false;

  if (mode === "belt" || mode === "pipe") {
    // Trip-less continuous modes carry no other transport fields.
    return true;
  }

  if (VEHICLE_MODES.has(mode)) {
    const trip = t.trip as Record<string, unknown> | null;
    if (trip === null || typeof trip !== "object") return false;
    if (trip.kind === "measured") {
      return isPositiveFractionText(trip.roundTripSecondsText);
    }
    if (trip.kind === "estimated") {
      return isPositiveFractionText(trip.distanceText);
    }
    return false;
  }

  if (mode === "drone") {
    if (typeof t.fuel !== "string" || !DRONE_FUELS.has(t.fuel)) return false;
    const trip = t.trip as Record<string, unknown> | null;
    if (trip === null || typeof trip !== "object") return false;
    if (trip.kind === "measured") {
      if (!isPositiveFractionText(trip.roundTripSecondsText)) return false;
      // The measured arm's flight distance is OPTIONAL; when present, positive.
      if (
        trip.flightMetersText !== undefined &&
        !isPositiveFractionText(trip.flightMetersText)
      ) {
        return false;
      }
      return true;
    }
    if (trip.kind === "estimated") {
      return isPositiveFractionText(trip.flightMetersText);
    }
    return false;
  }

  return false; // unknown mode
}

/** A derate-percent string: present, a string, `Fraction.parse`s, and in (0,100]
 *  — > 0 AND ≤ 100 (100 = "no derate"; > 100 is a boost, refused; ≤ 0 refused). */
function isDeratePercentText(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  let pct: Fraction;
  try {
    pct = Fraction.parse(raw);
  } catch {
    return false;
  }
  return pct.gt(Fraction.from(0)) && pct.lte(Fraction.from(100));
}

/** A `sharedEnds` value: an object whose `from`/`to`, when present, are literally
 *  `true` (the absent-or-true idiom — a `false` or any other value FAILS). No
 *  keys is legal at the shape level (the store strips an all-absent sharedEnds,
 *  but a persisted `{}` is not itself corrupt). */
function isSharedEndsShape(raw: unknown): boolean {
  if (raw === null || typeof raw !== "object") return false;
  const s = raw as Record<string, unknown>;
  if (s.from !== undefined && s.from !== true) return false;
  if (s.to !== undefined && s.to !== true) return false;
  return true;
}

/**
 * The v4 transport shape check (Stage 8 / Phase 2). Everything {@link
 * isTransportShape} enforces, PLUS the two S8P2 extensions validated per-arm and
 * REFUSED on any other arm (the strictness posture — misplaced fields FAIL):
 *
 * - `deratePercentText` is legal ONLY on pipe, and when present must parse to
 *   (0,100]; on ANY other mode its presence fails.
 * - `sharedEnds` is legal ONLY on train, and when present must be the absent-or-
 *   true shape; on ANY other mode its presence fails.
 *
 * Belt/pipe no longer share one arm here: belt carries neither field; pipe may
 * carry `deratePercentText` (not `sharedEnds`). The base check (which accepts
 * belt/pipe bare and ignores extras) is the v3 leniency — v4 tightens it.
 */
function isTransportShapeV4(value: unknown): value is LinkTransport {
  if (!isTransportShape(value)) return false;
  const t = value as Record<string, unknown>;
  const mode = t.mode as string;

  // deratePercentText: pipe-only; elsewhere its presence is a shape violation.
  if (t.deratePercentText !== undefined) {
    if (mode !== "pipe") return false;
    if (!isDeratePercentText(t.deratePercentText)) return false;
  }

  // sharedEnds: train-only; elsewhere its presence is a shape violation.
  if (t.sharedEnds !== undefined) {
    if (mode !== "train") return false;
    if (!isSharedEndsShape(t.sharedEnds)) return false;
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

/**
 * A v5 stage entry: `isStageV2Shape` (name + selection + optional position) plus
 * an OPTIONAL `userPlaced` that — when present — must be literally `true`. Any
 * other value (false, 1, "true") is corrupt-for-this-build (the strictness
 * posture — the flag is a write-only-when-set marker, never a tri-state).
 */
function isStageV5Shape(stage: unknown): boolean {
  if (!isStageV2Shape(stage)) return false;
  const s = stage as Record<string, unknown>;
  if (s.userPlaced !== undefined && s.userPlaced !== true) return false;
  return true;
}

function isStageV6Shape(stage: unknown): boolean {
  if (!isStageV2Shape(stage)) return false;
  const s = stage as Record<string, unknown>;
  if (typeof s.userPlaced !== "boolean") return false;
  if (s.extraction === undefined) return true;
  if (
    s.extraction === null ||
    typeof s.extraction !== "object" ||
    Array.isArray(s.extraction)
  ) {
    return false;
  }
  for (const [itemId, rawSelection] of Object.entries(s.extraction)) {
    if (
      itemId === "" ||
      rawSelection === null ||
      typeof rawSelection !== "object"
    ) {
      return false;
    }
    const selection = rawSelection as Record<string, unknown>;
    if (typeof selection.machineId !== "string" || selection.machineId === "") {
      return false;
    }
    if (typeof selection.clockPercentText !== "string") return false;
  }
  return true;
}

function isStageV7Shape(stage: unknown): boolean {
  if (!isStageV6Shape(stage)) return false;
  const extraction = (stage as Record<string, unknown>).extraction;
  if (extraction === undefined) return true;
  for (const rawSelection of Object.values(
    extraction as Record<string, unknown>,
  )) {
    const selection = rawSelection as Record<string, unknown>;
    if (selection.purityMix === undefined) continue;
    const purityMix = selection.purityMix;
    if (
      purityMix === null ||
      typeof purityMix !== "object" ||
      Array.isArray(purityMix)
    ) {
      return false;
    }
    const mix = purityMix as Record<string, unknown>;
    if (
      typeof mix.impure !== "string" ||
      typeof mix.normal !== "string" ||
      typeof mix.pure !== "string"
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
