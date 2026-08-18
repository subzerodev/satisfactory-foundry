import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { describe, it, expect, beforeEach } from "vitest";
import { Fraction } from "../core/fraction.ts";
import { resetDbCache } from "../data/db.ts";
import { saveCatalog } from "../data/catalog-store.ts";
import { CATALOG_PARSER_VERSION } from "../data/catalog-store.ts";
import { parseCatalogFromText } from "../data/catalog.ts";
import type { Catalog } from "../data/types.ts";
import type { PlanFileV1, PlanFileV2, PlanFileV8 } from "../data/plan-store.ts";
import { createAppStore, setBundledDocsProvider, canLink } from "./store.ts";
import type {
  StageLink,
  NewStageLink,
  PlanBundle,
  ProposedByproductRoute,
} from "./store.ts";
import type {
  LinkTransport,
  PackagingInterstep,
} from "../core/link-transport.ts";
import { proposeChain } from "../core/chain-builder.ts";
import type { ChainProposal } from "../core/chain-builder.ts";
import { applyDrawnDistance } from "../ui/chain-view.ts";
import { EXCLUDED_MACHINE_IDS } from "../ui/chain-builder-adapter.ts";
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
const BUNDLED_DOCS_TEXT = readFileSync(
  "public/bundled-docs/en-US.json",
  "utf8",
);

function compileTimeNewLinkConstraint(): void {
  const wider = {} as StageLink;
  // @ts-expect-error A wider StageLink may carry guarded interstep intent.
  const refused: NewStageLink = wider;
  void refused;
}
void compileTimeNewLinkConstraint;

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
/**
 * Swap globalThis.indexedDB for a factory whose open() always errors (after
 * resetting the db-cache singleton) — the shared broken-IDB fault injection
 * used by the save-fail (Phase 3) and unavailable-path (#9) tests.
 */
function breakIdbOpen(): void {
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
}

const BUNDLED_PROVENANCE = {
  steamBuild: "23855724",
  extractedAt: "2026-04-30",
};

/**
 * Build a valid StoredCatalog row (the exact shape loadCatalog revives) by
 * running the real save path against a throwaway fake-idb, reading the row, then
 * discarding that database. Used to seed a v1 database for the upgrade test
 * without opening at v2 ourselves.
 */
