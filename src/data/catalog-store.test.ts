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
import type { CatalogSource } from "./catalog-store.ts";

// A small catalog with a fractional rate, to prove Fraction-equality survives
// the toString()/parseRational round-trip through IndexedDB.
function sampleCatalog(): Catalog {
  return {
    items: {
      ore_iron: {
        id: "ore_iron",
        displayName: "Iron Ore",
        isFluid: false,
        stackSize: Fraction.from(100),
        // A resource-descriptor item carries the raw flag (Stage 11 / Phase 1);
        // the round-trip test below asserts it survives serialize/revive.
        isRawResource: true,
      },
      iron_ingot: {
        id: "iron_ingot",
        displayName: "Iron Ingot",
        isFluid: false,
        stackSize: Fraction.from(100),
      },
    },
    machines: {
      smelter_mk1: {
        id: "smelter_mk1",
        displayName: "Smelter",
        power: {
          mw: Fraction.from(4),
          variable: false,
          exponent: Fraction.of(1321929, 1000000),
        },
      },
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
    // Machine power Fractions survive the serialize/revive round-trip as real
    // Fractions (structured-clone would otherwise strip the prototype).
    const power = result.catalog.machines["smelter_mk1"]!.power;
    expect(power.mw.eq(Fraction.from(4))).toBe(true);
    expect(power.variable).toBe(false);
    expect(power.exponent.eq(Fraction.of(1321929, 1000000))).toBe(true);
    // Non-Fraction fields survive too; tiers are the curated table.
    expect(result.catalog.items["ore_iron"]!.displayName).toBe("Iron Ore");
    expect(result.catalog.tiers).toBe(TIER_TABLE);
    // Item stackSize survives the serialize/revive round-trip as a real Fraction
    // (structured-clone would otherwise strip the prototype — the reason items
    // no longer round-trip raw, Stage 7 / Phase 2).
    expect(
      result.catalog.items["ore_iron"]!.stackSize!.eq(Fraction.from(100)),
    ).toBe(true);
    // isRawResource survives serialize/revive (Stage 11 / Phase 1): it round-
    // trips through IDB via StoredCatalogItem/serializeItem/reviveItem, so
    // dropping any one makes the flag silently vanish on the second boot. This
    // assertion is load-bearing — the flag-less iron_ingot proves the absent
    // case revives absent, and ore_iron's true proves the set case survives.
    expect(result.catalog.items["ore_iron"]!.isRawResource).toBe(true);
    expect(result.catalog.items["iron_ingot"]!.isRawResource).toBeUndefined();

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

  it("treats a version-2 cached row as stale under the current version", async () => {
    // A pre-Stage-7 row (parser_version 2, items lacking stackSize) must be
    // discarded, not revived — the frozen Axis 2 stale-and-discard behavior.
    await saveCatalog("raw", sampleCatalog());
    const db = await openDb();
    const stored = await db.get<Record<string, unknown>>("catalog", "current");
    await db.put("catalog", { ...stored, parser_version: 2 }, "current");
    expect(CATALOG_PARSER_VERSION).toBe(4);
    expect((await loadCatalog()).status).toBe("stale");
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

  it("returns unavailable (not stale) on an IDB access failure (boundary r1 fold)", async () => {
    // An IDB access failure is DISTINCT from stale: the row may still hold a
    // valid user catalog we merely couldn't read, so init must not overwrite
    // it. Break the open() so openDb rejects.
    resetDbCache();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).indexedDB = {
      open: () => {
        const req: Record<string, unknown> = {
          error: new Error("boom: IDB open failed"),
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
        };
        queueMicrotask(() => {
          if (typeof req.onerror === "function") (req.onerror as () => void)();
        });
        return req;
      },
    };
    expect((await loadCatalog()).status).toBe("unavailable");
  });
});

describe("catalog cache — source provenance (ticket #9)", () => {
  it("round-trips a bundled source on the hit", async () => {
    const source: CatalogSource = {
      kind: "bundled",
      steamBuild: "23855724",
      extractedAt: "2026-04-30",
    };
    await saveCatalog("raw docs text", sampleCatalog(), source);

    const result = await loadCatalog();
    expect(result.status).toBe("hit");
    if (result.status !== "hit") return;
    expect(result.source).toEqual(source);
  });

  it("defaults the source to user when saveCatalog omits it", async () => {
    // The two-arg call site (upload's implicit user) persists no explicit
    // source; the hit still carries a concrete { kind: 'user' }.
    await saveCatalog("raw docs text", sampleCatalog());

    const result = await loadCatalog();
    expect(result.status).toBe("hit");
    if (result.status !== "hit") return;
    expect(result.source).toEqual({ kind: "user" });
  });

  it("revives a legacy row (no source field) as user", async () => {
    // A row written before the source field existed: loadCatalog's
    // `stored.source ?? { kind: 'user' }` default backfills it.
    const db = await openDb();
    await db.put(
      "catalog",
      {
        catalog: serializedSample(),
        source_hash: "x",
        cached_at: new Date().toISOString(),
        parser_version: CATALOG_PARSER_VERSION,
      },
      "current",
    );

    const result = await loadCatalog();
    expect(result.status).toBe("hit");
    if (result.status !== "hit") return;
    expect(result.source).toEqual({ kind: "user" });
  });
});

describe("catalog cache — null-prototype maps survive revive (#28)", () => {
  it("revived items/machines/recipes maps have a null prototype", async () => {
    // Structured-clone through IDB yields plain-proto objects; reviveCatalog
    // rebuilds each of the three maps as Object.create(null), so the loaded
    // catalog is prototype-safe again — matching the parse-boundary seed.
    await saveCatalog("raw docs text", sampleCatalog());
    const result = await loadCatalog();
    expect(result.status).toBe("hit");
    if (result.status !== "hit") return;
    expect(Object.getPrototypeOf(result.catalog.items)).toBeNull();
    expect(Object.getPrototypeOf(result.catalog.machines)).toBeNull();
    expect(Object.getPrototypeOf(result.catalog.recipes)).toBeNull();
    // A prototype-member id misses cleanly on the revived maps (belt-and-braces).
    expect(result.catalog.recipes["constructor"]).toBeUndefined();
    expect(result.catalog.machines["constructor"]).toBeUndefined();
    expect(result.catalog.items["constructor"]).toBeUndefined();
  });
});

/** The JSON-safe shape saveCatalog would write for `sampleCatalog()`, used to
 *  seed a legacy row directly (bypassing saveCatalog's source write). */
function serializedSample() {
  return {
    items: {
      ore_iron: {
        id: "ore_iron",
        displayName: "Iron Ore",
        isFluid: false,
        stackSize: "100",
      },
      iron_ingot: {
        id: "iron_ingot",
        displayName: "Iron Ingot",
        isFluid: false,
        stackSize: "100",
      },
    },
    machines: {
      smelter_mk1: {
        id: "smelter_mk1",
        displayName: "Smelter",
        power: { mw: "4", variable: false, exponent: "1321929/1000000" },
      },
    },
    recipes: {
      ingot_iron: {
        id: "ingot_iron",
        displayName: "Iron Ingot",
        machineId: "smelter_mk1",
        isAlternate: false,
        inputs: [{ itemId: "ore_iron", perMinute: "75/2" }],
        outputs: [{ itemId: "iron_ingot", perMinute: "30" }],
        primaryOutputId: "iron_ingot",
      },
    },
  };
}
