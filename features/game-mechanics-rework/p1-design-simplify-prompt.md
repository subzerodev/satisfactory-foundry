# Simplify review — design at the design stage

**Artifact under review:** `/home/subzerodev/workspace/satisfactory-foundry/features/game-mechanics-rework/p1-brainstorm-spec.md`
**Stage:** design (merged brainstorm+spec for the #140 arc's Phase 1 — the solver overflow-chain model, #151)
**Worktree (read source here to ground every proposal):** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `67d1fcd`)

This artifact has **ALREADY passed correctness review** (code-reviewer + adversarial-reviewer, degraded same-vendor roster — both APPROVED_WITH_NITS at r3 after three rounds, nits folded). **Do NOT re-check correctness**, and do not re-litigate anything in `## Revision history` — every entry is a dispositioned correctness finding.

Your **sole job**: find **over-engineering** and propose the **simplest correct shape**. For each finding: cite the lines, name the concrete simpler shape, and say why it stays correct (grounded in the worktree).

**If it is already as simple as it should be, say so — do NOT invent work.**

Design-stage lens: unnecessary abstraction/indirection; premature generality (interfaces or fields for consumers that don't exist); speculative knobs; defensive machinery beyond named requirements; document structure heavier than the problem.

Context that bounds "simplest correct" here: the locked decisions (#140 c24742/24769/24770/24796/24797) NAME the outputs — entry/hand-off endpoints (the P2 ribbon consumes them), hardware + cascade counts (buildability), the buffer line, pipe Level-1 honesty. Those are requirements, not gold-plating. Fair game to challenge: whether any field/type in D2 exceeds what those decisions and P2 actually need (e.g. is `Cascade.tiers` consumed anywhere? is `FeedLaneHardware` as a nested object simpler as flat fields?), whether the one-segment-type-two-readings choice (D1) is simpler than two types or secretly more complex, and anything else designed past the requirement.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with line-cited findings.
