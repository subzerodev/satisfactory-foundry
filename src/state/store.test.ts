import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { Fraction } from "../core/fraction.ts";
import { resetDbCache } from "../data/db.ts";
import { saveCatalog } from "../data/catalog-store.ts";
import { CATALOG_PARSER_VERSION } from "../data/catalog-store.ts";
import { parseCatalogFromText } from "../data/catalog.ts";
import { createAppStore } from "./store.ts";
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

beforeEach(async () => {
  await freshIdb();
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

  it("each setter triggers exactly one recompute with the updated result", async () => {
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

    // clock text change re-solves: 200% doubles demand to 60 → single 60 belt.
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
