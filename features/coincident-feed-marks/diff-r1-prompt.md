# Forgejo #123 cumulative implementation review r1

Review the cumulative diff `develop...HEAD` in:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-123-coincident-feed-marks`.

## A. Current-state anchors

- Frozen design: `features/coincident-feed-marks/brainstorm-spec.md` v5.
- #120's existing custom Schematic tooltip is the only tooltip system allowed.
- `src/core/manifold.ts`, `src/ui/layout.ts`, and `src/layout/layout.ts` retain
  one logical mark per feed slot; grouping must remain render-only.
- Singleton feed rendering and every output mark are behavior-preserving paths.

## B. Claims to verify

1. `src/ui/coincident-feed-marks.ts` groups exact numeric anchors stably without
   mutating, sorting, deduplicating, or changing raw solver/layout arrays.
2. Group semantics are bounded: exact slot range/count/summed selected-tier
   capacity/boundary in ARIA and Schematic tooltip; visible `xN` through 99 and
   `x99+` thereafter.
3. Schematic label placement is lane-global and deterministic. It checks lane
   edges, every other mark anchor, and previously reserved group-label intervals
   so facing labels cannot overlap; dense labels suppress while the fixed
   double-stem glyph remains.
4. Blueprint groups feed marks only. It retains exact anchors, bounded labels,
   focus treatment, and leaves output marks untouched.
5. Mixed/zero/automatic groups do not falsely inherit one member's tier color;
   grouped pipes retain their dashed presentation.
6. The real-solver fixtures pin emitted capacities, not raw remainders:
   clamped slots 2-4 total 1440/min and the adjacent singleton is 480/min.
7. The implementation makes no unsupported exact-count-on-touch promise for a
   suppressed token. Exact touch-operable slot values remain in override rows;
   keyboard focus and nonvisual ARIA expose the bounded group summary.
8. `features/coincident-feed-marks/r2-verification.log` contains genuine FAIL
   evidence for grouping and render mutations, plus green restoration runs.

Independent pre-review verification: 38 files and 994/994 tests passed;
`npm run check`, `npm run build`, and `git diff --check develop...HEAD` passed.
Inspect implementation and tests rather than trusting these claims.

Return severity-tagged exact file:line findings and exactly one verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
