# #113 packaging intersteps post-simplify correctness review r3

**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-113-intersteps`
**Base:** `develop` at `289a6e379a18d2a1fc63991a6e8c5f92dd0488b8`
**Correctness-approved pre-simplify head:** `990a83719890584d0b256af81182221022a1141f`
**Current implementation head:** `e3cb88b12a79006ce179ed9ebc97cbff156ea18d`
**Post-simplify delta patch:** `/tmp/satisfactory-foundry-113-post-simplify.patch`
**Frozen design:** `features/packaging-intersteps/brainstorm-spec.md`
**Bidirectional evidence:** `features/packaging-intersteps/r2-verification.log`

## A. Current-state anchors

- The cumulative implementation and both r1 repairs already passed both
  correctness reviewers at r2. The one-shot simplify pass then returned four
  findings; all four were folded in the supplied delta.
- This is a correctness-only rerun. The simplify pass has been consumed and
  must not run again.
- No production behavior was intended to change in this delta. Existing unit,
  DOM, and real-CDP gates are the behavioral contract.

## B. Simplify folds to verify

1. `scripts/browser-check-runtime.mjs` now owns only mechanics genuinely shared
   by both browser gates: free ports, readiness polling, CDP connection/evaluate,
   common key dispatch, navigation/screenshots, and Vite/Chromium lifecycle.
   Confirm both feature scripts retain their distinct interactions, output,
   screenshots, real-CDP input, and reliable cleanup/error propagation.
2. `migrateV7` preserves v7's historical leniency by rebuilding train
   `sharedEnds` from literal `from`/`to === true`, then delegates all transport
   arms to `canonicalizeLinkTransport`. Confirm every v7-valid arm still
   migrates, unknown nested keys are stripped, and strict v8 loading is
   unchanged.
3. `LinkInspector` skips `planForLink` only when an interstep is present and
   still computes the single richer `deriveLinkPlan` projection used by that
   branch. Ordinary missing-item, unsolved, and transport rendering are
   unchanged.
4. The zero-logic `src/data/packaging.ts` facade is deleted and its two callers
   import the same core functions directly. Confirm no stale imports or public
   runtime dependency remain.
5. Confirm the cumulative feature still satisfies the frozen design and that
   the original six mutation cycles in `r2-verification.log` remain applicable.
   This refactor adds no behavior tests, so no new mutation row is expected.

Fresh parent verification at current implementation head: focused 4 files/117
tests PASS; full Vitest 44 files/1135 tests PASS; packaging CDP 3 geometry + 1
workflow PASS; extraction CDP 9 geometry + 3 interaction PASS;
TypeScript/ESLint/Prettier PASS; Vite/PWA build PASS; `git diff --check
develop...HEAD` PASS.

Review the delta patch and live cumulative source. Return severity-tagged exact
citations and exactly one final contract verdict: `APPROVED`,
`APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
