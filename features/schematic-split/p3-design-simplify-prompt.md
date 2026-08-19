# Simplify review — design at the design stage

**Artifact under review:** `/home/subzerodev/workspace/satisfactory-foundry/features/schematic-split/p3-brainstorm-spec.md`
**Stage:** design (fresh merged brainstorm+spec for the #140 arc's Phase 3 — the schematic split, #135)
**Worktree (read source here to ground every proposal):** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `8bb34b5`)

This artifact has **ALREADY passed correctness review** (code-reviewer + adversarial-reviewer, degraded same-vendor roster — converged at r2, nits folded). **Do NOT re-check correctness**, and do not re-litigate the revision history or the pre-arc #135 gate history.

Your **sole job**: find **over-engineering** and propose the **simplest correct shape**. Cite lines, name the concrete simpler shape, say why it stays correct (grounded in the worktree).

**If it is already as simple as it should be, say so — do NOT invent work.**

Design-stage lens: unnecessary abstraction; premature generality; speculative knobs; defensive machinery beyond named requirements; document structure heavier than the problem.

Context bounding "simplest correct": the split (c24630) and the two-mark ruler (c24913, Michael's pick) are decided requirements. Fair game: the `machineRowH` PARAMETER on computeLayout (vs two functions, vs a boolean) — is a numeric parameter the right generality when exactly two values (40, 12) ever pass? The `Ruler` as a sub-component vs inline. The machines view calling full `computeLayout` (all lane math computed, lanes unread) — wasteful or correctly-simple reuse? Anything else designed past requirement.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with line-cited findings.
