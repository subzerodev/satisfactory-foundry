# Design review r3 (delta-scoped) — S21 P1 (#103)

Re-review of `features/propose-followups/p1-brainstorm.md` (**v3**, commit
`7a6730e`) in `/home/subzerodev/workspace/satisfactory-foundry` (branch
`develop`).

**The ticket was BLOCKED at r2 and is now UNBLOCKED.** v3 was written against
exactly this post-unblock world, so it needs no rework — review it as it stands
plus the one thing that changed underneath it.

## What changed in the world since v3 was written

**#116 shipped and merged** (`b3ed867`). It adds an explicit `(alt)` marker to
the AltCompare row. That was v3's Axis 2 option (d) predecessor, and its landing
is what makes v3's plan valid: `candidateRecipesFor`'s non-alternate-first
ordering is **no longer the comparison table's only alternate signal**, so #103
can delete the function outright and use `producerRecipesFor`'s order directly —
no comparator, no ordering-preservation pin.

**#116 also added a field v3's spec predates:** `CandidateRow.isAlternate`
(`chain-builder-adapter.ts:521-523`), set at `:980` from
`candidate.isAlternate`. And it added three test pins:
- `chain-builder-adapter.test.ts` — "carries isAlternate from the RECIPE, not
  from the selection (#116)" (synthetic fixture, two polarities)
- `chain-builder-adapter.test.ts` — "flags isAlternate against REAL parsed
  names, not a name prefix (#116)" (real bundled catalog, `iron_ingot`)
- `AltCompare.test.tsx` — "marks the ALTERNATE row, whichever row is current
  (#116)" (two SSR passes)

## Your questions

1. **Does v3's spec still apply cleanly?** Walk each spec item against current
   `develop`. v3 cites line numbers that #116's insertions have shifted — say
   which are now wrong and what the correct ones are.
2. **Do #116's three pins survive this change?** The consolidation alters the
   candidate list's ORDER (`candidateRecipesFor`'s grouped order →
   `producerRecipesFor`'s default-first-then-ascending). #116's pins assert
   `isAlternate` VECTORS, which are order-sensitive. Specifically:
   - the synthetic pin asserts `[false, true]` on a 2-recipe fixture;
   - the real pin asserts `[false, true, true, true, true]` on `iron_ingot`
     (1 non-alternate + 4 alternates).
   Do either of those vectors change under the new ordering? If yes, the spec
   must say so and update them — a silently-broken #116 pin is the worst
   possible outcome of this refactor.
3. **Does `CandidateRow.isAlternate` survive the `candidateRowsFor` rewrite
   untouched?** Spec item 3 rewrites how candidates are sourced; confirm the row
   construction (including the new field) is unaffected.
4. **Is spec item 8's `rubber` ordering pin still correct** as
   `[residual_rubber, alternate_recycled_rubber, rubber]`, and does it now
   conflict or overlap with any #116 pin?
5. Anything else in v3 that the #116 merge invalidated.

## Do NOT re-litigate (settled at r1/r2)

- Axis 3's "the render is unchanged" claim (`candidateCount` gaining the value
  1 for 63 items) — both reviewers attacked and could not break it.
- That nothing outside `src/` imports `candidateRecipesFor`.
- That #106 does not depend on the removed surface.
- The corrected reading of `AltCompare.tsx:81` as a LIVE guard that
  consolidation makes the only one.
- Axis 5 (#115) and Axis 6 (#116) being split out.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings.

Do NOT spawn nested verification agents; verify yourself and return your verdict
directly.
