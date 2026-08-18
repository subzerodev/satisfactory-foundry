import type { Fraction } from "../core/fraction.ts";
import type {
  Catalog,
  CatalogExtractor,
  CatalogItem,
  MachinePower,
  RecipeIO,
} from "./types.ts";
import { TIER_TABLE } from "./tiers.ts";
import { parseRational } from "./stage-input.ts";
import { openDb } from "./db.ts";

const CATALOG_STORE = "catalog";
const CATALOG_KEY = "current";

/**
 * Bump when the parser schema changes in a way that invalidates previously
 * cached catalogs. A reader that sees a mismatch treats the cache as stale and
 * re-uploads Docs.json. Started at 1 (Phase 2).
 *
 * 1 → 2 (Stage 6 / Phase 1): machines now carry a `power` struct. The bump
 * DISCARDS every version-1 cached parse (no raw source is stored, only a hash —
 * there is no re-parse-from-source): bundled-catalog users re-parse invisibly on
 * next boot; an uploaded-Docs user falls back to bundled and re-uploads once.
 * The stale honesty note in the frozen brainstorm (Axis 2) is deliberate.
 *
 * 2 → 3 (Stage 7 / Phase 2): items now carry a `stackSize` Fraction | null
 * (parsed from `mStackSize`). Same discard-and-re-parse semantics as the 1→2
 * bump — a version-2 cache is stale, bundled/uploaded users re-parse once.
 *
 * 3 → 4 (Stage 12 / P0, #60): items gained the optional `isRawResource` flag
 * in Stage 11 P1 WITHOUT a bump, on the premise that a stale cache would
 * self-heal "on the next natural re-parse" — but a healthy bundled cache has
 * no such trigger, so the raw-feed feature stayed invisible for existing
 * users (Michael's field report). This bump supersedes that decision and
 * forces the one re-parse.
 *
 * 4 → 5 (S20 P3, #102): the catalog gained `recipeUnlocks` (recipe id → min
 * schematic unlock tier), parsed from FGSchematic. Same discard-and-re-parse
 * semantics as every prior bump, disclosed honestly: no raw Docs text is
 * stored (only a SHA-256 hash), so a BUNDLED-catalog user self-heals via the
 * bundled re-fetch, while an UPLOADED-Docs user falls back to the bundled
 * catalog (the banner flips, loudly) and re-uploads once. Uploaded Docs.json
 * carries FGSchematic identically (same game-export format), so the re-upload
 * lands with full tier data.
 *
 * 5 -> 6 (#112): catalogs now include structured extractor rates, topology,
 * and raw-resource applicability. Older caches cannot reconstruct this data.
 */
export const CATALOG_PARSER_VERSION = 7;

/**
 * JSON-safe CatalogItem: `stackSize` is a toString() string or null. Items
 * carried a Fraction field (stackSize) as of Stage 7 / Phase 2, so — like
 * recipes and machines — they can no longer round-trip RAW through storage (a
 * structured clone would strip the Fraction prototype). id/displayName/isFluid
 * are plain and copied verbatim.
 */
interface StoredCatalogItem {
  id: string;
  displayName: string;
  isFluid: boolean;
  stackSize: string | null;
  // Mirrors CatalogItem.isRawResource — ALSO optional (a required stored field
  // would tsc-clash reviving undefined). Without it in all three enumerating
  // functions the flag silently vanishes on the second boot (a cache hit), so
  // the raw-feed cards would disappear (Stage 11 / Phase 1, ticket #57).
  isRawResource?: boolean;
}
/** JSON-safe RecipeIO — the Fraction is serialized via toString(). */
interface StoredRecipeIO {
  itemId: string;
  perMinute: string;
}
interface StoredRecipe {
  id: string;
  displayName: string;
  machineId: string;
  isAlternate: boolean;
  inputs: StoredRecipeIO[];
  outputs: StoredRecipeIO[];
  primaryOutputId: string;
  /** #142: recipe-level variable-power range, Fraction.toString round-trip.
   *  Optional like isRawResource (truthiness-safe reads) — the v6→7 parser
   *  bump is what carries it to cached users (the isRawResource scar). */
  variablePower?: { constant: string; factor: string };
}
/** JSON-safe machine power: every Fraction is a toString() string; optional
 *  bounds stay optional. */
