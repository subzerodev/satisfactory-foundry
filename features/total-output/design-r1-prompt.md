# Design review r1 — #111 cost-sheet total OUTPUT

Worktree: `/home/subzerodev/workspace/satisfactory-foundry`
Artifact under review:
`/home/subzerodev/workspace/satisfactory-foundry/features/total-output/brainstorm-spec.md`

Reviewer mode: degraded same-vendor. Apply your assigned reviewer role exactly;
return one of `APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED` as
the final line. Verify citations against the live worktree before relying on
them.

## A. Current-state anchors to verify

1. `src/ui/ChainBuilder.tsx` renders the cost sheet as `Σ POWER`, `Σ MACHINES`,
   and `RAW` inside `.chain-builder-metrics`.
2. `src/ui/chain-builder-adapter.ts` exposes `PreviewRow.outputRate`, formatted
   exactly, and rows are depth-sorted with `depth === 0` meaning the target row.
3. `src/core/chain-builder.ts` computes `outputRate` from ceil'd machine counts,
   so actual output may overshoot the requested rate.
4. `ChainBuilder.tsx` does not re-propose on Rate text edits; the live input can
   drift from the preview. The preview already snapshots `clockText` for this
   class of problem.
5. Byproducts already render separately beneath the preview; #105 owns explicit
   byproduct routing.
6. `ChainBuilder.rawtarget.test.tsx` pins the accepted behavior that an all-raw
   target drops the typed rate line.

## B. Proposed design to review

Add an `OUTPUT` metric after `RAW`.

- Store the requested rate used by the current preview as `Preview.rateText =
  formatRate(parsed.value)`.
- Format the target output from the `depth === 0` preview row:
  - no row -> `"—"`;
  - actual equals requested -> `"<actual>/min"`;
  - actual differs -> `"<actual>/min (asked <requested>/min)"`.
- Keep the metric inside the existing non-empty cost-sheet block; raw targets
  still show no cost sheet.
- Do not fold byproducts into the OUTPUT metric.

## C. Review focus

- Is the snapshot-rate design necessary, or can the requested value be safely
  sourced elsewhere?
- Is `depth === 0` the right target-row selection, or is there a more robust
  existing identifier?
- Does the design preserve the raw-target behavior and avoid #105 byproduct
  routing semantics?
- Does the test plan close both exact-output and overshoot cases?
