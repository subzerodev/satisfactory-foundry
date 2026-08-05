# Field fixes round 2: remove schematic, blueprint overlap, override table (Stage 13 arc)

**Started:** 2026-08-05
**Status:** in-progress — combined design cycle
**Current phase:** design (brainstorm v1 → dual-review)
**Final PR:** —
**Epic:** #67 (board #21, Stage 13 milestone 84; children #68 A, #69 B, #70 C)

## Phase status

- Combined cycle (A remove schematic + honest switcher, B mark-label
  overlap fix, C override table): brainstorm v1 written 2026-08-05,
  entering the r1 dual-review (all-Claude degraded roster).
- Grounding on record: the #69 live overlap audit (35 mark-label/
  junction crossings at DETAIL on Wire ×28; zero text-on-text); the
  schematic deletion surface grep (svg-scale.ts LAYOUT import is the
  one non-schematic dependency); the per-lane override grids.

## Decisions log

- 2026-08-05 (Michael, verbatim): "remove schematic view its not
  working also blueprint still has overlapping issues and the belt
  load stuff is not aligned at all and needs to be better displayed"
  — removal is a directive, not a design fork.
- 2026-08-05 (pickup): one combined cycle per the S12 P2+P3
  precedent; walk cases Wire ×28 + Plastic ×161, both themes.
