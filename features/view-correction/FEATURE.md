# Correction: restore schematic, remove combined view (Stage 14 arc)

**Started:** 2026-08-05
**Status:** SHIPPED 2026-08-05
**Current phase:** — (arc closed)
**Final PR:** #79
**Epic:** #73 (board #21, Stage 14 milestone 85; children #74 A, #75 B, #76 C)

## Phase status

- Combined corrective cycle COMPLETE (merged 2026-08-05, `3d69405`,
  751 tests, +1268/−1182). Design: brainstorm v3 FROZEN (r1 both
  NEEDS_REWORK — converged BLOCKER: the v1 deletion partition
  stranded the kept LinkInspector-transitive surface; r2 APPROVED +
  APPROVED_WITH_NITS; simplify APPROVED_WITH_NITS — the kept
  chain-layout engine recorded as a proven-surface deferral → #77).
  Implementation: 3 commits, ZERO restore-side signature drift,
  restore byte-exact vs ba35744 except the intended label lift.
  Boundary: APPROVED_WITH_NITS ×2 (comment/tautology nits folded).
  Diff-simplify: APPROVED_WITH_NITS (1 LOW → #77 scope note). Walk:
  schematic opens first ([SCHEMATIC|BLUEPRINT] tabs), zero
  text-on-ink at Wire ×28 + Plastic ×161 both themes (output lane
  names lifted to busY+18 — Michael's "Cable" garble fixed),
  Blueprint intact (17800px DETAIL, gutter, toggle), no Combined
  reachable. #71 closed by the restore (beltLabel/segTooltip regain
  their consumer).

## Decisions log

- 2026-08-05 (Michael, verbatim): "no you removed the wrong one i
  liked the first view and dont want this combined one" — root
  cause: the pre-S13 next-view toggle label poisoned the S13
  directive's vocabulary (his "schematic" named Combined).
- 2026-08-05 (freeze): restore from ba35744; r1-corrected partial
  deletion (LinkInspector-transitive surface + layoutChain kept);
  output lane name busY+18 + halo with a non-optional geometry pin.
- Follow-ups filed: #77 (chain-engine collapse + de-export), #78
  (pre-existing band index-label crowding at dense breakouts).