interface StoredMachinePower {
  mw: string;
  variable: boolean;
  minMw?: string;
  maxMw?: string;
  exponent: string;
}
/** JSON-safe machine: id + name plus the stringified power struct. Machines
 *  now carry Fractions (power), so — like recipes — they can't be stored raw. */
interface StoredCatalogMachine {
  id: string;
  displayName: string;
  power: StoredMachinePower;
}
interface StoredCatalogExtractor {
  machineId: string;
  topology: CatalogExtractor["topology"];
  normalRate: string;
  itemIds: string[];
}
/** JSON-safe catalog: every Fraction is a toString() string. Tiers are NOT
 *  stored — they are always TIER_TABLE, rebuilt on revive. */
interface StoredCatalogData {
  items: Record<string, StoredCatalogItem>;
  machines: Record<string, StoredCatalogMachine>;
  recipes: Record<string, StoredRecipe>;
  extractors: Record<string, StoredCatalogExtractor>;
  /**
   * Mirrors Catalog.recipeUnlocks (S20 P3, #102) — plain numbers, so it stores
   * verbatim. It MUST appear in all three enumerating functions
   * (StoredCatalogData / serializeCatalog / reviveCatalog): `tiers` is
   * re-attachable on revive only because it is a CONSTANT, which this is not.
   * Omitting it from the serializer alone would revive an EMPTY map on every
   * boot after the first, and by the absent-key rule every recipe would read
   * "always available" — gating silently no-ops. Exactly the `isRawResource`
   * scar recorded above (ticket #57).
   */
  recipeUnlocks: Record<string, number>;
}

/**
 * Provenance of the ready catalog: a user-uploaded Docs.json, or the bundled
 * snapshot (with the Steam build + extraction date it was cut from). Persisted
 * on the cache row so a reboot's `hit` still knows which one it is showing —
 * that's what keeps the bundled-provenance banner from vanishing after the
 * first reboot (ticket #9).
 */
export type CatalogSource =
  | { kind: "user" }
  | { kind: "bundled"; steamBuild: string; extractedAt: string };

export interface StoredCatalog {
  catalog: StoredCatalogData;
  source_hash: string; // SHA-256 hex of the uploaded text
  cached_at: string; // ISO timestamp
  parser_version: number;
  /** Absent on legacy rows written before this field existed; loadCatalog
   *  backfills those as { kind: 'user' }. */
  source?: CatalogSource;
}

export type CacheLoadResult =
  | { status: "hit"; catalog: Catalog; source: CatalogSource }
  | { status: "stale" }
  | { status: "empty" }
  // A row we could NOT read this session (IDB access failure) — as opposed to
  // a row that is absent (empty) or genuinely unusable (stale). It may still
  // hold a valid, possibly newer, user catalog, so the caller must NOT
  // overwrite it: the unavailable path degrades WITHOUT saving.
  | { status: "unavailable" };

/**
 * Serialize + persist a parsed catalog under the current parser version, with a
 * SHA-256 hash of the source text. Throws only on genuine IndexedDB failure —
 * serialization itself cannot fail (every Fraction has a total toString()).
 */
export async function saveCatalog(
  text: string,
  catalog: Catalog,
  source: CatalogSource = { kind: "user" },
): Promise<void> {
  const stored: StoredCatalog = {
    catalog: serializeCatalog(catalog),
    source_hash: await sha256Hex(text),
    cached_at: new Date().toISOString(),
    parser_version: CATALOG_PARSER_VERSION,
    source,
  };
  const db = await openDb();
  await db.put(CATALOG_STORE, stored, CATALOG_KEY);
}

/**
 * Load the cached catalog. Never throws to the caller — but it distinguishes
 * three failure causes that used to collapse together, because they demand
 * different recovery:
 *   - IDB ACCESS failure (openDb / get rejects) → "unavailable": the row may
 *     be a valid, possibly newer user catalog we merely couldn't read, so the
 *     caller must NOT overwrite it (data-preservation, boundary r1 fold).
 *   - no row → "empty"; version mismatch or a reviver that chokes on a
 *     corrupted payload → "stale": genuinely absent/unusable rows the caller
 *     is free to replace with a bundled default.
 * The planner's cachedVersion/currentVersion diagnostics are deliberately dropped.
 */
