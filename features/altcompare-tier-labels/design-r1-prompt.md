# Design review r1 — #115 AltCompare tier-locked labels

Worktree: `/home/subzerodev/workspace/satisfactory-foundry`
Artifact under review:
`/home/subzerodev/workspace/satisfactory-foundry/features/altcompare-tier-labels/brainstorm-spec.md`

Reviewer mode: degraded same-vendor. Apply your assigned reviewer role exactly;
return one of `APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED` as
the final line. Verify citations against the live worktree before relying on
them.

## A. Current-state anchors to verify

1. #115's board decision is settled: label tier-locked AltCompare candidates,
   never hide them. Hiding is out of scope for this review.
2. `src/data/types.ts` requires `Catalog.recipeUnlocks: Record<string, number>`;
   absent means no recipe gate.
3. `src/state/store.ts` defines `ProposePrefs.unlockedTier: number | null`;
   default `null` means all recipes.
4. `src/ui/chain-builder-adapter.ts` defines `CandidateRow` with UI-facing row
   facts and builds rows in `candidateRowsFor`.
5. `src/ui/AltCompare.tsx` reads the store directly, calls `altCompareModel`,
   renders recipe-cell inline marks with `.alt-compare-mark`, and leaves Apply
   available for non-current rows.
6. `src/ui/AltCompare.test.tsx` uses SSR `renderToStaticMarkup` with a
   `getInitialState` seam; tests that do not explicitly seed
   `proposePrefs.unlockedTier` would not exercise a tier lock because the
   default is `null`.

## B. Proposed design to review

The design adds a nullable `lockedTier` row field, computed in
`candidateRowsFor` from `catalog.recipeUnlocks[candidate.id]` and an explicit
`unlockedTier` argument. `AltCompare` reads `proposePrefs.unlockedTier`, passes
it through `altCompareModel` to `candidateRowsFor`, and renders
` (locked T<n>)` with the existing `.alt-compare-mark` class after `(alt)` and
before byproducts. Apply stays enabled for locked non-current rows.

## C. Review focus

- Does the proposed data flow preserve AltCompare's thin-render-shell shape, or
  is there a simpler/lower-risk place to compute the label without violating the
  settled decision?
- Is `lockedTier = unlock > unlockedTier` the correct threshold for
  `recipeUnlocks` and `unlockedTier`, including `null` and absent-key cases?
- Does the test plan actually close the known trap where `unlockedTier` defaults
  to `null`?
- Is the wording `locked T<n>` precise enough, and does it avoid implying Apply
  is disabled?
- Is any current behavior accidentally changed beyond adding the label?
