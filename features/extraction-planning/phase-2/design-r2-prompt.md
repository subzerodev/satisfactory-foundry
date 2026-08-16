# #124 Phase 2 brainstorm/spec review r2

Review:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-124-extraction-p2-purity/features/extraction-planning/phase-2/brainstorm-spec.md`

Worktree:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-124-extraction-p2-purity`

## Delta from r1

Both valid findings are folded. Node counts are parsed exactly and both each
value and their aggregate must fit `Number.MAX_SAFE_INTEGER` before conversion
for the existing power helper. Plan v6 now uses a distinct frozen historical
selection type; Plan v7 uses the widened current type, and v6-to-v7 migration
explicitly copies only the two known historical fields.

Recheck the complete candidate and return severity-tagged exact citations plus
exactly one final verdict: `APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or
`BLOCKED`.
