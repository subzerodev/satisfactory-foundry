# Field fixes round 2: remove schematic, blueprint overlap, override table (Stage 13 arc)

**Started:** 2026-08-05
**Status:** SHIPPED 2026-08-05
**Current phase:** — (arc closed)
**Final PR:** #72
**Epic:** #67 (board #21, Stage 13 milestone 84; children #68 A, #69 B, #70 C)

## Phase status

- Combined cycle COMPLETE (merged 2026-08-05, `bafae8c`, 749 tests
  +421/−1150). Design: brainstorm v3 FROZEN (r1 both NEEDS_REWORK —
  converged IMPORTANT on the grid-hoist header bug; r2 both
  APPROVED_WITH_NITS — shared gap/align-items nit; simplify APPROVED
  0). Implementation: 4 commits, zero drift. Boundary: APPROVED +
  APPROVED_WITH_NITS (2 non-gating: format helpers → #71,
  geometry-test coupling rejected-with-rationale); diff-simplify
  APPROVED_WITH_NITS (1 LOW .view-tab CSS duplication,
  rejected-with-rationale). Walk: Wire ×28 + Plastic ×161, both
  themes, FIT + DETAIL — collision scan 35 → ZERO; 66 override
  inputs one aligned column; tabs honest; no schematic reachable.
- Grounding on record: the #69 live overlap audit (35 mark-label/
  junction crossings at DETAIL on Wire ×28; zero text-on-text); the
  schematic deletion surface grep (svg-scale.ts LAYOUT import was
  the one non-schematic dependency); the per-lane override grids.

## Decisions log

- 2026-08-05 (Michael, verbatim): "remove schematic view its not
  working also blueprint still has overlapping issues and the belt
  load stuff is not aligned at all and needs to be better displayed"
  — removal is a directive, not a design fork.
- 2026-08-05 (pickup): one combined cycle per the S12 P2+P3
  precedent; walk cases Wire ×28 + Plastic ×161, both themes.
