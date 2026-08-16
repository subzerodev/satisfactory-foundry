# Boundary diff review r3 — S21 P3 (#105): stale-selection fold

Re-review the cumulative implementation diff in
`features/propose-followups/p3-boundary-r3.diff` for the worktree
`/home/subzerodev/workspace/satisfactory-foundry`.

This review is degraded because the third-party Claude reviewer is unavailable
by user directive. You are a fresh Codex agent copying the requested reviewer
role. Return exactly one verdict:

`APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` / `BLOCKED`

with severity-tagged, line-cited findings. Tag your verdict as
`(degraded: same-vendor, third-party reviewer unavailable)`.

## Prior r2 verdicts

- code-reviewer: NEEDS_REWORK — the stale-selection jsdom row clicked the
  manual `Propose` button, whose `onPropose` path clears `selectedRouteKeys`
  before `repropose`; it did not prove the intersection inside `repropose`.
- adversarial-reviewer: APPROVED_WITH_NITS — same gap from a different angle:
  Apply independently rebuilds current routeable rows, so the old row did not
  pin private stale selection state.

## r3 fold to verify

`src/ui/ChainBuilder.byproduct-routing.test.tsx` now drives a non-resetting
auto-repropose path:

1. Check `route Resin from Fuel to Rubber`.
2. Swap the store catalog to a fan-out variant.
3. Toggle the machine exclusion, which calls `repropose` without the manual
   `onPropose` selected-key reset, and assert the route checkbox disappears.
4. Swap the catalog back, toggle the machine exclusion again, and assert the
   restored route checkbox is **unchecked** before Apply.
5. Apply and assert no stale `resin` route is written.

The verification log records the mutation probe: removing
`setSelectedRouteKeys(...filter...)` makes this row fail because the restored
route checkbox remains checked.

## Verification after fold

- `npm test -- --run src/ui/ChainBuilder.byproduct-routing.test.tsx`
  - PASS: 1 file, 2 tests.
- Mutation probe:
  - Removed `setSelectedRouteKeys(...filter...)`.
  - `npm test -- --run src/ui/ChainBuilder.byproduct-routing.test.tsx`
    failed at `src/ui/ChainBuilder.byproduct-routing.test.tsx:287` with the
    restored route checkbox still checked.
  - Restored the intersection and reran the suite green.

## Review focus

- Confirm the stale-selection row now exercises a re-propose path that does not
  pre-clear selected route keys.
- Confirm it would fail if the selected-key intersection in `repropose` were
  removed.
- Check the fold did not change production behavior beyond test coverage.
