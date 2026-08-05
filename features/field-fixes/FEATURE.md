# Field fixes: catalog refresh, views at scale, clarity (Stage 12 arc)

**Started:** 2026-08-05
**Status:** in-progress
**Current phase:** Phase 1 (views at scale, #62) — design FROZEN, implementation next
**Final PR:** — (P0 released early via PR #61)
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
- P2 (clarity pass): after P1 — child ticket at pickup.

## Decisions log

- 2026-08-05 (P0): the "self-healing cache" premise superseded — bumps
  are mandatory for catalog-shape changes (no natural re-parse exists).
- 2026-08-05 (P1 frozen): rendering-only; geometry untouched; the walk
  gate is Michael's exact 161-machine chain in both media.
