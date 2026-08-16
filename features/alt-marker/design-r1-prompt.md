# Design review r1 — #116, AltCompare `(alt)` marker

Review `features/alt-marker/brainstorm-spec.md` (v1) in the repo at
`/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`).

Stage: **DESIGN**, Tier 2. Nothing implemented yet.

## Why this ticket exists (context, already settled — do not re-litigate)

#116 was promoted from a follow-up to a **predecessor of #103** at #103's r2
design gate. #103 retires `candidateRecipesFor`, which drops the non-alternate-
first grouping that is currently the comparison table's ONLY alternate signal.
Rather than have #103 preserve that grouping with a comparator plus an ordering
pin that #116 would immediately make redundant, #116 lands first. That
sequencing decision is settled; review this design on its own merits.

## A. Current-state anchors — verify each against live source

- `src/data/docs-loader.ts:185-191` — `isAlternate` derivation and the
  `Alternate: ` prefix strip at `:190`.
- `src/data/docs-loader.test.ts:175` — the pin on that strip.
- `src/data/types.ts:80` — `CatalogRecipe.isAlternate`.
- `src/ui/chain-builder-adapter.ts:514-538` — the `CandidateRow` interface.
- `src/ui/chain-builder-adapter.ts:965-985` — where rows are constructed.
- `src/ui/AltCompare.tsx:1-15` (the stated thin-shell architecture), `:150-172`
  (the render), `:153` and `:169` (how the CURRENT row is marked).
- `src/ui/ChainBuilder.tsx:660-674` — `recipeLabel` and its three composed tags.
- `src/ui/app.css:1609-1612` — `.alt-compare-byproducts`.
- `src/ui/AltCompare.test.tsx:1-7` (the stated no-jsdom discipline), `:245-288`
  (the two existing `renderToStaticMarkup` smokes, including the store-seeding
  trick at `:255-287`), and the `CAT` fixture near `:25-60`.

## B. Claims to verify

1. **Axis A** — is putting `isAlternate` on `CandidateRow` right, or is the
   component-side computation simpler? Check the stated architecture at
   `AltCompare.tsx:8-13` actually says what the design quotes.
2. **Axis B** — is rejecting `recipeLabel` reuse correct? Confirm that
   `(default)` and `(machine excluded)` really would be noise here: are
   excluded-machine recipes genuinely absent from the candidate list, and is the
   current row genuinely already marked?
3. **Axis C** — the design argues ChainBuilder's plain-text `(alt)` is *forced*
   by `<option>` styling limits rather than chosen, and therefore should not be
   copied. Is that reasoning sound, or is it over-thinking a 4-line CSS
   addition? This is the one place the design spends anything — pressure it.
4. **Axis E** — verify the "nothing else changes" claim. Does adding a field to
   `CandidateRow` touch ordering, the `< 2` gate, `swapPayloadFor`,
   `candidateCount`, serialization, or any snapshot?
5. **The test plan** — the critical question. Both pins are specified to assert
   **presence AND absence**, because a presence-only pin passes against a
   hardcoded `isAlternate: true`. Is that sufficient? Walk each pin and name any
   mutant that survives it. This repo has shipped **nine** tests that passed
   whether the code was right or wrong; assume a tenth is hiding here.
6. **The no-jsdom claim** — confirm `renderToStaticMarkup` can actually render
   this component with the store seeding shown at `AltCompare.test.tsx:255-287`,
   and that the `CAT` fixture really does contain both a standard and an
   alternate producer for the compared item. If the render pin is not writable
   as specified, say so — it is the only pin that tests the feature's actual
   user-visible effect.
7. **Axis F** — is declining to generalize to `tags: string[]` correct, given
   #115 will add a second marker to this same row?

## C. Anything the design missed

Especially: another surface that renders `CandidateRow` and would now need the
marker; an existing test that asserts on the full cell text and would break; a
type-exhaustiveness site that must enumerate `CandidateRow` fields.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged (`BLOCKER` / `IMPORTANT` / `NIT`), line-cited
findings. This is a small change — if it is sound, approve it honestly rather
than manufacturing findings to justify a round.

Do NOT spawn nested verification agents; verify yourself and return your verdict
directly.
