# Review request — #151 P1 design (r1)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/game-mechanics-rework/p1-brainstorm-spec.md` (uncommitted, v1)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `67d1fcd`)
**Stage:** first design review of the P1 (solver overflow-chain) merged brainstorm+spec.

## A. Current-state anchors (verify against live source)

- `src/core/manifold.ts` — the whole file, especially `drainSpan` (:285-301), entry boundaries (:376-395), the segment walk (:400-472), `solveOutputLane` (:479+), the `BusSegment`/`Finding` types.
- `src/data/stage-input.ts` — the post-P0 `sliceTier`/`toStageInput` shape.
- The x2 consumer sites: `src/ui/Schematic.tsx:81,165-183`, `src/ui/format.ts:135-145`, `src/ui/SummaryCards.tsx:32-59`, `src/ui/layout.ts:84,238,267`, `src/layout/layout.ts:207`.
- The locked decisions the spec binds to: #140 comments 24742 (overflow default), 24769 (ribbon+endpoints — P2), 24770 (Level-1 fluid), 24796 (buffer one line; also lockout/depot), 24797 (≤3 cascades + Q13/Q14), 24798 (index). The gap report §1.2 @ ae266b1 for the chain model.
- `features/game-mechanics-audit/gap-report.md` §1.2 (the S − i·d model, mInventorySize 9, the four descriptor classes).

## B. Claims to verify (the design's load-bearing spine)

1. **The arithmetic identity**: the spec claims the existing head-first drain already computes the overflow-chain quantities (entry boundaries unchanged; `entryFlow` = old `available`; `handoffResidue` = old `survived`), and that the 8411 worked check (entries at floor(6.5j), residues alternating 60/0, eight positive residues, final belt 240→Mk3 270) is correct. Re-derive it.
2. **The seam model**: residue < d always on auto-sized chains (so a 2-input seam merger suffices and no line sums two belts). Is the bound real in the code (drainSpan) and does an OVERRIDDEN lane break it (oversize override → survived can be ≥ d — does the spec's seam/hardware story stay coherent for overridden lanes, or does it need an explicit carve-out)?
3. **Cascade formulas**: junctions = ceil((ways−1)/2), tiers = ceil(log3(ways)) — check against the pinned 9→{4,2} and the spec's other pinned values (17→{8,3}, 27→{13,3}, 3→{1,1}, 4→{2,2}). Any off-by-one at exact powers of 3?
4. **The pipe Level-1 surface**: dropping segments entirely for pipe lanes — find every consumer of pipe-lane `segments` in src/ui + src/layout that would change behaviour (grep, don't assume); does anything render pipe segments today whose silent disappearance is a user-visible REGRESSION rather than the decided honesty change?
5. **Type-change blast radius**: the spec names five compile sites. Is the list complete (grep `parallelCount` and `peakFlow` across src/)? `peakFlow` is also in the `segment-over-capacity` finding (renamed `flow`) — enumerate that finding's consumers too.
6. **Deletion sweep completeness**: verify the named test pins exist as cited (manifold.test.ts 11 sites incl. the two #120 describes; layout.test.ts 3; parallel-feed-belts.test.tsx incl. :135/:337; no format bundle pin elsewhere) and hunt for pins the spec missed (the memory-rule class: derived values, DOM copy pins for "bus up to 2 parallel", "Mk6: 1 line").
7. **Decision conformance**: nothing in the spec re-opens a locked decision (topology override NOT designed; nothing rendered; buffer merger-term correctly excluded per c24796's splitter-only arithmetic; Level-1 boundary respected — no equal-split junction modelling).

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
