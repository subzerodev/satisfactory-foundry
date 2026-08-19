# Review request — #144 design (r4): catalog staleness self-heal

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/catalog-staleness/brainstorm-spec.md` (uncommitted, revision r4)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `a40687e`)
**Stage:** design re-review after fold. r3 verdicts: code-reviewer NEEDS_REWORK (2 IMPORTANT + 2 NITs), adversarial-reviewer NEEDS_REWORK (2 IMPORTANT + 1 NIT — one IMPORTANT shared). All five distinct findings folded; dispositions in `## Revision history`.

## The r3 → r4 delta to verify (scope to this)

1. **Never-evict guard** (D1b): apply-time re-check `get().catalogSource?.kind === "bundled"` in the same microtask as the set; silent discard otherwise; new upload-race test (gated docs stub, upload lands mid-window, user catalog survives memory + IDB). Is the guard sufficient — is there any interleaving it misses given zustand's synchronous set semantics and single-threaded JS? (The check-and-set share one microtask; uploadDocsText's own set/save are awaited in its action.) One residual to judge: uploadDocsText SAVES asynchronously (`store.ts:1468`) — can the refresh's saveCatalog still land AFTER the check passed but interleave with an upload's save? Trace: for the refresh to save, the check must pass, meaning no upload had SET yet; can an upload then set+save between the refresh's check and its save completing? If yes, is memory-vs-IDB divergence possible, and does the spec need the guard re-checked or the save serialized?
2. **Promise boundary**: init() resolves after deriveAllStages; refresh is a detached, error-swallowing continuation; harness beforeEach reset requirement; `pendingBundledRefresh()` retained-promise seam for deterministic test awaiting. Implementable in the existing harness?
3. **Success-apply parameterization**: hit caller's apply = uploadDocsText-shaped one-set catalog+deriveAllStages, then save; non-hit caller's apply unchanged (bare set, init's :1403 derive follows). Does this keep the non-hit path byte-identical and give the hit path a correctly derived state?
4. **D1 failure-fallback rewording** ("leave the already-set ready state untouched") — consistent with D1b now?
5. Path-prefix citation fixes (src/data/catalog-store.ts).

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