export async function loadCatalog(): Promise<CacheLoadResult> {
  let stored: StoredCatalog | undefined;
  try {
    const db = await openDb();
    stored = await db.get<StoredCatalog>(CATALOG_STORE, CATALOG_KEY);
  } catch {
    return { status: "unavailable" };
  }
  if (stored === undefined) return { status: "empty" };
  if (stored.parser_version !== CATALOG_PARSER_VERSION) {
    return { status: "stale" };
  }
  try {
    // The legacy-row default lives here, not in the reviver: the reviver only
    // validates StoredCatalogData (items/machines/recipes) and never touches
    // row-level fields, so `source` stays transparent to it (no version bump).
    return {
      status: "hit",
      catalog: reviveCatalog(stored.catalog),
      source: stored.source ?? { kind: "user" },
    };
  } catch {
    // A corrupted stored shape (missing fields, un-parseable rational) fails the
    // reviver: treat as stale, not a thrown error.
    return { status: "stale" };
  }
}

function serializeCatalog(catalog: Catalog): StoredCatalogData {
  const recipes: Record<string, StoredRecipe> = Object.create(null);
  for (const [id, r] of Object.entries(catalog.recipes)) {
    recipes[id] = {
      id: r.id,
      displayName: r.displayName,
      machineId: r.machineId,
      isAlternate: r.isAlternate,
      inputs: r.inputs.map(serializeIO),
      outputs: r.outputs.map(serializeIO),
      primaryOutputId: r.primaryOutputId,
      ...(r.variablePower
        ? {
            variablePower: {
              constant: r.variablePower.constantMw.toString(),
              factor: r.variablePower.factorMw.toString(),
            },
          }
        : {}),
    };
  }
  const machines: Record<string, StoredCatalogMachine> = Object.create(null);
  for (const [id, m] of Object.entries(catalog.machines)) {
    machines[id] = {
      id: m.id,
      displayName: m.displayName,
      power: serializePower(m.power),
    };
  }
  const items: Record<string, StoredCatalogItem> = Object.create(null);
  for (const [id, it] of Object.entries(catalog.items)) {
    items[id] = serializeItem(it);
  }
  const extractors: Record<string, StoredCatalogExtractor> =
    Object.create(null);
  for (const [id, extractor] of Object.entries(catalog.extractors)) {
    extractors[id] = {
      machineId: extractor.machineId,
      topology: extractor.topology,
      normalRate: extractor.normalRate.toString(),
      itemIds: [...extractor.itemIds],
    };
  }
  // Plain numbers — copied verbatim, no per-entry transform. This half is NOT
  // tsc-forced (the literal below would typecheck without it were the field
  // optional), which is precisely why the field is REQUIRED on StoredCatalogData.
  return {
    items,
    machines,
    recipes,
    extractors,
    recipeUnlocks: { ...catalog.recipeUnlocks },
  };
}

function serializeItem(item: CatalogItem): StoredCatalogItem {
  return {
    id: item.id,
    displayName: item.displayName,
    isFluid: item.isFluid,
    // null stays null; a Fraction stringifies exactly (StoredRecipe precedent).
    stackSize: item.stackSize === null ? null : item.stackSize.toString(),
    // Only emit when set (the MachinePower optional-bounds idiom above): a
    // flag-less item stays flag-less through storage, reviving as non-raw.
    ...(item.isRawResource ? { isRawResource: true } : {}),
  };
}

function serializeIO(io: RecipeIO): StoredRecipeIO {
  return { itemId: io.itemId, perMinute: io.perMinute.toString() };
}

function serializePower(p: MachinePower): StoredMachinePower {
  return {
    mw: p.mw.toString(),
    variable: p.variable,
    // Optional bounds omitted (not null) when absent, matching the in-memory shape.
    ...(p.minMw !== undefined ? { minMw: p.minMw.toString() } : {}),
    ...(p.maxMw !== undefined ? { maxMw: p.maxMw.toString() } : {}),
    exponent: p.exponent.toString(),
  };
}

