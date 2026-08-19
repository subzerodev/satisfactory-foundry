# Review request — #144 design (r1): catalog staleness self-heal

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/catalog-staleness/brainstorm-spec.md` (uncommitted)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `a40687e`)
**Stage:** design (Tier 2). No diff yet.

## A. Current-state anchors — verify against live source

- `src/data/catalog-store.ts:190-216` (`loadCatalog`: parser-version staleness, source backfill `{kind:"user"}`), `:133-146` (`CatalogSource`, `StoredCatalog`), `:148-156` (`CacheLoadResult` + the unavailable carve-out comment).
- `src/state/store.ts:1316-1360+` (`init()`: unconditional hit, the non-hit bundled fallback, the unavailable no-save carve-out), `:1167-1192` (`Provenance`, `bundledDocsProvider` seam, `setBundledDocsProvider`).
- `src/ui/App.tsx:40-60` (the existing two-file fetch whose provenance shape D2 mirrors).
- `vite.config.ts` workbox `globPatterns` includes `json` (the offline-precache assumption).
- Settled context: ticket #144; gap-report W4 @ ae266b1; #140 decision 24744.

## B. Claims/design to verify

1. **D1 routing.** Is "fall through to the EXISTING non-hit path" actually implementable as described against the real `init()` control flow (`store.ts:1316+`), including the D1 fallback (refresh fails → use the cached hit, NOT the current non-hit degradation)? That fallback inverts the current code's structure (the non-hit path has no cached catalog in hand) — is the spec's description of the needed restructure honest, or does it understate the change?
2. **The never-evict constraint.** Walk every path: can any sequence (user row, legacy backfilled row, unavailable row, provenance mismatch, provider failure) lead to a user catalog being overwritten or a usable cache being replaced by nothing? Pay attention to the legacy-row backfill (`source ?? {kind:"user"}`) — the spec claims those correctly never auto-refresh.
3. **D2's new provider seam** — consistent with the existing seam pattern (`store.ts:1181-1192`)? Is a SECOND seam justified versus extending the provider's return, given the 5.3 MB avoidance argument?
4. **Offline PWA claim** (D4.2): precached provenance matches precached docs by construction — verify the precache assumption against `vite.config.ts` and note any hole (e.g. a service-worker update serving new provenance while the old docs are still precached — is that possible under Workbox precache atomicity? If uncertain, say unverified rather than asserting).
5. **Tests plan** — is the harness-defaults approach (equal-build provenance stub) sufficient to keep existing init tests green, per the deletion-sweep rule? Check how existing store tests boot (grep for `setBundledDocsProvider` in tests).
6. Any re-litigation of settled decisions.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
