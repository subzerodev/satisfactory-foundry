# Review request — #151 P1 implementation, phase-boundary cumulative diff (r1)

**Artifact:** the cumulative diff `develop...feature/phase-p1`, saved at
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/phase-p1/features/game-mechanics-rework/p1-phase-diff.diff`
(24 files, +750/−834 — a net-negative diff; five commits be199ba..cb0a312).
**Worktree (live source):** `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/phase-p1` (branch `feature/phase-p1`)
**Spec (frozen, the contract):** `features/game-mechanics-rework/p1-brainstorm-spec.md` in the worktree (frozen at r3 + zero-finding simplify; do not re-litigate the design — review the diff AGAINST it).
**State:** `npm test` 1178 passed, `npm run check` clean (independently re-run by the team lead).

## A. Current-state anchors

Read in the worktree: `src/core/manifold.ts` (the reworked core), `src/core/manifold.test.ts`, the D5 sites (`Schematic.tsx`, `format.ts`, `SummaryCards.tsx`, `FindingsPanel.tsx`, `src/ui/layout.ts`, `src/layout/layout.ts`, `Blueprint.tsx`, `App.tsx`), the seven swept test files (incl. the new `single-lane-feed-belts.test.tsx` replacing `parallel-feed-belts.test.tsx`), `features/game-mechanics-rework/p1-verification.log`.

## B. What to verify

1. **Spec conformance item by item** (D1 type surgery + unchanged drain arithmetic; D2 hardware/cascade incl. the partial-machine splitter rule; D3 buffer flat on the lane result; D4 pipe surfaces; D5 complete silencing; D6 vocab). The Tests-section pins: N=13 endpoints, full 8411 (17 belts, residues alternating 60/0, seamMergers 8, splitters 106, buffer 954, headCascade {17,8,3}), all cascade pins, override-broken chain, over-B override → `flow`, pipe feed/output, output entryFlow = load.
2. **The implementer's ONE reported deviation — scrutinize it hard:** the full-8411 terminal stretch computes `handoffResidue = 30` (Mk3 270 capacity − 240 tail demand), not the spec prose's "hand-off 0". The implementer pinned 30, citing D1's "oversize final override leaves a positive residue — honest surplus" and that the terminal residue feeds no seam. Questions: (a) is 30 the arithmetically correct output of the frozen design (capacity-based carry, the established drain convention), or should the terminal hand-off be demand-based (the belt only carries what the source produces — final 0, matching decision c24769's "entry rate, hand-off residue, final 0" endpoint description that P2 will draw)? (b) Does pinning 30 bake a solver value into P1 that CONTRADICTS the locked rendering decision c24769, or is the prose "final 0" describing the post-last-machine trunk state (after all demand is drawn, nothing rides onward — i.e. the ribbon's terminal taper), which is a different quantity from the belt's unused capacity? Read the audit's §1.2 chain model and c24769's exact wording; decide whether this is (i) correct-as-implemented, (ii) a naming/documentation gap, or (iii) a real semantic error that P2 would render as a false "30/min leaves the lane" claim.
3. **The verification log:** exists, six behaviours, compiling mutants, genuine FAILs naming new tests, restore-green. NEEDS_REWORK if any FAIL is not genuine.
4. **No scope creep, no weakened tests, sweep gate clean** (the RETIRED-blacklist smoke is the intended replacement).

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
