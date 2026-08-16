# Design review r3 - parallel feed bus bundles (#120)

Worktree: `/home/subzerodev/workspace/satisfactory-foundry`

Artifact: `features/parallel-feed-belts/brainstorm-spec.md` (v3)

## Delta from r2

R2 returned `APPROVED_WITH_NITS` / `NEEDS_REWORK`. V3 folds every finding:

- adds exact safe-integer boundary tests and corrects the 30/min aggregate
  headroom wording;
- gives each logical `FeedBelt` a derived physical `parallelCount`, so an
  oversized persisted override slot is consistently presented as multiple
  inlet lines in Summary, Schematic, tooltips, and LaneOverrides;
- replaces collision-prone per-segment text with a fixed two-rail bundle glyph
  plus contiguous equal-count marker runs using the existing 20px spacing
  floor, and adds a dense 8px-pitch regression.

## Settled user decision

Michael's 106-Refinery Wet Concrete factory is buildable at Mk5 by using more
parallel belts; Mk6 is optional. Do not re-litigate this.

## Current anchors

- `src/core/manifold.ts`: `FeedBelt`, `BusSegment`, feed combination/walk,
  safe-index guard, output walk.
- `src/ui/Schematic.tsx`, `src/ui/format.ts`, `src/ui/SummaryCards.tsx`,
  `src/ui/LaneOverrides.tsx`, `src/ui/layout.ts`: detailed consumers and label
  spacing.
- `src/layout/layout.ts`, `src/ui/Blueprint.tsx`: physical Blueprint lane model.
- `src/state/store.ts`, `src/data/plan-store.ts`: override persistence.

## Review mandate

1. Recalculate the exact 17-feed/eight-bundle result and 30/min headroom.
2. Attack both `parallelCount` derivations, including zero, epsilon, oversized
   overrides, pipes, `MAX_SAFE_INTEGER`, and the next rejected count.
3. Verify logical override slots remain stable while every physical inlet
   presentation becomes honest.
4. Verify the two-rail glyph + marker-run rule cannot overlap at 8px pitch and
   still exposes exact cardinality through markers/tooltips.
5. Verify removing feed-side over-capacity findings does not weaken starvation,
   single-machine infeasibility, output validation, or saved-plan semantics.
6. Check dependency #121 is sufficient and no r1/r2 finding was dropped.

Return severity-tagged, file/line-cited findings and exactly one final verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
