# #112 Phase 1 design correctness review r4

Review the current candidate and manifest in:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-112-extraction-p1-design/features/extraction-planning`.

R3 returned `NEEDS_REWORK` / `NEEDS_REWORK`. R4 folds both findings:

1. `PlanStageV6.userPlaced` is a required boolean. Every v1-v5 migration
   materializes the correct explicit value before any import/rename/save/export
   rewrite, and rebuild no longer depends on a transient source-version flag.
2. The top-right stack is height-bounded with internal scroll: 260px desktop,
   220px at <=720px after top clearance. The 360/720 x 340 browser gate includes
   chain power and verifies no top-left, bottom-left, or bottom-right overlap.

Recheck the full candidate, all prior folded findings, migration rewrite paths,
responsive geometry, structured extraction data/math, Resource Well honesty,
and Phase 2 deferral.

Return line-cited BLOCKER/IMPORTANT/NIT findings and exactly one verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
