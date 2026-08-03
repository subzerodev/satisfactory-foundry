/**
 * Raw IndexedDB promise wrapper (ported shape from the planner's db.ts).
 * Database `satis_foundry` — deliberately NOT the planner's `satis_planner`, so
 * the two apps never collide on the same origin. One object store, `catalog`,
 * out-of-line keyed (the caller supplies `'current'`).
 */

const DB_NAME = "satis_foundry";
const DB_VERSION = 1;
const CATALOG_STORE = "catalog";

export interface SatisDb {
  get<T>(store: string, key: string): Promise<T | undefined>;
  put(store: string, value: unknown, key: string): Promise<void>;
}

let _dbPromise: Promise<SatisDb> | null = null;
let _rawDb: IDBDatabase | null = null;

export function openDb(): Promise<SatisDb> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CATALOG_STORE)) {
        db.createObjectStore(CATALOG_STORE);
      }
    };
    req.onsuccess = () => {
      _rawDb = req.result;
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
  };
}
