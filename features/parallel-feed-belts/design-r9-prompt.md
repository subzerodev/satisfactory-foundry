# Design review r9 - bounded automatic parallel feed buses (#120)

Worktree: `/home/subzerodev/workspace/satisfactory-foundry`

Artifact: `features/parallel-feed-belts/brainstorm-spec.md` (v9)

## Delta from r8

R8 correctly found four omissions in the narrow automatic-bundle model. V9:

1. colors both rails of an eligible `x2` segment from the best unlocked bus
   tier, independently from a lower-tier remainder inlet arrow;
2. makes each bundled glyph a focusable SVG image with exact ARIA/title text
   and visible focus while retaining the existing mouse tooltip;
3. defines empty feed and all output `LaneLayout.maxParallelCount` as `1`; and
4. retains a reducing higher tier as optional one-line summary/tooltip
   information, never as a finding or sole recovery.

The deliberately rejected v2-v7 expansion of explicit oversized override slots
remains out of scope. Such slots still mean one overloaded inlet and preserve
their existing error behavior. Existing huge-entry and coincident-mark defects
remain separately ticketed as #122 and #123.

## Review mandate

1. Recalculate Michael's 17 feeds, eight 840/min spans, and 30/min headroom.
2. Prove or refute the bounded `parallelCount` invariant for eligible slots.
3. Check the independent bus-tier/inlet-tier color rule against the pinned
   `N=87`, `d=638`, remainder-feed case.
4. Verify the focusable grouped glyph exposes exact cardinality for mouse,
   keyboard, touch-visible, and nonvisual use without needing shared state.
5. Verify optional higher-tier wording appears when it reduces cardinality but
   cannot be mistaken for a buildability requirement.
6. Trace the empty-lane and output defaults for `maxParallelCount`.
7. Ensure starvation, explicit oversized overrides, output behavior, saved
   plans, feed count, and inlet marks remain unchanged.
8. Apply a strong parsimony lens and reject any v2-v7 subsystem remnant.

Return severity-tagged, file/line-cited findings and exactly one final verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
