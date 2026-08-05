# Views join the drawing + visible raw feeds (Stage 11 arc)

**Started:** 2026-08-05
**Status:** in-progress
**Current phase:** Phase 1 (visible raw feeds) — next
**Final PR:** —
**Epic:** #53 (board #21, Stage 11 milestone 82)

## Phase decomposition

- **P0** — views join the drawing (#54): Schematic / Blueprint / Combined
  get the full identity treatment (type, spacing, chrome) — the S9P2
  Axis-3 deferral fired. PLUS #55 riding the cycle: the title block goes
  STICKY BOTTOM (Michael's decision 2026-08-05, supersedes the top-strip
  recommendation).
- **P1** — visible raw feeds in the chain graph: raw extraction inputs
  (Crude Oil, Copper Ore, …) appear in the flow with rates. Full design
  loop (source nodes vs feed annotations; LR/TB; persistence). Child
  ticket at pickup.

## Phase status

- P0 (#54 + #55): complete (merged 2026-08-05, 3a3feae; 728/728,
  CSS-only). Design: three correctness rounds — the override-row fix
  went min-width:0 (killed r1: false shared-grid rationale) → 220px
  (killed r2: both reviewers independently computed the real 51-char
  output label) → max-content grid (r3 approved on all five refutation
  axes incl. computed no-overflow); simplify dropped the letter-spacing
  gold-plating. Boundary: BOTH APPROVED zero findings; diff-simplify
  APPROVED_WITH_NITS (2 leave-as-is dispositions). Walk: both media —
  grid aligned/unwrapped/gulf-free with output-lane data, sticky block
  pinned to the true scrollport bottom (the 15px "failure" was the
  horizontal-scrollbar metric, not a defect) and released at its
  natural seat, all radii/type verified, zero console errors.
- P1: next — child ticket at pickup.

## Decisions log

- 2026-08-05 (#55): title block placement = sticky bottom — Michael's
  stated preference; costs accepted (~40px standing height, opaque
  ground).
- 2026-08-05: arc opened from Michael's round-2 feedback on the live
  Stage 10 build; decomposition on epic #53.
