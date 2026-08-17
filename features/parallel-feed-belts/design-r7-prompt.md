# Design review r7 - parallel feed bus bundles (#120)

Worktree: `/home/subzerodev/workspace/satisfactory-foundry`

Artifact: `features/parallel-feed-belts/brainstorm-spec.md` (v7)

## Delta from r6

Both r6 reviewers returned `NEEDS_REWORK`. V7 folds every finding:

- Blueprint receives explicit tier/unlocked inputs from App;
- tooltip visibility tracks hover and focus independently, including touch
  pointer-down/leave persistence;
- bundled bus segments receive the same keyboard/touch/ARIA access as inlet
  bundles, with real SVG focus-ring geometry;
- inlet badges must fit renderer bounds or be suppressed without losing their
  glyph/accessible target;
- bundled spans retain existing starvation error styling; only the false
  capacity error is removed;
- regressions cover every cited cross-product.

## Settled user decision

Michael's 106-Refinery Wet Concrete factory is buildable at Mk5 by using more
parallel belts; Mk6 is optional. Do not re-litigate this.

## Review mandate

Recheck the complete v7 artifact against live manifold, Schematic, Blueprint,
layout, formatting, App props, CSS, saved override, and output paths. In
particular verify tier identity, focus/hover/touch lifecycle, focus visibility,
badge overlap plus boundary containment, mixed coincident groups, starvation on
a bundled segment, exact huge-value handling, and Michael's arithmetic. Confirm
no earlier finding was dropped and the model remains implementable.

Return severity-tagged, file/line-cited findings and exactly one final verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
