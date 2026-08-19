# Review request — #133 P4 implementation, phase-boundary cumulative diff (r1)

**Artifact:** the cumulative diff `develop...feature/phase-p4`, saved at
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/phase-p4/features/raw-packaging/p4-phase-diff.diff`
(10 files, +1411/−121; five commits c4d5cbe..a3854cb).
**Worktree (live source):** `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/phase-p4` (branch `feature/phase-p4`)
**Spec (frozen, the contract):** `features/raw-packaging/brainstorm-spec.md` (r5 @ ceed250, five review rounds + zero-finding simplify; review the diff AGAINST it).
**State:** `npm test` 1218 passed, `npm run check` clean, `npm run build` green (team-lead re-verified test+check).

## A. Current-state anchors

Read in the worktree: `src/core/link-plan.ts` (the split), `src/data/plan-store.ts` (the v9 ladder + both rebuilding migrations), `src/state/store.ts` (the canonicalized extraction write, deep-copy arm, v9 save literals), `src/ui/extraction-plan.ts`, `src/ui/GraphCanvas.tsx` (the panel + gate + setMachine arm), the touched tests, `features/raw-packaging/r2-verification.log`.

## B. What to verify

1. **Spec conformance, item by item** against the r5 spec's §Persistence, §Design, §State, §UI, §Changes, and all 11 §Tests items. Non-negotiables from the spec's history: `migrateV8` REBUILDS (never passthrough) and strips/rejects garbage packaging; `migrateV7` rebuilds stages too; the extraction write routes through `canonicalizePackagingInterstep` with the null-drop; the panel's initial returnTransport is belt; the placement is inside the planned block AFTER the water-fragment close (water must see it); the gate is `selection !== null && (pairs.length > 0 || selection.packaging !== undefined)`; `deriveLinkPlan` keeps its signature + the early-return string; the two v9-rejection tests moved to 10; a fresh save is v9.
2. **The reported deviation:** `copyExtractionSelection`'s deep-copy spreads one level deeper (`returnTransport`) than the one-level `purityMix` idiom, justified by the spec's "nested returnTransport is not aliased across copies" sentence. Sound, or over/under-copying?
3. **The verification log:** 7 compiling mutations across 5 behaviours, genuine FAILs naming new tests, restore-green; the report admits one first-attempt unapplied mutant caught by content-grep — confirm the corrected run is the one recorded and is genuine.
4. **No scope creep, no weakened tests, the ~17-pin content sweep complete** (grep format_version yourself over both test files — any 8-target pin left that should now be 9, any missed new pin).

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
