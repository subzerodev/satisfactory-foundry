# Simplify review — diff at the diff stage

**Artifact under review:** the cumulative diff `develop...feature/phase-p3` (8 files, +715/−202; commits 759e7eb/c0db95b/a7b910c). Read the touched files directly in the worktree.
**Stage:** diff (P3 implementation of the frozen fresh spec `features/schematic-split/p3-brainstorm-spec.md`, #135)
**Worktree (read source here to ground every proposal):** `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/phase-p3`

This diff has **ALREADY passed correctness review** (code-reviewer APPROVED + adversarial APPROVED, both zero findings; degraded same-vendor roster). **Do NOT re-check correctness.**

Your **sole job**: find **over-engineering** and name the **simplest correct shape**. Cite lines, name the concrete simpler shape, say why it stays correct.

**If it is already as simple as it should be, say so — do NOT invent work.**

Diff-stage lens: helpers a direct expression would serve; duplicated logic (the Ruler vs Machines arms; any copy-paste between Schematic.tsx and Machines.tsx that should share); guards beyond spec-named requirements; test scaffolding heavier than the pins require (smoke.test.tsx grew +342 lines — proportionate?); dead parameters. Two known cosmetic notes from correctness (not required, but in-scope if you judge them worth folding): the dead CSS selector `.machine-ruler .ruler-major line` (app.css:736, introduced in this diff), and whether anything else in the new CSS is unmatched.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with line-cited findings.
