# Design review r6 - parallel feed bus bundles (#120)

Worktree: `/home/subzerodev/workspace/satisfactory-foundry`

Artifact: `features/parallel-feed-belts/brainstorm-spec.md` (v6)

## Delta from r5

Both r5 reviewers returned `NEEDS_REWORK`. V6 folds every finding:

- coincident mixed-tier/count groups always use neutral drawing ink and an
  explicit `N feeds` badge rather than borrowing one member's encoding;
- all bundled/group SVG targets expose the exact member text through pointer,
  touch-focus, keyboard focus, `<title>`, and `aria-label` paths;
- non-coincident inlet badges use the same explicit text extents, padding, and
  greedy non-overlap rule as segment marker runs; glyphs and focus targets are
  never suppressed;
- regressions cover mixed groups, ARIA/focus/pointer access, and dense 8px inlet
  badges.

## Settled user decision

Michael's 106-Refinery Wet Concrete factory is buildable at Mk5 by using more
parallel belts; Mk6 is optional. Do not re-litigate this.

## Current anchors

- `src/core/manifold.ts`: feed/load/cardinality and bigint entry math.
- `src/ui/Schematic.tsx`, `src/ui/format.ts`, `src/ui/layout.ts`,
  `src/ui/app.css`: marks, tooltip events, labels, and SVG focus styles.
- `src/layout/layout.ts`, `src/ui/Blueprint.tsx`: Blueprint inlet marks.
- `src/ui/SummaryCards.tsx`, `src/ui/LaneOverrides.tsx`: other consumers.

## Review mandate

1. Recalculate Michael's 17-feed/eight-bundle result and 30/min headroom.
2. Attack mixed/coincident group encoding and prove it cannot imply one member's
   tier or count represents the group.
3. Verify pointer, touch, keyboard, focus anchoring, `<title>`, and ARIA access
   expose every hidden member in both views.
4. Prove retained inlet and segment badge intervals cannot overlap at 8px pitch
   for variable and maximum-safe-integer labels.
5. Recheck huge entry clamping, bigint summary totals, unlocked physical-line
   tier presentation, saved slots, starvation, infeasibility, and outputs.
6. Confirm no earlier finding was dropped and the design is implementable
   without an unbounded rendering abstraction.

Return severity-tagged, file/line-cited findings and exactly one final verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
