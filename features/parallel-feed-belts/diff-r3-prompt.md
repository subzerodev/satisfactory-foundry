# Cumulative diff review r3 - bounded parallel feed buses (#120)

Worktree:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-120-parallel-feed-belts`

Base: `b1b4cc8`

Frozen design: `features/parallel-feed-belts/brainstorm-spec.md`

## Delta from r2

R2 correctness returned `NEEDS_REWORK` / `NEEDS_REWORK` on one focus-tooltip
positioning defect:

- horizontal placement did not include the scroll container's `scrollLeft`;
- the anchor was clamped without reserving the tooltip's width, and long nowrap
  text could still leave the visible viewport.

The shared hover/focus placement now works in content coordinates, adds
`scrollLeft`, reserves a bounded 280px tooltip width (or the viewport less 8px
on each side), and clamps the full box inside the current horizontal viewport.
The tooltip wraps long text with `overflow-wrap:anywhere`. A jsdom regression
focuses a right-edge glyph after scrolling 400px and pins the exact 612px content
coordinate, 280px width bound, and complete accessible text.

No second simplify pass will run. Review the full current cumulative diff and
confirm both r2 findings are fixed without regressing pointer placement,
unscrolled focus, exact tooltip text, or the frozen #120 behavior.

Return severity-tagged, file/line-cited findings and exactly one final verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
