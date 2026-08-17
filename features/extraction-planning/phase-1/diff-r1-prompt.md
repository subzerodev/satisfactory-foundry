# #112 Phase 1 cumulative implementation review r1

Review the cumulative diff `develop...HEAD` in:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-112-extraction-p1-design`.

## A. Current-state anchors

- Frozen design: `features/extraction-planning/phase-1/brainstorm-spec.md` r6.
- Frozen implementation plan: `implementation-plan.md` r8.
- Evidence: `r2-verification.log` and `completion-report.md`.
- Phase 2 purity mixing and map-specific Resource Well allocation are out of
  scope. Phase 1 must remain Normal-purity requirement-first.

## B. Claims to verify

1. Extractors come only from structured Docs fields. Rates, topology, forms,
   strict textual booleans, restricted raw references, source-order independence,
   null-prototype maps, cache v6, and prototype-member misses are all honest.
2. Exact derivation validates standalone topology and current-item membership
   before arithmetic; count/supply/spare are `Fraction`-exact, power uses the
   existing labeled approximation boundary, and transport compares one extractor
   output to one line. Above-top-tier output retains the plan with a hard warning.
3. Plan v6 makes `userPlaced` required and materializes v1-v5 origin before any
   rewrite. Save/load, import, bundle import, rename/save-over, export, and list
   paths all preserve placement and extraction intent. `constructor` raw-item
   keys are own-property-safe. No transient `wasV5` path remains.
4. Raw nodes carry exact `Fraction` demand plus stage/item identity. GraphCanvas
   stores only open identity and re-resolves live demand; display text is never
   parsed. XYFlow wrapper flags and the inner native button preserve raw-node
   graph invariants.
5. The production panel visibly says Normal purity, persists extractor/clock
   edits and Water/Oil first-open defaults, handles unavailable selections and
   Nitrogen/Resource Wells explicitly, and implements close/disappearance/
   replacement focus lifecycle without stale restoration.
6. Notice and extraction share the production top-right stack. The checked-in
   Chromium/CDP harness measures an exact 340px canvas at 360/720 widths with
   actual control chrome and exercises browser-native activation.
7. `r2-verification.log` contains five genuine post-code break/restore probes
   with named FAIL lines and restored green runs.

Independent pre-review verification: 39 files and 1022/1022 tests passed;
`npm run check`, `npm run build`, `git diff --check develop...HEAD`, six browser
geometry rows, and the interaction row passed. Inspect source and tests rather
than trusting these claims.

Return severity-tagged exact file:line findings and exactly one verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
