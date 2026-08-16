# #112 Phase 1 implementation-plan review r2

Review `features/extraction-planning/phase-1/implementation-plan.md` in:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-112-extraction-p1-design`.

R1 returned `NEEDS_REWORK` / `NEEDS_REWORK`. R2 folds every finding:

1. Every production boundary now has an exact focused red command and named
   expected failure before implementation.
2. Parser rows include malformed cycle values and reversed extractor-before-
   descriptor fixtures for unrestricted and restricted applicability.
3. Catalog cache round-trip/version-6 stale tests run red before cache edits.
4. V5 migration pins mixed explicit-true/absent `userPlaced` to required
   true/false through all immediate rewrites.
5. Raw-card interaction/lifecycle tests run red before component edits.
6. The panel contract pins a labeled non-modal dialog and accessible icon close.
7. A checked-in dependency-free Node/CDP harness starts Vite and system Chromium,
   asserts six 360/720x340 geometry states, saves screenshots, and cleans up.

Recheck the full plan against the frozen r6 design and live source. Return
line-cited BLOCKER/IMPORTANT/NIT findings and exactly one verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
