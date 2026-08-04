# Physical layout — geometry over the solve (Stage 4 arc)

**Started:** 2026-08-04
**Status:** COMPLETE (both phases merged)
**Current phase:** arc closed 2026-08-04
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

- **Status:** complete (merged --no-ff to develop 2026-08-04; 373/373
  tests; 2-round design gate + simplify; boundary APPROVED×2 clean
  first-try incl. independent wiki re-verification of the footprint
  data; lint-enforcement proven in the bidirectionality log; ticket
  #20 Done)
- **Ticket:** #20 (Done, closed)
- **Scope sketch (brainstorm decides):** footprint table source/shape +
  keying by `CatalogRecipe.machineId`; mesh-dims vs grid-box policy; units
  (exactness posture); the row-layout algorithm boundary (fixed conventions
  vs computed placement); splitter/merger placement at the solver's
  entry/breakout points; foundation-tile alignment; the LayoutResult
  contract Phase 2 renders; testing posture.

### Phase 2 — blueprint view

- **Status:** complete (merged --no-ff to develop 2026-08-04; 377/377
  tests; 2-round design gate — both r1 reviewers independently caught
  the same hook-rules defect, folded to memo-in-the-leaf — + simplify;
  boundary converged with nits folded; diff-simplify folds re-checked
  APPROVED×2; walk-verified incl. hand-checked viewBoxes and the
  Constructor sub-metre pitch; ticket #21 Done)
- **Ticket:** #21 (Done, closed)

## Decisions log

- 2026-08-04: Arc started; two-phase decomposition on epic #13; footprint
  research grounding recorded there (wiki.gg authority; seed dims).
- 2026-08-04 (P1 design): integer-DECIMETER geometry (exact plain-number
  math; Fractions only as pass-through labels); pitch = ceilTo10(width)+10
  with grid origins (gap variable); junctions live IN the LayoutResult
  (simplify rejection — one tested home); provenance in the file header;
  layout has its OWN lint block (state|ui banned, data allowed).
- 2026-08-04 (P2 design): Blueprint computes its OWN layout
  (memo-in-the-leaf; mounting gates recompute); App composes complete
  two-sided label strings; dm-native SVG viewBox with overflow:visible;
  single toggle button; z-order pinned, styling at implementer
  discretion.
- 2026-08-04 (P1 implementation): all 11 bundled producers wiki-cited,
  zero defaults; buses span 0→N×pitch because a clamp-to-N drop mark
  genuinely lands at the row-tail boundary; host-globals lint ban
  single-sourced (HOST_GLOBALS_BAN).

## Final report

—