async function buildV1CatalogRow(): Promise<unknown> {
  await freshIdb();
  await saveCatalog(DOCS_TEXT, parseCatalogFromText(DOCS_TEXT));
  const { openDb } = await import("../data/db.ts");
  const db = await openDb();
  const row = await db.get<unknown>("catalog", "current");
  await freshIdb(); // discard the throwaway database
  return row;
}

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

  it("clock '0' / 'abc' / '-5' / '0.5' / '1000' → invalid bad-clock", async () => {
    // '0.5' and '1000' pin ticket #143: the derive now shares parseClockText's
    // [1, 250] range, so an out-of-range clock can no longer reach the solver.
    const store = await readyWithRecipe();
    for (const bad of ["0", "abc", "-5", "0.5", "1000"]) {
      store.getState().setClockPercentText(bad);
      const s = store.getState().solve;
      expect(s.status, `clock ${bad}`).toBe("invalid");
      if (s.status === "invalid") expect(s.reason).toBe("bad-clock");
    }
  });

  it("clock '1' (the floor) and '250' (the cap) solve", async () => {
    const store = await readyWithRecipe();
    for (const ok of ["1", "250"]) {
      store.getState().setClockPercentText(ok);
      expect(store.getState().solve.status, `clock ${ok}`).toBe("solved");
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

  it.each([
    ["feeds", "ore_iron"],
    ["outputs", "iron_ingot"],
  ] as const)(
    "negative %s override → invalid bad-override with lane and slot detail",
    async (side, itemId) => {
      const store = await readyWithRecipe();
      store.getState().setOverride(side, itemId, 1, "-5");
      const s = store.getState().solve;
      expect(s.status).toBe("invalid");
      if (s.status === "invalid") {
        expect(s.reason).toBe("bad-override");
        expect(s.detail).toBe(
          `lane ${itemId} override 2 must be zero or positive; got -5.`,
        );
      }
    },
  );

  it("zero feed and output overrides remain solved", async () => {
    const store = await readyWithRecipe();
    store.getState().setOverride("feeds", "ore_iron", 0, "0");
    expect(store.getState().solve.status).toBe("solved");

    store.getState().setOverride("outputs", "iron_ingot", 0, "0");
    expect(store.getState().solve.status).toBe("solved");
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
    breakIdbOpen();

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
  it("tiers survive a store re-create via the stub; stored value is exactly {unlockedTiers, proposePrefs} under satis_foundry:tiers", async () => {
    const { storage, backing } = makeStorageStub();
    const store = createAppStore(storage);
    store.getState().setUnlockedTiers({ belt: 3, pipe: 1 });

    // The stored value is written under the pinned key and carries exactly the
    // projected slice: { state: { unlockedTiers, proposePrefs }, version }.
    // S20 P3 WIDENED this projection from tiers alone — the untouched
    // proposePrefs ride along at their defaults.
    const raw = backing["satis_foundry:tiers"];
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw!);
    expect(parsed.state).toEqual({
      unlockedTiers: { belt: 3, pipe: 1 },
      proposePrefs: {
        overrides: {},
        excludedMachineIds: ["converter", "packager"],
        unlockedTier: null,
      },
    });

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
// Propose preferences — persistence + read-validation (S20 P3, ticket #102)
// ---------------------------------------------------------------------------

describe("proposePrefs persistence (S20 P3)", () => {
  it("defaults to no overrides, the converter/packager exclusions, and no tier gate", () => {
    const store = createAppStore(makeStorageStub().storage);
    expect(store.getState().proposePrefs).toEqual({
      overrides: {},
      excludedMachineIds: ["converter", "packager"],
      unlockedTier: null,
    });
  });

  it("the default exclusions match the adapter's EXCLUDED_MACHINE_IDS", () => {
    // The store cannot import from the UI layer, so the default is duplicated
    // there. This pin is what stops the two copies drifting apart silently.
    const store = createAppStore(makeStorageStub().storage);
    expect(store.getState().proposePrefs.excludedMachineIds).toEqual([
      ...EXCLUDED_MACHINE_IDS,
    ]);
  });

  it("round-trips through storage: write → new store instance on the same backing → hydrated", () => {
    const { storage } = makeStorageStub();
    const store = createAppStore(storage);
    store.getState().setProposePrefs({
      overrides: { iron_plate: "alternate_coated_iron_plate" },
      excludedMachineIds: ["converter"],
      unlockedTier: 4,
    });

    const store2 = createAppStore(storage);
    expect(store2.getState().proposePrefs).toEqual({
      overrides: { iron_plate: "alternate_coated_iron_plate" },
      excludedMachineIds: ["converter"],
      unlockedTier: 4,
    });
  });

  it("setProposePrefs is a PARTIAL update — untouched fields survive", () => {
    const store = createAppStore(makeStorageStub().storage);
    store.getState().setProposePrefs({ unlockedTier: 2 });
    expect(store.getState().proposePrefs).toEqual({
      overrides: {},
      excludedMachineIds: ["converter", "packager"],
      unlockedTier: 2,
    });
  });

  it("an empty exclusion array round-trips as empty (a legitimate user choice)", () => {
    const { storage } = makeStorageStub();
    createAppStore(storage).getState().setProposePrefs({
      excludedMachineIds: [],
    });
    expect(
      createAppStore(storage).getState().proposePrefs.excludedMachineIds,
    ).toEqual([]);
  });

  it("corrupt stored prefs drop to defaults", () => {
    const { storage } = makeStorageStub({
      "satis_foundry:tiers": JSON.stringify({
        state: {
          unlockedTiers: { belt: 3, pipe: 1 },
          proposePrefs: {
            overrides: "not an object",
            excludedMachineIds: 7,
            unlockedTier: "high",
          },
        },
        version: 0,
      }),
    });
    expect(createAppStore(storage).getState().proposePrefs).toEqual({
      overrides: {},
      excludedMachineIds: ["converter", "packager"],
      unlockedTier: null,
    });
  });

  it("drops non-string entries inside otherwise well-shaped containers", () => {
    const { storage } = makeStorageStub({
      "satis_foundry:tiers": JSON.stringify({
        state: {
          unlockedTiers: { belt: 3, pipe: 1 },
          proposePrefs: {
            overrides: { good: "recipe_a", bad: 42 },
            excludedMachineIds: ["converter", 9, null],
            unlockedTier: 1,
          },
        },
        version: 0,
      }),
    });
    expect(createAppStore(storage).getState().proposePrefs).toEqual({
      overrides: { good: "recipe_a" },
      excludedMachineIds: ["converter"],
      unlockedTier: 1,
    });
  });

  it.each([
    ["a negative tier", -1],
    ["a fractional tier", 2.5],
    ["a non-number tier", "3"],
    ["null (already 'all')", null],
  ])("validates %s to null on read", (_label, stored) => {
    // Catalog-INDEPENDENT validation. Without it a persisted -1/2.5/NaN would
    // survive, render as "all" (no such option exists) while gating filtered
    // out every unlock-bearing recipe — and it would be STICKY, since nothing
    // writes back and selecting "all" fires no change event.
    const { storage } = makeStorageStub({
      "satis_foundry:tiers": JSON.stringify({
        state: {
          unlockedTiers: { belt: 3, pipe: 1 },
          proposePrefs: {
            overrides: {},
            excludedMachineIds: [],
            unlockedTier: stored,
          },
        },
        version: 0,
      }),
    });
    expect(createAppStore(storage).getState().proposePrefs.unlockedTier).toBe(
      null,
    );
  });

  it("keeps an ABOVE-RANGE tier verbatim — no clamp on read", () => {
    // Deliberately NOT clamped: a catalog-derived bound does not exist at merge
    // time (persist hydrates while the catalog is still 'initializing'), and a
    // too-high tier gates nothing, so it already behaves as "all". The RENDER
    // normalizes it, with no write-back.
    const { storage } = makeStorageStub({
      "satis_foundry:tiers": JSON.stringify({
        state: {
          unlockedTiers: { belt: 3, pipe: 1 },
          proposePrefs: {
            overrides: {},
            excludedMachineIds: [],
            unlockedTier: 999,
          },
        },
        version: 0,
      }),
    });
    expect(createAppStore(storage).getState().proposePrefs.unlockedTier).toBe(
      999,
    );
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
    breakIdbOpen();

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
    breakIdbOpen();

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const goodIdb = (globalThis as any).indexedDB;
    breakIdbOpen();
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

// ---------------------------------------------------------------------------
// Plan lifecycle (ticket #11) — the full save/load matrix
// ---------------------------------------------------------------------------

describe("plan lifecycle (ticket #11)", () => {
  // A ready store with a real iron catalog + a selection worth round-tripping.
  async function readyStore() {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT);
    return store;
  }

  it("save → list → load round-trips the EXACT selection (fractional clock + override strings + tiers)", async () => {
    const store = await readyStore();
    store.getState().setUnlockedTiers({ belt: 4, pipe: 1 });
    store.getState().selectRecipe("ingot_iron");
    store.getState().setMachineCount(20);
    store.getState().setClockPercentText("37.5");
    store.getState().setOverride("feeds", "ore_iron", 0, "480");

    await store.getState().savePlanAs("Iron Line");
    expect(store.getState().plans).toHaveLength(1);
    const id = store.getState().plans![0]!.id;

    // Mutate the live selection away, then load the plan back.
    store.getState().setClockPercentText("999");
    store.getState().setMachineCount(3);
    await store.getState().loadPlan(id);

    const s = store.getState().selection;
    expect(s.clockPercentText).toBe("37.5");
    expect(s.machineCount).toBe(20);
    expect(s.recipeId).toBe("ingot_iron");
    // Stage 3 / Phase 1: loadPlan PRESERVES the current global tiers (progression,
    // not plan content) rather than restoring the saved plan's. Here the tiers were
    // unmutated between save and load, so the current-global value equals what was
    // saved — the assertion re-points at the live global tiers for honesty.
    expect(s.unlockedTiers).toEqual(store.getState().selection.unlockedTiers);
    expect(s.overrides.feeds.ore_iron).toEqual(["480"]);
    // A single derive ran on load → the restored selection solves.
    expect(store.getState().solve.status).toBe("solved");
  });

  it("round-trips a huge feed override and re-solves with its later entry clamped", async () => {
    const store = await readyStore();
    const hugeOverride = "270215977642229760";
    store.getState().setUnlockedTiers({ belt: 4, pipe: 1 });
    store.getState().selectRecipe("ingot_iron");
    store.getState().setMachineCount(20);
    store.getState().setOverride("feeds", "ore_iron", 0, hugeOverride);

    expect(store.getState().solve.status).toBe("solved");
    await store.getState().savePlanAs("Huge override");
    const id = store.getState().plans![0]!.id;

    store.getState().setOverride("feeds", "ore_iron", 0, "480");
    store.getState().setMachineCount(3);
    await store.getState().loadPlan(id);

    expect(store.getState().selection.overrides.feeds.ore_iron).toEqual([
      hugeOverride,
    ]);
    const solve = store.getState().solve;
    expect(solve.status).toBe("solved");
    if (solve.status === "solved") {
      expect(solve.result.feeds[0]!.belts[1]!.entersAfterMachine).toBe(20);
    }
  });

  it("save-by-name overwrites (same id, bumped updatedAt), never duplicates", async () => {
    const store = await readyStore();
    store.getState().setClockPercentText("100");
    await store.getState().savePlanAs("Plan");
    const first = store.getState().plans![0]!;

    store.getState().setClockPercentText("250");
    await store.getState().savePlanAs("Plan");
    const plans = store.getState().plans!;
    expect(plans).toHaveLength(1);
    expect(plans[0]!.id).toBe(first.id);
    expect(plans[0]!.updatedAt >= first.updatedAt).toBe(true);

    // The overwrite carries the new selection.
    await store.getState().loadPlan(first.id);
    expect(store.getState().selection.clockPercentText).toBe("250");
  });

  it("rename changes the name under the same id", async () => {
    const store = await readyStore();
    await store.getState().savePlanAs("Before");
    const id = store.getState().plans![0]!.id;
    await store.getState().renamePlan(id, "After");
    const plans = store.getState().plans!;
    expect(plans).toHaveLength(1);
    expect(plans[0]!.id).toBe(id);
    expect(plans[0]!.name).toBe("After");
  });

  it("rename-to-collision is REFUSED with planError (state untouched)", async () => {
    const store = await readyStore();
    await store.getState().savePlanAs("Alpha");
    await store.getState().savePlanAs("Beta");
    const beta = store.getState().plans!.find((p) => p.name === "Beta")!;
    await store.getState().renamePlan(beta.id, "Alpha");
    expect(store.getState().planError).toMatch(/already exists/);
    // Beta is still Beta (no rename happened).
    expect(store.getState().plans!.find((p) => p.id === beta.id)!.name).toBe(
      "Beta",
    );
  });

  it("empty / whitespace name is rejected with planError", async () => {
    const store = await readyStore();
    await store.getState().savePlanAs("   ");
    expect(store.getState().planError).toBe("plan name required");
    expect(store.getState().plans ?? []).toHaveLength(0);
  });

  it("name matching is trimmed (savePlanAs('  X  ') overwrites 'X')", async () => {
    const store = await readyStore();
    await store.getState().savePlanAs("X");
    await store.getState().savePlanAs("  X  ");
    expect(store.getState().plans).toHaveLength(1);
    expect(store.getState().plans![0]!.name).toBe("X");
  });

  it("null-window uniqueness: savePlanAs overwrites an existing name with state.plans still null", async () => {
    // Seed a plan through one store, then a FRESH store that never refreshed
    // (state.plans === null) saves the same name — the fresh listPlans() read at
    // op time must see the existing row and OVERWRITE, not duplicate.
    const seedStore = await readyStore();
    await seedStore.getState().savePlanAs("Shared");
    const seedId = seedStore.getState().plans![0]!.id;

    const fresh = await readyStore();
    expect(fresh.getState().plans).toBeNull(); // never refreshed
    await fresh.getState().savePlanAs("Shared");
    // Exactly one row, and it reused the existing id.
    const all = await (await import("../data/plan-store.ts")).listPlans();
    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe(seedId);
  });

  it("concurrent double savePlanAs('A') (two unawaited calls) → exactly ONE row", async () => {
    const store = await readyStore();
    // Two unawaited calls before either resolves: without serialization both
    // would see no "A" and both create. The chain forces create-then-overwrite.
    const p1 = store.getState().savePlanAs("A");
    const p2 = store.getState().savePlanAs("A");
    await Promise.all([p1, p2]);
    const all = await (await import("../data/plan-store.ts")).listPlans();
    expect(all).toHaveLength(1);
  });

  it("chain rejection-resilience: an op forced to fail sets planError, and the NEXT op still runs", async () => {
    const store = await readyStore();
    // Break IDB so the next enqueued op fails, then restore for the following op.
    breakIdbOpen();
    await store.getState().savePlanAs("WillFail");
    expect(store.getState().planError).not.toBeNull();

    // The chain is NOT poisoned — a following op runs to completion.
    await freshIdb();
    await store.getState().savePlanAs("Works");
    const all = await (await import("../data/plan-store.ts")).listPlans();
    expect(all.map((p) => p.name)).toEqual(["Works"]);
  });

  it("delete removes the plan; refresh reflects it", async () => {
    const store = await readyStore();
    await store.getState().savePlanAs("Doomed");
    const id = store.getState().plans![0]!.id;
    await store.getState().deletePlan(id);
    expect(store.getState().plans).toHaveLength(0);
  });

  it("load-corrupt → planError, selection untouched", async () => {
    const store = await readyStore();
    store.getState().selectRecipe("ingot_iron");
    const before = store.getState().selection;
    // Write a corrupt row directly, then load it.
    const db = await (await import("../data/db.ts")).openDb();
    await db.put("plans", { format_version: 2 }, "corrupt-id");
    await store.getState().loadPlan("corrupt-id");
    expect(store.getState().planError).not.toBeNull();
    expect(store.getState().selection).toEqual(before);
  });

  it("corrupt row is skipped in the list", async () => {
    const store = await readyStore();
    await store.getState().savePlanAs("Good");
    const db = await (await import("../data/db.ts")).openDb();
    await db.put("plans", { garbage: true }, "corrupt-id");
    await store.getState().refreshPlans();
    expect(store.getState().plans!.map((p) => p.name)).toEqual(["Good"]);
  });

  it("dangling recipeId on load → null + idle solve (#5 re-validation)", async () => {
    // Save a plan referencing ingot_iron, then load it against a catalog that
    // dropped that recipe (uploaded copper). The recipeId re-validates to null.
    const store = await readyStore();
    store.getState().selectRecipe("ingot_iron");
    await store.getState().savePlanAs("Iron");
    const id = store.getState().plans![0]!.id;

    await store.getState().uploadDocsText(DOCS_TEXT_COPPER);
    await store.getState().loadPlan(id);
    expect(store.getState().selection.recipeId).toBeNull();
    expect(store.getState().solve.status).toBe("idle");
  });

  // NOTE (Stage 3 / Phase 1): the former "out-of-range tiers on load → clamped
  // via clampTier" row is DELETED with its code path. loadPlan no longer reads
  // saved.unlockedTiers (tiers are progression, not plan content — the current
  // global value is preserved), so there is nothing to clamp on load.

  it("machineCount null in file → NaN → rendered invalid on load", async () => {
    const store = await readyStore();
    store.getState().selectRecipe("ingot_iron");
    await store.getState().savePlanAs("Base");
    const id = store.getState().plans![0]!.id;
    const db = await (await import("../data/db.ts")).openDb();
    const plan = (await db.get<PlanFileV2>("plans", id))!;
    // JSON.stringify(NaN) emits null; the stored file legitimately holds it.
    (
      plan.stages[0]!.selection as { machineCount: number | null }
    ).machineCount = null;
    await db.put("plans", plan, id);

    await store.getState().loadPlan(id);
    expect(Number.isNaN(store.getState().selection.machineCount)).toBe(true);
    const solve = store.getState().solve;
    expect(solve.status).toBe("invalid");
    if (solve.status === "invalid")
      expect(solve.reason).toBe("bad-machine-count");
  });

  it("plan ops with broken IDB → planError, never a crash", async () => {
    const store = await readyStore();
    breakIdbOpen();
    await store.getState().refreshPlans();
    expect(store.getState().planError).not.toBeNull();
  });

  it("loading a plan never touches the catalog or catalogSource", async () => {
    const store = await readyStore();
    store.getState().selectRecipe("ingot_iron");
    await store.getState().savePlanAs("Base");
    const id = store.getState().plans![0]!.id;
    const catBefore = store.getState().catalog;
    const sourceBefore = store.getState().catalogSource;
    await store.getState().loadPlan(id);
    expect(store.getState().catalog).toBe(catBefore);
    expect(store.getState().catalogSource).toBe(sourceBefore);
  });

  it("v1→v2 DB upgrade preserves the catalog row (init reads it back as ready)", async () => {
    // Seed the database at v1 (single `catalog` store) with a real, revivable
    // StoredCatalog row — exactly what the pre-#11 build wrote — WITHOUT going
    // through the app's save path (which would open at v2 and skip the upgrade).
    // Then boot: openDb's additive v2 upgrade must leave the row intact, so init
    // lands 'ready' and the newly-created plans store is usable alongside it.
    const storedRow = await buildV1CatalogRow();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("satis_foundry", 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore("catalog");
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("catalog", "readwrite");
        tx.objectStore("catalog").put(storedRow, "current");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    resetDbCache();
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().init();
    const s = store.getState();
    expect(s.catalog.status).toBe("ready");
    if (s.catalog.status === "ready") {
      expect(s.catalog.catalog.recipes["ingot_iron"]).toBeDefined();
    }
    // The plans store is present post-upgrade: a plan op runs cleanly.
    await store.getState().refreshPlans();
    expect(store.getState().planError).toBeNull();
    expect(store.getState().plans).toEqual([]);
  });

  it("onblocked open → unavailable degrade, never a hang", async () => {
    // A concurrent old-version connection blocks the upgrade: openDb fires
    // onblocked → reject, which loadCatalog collapses to 'unavailable'. With no
    // bundled provider, init must SETTLE in the unavailable degrade (mapped to
    // needs-upload{stale}) — the key assertion is that init resolves at all.
    resetDbCache();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).indexedDB = {
      open: () => {
        const req: Record<string, unknown> = {
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
          onblocked: null,
        };
        queueMicrotask(() => {
          if (typeof req.onblocked === "function")
            (req.onblocked as () => void)();
        });
        return req;
      },
    };
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().init(); // must resolve, not hang
    const s = store.getState();
    expect(s.catalog.status).toBe("needs-upload");
  });
});

// ---------------------------------------------------------------------------
// Stage graph (Stage 3 / Phase 1, ticket #16)
// ---------------------------------------------------------------------------

// A chain catalog: ingot_iron (ore_iron → iron_ingot, 30/min each) PLUS
// iron_plate (iron_ingot → iron_plate, 30/min each). A link ingot_iron-stage →
// iron_plate-stage on iron_ingot has a real supply (producer output) and demand
// (consumer feed), so reconciliation compares exact totals.
const DOCS_TEXT_CHAIN = JSON.stringify([
  {
    NativeClass:
      "/Script/CoreUObject.Class'/Script/FactoryGame.FGResourceDescriptor'",
    Classes: [
      {
        ClassName: "Desc_OreIron_C",
        mDisplayName: "Iron Ore",
        mForm: "RF_SOLID",
      },
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
      {
        ClassName: "Desc_IronPlate_C",
        mDisplayName: "Iron Plate",
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
      {
        ClassName: "Recipe_IronPlate_C",
        mDisplayName: "Iron Plate",
        mIngredients:
          "((ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_IronIngot_C\"',Amount=1))",
        mProduct:
          "((ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_IronPlate_C\"',Amount=1))",
        mManufactoringDuration: "2",
        mProducedIn: "/Game/Path/Build_SmelterMk1_C",
      },
    ],
  },
]);

describe("stage graph — default-stage boot + CRUD (Stage 3 P1)", () => {
  it("boots with exactly one default stage 'Stage 1', active, mirrored", () => {
    const store = createAppStore(makeStorageStub().storage);
    const s = store.getState();
    expect(s.stageOrder).toHaveLength(1);
    const only = s.stages[s.activeStageId]!;
    expect(only.name).toBe("Stage 1");
    // Top-level selection/solve MIRROR the active stage.
    expect(s.selection).toBe(only.selection);
    expect(s.solve).toBe(only.solve);
    expect(s.links).toEqual([]);
    expect(s.reconciliation).toEqual([]);
  });

  it("addStage appends 'Stage N', default selection, active cursor unchanged", () => {
    const store = createAppStore(makeStorageStub().storage);
    const first = store.getState().activeStageId;
    store.getState().addStage();
    const s = store.getState();
    expect(s.stageOrder).toHaveLength(2);
    expect(s.activeStageId).toBe(first); // addStage doesn't move the cursor
    const added = s.stages[s.stageOrder[1]!]!;
    expect(added.name).toBe("Stage 2");
    expect(added.selection.recipeId).toBeNull();
  });

  it("addStage seeds the new stage's tiers from the ACTIVE stage (tiers-global on create)", async () => {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT_CHAIN);
    store.getState().setUnlockedTiers({ belt: 2, pipe: 1 });
    store.getState().addStage();
    const s = store.getState();
    const added = s.stages[s.stageOrder[1]!]!;
    // Seeded from the active stage, NOT defaultSelection's full table.
    expect(added.selection.unlockedTiers).toEqual({ belt: 2, pipe: 1 });
  });

  it("renameStage changes the name, keeps the id (stable across renames)", () => {
    const store = createAppStore(makeStorageStub().storage);
    const id = store.getState().activeStageId;
    store.getState().renameStage(id, "Smelting");
    expect(store.getState().stages[id]!.name).toBe("Smelting");
    expect(store.getState().activeStageId).toBe(id); // same id
  });

  it("setActiveStage switches the cursor and re-mirrors the newly-active stage", async () => {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT_CHAIN);
    store.getState().selectRecipe("ingot_iron"); // on Stage 1
    store.getState().addStage();
    const second = store.getState().stageOrder[1]!;
    store.getState().setActiveStage(second);
    const s = store.getState();
    expect(s.activeStageId).toBe(second);
    // The mirror now reflects Stage 2 (fresh, no recipe), not Stage 1.
    expect(s.selection.recipeId).toBeNull();
    expect(s.selection).toBe(s.stages[second]!.selection);
  });
});

describe("stage graph — removeStage cursor + cascade rules (Stage 3 P1)", () => {
  it("removing the ACTIVE stage moves the cursor to the first remaining", () => {
    const store = createAppStore(makeStorageStub().storage);
    const first = store.getState().activeStageId;
    store.getState().addStage();
    const second = store.getState().stageOrder[1]!;
    store.getState().setActiveStage(second);
    store.getState().removeStage(second);
    const s = store.getState();
    expect(s.stageOrder).toEqual([first]);
    expect(s.activeStageId).toBe(first); // cursor resolved to first remaining
    expect(s.selection).toBe(s.stages[first]!.selection);
  });

  it("removing the LAST stage is refused (≥1-stage invariant, no-op)", () => {
    const store = createAppStore(makeStorageStub().storage);
    const only = store.getState().activeStageId;
    store.getState().removeStage(only);
    expect(store.getState().stageOrder).toEqual([only]);
    expect(store.getState().activeStageId).toBe(only);
  });

  it("removeStage cascades links touching it (splice order, delete entry)", async () => {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT_CHAIN);
    store.getState().selectRecipe("ingot_iron");
    store.getState().addStage();
    const a = store.getState().stageOrder[0]!;
    const b = store.getState().stageOrder[1]!;
    store.getState().setActiveStage(b);
    store.getState().selectRecipe("iron_plate");
    store
      .getState()
      .addLink({ fromStageId: a, itemId: "iron_ingot", toStageId: b });
    expect(store.getState().links).toHaveLength(1);

    store.getState().removeStage(a); // active is b; removing a keeps cursor on b
    const s = store.getState();
    expect(s.stageOrder).toEqual([b]);
    expect(s.stages[a]).toBeUndefined();
    expect(s.links).toEqual([]); // cascaded with the removed stage
    expect(s.reconciliation).toEqual([]);
  });
});

describe("extraction selection state (#112)", () => {
  it("clones purity mix input at the action boundary", () => {
    const store = createAppStore(makeStorageStub().storage);
    const id = store.getState().activeStageId;
    const purityMix = { impure: "1", normal: "2", pure: "3" };

    store.getState().setExtractionSelection(id, "stone", {
      machineId: "miner_mk3",
      clockPercentText: "150",
      purityMix,
    });
    purityMix.normal = "changed outside the store";

    const stored = store.getState().stages[id]!.extraction?.stone;
    expect(stored?.purityMix).toEqual({
      impure: "1",
      normal: "2",
      pure: "3",
    });
    expect(stored?.purityMix).not.toBe(purityMix);
  });

  it("stores and removes a purity mix under the __proto__ item key", () => {
    const store = createAppStore(makeStorageStub().storage);
    const id = store.getState().activeStageId;

    store.getState().setExtractionSelection(id, "__proto__", {
      machineId: "miner_mk1",
      clockPercentText: "100",
      purityMix: { impure: "1", normal: "0", pure: "0" },
    });

    const extraction = store.getState().stages[id]!.extraction!;
    expect(Object.getPrototypeOf(extraction)).toBeNull();
    expect(Object.hasOwn(extraction, "__proto__")).toBe(true);
    expect(extraction.__proto__?.purityMix).toEqual({
      impure: "1",
      normal: "0",
      pure: "0",
    });

    store.getState().setExtractionSelection(id, "__proto__", {
      machineId: "miner_mk1",
      clockPercentText: "100",
    });
    expect(
      store.getState().stages[id]!.extraction?.__proto__?.purityMix,
    ).toBeUndefined();
  });

  it("sets, clears, and isolates extraction intent by stage and raw item", () => {
    const store = createAppStore(makeStorageStub().storage);
    const first = store.getState().activeStageId;
    store.getState().addStage();
    const second = store.getState().stageOrder[1]!;
    store.getState().setExtractionSelection(first, "stone", {
      machineId: "miner_mk3",
      clockPercentText: "150",
    });
    expect(store.getState().stages[first]!.extraction?.stone).toEqual({
      machineId: "miner_mk3",
      clockPercentText: "150",
    });
    expect(store.getState().stages[second]!.extraction).toBeUndefined();
    store.getState().setExtractionSelection(first, "stone", null);
    expect(store.getState().stages[first]!.extraction?.stone).toBeUndefined();
  });

  it("handles the raw item id constructor as an own property", () => {
    const store = createAppStore(makeStorageStub().storage);
    const id = store.getState().activeStageId;
    expect(
      store.getState().stages[id]!.extraction?.constructor,
    ).toBeUndefined();
    store.getState().setExtractionSelection(id, "constructor", {
      machineId: "miner_mk1",
      clockPercentText: "100",
    });
    expect(
      Object.hasOwn(store.getState().stages[id]!.extraction!, "constructor"),
    ).toBe(true);
  });

  it("retains a prototype-like purity mix across recipe swaps and plan v8", async () => {
    const store = createAppStore(makeStorageStub().storage);
    const id = store.getState().activeStageId;
    store.getState().setExtractionSelection(id, "__proto__", {
      machineId: "miner_mk1",
      clockPercentText: "bad edit",
      purityMix: { impure: "01", normal: "bad", pure: "3" },
    });
    store.getState().applyRecipeSwap(id, "not-in-catalog", 2);
    expect(store.getState().stages[id]!.extraction?.__proto__).toEqual({
      machineId: "miner_mk1",
      clockPercentText: "bad edit",
      purityMix: { impure: "01", normal: "bad", pure: "3" },
    });
    await store.getState().savePlanAs("Extraction");
    const planId = store.getState().plans![0]!.id;
    const db = await (await import("../data/db.ts")).openDb();
    const written = (await db.get<PlanFileV8>("plans", planId))!;
    expect(written.format_version).toBe(8);
    expect(written.stages[0]!.extraction?.__proto__?.purityMix).toEqual({
      impure: "01",
      normal: "bad",
      pure: "3",
    });
    store.getState().setExtractionSelection(id, "__proto__", null);
    await store.getState().loadPlan(planId);
    const loadedId = store.getState().activeStageId;
    const extraction = store.getState().stages[loadedId]!.extraction!;
    expect(Object.hasOwn(extraction, "__proto__")).toBe(true);
    expect(extraction.__proto__).toEqual({
      machineId: "miner_mk1",
      clockPercentText: "bad edit",
      purityMix: { impure: "01", normal: "bad", pure: "3" },
    });
    expect(Object.getPrototypeOf(extraction)).toBeNull();
  });
});

describe("stage graph — link add refusals vs kept-and-flagged (Stage 3 P1)", () => {
  async function chainStore() {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT_CHAIN);
    store.getState().selectRecipe("ingot_iron"); // Stage 1 produces iron_ingot
    store.getState().addStage();
    const a = store.getState().stageOrder[0]!;
    const b = store.getState().stageOrder[1]!;
    store.getState().setActiveStage(b);
    store.getState().selectRecipe("iron_plate"); // Stage 2 consumes iron_ingot
    return { store, a, b };
  }

  it("self-link is hard-refused", async () => {
    const { store, a } = await chainStore();
    store
      .getState()
      .addLink({ fromStageId: a, itemId: "iron_ingot", toStageId: a });
    expect(store.getState().links).toHaveLength(0);
  });

  it("duplicate (toStageId,itemId) is hard-refused", async () => {
    const { store, a, b } = await chainStore();
    store
      .getState()
      .addLink({ fromStageId: a, itemId: "iron_ingot", toStageId: b });
    store
      .getState()
      .addLink({ fromStageId: a, itemId: "iron_ingot", toStageId: b });
    expect(store.getState().links).toHaveLength(1);
  });

  it("a link whose ends stop producing/consuming is KEPT + flagged dangling", async () => {
    const { store, a, b } = await chainStore();
    store
      .getState()
      .addLink({ fromStageId: a, itemId: "iron_ingot", toStageId: b });
    // Break the consumer: Stage 2 now makes ingots, so it no longer FEEDS iron_ingot.
    store.getState().selectRecipe("ingot_iron"); // active is still b
    const s = store.getState();
    expect(s.links).toHaveLength(1); // never silently deleted
    expect(s.reconciliation).toEqual([
      { type: "dangling-link", linkId: s.links[0]!.id, end: "to" },
    ]);
  });
});

describe("stage graph — link transport + selection (Stage 7 P2)", () => {
  async function linkedStore() {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT_CHAIN);
    store.getState().selectRecipe("ingot_iron");
    store.getState().addStage();
    const a = store.getState().stageOrder[0]!;
    const b = store.getState().stageOrder[1]!;
    store.getState().setActiveStage(b);
    store.getState().selectRecipe("iron_plate");
    store
      .getState()
      .addLink({ fromStageId: a, itemId: "iron_ingot", toStageId: b });
    const linkId = store.getState().links[0]!.id;
    return { store, linkId };
  }

  it("setLinkTransport writes the config; clearLinkTransport drops it", async () => {
    const { store, linkId } = await linkedStore();
    store.getState().setLinkTransport(linkId, {
      mode: "train",
      trip: { kind: "estimated", distanceText: "1200" },
    });
    expect(store.getState().links[0]!.transport).toEqual({
      mode: "train",
      trip: { kind: "estimated", distanceText: "1200" },
    });
    store.getState().clearLinkTransport(linkId);
    // The key is fully dropped (belt default), not left as an empty object.
    expect("transport" in store.getState().links[0]!).toBe(false);
  });

  it("applies a drawn distance through setLinkTransport — road one-way vs drone 2× (the units trap)", async () => {
    // The Axis-3 measure feed: applyDrawnDistance maps the drawn dm per the
    // mode's arm, and the store write lands that raw text on the link. 4120 dm
    // drawn → road distanceText 412 (one-way m); drone flightMetersText 824
    // (round-trip = 2× one-way). This pins the ONE units-trap mapping site as it
    // reaches the store.
    const { store, linkId } = await linkedStore();

    // Road (truck): estimated distanceText = one-way meters.
    store.getState().setLinkTransport(linkId, {
      mode: "truck",
      trip: { kind: "estimated", distanceText: "" },
    });
    const roadNext = applyDrawnDistance(store.getState().links[0]!, 4120);
    store.getState().setLinkTransport(linkId, roadNext!);
    expect(store.getState().links[0]!.transport).toEqual({
      mode: "truck",
      trip: { kind: "estimated", distanceText: "412" },
    });

    // Drone: estimated flightMetersText = ROUND-TRIP meters (2× the drawn one-way).
    store.getState().setLinkTransport(linkId, {
      mode: "drone",
      fuel: "battery",
      trip: { kind: "estimated", flightMetersText: "" },
    });
    const droneNext = applyDrawnDistance(store.getState().links[0]!, 4120);
    store.getState().setLinkTransport(linkId, droneNext!);
    expect(store.getState().links[0]!.transport).toEqual({
      mode: "drone",
      fuel: "battery",
      trip: { kind: "estimated", flightMetersText: "824" },
    });
  });

  it("offers no apply mapping for a measured link (never downgrade the basis)", async () => {
    const { store, linkId } = await linkedStore();
    store.getState().setLinkTransport(linkId, {
      mode: "truck",
      trip: { kind: "measured", roundTripSecondsText: "60" },
    });
    expect(applyDrawnDistance(store.getState().links[0]!, 4120)).toBeNull();
  });

  it("selectLink opens the inspector; removeLink clears a selection on it", async () => {
    const { store, linkId } = await linkedStore();
    store.getState().selectLink(linkId);
    expect(store.getState().selectedLinkId).toBe(linkId);
    store.getState().removeLink(linkId);
    expect(store.getState().links).toHaveLength(0);
    expect(store.getState().selectedLinkId).toBeNull();
  });

  it("removeStage clearing a cascaded link also closes its inspector", async () => {
    const { store, linkId } = await linkedStore();
    const producerId = store.getState().links[0]!.fromStageId;
    store.getState().selectLink(linkId);
    store.getState().removeStage(producerId); // cascades the incident link
    expect(store.getState().selectedLinkId).toBeNull();
  });

  it("transport config survives a save → load round-trip through the store", async () => {
    const { store, linkId } = await linkedStore();
    store.getState().setLinkTransport(linkId, {
      mode: "drone",
      fuel: "battery",
      trip: { kind: "measured", roundTripSecondsText: "180" },
    });
    await store.getState().savePlanAs("Trip");
    const id = store.getState().plans![0]!.id;
    // Mutate live state, then reload — the loaded transport must match the saved.
    store.getState().clearLinkTransport(linkId);
    await store.getState().loadPlan(id);
    const loaded = store
      .getState()
      .links.find((l) => l.transport !== undefined);
    expect(loaded!.transport).toEqual({
      mode: "drone",
      fuel: "battery",
      trip: { kind: "measured", roundTripSecondsText: "180" },
    });
  });
});

describe("stage graph — packaging interstep persistence actions (#113)", () => {
  async function packagedStore() {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(BUNDLED_DOCS_TEXT);
    store.getState().selectRecipe("unpackage_water");
    store.getState().addStage();
    const from = store.getState().stageOrder[0]!;
    const to = store.getState().stageOrder[1]!;
    store.getState().setActiveStage(to);
    store.getState().selectRecipe("packaged_water");
    store
      .getState()
      .addLink({ fromStageId: from, toStageId: to, itemId: "water" });
    return { store, linkId: store.getState().links[0]!.id, from, to };
  }

  function setInterstep(
    store: ReturnType<typeof createAppStore>,
    linkId: string,
    interstep: PackagingInterstep | null,
  ): void {
    (
      store.getState() as unknown as {
        setLinkInterstep(id: string, value: PackagingInterstep | null): void;
      }
    ).setLinkInterstep(linkId, interstep);
  }

  const validIntent: PackagingInterstep = {
    packageRecipeId: "packaged_water",
    clockPercentText: "100",
    returnTransport: { mode: "belt" },
  };

  it("enables both belt routes atomically and disables back to fluid pipe", async () => {
    const { store, linkId } = await packagedStore();
    store.getState().setLinkTransport(linkId, {
      mode: "train",
      trip: { kind: "estimated", distanceText: "900" },
    });
    store.setState({ reconciliation: [] });
    setInterstep(store, linkId, {
      ...validIntent,
      returnTransport: {
        mode: "train",
        trip: { kind: "estimated", distanceText: "900" },
      },
    });
    expect(store.getState().links[0]).toMatchObject({
      transport: { mode: "belt" },
      interstep: validIntent,
    });
    expect(store.getState().reconciliation).not.toEqual([]);

    store.setState({ reconciliation: [] });
    setInterstep(store, linkId, null);
    expect(store.getState().links[0]!.interstep).toBeUndefined();
    expect(store.getState().links[0]!.transport).toEqual({ mode: "pipe" });
    expect(store.getState().reconciliation).not.toEqual([]);
  });

  it("refuses illegal packaged routes without changing state", async () => {
    const { store, linkId } = await packagedStore();
    setInterstep(store, linkId, validIntent);
    const before = store.getState().links[0];
    store.getState().setLinkTransport(linkId, { mode: "pipe" });
    expect(store.getState().links[0]).toBe(before);

    setInterstep(store, linkId, {
      ...validIntent,
      returnTransport: {
        mode: "fluid-truck",
        trip: { kind: "estimated", distanceText: "1" },
      },
    });
    expect(store.getState().links[0]).toBe(before);
  });

  it("preserves interstep intent on legal transport edits and clear", async () => {
    const { store, linkId } = await packagedStore();
    setInterstep(store, linkId, validIntent);
    store.getState().setLinkTransport(linkId, {
      mode: "truck",
      trip: { kind: "estimated", distanceText: "bad edit" },
    });
    expect(store.getState().links[0]!.interstep).toEqual(validIntent);
    store.setState({ reconciliation: [] });
    store.getState().clearLinkTransport(linkId);
    expect(store.getState().links[0]).toMatchObject({
      transport: { mode: "belt" },
      interstep: validIntent,
    });
    expect(store.getState().reconciliation).not.toEqual([]);
  });

  it("runtime-refuses addLink intent smuggled through a wider value", async () => {
    const { store, from, to } = await packagedStore();
    store.getState().removeLink(store.getState().links[0]!.id);
    const bypass: StageLink = {
      id: "ignored",
      fromStageId: from,
      toStageId: to,
      itemId: "water",
      interstep: validIntent,
    };
    store.getState().addLink(bypass as never);
    expect(store.getState().links).toEqual([]);
  });

  it("writes v8 and save/reloads retained valid intent after refusals", async () => {
    const { store, linkId } = await packagedStore();
    setInterstep(store, linkId, validIntent);
    setInterstep(store, linkId, {
      ...validIntent,
      clockPercentText: "bad edit",
      returnTransport: {
        mode: "train",
        trip: { kind: "estimated", distanceText: "" },
        sharedEnds: { to: true },
      },
    });
    store.getState().setLinkTransport(linkId, { mode: "pipe" });
    await store.getState().savePlanAs("Packaging");
    const id = store.getState().plans![0]!.id;
    const exported = JSON.parse((await store.getState().exportPlan(id))!);
    expect(exported.format_version).toBe(8);
    expect(exported.links[0].interstep.clockPercentText).toBe("bad edit");

    setInterstep(store, linkId, null);
    await store.getState().loadPlan(id);
    expect(store.getState().links[0]!.interstep).toEqual({
      ...validIntent,
      clockPercentText: "bad edit",
      returnTransport: {
        mode: "train",
        trip: { kind: "estimated", distanceText: "" },
        sharedEnds: { to: true },
      },
    });
    expect(store.getState().links[0]!.transport).toEqual({ mode: "belt" });

    const copy = { ...exported, name: "Packaging copy" };
    await store.getState().importPlan(JSON.stringify(copy));
    const bundle = JSON.parse((await store.getState().exportAllPlans())!);
    expect(bundle.plans).toHaveLength(2);
    expect(
      bundle.plans.every(
        (plan: { links: StageLink[] }) =>
          plan.links[0]?.interstep?.clockPercentText === "bad edit",
      ),
    ).toBe(true);
  });

  it("canonicalizes wider forward and return transports for v8 save/reload", async () => {
    const { store, linkId } = await packagedStore();
    setInterstep(store, linkId, validIntent);

    const widerForward = {
      mode: "train" as const,
      trip: {
        kind: "estimated" as const,
        distanceText: "900",
        ignoredNested: "strip",
      },
      sharedEnds: { from: true as const, ignoredNested: true },
      ignoredTopLevel: "strip",
    };
    const typedForward: LinkTransport = widerForward;
    store.getState().setLinkTransport(linkId, typedForward);

    const widerReturn = {
      packageRecipeId: "packaged_water",
      clockPercentText: "125",
      returnTransport: {
        mode: "train" as const,
        trip: {
          kind: "measured" as const,
          roundTripSecondsText: "180",
          ignoredNested: "strip",
        },
        sharedEnds: { to: true as const, ignoredNested: true },
        ignoredTopLevel: "strip",
      },
      ignoredInterstep: "strip",
    };
    const typedInterstep: PackagingInterstep = widerReturn;
    setInterstep(store, linkId, typedInterstep);

    expect(store.getState().links[0]).toMatchObject({
      transport: {
        mode: "train",
        trip: { kind: "estimated", distanceText: "900" },
        sharedEnds: { from: true },
      },
      interstep: {
        packageRecipeId: "packaged_water",
        clockPercentText: "125",
        returnTransport: {
          mode: "train",
          trip: { kind: "measured", roundTripSecondsText: "180" },
          sharedEnds: { to: true },
        },
      },
    });
    expect(store.getState().links[0]!.transport).not.toHaveProperty(
      "ignoredTopLevel",
    );
    expect(
      store.getState().links[0]!.interstep!.returnTransport,
    ).not.toHaveProperty("ignoredTopLevel");

    await store.getState().savePlanAs("Canonical packaging");
    const id = store.getState().plans![0]!.id;
    const exported = JSON.parse((await store.getState().exportPlan(id))!);
    expect(exported.links[0].transport).toEqual({
      mode: "train",
      trip: { kind: "estimated", distanceText: "900" },
      sharedEnds: { from: true },
    });
    expect(exported.links[0].interstep.returnTransport).toEqual({
      mode: "train",
      trip: { kind: "measured", roundTripSecondsText: "180" },
      sharedEnds: { to: true },
    });

    setInterstep(store, linkId, null);
    await store.getState().loadPlan(id);
    expect(store.getState().links[0]!.transport).toEqual(
      exported.links[0].transport,
    );
    expect(store.getState().links[0]!.interstep).toEqual(
      exported.links[0].interstep,
    );
  });

  it("runtime-refuses malformed setter structures without changing state", async () => {
    const { store, linkId } = await packagedStore();
    setInterstep(store, linkId, validIntent);
    const before = store.getState().links[0];

    store.getState().setLinkTransport(linkId, {
      mode: "train",
      trip: { kind: "estimated" },
    } as unknown as LinkTransport);
    expect(store.getState().links[0]).toBe(before);

    setInterstep(store, linkId, {
      packageRecipeId: "packaged_water",
      clockPercentText: "100",
      returnTransport: {
        mode: "drone",
        fuel: "not-a-fuel",
        trip: { kind: "estimated", flightMetersText: "900" },
      },
    } as unknown as PackagingInterstep);
    expect(store.getState().links[0]).toBe(before);
  });

  it("disables stale intent phase-safely for solid and missing items", async () => {
    const { store } = await packagedStore();
    const base = store.getState().links[0]!;
    store.setState({
      links: [{ ...base, itemId: "iron_plate", interstep: validIntent }],
    });
    setInterstep(store, base.id, null);
    expect(store.getState().links[0]!.transport).toEqual({ mode: "belt" });

    store.setState({
      links: [{ ...base, itemId: "missing-item", interstep: validIntent }],
    });
    setInterstep(store, base.id, null);
    expect("transport" in store.getState().links[0]!).toBe(false);
  });

  it("reconciles interstep validity atomically across every link mutation", async () => {
    const { store, linkId } = await packagedStore();

    setInterstep(store, linkId, validIntent);
    expect(
      store
        .getState()
        .reconciliation.some((finding) => finding.type === "interstep-problem"),
    ).toBe(false);

    setInterstep(store, linkId, {
      ...validIntent,
      clockPercentText: "bad clock",
    });
    expect(
      store
        .getState()
        .reconciliation.filter(
          (finding) => finding.type === "interstep-problem",
        ),
    ).toHaveLength(1);

    setInterstep(store, linkId, validIntent);
    expect(
      store
        .getState()
        .reconciliation.some((finding) => finding.type === "interstep-problem"),
    ).toBe(false);

    store.getState().setLinkTransport(linkId, {
      mode: "truck",
      trip: { kind: "estimated", distanceText: "" },
    });
    expect(
      store
        .getState()
        .reconciliation.some((finding) => finding.type === "interstep-problem"),
    ).toBe(false);

    store.getState().clearLinkTransport(linkId);
    expect(
      store
        .getState()
        .reconciliation.some((finding) => finding.type === "interstep-problem"),
    ).toBe(false);

    setInterstep(store, linkId, { ...validIntent, packageRecipeId: "stale" });
    expect(
      store
        .getState()
        .reconciliation.filter(
          (finding) => finding.type === "interstep-problem",
        ),
    ).toHaveLength(1);

    setInterstep(store, linkId, null);
    expect(
      store
        .getState()
        .reconciliation.some((finding) => finding.type === "interstep-problem"),
    ).toBe(false);

    setInterstep(store, linkId, validIntent);
    store.getState().removeLink(linkId);
    expect(store.getState().reconciliation).toEqual([]);
  });

  it("refreshes stale interstep findings when the catalog is replaced", async () => {
    const { store, linkId } = await packagedStore();
    setInterstep(store, linkId, validIntent);
    expect(
      store
        .getState()
        .reconciliation.some((finding) => finding.type === "interstep-problem"),
    ).toBe(false);

    await store.getState().uploadDocsText(DOCS_TEXT_CHAIN);
    const problems = store
      .getState()
      .reconciliation.filter(
        (finding) =>
          finding.linkId === linkId && finding.type === "interstep-problem",
      );
    expect(problems).toHaveLength(1);
  });
});

describe("stage graph — reconciliation math + cadence (Stage 3 P1)", () => {
  // Build a producer→consumer chain with explicit machine counts.
  async function linkedChain(nProducer: number, mConsumer: number) {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT_CHAIN);
    const a = store.getState().stageOrder[0]!;
    store.getState().selectRecipe("ingot_iron");
    store.getState().setMachineCount(nProducer);
    store.getState().addStage();
    const b = store.getState().stageOrder[1]!;
    store.getState().setActiveStage(b);
    store.getState().selectRecipe("iron_plate");
    store.getState().setMachineCount(mConsumer);
    store
      .getState()
      .addLink({ fromStageId: a, itemId: "iron_ingot", toStageId: b });
    return { store, a, b };
  }

  it("exact supply == demand → no finding (2 producers, 2 consumers = 60 each)", async () => {
    const { store } = await linkedChain(2, 2);
    expect(store.getState().reconciliation).toEqual([]);
  });

  it("under-supply → exact shortfall (1 producer=30 vs 2 consumers=60)", async () => {
    const { store } = await linkedChain(1, 2);
    const findings = store.getState().reconciliation;
    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.type).toBe("under-supply");
    if (f.type === "under-supply") {
      expect(f.supply.eq(Fraction.from(30))).toBe(true);
      expect(f.demand.eq(Fraction.from(60))).toBe(true);
      expect(f.shortfall.eq(Fraction.from(30))).toBe(true);
    }
  });

  it("over-supply → exact surplus (2 producers=60 vs 1 consumer=30)", async () => {
    const { store } = await linkedChain(2, 1);
    const findings = store.getState().reconciliation;
    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.type).toBe("over-supply");
    if (f.type === "over-supply") {
      expect(f.surplus.eq(Fraction.from(30))).toBe(true);
    }
  });

  it("fractional (75/2-class) rates reconcile exactly (37.5% clock → 75/2 shortfall)", async () => {
    const { store, b } = await linkedChain(1, 2);
    // Drop the consumer to 37.5% clock: demand = 2 × 30 × 37.5/100 = 45/2 = 22.5,
    // supply stays 30 → OVER by 15/2. Change goes through setClockPercentText.
    store.getState().setActiveStage(b);
    store.getState().setClockPercentText("37.5");
    const findings = store.getState().reconciliation;
    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.type).toBe("over-supply");
    if (f.type === "over-supply") {
      expect(f.demand.eq(Fraction.of(45, 2))).toBe(true); // 22.5 exact
      expect(f.surplus.eq(Fraction.of(15, 2))).toBe(true); // 7.5 exact
    }
  });

  it("removeLink recomputes reconciliation to empty", async () => {
    const { store } = await linkedChain(1, 2);
    expect(store.getState().reconciliation).toHaveLength(1);
    const linkId = store.getState().links[0]!.id;
    store.getState().removeLink(linkId);
    expect(store.getState().links).toHaveLength(0);
    expect(store.getState().reconciliation).toEqual([]);
  });

  it("a producer-side recipe change re-derives that stage AND recomputes reconciliation", async () => {
    const { store, a } = await linkedChain(2, 2); // exact, no finding
    expect(store.getState().reconciliation).toEqual([]);
    // Halve the producer's machines → under-supply surfaces.
    store.getState().setActiveStage(a);
    store.getState().setMachineCount(1);
    const findings = store.getState().reconciliation;
    expect(findings).toHaveLength(1);
    expect(findings[0]!.type).toBe("under-supply");
  });

  it("cycles are permitted structurally without any finding", async () => {
    const { store, a, b } = await linkedChain(2, 2);
    // A forward link a→b on iron_ingot already exists. Add the reverse b→a on
    // iron_ingot, forming a 2-cycle. b doesn't OUTPUT iron_ingot and a doesn't
    // FEED it, so the reverse link is dangling — but it is ACCEPTED, never
    // refused for topology (cycles are structurally permitted this phase).
    store
      .getState()
      .addLink({ fromStageId: b, itemId: "iron_ingot", toStageId: a });
    const s = store.getState();
    expect(s.links).toHaveLength(2); // the cycle edge is accepted
    // The forward link stays exact (no finding); the reverse is dangling — but no
    // cycle-typed finding EVER appears (Phase 1 drops cycle detection).
    expect(s.reconciliation.some((f) => f.type === "dangling-link")).toBe(true);
    for (const f of s.reconciliation) {
      expect(["under-supply", "over-supply", "dangling-link"]).toContain(
        f.type,
      );
    }
  });
});

describe("setStageMachineCount — per-stage write (Stage 8 P1, the apply affordance)", () => {
  // A producer→consumer chain where the CONSUMER (b) is the active stage, so
  // writing the producer (a) exercises the non-active path. ingot_iron and
  // iron_plate are both 30/min per machine (duration 2, amount 1).
  async function chain(nProducer: number, mConsumer: number) {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT_CHAIN);
    const a = store.getState().stageOrder[0]!;
    store.getState().selectRecipe("ingot_iron");
    store.getState().setMachineCount(nProducer);
    store.getState().addStage();
    const b = store.getState().stageOrder[1]!;
    store.getState().setActiveStage(b); // consumer is the ACTIVE stage
    store.getState().selectRecipe("iron_plate");
    store.getState().setMachineCount(mConsumer);
    store
      .getState()
      .addLink({ fromStageId: a, itemId: "iron_ingot", toStageId: b });
    return { store, a, b };
  }

  it("writes a NON-active stage's machineCount + re-derives, active stage untouched", async () => {
    const { store, a, b } = await chain(1, 2); // producer=30, consumer=60 → short 30
    const beforeActive = store.getState().stages[b]!;
    expect(store.getState().reconciliation).toHaveLength(1);
    expect(store.getState().reconciliation[0]!.type).toBe("under-supply");

    // Apply the match count to the PRODUCER (non-active). Its solve re-derives
    // to 60/min, closing the shortfall.
    store.getState().setStageMachineCount(a, 2);
    const s = store.getState();

    // The producer's selection took the write and re-derived.
    expect(s.stages[a]!.selection.machineCount).toBe(2);
    // The shortfall is gone (supply now matches demand).
    expect(s.reconciliation).toEqual([]);

    // The active stage (b) is UNTOUCHED — cursor, selection, and solve identity
    // all preserved (the mirror never followed the non-active write).
    expect(s.activeStageId).toBe(b);
    expect(s.stages[b]!.selection).toBe(beforeActive.selection);
    expect(s.stages[b]!.solve).toBe(beforeActive.solve);
    expect(s.selection).toBe(s.stages[b]!.selection); // top-level mirror stays b
  });

  it("is a no-op for an unknown stage id", async () => {
    const { store, a, b } = await chain(1, 2);
    const beforeA = store.getState().stages[a]!;
    const beforeB = store.getState().stages[b]!;
    const keysBefore = Object.keys(store.getState().stages).sort();
    store.getState().setStageMachineCount("no-such-stage", 99);
    const s = store.getState();
    // No stage touched, and no phantom stage created (the guard returns {}
    // before any derive/mirror — never a stray stages["no-such-stage"]).
    expect(s.stages[a]).toBe(beforeA);
    expect(s.stages[b]).toBe(beforeB);
    expect(Object.keys(s.stages).sort()).toEqual(keysBefore);
    expect(s.reconciliation).toHaveLength(1);
    expect(s.reconciliation[0]!.type).toBe("under-supply");
  });

  it("delegates for the active stage — setStageMachineCount(active) matches setMachineCount", async () => {
    // The active-path delegation proof: writing the active stage via the new
    // action lands the same solve the active setter does. (The existing
    // setMachineCount tests pin the active behavior unchanged; this pins that
    // the generalized action IS that behavior when stageId === activeStageId.)
    const { store, b } = await chain(1, 2);
    store.getState().setStageMachineCount(b, 3);
    const viaStage = store.getState().stages[b]!.solve;
    expect(store.getState().stages[b]!.selection.machineCount).toBe(3);
    // The active mirror follows (b IS active).
    expect(store.getState().solve).toBe(viaStage);
  });
});

