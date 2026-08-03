import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { Fraction } from "../core/fraction.ts";
import { resetDbCache } from "../data/db.ts";
import { saveCatalog } from "../data/catalog-store.ts";
import { CATALOG_PARSER_VERSION } from "../data/catalog-store.ts";
import { parseCatalogFromText } from "../data/catalog.ts";
import { createAppStore, setBundledDocsProvider } from "./store.ts";
import type { StateStorage } from "zustand/middleware";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// A Docs.json fragment that parses (through the REAL pipeline) to an
// `ingot_iron` recipe: solid ore_iron in / solid iron_ingot out, both at
// Amount=1 over duration 2 → 30/min. Feeding this through selectRecipe +
// setMachineCount(20) with tiers {belt:4} reproduces the Phase 1 worked
// example ([480, 120@after-16]).
const DOCS_TEXT = JSON.stringify([
  {
    NativeClass:
      "/Script/CoreUObject.Class'/Script/FactoryGame.FGResourceDescriptor'",
    Classes: [
      {
        ClassName: "Desc_OreIron_C",
        mDisplayName: "Iron Ore",
        mForm: "RF_SOLID",
      },
      { ClassName: "Desc_Water_C", mDisplayName: "Water", mForm: "RF_LIQUID" },
    ],
  },
  {
    NativeClass:
      "/Script/CoreUObject.Class'/Script/FactoryGame.FGItemDescriptor'",
    Classes: [
      {
        ClassName: "Desc_IronIngot_C",
        mDisplayName: "Iron Ingot",
        mForm: "RF_SOLID",
      },
    ],
  },
  {
    NativeClass:
      "/Script/CoreUObject.Class'/Script/FactoryGame.FGBuildableManufacturer'",
    Classes: [{ ClassName: "Build_SmelterMk1_C", mDisplayName: "Smelter" }],
  },
  {
    NativeClass: "/Script/CoreUObject.Class'/Script/FactoryGame.FGRecipe'",
    Classes: [
      {
        ClassName: "Recipe_IngotIron_C",
        mDisplayName: "Iron Ingot",
        mIngredients:
          "((ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_OreIron_C\"',Amount=1))",
        mProduct:
          "((ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_IronIngot_C\"',Amount=1))",
        mManufactoringDuration: "2",
        mProducedIn: "/Game/Path/Build_SmelterMk1_C",
      },
    ],
  },
]);

// A second catalog fragment that DROPS `ingot_iron` and adds `ingot_copper`,
// to exercise re-upload re-validation (a dangling recipeId).
const DOCS_TEXT_COPPER = JSON.stringify([
  {
    NativeClass:
      "/Script/CoreUObject.Class'/Script/FactoryGame.FGResourceDescriptor'",
    Classes: [
      {
        ClassName: "Desc_OreCopper_C",
        mDisplayName: "Copper Ore",
        mForm: "RF_SOLID",
      },
    ],
  },
  {
    NativeClass:
      "/Script/CoreUObject.Class'/Script/FactoryGame.FGItemDescriptor'",
    Classes: [
      {
        ClassName: "Desc_CopperIngot_C",
        mDisplayName: "Copper Ingot",
        mForm: "RF_SOLID",
      },
    ],
  },
  {
    NativeClass:
      "/Script/CoreUObject.Class'/Script/FactoryGame.FGBuildableManufacturer'",
    Classes: [{ ClassName: "Build_SmelterMk1_C", mDisplayName: "Smelter" }],
  },
  {
    NativeClass: "/Script/CoreUObject.Class'/Script/FactoryGame.FGRecipe'",
    Classes: [
      {
        ClassName: "Recipe_IngotCopper_C",
        mDisplayName: "Copper Ingot",
        mIngredients:
          "((ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_OreCopper_C\"',Amount=1))",
        mProduct:
          "((ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_CopperIngot_C\"',Amount=1))",
        mManufactoringDuration: "2",
        mProducedIn: "/Game/Path/Build_SmelterMk1_C",
      },
    ],
  },
]);

// A second catalog fragment that KEEPS `ingot_iron` (same id) so re-upload
// re-validation keeps the recipe but still clears overrides on replacement.
const DOCS_TEXT_IRON_V2 = DOCS_TEXT;

