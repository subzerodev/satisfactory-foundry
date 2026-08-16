# Diff review r1 - reject negative lane overrides (#121)

Worktree: `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-121-negative-overrides`

Cumulative diff against `develop`: `/tmp/satisfactory-foundry-121.diff`

Frozen design: `features/negative-overrides/brainstorm-spec.md`

Bidirectional evidence: `features/negative-overrides/r2-verification.log`

## Current-state anchors

- `src/core/manifold.ts`: stage-global validation, lane-local validation,
  feed/output early-return precedence, starvation and over-capacity behavior.
- `src/state/store.ts`: persisted override text parsing and `bad-override`
  routing.
- `src/core/manifold.test.ts`, `src/state/store.test.ts`: pre-existing invalid
  input and override semantics.

## Claims to verify

1. Store-entered negative feed/output overrides become `invalid` with reason
   `bad-override` and the exact lane/one-based-slot detail from the frozen spec.
2. Direct pure-solver callers receive a lane-local `negative-override` finding;
   the first negative wins and valid sibling lanes still solve.
3. Negative override validation precedes degenerate, infeasible, and oversize
   override-array exits on both feed and output paths.
4. Zero remains valid: zero input can starve or use residual carry, and zero
   output capacity produces the binding over-capacity finding.
5. Existing nonnegative override behavior and stage-global validation remain
   unchanged.
6. The verification log contains genuine fail-with-production-removed evidence
   for both distinct production behaviors, followed by restoration green runs.
7. The change is no broader or more complex than required by #121.

Return severity-tagged, file/line-cited findings and exactly one final verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.

## R1 disposition

- code-reviewer `APPROVED_WITH_NITS`: folded the stale degenerate-lane comment
  so it names negative-override precedence.
- adversarial-reviewer `APPROVED_WITH_NITS`: folded the stale design lifecycle
  status; the design is frozen after its completed review and simplify pass.
