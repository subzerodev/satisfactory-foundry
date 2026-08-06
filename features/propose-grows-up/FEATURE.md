# Propose grows up: info + customization (Stage 20 arc)

**Started:** 2026-08-06
**Status:** IN PROGRESS — P0 design
**Epic:** #98 (board #21, Stage 20 milestone 91)
**Directive:** Michael 2026-08-06 — "we can give more info and customisation
there" → the full option menu → **"all of them as one arc."**

## Phase status

- **P0 (#99) — info layer** (cost sheet, tree preview, alternates tell):
  IN PROGRESS — design loop.
- **P1 (#100) — customization core** (recipe picker via the existing
  overrides seam, treat-as-raw, exposed machine exclusions): blocked-by P0.
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
