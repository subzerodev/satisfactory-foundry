import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { Fraction } from "../core/fraction.ts";
import type { Catalog } from "./types.ts";
import { TIER_TABLE } from "./tiers.ts";
import { openDb, resetDbCache } from "./db.ts";
import {
  saveCatalog,
  loadCatalog,
  CATALOG_PARSER_VERSION,
} from "./catalog-store.ts";

// A small catalog with a fractional rate, to prove Fraction-equality survives
// the toString()/parseRational round-trip through IndexedDB.
function sampleCatalog(): Catalog {
  return {
    items: {
      ore_iron: { id: "ore_iron", displayName: "Iron Ore", isFluid: false },
      iron_ingot: {
        id: "iron_ingot",
        displayName: "Iron Ingot",
        isFluid: false,
      },
    },
    machines: {
      smelter_mk1: { id: "smelter_mk1", displayName: "Smelter" },
    },
    recipes: {
      ingot_iron: {
        id: "ingot_iron",
        displayName: "Iron Ingot",
        machineId: "smelter_mk1",
        isAlternate: false,
        inputs: [{ itemId: "ore_iron", perMinute: Fraction.of(75, 2) }],
        outputs: [{ itemId: "iron_ingot", perMinute: Fraction.from(30) }],
        primaryOutputId: "iron_ingot",
      },
    },
    tiers: TIER_TABLE,
  };
}

// Each test starts from a clean, freshly-opened database.
beforeEach(async () => {
  resetDbCache();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new (
    await import("fake-indexeddb")
  ).IDBFactory();
});

describe("catalog cache — round-trip (spec row 7)", () => {
  it("save → load returns a hit with Fraction-equal catalog + records a hash", async () => {
    const cat = sampleCatalog();
    await saveCatalog("raw docs text", cat);

    const result = await loadCatalog();
    expect(result.status).toBe("hit");
    if (result.status !== "hit") return;

    // Fractions survive exactly through toString()/parseRational.
    const rate = result.catalog.recipes["ingot_iron"]!.inputs[0]!.perMinute;
    expect(rate.eq(Fraction.of(75, 2))).toBe(true);
    const out = result.catalog.recipes["ingot_iron"]!.outputs[0]!.perMinute;
    expect(out.eq(Fraction.from(30))).toBe(true);
    // Non-Fraction fields survive too; tiers are the curated table.
    expect(result.catalog.items["ore_iron"]!.displayName).toBe("Iron Ore");
    expect(result.catalog.tiers).toBe(TIER_TABLE);

    // The source hash is recorded (SHA-256 hex = 64 chars).
    const db = await openDb();
    const stored = await db.get<{
      source_hash: string;
      parser_version: number;
    }>("catalog", "current");
    expect(stored!.source_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored!.parser_version).toBe(CATALOG_PARSER_VERSION);
  });

  it("returns empty when nothing is stored", async () => {
    expect((await loadCatalog()).status).toBe("empty");
  });

  it("returns stale (never throws) on a parser-version mismatch", async () => {
    await saveCatalog("raw", sampleCatalog());
    // Rewrite the stored row with a bumped version, simulating an older cache.
    const db = await openDb();
    const stored = await db.get<Record<string, unknown>>("catalog", "current");
    await db.put(
      "catalog",
      { ...stored, parser_version: CATALOG_PARSER_VERSION + 1 },
      "current",
    );
    expect((await loadCatalog()).status).toBe("stale");
  });

  it("returns stale (never throws) on a corrupted stored shape", async () => {
    const db = await openDb();
    // A row at the right version but with a broken catalog payload: the reviver
    // must fail into 'stale', not throw.
    await db.put(
      "catalog",
      {
        catalog: { items: {}, machines: {}, recipes: { bad: null } },
        source_hash: "x",
        cached_at: new Date().toISOString(),
        parser_version: CATALOG_PARSER_VERSION,
      },
      "current",
    );
    expect((await loadCatalog()).status).toBe("stale");
  });
});
