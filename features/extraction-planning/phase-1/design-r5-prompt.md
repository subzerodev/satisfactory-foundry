# #112 Phase 1 design correctness review r5

Review the current candidate and manifest in:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-112-extraction-p1-design/features/extraction-planning`.

R4 returned `APPROVED` / `NEEDS_REWORK`. R5 folds both adversarial findings:

1. Candidate filtering and persisted-selection validation both require
   `topology === "standalone"` before count/power derivation. An imported Water
   or Oil Resource Well selection gets the explicit unavailable topology result;
   a focused pure-derivation test pins no count/supply/power.
2. Every planned panel result visibly labels `Purity Normal`, including the
   worked example and UI test contract, so Phase 1 does not present its counts
   as purity-independent.

Recheck the full candidate, all prior folded findings, migration rewrite paths,
responsive geometry, structured extraction data/math, Resource Well honesty,
visible purity semantics, and Phase 2 deferral.

Return line-cited BLOCKER/IMPORTANT/NIT findings and exactly one verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
