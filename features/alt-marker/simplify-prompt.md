# Simplify review — #116 design, post-convergence

**Stage: DESIGN.** The correctness pair has converged (r3: APPROVED_WITH_NITS ×2,
nits folded) on `features/alt-marker/brainstorm-spec.md` (**v4**) in the repo at
`/home/subzerodev/workspace/satisfactory-foundry`.

**Do NOT re-check correctness.** Your one question: **is this design simpler than
it needs to be — and if not, what is the simplest correct shape?**

## What actually ships

Three lines of production change:

1. `isAlternate: boolean` added to the `CandidateRow` interface
   (`src/ui/chain-builder-adapter.ts:514-538`).
2. `isAlternate: candidate.isAlternate` set in `candidateRowsFor` (`~:975`).
3. `{row.isAlternate && <span className="alt-compare-mark"> (alt)</span>}` in
   `src/ui/AltCompare.tsx:155`.

No CSS. No new files. Plus two tests.

## Surfaces to pressure

- **The document itself.** It is ~400 lines for a 3-line change, because three
  review rounds of archaeology are recorded inline (two refuted premises, a
  wrong-file citation, an inverted correlation). Is that archaeology *earning*
  its place — will an implementer or a future reader use it — or should it
  compress to the decisions plus a short "what we got wrong" appendix? Be
  specific about what to cut.
- **The test plan.** It specifies a **three-recipe local fixture** for the
  adapter pin plus **two SSR render passes** for the render pin. That is real
  test-code cost. Is it proportionate, or would one of the two pins carry enough
  on its own? Note the reviewers established the two cover different mutants
  (the render kills the `currentRecipeId` correlations; the 3-row fixture kills a
  positional mutant the render cannot reach) — but "kills more mutants" is not by
  itself proof the second pin is worth writing. Say plainly if you think one pin
  suffices for a cosmetic marker.
- **The axes.** Six lettered axes (A–F) for a 3-line change. Are any of them
  decisions that did not need making? Axis D (composition order) in particular
  resolves to "put it where it obviously goes" and is explicitly unpinned.
- **The spec's item 4** ("verify the header docstring does not enumerate row
  fields, edit only if it does") — is that a real task or ceremony?
- Anything specced that no consumer reads.

## Frozen constraints (NOT simplification targets)

- The `(alt)` marker must be an explicit rendered signal — that is the ticket
  (#116), and #103 is blocked on it.
- `isAlternate` lives on `CandidateRow`, not computed in the component (Axis A —
  the component's stated thin-shell architecture).
- Reuse of `.alt-compare-mark` rather than a new class (Axis C, already the
  cheap option).
- The current recipe in the adapter fixture must NOT be the alternate — that
  constraint is load-bearing for what the pin discriminates.

Verdict is advisory (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED —
only BLOCKED escalates to the user). Return severity-tagged, line-cited findings
naming the simpler shape for each.
