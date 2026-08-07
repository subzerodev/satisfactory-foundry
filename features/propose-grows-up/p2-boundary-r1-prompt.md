# Boundary review r1 — S20 P2 (#101): solver extensions implementation

Review the CUMULATIVE diff against the frozen v4 design. Worktree:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s20-p2`
(branch feature/s20-p2, 5 commits over develop at 2ea95c0).

Diff (1315 lines):
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s20-p2/features/propose-grows-up/p2-boundary-r1.diff`
(also reviewable as `git diff develop...HEAD` in the worktree)

## A. Contract anchors

- Frozen contract: `features/propose-grows-up/p2-brainstorm.md` (v4
  FROZEN, in the worktree) — spec items 1-6 are acceptance criteria
  (item 7 docs = team lead). The revision history records the pins:
  routing fully descoped to #105 (display-only suggestions); per-stage
  exponents (subtreePowerText reuse FORBIDDEN); (itemId, toItemId)
  unique by construction via aggregate-then-match; compare path pinned
  at 100%; core stays exact-rational with powerAtClockMw the ONLY float
  boundary; default-100 byte-identical.

## B. Claims to verify

1. Every hunk against the contract — scope creep (routing residue, P3
   leak, compare-path edits, store surface beyond the clock-text seed),
   dead code.
2. Implementer claims: 834/834 green + check clean (re-run if you have
   shell); default-100 byte-identical core regression genuinely pinned;
   zero drift from the frozen spec, zero declared deviations.
3. The sharpest edges:
   - clock scaling applied in BOTH the demand walk and the count-fix
     pass (an inconsistency between them breaks the outputRate
     invariant);
   - powerAtClockMw uses EACH stage's own exponent (non-uniform
     1.321929/1.6) — verify the loop, and that null-at-100 is exact;
   - byproductSuggestions aggregates BEFORE matching (two producers →
     one summed suggestion) and emits per (aggregated B, consumer);
     keys unique both multiplicity directions;
   - applyChainProposal's new clock-text param defaults to "100"
     (existing callers unaffected) and seeds every applied stage;
   - the CLOCK % input joins the SAME single repropose options path as
     the P1 controls (no path builds with stale/different clock);
     validation (0,250] via the existing error idiom;
   - suggestion lines are truly display-only (no handlers beyond
     rendering) and keyed (itemId, toItemId).
4. The bidirectionality log `features/propose-grows-up/
   p2-r2-verification.log` — 9 claimed behaviors: real breaks, genuine
   vitest FAIL lines naming the diff's new tests, byte-identical
   restores. NEEDS_REWORK if missing or no genuine FAIL.
5. UI accessibility + theme-token discipline for the new control and
   suggestion lines (both themes).
6. Process note declared by the implementer: an early `git checkout`
   during bidirectionality briefly reverted uncommitted core changes,
   reapplied before committing — confirm the final tree carries the
   complete intended implementation (no silently lost hunks: e.g. the
   clock scaling present in ALL the paths the spec names).

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS /
NEEDS_REWORK / BLOCKED) with severity-tagged, line-cited findings.
