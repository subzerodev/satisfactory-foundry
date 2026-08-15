# Simplify review — diff at the diff stage

**Artifact under review:** `/home/subzerodev/workspace/satisfactory-foundry/features/total-output/diff-r1.diff`
**Stage:** diff
**Worktree (read source here to ground every proposal):** `/home/subzerodev/workspace/satisfactory-foundry`

This artifact has **ALREADY passed correctness review**: `code-reviewer`
APPROVED and `adversarial-reviewer` APPROVED, both in degraded same-vendor mode.
Do NOT re-check correctness. Bugs, missing cases, and design-intent disputes are
the correctness pair's beat, not yours.

Your sole job: find **over-engineering** and propose the **simplest correct
shape**. For each finding:

1. Cite the lines (`file:line` or a line range into the artifact).
2. Name the simpler shape concretely.
3. Say why it stays correct, grounded by reading the worktree.

If it is already as simple as it should be, say so. Do not invent work.

## Diff-stage guidance

Look for needless indirection, duplicated logic, guards beyond the requirement,
or generality introduced with no caller.

## Verdict

Return exactly one verdict as the final line, uppercase, nothing else on it:
`APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` / `BLOCKED`.

Your verdict is advisory-with-teeth: findings must be folded or rejected with a
written rationale, but only `BLOCKED` forces a stop.