describe("stage graph — tiers-global + multi-stage re-upload (Stage 3 P1)", () => {
  it("setUnlockedTiers writes ALL stages and re-derives every one", async () => {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT_CHAIN);
    store.getState().addStage();
    store.getState().addStage(); // three stages
    store.getState().setUnlockedTiers({ belt: 3, pipe: 1 });
    const s = store.getState();
    for (const id of s.stageOrder) {
      expect(s.stages[id]!.selection.unlockedTiers).toEqual({
        belt: 3,
        pipe: 1,
      });
    }
  });

  it("re-upload re-validates EVERY stage (inactive dangling recipeId → null, overrides cleared)", async () => {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT_CHAIN);
    // Stage 1 (active) selects a recipe absent from the copper catalog.
    store.getState().selectRecipe("ingot_iron");
    store.getState().setOverride("feeds", "ore_iron", 0, "480");
    // Stage 2 (INACTIVE) also selects a soon-to-be-dangling recipe + an override.
    store.getState().addStage();
    const b = store.getState().stageOrder[1]!;
    store.getState().setActiveStage(b);
    store.getState().selectRecipe("iron_plate");
    store.getState().setOverride("feeds", "iron_ingot", 0, "120");
    // Switch back to Stage 1, then upload the copper catalog (drops both recipes).
    const a = store.getState().stageOrder[0]!;
    store.getState().setActiveStage(a);
    await store.getState().uploadDocsText(DOCS_TEXT_COPPER);

    const s = store.getState();
    // BOTH stages: recipeId re-validated to null, overrides cleared (the B1 pin).
    expect(s.stages[a]!.selection.recipeId).toBeNull();
    expect(s.stages[a]!.selection.overrides).toEqual({
      feeds: {},
      outputs: {},
    });
    expect(s.stages[b]!.selection.recipeId).toBeNull();
    expect(s.stages[b]!.selection.overrides).toEqual({
      feeds: {},
      outputs: {},
    });
  });

  it("loadPlan PRESERVES the current global tiers (does not adopt the saved plan's)", async () => {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT_CHAIN);
    store.getState().selectRecipe("ingot_iron");
    store.getState().setUnlockedTiers({ belt: 2, pipe: 1 });
    await store.getState().savePlanAs("Base"); // saves tiers {belt:2,pipe:1}
    const id = store.getState().plans![0]!.id;

    // Progress the factory: unlock more tiers globally AFTER saving.
    store.getState().setUnlockedTiers({ belt: 5, pipe: 2 });
    await store.getState().loadPlan(id);
    // The load keeps the CURRENT global tiers, not the plan's older {2,1}.
    expect(store.getState().selection.unlockedTiers).toEqual({
      belt: 5,
      pipe: 2,
    });
  });
});

