# Chained stages — the factory graph editor (Stage 3 arc)

**Started:** 2026-08-03
**Status:** in-progress
**Current phase:** Phase 1 (graph model) — designing
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

- **Status:** designing
- **Ticket:** #16 (to create)
- **Scope sketch (brainstorm decides):** multi-stage store shape (stages
  with ids/names + per-stage Selection + per-stage solve; typed links
  item-matched between stage outputs and downstream feeds); cross-stage
  reconciliation (per link: upstream supply vs downstream demand, exact
  Fractions — where that comparison lives given core purity); single-stage
  v1 behavior preserved as the one-stage case; migration of the current
  single-selection store surface.

### Phase 2 — React Flow canvas (deferred design)

- Nodes = stage cards (name, recipe, machines, status), edges = item flows
  with rates, selected stage opens the full v1 schematic; @xyflow/react
  enters here.

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
- 2026-08-03 (P1 r3 fold): **loadPlan no longer adopts a plan's saved
  tiers** — the current global unlock state is preserved on load (tiers
  are progression, not plan content; supersedes the Stage-2 tier-restore
  semantics). The plan file still stores tiers (frozen format); they are
  simply not read back in Phase 1+.

## Final report

—
