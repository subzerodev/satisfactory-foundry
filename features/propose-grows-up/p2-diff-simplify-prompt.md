# Simplify review — S20 P2 (#101) diff, post-convergence

Stage: DIFF. The correctness pair has converged (boundary r1 APPROVED +
NEEDS_REWORK→folded; r2 APPROVED × 2) on the cumulative diff of branch
feature/s20-p2 over develop, in the worktree
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s20-p2`.
Diff: `features/propose-grows-up/p2-boundary-r2.diff` (1328 lines; or
`git diff develop...HEAD`). Do NOT re-check correctness. Your one
question: **is this implementation simpler than it needs to be — and if
not, what is the simplest correct shape?**

What the diff builds (frozen v4 design): core `clockPercent` 7th param
with exact linear scaling; adapter clock plumbing + `powerAtClockMw`
per-stage-exponent float sum + `byproductSuggestions`
aggregate-then-match; store clock-text seeding; UI CLOCK % input +
display-only suggestion lines + `≈` cost sheet; the Preview clockText
snapshot (boundary-r1 fold).

Surfaces to pressure:
- Duplicate scaling arithmetic in the core — is `.mul(clockScale)`
  repeated where one helper/local would read cleaner, or is inline
  repetition the idiomatic minimum here?
- The adapter's clock threading (ProposeOptions + PreviewOptions +
  proposalMetrics) — any redundant re-parse/re-derive of the same clock?
- `parseClockText` vs the existing `parseRateText` — near-twins? Could
  one parameterized validator serve both without ceremony?
- Test bulk: any new test that re-pins what another new test already
  pins (true duplicates, not complementary angles)?
- Dead or speculative surface: anything built that no consumer reads.

Frozen constraints (NOT simplification targets): per-stage exponents
(no subtreePowerText reuse); the snapshot posture; display-only
suggestions; the 7th positional core param; exact-rational core with
powerAtClockMw the only float boundary.

Verdict is advisory (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED — only BLOCKED escalates). Return severity-tagged, line-cited
findings naming the simpler shape for each.
