# Chained stages — the factory graph editor (Stage 3 arc)

**Started:** 2026-08-03
**Status:** in-progress
**Current phase:** Phase 2 COMPLETE — Phase 3 (plans carry the graph) next
**Final PR:** —
**Epic:** #12 (board #21, Stage 3 milestone 74)

## Phase decomposition

Three sequential phases delivering the factory graph: the headless graph
model first (stages collection + typed links + cross-stage reconciliation,
building on the Stage-2 `PlanFileV1.stages[]`/`links[]` format), then the
React Flow canvas UI (nodes = stages, edges = item flows, per-stage drill-in
to the v1 schematic), then graph serialization into plans + cross-stage
findings polish. Phases 2–3 defer their designs until upstream shapes lock
(deferred-plans rule).

Governing decisions: epic #12 + the master-plan §Stage 3. USER GATE between
phases auto-greenlit per the 2026-08-03 sequential directive (Michael can
interrupt at any point). New dependency `@xyflow/react` pre-sanctioned by
the approved v1 design spec's stack rationale ("React Flow (xyflow) is the
most mature open-source flow library"); the dependency lands in Phase 2,
argued at its design review.

## Phases

### Phase 1 — graph model + cross-stage reconciliation (state + core boundary)

- **Status:** complete (merged --no-ff to develop 2026-08-03; 295/295 tests;
  5-round design gate; boundary converged first-try incl. the ratified
  mirror amendment; ticket #16 Done)
- **Ticket:** #16 (Done, closed)
- **Scope sketch (brainstorm decides):** multi-stage store shape (stages
  with ids/names + per-stage Selection + per-stage solve; typed links
  item-matched between stage outputs and downstream feeds); cross-stage
  reconciliation (per link: upstream supply vs downstream demand, exact
  Fractions — where that comparison lives given core purity); single-stage
  v1 behavior preserved as the one-stage case; migration of the current
  single-selection store surface.

### Phase 2 — React Flow canvas

- **Status:** complete (merged --no-ff to develop 2026-08-04, 09cdcc5;
  323/323 tests; 4-round design gate + design-simplify; boundary
  converged first-try + diff-simplify fold; walk-verified end to end;
  ticket #17 Done). @xyflow/react@12.11.2 = the first runtime dep since
  Stage 0. One walk-caught defect (RF measured-state clobber killing
  connections) fixed in-phase via measured preservation + node-side
  handle geometry.
- **Ticket:** #17 (Done, closed)

### Phase 3 — plans carry the graph + cross-stage findings (deferred design)

- PlanFileV1 stages[]/links[] populated multi-stage; load/save round-trip;
  cross-stage findings panel.

## Decisions log

- 2026-08-03: Arc started; decomposition recorded on epic #12. Phase gates
  auto-greenlit per the sequential directive.
- 2026-08-03 (P1 r1 fold): cycle-FLAGGING dropped from Phase 1 (per-link
  reconciliation is cycle-indifferent; findings union carries no topology).
  **Deferred to Phase 2 design:** whether the canvas wants a cycle
  indicator (visual affordance, store-level detector) — decide with the
  React Flow layout work.
- 2026-08-04 (P2 design): canvas brainstorm frozen v5 (4 rounds +
  simplify): catalog-carrying graphToFlow; semi-controlled
  applyNodeChanges drag; canLink fronting addLink (five literal notice
  messages, no enum); recipe-less stages first-class; monotonic
  placementSeq slots with NO collision machinery; canvas excluded from
  smoke (SSR row landed as opportunistic bonus). Cycle indicator
  DECLINED for Phase 2 (revisit only if Stage 5 surfaces a want).
- 2026-08-04 (P2 implementation): node-side handle GEOMETRY (x/y/size)
  is load-bearing — RF computes handleBounds from it with no DOM
  measurement; the resync merge must preserve RF's measured state.
  Positions remain session-state; persistence is Phase 3's plan-format
  decision.
- 2026-08-03 (P1 r3 fold): **loadPlan no longer adopts a plan's saved
  tiers** — the current global unlock state is preserved on load (tiers
  are progression, not plan content; supersedes the Stage-2 tier-restore
  semantics). The plan file still stores tiers (frozen format); they are
  simply not read back in Phase 1+.

## Final report

—
