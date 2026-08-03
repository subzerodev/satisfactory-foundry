import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { openDb, resetDbCache } from "./db.ts";

beforeEach(async () => {
  resetDbCache();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new (
    await import("fake-indexeddb")
  ).IDBFactory();
});

/** Open the database at v1 (single `catalog` store), seed a row, and close —
 *  simulating a user who last ran the pre-#11 build. */
function seedV1Database(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("satis_foundry", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("catalog");
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("catalog", "readwrite");
      tx.objectStore("catalog").put({ marker: "v1-catalog" }, "current");
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

describe("db — v1 → v2 additive upgrade", () => {
  it("preserves the existing catalog row and adds the plans store", async () => {
    await seedV1Database();
    resetDbCache();

    const db = await openDb();
    // Catalog row survives the version bump (additive upgrade).
    const cat = await db.get<{ marker: string }>("catalog", "current");
    expect(cat).toEqual({ marker: "v1-catalog" });
    // The new plans store is usable (put/get round-trips).
    await db.put("plans", { hello: "world" }, "k");
    expect(await db.get("plans", "k")).toEqual({ hello: "world" });
  });
});

describe("db — new verbs", () => {
  it("getAllWithKeys returns { key, value } pairs; delete removes a row", async () => {
    const db = await openDb();
    await db.put("plans", { n: 1 }, "a");
    await db.put("plans", { n: 2 }, "b");
    const all = await db.getAllWithKeys<{ n: number }>("plans");
    expect(all).toEqual(
      expect.arrayContaining([
        { key: "a", value: { n: 1 } },
        { key: "b", value: { n: 2 } },
      ]),
    );
    await db.delete("plans", "a");
    const after = await db.getAllWithKeys<{ n: number }>("plans");
    expect(after.map((r) => r.key)).toEqual(["b"]);
  });
});

describe("db — multi-tab open safety", () => {
  it("onblocked → the open promise REJECTS (routes to the unavailable degrade, never a hang)", async () => {
    resetDbCache();
    // A stub IDB whose open() fires onblocked (an old-version connection is
    // holding the upgrade). openDb must reject — not hang — so loadCatalog's
    // access-failure catch lands boot in the #9 unavailable degrade.
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
    await expect(openDb()).rejects.toThrow(/blocked/i);
  });
});
