# Field fixes: catalog refresh, views at scale, clarity (Stage 12 arc)

**Started:** 2026-08-05
**Status:** SHIPPED 2026-08-05
**Current phase:** — (arc closed)
**Final PR:** #66 (P0 early via PR #61, P1 via PR #63)
**Epic:** #59 (board #21, Stage 12 milestone 83)

## Phase status

- P0 (#60): complete — catalog version bump 3→4, released to main via
  interim PR #61 (the S11P1 no-bump premise had no heal trigger).
- P1 (#62): design FROZEN 2026-08-05 (brainstorm v9 — SIX correctness
  rounds + simplify). Decided design: (Axis 1) schematic LOD band when
  the pitch floors (N > 114): one band + ×N + boundaries only at
  entries/breakouts/segment-bounds/finding-machines, each labeled;
  (Axis 2) shared scale helper for Blueprint+Combined — fitScale =
  min(960/vbW, capH/vbH) (capH 520/640 per site), scale = max(fitScale,
  MIN_PX_PER_DM ~0.06), explicit width/height px, NEW .bp-scroll
  wrapper (bp-svg overflow:visible preserved), margin-inline auto
  centering, paint-order --bg halo on lane names, feed-above/
  output-below asymmetry KEPT; deep plans out of the floor's scope.
- P1 merged 2026-08-05 (762 tests... see below); released via PR #63.
- P2+P3 (#65 + #64, COMBINED per Michael's "fix all issues now"):
  complete — merged 2026-08-05 (`93298d2`, 767 tests). Decided design
  (brainstorm v6 FROZEN, 5 correctness rounds + simplify): (Axis A)
  BELT LOAD OVERRIDES heading + sub-label + per-lane item headings
  via the App itemName pattern; (Axis B) skip note "N stage(s) not
  drawn — no recipe or invalid settings"; (Axis C1) Blueprint-only
  HTML lane-name gutter left of .bp-scroll, labels DETAIL-only at
  (laneY − minY) × scale, in-SVG lane names removed, width via
  in-flow sizer twins (boundary-caught IMPORTANT: abs-positioned
  labels contribute nothing to max-content); (Axis C2) open scale
  max(fit, 1) + [FIT|DETAIL] toggle in BOTH blueprint views (mounted
  iff fit < 1, per-view state, default DETAIL), supersedes the P1
  "no zoom UI" non-goal by Michael's directive. Boundary: APPROVED +
  NEEDS_REWORK(1 IMPORTANT+2 NIT)→folded→APPROVED/APPROVED_WITH_NITS;
  diff-simplify APPROVED_WITH_NITS (1 folded, 1 rejected-w-rationale).
  Walk both media: Computer ×40 (DETAIL 7640px, gutter 92px, FIT
  collapse), Plastic ×161 (DETAIL 17800px head-anchored, gutter
  164px with the HOR label, floor-case FIT 1068px), Combined (toggle
  no-gutter, calm skip note), override panel headings live.

P1 close detail: brainstorm v10 — six design rounds + a BOUNDARY-caught
HIGH (the fitScale height term capH/vbH silently enlarged sub-cap plans
1.86×; corrected to min(vbH,capH)/vbH, spec+code+tests in one fold).
Boundary: APPROVED_WITH_NITS + NEEDS_REWORK→folded→re-check
APPROVED_WITH_NITS; diff-simplify APPROVED_WITH_NITS (3 LOW leave-as-is).
Walk both media: band ×161 zero ticks with boundary labels, floor
1068px scrollable no-meet, halo live, small plans natural size, zero
console errors.

## Decisions log

- 2026-08-05 (P0): the "self-healing cache" premise superseded — bumps
  are mandatory for catalog-shape changes (no natural re-parse exists).
- 2026-08-05 (P1 frozen): rendering-only; geometry untouched; the walk
  gate is Michael's exact 161-machine chain in both media.
