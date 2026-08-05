# Drawing identity (Stage 9 arc)

**Started:** 2026-08-05
**Status:** in-progress
**Current phase:** Phase 0 (tokens + type + sheet chrome) — design next
**Final PR:** —
**Epic:** #43 (board #21, Stage 9 milestone 80)

## Direction (frozen on #42, Michael-approved)

The app as a FICSIT engineering drawing. Vellum drafting sheet (light):
paper #EDE9DC, ink #24384A, FICSIT orange #E8722D (the ONE accent),
stamp red #B3382C — vellum accent SUPERSEDED at P0 r1 to #C25A1D (#E8722D computes 2.51:1 on vellum, failing the 3:1 gate; demoted to fill-under-light-text only). Cyanotype blueprint (dark — the theme toggle is a
medium change): ground #123C63, line ink #D9E8F5, orange #F5913E,
stamp #FF8073. Type: Big Shoulders (display) + IBM Plex Mono (all
numbers/rates/title-block) + quiet sans prose. Structure as
information: title-block footer (plan name / rev / units EXACT ℚ /
Σ power), dimension-line edges, inspection-stamp findings,
line-conventions legend. Stamp intensity + cyanotype-only-dark
tunable at phase design.

## Phase decomposition

- **P0** — tokens + type + sheet chrome (CSS custom properties both
  media, font loading, drawing-frame + title-block shell, legend key).
- **P1** — canvas: machine-plate nodes, dimension-line edges,
  inspection stamps, blueprint grid.
- **P2** — panels + schedules (inspector, ChainBuilder/AltCompare,
  plans bar) + both-mode polish walks.

Behavior-frozen arc: presentation only; 703-test suite stays green
(literal class/string pins may legitimately move).

## Phases

### Phase 0 — tokens + type + sheet chrome

- **Status:** design next

## Decisions log

- 2026-08-05: Arc started; direction decision on #42; decomposition on
  epic #43.

## Final report

—
