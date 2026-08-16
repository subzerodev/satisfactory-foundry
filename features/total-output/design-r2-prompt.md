# Design review r2 — #111 cost-sheet total OUTPUT

Worktree: `/home/subzerodev/workspace/satisfactory-foundry`
Artifact under review:
`/home/subzerodev/workspace/satisfactory-foundry/features/total-output/brainstorm-spec.md`

Reviewer mode: degraded same-vendor. Apply your assigned reviewer role exactly;
return one of `APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED` as
the final line. Verify citations against the live worktree before relying on
them.

## A. r1 findings to verify folded

Both correctness reviewers returned `NEEDS_REWORK` on the same IMPORTANT:

- v1 correctly said live `rateText` is unsafe after editing Rate without Propose,
  but its test plan never required a drift test, so an implementation comparing
  against live `rateText` could pass the initial render tests.

v2 fold:

- `features/total-output/brainstorm-spec.md` now requires a jsdom drift test:
  propose a non-divisible rate, edit the Rate input without pressing Propose
  again, and assert OUTPUT still compares against the original requested-rate
  snapshot.
- Revision history records this fold.

## B. Current-state anchors still in scope

1. `src/ui/ChainBuilder.tsx` renders the cost sheet as `Σ POWER`, `Σ MACHINES`,
   and `RAW` inside `.chain-builder-metrics`.
2. `PreviewRow.outputRate` is existing exact display data; rows are depth-sorted
   with `depth === 0` target.
3. Machine counts are ceil'd, so actual output may overshoot requested rate.
4. Rate edits update only live state until Propose runs again, so the solved
   requested rate must be snapshotted.
5. Byproducts stay separate; #105 owns routing semantics.

## C. Review focus

Please focus on whether v2 fully closes the r1 test-plan gap and whether any
other design issue remains.
