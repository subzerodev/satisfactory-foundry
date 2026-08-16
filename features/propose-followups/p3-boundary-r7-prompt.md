# Boundary diff review r7 — S21 P3 (#105): catalog-replacement Apply guard

Re-review the cumulative implementation diff in
`features/propose-followups/p3-boundary-r7.diff` for the worktree
`/home/subzerodev/workspace/satisfactory-foundry`.

This review is degraded because the third-party Claude reviewer is unavailable
by user directive. You are a fresh Codex agent copying the requested reviewer
role. Return exactly one verdict:

`APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` / `BLOCKED`

with severity-tagged, line-cited findings. Tag your verdict as
`(degraded: same-vendor, third-party reviewer unavailable)`.

## Prior r6 verdicts

Both reviewers returned NEEDS_REWORK: a successful Docs re-upload can replace
the live base catalog while a preview remains mounted, allowing Apply to
validate routes against old `preview.gated` but derive stages against the new
store catalog.

## r7 fold to verify

1. `Preview.sourceCatalog` retains the exact base catalog object passed to the
   successful `repropose` that created the preview.
2. `onApply` compares the current live base catalog with that identity before
   deriving route payloads or calling the store.
3. On mismatch, Apply writes no graph state, clears the preview/selected routes,
   and shows `catalog changed; propose again`.
4. Tier gating does not trigger the guard: gated catalogs may be derived copies,
   but `sourceCatalog` remains the stable ungated base object.
5. The red-first jsdom row replaces the live catalog after checking a route and
   proves stage order and links remain unchanged.

## Review focus

- Confirm Apply cannot mix catalog worlds after replacement.
- Confirm normal Apply and tier-gated previews remain unaffected.
- Check whether every preview construction path sets the base identity.
- Re-check the cumulative implementation and verification log against #105.
