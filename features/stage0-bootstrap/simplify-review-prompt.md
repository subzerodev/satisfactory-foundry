# Simplify review — design at the design stage

**Artifact under review:** `/home/subzerodev/workspace/satisfactory-foundry/docs/superpowers/specs/2026-08-03-stage0-bootstrap-design.md`
**Stage:** design
**Worktree (read source here to ground every proposal):** `/home/subzerodev/workspace/satisfactory-foundry`

This artifact has **ALREADY passed correctness review** (the correctness pair
both APPROVED / APPROVED_WITH_NITS the final state — round 3). **Do NOT
re-check correctness** — bugs, missing cases, and design-intent disputes are
the correctness pair's beat, not yours, and re-litigating them here is out of
scope.

Your **sole job**: find **over-engineering** and propose the **simplest correct
shape**. For each finding:

1. **Cite the lines** (`file:line` or a line range into the artifact).
2. **Name the simpler shape** concretely — not "this could be simpler" but the
   specific structure that replaces it.
3. **Say why it stays correct** — a simplification that breaks the requirement is
   not a simplification. Ground it by reading the worktree.

**If it is already as simple as it should be, say so — do NOT invent work.** An
honest `APPROVED` with no findings is the right answer for a parsimonious
artifact. Padding the review with speculative nits wastes a rate-limited call.

Context for the parsimony judgment: this is a Stage 0 bootstrap scaffold spec
(greenfield Vite + React + TS project, `src/core/` purity boundary, hand-rolled
`Fraction`). The locked requirements it must keep are in
`/home/subzerodev/workspace/satisfactory-foundry/CLAUDE.md` and the v1 design
`/home/subzerodev/workspace/satisfactory-foundry/docs/superpowers/specs/2026-08-03-manifold-visualizer-design.md`.
Its `## Revision history` records three correctness-review rounds — some
complexity was reviewer-mandated; judge whether any of it overshot.

### Design-stage guidance

At the design stage, look for over-engineering *designed in* before any code:

- unnecessary abstraction layers or indirection the requirement does not ask for;
- premature generality — interfaces, hooks, or parameters for hypothetical future
  callers that do not exist;
- speculative options / configuration knobs with no stated consumer;
- defensive machinery (extra guard layers, validation, catch-alls) **beyond** the
  stated requirement — distinguish a guard the requirement *names* (keep it) from
  one accreted "to be safe" (flag it, name the requirement it exceeds);
- a process or document structure more elaborate than the problem demands.

## Verdict

Return **exactly one** verdict as the final line, uppercase, nothing else on it:
`APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` / `BLOCKED`.

Your verdict is **advisory-with-teeth** — the team lead, not this token, decides
each finding's fate (fold it, or reject it with a written rationale). So:

- `APPROVED` — already as simple as it should be; no over-engineering found.
- `APPROVED_WITH_NITS` — minor parsimony nits worth folding.
- `NEEDS_REWORK` — real over-engineering found. **This does NOT gate** — the team
  lead dispositions each finding (fold / reject-with-rationale); it does not block
  the proceed.
- `BLOCKED` — a fundamental over-engineering problem worth a human call. This is
  the **only** token that forces a stop, and it **escalates to the user**.

Findings carry a severity tag (`BLOCKER` / `IMPORTANT` / `NIT`) and a citation,
exactly as the correctness reviewers format theirs.
