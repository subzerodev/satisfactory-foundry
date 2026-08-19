# Simplify review — diff at the diff stage

**Artifact under review:** the cumulative diff `develop...feature/phase-p0`, saved at `/home/subzerodev/workspace/satisfactory-foundry/features/game-mechanics-rework/p0-phase-diff.diff` (17 files, +874/−113; commits ae29e08..780346d)
**Stage:** diff (P0 implementation of the frozen r8 spec `features/game-mechanics-rework/p0-brainstorm-spec.md`, #150)
**Worktree (read source here to ground every proposal):** `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/phase-p0`

This diff has **ALREADY passed correctness review** (code-reviewer APPROVED + adversarial-reviewer APPROVED_WITH_NITS, nit folded — degraded same-vendor roster). **Do NOT re-check correctness.**

Your **sole job**: find **over-engineering** in the implementation and name the **simplest correct shape**. For each finding: cite the lines, name the concrete simpler shape, and say why it stays correct (grounded in the worktree).

**If it is already as simple as it should be, say so — do NOT invent work.**

At the diff stage, look for over-engineering that only becomes visible in code:
- helper functions/indirection a direct expression would serve;
- duplicated logic the diff could share;
- defensive guards beyond what the spec names (the spec's named guards — the ready clamp, the three-branch sanitizer, parse-else-curated fallback — are requirements, keep them);
- test scaffolding heavier than the pins require;
- dead parameters or premature generality.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with line-cited findings.
