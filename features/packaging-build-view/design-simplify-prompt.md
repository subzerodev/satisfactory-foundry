# Simplify review — design stage

**Artifact under review:** `/home/subzerodev/workspace/satisfactory-foundry/features/packaging-build-view/brainstorm-spec.md`
**Stage:** design (Tier-2 merged brainstorm+spec for #157 — packaging chains join the build view + belt lane counts)
**Worktree (read source here to ground every proposal):** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD ccc90fb)

This artifact has **ALREADY passed correctness review** (code-reviewer + adversarial-reviewer, degraded same-vendor roster — converged at r2). **Do NOT re-check correctness** and do not re-litigate the revision history.

Your **sole job**: find **over-engineering** and propose the **simplest correct shape**. Cite lines, name the concrete simpler shape, say why it stays correct.

**If it is already as simple as it should be, say so — do NOT invent work.**

Fair game, for example: the A2 subject-selector (is a select the leanest surface, or is the design carrying UI it doesn't need yet?); A3's stacked-groups-plus-Blueprint ambition (should Blueprint be cut to a follow-up outright instead of "implementation verifies"?); the A5 per-group power headings (needed in the drawing, or #156-panel-only?); the sweep section's size; anything designed past what Michael's field report + the own-view decision require.

NOT fair game (correctness-settled or user-decided): the own-view decision itself, the A1 adapter-over-bespoke shape, the guard-lift + undefined-half split, the #146/#133/#154 constraints, the bidirectionality-log requirement.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with line-cited findings.
