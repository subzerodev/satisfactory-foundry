# Simplify review — #116 DIFF, post-convergence

**Stage: DIFF.** The correctness pair has converged on the final diff (boundary
r2: **APPROVED / APPROVED**, zero findings) for branch `feature/alt-marker` in
`/home/subzerodev/workspace/satisfactory-foundry` (worktree
`.worktrees/alt-marker`).

**Do NOT re-check correctness.** Your one question: **is this diff simpler than
it needs to be — and if not, what is the simplest correct shape?**

Cumulative diff: `git diff develop...feature/alt-marker`, or read the branch.

## What ships

**Production — 3 lines, and these are frozen (not simplification targets):**
`isAlternate: boolean` on `CandidateRow`; `isAlternate: candidate.isAlternate`
in `candidateRowsFor`; a conditional `<span className="alt-compare-mark">` in
`AltCompare.tsx`. No CSS, no new file, no abstraction. The design-stage simplify
pass already reduced this to its minimum.

**Tests — THREE new `it`s, and this is what to pressure:**
1. `chain-builder-adapter.test.ts` — asserts the `isAlternate` vector at **two
   polarities** on the existing synthetic fixture.
2. `AltCompare.test.tsx` — **two** `renderToStaticMarkup` passes at the same two
   polarities, asserting identical substrings.
3. `chain-builder-adapter.test.ts` — one assertion against the **real bundled
   catalog** (5 Iron Ingot candidates), plus a second assertion pinning that no
   parsed name carries an `"Alternate"` prefix.

**A 295-line `features/alt-marker/verification.log`** — the bidirectionality
artifact, 9 mutants.

## Surfaces to pressure

- **Three pins for a cosmetic boolean.** Each was added for a measured reason:
  #1 and #2 kill the `currentRecipeId` copy-slip family (single-polarity
  versions were *measured* to let a wrong implementation pass all 105 tests);
  #3 kills a name-derived mutant that both other pins were *measured* to be
  blind to. But "each kills something" is not proof all three earn their place.
  **Is there a subset that covers the same ground?** In particular: could pin 3
  (real data) subsume pin 1 (synthetic), making the synthetic one redundant? Say
  plainly if you think one should go.
- **The double assertion inside pin 3** — the vector, plus the premise that no
  parsed name starts with `"Alternate"`. The second exists so the row cannot rot
  into a tautology. Is that worth a line, or is it belt-and-braces?
- **The verification log at 295 lines** for a 3-line change. It is a required
  workflow artifact and its *content* is evidence, not prose — but is it
  padded? Name specific sections to cut if so.
- **Test comments.** Several are long (5-8 lines) explaining *why* two polarities
  are needed. Proportionate, or over-explained?
- Anything in the diff that no one reads.

## Frozen (NOT simplification targets)

- The three production lines and the reuse of `.alt-compare-mark`.
- The requirement that *some* pin asserts at two polarities — that is the
  design's central measured finding, not a preference.
- The existence of a bidirectionality log (workflow requirement).

Verdict is advisory (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED —
only BLOCKED escalates). Return severity-tagged, line-cited findings naming the
simpler shape for each.
