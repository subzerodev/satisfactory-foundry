# Simplify review — #144 design (post-convergence, one-shot)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/catalog-staleness/brainstorm-spec.md` (revision r5, correctness converged)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `a40687e`)
**Stage:** design. Correctness converged at r5 after five rounds (fall-through trap, ordering gap, upload race, save race, re-derive gap — all folded). Do NOT re-check correctness.

## Your question

Is this design more complicated than it needs to be — or has five rounds of hardening accreted structure a simpler correct shape would not carry? Angles:

1. The final shape has: a provenance seam, an extracted helper with TWO parameterized hooks (failure fallback + success apply), a detached continuation with a test-visible retained promise, an apply-time guard, AND a module-level save queue. Is each element load-bearing, or is there a simpler shape that satisfies the same pinned invariants (never-evict incl. the save race, set-first latency, offline, test determinism)? Specifically consider: would await-first ordering (block ready on the provenance fetch with a short timeout) delete the detached continuation, the retained promise, the guard, AND the save queue at the cost of one bounded latency hit — and would that trade have been the simpler correct design? Answer honestly; if yes, say so and size the tradeoff rather than deferring to sunk review rounds.
2. Could the save queue REPLACE the apply-time guard (serialization alone might make the guard redundant — or not, since the guard prevents the memory set, not just the row write)? If one subsumes the other, name it.
3. Is the `pendingBundledRefresh` seam avoidable with vitest's own async utilities?

Advisory-with-teeth: verdict does not gate; findings folded or rejected-with-rationale; only BLOCKED escalates. Return your verdict + findings.
