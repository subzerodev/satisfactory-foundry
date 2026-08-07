# Design review r4 (delta-scoped) — S20 P3 (#102)

Re-review of `features/propose-grows-up/p3-brainstorm.md` (v4) in
`/home/subzerodev/workspace/satisfactory-foundry` (develop). You both
converged at r3 (APPROVED / APPROVED_WITH_NITS). The one-shot design
simplify pass then ran and returned advisory findings; the fold
contract requires the CORRECTNESS pair to re-run on the changed
artifact (the simplify pass is not re-invoked).

## The deltas (the ONLY changes since the v3 you approved)

1. **`recipeUnlocks` narrowed** to `Record<string, number>` (recipe id
   → min unlock tier). `RecipeUnlockSource` / `RecipeUnlock` deleted:
   nothing read `source`, and `CatalogRecipe.isAlternate`
   (`src/data/types.ts:80`) already carries the alternate distinction.
   (Axis 3, spec items 1-2, spec-8 test row.)
2. **Threading mechanism replaced** (Axis 4, spec items 5-6). v3:
   `unlockedTier` rides ProposeOptions/PreviewOptions and the adapter
   gates internally. v4: ChainBuilder derives `const gated =
   gateCatalog(catalog, unlockedTier)` ONCE per propose and passes
   `gated` where the gated world is wanted, `catalog` where the
   ungated world is wanted; `unlockedTier` is OUT of both options
   bags; `PreviewOptions` gains `ungatedCatalog?: Catalog`
   (defaulting to the passed catalog) to carry the second world;
   the five gate-sensitive ChainBuilder call sites are named
   explicitly (`:237`, `:418`, `:526`, `:569`, `:578`);
   `candidateRecipesFor`/`effectiveDefaultRecipe`/
   `producerRecipesFor`/`pickerOptionsFor` signatures UNCHANGED.
3. Documentation-only: spec 5 says "four-cell matrix per Axis 4"
   (was a three-name vocabulary); two test rows replaced by pointers
   to existing pins (`catalog-store.test.ts:128`/`:132`,
   `chain-builder-adapter.test.ts:1258`); Axis 2 records why
   seed-and-mirror was chosen over store-backed controls.

## Your question

**Do the r1-r3 correctness folds survive delta 2?** Specifically:
- causeOf's both-worlds requirement: `hasAnyProducer` must read the
  UNGATED world while effectiveness reads the GATED one. Does
  `PreviewOptions.ungatedCatalog?` (default = passed catalog)
  deliver that, and is the default byte-identical for every existing
  caller (`toProposalPreview` at ChainBuilder + any test caller)?
- The four-cell lever matrix still has both worlds available where it
  is computed?
- Identity-at-null: with derive-once, is `gated === catalog` at null
  (same reference) so nothing downstream can observe a difference?
- Are the five named call sites the COMPLETE set of gate-sensitive
  ChainBuilder→adapter calls (check for any I missed), and is passing
  `gated` to each of them correct — i.e. is there any site that
  should keep the ungated catalog?
- Delta 1: does any part of the design still reference `source` or a
  `RecipeUnlock` wrapper (residue)?
- Any new hole the mechanism swap opens.

Everything else in v4 was approved at r3 — do not re-litigate.
Return exactly one verdict (APPROVED / APPROVED_WITH_NITS /
NEEDS_REWORK / BLOCKED) with line-cited findings.
