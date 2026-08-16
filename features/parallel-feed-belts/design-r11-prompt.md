# Design review r11 - bounded automatic parallel feed buses (#120)

Worktree: `/home/subzerodev/workspace/satisfactory-foundry`

Artifact: `features/parallel-feed-belts/brainstorm-spec.md` (v11)

## Delta from r10

R10 received `APPROVED` from adversarial-reviewer and `NEEDS_REWORK` from
code-reviewer. V11 folds both code-reviewer findings:

1. focus on a bundled glyph now displays the existing custom tooltip anchored
   from the glyph bounding box; blur hides it. Hover and focus reuse one existing
   component-local tooltip state, with no SVG title or second tooltip mechanism;
2. the unreachable partial-lane upgrade branch is removed. A tier carrying the
   lane maximum necessarily carries every lower bundled peak.

All v10 math, upgrade scanning, rail coloring, empty defaults, and explicit
override scope remain unchanged.

## Review mandate

1. Confirm sighted keyboard, nonvisual, mouse, and touch-visible disclosure is
   complete while preserving exactly one tooltip mechanism/state.
2. Confirm the summary upgrade rule is internally reachable and truthful.
3. Revalidate the bounded exact-arithmetic invariant, Michael regression,
   locked-tier scan, independent rail color, no false finding, and preservation
   of oversized override/output behavior.
4. Apply a strong parsimony lens; reject any return of v2-v7 complexity.

Return severity-tagged, file/line-cited findings and exactly one final verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
