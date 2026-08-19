# Review request — #144 design (r5): catalog staleness self-heal — code-reviewer re-verdict

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/catalog-staleness/brainstorm-spec.md` (uncommitted, revision r5)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `a40687e`)
**Stage:** design re-review after fold. Your prior fresh context returned NEEDS_REWORK at r4 with one BLOCKER (the save-vs-save race: the apply-time guard protects the set, not the async save tail — a late refresh `db.put` could evict an upload from IDB across a reboot). The adversarial reviewer has ALREADY re-reviewed the on-disk r5 content and returned APPROVED_WITH_NITS (both nits folded), independently confirming the race real and the fold sound. Only your re-verdict is outstanding.

## The r4 → r5 delta to verify (scope to this)

1. **The save queue** (D1b, "The guard alone is NOT sufficient" block): one module-level `catalogSaveQueue` promise chain through which the refresh's save, `uploadDocsText`'s save (`src/state/store.ts:1468`), and the non-hit init save are all routed. Claimed properties to verify against source: (a) in both callers the `set` and the enqueue are adjacent with NO await between (`src/state/store.ts:1444-1468` for upload; the refresh's guard→set→enqueue is specified synchronous), so enqueue order = set order; (b) chain links running to completion means last-enqueued wins the row; (c) per-link catch prevents queue poisoning (the `planOpChain` totality precedent, `src/state/store.ts:1217`). Is the BLOCKER closed on every interleaving you can construct?
2. **The save-serialization test pin** (Tests): refresh applies, upload lands while the refresh's save is in flight, after both settle the IDB row is `kind:"user"`. Deterministic under the `pendingBundledRefresh()` handle?
3. **Nit folds:** `pendingBundledRefresh` reset added to the harness beforeEach note; 13 bare `store.ts:` citations prefixed `src/state/`; source-built citation corrected to `:1351-1355`. Spot-check a few.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
