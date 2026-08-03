# Simplify review — diff at the diff stage

**Artifact under review:** `/home/subzerodev/workspace/satisfactory-foundry/features/stage0-bootstrap/stage0-diff.diff`
(the cumulative `develop...feature/stage0-bootstrap` diff, 1565 lines;
`package-lock.json` excluded as generated)
**Stage:** diff
**Worktree (read source here to ground every proposal):** `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/stage0-bootstrap`

This artifact has **ALREADY passed correctness review** (the correctness pair
both APPROVED_WITH_NITS the diff; nits folded and re-verified green — 70/70
tests, `check` clean). **Do NOT re-check correctness** — bugs, missing cases,
and design-intent disputes are the correctness pair's beat, not yours, and
re-litigating them here is out of scope.

The diff implements the frozen Stage 0 spec at
`docs/superpowers/specs/2026-08-03-stage0-bootstrap-design.md` (in the
worktree) — reviewer-mandated complexity in the spec (purity-boundary rule
set, Fraction guards, test breadth) is settled; judge the *implementation's*
shape against it.

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

### Diff-stage guidance

At the diff stage, look for over-engineering shapes in code:

- needless indirection — a wrapper / layer / dispatch that adds no value over a
  direct call;
- duplicated logic that could reuse an existing helper (name the helper and its
  location, verified by reading the worktree);
- guards, branches, or error handling **beyond** the requirement the diff
  implements — again, separate required guards (the spec names Fraction's) from
  accreted ones;
- generality (parameters, abstractions) the diff introduces with no caller.

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
