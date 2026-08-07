# Simplify review — S20 P2 (#101) design, post-convergence

Stage: DESIGN. The correctness pair has already converged
(APPROVED_WITH_NITS × 2, nits folded) on
`features/propose-grows-up/p2-brainstorm.md` in the repo at
`/home/subzerodev/workspace/satisfactory-foundry` (develop). Do NOT
re-check correctness. Your one question: **is this design simpler than
it needs to be — and if not, what is the simplest correct shape?**

Scope of the design (two features):
1. Clock-percent target for Propose — core `clockPercent: Fraction =
   100` 7th positional param, exact linear rate scaling; float `≈`
   power (`powerAtClockMw`) via per-stage exponents at ≠100; applied
   graph seeded with the chosen clock text.
2. Byproduct feed suggestions — DISPLAY-ONLY informational lines from a
   pure adapter scan (`byproductSuggestions`); routing already descoped
   to ticket #105 after r1.

Surfaces to pressure for over-engineering:
- Is `powerAtClockMw: number | null` (null at 100) the minimal shape,
  or is a separate nullable field ceremony vs just recomputing where
  rendered?
- Does the (0,250] validation need spec surface, or does the existing
  rate-input error idiom already cover it?
- Is the suggestion payload (`{itemId, rate, fromItemId, toItemId,
  toItemName}`) wider than a display-only line needs?
- Any residual spec surface that only served the removed routing
  feature and can now be deleted?
- Anything the spec builds that an existing helper already provides
  (within the frozen constraint that `subtreePowerText` reuse is
  FORBIDDEN for the ≠100 power sum — that ban is correctness-driven,
  not yours to relax).

Already-settled (not simplification targets): the #105 descope; the
7th-positional-param disposition; the epic's byte-stable-at-100 pin;
the exact-Fraction/float-≈ discipline.

Verdict is advisory (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED — only BLOCKED escalates). Return severity-tagged, line-cited
findings naming the simpler shape for each.
