# #113 packaging intersteps post-simplify correctness review r5

**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-113-intersteps`
**R4 reviewed prompt head:** `f7a0247`
**Current implementation head:** `92a87d8eb9fe3d8faab68cb2d6fbdf9966d8da58`
**R5 delta patch:** `/tmp/satisfactory-foundry-113-diff-r5.patch`
**Frozen design:** `features/packaging-intersteps/brainstorm-spec.md`
**Bidirectional evidence:** `features/packaging-intersteps/r2-verification.log`

## A. Current-state anchors

- R4 returned `NEEDS_REWORK` from both reviewers: spread normalization lost
  inherited/non-enumerable v7 properties, and v3 fields ignored by its
  historical validator leaked into later strict semantics. Both are folded.
- The one-shot simplify pass is complete and must not run again.
- V4-v7 admitted transport extensions and strict closed-world v8 validation
  remain unchanged.

## B. R4 findings and repair claims

1. `createNormalizationView` uses `Object.create(source)` so ordinary property
   lookup, including inherited/non-enumerable fields and array own properties,
   remains visible while the strict core canonicalizer sees a non-array record.
   Nested trips receive the same view. Own overrides use `defineProperty`, so
   inherited non-writable properties cannot block normalization.
2. `migrateV3` now rebuilds each exact link and calls the shared legacy
   canonicalizer with source version 3. That masks `deratePercentText` and
   `sharedEnds`, the two v4-only extensions the v3 validator historically
   ignored, before crossing into v4. V4-v7 calls retain valid derates/shared
   ends.
3. Focused tests cover inherited/non-enumerable v7 belt/pipe/train data, JSON
   v3 ignored extensions, and preservation of the same extensions in v4-v7.
   Confirm they fail on the prior normalization/migration and pass now.
4. Mutation cycles 8 and 9 independently break the two production behaviors,
   capture genuine named Vitest FAIL lines, restore, and rerun green. The report
   accurately lists nine cycles and 1,138 tests.
5. The cumulative #113 feature and all preceding simplify folds remain correct.
   The generalized internal throw label is wording-only.

Fresh parent verification: full Vitest 44 files/1138 tests PASS; packaging CDP
3 geometry + 1 workflow PASS; extraction CDP 9 geometry + 3 interaction PASS;
TypeScript/ESLint/Prettier PASS; Vite/PWA build PASS; `git diff --check
develop...HEAD` PASS.

Review the delta patch and live cumulative source. Return severity-tagged exact
citations and exactly one final contract verdict: `APPROVED`,
`APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
