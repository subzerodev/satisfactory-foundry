# #115 — AltCompare tier-locked labels

## Status

Tier 2 single-feature design, written from the board decision context on
2026-08-16. The decision is already settled by #103 / #115: **label locked
candidates; never hide them**.

## Already settled — do not re-litigate

- AltCompare is deliberately ungated. It serves the applied graph, where a stage
  may legitimately run a recipe above the current Propose tier.
- A tier-locked row remains visible and applyable. This planner labels truth; it
  does not enforce progression.
- The test must set `proposePrefs.unlockedTier` explicitly. The store default is
  `null` ("all"), so an unset test passes even if no lock labeling exists.
- #116 already landed the explicit `(alt)` marker, so tier labeling composes with
  an existing inline mark in the same recipe cell.

## Grounding

- `Catalog.recipeUnlocks` is required data (`src/data/types.ts`): recipe id to
  minimum unlock tier; an absent key means always available.
- `ProposePrefs.unlockedTier` is persisted store state (`src/state/store.ts`):
  `null` means all recipes, otherwise recipes whose minimum unlock tier exceeds
  it are above the current Propose gate.
- `CandidateRow` already carries UI-facing row facts (`recipeName`,
  `isCurrent`, `isAlternate`) from `candidateRowsFor`.
- `AltCompare` is a thin render shell over pure helpers. Keeping the lock state
  on `CandidateRow` preserves that architecture.

## Design

Add `lockedTier: number | null` to `CandidateRow`.

- In `candidateRowsFor`, read `const unlock = catalog.recipeUnlocks[candidate.id]`.
- Set `lockedTier` to `unlock` only when `unlockedTier !== null && unlock !==
  undefined && unlock > unlockedTier`; otherwise `null`.
- Add `unlockedTier: number | null = null` as a trailing defaulted argument to
  `candidateRowsFor`, and pass it from `altCompareModel`. The default preserves
  existing helper tests and callers on the explicit no-gate path.
- Extend `altCompareModel` with the same trailing defaulted argument;
  `AltCompare` reads `proposePrefs.unlockedTier` directly from the store and
  passes it through.
- Render `lockedTier` in the recipe cell with the existing
  `.alt-compare-mark` class, after `(alt)` and before byproducts:
  ` (locked T<n>)`.
- Leave Apply enabled for locked non-current rows. Current rows still render the
  existing `current` mark instead of Apply.

## Rejected alternatives

- **Hide locked rows**: contradicts the settled decision and can hide the
  currently-applied recipe.
- **Compute lock state in `AltCompare.tsx`**: works, but pushes domain-row facts
  into the render shell and duplicates the existing `CandidateRow` pattern.
- **Disable Apply for locked rows**: turns a compare label into policy
  enforcement and blocks imported or intentionally-over-tier plans.

## Test plan

- Add an SSR test that seeds `proposePrefs.unlockedTier` to `0` and sets
  `CAT.recipeUnlocks.r_alt = 1`. Assert the alternate row renders
  ` (alt)` and ` (locked T1)`, while the standard row has neither lock text nor
  altered Apply/current behavior.
- In the same test, assert the Apply button still appears for the locked
  non-current row.
- Add a second SSR pass with `unlockedTier: null` against the same catalog to pin
  the pass-either-way trap: the lock label must disappear when the tier gate is
  all.
- Run `npx vitest run src/ui/AltCompare.test.tsx`, `npm run check`, and
  `npm test`.
- Record bidirectionality in `features/altcompare-tier-labels/r2-verification.log`
  by breaking the `lockedTier` assignment and showing the new SSR test fails,
  then restoring and showing it passes.

## Revision history

- v1: Initial design from #115/#103 decision trail. Settles row field,
  `locked T<n>` wording, and enabled Apply behavior.
- v2: Folded simplify nit: make the new `unlockedTier` helper arguments
  trailing defaults (`= null`) so existing pure-helper callers stay on the
  no-gate path without mechanical churn, while production still passes the real
  store value explicitly.
