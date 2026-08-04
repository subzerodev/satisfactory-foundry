# Physical layout — geometry over the solve (Stage 4 arc)

**Started:** 2026-08-04
**Status:** in-progress
**Current phase:** Phase 1 (layout engine) designing
**Final PR:** —
**Epic:** #13 (board #21, Stage 4 milestone 75)

## Phase decomposition

Two sequential phases: the pure layout engine first (solve + curated
footprint table → typed 2D arrangement, new `src/layout/` outside core),
then the blueprint view (SVG floor plan in the drill-in, toggle with the
schematic). Phase 2 defers its design until the P1 LayoutResult contract
lands (deferred-plans rule).

Governing decisions: epic #13 §Decisions + master-plan §Stage 4. USER GATE
auto-greenlit per the 2026-08-03 sequential directive. Footprint data
grounded at pickup from the official wiki (satisfactory.wiki.gg) — see the
epic's research-grounding decision.

## Phases

### Phase 1 — layout engine (pure geometry)

- **Ticket:** #20 (In Progress)
- **Scope sketch (brainstorm decides):** footprint table source/shape +
  keying by `CatalogRecipe.machineId`; mesh-dims vs grid-box policy; units
  (exactness posture); the row-layout algorithm boundary (fixed conventions
  vs computed placement); splitter/merger placement at the solver's
  entry/breakout points; foundation-tile alignment; the LayoutResult
  contract Phase 2 renders; testing posture.

### Phase 2 — blueprint view (deferred design)

- **Ticket:** #21 (blocked-by #20)

## Decisions log

- 2026-08-04: Arc started; two-phase decomposition on epic #13; footprint
  research grounding recorded there (wiki.gg authority; seed dims).

## Final report

—
