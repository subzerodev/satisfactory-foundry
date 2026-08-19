# Simplify review — diff at the diff stage

**Artifact under review:** the cumulative diff `develop...feature/phase-p1` (27 files, +784/−866; commits be199ba..3e54235). Generate it yourself in the worktree: `git diff develop...feature/phase-p1`.
**Stage:** diff (P1 implementation of the frozen r3 spec `features/game-mechanics-rework/p1-brainstorm-spec.md`, #151)
**Worktree (read source here to ground every proposal):** `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/phase-p1`

This diff has **ALREADY passed correctness review** (code-reviewer APPROVED_WITH_NITS + adversarial APPROVED_WITH_NITS, degraded same-vendor roster; nits folded — dead CSS deleted, spec prose corrected). **Do NOT re-check correctness.**

Your **sole job**: find **over-engineering** in the implementation and name the **simplest correct shape**. Cite lines, name the concrete simpler shape, say why it stays correct.

**If it is already as simple as it should be, say so — do NOT invent work.** Note this is a net-NEGATIVE diff retiring a whole feature surface; the question is whether what was ADDED (hardware/cascade/buffer computation, the pipe honesty branch, the new test file) carries anything beyond the frozen spec's named requirements.

Diff-stage lens: helpers a direct expression would serve; duplicated logic; guards beyond spec-named requirements; test scaffolding heavier than the pins require; dead parameters.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with line-cited findings.