/** A fresh in-memory object-backed StateStorage stub (persist's storage API). */
function makeStorageStub(seed?: Record<string, string>): {
  storage: StateStorage;
  backing: Record<string, string>;
} {
  const backing: Record<string, string> = { ...seed };
  return {
    backing,
    storage: {
      getItem: (name) => (name in backing ? backing[name]! : null),
      setItem: (name, value) => {
        backing[name] = value;
      },
      removeItem: (name) => {
        delete backing[name];
      },
    },
  };
}

/** Fresh fake-indexeddb + reset the db-cache singleton per test. */
async function freshIdb(): Promise<void> {
  resetDbCache();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new (
    await import("fake-indexeddb")
  ).IDBFactory();
}

/** Fixed provenance for the bundled-fallback fixtures. */
const BUNDLED_PROVENANCE = {
  steamBuild: "23855724",
  extractedAt: "2026-04-30",
};

beforeEach(async () => {
  await freshIdb();
  // Reset the module-level bundled-docs seam so a test that installs a provider
  // never leaks into the next; the default degrades (resolves null).
  setBundledDocsProvider(async () => null);
});

// ---------------------------------------------------------------------------
// Row 1 — catalog lifecycle
// ---------------------------------------------------------------------------

describe("catalog lifecycle (spec row 1)", () => {
  it("init on an empty cache → needs-upload{empty}, solve idle", async () => {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().init();
    const s = store.getState();
    expect(s.catalog.status).toBe("needs-upload");
    if (s.catalog.status === "needs-upload") {
      expect(s.catalog.reason).toBe("empty");
    }
    expect(s.solve.status).toBe("idle");
  });

  it("init on a seeded cache → ready (via real save/load)", async () => {
    // Seed the cache through the REAL save path, then init reads it back.
    await saveCatalog(DOCS_TEXT, parseCatalogFromText(DOCS_TEXT));
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().init();
    const s = store.getState();
    expect(s.catalog.status).toBe("ready");
    if (s.catalog.status === "ready") {
      expect(s.catalog.catalog.recipes["ingot_iron"]).toBeDefined();
    }
    expect(s.solve.status).toBe("idle"); // no recipe selected yet
  });

  it("init on a version-stale cache → needs-upload{stale}", async () => {
    // Seed, then re-put the stored row with a bumped parser_version (the
    // shipped catalog-store.test.ts technique).
    await saveCatalog(DOCS_TEXT, parseCatalogFromText(DOCS_TEXT));
    const { openDb } = await import("../data/db.ts");
    const db = await openDb();
    const stored = await db.get<Record<string, unknown>>("catalog", "current");
    await db.put(
      "catalog",
      { ...stored, parser_version: CATALOG_PARSER_VERSION + 1 },
      "current",
    );

    const store = createAppStore(makeStorageStub().storage);
    await store.getState().init();
    const s = store.getState();
    expect(s.catalog.status).toBe("needs-upload");
    if (s.catalog.status === "needs-upload") {
      expect(s.catalog.reason).toBe("stale");
    }
  });
});

// ---------------------------------------------------------------------------
// Row 4 — live derivation (the Phase 1 worked example) + one-recompute setters
// ---------------------------------------------------------------------------