function reviveCatalog(data: StoredCatalogData): Catalog {
  if (
    data === null ||
    typeof data !== "object" ||
    typeof data.items !== "object" ||
    typeof data.machines !== "object" ||
    typeof data.recipes !== "object" ||
    typeof data.extractors !== "object" ||
    typeof data.recipeUnlocks !== "object"
  ) {
    throw new Error("catalog-store: corrupted stored catalog shape.");
  }
  // Null-prototype containers (#28): a structured-clone round-trip through IDB
  // yields plain-proto objects, so the revive rebuild re-nulls each map on the
  // way back in — matching the parse-boundary seed so lookups stay prototype-
  // safe. Record typing unchanged.
  const recipes: Catalog["recipes"] = Object.create(null);
  for (const [id, r] of Object.entries(data.recipes)) {
    recipes[id] = {
      id: r.id,
      displayName: r.displayName,
      machineId: r.machineId,
      isAlternate: r.isAlternate,
      inputs: r.inputs.map(reviveIO),
      outputs: r.outputs.map(reviveIO),
      primaryOutputId: r.primaryOutputId,
      ...(r.variablePower
        ? {
            variablePower: {
              constantMw: parseRational(r.variablePower.constant),
              factorMw: parseRational(r.variablePower.factor),
            },
          }
        : {}),
    };
  }
  const machines: Catalog["machines"] = Object.create(null);
  for (const [id, m] of Object.entries(data.machines)) {
    machines[id] = {
      id: m.id,
      displayName: m.displayName,
      power: revivePower(m.power),
    };
  }
  const items: Catalog["items"] = Object.create(null);
  for (const [id, it] of Object.entries(data.items)) {
    items[id] = reviveItem(it);
  }
  const extractors: Catalog["extractors"] = Object.create(null);
  for (const [id, extractor] of Object.entries(data.extractors)) {
    extractors[id] = {
      machineId: extractor.machineId,
      topology: extractor.topology,
      normalRate: parseRational(extractor.normalRate),
      itemIds: [...extractor.itemIds],
    };
  }
  // Null-prototype container (#28) — same rebuild rationale as the three maps
  // above: gating reads this map by bracket access on recipe ids.
  const recipeUnlocks: Catalog["recipeUnlocks"] = Object.create(null);
  for (const [id, tier] of Object.entries(data.recipeUnlocks)) {
    recipeUnlocks[id] = tier;
  }
  // Tiers are always the curated table, never round-tripped through storage.
  // recipeUnlocks is NOT such a constant — it is parsed data, so it round-trips.
  return {
    items,
    machines,
    recipes,
    extractors,
    tiers: TIER_TABLE,
    recipeUnlocks,
  };
}

function reviveItem(item: StoredCatalogItem): CatalogItem {
  // parseRational throws on a malformed rational → reviveCatalog's caller maps
  // the throw to 'stale' (the recipe-IO reviver's corruption posture). null
  // stackSize (fluids / unknown enum) revives verbatim as null.
  return {
    id: item.id,
    displayName: item.displayName,
    isFluid: item.isFluid,
    stackSize: item.stackSize === null ? null : parseRational(item.stackSize),
    // Revive the flag only when stored true (keeps the field absent otherwise,
    // matching the in-memory optional shape the === true consumer expects).
    ...(item.isRawResource ? { isRawResource: true } : {}),
  };
}

function reviveIO(io: StoredRecipeIO): RecipeIO {
  const perMinute: Fraction = parseRational(io.perMinute);
  return { itemId: io.itemId, perMinute };
}

function revivePower(p: StoredMachinePower): MachinePower {
  // parseRational throws on a malformed rational → reviveCatalog's caller maps
  // the throw to 'stale', matching the recipe-IO reviver's corruption posture.
  return {
    mw: parseRational(p.mw),
    variable: p.variable,
    ...(p.minMw !== undefined ? { minMw: parseRational(p.minMw) } : {}),
    ...(p.maxMw !== undefined ? { maxMw: parseRational(p.maxMw) } : {}),
    exponent: parseRational(p.exponent),
  };
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
