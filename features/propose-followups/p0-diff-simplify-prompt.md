# Simplify review — S21 P0 (#104) diff, post-convergence

Stage: DIFF. The correctness pair has converged (boundary r2:
APPROVED_WITH_NITS ×2) on the cumulative diff of branch feature/s21-p0
over develop, in the worktree
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s21-p0`
(`git diff develop...HEAD`). Do NOT re-check correctness. Your one
question: **is this implementation simpler than it needs to be — and if
not, what is the simplest correct shape?**

What the diff does: adds one guard clause to `causeOf` in
`chain-builder-adapter.ts` so a raw-flagged item with no eligible producer
under EITHER the default-policy constant OR the live exclusions classifies
`"natural"` instead of `"constrained"`; updates five invariant comments;
amends one pinned test; adds adapter + UI tests and a bidirectionality log.

Surfaces to pressure:
- **The predicate itself** — three clauses, two of them near-identical
  `producerRecipesFor` calls differing only in the exclusion set. Is there a
  simpler expression with the same semantics? (The conjunction is
  correctness-frozen — two single-keyed rules were killed by counterexample
  during design — so do NOT propose collapsing it to one clause or to the
  union. But the *expression* is fair game.)
- **Comment volume.** The change is ~5 lines of logic and a large amount of
  prose across five comment sites plus a 160-line log. Is any of it
  redundant with another site, or with the frozen spec it restates?
- **Test structure** — adapter rows + a new UI test file. Any row that
  re-pins what another already pins? Is a separate `ChainBuilder.rawtarget.
  test.tsx` file warranted, or does it belong beside the existing UI tests?
- Anything built that no consumer reads.

Frozen (NOT simplification targets): the conjunction's semantics; the
alternate-inclusive `producerRecipesFor`; the load-bearing test pair (one
row kills each dead rule); the accepted "Nothing to build" UI change.

Verdict is advisory (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED — only BLOCKED escalates). Return severity-tagged, line-cited
findings naming the simpler shape for each. Do NOT spawn nested agents.
