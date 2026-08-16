# Design review r2 - parallel feed bus bundles (#120)

Worktree: `/home/subzerodev/workspace/satisfactory-foundry`

Artifact: `features/parallel-feed-belts/brainstorm-spec.md` (v2)

## Delta from rejected v1

V1 proposed 18 independent whole-machine feed spans. Both correctness
reviewers returned NEEDS_REWORK: it changed persisted override meaning,
under-specified negative/zero handling and observable peak changes, and omitted
pipe/multi-feed tests. Independent investigation found the smaller compatible
model in v2: preserve the existing 17 feed loads and add exact parallel bus
cardinality. Negative handling is split to dependency #121.

## Settled user decision

Michael's 106-Refinery Wet Concrete factory is buildable at Mk5 by using more
parallel belts; Mk6 is optional. Do not re-litigate this.

## Current anchors

- `src/core/manifold.ts`: `BusSegment`, feed combination/walk, output walk.
- `src/ui/Schematic.tsx`, `src/ui/format.ts`, `src/ui/SummaryCards.tsx`,
  `src/ui/layout.ts`: detailed segment consumers.
- `src/layout/layout.ts`, `src/ui/Blueprint.tsx`: physical Blueprint lane model.
- `src/ui/LaneOverrides.tsx`, `src/state/store.ts`, `src/data/plan-store.ts`:
  override wording and persistence.

## Review mandate

1. Recalculate the exact 17-feed/eight-bundle result.
2. Attack `parallelCount=max(1,ceil(peak/B))`, including zero, epsilon,
   overrides, pipes, huge exact values, and safe narrowing.
3. Verify removing feed-side over-capacity findings does not legalize a truly
   impossible topology or weaken starvation/single-machine guards.
4. Verify load override and saved-plan semantics are preserved.
5. Check every derived-data consumer and whether Schematic/Blueprint labels are
   sufficient to make the physical topology honest without unstable geometry.
6. Confirm output behavior is fully insulated.
7. Check dependency #121 is sufficient and no finding from r1 is silently lost.

Return severity-tagged, file/line-cited findings and exactly one final verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