describe("live derivation (spec row 4)", () => {
  async function readyStore() {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT);
    return store;
  }

  it("reproduces the Phase 1 20-machine worked example through the REAL pipeline", async () => {
    const store = await readyStore();
    // CRITICAL: the [480, 120@after-16] values assume the 4-tier table; the
    // default 6-tier table would solve D=600 to a single 780 belt.
    store.getState().setUnlockedTiers({ belt: 4, pipe: 1 });
    store.getState().selectRecipe("ingot_iron");
    store.getState().setMachineCount(20);

    const solve = store.getState().solve;
    expect(solve.status).toBe("solved");
    if (solve.status !== "solved") return;

    const feed = solve.result.feeds[0]!;
    expect(feed.belts.map((b) => b.capacity.toString())).toEqual([
      "480",
      "120",
    ]);
    expect(feed.belts.map((b) => b.entersAfterMachine)).toEqual([0, 16]);
    const out = solve.result.outputs[0]!;
    expect(out.breakouts.map((b) => b.capacity.toString())).toEqual([
      "480",
      "120",
    ]);
    expect(out.breakouts.map((b) => b.startsAfterMachine)).toEqual([0, 16]);
    expect(solve.result.findings).toEqual([]);
  });

  it("each setter re-derives with the updated result", async () => {
    const store = await readyStore();
    store.getState().setUnlockedTiers({ belt: 4, pipe: 1 });
    store.getState().selectRecipe("ingot_iron");

    // machineCount change re-solves.
    store.getState().setMachineCount(1);
    let solve = store.getState().solve;
    expect(solve.status).toBe("solved");
    if (solve.status === "solved") {
      // 1 machine × 30/min = 30 → single 60 belt.
      expect(
        solve.result.feeds[0]!.belts.map((b) => b.capacity.toString()),
      ).toEqual(["60"]);
    }

    // clock text change re-solves: 200% doubles per-machine demand to 60.
    store.getState().setClockPercentText("200");
    solve = store.getState().solve;
    expect(solve.status).toBe("solved");
    if (solve.status === "solved") {
      expect(
        solve.result.feeds[0]!.perMachineDemand.eq(Fraction.from(60)),
      ).toBe(true);
    }
  });

  it("machineCount 0 is valid → solved with empty lanes (degenerate)", async () => {
    const store = await readyStore();
    store.getState().selectRecipe("ingot_iron");
    store.getState().setMachineCount(0);
    const solve = store.getState().solve;
    expect(solve.status).toBe("solved");
    if (solve.status === "solved") {
      expect(solve.result.feeds[0]!.belts).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// Row 5 — invalid-input routing (all reasons + the count-excess split)
// ---------------------------------------------------------------------------

describe("invalid-input routing (spec row 5)", () => {
  async function readyWithRecipe() {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT);
    store.getState().setUnlockedTiers({ belt: 4, pipe: 1 });
    store.getState().selectRecipe("ingot_iron");
    store.getState().setMachineCount(20);
    return store;
  }

  it("clock '0' / 'abc' / '-5' → invalid bad-clock", async () => {
    const store = await readyWithRecipe();
    for (const bad of ["0", "abc", "-5"]) {
      store.getState().setClockPercentText(bad);
      const s = store.getState().solve;
      expect(s.status, `clock ${bad}`).toBe("invalid");
      if (s.status === "invalid") expect(s.reason).toBe("bad-clock");
    }
  });

  it("machineCount 1.5 / -1 → invalid bad-machine-count", async () => {
    const store = await readyWithRecipe();
    for (const bad of [1.5, -1]) {
      store.getState().setMachineCount(bad);
      const s = store.getState().solve;
      expect(s.status, `count ${bad}`).toBe("invalid");
      if (s.status === "invalid") expect(s.reason).toBe("bad-machine-count");
    }
  });

  it("malformed override text → invalid bad-override", async () => {
    const store = await readyWithRecipe();
    store.getState().setOverride("feeds", "ore_iron", 0, "not-a-number");
    const s = store.getState().solve;
    expect(s.status).toBe("invalid");
    if (s.status === "invalid") expect(s.reason).toBe("bad-override");
  });

  it("override on an item absent from the recipe → invalid bad-override (buildLanes throws)", async () => {
    const store = await readyWithRecipe();
    // No membership guard in setOverride; derive's toStageInput/buildLanes
    // throws on the unknown key → bad-override.
    store.getState().setOverride("feeds", "not_a_lane", 0, "60");
    const s = store.getState().solve;
    expect(s.status).toBe("invalid");
    if (s.status === "invalid") expect(s.reason).toBe("bad-override");
  });

  it("out-of-range override index → solved + overrides-exceed-belt-count finding (the routing split)", async () => {
    const store = await readyWithRecipe();
    // 20 machines / tiers{belt:4} solves to 2 feed belts; an override at index
    // 2 makes the override array length 3 > 2 → a solver VALUE finding, so the
    // solve stays 'solved' with the finding INSIDE result (not 'invalid').
    store.getState().setOverride("feeds", "ore_iron", 2, "60");
    const s = store.getState().solve;
    expect(s.status).toBe("solved");
    if (s.status === "solved") {
      const feed = s.result.feeds.find((l) => l.itemId === "ore_iron")!;
      expect(
        feed.findings.some(
          (f) =>
            f.type === "invalid-input" &&
            f.reason === "overrides-exceed-belt-count",
        ),
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Row 6 — overrides discipline (dense padding, clear triggers, non-triggers)
// ---------------------------------------------------------------------------

describe("overrides discipline (spec row 6)", () => {
  async function readyWithRecipe() {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT);
    store.getState().selectRecipe("ingot_iron");
    return store;
  }

  it("setOverride at index 3 on empty → dense null-padded array", async () => {
    const store = await readyWithRecipe();
    store.getState().setOverride("feeds", "ore_iron", 3, "60");
    const arr = store.getState().selection.overrides.feeds["ore_iron"]!;
    expect(arr).toEqual([null, null, null, "60"]);
  });

  it("selectRecipe clears overrides", async () => {
    const store = await readyWithRecipe();
    store.getState().setOverride("feeds", "ore_iron", 0, "60");
    store.getState().selectRecipe("ingot_iron"); // re-select same id
    expect(store.getState().selection.overrides.feeds).toEqual({});
  });

  it("machineCount / clock changes do NOT clear overrides", async () => {
    const store = await readyWithRecipe();
    store.getState().setOverride("feeds", "ore_iron", 0, "60");
    store.getState().setMachineCount(5);
    store.getState().setClockPercentText("150");
    expect(store.getState().selection.overrides.feeds["ore_iron"]).toEqual([
      "60",
    ]);
  });

  it("clearOverrides empties both sides", async () => {
    const store = await readyWithRecipe();
    store.getState().setOverride("feeds", "ore_iron", 0, "60");
    store.getState().setOverride("outputs", "iron_ingot", 0, "480");
    store.getState().clearOverrides();
    expect(store.getState().selection.overrides).toEqual({
      feeds: {},
      outputs: {},
    });
  });
});

// ---------------------------------------------------------------------------
// Row 2 — upload matrix (all FOUR sub-cases) + wide catch
// ---------------------------------------------------------------------------

describe("upload matrix (spec row 2)", () => {
  it("parse-fail on fresh boot → needs-upload{upload-error, message}, solve idle", async () => {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().init(); // needs-upload{empty}
    // Non-JSON text → SyntaxError from JSON.parse — the wide catch routes it.
    await store.getState().uploadDocsText("this is not json {");
    const s = store.getState();
    expect(s.catalog.status).toBe("needs-upload");
    if (s.catalog.status === "needs-upload") {
      expect(s.catalog.reason).toBe("upload-error");
      expect(typeof s.catalog.message).toBe("string");
      expect(s.catalog.message!.length).toBeGreaterThan(0);
    }
    // Fresh-boot failure lands in needs-upload, NOT the transient channel.
    expect(s.uploadError).toBeNull();
    expect(s.solve.status).toBe("idle");
  });

  it("parse-fail while ready → stays ready, overrides KEPT, uploadError set (DocsParseError)", async () => {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT);
    store.getState().selectRecipe("ingot_iron");
    store.getState().setOverride("feeds", "ore_iron", 0, "60");

    // Valid JSON but a bad Docs schema → DocsParseError (non-array root).
    await store.getState().uploadDocsText(JSON.stringify({ not: "an array" }));
    const s = store.getState();
    // A bad re-upload never bricks a working session.
    expect(s.catalog.status).toBe("ready");
    if (s.catalog.status === "ready") {
      expect(s.catalog.catalog.recipes["ingot_iron"]).toBeDefined();
    }
    // Parse FAILURE keeps the old catalog AND its still-valid overrides.
    expect(s.selection.overrides.feeds["ore_iron"]).toEqual(["60"]);
    expect(s.uploadError).not.toBeNull();
  });

  it("parse + save success → ready(new), overrides cleared, uploadError null", async () => {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT);
    store.getState().selectRecipe("ingot_iron");
    store.getState().setOverride("feeds", "ore_iron", 0, "60");

    // Re-upload a DIFFERENT valid catalog: catalog replaced → overrides clear.
    await store.getState().uploadDocsText(DOCS_TEXT_COPPER);
    const s = store.getState();
    expect(s.catalog.status).toBe("ready");
    if (s.catalog.status === "ready") {
      expect(s.catalog.catalog.recipes["ingot_copper"]).toBeDefined();
      expect(s.catalog.catalog.recipes["ingot_iron"]).toBeUndefined();
    }
    expect(s.selection.overrides).toEqual({ feeds: {}, outputs: {} });
    expect(s.uploadError).toBeNull();
  });

  it("parse success + save fail (broken IDB) → ready(new) in memory, overrides cleared, uploadError notes cache miss", async () => {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT);
    store.getState().selectRecipe("ingot_iron");
    store.getState().setOverride("feeds", "ore_iron", 0, "60");

    // Break the IDB layer test-side: reset the db-cache singleton, then swap
    // globalThis.indexedDB for a factory whose open() synchronously errors, so
    // saveCatalog's openDb rejects AFTER a successful parse.
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
        // Fire the error callback asynchronously, like a real IDBOpenDBRequest.
        queueMicrotask(() => {
          if (typeof req.onerror === "function") (req.onerror as () => void)();
        });
        return req;
      },
    };

    await store.getState().uploadDocsText(DOCS_TEXT_COPPER);
    const s = store.getState();
    // The catalog is usable this session even though it could not be cached.
    expect(s.catalog.status).toBe("ready");
    if (s.catalog.status === "ready") {
      expect(s.catalog.catalog.recipes["ingot_copper"]).toBeDefined();
    }
    // Replacement still clears overrides regardless of the save outcome.
    expect(s.selection.overrides).toEqual({ feeds: {}, outputs: {} });
    // The save failure surfaces on the transient channel, noting the cache miss.
    expect(s.uploadError).not.toBeNull();
    expect(s.uploadError).toMatch(/cache/i);
  });
});

// ---------------------------------------------------------------------------
// Row 3 — re-upload re-validation
// ---------------------------------------------------------------------------

describe("re-upload re-validation (spec row 3)", () => {
  it("recipeId missing from the new catalog → reset to null → idle", async () => {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT);
    store.getState().selectRecipe("ingot_iron");
    store.getState().setMachineCount(5);
    expect(store.getState().solve.status).toBe("solved");

    // Copper catalog drops ingot_iron → the selection's recipeId dangles.
    await store.getState().uploadDocsText(DOCS_TEXT_COPPER);
    const s = store.getState();
    expect(s.selection.recipeId).toBeNull();
    expect(s.solve.status).toBe("idle");
  });

  it("recipeId surviving the new catalog → kept, overrides cleared, fresh solve", async () => {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT);
    store.getState().setUnlockedTiers({ belt: 4, pipe: 1 });
    store.getState().selectRecipe("ingot_iron");
    store.getState().setMachineCount(20);
    store.getState().setOverride("feeds", "ore_iron", 0, "60");

    // Re-upload a catalog that KEEPS ingot_iron (same id): recipeId survives,
    // overrides clear (catalog replaced), and a fresh solve runs.
    await store.getState().uploadDocsText(DOCS_TEXT_IRON_V2);
    const s = store.getState();
    expect(s.selection.recipeId).toBe("ingot_iron");
    expect(s.selection.overrides).toEqual({ feeds: {}, outputs: {} });
    expect(s.solve.status).toBe("solved");
    if (s.solve.status === "solved") {
      // Fresh solve on the surviving recipe with no override → [480, 120].
      expect(
        s.solve.result.feeds[0]!.belts.map((b) => b.capacity.toString()),
      ).toEqual(["480", "120"]);
    }
  });
});

// ---------------------------------------------------------------------------
// Row 7 — persistence (tiers only, via the object-stub storage)
// ---------------------------------------------------------------------------

describe("persistence (spec row 7)", () => {
  it("tiers survive a store re-create via the stub; stored value is exactly {unlockedTiers} under satis_foundry:tiers", async () => {
    const { storage, backing } = makeStorageStub();
    const store = createAppStore(storage);
    store.getState().setUnlockedTiers({ belt: 3, pipe: 1 });

    // The stored value is written under the pinned key and carries ONLY the
    // projected slice: { state: { unlockedTiers }, version }.
    const raw = backing["satis_foundry:tiers"];
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw!);
    expect(parsed.state).toEqual({ unlockedTiers: { belt: 3, pipe: 1 } });

    // Re-create the store against the SAME backing → hydration restores tiers
    // before any action runs.
    const store2 = createAppStore(storage);
    expect(store2.getState().selection.unlockedTiers).toEqual({
      belt: 3,
      pipe: 1,
    });
  });

  it("corrupt stored JSON → defaults (full table)", async () => {
    const { storage } = makeStorageStub({
      "satis_foundry:tiers": "{ this is not valid json",
    });
    const store = createAppStore(storage);
    // The validating merge defaults corrupt/missing values to the full table.
    expect(store.getState().selection.unlockedTiers).toEqual({
      belt: 6,
      pipe: 2,
    });
  });

  it("out-of-range persisted tiers are clamped on hydration", async () => {
    const { storage } = makeStorageStub({
      "satis_foundry:tiers": JSON.stringify({
        state: { unlockedTiers: { belt: 99, pipe: 0 } },
        version: 0,
      }),
    });
    const store = createAppStore(storage);
    // belt clamps to the table length (6); pipe clamps up to the floor (1).
    expect(store.getState().selection.unlockedTiers).toEqual({
      belt: 6,
      pipe: 1,
    });
  });
});

