# Design review r2 - shared ChainBuilder jsdom harness (#109)

Worktree: `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-109-chainbuilder-harness`

Artifact: `features/chainbuilder-harness/brainstorm-spec.md` (v2)

## Delta from r1

Both reviewers returned `NEEDS_REWORK` on the same issue: a render exception
could occur after container/root creation but before the caller receives the
handle, leaving `afterEach` unable to clean it. V2 requires transactional
rollback inside `mountChainBuilder`, preservation of the original error, and
explicit render-failure plus double-cleanup verification.

Recheck the full design against the four live suites, especially module-order,
event semantics, failure cleanup, idempotence, fixture ownership, and whether
the API is the smallest useful extraction.

Return severity-tagged, file/line-cited findings and exactly one final verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
