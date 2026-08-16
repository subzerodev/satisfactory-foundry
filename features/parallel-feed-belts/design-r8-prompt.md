# Design review r8 - bounded automatic parallel feed buses (#120)

Worktree: `/home/subzerodev/workspace/satisfactory-foundry`

Artifact: `features/parallel-feed-belts/brainstorm-spec.md` (v8 rewrite)

## Deliberate scope correction

V2-v7 preserved 17 logical slots but reinterpreted an explicit oversized load
override as multiple physical inlet lines. Review correctly exposed the large
new inlet/cardinality/grouped-tooltip/accessibility subsystem that choice
required. V8 rejects that premise using the live UI contract: one override row
edits one belt/pipe slot's load. Explicit `capacity>B` overrides keep their
existing one-line error semantics.

V8 adds bus cardinality only when the associated incoming slot already fits one
unlocked line. The existing drain invariant then proves `peakFlow<2B`, so every
new bundle is exactly `x2`. This fixes Michael's unoverridden automatic plan and
deletes all FeedBelt cardinality, bigint summary, inlet grouping, unbounded
labels, new tooltip lifecycle, Blueprint tier props, and SVG accessibility
machinery from the proposal.

The real pre-existing huge-entry and coincident-mark bugs surfaced by earlier
reviews are separately ticketed as #122 and #123 rather than hidden in prose.

## Review mandate

1. Recalculate Michael's 17 feeds, eight 840/min spans, and 30/min headroom.
2. Prove or refute the `capacity<=B`, `survivedIn<d`, `d<=B` implication that
   eligible `parallelCount` is only 1 or 2.
3. Verify explicit oversized overrides preserve every current solve, finding,
   arrow/tier/color, table, and persistence behavior.
4. Check removing feed capacity findings only for eligible bundles does not
   suppress starvation or output errors.
5. Verify the fixed `x2` Schematic run and conditional `x2 max` Blueprint marker
   cannot create the prior unbounded/overlap problems, including dense rows.
6. Trace all consumers of new required `BusSegment.parallelCount` and
   `LaneLayout.maxParallelCount`; outputs must set one.
7. Confirm #122/#123 capture the excluded existing defects and no earlier
   finding relevant to Michael's automatic case was dropped.
8. Apply a strong parsimony lens: reject any remnant of v2-v7's speculative
   inlet system.

Return severity-tagged, file/line-cited findings and exactly one final verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
