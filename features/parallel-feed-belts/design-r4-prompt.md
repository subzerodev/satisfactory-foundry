# Design review r4 - parallel feed bus bundles (#120)

Worktree: `/home/subzerodev/workspace/satisfactory-foundry`

Artifact: `features/parallel-feed-belts/brainstorm-spec.md` (v4)

## Delta from r3

Both r3 reviewers returned `NEEDS_REWORK`. V4 folds every finding:

- marker placement now uses explicit SVG text extents plus padded interval
  fitting and greedy non-overlap, including dense huge-count tests;
- overridden logical slots derive both physical count and top-unlocked
  `physicalLineCapacity`, preventing aggregate loads from acquiring locked-tier
  labels or colors;
- Summary aggregates individually safe counts exactly with bigint;
- Blueprint carries cardinality and physical capacity on every feed inlet mark,
  not only a lane maximum, with a multiple-oversized-slot regression.

## Settled user decision

Michael's 106-Refinery Wet Concrete factory is buildable at Mk5 by using more
parallel belts; Mk6 is optional. Do not re-litigate this.

## Current anchors

- `src/core/manifold.ts`: `FeedBelt`, `BusSegment`, exact arithmetic and safe
  narrowing.
- `src/ui/Schematic.tsx`, `src/ui/format.ts`, `src/ui/SummaryCards.tsx`,
  `src/ui/LaneOverrides.tsx`, `src/ui/layout.ts`, `src/ui/app.css`: detailed
  consumers and SVG geometry.
- `src/layout/layout.ts`, `src/ui/Blueprint.tsx`: Blueprint lane/inlet model.
- `src/state/store.ts`, `src/data/plan-store.ts`: persisted override slots.

## Review mandate

1. Recalculate Michael's exact 17-feed/eight-bundle result and 30/min headroom.
2. Attack physical count/capacity derivation for automatic, overridden, zero,
   epsilon, pipe, huge, and unsafe values.
3. Prove retained Schematic marker intervals cannot overlap, including adjacent
   variable-width and maximum-safe-integer labels at 8px pitch.
4. Trace an oversized override through every tier text/color/count consumer in
   both Schematic and Blueprint; verify multiple differing slots remain honest.
5. Verify bigint Summary aggregation is exact beyond safe integer totals.
6. Confirm saved logical slots, starvation, single-machine infeasibility, and
   all output behavior remain unchanged, and no earlier finding was dropped.

Return severity-tagged, file/line-cited findings and exactly one final verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
