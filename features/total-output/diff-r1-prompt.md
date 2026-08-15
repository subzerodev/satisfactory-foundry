# Diff review r1 — #111 cost-sheet total OUTPUT

Worktree: `/home/subzerodev/workspace/satisfactory-foundry`
Cumulative diff under review:
`/home/subzerodev/workspace/satisfactory-foundry/features/total-output/diff-r1.diff`

Reviewer mode: degraded same-vendor. Apply your assigned reviewer role exactly;
return one of `APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED` as
the final line. Verify cited source against the live worktree before relying on
it.

## A. Current-state anchors

1. #111 asks for the output side of the cost sheet: an OUTPUT total like the RAW
   input line.
2. The useful value is actual solved output, not just the typed request, because
   machine counts are ceil'd and can overshoot.
3. Rate edits do not re-propose automatically; the preview must compare against
   the requested-rate snapshot it was solved with.
4. Raw targets keep the existing no-cost-sheet empty behavior.
5. Byproducts stay on their separate existing line; #105 owns routing semantics.

## B. What changed

1. `ChainBuilder.tsx` exports `totalOutputText`, snapshots `Preview.rateText`,
   and renders an `OUTPUT` metric after `RAW`.
2. The metric reads `totalOutputText(view.rows, preview.rateText)`, not live
   `rateText`.
3. `ChainBuilder.test.tsx` adds pure helper pins for exact output, overshoot, and
   missing target row.
4. `ChainBuilder.output.test.tsx` adds a jsdom real-catalog render pin:
   proposing Iron Plate at `61/min` renders `80/min (asked 61/min)`, then editing
   Rate to `999` without Propose keeps the original `asked 61` snapshot.
5. `features/total-output/r2-verification.log` records bidirectionality by
   mutating the render to live `rateText`; the new jsdom test fails with
   `asked 999`.

## C. Pre-review hygiene already run

```text
npm run check
tsc -b && eslint . && prettier --check src
All matched files use Prettier code style!

npm test
Test Files  34 passed (34)
Tests  922 passed (922)
```

## D. Review focus

- Confirm the OUTPUT metric uses the solved preview's requested-rate snapshot,
  not live input state.
- Confirm `depth === 0` target-row selection is sound for this display.
- Confirm exact-output and overshoot formats are both pinned.
- Confirm raw-target and byproduct behavior did not move into this feature.
- Confirm the bidirectionality log contains a real failure line for the new
  render test.
