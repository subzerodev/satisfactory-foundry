# Planner intelligence (Stage 8 arc)

**Started:** 2026-08-04
**Status:** in-progress
**Current phase:** COMPLETE — all five phases landed; release PR next
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

### Phase 2 — transport refinements (#38)

- **Status:** complete (merged --no-ff to develop 2026-08-04 @ af03786;
  636/636 tests; 2-round design gate — r1's shared IMPORTANT caught the
  serialize-site undercount (seven PlanFileV3 annotations, not two
  literals) — + simplify affirming every axis minimal; boundary
  APPROVED_WITH_NITS×2 with the real catch folded (trip edits were
  wiping sharedEnds — trainWithTrip carries it, pinned + R2-11);
  diff-simplify's one finding folded (setSharedEnd delegates to
  trainWithTrip); browser walk zero defects incl. a live v3→v4 import
  migration, the derate error path, and the fold verified in-browser;
  ticket #38 Done)
- **Ticket:** #38 (Done, closed)

### Phase 3 — auto-chain builder (#39)

- **Status:** complete (merged --no-ff to develop 2026-08-05; 673/673
  tests; design converged r1 — the adversarial catalog scan refuted a
  false universal AND proved the empirics (0 cycles, demand model) —
  + simplify (two-field ProposedLink fold); boundary
  APPROVED_WITH_NITS×2 with the self-consume-guard fold landed;
  diff-simplify APPROVED clean; browser walk zero defects — Heavy
  Modular Frame @ 10/min proposed a 12-stage chain, applied with zero
  short links, target active, ordinarily editable; ticket #39 Done)
- **Ticket:** #39 (Done, closed)

### Phase 4 — alt-recipe comparison (#40)

- **Status:** complete (merged --no-ff to develop 2026-08-05; 703/703
  tests; THREE correctness rounds at design — the applyRecipeSwap
  atomicity Major resolved, two fold-hygiene defects caught by the pair
  and corrected against the catalog — + simplify all-affirming;
  boundary APPROVED_WITH_NITS×2 (nits folded); diff-simplify's
  one-loop-power-bounds fold landed; browser walk zero defects — Iron
  Ingot's five candidates compared live, atomic swap + same-output
  swap-back verified; ticket #40 Done)
- **Ticket:** #40 (Done, closed)

## Decisions log

- 2026-08-05 (P4 landed): proposeChain's override map is the ONE
  comparison engine (consulted before default selection, guard
  preserved, empty default byte-identical); candidacy lifts isAlternate
  but keeps the converter/packager exclusion; rows are absolute
  subtree costs at the stage's primary-lane totalOutput (no deltas, no
  ranking); applyRecipeSwap is the atomic recipe+count write (overrides
  cleared per selectRecipe's posture, cursor never stolen); upstream is
  never rebuilt on swap (reconciliation + the P1/P3 tools are the
  repair path).
- 2026-08-05 (P3 landed): proposeChain is the pure-core builder (own
  narrow BuilderRecipe types; excludedMachineIds as data — normalized
  `converter`/`packager` resolved by the ui adapter); one stage per
  item; ceil-after-aggregate demand (the CEIL'D consumption propagates
  so applied links arrive ok-or-surplus); cycle guard covers the item
  itself (self-consuming recipes demote to RAW — never a from===to
  link); applyChainProposal is additive-only (fresh uuids, tiers from
  active, toIndex-style bigint narrowing, target becomes active);
  proposals are session-ephemeral (apply clears the preview). P4's
  enumeration work builds on proposeChain's selection machinery.
- 2026-08-04 (P2 landed): plan files are v4 (identity migrateV3; save
  always writes 4 — the v3-additive alternative was rejected because
  the validator ignores unknown fields, so a rollback build would
  silently drop the new config); the LinkTransport union split — bare
  belt, pipe + deratePercentText, train out of the road bundle +
  sharedEnds absent-or-true; countedEnds 0|1|2 in core trainOptions
  touches stationPowerMw ONLY; the derate applies at derive
  ((0,100], laneRate × pct/100 into unchanged continuousRuns) and is
  worded as the user's own assumption; trainWithTrip is the single
  train-arm assembly point (trip edits must never wipe sharedEnds).
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

Stage 8 shipped Michael's full 2026-08-04 batch ("all of these next
except the vehicle parser or sharing — one plan") as five gated phases
over two days, 567 → 703 tests (+136), every phase through the full
gate (design dual-review to convergence + simplify, opus implementation
in an isolated worktree, boundary dual-review + diff-simplify, browser
walk, trunk-verified merge):

- **P0** hygiene: null-prototype catalog maps; the planForLink resolver
  (five sites folded).
- **P1** interaction polish: one-click supply apply; combined-view site
  focus.
- **P2** transport refinements: plan-file v4; per-end train-station
  sharedEnds; the honest pipe derate.
- **P3** the auto-chain builder: proposeChain (pure, exact,
  deterministic, catalog-verified acyclic) + additive apply + the Build
  chain panel.
- **P4** alt-recipe comparison: the override seam, absolute subtree
  cost rows, atomic applyRecipeSwap.

Review-gate highlights: the P4 design took three correctness rounds
(a real write-path Major + two fold-hygiene catches — including the
pair refuting a reviewer claim the team lead had relayed unverified);
the P3 adversarial pass proved the demand model and catalog empirics
before code; the P2 boundary caught trip edits wiping sharedEnds.
Release PR: (filled at arc close).
