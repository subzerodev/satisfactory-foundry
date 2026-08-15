# Propose follow-ups: consolidation, type-safety, routing (Stage 21 arc)

**Started:** 2026-08-07
**Status:** IN PROGRESS — P0 DONE, P1 DONE, P2 CLOSED won't-do; P3 (#105) next
**Epic:** #108 (board #21, Stage 21 milestone 92)
**Directive:** Michael 2026-08-07, handed the four Stage 20 follow-ups:
**"do them."** That delegates the #104 UX call the ticket had reserved for him.

## Phase status

- **P0 (#104) — ore constrained-vs-natural UX**: DONE 2026-08-07 (merge
  `f34bbf6`; 907 tests trunk-verified). Design v5 FROZEN after FOUR rounds
  in which THREE rules were proposed and TWO killed by counterexample:
  each single-keyed rule is the exact negation of one of Stage 20's
  recovery levers, so each silently ate a matrix cell — keying on the live
  exclusions eats the `machine` lever (tick Constructor, coal loses its
  picker AND its hint); keying on the default constant eats the `tier`
  lever (un-tick Converter below tier 9, Iron Ore loses a real "raise
  TIER"). The surviving rule is the CONJUNCTION: `isRawResource` ∧ no
  eligible producer under the default constant ∧ none under the live set.
  Both reviewers proved it holds and neither could break it.
  Three boundary rounds + the simplify pass: r1 found the phase's EIGHTH
  pass-either-way test (an assertion whose target was already absent
  pre-change) and that the accepted regression was pinned while the
  improvement it paid for was not; the simplify pass found ~45 lines of
  process archaeology in live source and one fully subsumed test row,
  whose deletion was proven free by the mutant count falling 6 → 5 with
  every other set byte-identical.
  **The spec itself contained a non-discriminating test** — the
  implementer found that the `polymer_resin` row I nominated cannot fail
  (its producer is in neither exclusion set), kept it, and added
  `packaged_water`, which does enforce the claim. It also overruled two of
  my relayed instructions and was right both times (90/min, not 60; 15/5,
  not 14/6).
  Walk: all five cases live, including both rule-killers — excluding
  Constructor keeps coal's machine lever; un-excluding Converter at tier 8
  keeps Iron Ore's tier lever.
- **P1 (#103) — adapter consolidation + compare tier-awareness**: DONE
  2026-08-15 (merge `0805af0`; design v4 FROZEN after THREE rounds; 912 tests).
  `candidateRecipesFor` is retired onto `producerRecipesFor` with no comparator
  and no ordering shim — safe only because **#116** shipped an explicit `(alt)`
  marker first (`b3ed867`), so the grouped ordering was no longer the compare
  table's only alternate signal. The #103 research probe was
  RE-RUN rather than trusted from the audit trail; it reproduced 0 set diffs /
  3 order-only diffs and surfaced a number the original probe never reported —
  **63 items have exactly one eligible producer**, so `candidateCount`'s
  documented range (`0 or ≥2 by construction`) becomes false for a third of the
  catalog. The render survives (the sole consumer branches on `>= 2`, and both
  `0` and `1` sit below it), but the prose invariant and the test guarding it
  (`chain-builder-adapter.test.ts:841`, "Never a bare 1") both become lies.
  That test is flagged as the phase's pass-either-way danger point: it must be
  rewritten to pin the CHIP, not the count.
  Compare tier-awareness (the S20 P3 scope addition) is DECIDED here — label
  locked candidates, never hide them — and split to **#115** for the build, so
  a refactor does not carry a feature.
- **P2 (#106) — branded `GatedCatalog`**: **CLOSED won't-do** 2026-08-15, on
  measurement rather than judgement (report + harness in
  `features/branded-gated-catalog/`). Ran after P1 landed, so the count is of
  the consolidated surface the blocker was there to produce. Of the fifteen
  value-passing places in ChainBuilder where the gated/ungated swap compiles,
  **nine already turn `ChainBuilder.gating.test.tsx` red**; of the six that do
  not, one (`byproductSuggestions`) is provably inert, one (`recipeLabel` in the
  recovery `<select>`) is a real but untested gap split to **#117**, and four
  `repropose` callers are unproven gaps split to **#118**. The measured
  five-seam brand would have closed nothing the suite misses; a sixth
  `recipeLabel` narrowing could catch #117 but not #118. Ships as one
  `gateCatalog` doc comment recording why the type stays out.
  Three design rounds, all NEEDS_REWORK ×2 — the reviewers killed two successive
  justifications, the second time by proving my headline "uncovered seam" was
  behaviour-preserving.
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
