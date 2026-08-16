# Cumulative diff review r1 - bounded parallel feed buses (#120)

Worktree:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-120-parallel-feed-belts`

Review range: `b1b4cc8..ad2897ae6ecb00ebc6e8b58d2ef96ac78da6df62`

Frozen design: `features/parallel-feed-belts/brainstorm-spec.md`

## Scope

Fix the false Mk5 capacity failures by modeling eligible automatic feed-bus
spans as exactly one or two parallel unlocked-tier lines. Preserve physical
inlet slots, exact arithmetic, explicit oversized override errors, starvation,
outputs, and serialization. Disclose cardinality and optional one-line upgrades
in Summary, Schematic, and Blueprint with one accessible custom-tooltip path.

## Review mandate

1. Independently recalculate Michael's `N=106`, `d=120`, Mk5 `B=780` case:
   17 feeds, 30/min headroom, exactly eight 840/min `parallelCount=2` spans.
2. Prove the eligible `peak<2B` invariant and verify capacity findings are
   suppressed only for valid bundles, never for oversized explicit slots,
   starvation, or outputs.
3. Trace every required `parallelCount`/`maxParallelCount` construction and
   empty/output default.
4. Verify bus rails use the unlocked top-tier color independently from a lower
   tier remainder inlet; pipes, error state, run labels, and dense spans remain
   truthful.
5. Verify mouse, sighted keyboard, touch-visible, and nonvisual disclosure,
   focus/blur tooltip positioning, and absence of nested SVG `<title>`.
6. Verify the optional upgrade search skips locked tiers that still need two
   lines and never reads as a required recovery.
7. Inspect Summary/Blueprint layout stability and unchanged singleton/output
   rendering.
8. Verify all tests discriminate in both mutation directions. Treat
   `r2-verification.log` as evidence only and inspect source/tests directly.
9. Apply a strict scope and compatibility review against the frozen v11 design
   and Forgejo #120.

Return severity-tagged, file/line-cited findings and exactly one final verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
