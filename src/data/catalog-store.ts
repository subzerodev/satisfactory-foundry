import type { Fraction } from "../core/fraction.ts";
import type {
  Catalog,
  CatalogItem,
  CatalogMachine,
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
 * re-uploads Docs.json. Starts at 1 (Phase 2).
 */
export const CATALOG_PARSER_VERSION = 1;

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
}
/** JSON-safe catalog: every Fraction is a toString() string. Tiers are NOT
 *  stored — they are always TIER_TABLE, rebuilt on revive. */
interface StoredCatalogData {
  items: Record<string, CatalogItem>;
  machines: Record<string, CatalogMachine>;
  recipes: Record<string, StoredRecipe>;
}

export interface StoredCatalog {
  catalog: StoredCatalogData;
  source_hash: string; // SHA-256 hex of the uploaded text
  cached_at: string; // ISO timestamp
  parser_version: number;
}

export type CacheLoadResult =
  | { status: "hit"; catalog: Catalog }
  | { status: "stale" }
  | { status: "empty" };

/**
 * Serialize + persist a parsed catalog under the current parser version, with a
 * SHA-256 hash of the source text. Throws only on genuine IndexedDB failure —
 * serialization itself cannot fail (every Fraction has a total toString()).
 */
export async function saveCatalog(
  text: string,
  catalog: Catalog,
): Promise<void> {
  const stored: StoredCatalog = {
    catalog: serializeCatalog(catalog),
    source_hash: await sha256Hex(text),
    cached_at: new Date().toISOString(),
    parser_version: CATALOG_PARSER_VERSION,
  };
  const db = await openDb();
  await db.put(CATALOG_STORE, stored, CATALOG_KEY);
}

/**
 * Load the cached catalog. Never throws to the caller: any failure — no row,
 * version mismatch, or a reviver that chokes on a corrupted payload — collapses
 * to a `{status}` the Phase 4 UI turns into a generic re-upload prompt. The
 * planner's cachedVersion/currentVersion diagnostics are deliberately dropped.
 */
export async function loadCatalog(): Promise<CacheLoadResult> {
  let stored: StoredCatalog | undefined;
  try {
    const db = await openDb();
    stored = await db.get<StoredCatalog>(CATALOG_STORE, CATALOG_KEY);
  } catch {
    return { status: "stale" };
  }
  if (stored === undefined) return { status: "empty" };
  if (stored.parser_version !== CATALOG_PARSER_VERSION) {
    return { status: "stale" };
  }
  try {
    return { status: "hit", catalog: reviveCatalog(stored.catalog) };
  } catch {
    // A corrupted stored shape (missing fields, un-parseable rational) fails the
    // reviver: treat as stale, not a thrown error.
    return { status: "stale" };
  }
}

function serializeCatalog(catalog: Catalog): StoredCatalogData {
  const recipes: Record<string, StoredRecipe> = {};
  for (const [id, r] of Object.entries(catalog.recipes)) {
    recipes[id] = {
      id: r.id,
      displayName: r.displayName,
      machineId: r.machineId,
      isAlternate: r.isAlternate,
      inputs: r.inputs.map(serializeIO),
      outputs: r.outputs.map(serializeIO),
      primaryOutputId: r.primaryOutputId,
    };
  }
  return { items: catalog.items, machines: catalog.machines, recipes };
}

function serializeIO(io: RecipeIO): StoredRecipeIO {
  return { itemId: io.itemId, perMinute: io.perMinute.toString() };
}

function reviveCatalog(data: StoredCatalogData): Catalog {
  if (
    data === null ||
    typeof data !== "object" ||
    typeof data.items !== "object" ||
    typeof data.machines !== "object" ||
    typeof data.recipes !== "object"
  ) {
    throw new Error("catalog-store: corrupted stored catalog shape.");
  }
  const recipes: Catalog["recipes"] = {};
  for (const [id, r] of Object.entries(data.recipes)) {
    recipes[id] = {
      id: r.id,
      displayName: r.displayName,
      machineId: r.machineId,
      isAlternate: r.isAlternate,
      inputs: r.inputs.map(reviveIO),
      outputs: r.outputs.map(reviveIO),
      primaryOutputId: r.primaryOutputId,
    };
  }
  // Tiers are always the curated table, never round-tripped through storage.
  return {
    items: data.items,
    machines: data.machines,
    recipes,
    tiers: TIER_TABLE,
  };
}

function reviveIO(io: StoredRecipeIO): RecipeIO {
  const perMinute: Fraction = parseRational(io.perMinute);
  return { itemId: io.itemId, perMinute };
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
