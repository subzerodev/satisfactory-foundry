# Design review r1 archive - parallel feed belts (#120)

Worktree: `/home/subzerodev/workspace/satisfactory-foundry`

Artifact under review:
`features/parallel-feed-belts/brainstorm-spec.md`

Archived: this prompt reviewed v1. The artifact is now v2 and must be reviewed
through `design-r2-prompt.md`; do not use this prompt for the current design.

## User report and settled decision

Michael supplied the live Wet Concrete case: 106 Refineries consume Limestone
at 120/min each; Mk5 capacity is 780/min. The current solver produces 17 feed
belts and eight 840>780 span findings, each suggesting Mk6. His settled ruling
is that the factory is buildable with more parallel Mk5 belts; Mk6 is optional.
Do not re-litigate that product decision.

The exact current reproduction is:

- total demand 12,720/min;
- 17 belts with entries `0,6,13,19,26,32,39,45,52,58,65,71,78,84,91,97,104`;
- eight over-capacity spans: `7-13`, `20-26`, `33-39`, `46-52`, `59-65`,
  `72-78`, `85-91`, `98-104`, each at 840/min over 780/min.

## Current-state anchors to verify

- `src/core/manifold.ts`: `combineFeedBelts`, `solveFeedLane`,
  `solveOutputLane`, `FeedBelt`, `BusSegment`.
- `src/core/manifold.test.ts`: feed combination/fractional/override rows and
  the output whole-machine walk precedent.
- `src/ui/layout.ts`, `src/ui/Schematic.tsx`, `src/ui/LaneOverrides.tsx`,
  `src/ui/SummaryCards.tsx`: consumers of feed slots and segment boundaries.
- `features/manifold-visualizer/phase-1/spec.md`: the original nominal-delivery
  decision and the later output-side correction when per-machine rate does not
  divide belt capacity.

## Review mandate

Review the proposed target state, not whether it already exists. In particular:

1. Recalculate the 18-belt whole-machine walk and test the exact boundary
   claims for divisible and non-divisible rates.
2. Attack the proposed `min(selectedCapacity, spanDemand)` peak semantics and
   no-carry seam model: does it remain physically and mathematically honest?
3. Verify fixed override slots preserve exact starvation behavior and do not
   create an unhandled saved-plan compatibility problem.
4. Check the claim that corrected feed count is never below the aggregate
   count and therefore old override arrays cannot become too long.
5. Check belt and pipe symmetry, zero/degenerate/infeasible guards, safe-index
   boundaries, rendering consumers, and whether any contract/test surface is
   omitted.
6. Challenge the decision not to add findings deduplication: the Michael case
   must actually become finding-free from the root fix.
7. Flag any unnecessary abstraction or scope, but do not preserve a known-wrong
   historical model merely because it was once frozen.

Return severity-tagged, file/line-cited findings and exactly one final verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
