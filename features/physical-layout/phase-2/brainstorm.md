# Stage 4 / Phase 2 brainstorm — the blueprint view (ticket #21, epic #13)

Date: 2026-08-04
Status: v3 FROZEN — correctness converged (r2); simplify dispositioned
Inputs: the LANDED P1 engine (`src/layout/layout.ts` StageLayout/LaneLayout/
BeltMark contracts, integer-dm, develop c49e981; `src/layout/footprints.ts`
FOOTPRINTS table), the frozen P1 brainstorm, live `src/ui/Schematic.tsx`
(the `useMemo(computeLayout)` consumption precedent, line ~140),
`src/ui/smoke.test.tsx` (leaf-component renderToStaticMarkup posture),
`src/ui/App.tsx` (drill-in surface structure), `src/ui/format.ts`
(formatRate), the store mirror (top-level selection/solve follow the
active stage).

## Already settled — do NOT re-litigate

1. Sequential directive; all-Claude roster; opus implementer.
2. The P1 contract is FROZEN AND LANDED: StageLayout units "dm",
   machines/feedLanes/outputLanes/foundations/findings; junctions ARE in
   the contract (simplify rejection — P2 renders them, never derives);
   LaneLayout omits `kind` (P2 reads it off the solve); belt visual
   width 20 dm is a stated RENDER convention; zero-machine pinned shape.
3. Multi-stage combined floor plan is OUT of scope (ticket #21 pin) —
   chained stages are covered via canvas selection driving the drill-in.
4. UI stays thin: everything renders from StageLayout; no geometry math
   in components beyond unit scaling at the SVG boundary.
5. Testing posture: no jsdom; leaf-component static-markup smoke rows +
   pure-module tests; browser walk gates visuals.

## Axis 1 — View toggle: component-local, in the drill-in header

- The ready-state drill-in gains a SINGLE toggle button labelled with
  the target view ("View: Blueprint" ⇄ "View: Schematic"; simplify
  fold — one control for a strict two-state v1; Stage 5 can grow it),
  rendered by App directly above the current Schematic slot. View choice is `useState` in App (component-local UI
  state, meaningless headless — the canvasNotice precedent). Default:
  Schematic (the familiar view stays primary this arc; Stage 5 may
  revisit). No store field, no cadence row, nothing persisted.
- Toggling swaps ONLY the schematic slot: ControlsStrip, SummaryCards,
  LaneOverrides, FindingsPanel all stay (they are solve-facing, not
  view-specific).

## Axis 2 — The Blueprint component: one leaf, SVG, dm-native viewBox

- New `src/ui/Blueprint.tsx` — a LEAF component (the Schematic sibling):
  props `{ solve: StageSolveResult, machineId: string, machineCount:
  number, feedLabels: string[], outputLabels: string[] }`; ZERO store
  imports (App wires it — the sole-store-importer rule). **Blueprint
  COMPUTES its own layout (r1 fold — the hook-rules fix): `layout =
  useMemo(() => layoutStage(solve, machineId, machineCount, FOOTPRINTS),
  …)` lives INSIDE the leaf — exactly where Schematic memoizes
  computeLayout — and App mounts <Blueprint> only when `view ===
  "blueprint"`, so MOUNTING (never a conditional hook) is what gates
  recompute.**
- **SVG scaling trick: the viewBox IS decimeters.** `viewBox="minX minY
  w h"` computed from the layout's own extents (foundations origin/cols/
  rows when non-empty, padded 20 dm; the P1 zero-machine shape renders
  an empty-state line instead of an SVG). No unit conversion anywhere —
  SVG scales dm to screen pixels itself (`width: 100%`, capped height,
  `preserveAspectRatio="xMidYMid meet"`). The "divide by 10 at the SVG
  boundary" note in P1 becomes unnecessary — record as an accepted
  refinement of a non-load-bearing P1 remark (the load-bearing pin was
  "P2 does units only at the boundary", and viewBox-native dm IS that).
- Draw order (SVG z — the load-bearing pin is the ORDER): foundation
  tiles → lane buses (20 dm wide — the P1-recorded render convention
  stays pinned) → junctions → machine rects → belt marks (feed drops
  vs breakouts, labelled `formatRate(capacity)/min`, breakouts also
  `load` — the two BeltMark fields) → the unknown-footprint notice
  line above the SVG ("footprint unknown for <machineId> — drawn as
  10×10 m"). Per-layer styling beyond this (stroke weights, fills,
  glyph shapes) is implementer discretion guided by the existing
  palette (simplify fold — prose de-specified, order + convention
  kept).
- Lane labels: **App composes the COMPLETE label strings (r1 fold —
  one owner): `feedLabels`/`outputLabels`, two index-aligned arrays
  (order = solve.feeds / solve.outputs, the same order layout's lanes
  carry), each entry the resolved `catalog.items[itemId].displayName`
  plus a " (pipe)" suffix when that lane's `kind === "pipe"` — BOTH
  sides.** Blueprint renders the strings verbatim; it never touches the
  catalog and never re-reads kind (its only use of `solve` is as the
  layoutStage input).
