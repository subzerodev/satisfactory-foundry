# Design review r1 - negative load overrides (#121)

Worktree:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-121-negative-overrides`

Artifact:
`features/negative-overrides/brainstorm-spec.md`

Review the target state against:

- `src/state/store.ts`: `parseOverrideSide`, `derive`, and `SolveState`.
- `src/core/manifold.ts`: `Finding`, `solveFeedLane`, `solveOutputLane`,
  `drainSpan`, and lane-local invalid findings.
- `src/state/store.test.ts` and `src/core/manifold.test.ts`.
- `src/ui/FindingsPanel.tsx` for the existing `bad-override` channel.

Settled product rule: negatives are invalid; zero is a valid deliberate
no-flow override. Do not re-litigate it.

Attack validation ordering, direct-caller safety, feed/output symmetry, zero
semantics, sibling-lane behavior, error detail stability, and whether the
proposed helper is the smallest correct shape. Confirm tests discriminate
negative from malformed, zero, and positive values.

Return severity-tagged, file/line-cited findings and exactly one final verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
