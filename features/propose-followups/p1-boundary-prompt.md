# Boundary review — S21 P1 (#103) implementation diff

Cumulative diff `develop...feature/s21-p1` in
`/home/subzerodev/workspace/satisfactory-foundry`. Worktree:
`.worktrees/s21-p1`. Diff file:
`/tmp/claude-1000/-home-subzerodev-workspace-satisfactory-foundry/78d7d7a8-7929-4fa7-9357-e78884a0e550/scratchpad/s21p1.diff`
(5 files, +516/−92).

**Stage: DIFF.** The design (`features/propose-followups/p1-brainstorm.md`, v4)
is FROZEN after three rounds. Review the CODE against it.

## What it does

Retires `candidateRecipesFor` onto `producerRecipesFor`: deletes the function,
re-points its three production call sites, and uses `producerRecipesFor`'s order
**directly** — no comparator, no ordering shim. That is only safe because #116
already shipped an explicit `(alt)` marker.

Test count **910 → 912**: −1 (a gate-only test the spec ordered deleted), +3
(rubber compare-order, lone-producer count, chip guard).

## A. Verify against live source

- The symbol is gone from `src/` (only prose mentions remain in comments).
- `candidateCount` now reads `producerRecipesFor(...).length` — range widens
  from `{0} ∪ [2,∞)` to `{0,1} ∪ [2,∞)` for **63 catalog items**. Confirm the
  RENDER is unchanged: the sole consumer branches on `>= 2`
  (`ChainBuilder.tsx`), so `0` and `1` take the same path.
- `AltCompare.tsx`'s `< 2 ⇒ null` gate is UNCHANGED and is now the ONLY gate.
  The frozen design corrects an earlier claim that this line was "dead code" —
  it is live, and deleting it yields a non-null model that renders an empty
  table with a header.
- No ordering shim was re-added anywhere.
- **#116's three pins are untouched and still pass** — two in
  `chain-builder-adapter.test.ts` ("carries isAlternate from the RECIPE…",
  "flags isAlternate against REAL parsed names…") and one in
  `AltCompare.test.tsx` ("marks the ALTERNATE row…"). If any was EDITED rather
  than left alone, that is a finding: both r3 reviewers verified they survive
  this reordering untouched.

## B. The bidirectionality log — the main event

`features/propose-followups/p1-verification.log` (on the branch), five
behaviours. This repo has shipped **nine** tests that passed whether the code
was right or wrong, and this arc's last two phases each caught another at
design time. Check:

1. Real framework FAIL lines naming the diff's new/changed test functions.
2. **Every mutant compiles** (`npx tsc -b` exit 0 recorded per row). A crash
   reddens a whole file and proves nothing behavioural.
3. Two specific claims the implementer flagged — verify both:
   - The `["r_std"]` change is an **upgrade**: the mutant's measured output is
     `[]`, byte-identical to what the retired `toEqual([])` asserted, so the old
     row would have passed it and the new one fails.
   - The **chip pin** is the only thing in the repo catching its mutant
     (`candidateCount >= 2` → `>= 1` leaks the literal `'1 recipes'` while 911
     other tests pass). That is the stated reason it could not live in the
     adapter suite.

## C. The two judgment calls the implementer flagged

1. **A comment fold beyond spec item 5's enumerated list** (commit `f404c53`) —
   a comment reading "Chip semantics (≥2 gate) are unchanged from P0; only the
   exclusion set it reads is now the live one" now sits on an ungated count.
   Item 5's rule is "every claim that becomes false." Was folding it right?
2. **A near-duplicate NOT fixed**: after the migration,
   `it("lists default (non-alternate) first, then alternates ascending by id")`
   and `it("orders effective-default first, then ascending id")` test the same
   function with the same fixture shape and expectation. The frozen spec
   classified that hit as a straight re-point and did not authorize a deletion,
   so it was left. Is leaving it correct, and is it genuinely redundant?

## D. Anything the diff got wrong

A test that passes with the production change reverted; a comment narrating
*what* rather than *why*; scope creep; an existing pin weakened; a stale comment
the migration missed.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings.

Do NOT spawn nested verification agents; verify yourself and return your verdict
directly.
