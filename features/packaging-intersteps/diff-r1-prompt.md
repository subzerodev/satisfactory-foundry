# #113 packaging intersteps cumulative diff review r1

**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-113-intersteps`
**Base:** `develop` at `289a6e379a18d2a1fc63991a6e8c5f92dd0488b8`
**Head:** `4a79317ca8f7de06855b63a3f1aa282631b5d69f`
**Cumulative patch:** `/tmp/satisfactory-foundry-113-diff-r1.patch`
**Frozen design:** `features/packaging-intersteps/brainstorm-spec.md`
**Implementation plan:** `features/packaging-intersteps/implementation-plan.md`
**Bidirectional evidence:** `features/packaging-intersteps/r2-verification.log`

## A. Current-state anchors

- Existing material reconciliation stays in original link-item units; the new
  interstep finding may coexist with the material finding.
- `LinkTransport` and raw trip text now have one core owner.
- Plan v7 validation is historical behavior; plan v8 is the new closed-world
  raw-intent format and all current writers emit v8.
- `LinkInspector` remains the selected-edge transport home and material apply
  uses the original under-supply finding.

## B. Diff claims to verify

1. Pair discovery is exact-IO based, finds the 12 bundled Packager pairs, rejects
   ambiguity/incompleteness, and persists only packageRecipeId.
2. `deriveLinkPlan` preserves separate material and cargo units, exact Water and
   Nitrogen ratios, safe machine counts, clock/power behavior, and route-local
   transport errors.
3. V7->v8 migration canonicalizes all legacy transport arms; v8 rejects unknown
   or misplaced structure while retaining editable numeric text. Every public
   store action leaves a v8-saveable state and stale intent remains disableable.
4. Material and interstep diagnostics coexist. Problem styling wins without
   hiding fluid-unit shortage/surplus/dangling text; apply remains under-supply
   specific.
5. Forward packaged cargo and empty containers have independent solid route
   math, chips, train findings, controls, and physical-side sharedEnds.
6. The inspector covers enable/pair/clock/disable, stale and missing-item
   recovery, exact counts/power/flows, real labels/keyboard operation, and mobile
   containment. Propose and graph stages remain unchanged.
7. Browser evidence uses real production controls and CDP input, not direct DOM
   value assignment. The four mutation cycles in `r2-verification.log` must each
   contain a genuine named Vitest FAIL after the cited production break and a
   green restore.

Fresh parent verification: packaging CDP 3 geometry + full workflow PASS;
extraction CDP 9 geometry + 3 interaction PASS; Vitest 44 files/1127 tests PASS;
TypeScript/ESLint/Prettier PASS; Vite/PWA build PASS; `git diff --check` PASS.

Review the cumulative patch and live source, not commit summaries. Return
severity-tagged exact citations and exactly one final contract verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
