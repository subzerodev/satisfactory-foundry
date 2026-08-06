# Propose grows up: info + customization (Stage 20 arc)

**Started:** 2026-08-06
**Status:** IN PROGRESS — P0 design
**Epic:** #98 (board #21, Stage 20 milestone 91)
**Directive:** Michael 2026-08-06 — "we can give more info and customisation
there" → the full option menu → **"all of them as one arc."**

## Phase status

- **P0 (#99) — info layer**: DONE 2026-08-06 (merge on develop; 782
  tests, +9). Design v3 FROZEN after 4 review rounds (r1 caught a wrong
  signature + a false walk premise; simplify widened proposalMetrics
  with the varies bounds; r3 pinned the degenerate envelope). Boundary
  APPROVED+APPROVED (0); diff-simplify APPROVED (0); 4-behavior
  bidirectionality log. Walk: cost sheet 928 MW exact == TitleBlock
  Σ ≈ 928 MW (within-1-MW check); tiers T0-T3; fan-out feeds; recipe
  chips; both themes.
- **P1 (#100) — customization core**: DONE 2026-08-07 (merge on develop;
  814 tests, +32). Design v7 FROZEN after SIX correctness rounds (r1
  stage-deletion trap; r2 honesty gaps; r3 chip contradiction; r4
  reachability dead-end; r5-r6 layering coherence) + simplify (one
  collapse rejected → #103). Boundary r1: both reviewers converged on a
  real classifier defect (alternate-only collapse mislabeled "natural",
  recovery dead-coded) — fixed, cycle-7 logged; r2 APPROVED×2; simplify
  fold merged the two propose paths. Walk: alternate pick re-proposed
  live; override cleared on default-back; RAW toggle + strip; Smelter
  exclusion → Copper Ingot constrained with LIVE inline recovery →
  returned as Foundry ×3; Apply landed the customized chain; both
  themes. Field note: converter-only ores (Iron/Copper Ore, Crude Oil)
  honestly classify "constrained" — polish question parked as #104.
- **P2 (#101) — solver extensions** (clock-percent target, byproduct
  routing suggestions): blocked-by P1. Overclock power-curve exponent is
  research-gated at design.
- **P3 (#102) — persistence + gating** (saved alternate preferences,
  tier/unlock gating): blocked-by P2. Tier-data availability in the
  catalog is research-gated at design.

## Grounding (verified 2026-08-06 at arc start)

- `src/core/chain-builder.ts` selectProducer already takes a validated
  per-item `overrides` map (Stage 8 P4) — unused by the Propose UI.
- `src/ui/chain-builder-adapter.ts` alt-compare machinery already computes
  chain metrics (power/machines/raw cost); `EXCLUDED_MACHINE_IDS` is a
  hardcoded module constant; `previewRowText` renders the flat row.
- `src/ui/ChainBuilder.tsx` (167 lines): item select + rate input +
  Propose/Apply; preview is component-local ephemeral state.
- `src/data/tiers.ts` exists (P3 design verifies what it carries).

## Decisions log

- 2026-08-06 (Michael, epic #98): all improvements, one arc; sequencing
  info → customization → solver → persistence (cost/dependency order).
