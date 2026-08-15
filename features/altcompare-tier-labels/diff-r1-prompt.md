# Diff review r1 — #115 AltCompare tier-locked labels

Worktree: `/home/subzerodev/workspace/satisfactory-foundry`
Cumulative diff under review:
`/home/subzerodev/workspace/satisfactory-foundry/features/altcompare-tier-labels/diff-r1.diff`

Reviewer mode: degraded same-vendor. Apply your assigned reviewer role exactly;
return one of `APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED` as
the final line. Verify cited source against the live worktree before relying on
it.

## A. Current-state anchors to verify

1. #115's settled decision: AltCompare labels tier-locked candidates and never
   hides them.
2. `Catalog.recipeUnlocks` is recipe id -> minimum unlock tier; absent key means
   ungated.
3. `ProposePrefs.unlockedTier` default is `null` ("all"), which is the known
   pass-either-way trap for tests that do not explicitly set a tier.
4. `AltCompare` is intentionally ungated and Apply remains available for
   non-current rows.

## B. What changed

1. `CandidateRow` gained `lockedTier: number | null`.
2. `candidateRowsFor` now accepts a trailing defaulted
   `unlockedTier: number | null = null` and computes `lockedTier` when
   `unlock > unlockedTier`.
3. `altCompareModel` now accepts the same trailing default, while `AltCompare`
   explicitly reads `proposePrefs.unlockedTier` and passes it through.
4. The recipe cell renders ` (locked T<n>)` with the existing
   `.alt-compare-mark` class; rows are not hidden and Apply is not disabled.
5. `AltCompare.test.tsx` adds an SSR pin that explicitly seeds
   `unlockedTier: 0`, expects the locked label on the alternate row, expects the
   standard row to remain unlabeled, expects Apply to remain present, then
   verifies `unlockedTier: null` removes the lock label.
6. `features/altcompare-tier-labels/r2-verification.log` records
   bidirectionality: breaking the production `lockedTier` assignment to `null`
   fails the new test; restoring the threshold assignment passes.

## C. Pre-review hygiene already run

```text
npx vitest run src/ui/AltCompare.test.tsx
Test Files  1 passed (1)
Tests  13 passed (13)

npm run check
tsc -b && eslint . && prettier --check src
All matched files use Prettier code style!

npm test
Test Files  33 passed (33)
Tests  918 passed (918)
```

## D. Review focus

- Confirm the threshold handles `null`, absent unlock, equal tier, and above-tier
  cases correctly.
- Confirm existing callers that omit the new helper arguments stay on the
  no-gate path.
- Confirm the SSR test would fail if the production label path were missing and
  does not rely on default `unlockedTier`.
- Confirm Apply behavior and row visibility are unchanged except for the new
  label.
- Confirm the bidirectionality log contains a real failure line for the new
  test.
