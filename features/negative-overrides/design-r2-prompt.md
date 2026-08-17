# Design review r2 - negative load overrides (#121)

Worktree:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-121-negative-overrides`

Artifact: `features/negative-overrides/brainstorm-spec.md`

## Delta from r1

Both reviewers returned NEEDS_REWORK on the same omissions. V2 now:

- pins the negative guard before every lane-local degenerate/infeasible return;
- adds a precedence matrix for `N=0`, zero-rate, and `d>B`, feed and output;
- adds `solveStage` sibling-lane integration for both sides;
- pins first-negative, one-based slot behavior and the exact store/core detail:
  `lane <itemId> override <slot> must be zero or positive; got <value>.`

Everything else is unchanged. Review whether these folds fully resolve r1
without creating inconsistent store/core precedence or over-testing. Return
severity-tagged, file/line-cited findings and exactly one final verdict token.
