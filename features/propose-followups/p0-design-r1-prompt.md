# Design review r1 — S21 P0 (#104): ore constrained-vs-natural UX

Review `features/propose-followups/p0-brainstorm.md` (v1) in the repo at
`/home/subzerodev/workspace/satisfactory-foundry` (develop). DESIGN review —
no diff exists yet.

Context: this is the UX call ticket #104 reserved for Michael; he delegated
it ("do them", 2026-08-07), so the doc makes the decision. Stage 20 shipped
in full, so the classifier this touches is the post-P3 one.

## A. Current-state anchors (verify against live source)

- `src/data/types.ts:28` — `isRawResource?: boolean` (OPTIONAL; the comment
  at :16-28 records why). Set at `src/data/docs-loader.ts:102` from the
  raw-resource group.
- `src/ui/chain-builder-adapter.ts` — `causeOf` (the classifier),
  `producerRecipesFor` (alternate-INCLUSIVE, filters only by machine
  exclusions), `effectiveDefaultRecipe` (skips alternates),
  `EXCLUDED_MACHINE_IDS`, `gateCatalog`, and the four-cell `leverOf` matrix.
- `src/ui/ChainBuilder.tsx` — the constrained-row rendering and its inline
  recovery; the plain RAW line.
- The S20 pins this must not break: `constrained` ⇔ `hasAnyProducer(ungated)`
  ∧ `effectiveDefaultRecipe(gated, exclusions) === null`; the alternate-only
  collapse MUST stay constrained with live recovery (the P1 boundary r1 fix);
  P3's lever matrix must stay total.

## B. Claims to verify

1. **The measurements.** The doc rests on numbers I took this session and
   they reframe the ticket — verify them yourself against
   `public/bundled-docs/en-US.json` rather than trusting the doc:
   - `isRawResource` exists and 13 items carry it;
   - **32** items classify `constrained` under the default exclusions
     (12 raw-flagged, 20 not) — the ticket claimed 3;
   - all 12 raw-flagged affected items are produced ONLY by
     converter/packager, **except `coal`**, which also has two
     `constructor_mk1` alternates.
   If any of these is wrong the design's central argument changes.
2. **Axis 1 — the refined rule.** `natural` ⇔ `isRawResource` ∧
   `producerRecipesFor(ungated, itemId, exclusions).length === 0`. Does the
   `coal` counterexample really kill the blanket "raw ⇒ natural" rule, and
   does this refinement actually preserve coal's recovery? Is
   alternate-INCLUSIVE the right predicate here (the doc argues
   `effectiveDefaultRecipe` would be alternate-blind and wrongly natural-ize
   coal — check that).
3. **Axis 2 — the rule lives in `causeOf`, not the render layer.** Sound?
   Does anything else read `rawInputs[].cause` such that changing it has a
   consequence the doc missed (esp. P3's lever matrix and the "Nothing to
   build" condition)?
4. **Axis 3 — tier interaction.** The vacuity test runs against the UNGATED
   catalog with current exclusions, so a tier-recoverable case stays
   constrained. Verify this keeps P3's four-cell matrix TOTAL — is there a
   cell that now becomes unreachable, or an item that falls through with no
   line at all?
5. **Spec + tests.** Is the test list sufficient — in particular does the
   `coal` row actually FAIL if someone writes the blanket rule? Is pinning
   against the REAL bundled catalog right here, or brittle?
6. The assumptions ledger's grounding.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings. Do NOT spawn nested
agents.
