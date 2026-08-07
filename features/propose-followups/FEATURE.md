# Propose follow-ups: consolidation, type-safety, routing (Stage 21 arc)

**Started:** 2026-08-07
**Status:** IN PROGRESS — P0 design
**Epic:** #108 (board #21, Stage 21 milestone 92)
**Directive:** Michael 2026-08-07, handed the four Stage 20 follow-ups:
**"do them."** That delegates the #104 UX call the ticket had reserved for him.

## Phase status

- **P0 (#104) — ore constrained-vs-natural UX**: DESIGN. The decision is
  mine per the directive.
- **P1 (#103) — adapter consolidation + compare tier-awareness**: pending.
- **P2 (#106) — branded `GatedCatalog`**: pending, blocked-by P1
  (consolidating first means fewer call sites to brand).
- **P3 (#105) — explicit byproduct routing**: pending. The largest design;
  carries both Stage-20 r1 reviewer analyses as input.

## Grounding (measured 2026-08-07 at arc start, against the bundled catalog)

Run before designing P0, and it **reframed the ticket**:

- `CatalogItem.isRawResource` EXISTS (`types.ts:28`, set at
  `docs-loader.ts:102` from the raw-resource group) — 13 items carry it. So
  the ticket's option (a) is available, not hypothetical.
- **32 items** classify `constrained` under the default exclusions — not the
  three the ticket named (Iron Ore, Copper Ore, Crude Oil). Of those, **12
  are raw-flagged** and **20 are not**.
- Every one of the 12 raw-flagged affected items is produced ONLY by
  `converter` and/or `packager` recipes — both members of
  `EXCLUDED_MACHINE_IDS`. **Except `coal`**, which also has two
  `constructor_mk1` ALTERNATES (Charcoal, Biocoal).
- The 20 non-raw affected items are packaged fluids, fuels, `polymer_resin`,
  `heavy_oil_residue`, `time_crystal`, `ficsite_ingot`, `dark_energy`,
  `quantum_energy` — genuinely constrained, and several are the
  alternate-only case the S20 P1 boundary fix deliberately established.

**Consequence for the design:** a blanket "raw-flagged ⇒ natural" rule would
strip `coal` of a real, useful recovery (you genuinely can make coal from
biomass without touching the converter). The rule has to key on whether the
recovery would be VACUOUS, not on the raw flag alone.

## Decisions log

- 2026-08-07 (Michael, epic #108): do all four follow-ups as one arc.
- 2026-08-07 (delegated): the #104 UX call is mine to make, grounded in the
  measurement above rather than the ticket's three-item guess.
