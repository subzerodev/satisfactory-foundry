# Simplify review — design at the design stage

**Artifact under review:** `/home/subzerodev/workspace/satisfactory-foundry/features/build-view-pan/brainstorm-spec.md`
**Stage:** design (Tier-2 merged brainstorm+spec for #154 — the build view pans at readable pitch; the ruler legend entry)
**Worktree (read source here to ground every proposal):** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `66f985a`)

This artifact has **ALREADY passed correctness review** (code-reviewer + adversarial-reviewer, degraded same-vendor roster — converged at r5 after five rounds). **Do NOT re-check correctness** and do not re-litigate the revision history.

Your **sole job**: find **over-engineering** and propose the **simplest correct shape**. Cite lines, name the concrete simpler shape, say why it stays correct.

**If it is already as simple as it should be, say so — do NOT invent work.**

One question is EXPLICITLY yours (handed off by the r5 correctness round): the re-pinned N=114 rects+caption test is behaviourally redundant with the N=161 and N=20 pins post-retirement (all three traverse the one rects path, differing only in the N literal) — keep the re-pin or DELETE as redundant? Adjudicate.

Other fair game: the grab-drag hook's shape (~30 lines vs an even smaller inline handler), the sweep section's size (five rounds of hardening — is any of it now duplicative prose a leaner gate+map would serve?), the ruler hover sentence (needed alongside the legend entry, or one of the two suffices?), anything else designed past requirement. The 24px floor, the scroll semantics, the band retirement, and the #138/S12P1 framings are correctness-settled requirements.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with line-cited findings.
