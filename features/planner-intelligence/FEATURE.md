# Planner intelligence (Stage 8 arc)

**Started:** 2026-08-04
**Status:** in-progress
**Current phase:** Phase 2 (transport refinements, #38) — design next
**Final PR:** —
**Epic:** #36 (board #21, Stage 8 milestone 79)

## Phase decomposition

Five sequential phases (epic #36 pickup decision, 2026-08-04), from
Michael's "all of these next except the vehicle parser or sharing — one
plan" directive:

- **P0 hygiene** — #28 prototype-safe lookups + #34 planForLink
  resolver (adopted pre-existing tickets; sequenced first because #34
  rewrites the preamble sites P1/P2 touch).
- **P1 interaction polish** (#37) — one-click apply for match-demand;
  combined-view site focus.
- **P2 transport refinements** (#38) — per-end station overrides; pipe
  derate.
- **P3 auto-chain builder** (#39) — target item + rate → a proposed
  chain (may split core/UI at pickup).
- **P4 alt-recipe compare** (#40) — after P3 (shared enumeration
  machinery).

Excluded by directive: vehicle catalog admission; sharing/PWA.

## Phases

### Phase 0 — hygiene (#28 + #34)

- **Status:** complete (merged --no-ff to develop 2026-08-04 @ 9425de0;
  575/575 tests; 2-round design gate — r1 caught the null-on-unsolved
  contract defect pre-code — + simplify affirmed right-sized; boundary
  APPROVED×2 zero findings first round; the fifth-site fold decided +
  executed via the provably-equal tier derivation; behavior-preserving
  throughout, existing assertions byte-unchanged)
- **Tickets:** #28 (Done), #34 (Done)

### Phase 1 — interaction polish (#37)

- **Status:** complete (merged --no-ff to develop 2026-08-04 @ b4e463a;
  591/591 tests; 2-round design gate — three groundedness gaps caught
  pre-code, both safety claims PROVEN under refutation — + simplify
  (the delegation false-fork decided); boundary APPROVED×2 zero
  findings first round; browser walk verified apply + site focus live
  with zero defects; ticket #37 Done)
- **Ticket:** #37 (Done, closed)

### Phases 2–4 — deferred design

- **Tickets:** #38 → #39 → #40 (blocked-by chain)

## Decisions log

- 2026-08-04 (P1 landed): applyStageSelection(stageId) is the one
  re-derive path (the active setters delegate; mirrorActive stays
  active-keyed — a non-active write leaves the mirror
  reference-identical); the apply affordance lives in the LinkInspector
  (the MeasureFeed idiom) gated on the linkId-keyed under-supply
  finding; idempotence comes from the FINDING GATE (the suggestion
  still returns N at covering counts); site focus is a prop thread
  (ChainBlueprint stays store-free), select-only.
- 2026-08-04 (P0 landed): catalog maps are null-prototype at both build
  boundaries (parse + revive; the serialize DTO stays plain — write-only);
  planForLink's null is reserved for missing-item ONLY (unsolved flows
  through; belt resolves); all FIVE resolve sites fold through it —
  computeTransportFindings lost its unlockedTiers param (provably equal
  to the plan-global derivation).
- 2026-08-04: Arc started; decomposition on epic #36.

## Final report

—
