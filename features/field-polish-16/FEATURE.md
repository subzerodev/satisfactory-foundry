# Field polish: rates, names, honest numbers (Stage 16 arc)

**Started:** 2026-08-05
**Status:** SHIPPED 2026-08-05
**Current phase:** — (arc closed)
**Final PR:** #88
**Epic:** #82 (board #21, Stage 16 milestone 87; children #83 #84 #85 #86)

## Phase status

- Four-axis combined cycle COMPLETE (merged 2026-08-05, `a0ebb29`,
  770 tests +11). Design: brainstorm v3 FROZEN after THREE
  correctness rounds — r1 killed the machines×perMinute output
  formula (the displayed machines is the subtree Σ), r2 caught the
  unguarded outputRate deref (self-consuming candidates demote to
  raw), r3 both APPROVED; simplify APPROVED. Implementation: 5
  commits, zero drift; the zustand getInitialState SSR-stub seam
  disclosed and reviewer-endorsed. Boundary: APPROVED_WITH_NITS +
  APPROVED (whitespace-comment nit folded); diff-simplify APPROVED.
  Walk: blueprint labels 1..N with the boundary-4 mark at the right
  edge of the rect labeled 4 (the #85 off-by-one fixed); schematic
  numbers centered (x=31 in the 24-wide cell); OUTPUT column live
  (82→2460/min vs 25→2500/min actuals); tile "×65 Refinery".

## Decisions log

- 2026-08-05 (#85 audit): the geometry was correct everywhere — the
  Blueprint's DISPLAYED numbers were 0-based against the 1-based
  solver vocabulary; display-only fix.
- 2026-08-05 (freeze): OUTPUT from the primary ProposedStage
  .outputRate with the guarded "—" fallback (uniform actuals incl.
  the current row); band + non-band labels center at +pitch/2;
  machineName falls back to the raw id (never a dangling "×N").
- Provenance: the live-Apply-on-dashed-row is pre-existing, own
  ticket if ever deemed a trap.
