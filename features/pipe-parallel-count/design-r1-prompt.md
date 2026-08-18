# Review request — #145 design (r1): pipe parallelCount suppression

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/pipe-parallel-count/brainstorm-spec.md` (uncommitted)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `adb9979`)
**Stage:** design (Tier 2). No diff yet.

## A. Current-state anchors — verify against live source

- `src/core/manifold.ts:417-443` — feed-side `peakFlow`/`bundleEligible`/`parallelCount`/`segment-over-capacity` block. The spec claims the entire fix is one predicate change there.
- `src/core/manifold.ts:559-575` — output-side segments hardcode `parallelCount: 1`; finding on undersize override only.
- Non-test `parallelCount` consumers: `Schematic.tsx:81,165-183`, `ui/layout.ts:84,238,267`, `layout/layout.ts:207`, `format.ts:135-144`, `SummaryCards.tsx:33`.
- `segment-over-capacity` consumers: `FindingsPanel.tsx:57,74,86`, `format.ts:156`, `Schematic.tsx:53,64`, `ui/layout.ts:108`.
- Settled context: ticket #145; gap-report W3(b) @ `ae266b1`; #140 decisions 24742 (belt x2 is the arc's job) and 24760 (this fix, standalone, now).

## B. Claims to verify

1. **D1's one-line claim.** Is `const bundleEligible = lane.kind === "belt" && belt.capacity.lte(B)` genuinely sufficient — does the existing `!bundleEligible && peakFlow.gt(B)` branch then emit the finding for pipes with NO other change? Walk all four consequence cases the spec lists, against the real code. Especially: does an over-peak pipe segment still push the segment itself (with parallelCount 1) so the UI can mark it errored?
2. **The comment above the block** (`manifold.ts:418-421`) describes the bundle rationale — does D1 need to update it (a stale comment about "a normal incoming slot fits one unlocked line" that no longer distinguishes kind would be misleading)? The spec does not mention the comment: is that an omission?
3. **D3's consumer sweep.** Verify each listed consumer really is generic over the value. Is any pipe-styling path (e.g. `Schematic.tsx` lane-pipe classes, `Blueprint.tsx` bp-bus-pipe) coupled to parallelCount in a way the sweep missed?
4. **D4's no-persistence claim** — solve results derived, never stored. Verify against `plan-store.ts` (NUL byte — use `grep -a`).
5. **Belt byte-identity.** Is there any belt input where adding the `lane.kind === "belt"` conjunct changes evaluation order/short-circuit in an observable way? (It shouldn't — but confirm `lane.kind` is always defined at that point.)
6. Does the spec re-litigate anything settled (the belt x2 redesign, the standalone landing)?

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
