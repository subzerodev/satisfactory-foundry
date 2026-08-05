# Drawing identity (Stage 9 arc)

**Started:** 2026-08-05
**Status:** in-progress
**Current phase:** Phase 1 (canvas: plates, dimension lines, stamps) — design next
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

- **Status:** complete (merged --no-ff to develop 2026-08-05; 706/706
  tests; design gate caught the concept orange failing its own 3:1
  contrast gate (superseded to computed #C25A1D) + folded the token set
  eight→three; boundary adversarial APPROVED with recomputed hexes +
  live suite run; diff-simplify APPROVED clean; both-media walk
  verified tokens/fonts/frame/legend/title-block live; ticket #44 Done)

### Phase 1 — canvas

- **Status:** design next

## Decisions log

- 2026-08-05 (P0 landed): the existing token names are the identity's
  API (re-valued in place, never renamed); vellum accent is #C25A1D
  (the computed supersession — #E8722D fill-only); three new tokens
  only (--border-soft + two font vars); fonts self-hosted woff2;
  RF --xy-* chrome deliberately stock until P1 re-skins it; the
  toggle names its destination medium.
- 2026-08-05: Arc started; direction decision on #42; decomposition on
  epic #43.

## Final report

—
