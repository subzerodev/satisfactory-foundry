# Logistics — combined blueprint + transport planning (Stage 7 arc)

**Started:** 2026-08-04
**Status:** COMPLETE (all four phases merged)
**Current phase:** arc closed 2026-08-04
**Final PR:** —
**Epic:** #27 (board #21, Stage 7 milestone 78)

## Phase decomposition

Four sequential phases (epic #27 pickup decision, 2026-08-04):

data first (P0 research — the wiki-grounded transport fact table the math
must cite), then the pure solver (P1 core math), then its surfaces (P2
transport UI on links), then the combined multi-stage blueprint (P3 — the
S4P2 deferral, sequenced last so the combined floor plan can draw the
transport-annotated inter-site links it now knows about).

Michael's requirement (2026-08-04, verbatim): "say I mine coal or oil in
one location and transport via belt, pipe, truck, train, drone — we need
to be able to plan how many, given the amount needed in the other
location and the length of the trip, and if train how many cars per
train vs more individual trains."

## Phases

### Phase 0 — transport research (RESEARCH-GATE)

- **Status:** complete (2026-08-04; 3-round correctness gate — r1 caught the
  stale Freight Car 1600 m³ description string, r3 REFUTED a false byte-diff
  claim with U+202F codepoint evidence — + simplify APPROVED_WITH_NITS both
  rejected-with-rationale; bundled Docs.json verified content-identical to
  the installed game's export per Michael's tip; ticket #30 Done)
- **Ticket:** #30 (Done, closed)
- **Artifact:** `docs/research/transport-facts.md` — per-fact URL +
  retrieval date; Docs.json-derivable facts marked parser-sourced; the
  "never parse capacities from mDescription prose" rule; honest Unknowns
  (user-supplied trip time is the planner's primary input)

### Phase 1 — transport core math

- **Status:** complete (merged --no-ff to develop 2026-08-04; 477/477
  tests; 3-round design gate — the core→data layering BLOCKER caught
  pre-code by both reviewers — + simplify (the nonexistent-precedent
  caveat flags removed); boundary APPROVED×2 zero findings first round;
  the wiki-ceiling rounding artifact resolved by decision (exact
  800000/559 kept over the wiki's rounded 1431.17); ticket #31 Done)
- **Ticket:** #31 (Done, closed)
- **Artifacts:** src/core/transport.ts (continuousRuns / vehicleFleet /
  trainOptions / droneFleet, all exact), src/core/transport-facts.ts
  (the cited P0 catalogue), 23 tests + R2 bidirectionality log

### Phase 2 — transport UI

- **Status:** complete (merged --no-ff to develop 2026-08-04 @ 655969e;
  537/537 tests; 4-round design gate + simplify (the mode-discriminated
  LinkTransport union); boundary caught the battery-units honesty
  defect pre-merge; browser walk verified every surface live and caught
  the raw-fraction display leaks (four ≈ folds, each re-checked);
  ticket #32 Done)
- **Ticket:** #32 (Done, closed)
- **Artifacts:** LinkInspector + edge chips + transport-plan/-text
  (src/ui), PlanFileV3 + migration, CatalogItem.stackSize (parser v3),
  the transport-rate-unsustainable finding

### Phase 3 — combined multi-stage blueprint

- **Status:** complete (merged --no-ff to develop 2026-08-04 @ 7135e0b;
  567/567 tests; 4-round design gate — the coincident-K hole caught
  pre-code, totality closed by construction — + simplify (trains
  omit-with-note); boundary APPROVED_WITH_NITS×2 folded; the browser
  walk caught a Rules-of-Hooks crash a boundary-nit fold had
  introduced (reverted) and verified the measure feed end-to-end;
  ticket #33 Done)
- **Ticket:** #33 (Done, closed)
- **Artifacts:** layoutChain (src/layout), ChainBlueprint + chain-view
  (src/ui), the measure-feed apply action, the power footer

## Decisions log

- 2026-08-04 (P3 landed): the canvas arrangement IS the site plan (the
  three-step composer: coincidence tie-break → minimal-K → grid
  rounding); the measure feed is an explicit action, never auto-sync
  (drone 2× round-trip vs road one-way in one mapping site); the
  footer splits provenance (≈ sites float · exact transport Fraction,
  no merged total; trains omit-with-note); follow-up #34 (shared
  planForLink resolver) spawned from diff-simplify.
- 2026-08-04 (P2 landed): LinkTransport is a mode-discriminated union
  (illegal states uncompilable); plan files v3 (v2/v1 migrate); drone
  costs render "batteries" only when battery IS the fuel, exact MJ
  otherwise; non-terminating display rates use the labeled ≈ form
  (formatRateOrApprox); station/port power stays inspector-only (not in
  the chain Σ — routes aren't stages; P3 may revisit).
- 2026-08-04 (P1 landed): tier rates reach core as caller-supplied
  params (core→data lint-banned; the manifold capacities idiom);
  module invariants live in type doc-comments, not always-true flags;
  tripBasis echoes the honest-input discriminant onto results; wiki
  train-ceiling figures are rounding artifacts — the exact lockout
  constant governs (decision on #31).
- 2026-08-04 (pickup): four-phase decomposition + blocked-by chain
  (#30→#31→#32→#33); research pre-authorized by Michael's directive (the
  Stage 4 footprint-table precedent covers wiki grounding with
  provenance); all-Claude roster; full gate per phase; sequential
  posture continues.

## Final report

Stage 7 delivered Michael's logistics directive end-to-end across four
gated phases: #30 the provenance-cited transport fact table (wiki +
the installed game's own export, verified content-identical); #31 the
exact transport solver (fleet-for-rate per mode; the train
cars-vs-trains comparison as exact rows); #32 the transport UI
(per-link mode + trip config, plan-file v3, the LinkInspector, one
provable finding); #33 the combined multi-stage floor plan with the
measure-feed loop closing drawn geometry back into the planner.
Released via the Stage 7 PR (develop → main). Follow-ups in backlog:
#28 (prototype-safe lookups), #34 (planForLink resolver).
