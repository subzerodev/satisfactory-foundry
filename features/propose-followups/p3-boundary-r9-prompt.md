# Boundary diff review r9 — S21 P3 (#105): one-shot simplify folds

Re-review the cumulative implementation diff in
`features/propose-followups/p3-boundary-r9.diff` for the worktree
`/home/subzerodev/workspace/satisfactory-foundry`.

This is a correctness-only re-run after the one-shot simplify pass. Do not run
or request another simplify review. The review is degraded because the
third-party Claude reviewer is unavailable by user directive. Return exactly
one verdict:

`APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` / `BLOCKED`

with severity-tagged, line-cited findings. Tag the verdict
`(degraded: same-vendor, third-party reviewer unavailable)`.

## Prior convergence and simplify result

- r8 correctness: APPROVED / APPROVED.
- one-shot diff simplify: APPROVED_WITH_NITS, two findings, both folded.

## r9 folds to verify

1. Removed exported `byproductRouteKey`; route construction now directly emits
   `${fromItemId} ${itemId} ${toItemId}`. The route object test still pins the
   exact full key, and all production consumers read `route.key`.
2. `usedTargetLanes` now seeds from `newLinks` rather than existing plus new
   links. Every proposed stage receives a fresh UUID, so existing graph links
   cannot target a proposed stage; accepted byproduct routes still add their
   lane to the set, preserving duplicate-route refusal.
3. No behavior or public consumer was otherwise changed.

## Review focus

- Confirm both simplifications preserve the frozen key and collision contracts.
- Confirm no other caller depended on the removed export.
- Re-check the cumulative implementation against #105.
