# Simplify review — #142 design (post-convergence, one-shot)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/variable-power/brainstorm-spec.md` (revision r2, correctness converged AWN+AWN)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `016cc54`)
**Stage:** design. Do NOT re-check correctness.

## Your question

Is this the simplest correct shape? Angles:

1. `effectiveMachinePower` as a separate helper vs. folding the recipe override into `machinePowerProjection` itself (one more parameter) — which is genuinely simpler across the three call surfaces?
2. Is the `CATALOG_PARSER_VERSION` bump + optional stored field the minimal persistence change, or is there a lighter path that still reaches cached users?
3. The spec's knock-on inventory (stagePowerOf return widening, ChainCatalog type widening, the adapter recipe binding) — proportionate detail, or over-specification of routine edits?

Advisory-with-teeth: verdict does not gate; findings folded or rejected-with-rationale; only BLOCKED escalates. Return your verdict + findings.
