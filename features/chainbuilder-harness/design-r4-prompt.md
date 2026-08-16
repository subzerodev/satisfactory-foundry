# Design review r4 - shared ChainBuilder jsdom harness (#109)

Worktree: `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-109-chainbuilder-harness`

Artifact: `features/chainbuilder-harness/brainstorm-spec.md` (post-simplify)

## Delta from correctness-approved v3

The one-shot simplify lens returned `APPROVED_WITH_NITS`. Both findings were
folded: suites perform state setup before parameterless `mountChainBuilder()`,
and `clickText` is no longer public (shared `propose` keeps its private exact
lookup; byproduct retains a local command helper).

Re-run correctness only. Confirm the narrowed API preserves all settled module-
order, interaction, transactional rollback, cleanup, migration, and verification
requirements.

Return severity-tagged, file/line-cited findings and exactly one final verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
