# Boundary review — #116 implementation diff

Review the cumulative diff `develop...feature/alt-marker` in
`/home/subzerodev/workspace/satisfactory-foundry`.

**Stage: DIFF.** The design (`features/alt-marker/brainstorm-spec.md`, v5) is
FROZEN — it passed three correctness rounds and a simplify pass. Review the
CODE against it, not the design.

The diff is at
`/tmp/claude-1000/-home-subzerodev-workspace-satisfactory-foundry/78d7d7a8-7929-4fa7-9357-e78884a0e550/scratchpad/alt-marker.diff`
(356 lines, 5 files, 301 insertions, 0 deletions). You may also read the branch
directly; the worktree is at `.worktrees/alt-marker`.

## The three production lines

```ts
// chain-builder-adapter.ts — CandidateRow
/** true ⇒ this row's recipe is an ALTERNATE. The parser strips the game's
 *  "Alternate: " prefix (docs-loader.ts:190), so `recipeName` cannot carry it. */
isAlternate: boolean;

// chain-builder-adapter.ts — candidateRowsFor, one line below isCurrent
isAlternate: candidate.isAlternate,

// AltCompare.tsx:155
{row.isAlternate && (
  <span className="alt-compare-mark"> (alt)</span>
)}
```

## A. Verify against live source

- The field sits on `CandidateRow` and is set from `candidate.isAlternate` — NOT
  from anything derived from `currentRecipeId`.
- The marker renders after `{row.recipeName}` and BEFORE the byproducts span.
- `.alt-compare-mark` is reused, no new CSS rule was added anywhere.
- No change to `AltCompare.tsx`'s header docstring (the frozen design ruled this
  out explicitly — that clause enumerates comparison METRICS, and `(alt)` is an
  identity marker).
- Nothing out of scope: no ordering change, no `< 2` gate change, no
  `swapPayloadFor`/`candidateCount` change, no serialization.

## B. The bidirectionality log — this is the main event

`features/alt-marker/verification.log` (on the branch) must exist and must show
GENUINE failures. This repo has shipped **nine** tests that passed whether the
code was right or wrong, and this ticket's design spent two review rounds on a
tenth. Check:

1. The log exists and contains real framework `FAIL`/`×` lines naming the diff's
   new test functions, captured with the production code broken.
2. **Every mutant compiles.** A `ReferenceError` or type error is not a
   behavioural bite — it is a crash, and it proves nothing. The implementer
   claims each mutant was typechecked with `npx tsc -b` first. Spot-check that
   claim against what the log actually shows.
3. The claimed **polarities** are right: mutant `=== currentRecipeId` should fail
   at the `r_std` polarity, `!== currentRecipeId` at the `r_alt` polarity,
   render-side `{!row.isCurrent && …}` at pass 2 and `{row.isCurrent && …}` at
   pass 1. If a log entry claims a kill at the wrong polarity, that entry is
   measuring something other than what it says.
4. The implementer additionally claims to have **measured** the design's central
   premise: with both pins reduced to a single (`r_alt`) polarity, mutant
   `=== currentRecipeId` survives all 105 tests; and it cross-checked that those
   same reduced pins still kill `!== currentRecipeId`, to rule out "the reduced
   pins are simply broken." Verify that experiment is actually in the log and
   that the cross-check is present — without it, a surviving mutant is
   ambiguous evidence.

## C. The tests themselves

- Do BOTH pins genuinely assert at two polarities, with the **identical**
  assertion at each? (That identity is the semantic content: the marker follows
  the recipe, not the selection.)
- Is the render pin's absence half scoped to the CELL (`<td>Standard</td>`) and
  not a whole-document `not.toContain`?
- Does the presence half keep the parens? (The fixture's alternate is *named*
  "Alternate", so a bare `"alt"` would match the recipe name.)
- Is the store-seeding seam restored in a `finally`?
- No jsdom introduced (a third jsdom file would trigger #109).

## D. Anything the diff got wrong

Including: a test that would pass with the production change reverted; a comment
that narrates *what* rather than *why*; scope creep; a fixture mutated in a way
that weakens an existing pin.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings.

Do NOT spawn nested verification agents; verify yourself and return your verdict
directly.
