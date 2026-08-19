# Review request — #144 diff (r1): catalog staleness self-heal

**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry`, branch `feature/catalog-staleness` @ `3ca78ec` (fix `b15e474`, focused test `01e29a0`; parent `develop` @ `dfaeae3`).
**Diff:** `features/catalog-staleness/diff-r1.diff` (the `src/` diff of `git diff develop...HEAD`).
**Frozen spec:** `features/catalog-staleness/brainstorm-spec.md` (r5 — five correctness rounds, simplify dispositioned). The diff must implement the frozen spec exactly; deviation is a finding even if defensible.

## What to verify

1. **Spec conformance, element by element:** the provenance seam + `setBundledProvenanceProvider`; `pendingBundledRefresh()` retained promise; `catalogSaveQueue` + `enqueueCatalogSave` (per-link totality, caller gets the real outcome); `resetBundledRefreshSeams()`; the `loadBundled` extraction (apply + unavailable parameterization) with the non-hit caller byte-identical in behaviour; set-first ordering (init resolves after `deriveAllStages`, refresh detached, errors swallowed); the apply-time guard; the upload-shaped apply (one set carrying catalog + full re-derive with the #5 recipeId/overrides treatment); `uploadDocsText`'s save routed through the queue; App.tsx provenance wiring.
2. **Behavioural equivalence of the extraction for the non-hit path:** compare the helper's flow against the pre-diff inline block (git show `dfaeae3:src/state/store.ts` if needed) — same set, same unavailable no-save + note, same save-failure note, same needs-upload tail in the caller.
3. **The 8 integration pins + the focused save-race file** (`store.save-race.test.ts`): real pins, not tautologies. Verify `features/catalog-staleness/r2-verification.log`: Mutation A killed by the differing-build pin; Mutation B killed by the upload-race + save-serialization pins; **section 3 records the integration race pin as a NO-OP against Mutation C (honestly), and section 3b shows the focused delayed-save test killing Mutation C 3/3.** Also note the log's own header records that an earlier attempt destroyed uncommitted work via git checkout and was redone post-commit — verify the final log's runs are coherent (green → fail → restored → green).
4. **The vi.mock in the focused test** — does it mock ONLY saveCatalog (spreading the real module), and is the 25ms delay + 5ms yield timing sound rather than flaky? (60ms observed test duration.)
5. **Suite health:** 1154 tests green at commit, `npm run check` clean. Re-run if in doubt.
6. **No behavioural change outside the spec:** grep the diff for anything touching paths the spec declares untouched (`loadCatalog`, `CacheLoadResult`, the unavailable carve-out semantics, `saveCatalog` itself, banner logic).

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
