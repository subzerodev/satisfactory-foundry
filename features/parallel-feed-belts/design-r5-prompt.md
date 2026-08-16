# Design review r5 - parallel feed bus bundles (#120)

Worktree: `/home/subzerodev/workspace/satisfactory-foundry`

Artifact: `features/parallel-feed-belts/brainstorm-spec.md` (v5)

## Delta from r4

Both r4 reviewers returned `NEEDS_REWORK`. V5 folds every finding:

- entry positions compare exact bigint quotients with `BigInt(N)` and clamp
  before safe-number narrowing;
- Schematic and Blueprint deterministically group coincident inlet marks into
  one visible glyph/hit target whose tooltip enumerates every logical slot,
  load, physical count, per-line tier, and shared boundary;
- regressions cover zero-followed-by-auto, multiple oversized slots clamped to
  `N`, and the cited maximum-safe-count/cumulative-quotient cross-product.

## Settled user decision

Michael's 106-Refinery Wet Concrete factory is buildable at Mk5 by using more
parallel belts; Mk6 is optional. Do not re-litigate this.

## Current anchors

- `src/core/manifold.ts`: feed combination, cumulative entry math, safe-index
  guard, exact arithmetic.
- `src/ui/Schematic.tsx`, `src/ui/format.ts`, `src/ui/layout.ts`: Schematic
  marks and tooltips.
- `src/layout/layout.ts`, `src/ui/Blueprint.tsx`: Blueprint marks and the
  existing explicit coincident-mark posture.
- `src/ui/SummaryCards.tsx`, `src/ui/LaneOverrides.tsx`: other feed consumers.

## Review mandate

1. Recalculate Michael's exact 17-feed/eight-bundle result and 30/min headroom.
2. Prove bigint-first entry clamping handles the cited huge override without
   weakening unsafe result rejection.
3. Attack coincident grouping for zero loads, clamped oversized slots, differing
   counts, ordering, labels, colors, and tooltip accessibility in both views.
4. Recheck extent-aware segment markers, exact bigint summary aggregation, and
   unlocked physical-line tier presentation.
5. Confirm saved slots, starvation, single-machine infeasibility, and all output
   behavior remain unchanged, and no earlier finding was dropped.

Return severity-tagged, file/line-cited findings and exactly one final verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
