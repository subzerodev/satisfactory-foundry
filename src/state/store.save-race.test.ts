/**
 * #144 focused pin: the catalogSaveQueue's serialization under the ONE
 * interleaving the integration suite cannot force — the refresh's save
 * suspended IN FLIGHT while a user upload sets and saves.
 *
 * Lives in its own file because it vi.mocks catalog-store to delay
 * bundled-source saves (vi.mock is file-hoisted; the main store suite must
 * keep the real module). Without the queue (the r4 BLOCKER), the delayed
 * bundled db.put lands LAST and the IDB row resurrects the bundled catalog
 * over the user's upload across a reboot; with the queue, the upload's
 * write is enqueued after the refresh's and wins on every interleaving.
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDbCache } from "../data/db.ts";
import { parseCatalogFromText } from "../data/catalog.ts";
import {
  createAppStore,
  setBundledDocsProvider,
  setBundledProvenanceProvider,
  pendingBundledRefresh,
  resetBundledRefreshSeams,
} from "./store.ts";
import type { StateStorage } from "zustand/middleware";

// Delay only BUNDLED-source saves, so the refresh's write is guaranteed to be
// the slow one while the upload's user-source write stays fast — the exact
// shape of the r4 BLOCKER race.
vi.mock("../data/catalog-store.ts", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../data/catalog-store.ts")>();
  return {
    ...real,
    saveCatalog: async (
      text: string,
      catalog: Parameters<typeof real.saveCatalog>[1],
      source?: Parameters<typeof real.saveCatalog>[2],
    ) => {
      if (source?.kind === "bundled") {
        await new Promise((r) => setTimeout(r, 25));
      }
      return real.saveCatalog(text, catalog, source);
    },
  };
});

import { saveCatalog } from "../data/catalog-store.ts";

const BUNDLED_PROVENANCE = {
  steamBuild: "23855724",
  extractedAt: "2026-04-30",
};
const NEW_PROVENANCE = { steamBuild: "99999999", extractedAt: "2026-08-18" };

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

function makeStorageStub(): StateStorage {
  const backing: Record<string, string> = {};
  return {
    getItem: (name) => (name in backing ? backing[name]! : null),
    setItem: (name, value) => {
      backing[name] = value;
    },
    removeItem: (name) => {
      delete backing[name];
    },
  };
}

async function freshIdb(): Promise<void> {
  resetDbCache();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new (
    await import("fake-indexeddb")
  ).IDBFactory();
}

beforeEach(async () => {
  await freshIdb();
  setBundledDocsProvider(async () => null);
  resetBundledRefreshSeams();
});

describe("catalogSaveQueue serialization under a delayed bundled save (#144)", () => {
  it("an upload landing while the refresh's save is IN FLIGHT still wins the row", async () => {
    // Seed a bundled row at the old build (through the mocked module's real
    // passthrough — kind "bundled" takes the 25ms delay, which is fine here).
    await saveCatalog(DOCS_TEXT, parseCatalogFromText(DOCS_TEXT), {
      kind: "bundled",
      ...BUNDLED_PROVENANCE,
    });
    setBundledProvenanceProvider(async () => ({ ...NEW_PROVENANCE }));
    setBundledDocsProvider(async () => ({
      text: DOCS_TEXT,
      provenance: { ...NEW_PROVENANCE },
    }));

    const store = createAppStore(makeStorageStub());
    await store.getState().init();

    // Let the detached refresh run up to its APPLY (guard passes, sets
    // bundled) and into its DELAYED save. Two macrotask yields put us past
    // the provenance fetch + docs fetch + parse + set, inside the 25ms save.
    await new Promise((r) => setTimeout(r, 5));
    expect(store.getState().catalogSource).toEqual({
      kind: "bundled",
      ...NEW_PROVENANCE,
    });

    // The refresh's bundled save is now suspended. Land the user upload —
    // its (fast) save must still win the row, which only the queue ensures.
    await store.getState().uploadDocsText(DOCS_TEXT);
    await pendingBundledRefresh();

    expect(store.getState().catalogSource).toEqual({ kind: "user" });
    const { openDb } = await import("../data/db.ts");
    const db = await openDb();
    const row = await db.get<{ source?: unknown }>("catalog", "current");
    expect(row?.source).toEqual({ kind: "user" });
  });
});
