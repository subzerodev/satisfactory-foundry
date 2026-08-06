/**
 * Stage 19 (ticket #92): request persistent storage so the browser never
 * auto-evicts this origin's IndexedDB (the plans store). One of the two plan-
 * durability moves (the other is the export-all bundle) — this is the
 * eviction-defense half.
 *
 * A browser-environment request, not data logic (frozen Axis 1): it lives in
 * the UI layer and is called fire-and-forget from App's boot effect, never from
 * db.ts or the store (both stay chrome-API-free, and db.ts runs under fake-
 * indexeddb where `navigator.storage` may be absent).
 *
 * The `typeof navigator` guard makes this safe to call from ANY env, including
 * node — it's defense in depth, not the test-immunity mechanism (the node-env
 * suites never mount App, so they never call this). Feature-detects
 * `navigator.storage.persist` (absent on old/insecure-context browsers),
 * console.info's the granted/denied outcome, and swallows any rejection — it
 * NEVER throws. No UI reflects the result: a denial changes nothing the user
 * can act on (the rejected reminder-nudge binds).
 */
export async function requestPersistence(): Promise<boolean> {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.storage?.persist !== "function"
  ) {
    console.info("[persistence] navigator.storage.persist unsupported");
    return false;
  }
  try {
    const granted = await navigator.storage.persist();
    console.info(`[persistence] persistent storage granted: ${granted}`);
    return granted;
  } catch (err) {
    console.info("[persistence] persist() rejected", err);
    return false;
  }
}
