# Simplify review — design at the design stage

**Artifact under review:** `/home/subzerodev/workspace/satisfactory-foundry/features/game-mechanics-rework/p0-brainstorm-spec.md`
**Stage:** design (merged brainstorm+spec for the #140 arc's Phase 0 — parsed tier table + train-lockout correction)
**Worktree (read source here to ground every proposal):** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `64a8fcf`)

This artifact has **ALREADY passed correctness review** (the correctness pair — code-reviewer + adversarial-reviewer, degraded same-vendor roster — both APPROVED at r8 after eight rounds). **Do NOT re-check correctness** — bugs, missing cases, and design-intent disputes are the correctness pair's beat, not yours, and re-litigating them here is out of scope. In particular, do not re-litigate anything in the `## Revision history` — every entry there is a dispositioned correctness finding.

Your **sole job**: find **over-engineering** and propose the **simplest correct shape**. For each finding:

1. **Cite the lines** (`file:line` or a line range into the artifact).
2. **Name the simpler shape** concretely — not "this could be simpler" but the specific structure that replaces it.
3. **Say why it stays correct** — a simplification that breaks the requirement is not a simplification. Ground it by reading the worktree.

**If it is already as simple as it should be, say so — do NOT invent work.** An honest `APPROVED` with no findings is the right answer for a parsimonious artifact.

### Design-stage guidance

At the design stage, look for over-engineering *designed in* before any code:

- unnecessary abstraction layers or indirection the requirement does not ask for;
- premature generality — interfaces, hooks, or parameters for hypothetical future callers that do not exist;
- speculative options / configuration knobs with no stated consumer;
- defensive machinery (extra guard layers, validation, catch-alls) **beyond** the stated requirement — distinguish a guard the requirement *names* (keep it) from one accreted "to be safe" (flag it, name the requirement it exceeds);
- a process or document structure more elaborate than the problem demands.

Context that bounds "simplest correct" here: the spec's guards exist against named requirements — the single-owner ready clamp is totality-mandatory (sliceTier's RangeError contract), the three-branch merge sanitizer and its pins came out of real pinned-test collisions, and the D4 re-derive-every-assertion method is a memory-rule response to four real sweep failures. Flag anything BEYOND those named requirements.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