- Colors/styles: existing palette vars (colors.ts / app.css classes);
  pipes: same geometry, distinguished only by the " (pipe)" suffix App
  bakes into the labels (above) — the P1-recorded Stage-5 deferral of a
  real visual treatment stands.

## Axis 3 — Wiring in App: the Schematic precedent, verbatim shape

- App (ready state, active stage solved): resolves `machineId =
  catalog.recipes[selection.recipeId].machineId`, composes the two
  label arrays, and mounts `<Blueprint …>` in the schematic slot when
  `view === "blueprint"` (else `<Schematic …>`). The memoized
  layoutStage call lives inside Blueprint (Axis 2) — the same
  memo-in-the-leaf PATTERN Schematic uses for computeLayout
  (Schematic.tsx:139; r1 fold — the pattern is the precedent, not the
  function). No hook is conditional anywhere; a hidden Blueprint is
  UNMOUNTED, so nothing recomputes for a hidden view by construction.
- Gating identical to Schematic's: the solved-status gate alone
  (`solve.status === "solved"` — a null recipe can never reach solved,
  so no second conjunct exists; r1 nit).

## Axis 4 — Testing posture

- Smoke rows (static markup, the established pattern): Blueprint with a
  small real solve (Smelter ×2, one feed one output) asserts: an `<svg`
  with the expected `viewBox` string; a machine rect count; a junction
  count; a drop-mark label containing the exact formatRate string; the
  foundation grid square count. A recipe-less/idle gate row asserts the
  toggle + empty state. An unknown-machineId row asserts the notice
  line renders.
- NO new pure module (Blueprint is presentation over an already-tested
  contract; the P1 engine tests carry the geometry weight — adding a
  ui-side geometry helper would violate the thin-UI pin). If any
  arrow/label placement needs arithmetic beyond +/− of contract values,
  that is a smell to push back into P1's contract, not compute in the
  component.
- Browser walk (team lead): toggle views, verify machines/lanes/
  junctions/marks/foundations visually for Smelter and Constructor
  (sub-metre width), check the unknown-footprint notice never shows for
  bundled recipes, drill-in still follows canvas selection.

## Assumptions ledger

1. StageLayout contract as merged (src/layout/layout.ts @ c49e981) —
   grounded, I merged it this session.
2. The memo-in-the-leaf pattern (Schematic memoizes its pure layout
   call at Schematic.tsx:139; App mounts the leaf inside the solved
   block) — grounded, read this session; Blueprint transfers the
   PATTERN with layoutStage (a different function from a different
   module — r1 nit wording).
3. Static-markup smoke works for SVG leaf components — grounded: the
   existing smoke suite renders Schematic (SVG) via
   renderToStaticMarkup already.
4. `catalog.recipes[recipeId].machineId` is non-null for any solved
   stage (a solve requires a selected recipe; recipeId null ⇒ idle) —
   grounded in the store's derive gating.
5. App is the sole store importer and already owns the ready-state
   drill-in layout — grounded (App.tsx read this session).

## Revision history

- **r1 correctness (2026-08-04):** code-reviewer NEEDS_REWORK (1
  IMPORTANT + 2 NIT); adversarial NEEDS_REWORK (1 HIGH + 1 MEDIUM +
  2 NIT) — both independently found the same root defect. Folded in v2:
  1. **Memo-in-the-leaf** (the hook-rules fix, both reviewers):
     Blueprint computes its own layout via useMemo inside the leaf;
     App gates by MOUNTING, never by a conditional hook; the prop
     contract changed to {solve, machineId, machineCount, feedLabels,
     outputLabels}.
  2. **Two-sided composed labels, one owner** (adversarial MEDIUM):
     App bakes complete strings (name + " (pipe)" both sides) into two
     index-aligned arrays; Blueprint renders verbatim, never re-reads
     kind.
  3. **Label overflow stated** (adversarial NIT): svg overflow:
     visible; the 20 dm pad covers geometry only.
  4. **Citation precision** (code-reviewer NITs): the precedent is the
     memo-in-the-leaf pattern, not computeLayout itself; the redundant
     "recipe selected" conjunct dropped (null recipe ⇒ never solved).
  Refuted-and-held r1: prop sufficiency; dm-native viewBox with
  negative origins legal; foundations swallow all geometry incl. the
  100×100 default; slot isolatable; smoke grounding real.
- **Simplify pass (2026-08-04, one-shot): APPROVED_WITH_NITS (2 NIT,
  both prose).** Dispositions: (1) FOLDED — single toggle button
  replaces the segmented pair (two-state v1); (2) FOLDED — per-layer
  styling parentheticals demoted to implementer discretion; the z-ORDER
  and the P1 20 dm belt-width convention stay pinned. Affirmed
  already-simple: the five-prop contract (machineCount/machineId
  genuinely non-derivable from solve), contract-driven marks/labels,
  component-local toggle state, no new pure module. Prose-only folds —
  no correctness re-run.
- **v3 FROZEN (2026-08-04).**
