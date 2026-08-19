# Simplify review — diff at the diff stage

**Artifact under review:** the cumulative diff `develop...feature/phase-p4` (10 files, +1421/−132; commits c4d5cbe..4d82114), saved at `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/phase-p4/features/raw-packaging/p4-phase-diff.diff`.
**Stage:** diff (P4 implementation of the frozen r5 spec `features/raw-packaging/brainstorm-spec.md`, #133)
**Worktree (read source here to ground every proposal):** `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/phase-p4`

This diff has **ALREADY passed correctness review** (code-reviewer APPROVED_WITH_NITS — stale comments, folded; adversarial APPROVED with one INFO; degraded same-vendor roster). **Do NOT re-check correctness.**

Your **sole job**: find **over-engineering** and name the **simplest correct shape**. Cite lines, name the concrete simpler shape, say why it stays correct.

**If it is already as simple as it should be, say so — do NOT invent work.**

Diff-stage lens: helpers a direct expression would serve; duplicated logic (the rebuild helpers vs existing migration code; the panel controls vs LinkInspector's — is anything copy-pasted that should be shared, or shared that should be inline?); guards beyond spec-named requirements (the v9 machinery, the canonicalized write, and the rebuild migrations are settled requirements — keep); test scaffolding heavier than the 11 pins require.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with line-cited findings.
