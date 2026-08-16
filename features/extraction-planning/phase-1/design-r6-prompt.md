# #112 Phase 1 design correctness review r6

Review the current candidate and manifest in:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-112-extraction-p1-design/features/extraction-planning`.

R5 returned `NEEDS_REWORK` / `APPROVED_WITH_NITS`. R6 folds every finding:

1. Persisted-selection validation now requires both standalone topology and
   membership of the current raw item in `itemIds` before count, transport, or
   power derivation. A focused cross-item test pins Oil Extractor persisted for
   Water as unavailable with no derived result.
2. The candidate heading and FEATURE review-prompt link now identify r6.

Recheck the full candidate, all prior folded findings, migration rewrite paths,
responsive geometry, structured extraction data/math, Resource Well honesty,
visible purity semantics, selected-extractor applicability, and Phase 2
deferral.

Return line-cited BLOCKER/IMPORTANT/NIT findings and exactly one verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
