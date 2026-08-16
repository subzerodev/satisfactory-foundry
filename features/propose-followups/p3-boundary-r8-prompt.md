# Boundary diff review r8 — S21 P3 (#105): tier-gated Apply pin

Re-review the cumulative implementation diff in
`features/propose-followups/p3-boundary-r8.diff` for the worktree
`/home/subzerodev/workspace/satisfactory-foundry`.

This review is degraded because the third-party Claude reviewer is unavailable
by user directive. You are a fresh Codex agent copying the requested reviewer
role. Return exactly one verdict:

`APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` / `BLOCKED`

with severity-tagged, line-cited findings. Tag your verdict as
`(degraded: same-vendor, third-party reviewer unavailable)`.

## Prior r7 verdicts

Both reviewers returned APPROVED_WITH_NITS on one shared test gap: the base
catalog replacement guard was correct, but no non-null-tier Apply test proved a
derived gated catalog would not be mistaken for a replacement.

## r8 fold to verify

1. The new jsdom row proposes at tier `null`, successfully re-proposes at tier
   `0` (creating a derived `preview.gated` object), selects the route and applies
   it.
2. The resulting graph contains the Resin route from Fuel to Rubber and no
   catalog-change error.
3. Mutating the guard to compare `catalog !== preview.gated` makes the named row
   fail; restoring `catalog !== preview.sourceCatalog` returns it green.
4. The prior catalog-replacement refusal row remains green.

## Review focus

- Confirm the shared r7 nit is fully and mutation-sensitively folded.
- Confirm base identity remains distinct from the tier-gated snapshot.
- Re-check the cumulative implementation and verification log against #105.