// ---------------------------------------------------------------------------
// Stage 3 / Phase 2 — canvas positions + auto-placement + canLink
// ---------------------------------------------------------------------------

describe("stage graph — canvas positions + auto-placement (Stage 3 P2)", () => {
  it("boots with the default stage auto-placed at seq 0's slot", () => {
    const store = createAppStore(makeStorageStub().storage);
    const s = store.getState();
    // seq 0 → x = 40 + (0%4)*260 = 40, y = 40 + floor(0/4)*140 = 40.
    expect(s.positions[s.activeStageId]).toEqual({ x: 40, y: 40 });
  });

  it("addStage auto-places at the monotonic seq slot (column-flow)", () => {
    const store = createAppStore(makeStorageStub().storage);
    store.getState().addStage(); // seq 1 → x = 40 + 260 = 300, y = 40
    store.getState().addStage(); // seq 2 → x = 40 + 520 = 560, y = 40
    store.getState().addStage(); // seq 3 → x = 40 + 780 = 820, y = 40
    store.getState().addStage(); // seq 4 → x = 40, y = 40 + 140 = 180 (wraps)
    const s = store.getState();
    const slots = s.stageOrder.map((id) => s.positions[id]);
    expect(slots).toEqual([
      { x: 40, y: 40 },
      { x: 300, y: 40 },
      { x: 560, y: 40 },
      { x: 820, y: 40 },
      { x: 40, y: 180 },
    ]);
  });

  it("placementSeq is monotonic across removeStage (never reused, compaction-immune)", () => {
    const store = createAppStore(makeStorageStub().storage);
    store.getState().addStage(); // seq 1 → x = 300
    const second = store.getState().stageOrder[1]!;
    store.getState().removeStage(second); // frees nothing — seq does not rewind
    store.getState().addStage(); // seq 2 → x = 560, NOT 300 again
    const s = store.getState();
    const added = s.stages[s.stageOrder[1]!]!;
    expect(s.positions[added.id]).toEqual({ x: 560, y: 40 });
  });

  it("removeStage prunes the removed stage's position entry (no orphans)", () => {
    const store = createAppStore(makeStorageStub().storage);
    store.getState().addStage();
    const second = store.getState().stageOrder[1]!;
    expect(store.getState().positions[second]).toBeDefined();
    store.getState().removeStage(second);
    expect(store.getState().positions[second]).toBeUndefined();
  });

  it("setStagePosition writes the position without deriving (cadence none/none)", () => {
    const store = createAppStore(makeStorageStub().storage);
    const id = store.getState().activeStageId;
    const solveBefore = store.getState().solve;
    const reconBefore = store.getState().reconciliation;
    store.getState().setStagePosition(id, { x: 512, y: 128 });
    const s = store.getState();
    expect(s.positions[id]).toEqual({ x: 512, y: 128 });
    // No derive / reconcile ran — the same object references survive.
    expect(s.solve).toBe(solveBefore);
    expect(s.reconciliation).toBe(reconBefore);
  });

  it("setStagePosition on an unknown id is a no-op", () => {
    const store = createAppStore(makeStorageStub().storage);
    const before = store.getState().positions;
    store.getState().setStagePosition("nope", { x: 9, y: 9 });
    expect(store.getState().positions).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Stage 10 / Phase 1 — flow direction + userPlaced
// ---------------------------------------------------------------------------

describe("stage graph — flow direction + userPlaced (Stage 10 P1)", () => {
  it("boots LR by default with an empty userPlaced set", () => {
    const store = createAppStore(makeStorageStub().storage);
    const s = store.getState();
    expect(s.flowDirection).toBe("LR");
    expect(s.userPlaced).toEqual({});
  });

  it("placementSlot TB arm: addStage under TB flows downward (rows), columns wrap", () => {
    const store = createAppStore(makeStorageStub().storage);
    store.getState().setFlowDirection("TB");
    store.getState().addStage(); // seq 1 → TB: x=40, y=40+140=180
    store.getState().addStage(); // seq 2 → TB: x=40, y=40+280=320
    store.getState().addStage(); // seq 3 → TB: x=40, y=40+420=460
    store.getState().addStage(); // seq 4 → TB: x=40+260=300, y=40 (col wraps)
    const s = store.getState();
    const slots = s.stageOrder.map((id) => s.positions[id]);
    expect(slots).toEqual([
      { x: 40, y: 40 }, // the seq-0 default stage, re-slotted on the LR→TB switch
      { x: 40, y: 180 },
      { x: 40, y: 320 },
      { x: 40, y: 460 },
      { x: 300, y: 40 },
    ]);
  });

  it("setStagePosition marks the stage userPlaced", () => {
    const store = createAppStore(makeStorageStub().storage);
    const id = store.getState().activeStageId;
    expect(store.getState().userPlaced[id]).toBeUndefined();
    store.getState().setStagePosition(id, { x: 500, y: 500 });
    expect(store.getState().userPlaced[id]).toBe(true);
  });

  it("removeStage prunes the userPlaced entry (no orphans)", () => {
    const store = createAppStore(makeStorageStub().storage);
    store.getState().addStage();
    const second = store.getState().stageOrder[1]!;
    store.getState().setStagePosition(second, { x: 1, y: 2 });
    expect(store.getState().userPlaced[second]).toBe(true);
    store.getState().removeStage(second);
    expect(store.getState().userPlaced[second]).toBeUndefined();
  });

  it("setFlowDirection transposes NON-userPlaced positions by order index", () => {
    const store = createAppStore(makeStorageStub().storage);
    store.getState().addStage(); // seq 1
    store.getState().addStage(); // seq 2
    // All three are auto-placed (LR grid). Switch to TB → order-index re-grid.
    store.getState().setFlowDirection("TB");
    const s = store.getState();
    const slots = s.stageOrder.map((id) => s.positions[id]);
    // Order indices 0,1,2 → TB slots: down the first column.
    expect(slots).toEqual([
      { x: 40, y: 40 },
      { x: 40, y: 180 },
      { x: 40, y: 320 },
    ]);
    // Re-slotting a stage NEVER marks it userPlaced (the switch must stay pure).
    expect(s.userPlaced).toEqual({});
  });

  it("setFlowDirection preserves userPlaced positions, re-slots only auto ones", () => {
    const store = createAppStore(makeStorageStub().storage);
    store.getState().addStage(); // index 1, auto
    store.getState().addStage(); // index 2, auto
    const [first, dragged, auto] = store.getState().stageOrder;
    // Hand-drag the middle stage — it becomes userPlaced and must stay pinned.
    store.getState().setStagePosition(dragged!, { x: 999, y: 888 });
    store.getState().setFlowDirection("TB");
    const s = store.getState();
    // The dragged stage keeps its exact position…
    expect(s.positions[dragged!]).toEqual({ x: 999, y: 888 });
    // …while the two auto stages re-grid to their order-index TB slots.
    expect(s.positions[first!]).toEqual({ x: 40, y: 40 });
    expect(s.positions[auto!]).toEqual({ x: 40, y: 320 });
    // userPlaced still holds exactly the one dragged stage.
    expect(s.userPlaced).toEqual({ [dragged!]: true });
  });

  it("setFlowDirection on the same direction is a no-op (positions untouched)", () => {
    const store = createAppStore(makeStorageStub().storage);
    store.getState().addStage();
    const before = store.getState().positions;
    store.getState().setFlowDirection("LR"); // already LR
    expect(store.getState().positions).toBe(before);
    expect(store.getState().flowDirection).toBe("LR");
  });
});

describe("stage graph — canLink mirrors addLink refusals (Stage 3 P2)", () => {
  const link = (
    fromStageId: string,
    itemId: string,
    toStageId: string,
  ): StageLink => ({ id: crypto.randomUUID(), fromStageId, itemId, toStageId });

  it("returns 'ok' when the link would be accepted", () => {
    expect(canLink([], "a", "b", "iron_ingot")).toBe("ok");
  });

  it("returns 'self' for a self-link (from === to)", () => {
    expect(canLink([], "a", "a", "iron_ingot")).toBe("self");
  });

  it("returns 'duplicate' for an existing (toStageId, itemId) feed lane", () => {
    const existing = [link("a", "iron_ingot", "b")];
    expect(canLink(existing, "c", "b", "iron_ingot")).toBe("duplicate");
  });

  it("a different item into the same consumer is NOT a duplicate", () => {
    const existing = [link("a", "iron_ingot", "b")];
    expect(canLink(existing, "a", "b", "copper_ingot")).toBe("ok");
  });

  it("the same item into a DIFFERENT consumer is NOT a duplicate", () => {
    const existing = [link("a", "iron_ingot", "b")];
    expect(canLink(existing, "a", "c", "iron_ingot")).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// Whole-graph plans (Stage 3 / Phase 3, ticket #18) — Axis 6 rows
// ---------------------------------------------------------------------------

describe("plans carry the graph (Stage 3 P3)", () => {
  // A chain-catalog store: Stage 1 = ingot_iron (ore_iron → iron_ingot),
  // a second stage = iron_plate (iron_ingot → iron_plate). A link between them
  // on iron_ingot reconciles against real supply/demand.
  async function chainStore() {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT_CHAIN);
    return store;
  }

  /**
   * Build a 3-stage linked graph with dragged positions in `store`:
   * Smelt (ingot_iron) → Plate (iron_plate) on iron_ingot, plus a third
   * recipe-less stage. Returns the stage ids in stageOrder.
   */
  function buildThreeStageGraph(
    store: ReturnType<typeof createAppStore>,
  ): string[] {
    const s = store.getState();
    const smelt = s.activeStageId;
    s.renameStage(smelt, "Smelt");
    s.selectRecipe("ingot_iron");
    s.setMachineCount(4);
    s.setClockPercentText("150");

    s.addStage(); // Stage 2
    const plate = store.getState().stageOrder[1]!;
    store.getState().setActiveStage(plate);
    store.getState().renameStage(plate, "Plate");
    store.getState().selectRecipe("iron_plate");
    store.getState().setMachineCount(2);

    store.getState().addStage(); // Stage 3 — left recipe-less
    const spare = store.getState().stageOrder[2]!;
    store.getState().renameStage(spare, "Spare");

    // A real feed link Smelt → Plate on iron_ingot (supply + demand).
    store.getState().addLink({
      fromStageId: smelt,
      toStageId: plate,
      itemId: "iron_ingot",
    });

    // Dragged positions, distinct from the auto-slots.
    store.getState().setStagePosition(smelt, { x: 111, y: 222 });
    store.getState().setStagePosition(plate, { x: 333, y: 444 });
    store.getState().setStagePosition(spare, { x: 555, y: 666 });

    // Return to the first stage before saving so activeStageId is deterministic.
    store.getState().setActiveStage(smelt);
    return [smelt, plate, spare];
  }

  it("round-trips a 3-stage linked graph: names/order/selections/links/positions identical, fresh ids, exact Fractions", async () => {
    const store = await chainStore();
    const [smelt, plate, spare] = buildThreeStageGraph(store);
    const beforeSolve = store.getState().stages[smelt!]!.solve;
    expect(beforeSolve.status).toBe("solved");

    await store.getState().savePlanAs("Chain");
    const id = store.getState().plans![0]!.id;

    // Tear the live graph down to a single default stage, then reload.
    const fresh = await chainStore();
    await fresh.getState().loadPlan(id);
    const s = fresh.getState();

    // Order + names identical.
    expect(s.stageOrder).toHaveLength(3);
    const names = s.stageOrder.map((sid) => s.stages[sid]!.name);
    expect(names).toEqual(["Smelt", "Plate", "Spare"]);

    // Fresh ids — none of the original ids survive (uuids regenerated).
    expect(s.stageOrder).not.toContain(smelt);
    expect(s.stageOrder).not.toContain(plate);
    expect(s.stageOrder).not.toContain(spare);

    // Selections identical (recipe, count, clock).
    const [nSmelt, nPlate, nSpare] = s.stageOrder;
    expect(s.stages[nSmelt!]!.selection.recipeId).toBe("ingot_iron");
    expect(s.stages[nSmelt!]!.selection.machineCount).toBe(4);
    expect(s.stages[nSmelt!]!.selection.clockPercentText).toBe("150");
    expect(s.stages[nPlate!]!.selection.recipeId).toBe("iron_plate");
    expect(s.stages[nPlate!]!.selection.machineCount).toBe(2);
    expect(s.stages[nSpare!]!.selection.recipeId).toBeNull();

    // Positions restored exactly (dragged, not auto-slotted).
    expect(s.positions[nSmelt!]).toEqual({ x: 111, y: 222 });
    expect(s.positions[nPlate!]).toEqual({ x: 333, y: 444 });
    expect(s.positions[nSpare!]).toEqual({ x: 555, y: 666 });

    // The single link rebuilt with a fresh id, pointing at the fresh stage ids.
    expect(s.links).toHaveLength(1);
    expect(s.links[0]!.fromStageId).toBe(nSmelt);
    expect(s.links[0]!.toStageId).toBe(nPlate);
    expect(s.links[0]!.itemId).toBe("iron_ingot");

    // Exact Fractions preserved: the reconciled totals survive the round-trip.
    // Smelt: 4 machines × 150% × 30/min = 180/min iron_ingot supply.
    // Plate: 2 machines × 100% × 30/min = 60/min iron_ingot demand → over-supply.
    const finding = s.reconciliation.find((f) => f.linkId === s.links[0]!.id)!;
    expect(finding.type).toBe("over-supply");
    if (finding.type === "over-supply") {
      expect(finding.supply.eq(Fraction.parse("180"))).toBe(true);
      expect(finding.demand.eq(Fraction.parse("60"))).toBe(true);
      expect(finding.surplus.eq(Fraction.parse("120"))).toBe(true);
    }

    // activeStageId is the first stage after load (deterministic).
    expect(s.activeStageId).toBe(nSmelt);
  });

  it("restores flowDirection: a TB plan reloads TB (Stage 10 P1)", async () => {
    const store = await chainStore();
    store.getState().setFlowDirection("TB");
    await store.getState().savePlanAs("Vertical");
    const id = store.getState().plans![0]!.id;

    const fresh = await chainStore();
    expect(fresh.getState().flowDirection).toBe("LR"); // boot default
    await fresh.getState().loadPlan(id);
    expect(fresh.getState().flowDirection).toBe("TB");
  });

  it("save→load→switch: an auto stage stays re-griddable, a dragged stage stays pinned (Stage 10 P1)", async () => {
    // The r2 save→load hole: without the persisted userPlaced flag, every auto
    // slot would seed as user-placed after one round-trip (save writes position
    // unconditionally), permanently exempting auto nodes from the switch.
    const store = await chainStore();
    store.getState().addStage(); // a second stage, auto-placed
    const draggedStage = store.getState().stageOrder[1]!;
    // Drag ONLY the second stage → it is userPlaced; the first stays auto.
    store.getState().setStagePosition(draggedStage, { x: 700, y: 700 });
    await store.getState().savePlanAs("Mixed");
    const id = store.getState().plans![0]!.id;

    const fresh = await chainStore();
    await fresh.getState().loadPlan(id);
    const loaded = fresh.getState();
    // The flag survived the round-trip: only the dragged stage is userPlaced.
    const [nAuto, nDragged] = loaded.stageOrder;
    expect(loaded.userPlaced[nAuto!]).toBeUndefined();
    expect(loaded.userPlaced[nDragged!]).toBe(true);

    // Switch LR→TB: the auto stage RE-GRIDS (order index 0 → TB slot), the
    // dragged stage stays EXACTLY where the user put it.
    fresh.getState().setFlowDirection("TB");
    const afterTB = fresh.getState();
    expect(afterTB.positions[nAuto!]).toEqual({ x: 40, y: 40 });
    expect(afterTB.positions[nDragged!]).toEqual({ x: 700, y: 700 });

    // And switch back TB→LR: the auto stage re-grids again, dragged still pinned.
    fresh.getState().setFlowDirection("LR");
    const afterLR = fresh.getState();
    expect(afterLR.positions[nAuto!]).toEqual({ x: 40, y: 40 });
    expect(afterLR.positions[nDragged!]).toEqual({ x: 700, y: 700 });
  });

  it("a v1-migrated positionless stage auto-slots in the file direction and stays re-griddable (Stage 10 P1)", async () => {
    // A v1 row has no position and no userPlaced flag → it loads auto-placed
    // (re-griddable), and its load-time slot uses the FILE's direction.
    // migrateLegacyV4 defaults a v1-origin file to "LR", so the load slot is the
    // LR index-0 slot.
    const store = await chainStore();
    const db = await (await import("../data/db.ts")).openDb();
    const v1: PlanFileV1 = {
      format_version: 1,
      name: "LegacyAuto",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      stages: [
        {
          selection: {
            recipeId: "ingot_iron",
            machineCount: 1,
            clockPercentText: "100",
            unlockedTiers: { belt: 1, pipe: 1 },
            overrides: { feeds: {}, outputs: {} },
          },
        },
      ],
      links: [],
    };
    await db.put("plans", v1, "legacy-auto");
    await store.getState().loadPlan("legacy-auto");
    const s = store.getState();
    const only = s.stageOrder[0]!;
    // Loaded LR (migrateLegacyV4 default) at index 0's LR slot; NOT userPlaced.
    expect(s.flowDirection).toBe("LR");
    expect(s.positions[only]).toEqual({ x: 40, y: 40 });
    expect(s.userPlaced[only]).toBeUndefined();
    // A switch re-grids it (it was never user-placed).
    store.getState().setFlowDirection("TB");
    expect(store.getState().positions[only]).toEqual({ x: 40, y: 40 });
  });

  it("a pre-v5 positioned stage loads pinned — a subsequent switch does NOT re-slot it (Stage 10 P1)", async () => {
    // v1–v4 files carry no userPlaced flag, so seeding falls back to
    // position-presence: a positioned pre-v5 stage is conservatively treated as
    // intent (pinned), the stated cost of not scrambling an old layout on switch.
    const store = await chainStore();
    const db = await (await import("../data/db.ts")).openDb();
    // A v4 row with an explicit (non-grid) position and no userPlaced concept.
    const v4 = {
      format_version: 4 as const,
      name: "LegacyPinned",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      stages: [
        {
          name: "Stage 1",
          selection: {
            recipeId: "ingot_iron",
            machineCount: 1,
            clockPercentText: "100",
            unlockedTiers: { belt: 1, pipe: 1 },
            overrides: { feeds: {}, outputs: {} },
          },
          position: { x: 321, y: 654 },
        },
      ],
      links: [],
    };
    await db.put("plans", v4, "legacy-pinned");
    await store.getState().loadPlan("legacy-pinned");
    const s = store.getState();
    const only = s.stageOrder[0]!;
    // Seeded userPlaced from position-presence → pinned.
    expect(s.userPlaced[only]).toBe(true);
    store.getState().setFlowDirection("TB");
    // The switch leaves it exactly where the file put it (not re-slotted).
    expect(store.getState().positions[only]).toEqual({ x: 321, y: 654 });
  });

  it("a null machineCount in the file → NaN on load (per stage), rendered invalid", async () => {
    // Plans persist via IDB structured clone, which keeps a live NaN — the
    // null-machineCount edge arises from hand-authored/imported/legacy JSON
    // files (isSelectionShape accepts null). The per-stage build coercion must
    // reconstitute null as NaN so the stage loads rendered-invalid. Simulate
    // the null-in-file case directly, as such a file would present it.
    const store = await chainStore();
    store.getState().selectRecipe("ingot_iron");
    await store.getState().savePlanAs("Broken");
    const id = store.getState().plans![0]!.id;

    const db = await (await import("../data/db.ts")).openDb();
    const raw = (await db.get<PlanFileV2>("plans", id))!;
    (raw.stages[0]!.selection as { machineCount: number | null }).machineCount =
      null;
    await db.put("plans", raw, id);

    const fresh = await chainStore();
    await fresh.getState().loadPlan(id);
    const loaded = fresh.getState().stages[fresh.getState().stageOrder[0]!]!;
    expect(Number.isNaN(loaded.selection.machineCount)).toBe(true);
    expect(loaded.solve.status).toBe("invalid");
  });

  it("load stamps the CURRENT global tiers over every stage (file tiers dead-on-read)", async () => {
    const store = await chainStore();
    store.getState().setUnlockedTiers({ belt: 5, pipe: 3 });
    store.getState().addStage();
    await store.getState().savePlanAs("Tiered");
    const id = store.getState().plans![0]!.id;

    // A fresh store with DIFFERENT global tiers loads the plan.
    const fresh = await chainStore();
    fresh.getState().setUnlockedTiers({ belt: 1, pipe: 1 });
    await fresh.getState().loadPlan(id);
    const s = fresh.getState();
    // Every loaded stage carries the CURRENT global tiers, not the file's.
    for (const sid of s.stageOrder) {
      expect(s.stages[sid]!.selection.unlockedTiers).toEqual({
        belt: 1,
        pipe: 1,
      });
    }
  });

  it("recipeId vanished on load → null, overrides KEPT verbatim, link dangles", async () => {
    const store = await chainStore();
    const smelt = store.getState().activeStageId;
    store.getState().selectRecipe("ingot_iron");
    store.getState().setOverride("feeds", "ore_iron", 0, "480");
    store.getState().addStage();
    const plate = store.getState().stageOrder[1]!;
    store.getState().setActiveStage(plate);
    store.getState().selectRecipe("iron_plate");
    store.getState().addLink({
      fromStageId: smelt,
      toStageId: plate,
      itemId: "iron_ingot",
    });
    await store.getState().savePlanAs("Chain");
    const id = store.getState().plans![0]!.id;

    // Reload against a catalog that DROPPED both recipes (copper only).
    const fresh = createAppStore(makeStorageStub().storage);
    await fresh.getState().uploadDocsText(DOCS_TEXT_COPPER);
    await fresh.getState().loadPlan(id);
    const s = fresh.getState();
    const nSmelt = s.stageOrder[0]!;

    // recipeId re-validated to null (absent from the current catalog)…
    expect(s.stages[nSmelt]!.selection.recipeId).toBeNull();
    // …but overrides are KEPT verbatim (load posture, NOT the upload #5 clear).
    expect(s.stages[nSmelt]!.selection.overrides.feeds.ore_iron).toEqual([
      "480",
    ]);
    // The link survives (not pruned) and dangles — both endpoints recipe-less.
    expect(s.links).toHaveLength(1);
    expect(s.reconciliation.some((f) => f.type === "dangling-link")).toBe(true);
  });

  it("placementSeq re-seeds to stages.length: addStage after load lands on a fresh slot", async () => {
    const store = await chainStore();
    buildThreeStageGraph(store); // 3 stages
    await store.getState().savePlanAs("Chain");
    const id = store.getState().plans![0]!.id;

    const fresh = await chainStore();
    await fresh.getState().loadPlan(id);
    expect(fresh.getState().placementSeq).toBe(3);

    // A new stage auto-places at seq-3's slot (row 0, col 3), not colliding.
    fresh.getState().addStage();
    const added = fresh.getState().stageOrder[3]!;
    expect(fresh.getState().positions[added]).toEqual({
      x: 40 + 3 * 260,
      y: 40,
    });
    expect(fresh.getState().placementSeq).toBe(4);
  });

  it("a v1 file loads: migrated to a single auto-slotted 'Stage 1'", async () => {
    // Write a legacy v1 row directly, then load it through the store.
    const store = await chainStore();
    const db = await (await import("../data/db.ts")).openDb();
    const v1: PlanFileV1 = {
      format_version: 1,
      name: "Legacy",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      stages: [
        {
          selection: {
            recipeId: "ingot_iron",
            machineCount: 7,
            clockPercentText: "100",
            unlockedTiers: { belt: 1, pipe: 1 },
            overrides: { feeds: {}, outputs: {} },
          },
        },
      ],
      links: [],
    };
    await db.put("plans", v1, "legacy-id");

    await store.getState().loadPlan("legacy-id");
    const s = store.getState();
    expect(s.stageOrder).toHaveLength(1);
    const only = s.stages[s.stageOrder[0]!]!;
    expect(only.name).toBe("Stage 1");
    expect(only.selection.recipeId).toBe("ingot_iron");
    expect(only.selection.machineCount).toBe(7);
    // No file position → auto-slotted at index 0.
    expect(s.positions[only.id]).toEqual({ x: 40, y: 40 });
    expect(s.links).toEqual([]);
    expect(s.placementSeq).toBe(1);
  });

  it("a corrupt v2 file refuses to load, leaving the live graph untouched", async () => {
    const store = await chainStore();
    buildThreeStageGraph(store);
    const orderBefore = [...store.getState().stageOrder];
    const linksBefore = store.getState().links.length;

    // A structurally-corrupt v2 row: a self-link.
    const db = await (await import("../data/db.ts")).openDb();
    await db.put(
      "plans",
      {
        format_version: 2,
        name: "Corrupt",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        stages: [
          {
            name: "A",
            selection: store.getState().stages[orderBefore[0]!]!.selection,
          },
          {
            name: "B",
            selection: store.getState().stages[orderBefore[1]!]!.selection,
          },
        ],
        links: [{ from: 1, to: 1, itemId: "iron_ingot" }],
      },
      "corrupt-v2",
    );
    await store.getState().loadPlan("corrupt-v2");
    expect(store.getState().planError).not.toBeNull();
    // The live graph is UNCHANGED (not clobbered).
    expect(store.getState().stageOrder).toEqual(orderBefore);
    expect(store.getState().links).toHaveLength(linksBefore);
  });

  it("renaming a v1 row persists it as v8 (save-over model)", async () => {
    const store = await chainStore();
    const db = await (await import("../data/db.ts")).openDb();
    const v1: PlanFileV1 = {
      format_version: 1,
      name: "OldName",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      stages: [
        {
          selection: {
            recipeId: "ingot_iron",
            machineCount: 1,
            clockPercentText: "100",
            unlockedTiers: { belt: 1, pipe: 1 },
            overrides: { feeds: {}, outputs: {} },
          },
        },
      ],
      links: [],
    };
    await db.put("plans", v1, "v1-id");

    await store.getState().renamePlan("v1-id", "NewName");
    // The stored row is now v8, renamed, single "Stage 1" stage.
    const raw = (await db.get<PlanFileV8>("plans", "v1-id"))!;
    expect(raw.format_version).toBe(8);
    expect(raw.name).toBe("NewName");
    expect(raw.stages[0]!.name).toBe("Stage 1");
    // createdAt carried verbatim through the migration + rename.
    expect(raw.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// Plan export / import (Stage 6 / Phase 1 — frozen Axis 3 + 4 + Axis 5 matrix)
// ---------------------------------------------------------------------------

describe("plan export/import (Stage 6 / Phase 1)", () => {
  async function readyStore() {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT);
    return store;
  }

  it("exportPlan returns the stored v8 JSON verbatim (re-parses to the saved file)", async () => {
    const store = await readyStore();
    store.getState().selectRecipe("ingot_iron");
    store.getState().setClockPercentText("37.5");
    store
      .getState()
      .setExtractionSelection(store.getState().activeStageId, "stone", {
        machineId: "miner_mk3",
        clockPercentText: "bad edit",
        purityMix: { impure: "01", normal: "2.5", pure: "3e0" },
      });
    await store.getState().savePlanAs("Exported");
    const id = store.getState().plans![0]!.id;

    const json = await store.getState().exportPlan(id);
    expect(json).not.toBeNull();
    const parsed = JSON.parse(json!) as PlanFileV8;
    expect(parsed.format_version).toBe(8);
    expect(parsed.name).toBe("Exported");
    expect(parsed.stages[0]!.selection.recipeId).toBe("ingot_iron");
    expect(parsed.stages[0]!.selection.clockPercentText).toBe("37.5");
    expect(parsed.stages[0]!.extraction?.stone?.purityMix).toEqual({
      impure: "01",
      normal: "2.5",
      pure: "3e0",
    });
    // Pretty-printed (2-space indent), matching JSON.stringify(plan, null, 2).
    expect(json).toContain('\n  "format_version": 8');
  });

  it("exportPlan on a missing id returns null (no throw)", async () => {
    const store = await readyStore();
    expect(await store.getState().exportPlan("does-not-exist")).toBeNull();
  });

  it("exportPlan emits the migrated v8 form for a stored v1 row", async () => {
    const store = await readyStore();
    const db = await (await import("../data/db.ts")).openDb();
    const v1: PlanFileV1 = {
      format_version: 1,
      name: "LegacyPlan",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      stages: [
        {
          selection: {
            recipeId: "ingot_iron",
            machineCount: 1,
            clockPercentText: "100",
            unlockedTiers: { belt: 1, pipe: 1 },
            overrides: { feeds: {}, outputs: {} },
          },
        },
      ],
      links: [],
    };
    await db.put("plans", v1, "legacy-id");

    const json = await store.getState().exportPlan("legacy-id");
    const parsed = JSON.parse(json!) as PlanFileV8;
    // The export is what a load sees: v8, one "Stage 1" stage, createdAt kept.
    expect(parsed.format_version).toBe(8);
    expect(parsed.name).toBe("LegacyPlan");
    expect(parsed.stages[0]!.name).toBe("Stage 1");
    expect(parsed.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("import round-trip under a NEW name → identical content, fresh id, createdAt now", async () => {
    const store = await readyStore();
    store.getState().selectRecipe("ingot_iron");
    store.getState().setClockPercentText("42");
    store
      .getState()
      .setExtractionSelection(store.getState().activeStageId, "stone", {
        machineId: "miner_mk3",
        clockPercentText: "125",
        purityMix: { impure: "001", normal: "2", pure: "0003" },
      });
    await store.getState().savePlanAs("Original");
    const srcId = store.getState().plans![0]!.id;
    const json = (await store.getState().exportPlan(srcId))!;

    // Rename the payload so it lands as a new row (not an overwrite).
    const payload = JSON.parse(json) as PlanFileV8;
    payload.name = "Imported";
    payload.createdAt = "1999-12-31T00:00:00.000Z"; // untrusted foreign stamp
    const before = new Date().toISOString();
    await store.getState().importPlan(JSON.stringify(payload));

    const rows = store.getState().plans!;
    expect(rows.map((p) => p.name).sort()).toEqual(["Imported", "Original"]);
    const imported = rows.find((p) => p.name === "Imported")!;
    expect(imported.id).not.toBe(srcId); // fresh id
    // createdAt is NOW (not the foreign 1999 stamp).
    const db = await (await import("../data/db.ts")).openDb();
    const stored = (await db.get<PlanFileV8>("plans", imported.id))!;
    expect(stored.createdAt >= before).toBe(true);
    expect(stored.stages[0]!.selection.clockPercentText).toBe("42");
    expect(stored.stages[0]!.selection.recipeId).toBe("ingot_iron");
    expect(stored.stages[0]!.extraction?.stone?.purityMix).toEqual({
      impure: "001",
      normal: "2",
      pure: "0003",
    });
  });

  it("import OVER an existing name overwrites in place, preserving the row's createdAt", async () => {
    const store = await readyStore();
    store.getState().selectRecipe("ingot_iron");
    await store.getState().savePlanAs("Target");
    const targetId = store.getState().plans![0]!.id;
    const db = await (await import("../data/db.ts")).openDb();
    const originalCreatedAt = (await db.get<PlanFileV2>("plans", targetId))!
      .createdAt;

    // A payload named "Target" (collides) with different content + a foreign stamp.
    const payload: PlanFileV2 = {
      format_version: 2,
      name: "Target",
      createdAt: "1999-12-31T00:00:00.000Z",
      updatedAt: "1999-12-31T00:00:00.000Z",
      stages: [
        {
          name: "Stage 1",
          selection: {
            recipeId: "ingot_iron",
            machineCount: 7,
            clockPercentText: "250",
            unlockedTiers: { belt: 1, pipe: 1 },
            overrides: { feeds: {}, outputs: {} },
          },
        },
      ],
      links: [],
    };
    await store.getState().importPlan(JSON.stringify(payload));

    // Still exactly one "Target" row, same id, createdAt preserved, content replaced.
    expect(
      store.getState().plans!.filter((p) => p.name === "Target"),
    ).toHaveLength(1);
    const stored = (await db.get<PlanFileV2>("plans", targetId))!;
    expect(stored.createdAt).toBe(originalCreatedAt); // NOT the foreign 1999 stamp
    expect(stored.stages[0]!.selection.machineCount).toBe(7);
  });

  it("untrimmed '  Target  ' collides with existing 'Target' (trimmed-form match)", async () => {
    const store = await readyStore();
    store.getState().selectRecipe("ingot_iron");
    await store.getState().savePlanAs("Target");
    const targetId = store.getState().plans![0]!.id;

    const payload: PlanFileV2 = {
      format_version: 2,
      name: "  Target  ", // untrimmed — must collision-match "Target"
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      stages: [
        {
          name: "Stage 1",
          selection: {
            recipeId: null,
            machineCount: 1,
            clockPercentText: "100",
            unlockedTiers: { belt: 1, pipe: 1 },
            overrides: { feeds: {}, outputs: {} },
          },
        },
      ],
      links: [],
    };
    await store.getState().importPlan(JSON.stringify(payload));

    // One row, same id; the stored name is the TRIMMED form.
    expect(store.getState().plans!).toHaveLength(1);
    expect(store.getState().plans![0]!.id).toBe(targetId);
    const db = await (await import("../data/db.ts")).openDb();
    const stored = (await db.get<PlanFileV2>("plans", targetId))!;
    expect(stored.name).toBe("Target");
  });

  it("empty/whitespace payload name → planError, nothing written", async () => {
    const store = await readyStore();
    await store.getState().refreshPlans(); // establish the [] baseline (App mount)
    const payload: PlanFileV2 = {
      format_version: 2,
      name: "   ",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      stages: [
        {
          name: "Stage 1",
          selection: {
            recipeId: null,
            machineCount: 1,
            clockPercentText: "100",
            unlockedTiers: { belt: 1, pipe: 1 },
            overrides: { feeds: {}, outputs: {} },
          },
        },
      ],
      links: [],
    };
    await store.getState().importPlan(JSON.stringify(payload));
    expect(store.getState().planError).toBe("plan name required");
    expect(store.getState().plans).toEqual([]);
  });

  it("corrupt JSON → planError, store untouched", async () => {
    const store = await readyStore();
    await store.getState().refreshPlans(); // establish the [] baseline (App mount)
    await store.getState().importPlan("{not valid json");
    expect(store.getState().planError).not.toBeNull();
    expect(store.getState().plans).toEqual([]);
  });

  it("valid JSON but not a plan file (failed validation) → planError, nothing written", async () => {
    const store = await readyStore();
    await store.getState().refreshPlans(); // establish the [] baseline (App mount)
    await store.getState().importPlan(JSON.stringify({ hello: "world" }));
    expect(store.getState().planError).not.toBeNull();
    expect(store.getState().plans).toEqual([]);
  });

  it("import does NOT change the live graph — even importing over the ACTIVE plan's name", async () => {
    const store = await readyStore();
    store.getState().selectRecipe("ingot_iron");
    store.getState().setMachineCount(3);
    await store.getState().savePlanAs("Active");
    const orderBefore = store.getState().stageOrder;
    const selBefore = store.getState().selection;

    // Import a differently-shaped payload that OVERWRITES "Active"'s stored row.
    const payload: PlanFileV2 = {
      format_version: 2,
      name: "Active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      stages: [
        {
          name: "Stage 1",
          selection: {
            recipeId: null, // different from the live graph's ingot_iron
            machineCount: 99,
            clockPercentText: "500",
            unlockedTiers: { belt: 1, pipe: 1 },
            overrides: { feeds: {}, outputs: {} },
          },
        },
      ],
      links: [],
    };
    await store.getState().importPlan(JSON.stringify(payload));

    // The live graph is UNTOUCHED: same stage order, same live selection.
    expect(store.getState().stageOrder).toEqual(orderBefore);
    expect(store.getState().selection.recipeId).toBe(selBefore.recipeId);
    expect(store.getState().selection.machineCount).toBe(3);
  });

  it("plan-op chain: an import failure sets planError but the NEXT op still runs", async () => {
    const store = await readyStore();
    await store.getState().importPlan("garbage");
    expect(store.getState().planError).not.toBeNull();
    // A subsequent valid save clears the error and lands a row.
    store.getState().selectRecipe("ingot_iron");
    await store.getState().savePlanAs("Recovered");
    expect(store.getState().planError).toBeNull();
    expect(store.getState().plans!.map((p) => p.name)).toEqual(["Recovered"]);
  });
});

// ---------------------------------------------------------------------------
// Plan durability — export-all bundle + bundle import (Stage 19 / #92).
// ---------------------------------------------------------------------------

describe("plan durability: export-all + bundle import (Stage 19 / #92)", () => {
  async function readyStore() {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT);
    return store;
  }

  /** A minimal valid v8 plan file with a chosen name + recipe (content marker). */
  function planFile(name: string, recipeId: string | null): PlanFileV8 {
    return {
      format_version: 8,
      name,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      flowDirection: "LR",
      stages: [
        {
          name: "Stage 1",
          selection: {
            recipeId,
            machineCount: 1,
            clockPercentText: "100",
            unlockedTiers: { belt: 1, pipe: 1 },
            overrides: { feeds: {}, outputs: {} },
          },
          userPlaced: false,
        },
      ],
      links: [],
    };
  }

  /** Wrap per-plan file objects in the bundle envelope (the export shape). */
  function bundle(plans: PlanFileV8[]): PlanBundle {
    return {
      kind: "foundry-plan-bundle",
      format_version: 1,
      exportedAt: "2026-08-06T00:00:00.000Z",
      plans,
    };
  }

  it("round-trip: save 2 → exportAllPlans → wipe → importPlan(bundle) restores both, no auto-load", async () => {
    const store = await readyStore();
    store.getState().selectRecipe("ingot_iron");
    store.getState().setClockPercentText("42");
    await store.getState().savePlanAs("Alpha");
    store.getState().setClockPercentText("75");
    await store.getState().savePlanAs("Beta");

    const json = (await store.getState().exportAllPlans())!;
    expect(json).not.toBeNull();

    // Wipe every stored plan (device-loss simulation) + the live selection.
    const db = await (await import("../data/db.ts")).openDb();
    for (const p of store.getState().plans!) {
      await store.getState().deletePlan(p.id);
    }
    expect(store.getState().plans).toEqual([]);
    const orderBefore = store.getState().stageOrder;
    const selBefore = store.getState().selection.recipeId;

    await store.getState().importPlan(json);

    // Both plans are back with intact names/graphs.
    const names = store
      .getState()
      .plans!.map((p) => p.name)
      .sort();
    expect(names).toEqual(["Alpha", "Beta"]);
    const alpha = store.getState().plans!.find((p) => p.name === "Alpha")!;
    const beta = store.getState().plans!.find((p) => p.name === "Beta")!;
    const storedAlpha = (await db.get<PlanFileV8>("plans", alpha.id))!;
    const storedBeta = (await db.get<PlanFileV8>("plans", beta.id))!;
    expect(storedAlpha.stages[0]!.selection.clockPercentText).toBe("42");
    expect(storedBeta.stages[0]!.selection.clockPercentText).toBe("75");
    // NO auto-load: the live graph is untouched by a bundle import.
    expect(store.getState().stageOrder).toEqual(orderBefore);
    expect(store.getState().selection.recipeId).toBe(selBefore);
  });

  it("exportAllPlans returns null when there are no plans", async () => {
    const store = await readyStore();
    await store.getState().refreshPlans();
    expect(await store.getState().exportAllPlans()).toBeNull();
  });

  it("envelope shape: kind, format_version, exportedAt, plans length", async () => {
    const store = await readyStore();
    store.getState().selectRecipe("ingot_iron");
    await store.getState().savePlanAs("One");
    await store.getState().savePlanAs("Two");

    const before = new Date().toISOString();
    const json = (await store.getState().exportAllPlans())!;
    const env = JSON.parse(json) as PlanBundle;
    expect(env.kind).toBe("foundry-plan-bundle");
    expect(env.format_version).toBe(1);
    expect(typeof env.exportedAt).toBe("string");
    expect(env.exportedAt >= before).toBe(true); // stamped at the export moment
    expect(env.plans).toHaveLength(2);
    // Each entry is a per-plan v8 file object (validatePlanFile-shaped).
    expect(env.plans.every((p) => p.format_version === 8)).toBe(true);
    expect(env.plans.map((p) => p.name).sort()).toEqual(["One", "Two"]);
    // Pretty-printed, matching JSON.stringify(bundle, null, 2).
    expect(json).toContain('\n  "kind": "foundry-plan-bundle"');
  });

  it("collision: a bundle entry matching an existing name overwrites, keeping prior createdAt", async () => {
    const store = await readyStore();
    store.getState().selectRecipe("ingot_iron");
    await store.getState().savePlanAs("Target");
    const targetId = store.getState().plans![0]!.id;
    const db = await (await import("../data/db.ts")).openDb();
    const originalCreatedAt = (await db.get<PlanFileV8>("plans", targetId))!
      .createdAt;

    // A bundle entry named "Target" with a foreign stamp + different content.
    const entry = planFile("Target", null);
    entry.createdAt = "1999-12-31T00:00:00.000Z";
    entry.stages[0]!.selection.machineCount = 7;
    await store.getState().importPlan(JSON.stringify(bundle([entry])));

    // Exactly one "Target" row, same id, prior createdAt preserved, content replaced.
    expect(
      store.getState().plans!.filter((p) => p.name === "Target"),
    ).toHaveLength(1);
    const stored = (await db.get<PlanFileV8>("plans", targetId))!;
    expect(stored.createdAt).toBe(originalCreatedAt); // NOT the foreign 1999 stamp
    expect(stored.stages[0]!.selection.machineCount).toBe(7);
  });

  it("PINNED: two entries with the same trimmed name → ONE row, LAST entry's content, count proves no dup", async () => {
    const store = await readyStore();
    await store.getState().refreshPlans();

    // Two entries share the trimmed name "Dup" (one padded) but carry DIFFERENT
    // content. Last-entry-wins into ONE row: the second entry must see the
    // first's just-committed row and overwrite it (the per-entry-fresh
    // collision read). A single-name row proves no duplicate was created.
    const first = planFile("Dup", null);
    first.stages[0]!.selection.machineCount = 1;
    const second = planFile("  Dup  ", "ingot_iron");
    second.stages[0]!.selection.machineCount = 99;
    await store.getState().importPlan(JSON.stringify(bundle([first, second])));

    // Exactly ONE plan total, exactly one "Dup" — no duplicate row.
    expect(store.getState().plans!).toHaveLength(1);
    expect(
      store.getState().plans!.filter((p) => p.name === "Dup"),
    ).toHaveLength(1);
    // The surviving row carries the LAST entry's content (machineCount 99).
    const dupId = store.getState().plans![0]!.id;
    const db = await (await import("../data/db.ts")).openDb();
    const stored = (await db.get<PlanFileV8>("plans", dupId))!;
    expect(stored.name).toBe("Dup"); // trimmed form
    expect(stored.stages[0]!.selection.machineCount).toBe(99);
    expect(stored.stages[0]!.selection.recipeId).toBe("ingot_iron");
  });

  it("per-entry skip: [valid, corrupt, valid] → 2 imported, planError 'imported 2 of 3'", async () => {
    const store = await readyStore();
    await store.getState().refreshPlans();

    const env = bundle([
      planFile("Good1", "ingot_iron"),
      planFile("Good2", null),
    ]);
    // Splice a corrupt (non-plan) entry BETWEEN the two valid ones.
    (env.plans as unknown[]).splice(1, 0, { hello: "world" });
    await store.getState().importPlan(JSON.stringify(env));

    expect(
      store
        .getState()
        .plans!.map((p) => p.name)
        .sort(),
    ).toEqual(["Good1", "Good2"]);
    expect(store.getState().planError).toBe(
      "imported 2 of 3 plans (1 invalid skipped)",
    );
  });

  it("all-valid bundle sets NO partial-success message (K=0)", async () => {
    const store = await readyStore();
    await store.getState().refreshPlans();
    await store
      .getState()
      .importPlan(
        JSON.stringify(bundle([planFile("A", null), planFile("B", null)])),
      );
    expect(store.getState().plans!).toHaveLength(2);
    expect(store.getState().planError).toBeNull();
  });

  it("zero-valid bundle → error, nothing written", async () => {
    const store = await readyStore();
    await store.getState().refreshPlans();
    const env = bundle([]);
    (env.plans as unknown[]).push({ hello: "world" }, { also: "garbage" });
    await store.getState().importPlan(JSON.stringify(env));
    expect(store.getState().planError).toBe(
      "import failed: no valid plans in bundle",
    );
    expect(store.getState().plans).toEqual([]);
  });

  it("empty bundle (plans: []) → error, nothing written", async () => {
    const store = await readyStore();
    await store.getState().refreshPlans();
    await store.getState().importPlan(JSON.stringify(bundle([])));
    expect(store.getState().planError).toBe(
      "import failed: no valid plans in bundle",
    );
    expect(store.getState().plans).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// applyChainProposal (Stage 8 / Phase 3, ticket #39): the additive bulk apply.
// ---------------------------------------------------------------------------

describe("applyChainProposal (Stage 8 / Phase 3)", () => {
  /** A store on the two-recipe chain catalog (ore→ingot, ingot→plate). */
  async function chainCatalogStore() {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT_CHAIN);
    return store;
  }

  /** proposeChain against the store's catalog (no excluded machines here). */
  function propose(
    store: ReturnType<typeof createAppStore>,
    target: string,
    rate: number,
  ): ChainProposal {
    const s = store.getState();
    if (s.catalog.status !== "ready") throw new Error("catalog not ready");
    return proposeChain(
      target,
      Fraction.from(rate),
      Object.values(s.catalog.catalog.recipes),
      [],
    );
  }

  function routeCatalog(): Catalog {
    const io = (itemId: string, rate: number) => ({
      itemId,
      perMinute: Fraction.from(rate),
    });
    return {
      items: Object.fromEntries(
        ["oil", "fuel", "resin", "rubber", "paint", "pack"].map((id) => [
          id,
          {
            id,
            displayName: id,
            isFluid: false,
            stackSize: Fraction.from(100),
          },
        ]),
      ),
      machines: {
        refinery: {
          id: "refinery",
          displayName: "Refinery",
          power: {
            mw: Fraction.from(30),
            variable: false,
            exponent: Fraction.from(1),
          },
        },
      },
      recipes: {
        r_fuel: {
          id: "r_fuel",
          displayName: "Fuel",
          machineId: "refinery",
          isAlternate: false,
          primaryOutputId: "fuel",
          inputs: [io("oil", 30)],
          outputs: [io("fuel", 20), io("resin", 10)],
        },
        r_rubber: {
          id: "r_rubber",
          displayName: "Rubber",
          machineId: "refinery",
          isAlternate: false,
          primaryOutputId: "rubber",
          inputs: [io("resin", 30)],
          outputs: [io("rubber", 20)],
        },
        r_pack: {
          id: "r_pack",
          displayName: "Pack",
          machineId: "refinery",
          isAlternate: false,
          primaryOutputId: "pack",
          inputs: [io("fuel", 20), io("rubber", 20)],
          outputs: [io("pack", 10)],
        },
        r_paint: {
          id: "r_paint",
          displayName: "Paint",
          machineId: "refinery",
          isAlternate: false,
          primaryOutputId: "paint",
          inputs: [io("resin", 10)],
          outputs: [io("paint", 10)],
        },
      },
      tiers: { belt: [Fraction.from(60)], pipe: [Fraction.from(300)] },
      recipeUnlocks: {},
      extractors: {},
    };
  }

  function routeProposal(): ChainProposal {
    return {
      stages: [
        {
          itemId: "fuel",
          recipeId: "r_fuel",
          machineCount: 1n,
          outputRate: Fraction.from(20),
        },
        {
          itemId: "rubber",
          recipeId: "r_rubber",
          machineCount: 1n,
          outputRate: Fraction.from(20),
        },
        {
          itemId: "pack",
          recipeId: "r_pack",
          machineCount: 1n,
          outputRate: Fraction.from(10),
        },
        {
          itemId: "paint",
          recipeId: "r_paint",
          machineCount: 1n,
          outputRate: Fraction.from(10),
        },
      ],
      links: [
        { fromItemId: "fuel", toItemId: "pack" },
        { fromItemId: "rubber", toItemId: "pack" },
      ],
      rawInputs: [
        { itemId: "oil", rate: Fraction.from(30) },
        { itemId: "resin", rate: Fraction.from(30) },
      ],
      byproducts: [
        { fromItemId: "fuel", itemId: "resin", rate: Fraction.from(10) },
      ],
    };
  }

  function routeStore() {
    const store = createAppStore(makeStorageStub().storage);
    store.setState({ catalog: { status: "ready", catalog: routeCatalog() } });
    return store;
  }

  it("appends fresh stages/links, sizes machines, seeds names + tiers, focuses target", async () => {
    const store = await chainCatalogStore();
    // Start with one edited default stage to prove existing state is untouched.
    store.getState().setUnlockedTiers({ belt: 2, pipe: 1 });
    store.getState().selectRecipe("ingot_iron");
    const existingId = store.getState().activeStageId;
    const existingBefore = store.getState().stages[existingId]!;
    const orderBefore = [...store.getState().stageOrder];
    const seqBefore = store.getState().placementSeq;

    // iron_plate @ 60/min → plate stage (2 machines) + ingot stage (2 machines).
    const proposal = propose(store, "iron_plate", 60);
    store.getState().applyChainProposal(proposal);
    const s = store.getState();

    // Existing stage untouched (same id, same selection object contents).
    expect(s.stages[existingId]).toBeDefined();
    expect(s.stages[existingId]!.selection.recipeId).toBe(
      existingBefore.selection.recipeId,
    );
    expect(s.stageOrder.slice(0, orderBefore.length)).toEqual(orderBefore);

    // Two proposed stages appended (fresh ids, not the existing one).
    const appended = s.stageOrder.slice(orderBefore.length);
    expect(appended).toHaveLength(2);
    expect(appended).not.toContain(existingId);

    // Names come from recipe display names; counts from the proposal.
    const byName = new Map(
      appended.map((id) => [s.stages[id]!.name, s.stages[id]!]),
    );
    expect([...byName.keys()].sort()).toEqual(["Iron Ingot", "Iron Plate"]);
    expect(byName.get("Iron Plate")!.selection.machineCount).toBe(2);
    expect(byName.get("Iron Ingot")!.selection.machineCount).toBe(2);
    // clock "100", empty overrides.
    expect(byName.get("Iron Plate")!.selection.clockPercentText).toBe("100");
    expect(byName.get("Iron Plate")!.selection.overrides).toEqual({
      feeds: {},
      outputs: {},
    });
    // Tiers seeded from the ACTIVE stage (belt:2, not the full default table).
    expect(byName.get("Iron Ingot")!.selection.unlockedTiers).toEqual({
      belt: 2,
      pipe: 1,
    });

    // One new link ingot→plate; monotonic positions never reused.
    expect(s.links).toHaveLength(1);
    expect(s.placementSeq).toBe(seqBefore + 2);

    // The target (iron_plate) stage is active.
    expect(s.stages[s.activeStageId]!.name).toBe("Iron Plate");
  });

  it("under TB, appended stages auto-place in the downward (TB) grid", async () => {
    const store = await chainCatalogStore();
    // Switch to TB first: the seq-0 default stage re-slots to TB index 0.
    store.getState().setFlowDirection("TB");
    const seqBefore = store.getState().placementSeq;
    const proposal = propose(store, "iron_plate", 60);
    store.getState().applyChainProposal(proposal);
    const s = store.getState();
    const appended = s.stageOrder.slice(s.stageOrder.length - 2);
    // Appended at seqs 1 and 2 → TB slots down the first column (not the LR row).
    const slots = appended.map((id) => s.positions[id]);
    expect(slots).toEqual([
      { x: 40, y: 40 + 140 },
      { x: 40, y: 40 + 280 },
    ]);
    expect(s.placementSeq).toBe(seqBefore + 2);
    // Appended stages are auto-placed → NOT userPlaced (a later switch re-grids).
    for (const id of appended) {
      expect(s.userPlaced[id]).toBeUndefined();
    }
  });

  it("all links arrive ok-or-surplus after derive — never short", async () => {
    const store = await chainCatalogStore();
    const proposal = propose(store, "iron_plate", 60);
    store.getState().applyChainProposal(proposal);
    const s = store.getState();
    // The built chain is self-consistent by construction (ceil'd consumption).
    expect(s.reconciliation.some((f) => f.type === "under-supply")).toBe(false);
    // The ingot→plate link is exact (2×30 supply = 2×30 demand): no finding.
    expect(s.reconciliation).toHaveLength(0);
  });

  it("seeds every applied stage's clockPercentText from the passed clock (S20 P2)", async () => {
    const store = await chainCatalogStore();
    const orderBefore = store.getState().stageOrder.length;
    const proposal = propose(store, "iron_plate", 60);
    // Pass the propose-time clock text; every appended stage carries it.
    store.getState().applyChainProposal(proposal, { clockPercentText: "150" });
    const s = store.getState();
    const appended = s.stageOrder.slice(orderBefore);
    expect(appended).toHaveLength(2);
    for (const id of appended) {
      expect(s.stages[id]!.selection.clockPercentText).toBe("150");
    }
  });

  it("defaults clockPercentText to '100' when no clock text is passed (regression)", async () => {
    const store = await chainCatalogStore();
    const orderBefore = store.getState().stageOrder.length;
    const proposal = propose(store, "iron_plate", 60);
    store.getState().applyChainProposal(proposal);
    const s = store.getState();
    for (const id of s.stageOrder.slice(orderBefore)) {
      expect(s.stages[id]!.selection.clockPercentText).toBe("100");
    }
  });

  it("applies selected byproduct routes as StageLinks", () => {
    const store = routeStore();
    const proposal = routeProposal();

    store.getState().applyChainProposal(proposal, {
      catalog: routeCatalog(),
      byproductRoutes: [
        { fromItemId: "fuel", itemId: "resin", toItemId: "rubber" },
      ],
    });

    const s = store.getState();
    const appended = s.stageOrder.slice(1);
    const byName = new Map(appended.map((id) => [s.stages[id]!.name, id]));
    expect(s.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromStageId: byName.get("Fuel"),
          itemId: "resin",
          toStageId: byName.get("Rubber"),
        }),
      ]),
    );
  });

  it("routes without a catalog are refused while primary links still apply", () => {
    const store = routeStore();

    store.getState().applyChainProposal(routeProposal(), {
      byproductRoutes: [
        { fromItemId: "fuel", itemId: "resin", toItemId: "rubber" },
      ],
    });

    const s = store.getState();
    expect(s.stageOrder.slice(1)).toHaveLength(4);
    expect(s.links).toHaveLength(2);
    expect(s.links.some((l) => l.itemId === "resin")).toBe(false);
  });

  it("refuses duplicate, stale, self and repeated-source byproduct routes", () => {
    const cases: Array<{ name: string; routes: ProposedByproductRoute[] }> = [
      {
        name: "duplicate target lane",
        routes: [{ fromItemId: "fuel", itemId: "fuel", toItemId: "pack" }],
      },
      {
        name: "stale source output",
        routes: [{ fromItemId: "pack", itemId: "resin", toItemId: "rubber" }],
      },
      {
        name: "stale consumer input",
        routes: [{ fromItemId: "fuel", itemId: "resin", toItemId: "pack" }],
      },
      {
        name: "unresolved endpoint",
        routes: [
          { fromItemId: "missing", itemId: "resin", toItemId: "rubber" },
        ],
      },
      {
        name: "self route",
        routes: [{ fromItemId: "fuel", itemId: "resin", toItemId: "fuel" }],
      },
      {
        name: "repeated source spend",
        routes: [
          { fromItemId: "fuel", itemId: "resin", toItemId: "rubber" },
          { fromItemId: "fuel", itemId: "resin", toItemId: "paint" },
        ],
      },
    ];

    for (const { name, routes } of cases) {
      const store = routeStore();
      store.getState().applyChainProposal(routeProposal(), {
        catalog: routeCatalog(),
        byproductRoutes: routes,
      });
      const resinLinks = store
        .getState()
        .links.filter((l) => l.itemId === "resin");
      expect(resinLinks, name).toHaveLength(
        name === "repeated source spend" ? 1 : 0,
      );
      expect(store.getState().links, name).toHaveLength(
        name === "repeated source spend" ? 3 : 2,
      );
    }
  });

  it("empty proposal is a no-op", async () => {
    const store = await chainCatalogStore();
    store.getState().selectRecipe("iron_plate");
    const before = store.getState();
    const orderBefore = [...before.stageOrder];
    const seqBefore = before.placementSeq;
    const activeBefore = before.activeStageId;

    const empty: ChainProposal = {
      stages: [],
      links: [],
      rawInputs: [],
      byproducts: [],
    };
    store.getState().applyChainProposal(empty);
    const s = store.getState();
    expect(s.stageOrder).toEqual(orderBefore);
    expect(s.placementSeq).toBe(seqBefore);
    expect(s.activeStageId).toBe(activeBefore);
    expect(s.links).toEqual([]);
  });

  it("a target that is itself raw yields an empty proposal → no-op", async () => {
    const store = await chainCatalogStore();
    const orderBefore = [...store.getState().stageOrder];
    // ore_iron has no producer → the proposal is all-raw (no stages).
    const proposal = propose(store, "ore_iron", 120);
    expect(proposal.stages).toEqual([]);
    store.getState().applyChainProposal(proposal);
    expect(store.getState().stageOrder).toEqual(orderBefore);
  });

  it("throws (never truncates) when a machine count exceeds MAX_SAFE_INTEGER", async () => {
    const store = await chainCatalogStore();
    // A hand-built proposal with a bigint count past the safe-integer boundary.
    const huge: ChainProposal = {
      stages: [
        {
          itemId: "iron_plate",
          recipeId: "iron_plate",
          machineCount: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
          outputRate: Fraction.from(1),
        },
      ],
      links: [],
      rawInputs: [],
      byproducts: [],
    };
    expect(() => store.getState().applyChainProposal(huge)).toThrow(
      /exceeds Number.MAX_SAFE_INTEGER/,
    );
  });
});

// ---------------------------------------------------------------------------
// applyRecipeSwap (Stage 8 / Phase 4, ticket #40): the alt-recipe apply — ONE
// atomic write of recipe + resized count + cleared overrides, on a NAMED stage.
// ---------------------------------------------------------------------------

// A catalog with a STANDARD (ingot_iron, 30/min) and an ALTERNATE
// (alternate_pure_iron_ingot, 65/min from ore+water) producer of iron_ingot, so
// a swap between two real recipes is observable. The alternate ClassName's
// `Alternate_` marks isAlternate at parse.
const DOCS_TEXT_SWAP = JSON.stringify([
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
    Classes: [
      { ClassName: "Build_SmelterMk1_C", mDisplayName: "Smelter" },
      { ClassName: "Build_FoundryMk1_C", mDisplayName: "Foundry" },
    ],
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
      {
        // isAlternate via the `Alternate_` ClassName token. 13 ore + 6 water over
        // 12s → per-machine 65 ingot / 30 water(fluid), a distinct rate.
        ClassName: "Recipe_Alternate_PureIronIngot_C",
        mDisplayName: "Alternate: Pure Iron Ingot",
        mIngredients:
          "((ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_OreIron_C\"',Amount=7),(ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_Water_C\"',Amount=4000))",
        mProduct:
          "((ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_IronIngot_C\"',Amount=13))",
        mManufactoringDuration: "12",
        mProducedIn: "/Game/Path/Build_FoundryMk1_C",
      },
    ],
  },
]);

describe("applyRecipeSwap (Stage 8 / Phase 4)", () => {
  async function swapStore() {
    const store = createAppStore(makeStorageStub().storage);
    await store.getState().uploadDocsText(DOCS_TEXT_SWAP);
    return store;
  }

  it("writes recipeId + machineCount together and re-derives (atomic)", async () => {
    const store = await swapStore();
    const id = store.getState().activeStageId;
    store.getState().selectRecipe("ingot_iron");
    store.getState().setMachineCount(4);
    // Sanity: the standard recipe is solved at 4 machines.
    expect(store.getState().stages[id]!.selection.recipeId).toBe("ingot_iron");
    expect(store.getState().solve.status).toBe("solved");

    store.getState().applyRecipeSwap(id, "alternate_pure_iron_ingot", 2);
    const s = store.getState();
    // BOTH landed in ONE write — recipe and count, no intermediate state.
    expect(s.stages[id]!.selection.recipeId).toBe("alternate_pure_iron_ingot");
    expect(s.stages[id]!.selection.machineCount).toBe(2);
    // Re-derived against the new recipe (solved, mirror followed since active).
    expect(s.stages[id]!.solve.status).toBe("solved");
    expect(s.solve).toBe(s.stages[id]!.solve);
  });

  it("clears lane overrides; preserves clock + tiers (selectRecipe posture)", async () => {
    const store = await swapStore();
    const id = store.getState().activeStageId;
    store.getState().setUnlockedTiers({ belt: 3, pipe: 1 });
    store.getState().selectRecipe("ingot_iron");
    store.getState().setClockPercentText("150");
    store.getState().setMachineCount(4);
    // Seed a lane override addressing the OLD recipe's item.
    store.getState().setOverride("feeds", "ore_iron", 0, "90");
    expect(store.getState().selection.overrides.feeds.ore_iron).toBeDefined();

    store.getState().applyRecipeSwap(id, "alternate_pure_iron_ingot", 3);
    const sel = store.getState().stages[id]!.selection;
    // Overrides cleared (they lane-addressed the OLD recipe).
    expect(sel.overrides).toEqual({ feeds: {}, outputs: {} });
    // Clock + tiers preserved across the swap (rode the spread).
    expect(sel.clockPercentText).toBe("150");
    expect(sel.unlockedTiers).toEqual({ belt: 3, pipe: 1 });
  });

  it("is a no-op for an unknown stage id (never a phantom stage)", async () => {
    const store = await swapStore();
    const id = store.getState().activeStageId;
    store.getState().selectRecipe("ingot_iron");
    const before = store.getState().stages[id]!;
    const keysBefore = Object.keys(store.getState().stages).sort();

    store.getState().applyRecipeSwap("no-such-stage", "ingot_iron", 5);
    const s = store.getState();
    expect(s.stages[id]).toBe(before);
    expect(Object.keys(s.stages).sort()).toEqual(keysBefore);
    expect(s.stages["no-such-stage"]).toBeUndefined();
  });

  it("swapping a NON-active stage does not steal the cursor", async () => {
    const store = await swapStore();
    const a = store.getState().stageOrder[0]!;
    store.getState().selectRecipe("ingot_iron");
    store.getState().setMachineCount(4);
    store.getState().addStage();
    const b = store.getState().stageOrder[1]!;
    store.getState().setActiveStage(b); // b is active
    const beforeActive = store.getState().stages[b]!;

    // Swap the NON-active stage a.
    store.getState().applyRecipeSwap(a, "alternate_pure_iron_ingot", 2);
    const s = store.getState();
    // a took the write.
    expect(s.stages[a]!.selection.recipeId).toBe("alternate_pure_iron_ingot");
    expect(s.stages[a]!.selection.machineCount).toBe(2);
    // b (active) is UNTOUCHED — cursor + mirror never followed the a write.
    expect(s.activeStageId).toBe(b);
    expect(s.stages[b]!.selection).toBe(beforeActive.selection);
    expect(s.selection).toBe(s.stages[b]!.selection);
  });
});
