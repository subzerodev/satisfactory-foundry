# Simplify review — diff at the diff stage

**Artifact under review:** the cumulative diff `develop...feature/phase-p2` (14 files, +1516/−61; commits cdc98db..fa6fce3), saved at `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/phase-p2/features/game-mechanics-rework/p2-phase-diff.diff`.
**Stage:** diff (P2 implementation of the frozen r4 spec `features/game-mechanics-rework/p2-brainstorm-spec.md`, #152)
**Worktree (read source here to ground every proposal):** `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/phase-p2`

This diff has **ALREADY passed correctness review** (code-reviewer APPROVED_WITH_NITS — one awareness-only NIT; adversarial APPROVED — zero findings; degraded same-vendor roster). **Do NOT re-check correctness.**

Your **sole job**: find **over-engineering** in the implementation and name the **simplest correct shape**. Cite lines, name the concrete simpler shape, say why it stays correct.

**If it is already as simple as it should be, say so — do NOT invent work.**

Diff-stage lens: helpers a direct expression would serve; duplicated logic; guards beyond spec-named requirements (the spec's named rules — terminal RIBBON_MIN, both collision rules, the scoped gate — are requirements, keep them); test scaffolding heavier than the pins require (the new p2-drawing.test.tsx is large — is any of it redundant with existing suites?); dead parameters or premature generality.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with line-cited findings.
