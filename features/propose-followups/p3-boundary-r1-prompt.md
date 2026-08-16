# Boundary diff review r1 — S21 P3 (#105): explicit byproduct routing

Review the cumulative implementation diff in
`features/propose-followups/p3-boundary-r1.diff` for the worktree
`/home/subzerodev/workspace/satisfactory-foundry`.

This review is degraded because the third-party Claude reviewer is unavailable
by user directive. You are a fresh Codex agent copying the requested reviewer
role. Return exactly one verdict:

`APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` / `BLOCKED`

with severity-tagged, line-cited findings. Tag your verdict as
`(degraded: same-vendor, third-party reviewer unavailable)`.

## Contract to check

Design of record: `features/propose-followups/p3-brainstorm.md` v5.

Required behavior:

1. `ChainProposal.byproducts` carries `fromItemId`; existing aggregate display
   suggestions remain source-agnostic and unique on `(itemId,toItemId)`.
2. `byproductRouteSuggestions` emits route controls only for unambiguous rows:
   one source, one consumer, no primary-lane collision, no self-route, no
   multi-source aggregate, and no source fan-out. Route keys are
   `(fromItemId,itemId,toItemId)`.
3. `applyChainProposal` uses one options-bag API. It seeds clock from
   `clockPercentText`, defaults to `"100"`, and validates selected byproduct
   routes against the explicit `catalog` snapshot, not the live store catalog.
4. Store apply refuses routes with missing catalog snapshots, unresolved
   endpoints, source recipes that do not output the item, consumer recipes that
   do not input the item, self-routes, duplicate target lanes, and repeated
   source spending; primary proposal stages/links still apply.
5. `ChainBuilder` derives display suggestions, route controls, selected-route
   filtering, and Apply payloads from `preview.gated`; Apply clears the preview
   and selected route keys.
6. Byproduct routing does not implement demand feedback, aggregate lanes,
   silent auto-routing, or persistence across Discard/session.

## Verification already run

- `npm test -- --run src/core/chain-builder.test.ts src/ui/chain-builder-adapter.test.ts src/state/store.test.ts src/ui/ChainBuilder.byproduct-routing.test.tsx`
  - PASS: 4 files, 291 tests.
- `npm run check`
  - PASS: `tsc -b`, `eslint .`, `prettier --check src`.
- `npm test`
  - PASS: 35 files, 930 tests.
- Bidirectionality log:
  `features/propose-followups/p3-verification.log`
  - removing source fan-out suppression fails adapter tests;
  - removing duplicate target-lane refusal fails store tests;
  - removing source-output validation fails store tests.

## Review focus

- Hunt for any way a selected byproduct route can still materialize a duplicate
  or dangling `StageLink`.
- Verify `preview.gated` is used for route display/routeability/apply filtering,
  not the live ungated catalog.
- Check the options-bag migration did not break default or non-default clock
  seeding.
- Check tests are discriminating and not pass-either-way.
