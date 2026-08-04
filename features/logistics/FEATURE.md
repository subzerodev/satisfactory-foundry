# Logistics — combined blueprint + transport planning (Stage 7 arc)

**Started:** 2026-08-04
**Status:** in-progress
**Current phase:** Phase 2 (transport UI) — design next
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

### Phase 2 — transport UI (deferred design)

- **Ticket:** #32 (blocked-by #31)

### Phase 3 — combined multi-stage blueprint (deferred design)

- **Ticket:** #33 (blocked-by #32)

## Decisions log

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

—