// ---------------------------------------------------------------------------
// Bundled default catalog — the boot-fallback matrix (ticket #9)
// ---------------------------------------------------------------------------

describe("bundled default catalog (ticket #9)", () => {
  it("empty cache + bundled provider → bundled-ready, cached, source persisted", async () => {
    setBundledDocsProvider(async () => ({
      text: DOCS_TEXT,
      provenance: BUNDLED_PROVENANCE,
    }));
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().init();

    const s = store.getState();
    expect(s.catalog.status).toBe("ready");
    if (s.catalog.status === "ready") {
      expect(s.catalog.catalog.recipes["ingot_iron"]).toBeDefined();
    }
    expect(s.catalogSource).toEqual({
      kind: "bundled",
      steamBuild: "23855724",
      extractedAt: "2026-04-30",
    });
    // The bundled catalog is cached WITH its source, so a fresh store hits the
    // cache and still reports bundled provenance (banner survives reboot).
    const store2 = createAppStore(makeStorageStub().storage);
    await store2.getState().init();
    expect(store2.getState().catalogSource).toEqual({
      kind: "bundled",
      steamBuild: "23855724",
      extractedAt: "2026-04-30",
    });
  });

  it("version-stale cache + bundled provider → bundled-ready", async () => {
    // Seed a user upload, then bump its version so loadCatalog returns stale.
    await saveCatalog(DOCS_TEXT_COPPER, parseCatalogFromText(DOCS_TEXT_COPPER));
    const { openDb } = await import("../data/db.ts");
    const db = await openDb();
    const stored = await db.get<Record<string, unknown>>("catalog", "current");
    await db.put(
      "catalog",
      { ...stored, parser_version: CATALOG_PARSER_VERSION + 1 },
      "current",
    );

    setBundledDocsProvider(async () => ({
      text: DOCS_TEXT,
      provenance: BUNDLED_PROVENANCE,
    }));
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().init();

    const s = store.getState();
    expect(s.catalog.status).toBe("ready");
    if (s.catalog.status === "ready") {
      expect(s.catalog.catalog.recipes["ingot_iron"]).toBeDefined();
    }
    expect(s.catalogSource).toMatchObject({ kind: "bundled" });
  });

  it("empty cache + bundled provider but SAVE fails → bundled-ready + could-not-cache note (never-block save)", async () => {
    setBundledDocsProvider(async () => ({
      text: DOCS_TEXT,
      provenance: BUNDLED_PROVENANCE,
    }));
    // A stub IDB where open + a readonly get SUCCEED (so loadCatalog reads an
    // EMPTY row, not 'unavailable') but a readwrite put FAILS — so init takes
    // the empty→bundled+SAVE path and hits the never-block save catch
    // (store.ts:377-385), NOT the unavailable path. This is the one branch the
    // broken-open tests can't reach (there open itself fails → unavailable).
    resetDbCache();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).indexedDB = {
      open: () => {
        const req: Record<string, unknown> = {
          result: {
            transaction(_store: string, mode: string) {
              return {
                objectStore() {
                  return {
                    get() {
                      const r: Record<string, unknown> = {
                        result: undefined,
                        onsuccess: null,
                        onerror: null,
                      };
                      queueMicrotask(() => {
                        // readonly get → resolve empty (undefined row).
                        if (typeof r.onsuccess === "function")
                          (r.onsuccess as () => void)();
                      });
                      return r;
                    },
                    put() {
                      const r: Record<string, unknown> = {
                        error: new Error("boom: readwrite put failed"),
                        onsuccess: null,
                        onerror: null,
                      };
                      queueMicrotask(() => {
                        // readwrite put → reject, exercising the save catch.
                        if (
                          mode === "readwrite" &&
                          typeof r.onerror === "function"
                        )
                          (r.onerror as () => void)();
                        else if (typeof r.onsuccess === "function")
                          (r.onsuccess as () => void)();
                      });
                      return r;
                    },
                  };
                },
              };
            },
          },
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
        };
        queueMicrotask(() => {
          if (typeof req.onsuccess === "function")
            (req.onsuccess as () => void)();
        });
        return req;
      },
    };

    const store = createAppStore(makeStorageStub().storage);
    await store.getState().init();
    const s = store.getState();
    // Bundled catalog usable this session even though it could not be cached.
    expect(s.catalog.status).toBe("ready");
    if (s.catalog.status === "ready") {
      expect(s.catalog.catalog.recipes["ingot_iron"]).toBeDefined();
    }
    expect(s.catalogSource).toMatchObject({ kind: "bundled" });
    // The save-fail note (store.ts:377-385) — distinct from the unavailable
    // "couldn't be read" note.
    expect(s.uploadError).toMatch(
      /^bundled catalog loaded but could not be cached: /,
    );
  });

  it("a cache hit BEATS the bundled provider (source from the row)", async () => {
    // Seed a user catalog through the real save path → loadCatalog hits it.
    await saveCatalog(DOCS_TEXT, parseCatalogFromText(DOCS_TEXT));
    // Install a bundled provider that, if consulted, would win — it must NOT be.
    setBundledDocsProvider(async () => ({
      text: DOCS_TEXT_COPPER,
      provenance: BUNDLED_PROVENANCE,
    }));

    const store = createAppStore(makeStorageStub().storage);
    await store.getState().init();
    const s = store.getState();
    expect(s.catalog.status).toBe("ready");
    if (s.catalog.status === "ready") {
      // The user's iron catalog, not the bundled copper one.
      expect(s.catalog.catalog.recipes["ingot_iron"]).toBeDefined();
      expect(s.catalog.catalog.recipes["ingot_copper"]).toBeUndefined();
    }
    // Source comes from the persisted row (a plain 2-arg save → user).
    expect(s.catalogSource).toEqual({ kind: "user" });
  });

  it("provider resolves null → degrade to needs-upload{empty}", async () => {
    setBundledDocsProvider(async () => null);
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().init();
    const s = store.getState();
    expect(s.catalog.status).toBe("needs-upload");
    if (s.catalog.status === "needs-upload") {
      expect(s.catalog.reason).toBe("empty");
    }
    expect(s.catalogSource).toBeNull();
  });

  it("provider REJECTS → same degrade to needs-upload{empty}", async () => {
    setBundledDocsProvider(async () => {
      throw new Error("boom: fetch failed");
    });
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().init();
    const s = store.getState();
    expect(s.catalog.status).toBe("needs-upload");
    if (s.catalog.status === "needs-upload") {
      expect(s.catalog.reason).toBe("empty");
    }
    expect(s.catalogSource).toBeNull();
  });

  it("bundled parse failure → degrade to needs-upload", async () => {
    setBundledDocsProvider(async () => ({
      text: "this is not json {",
      provenance: BUNDLED_PROVENANCE,
    }));
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().init();
    const s = store.getState();
    expect(s.catalog.status).toBe("needs-upload");
    expect(s.catalogSource).toBeNull();
  });

  it("IDB unavailable (broken open) → bundled-ready WITHOUT save + distinct note (boundary r1 fold)", async () => {
    setBundledDocsProvider(async () => ({
      text: DOCS_TEXT,
      provenance: BUNDLED_PROVENANCE,
    }));
    // Break the IDB layer: loadCatalog now returns 'unavailable' (an access
    // failure, NOT stale). init runs the bundled fallback WITHOUT saving — so
    // the note is the distinct "couldn't be read" one, not the save-fail note.
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

    const store = createAppStore(makeStorageStub().storage);
    await store.getState().init();
    const s = store.getState();
    // The bundled catalog is usable this session even though the cache row
    // couldn't be read — and was NOT overwritten.
    expect(s.catalog.status).toBe("ready");
    if (s.catalog.status === "ready") {
      expect(s.catalog.catalog.recipes["ingot_iron"]).toBeDefined();
    }
    expect(s.catalogSource).toMatchObject({ kind: "bundled" });
    // The distinct unavailable-path note (not the save-fail "cached" wording).
    expect(s.uploadError).toBe(
      "cached data couldn't be read this session — using bundled data",
    );
  });

  it("IDB unavailable + provider degrades → needs-upload{stale} (unavailable is not a UI reason)", async () => {
    setBundledDocsProvider(async () => null);
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

    const store = createAppStore(makeStorageStub().storage);
    await store.getState().init();
    const s = store.getState();
    expect(s.catalog.status).toBe("needs-upload");
    if (s.catalog.status === "needs-upload") {
      // Mapped to 'stale' — the frozen UI union has no 'unavailable' reason.
      expect(s.catalog.reason).toBe("stale");
    }
    expect(s.catalogSource).toBeNull();
  });

  it("preserves an unreadable user row — no destructive bundled overwrite (data-loss proof)", async () => {
    // 1. Seed a real user IRON catalog into a HEALTHY fake IDB via a full boot.
    setBundledDocsProvider(async () => null);
    const seed = createAppStore(makeStorageStub().storage);
    await seed.getState().uploadDocsText(DOCS_TEXT);
    expect(seed.getState().catalogSource).toEqual({ kind: "user" });

    // 2. Break IDB (open fails) and boot with a COPPER bundled provider. init
    //    sees 'unavailable' → bundled-ready (copper) WITHOUT saving.
    resetDbCache();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const goodIdb = (globalThis as any).indexedDB;
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
    setBundledDocsProvider(async () => ({
      text: DOCS_TEXT_COPPER,
      provenance: BUNDLED_PROVENANCE,
    }));
    const degraded = createAppStore(makeStorageStub().storage);
    await degraded.getState().init();
    const d = degraded.getState();
    expect(d.catalog.status).toBe("ready");
    if (d.catalog.status === "ready") {
      expect(d.catalog.catalog.recipes["ingot_copper"]).toBeDefined();
    }
    expect(d.catalogSource).toMatchObject({ kind: "bundled" });
    expect(d.uploadError).toBe(
      "cached data couldn't be read this session — using bundled data",
    );

    // 3. Restore the HEALTHY IDB (same backing as step 1) and boot again. The
    //    seeded IRON user row is intact — the unavailable path never wrote over
    //    it with copper.
    resetDbCache();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).indexedDB = goodIdb;
    const recovered = createAppStore(makeStorageStub().storage);
    await recovered.getState().init();
    const r = recovered.getState();
    expect(r.catalog.status).toBe("ready");
    if (r.catalog.status === "ready") {
      expect(r.catalog.catalog.recipes["ingot_iron"]).toBeDefined();
      expect(r.catalog.catalog.recipes["ingot_copper"]).toBeUndefined();
    }
    expect(r.catalogSource).toEqual({ kind: "user" });
  });

  it("uploading over a bundled catalog flips the source to user", async () => {
    setBundledDocsProvider(async () => ({
      text: DOCS_TEXT,
      provenance: BUNDLED_PROVENANCE,
    }));
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().init();
    expect(store.getState().catalogSource).toMatchObject({ kind: "bundled" });

    // A user upload replaces the catalog and its provenance.
    await store.getState().uploadDocsText(DOCS_TEXT_COPPER);
    expect(store.getState().catalogSource).toEqual({ kind: "user" });
  });
});
