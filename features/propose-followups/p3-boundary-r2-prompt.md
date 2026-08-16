# Boundary diff review r2 — S21 P3 (#105): test fold

Re-review the cumulative implementation diff in
`features/propose-followups/p3-boundary-r2.diff` for the worktree
`/home/subzerodev/workspace/satisfactory-foundry`.

This review is degraded because the third-party Claude reviewer is unavailable
by user directive. You are a fresh Codex agent copying the requested reviewer
role. Return exactly one verdict:

`APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` / `BLOCKED`

with severity-tagged, line-cited findings. Tag your verdict as
`(degraded: same-vendor, third-party reviewer unavailable)`.

## Prior r1 verdicts

- code-reviewer: APPROVED_WITH_NITS — route-specific jsdom suite covered only
  the happy path; stale-selection rows from the frozen design were not pinned.
- adversarial-reviewer: NEEDS_REWORK — the store repeated-source-spend test sent
  the same route twice, so duplicate target-lane refusal masked the source-spend
  guard. Also NIT: missing jsdom stale-route coverage.

## r2 fold to verify

1. `src/state/store.test.ts` route fixture now includes a second Resin consumer
   (`paint`), and the repeated-source-spend case sends `fuel/resin` to both
   `rubber` and `paint`. Removing `usedSourceOutputs` now fails that test.
2. `src/ui/ChainBuilder.byproduct-routing.test.tsx` adds a stale-selection row:
   check ROUTE, switch the catalog to a fan-out variant, re-propose, assert the
   route checkbox disappears, Apply, and assert no `resin` route was written.
3. Verification log records the corrected source-spend mutation probe.

## Verification after fold

- `npm test -- --run src/core/chain-builder.test.ts src/ui/chain-builder-adapter.test.ts src/state/store.test.ts src/ui/ChainBuilder.byproduct-routing.test.tsx`
  - PASS: 4 files, 291 tests.
- `npm run check`
  - PASS: `tsc -b`, `eslint .`, `prettier --check src`.
- `npm test`
  - PASS: 35 files, 930 tests.

## Review focus

- Confirm the source-spend test no longer passes through the duplicate
  target-lane guard.
- Confirm the jsdom stale-selection row actually exercises re-propose filtering
  and would fail if selected route keys were not intersected with current
  routeable rows.
- Check no production behavior changed beyond the r1 implementation.
