/**
 * Raw IndexedDB promise wrapper (ported shape from the planner's db.ts).
 * Database `satis_foundry` — deliberately NOT the planner's `satis_planner`, so
 * the two apps never collide on the same origin. Two object stores, both
 * out-of-line keyed: `catalog` (the caller supplies `'current'`) and `plans`
 * (the caller supplies a plan id).
 */

const DB_NAME = "satis_foundry";
// v1 → v2 (ticket #11): additive upgrade adding the `plans` store; the catalog
// store is untouched, so existing users' cached catalog survives the bump.
const DB_VERSION = 2;
const CATALOG_STORE = "catalog";
const PLANS_STORE = "plans";

export interface SatisDb {
  get<T>(store: string, key: string): Promise<T | undefined>;
  put(store: string, value: unknown, key: string): Promise<void>;
  /** Read every row of an out-of-line-keyed store as `{ key, value }` pairs. */
  getAllWithKeys<T>(store: string): Promise<{ key: string; value: T }[]>;
  delete(store: string, key: string): Promise<void>;
}

let _dbPromise: Promise<SatisDb> | null = null;
let _rawDb: IDBDatabase | null = null;

export function openDb(): Promise<SatisDb> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Additive: only create what's missing. A v1 database already has
      // `catalog` and gains only `plans`; a fresh database gets both.
      if (!db.objectStoreNames.contains(CATALOG_STORE)) {
        db.createObjectStore(CATALOG_STORE);
      }
      if (!db.objectStoreNames.contains(PLANS_STORE)) {
        db.createObjectStore(PLANS_STORE);
      }
    };
    // A concurrent old-version connection (an old tab holding v1 open) blocks
    // the upgrade. Without this handler the open promise would never settle —
    // a boot hang. Rejecting instead flows through loadCatalog's access-failure
    // catch into the #9 `unavailable` degrade: a rendered, data-preserving
    // state, never a hang. The distinct message is diagnostic-only — nothing
    // branches on it (loadCatalog collapses all open-rejections identically).
    req.onblocked = () =>
      reject(new Error("IndexedDB upgrade blocked by another open connection"));
    req.onsuccess = () => {
      _rawDb = req.result;
      // Standard multi-tab idiom: if a NEWER build in another tab wants to
      // upgrade, yield — close this connection and clear the cache so the next
      // openDb() re-opens against the new version rather than blocking it.
      req.result.onversionchange = () => {
        req.result.close();
        _rawDb = null;
        _dbPromise = null;
      };
      resolve(wrap(req.result));
    };
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
  return _dbPromise;
}

/** Close any open connection and clear the cached promise (test helper). */
export function resetDbCache(): void {
  if (_rawDb) {
    try {
      _rawDb.close();
    } catch {
      /* ignore */
    }
    _rawDb = null;
  }
  _dbPromise = null;
}

function wrap(idb: IDBDatabase): SatisDb {
  return {
    get<T>(store: string, key: string): Promise<T | undefined> {
      return new Promise((resolve, reject) => {
        const tx = idb.transaction(store, "readonly");
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
      });
    },
    put(store: string, value: unknown, key: string): Promise<void> {
      return new Promise((resolve, reject) => {
        const tx = idb.transaction(store, "readwrite");
        const req = tx.objectStore(store).put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },
    getAllWithKeys<T>(store: string): Promise<{ key: string; value: T }[]> {
      return new Promise((resolve, reject) => {
        const tx = idb.transaction(store, "readonly");
        const os = tx.objectStore(store);
        // getAll + getAllKeys index-align (both return in key order), so we can
        // zip them into { key, value } pairs without a cursor.
        const valuesReq = os.getAll();
        const keysReq = os.getAllKeys();
        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => {
          const values = valuesReq.result as T[];
          const keys = keysReq.result;
          resolve(values.map((value, i) => ({ key: String(keys[i]), value })));
        };
      });
    },
    delete(store: string, key: string): Promise<void> {
      return new Promise((resolve, reject) => {
        const tx = idb.transaction(store, "readwrite");
        const req = tx.objectStore(store).delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },
  };
}
