# Review request — #144 design (r3): catalog staleness self-heal

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/catalog-staleness/brainstorm-spec.md` (uncommitted, revision r3)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `a40687e`)
**Stage:** design re-review after fold. r2 verdicts: code-reviewer APPROVED_WITH_NITS (2 citation nits, folded), adversarial-reviewer NEEDS_REWORK (1 IMPORTANT: refresh ordering unspecified + 3 NITs, all folded).

## The r2 → r3 delta to verify (scope to this)

1. **New D1b — set-first ordering.** Ready fires on the cached catalog exactly as today; provenance check + refresh run after `deriveAllStages` (`store.ts:1403`) within the fire-and-forget `init()`; a mismatch applies like the `uploadDocsText` live-replace precedent (`store.ts:1406-1450`: second set + re-derive + save); the one-boot content swap is stated. Verify: (a) the uploadDocsText citation really is a replace-while-ready precedent with a re-derive (`store.ts:1450`); (b) D1b's claim that acceptance criterion 3 holds "by construction" under set-first; (c) internal consistency — D1's failure-fallback ("set(ready) on the CACHED catalog") under set-first ordering becomes "leave the already-set state alone"; does the spec's wording survive that reading or does it now describe a redundant second set? Flag if D1 and D1b contradict.
2. **New ordering-pin test** (never-resolving provenance stub must not block ready) — is it implementable in the existing harness (fake timers? dangling promise safety in vitest)?
3. **Helper parameter list** now names the `unavailable` flag threading. Consistent with the extraction range `1340-1388`?
4. Citation fixes: `src/ui/App.tsx` prefixes, `saveCatalog` call at `store.ts:1375`, extraction endpoint `:1388`, vite.config `:16`/`:35-40`. Spot-check each.

Earlier-round-survived theses are settled — do not re-litigate without new evidence.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
