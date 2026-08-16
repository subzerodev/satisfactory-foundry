# Boundary diff review r4 — S21 P3 (#105): frozen test-contract fold

Re-review the cumulative implementation diff in
`features/propose-followups/p3-boundary-r4.diff` for the worktree
`/home/subzerodev/workspace/satisfactory-foundry`.

This review is degraded because the third-party Claude reviewer is unavailable
by user directive. You are a fresh Codex agent copying the requested reviewer
role. Return exactly one verdict:

`APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` / `BLOCKED`

with severity-tagged, line-cited findings. Tag your verdict as
`(degraded: same-vendor, third-party reviewer unavailable)`.

## Prior r3 verdicts

- code-reviewer: APPROVED — no findings.
- adversarial-reviewer: APPROVED_WITH_NITS:
  1. direct self-route suppression lacked adapter coverage;
  2. the frozen jsdom plan's same-display/source-change and failed-tier-
     repropose cases were absent.

## r4 folds to verify

1. `src/ui/chain-builder-adapter.test.ts` now directly pins a byproduct route
   back into its source stage as suppressed. Removing the self-route guard
   exposes `fuel resin fuel` and fails the named row.
2. `src/ui/ChainBuilder.byproduct-routing.test.tsx` now changes a route's source
   from Fuel to Plastic while retaining the display key `(Resin,Rubber)`, then
   restores Fuel and proves the old full route key was dropped.
3. Separate jsdom rows make a tier re-propose fail on invalid Rate and prove
   route labels and routeability remain derived from `preview.gated`, even when
   the live catalog changes names or removes the consumer input.
4. `features/propose-followups/p3-verification.log` records genuine named
   Vitest failures for all three production guards and the restored green run.

## Review focus

- Confirm each r3 nit is fully folded and mutation-sensitive.
- Confirm the new fixtures exercise public UI behavior rather than private
  implementation state.
- Check the cumulative implementation against the frozen design and issue #105.
- Confirm no production behavior changed in this fold.
