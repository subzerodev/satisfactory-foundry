# Simplify review — design at the design stage

**Artifact under review:** `/home/subzerodev/workspace/satisfactory-foundry/features/game-mechanics-rework/p2-brainstorm-spec.md`
**Stage:** design (merged brainstorm+spec for the #140 arc's Phase 2 — the drawing: ribbon + endpoints + legend + tables, #152)
**Worktree (read source here to ground every proposal):** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `88a87d2`)

This artifact has **ALREADY passed correctness review** (code-reviewer + adversarial-reviewer, degraded same-vendor roster — both APPROVED at r4 after four rounds, cosmetic nit folded). **Do NOT re-check correctness**, and do not re-litigate anything in `## Revision history`.

Your **sole job**: find **over-engineering** and propose the **simplest correct shape**. Cite lines, name the concrete simpler shape, say why it stays correct.

**If it is already as simple as it should be, say so — do NOT invent work.**

Design-stage lens: unnecessary abstraction; premature generality; speculative knobs; defensive machinery beyond named requirements; document structure heavier than the problem.

Context bounding "simplest correct": the D+F rendering (ribbon + endpoint numbers), the table lines, and the two P1 caveats are decided requirements (#140 c24769/c24796/c24797, p1-completion.md). Fair game to challenge: the label collision/thinning rule pair (three rules now — narrow-stretch thinning, entry push, hand-off drop — is there ONE simpler discipline that covers all three?), the D7 site-plan kind vocabulary (three kinds vs two), the RIBBON_MIN hairline (vs simply ending the polygon), the pipe connector element (vs reusing an existing class), and anything else designed past requirement.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with line-cited findings.
