# Boundary review r2 (delta-scoped) — S20 P2 (#101)

Re-review after the r1 fold. Worktree:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s20-p2`
(branch feature/s20-p2, now 6 commits over develop at 2ea95c0).

At r1: code-reviewer APPROVED (0); adversarial NEEDS_REWORK with ONE
MAJOR — stale-clock at Apply (`onApply` read the LIVE `clockText`, so
propose@100 → edit input to 150 → Apply seeded stages at 150 with
100-sized counts). Everything else was verified airtight by both.

## The delta (the ONLY change since the r1 diff you reviewed)

Commit db5cb68, 12+/4- in `src/ui/ChainBuilder.tsx` only:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s20-p2/features/propose-grows-up/p2-boundary-r2-delta.diff`
(cumulative diff, if needed: `p2-boundary-r2.diff`, 1328 lines)

Fix direction (a) from the r1 finding: `Preview` gains `clockText` (the
raw text the proposal was SOLVED at, captured in `repropose`'s
`setPreview`); `onApply` seeds `applyChainProposal(preview.proposal,
preview.clockText)` — the snapshot, never the live input. Comments
updated to state the snapshot invariant.

## Your question

Does the snapshot fix close the MAJOR without opening a new hole?
- `repropose` captures the SAME `clockText` state it just validated and
  solved with (`parsedClock` derives from it in the same closure) — can
  snapshot and solve ever disagree?
- Control-change re-proposes (overrides/raw/exclusions) run with the
  CURRENT clock text — after one, the preview and snapshot both reflect
  the live clock. Consistent?
- Discard/Apply clear the preview; the next Propose revalidates. Any
  path where a stale snapshot survives into a fresh preview?
- Team lead re-verified 834/834 green + `npm run check` clean post-fix.

Everything else was approved at r1 — do not re-litigate it. Return
exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with line-cited findings.
