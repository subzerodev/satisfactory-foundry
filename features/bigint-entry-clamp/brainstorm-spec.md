# Bigint feed-entry clamp (#122)

Status: Frozen after correctness convergence and one-shot simplify approval.

## Classification

Tier 2: this is one coherent solver fix with no phase dependency, but it changes
observable behavior at an exact-arithmetic boundary and preserves persisted user
input. That semantic and compatibility risk is above the Tier-1 definition even
though the production edit is expected to be one small expression.

No research gate applies. The required behavior follows from the solver's
existing exact `Fraction` arithmetic, safe `machineCount` validation, and saved
override string contract.

## Problem and invariant

`solveFeedLane` computes a later feed slot's entry as
`floor(cumulative / d)`. The result is an exact `bigint`, but the current path
calls `toIndex` before clamping it to the stage's machine count `N`. A large,
previously accepted positive override can therefore throw when the quotient is
greater than `Number.MAX_SAFE_INTEGER`, even though the only observable entry is
`N` because entries beyond the last machine are unused.

`N` has already been validated as a non-negative safe integer when the public
`solveStage` entry point calls the lane solver. The lower-level exported
`solveFeedLane` does not validate that precondition itself; existing direct test
callers supply a safe integer and the new direct regressions must do the same.
Feed overrides are non-negative after #121, and this path runs only for `d > 0`,
so the quotient is non-negative. Comparing it to `BigInt(N)` is exact.

## Considered approaches

1. **Compare and clamp before narrowing (selected).** Compute the quotient as a
   `bigint`; if it is greater than or equal to `BigInt(N)`, use `N` directly,
   otherwise pass it to `toIndex`. This fixes the ordering error at its only
   call site and leaves all other safe-index guards intact.
2. Change `toIndex` to accept a maximum and clamp internally. This couples a
   general exact-to-number guard to feed-lane policy and risks hiding overflow
   at unrelated call sites such as belt counts and span draining.
3. Catch the `RangeError` in the store or solver and convert it to a finding.
   This treats a valid, exactly representable override as invalid and breaks
   saved-plan compatibility instead of calculating the already-defined clamp.

## Design

In the feed-belt construction loop in `src/core/manifold.ts`, keep the first
slot at entry `0`. For each following slot:

1. Calculate `entryQuotient = cumulative.floorDiv(d)` as `bigint`.
2. Compare `entryQuotient` with `BigInt(N)` before any conversion.
3. Use `N` when `entryQuotient >= BigInt(N)`; otherwise use
   `toIndex(entryQuotient)`.

Equality uses `N` directly because it is already a validated safe number and is
the exact observable value. Do not weaken or remove `toIndex`; it remains the
guard wherever an exact index genuinely must be represented as a number. Do not
change `FeedBelt`, findings, override validation, stage validation, output-lane
math, persistence schemas, or UI code.

Saved overrides remain decimal strings. `Fraction.parse` continues to parse
them exactly as bigint-backed fractions, and load continues to apply them
verbatim. No migration or format bump is required.

## Test-first sequence

1. Add a focused `src/core/manifold.test.ts` regression using `B = 1`,
   `d = 1/2`, and `N = 3`, which creates two automatic feed slots. Run it for a
   first-slot override of both `Number.MAX_SAFE_INTEGER` and
   `BigInt(Number.MAX_SAFE_INTEGER) + 1n`. In both rows, the following slot's
   raw quotient exceeds the safe-number range; assert that solving does not
   throw, its `entersAfterMachine` is exactly `3`, no emitted index exceeds
   `N`, only the first real span `[1..3]` is emitted, and the existing
   over-capacity finding retains the exact override as `peakFlow`.
2. Add the exact boundary characterization where the following slot's quotient
   equals `N`; assert entry `N`. This pins the `>=` branch independently of the
   huge-value rows.
3. Add a `src/state/store.test.ts` plan-lifecycle regression with the existing
   20-smelter/two-feed fixture and first feed override text
   `"270215977642229760"`. Its following-slot quotient is exactly
   `9007199254740992`, one above `Number.MAX_SAFE_INTEGER`. Assert the live solve
   is `solved`, save the plan, mutate away from it, reload it, and assert the
   exact override string is restored and the re-derived solve remains `solved`
   with the following slot clamped to machine `20`.
4. Confirm the new core tests fail with the current `RangeError` before the
   production edit. Implement only the comparison-order change, then run the
   focused manifold/store tests, `npm run check`, the full test suite, build,
   and `git diff --check`.

## Acceptance criteria

- A following feed slot whose exact entry quotient is at, above, or far above
  `N` reports `entersAfterMachine = N` without unsafe number conversion.
- `Number.MAX_SAFE_INTEGER` and larger first-slot overrides preserve exact
  capacities and findings; they do not make an otherwise valid stage invalid.
- A huge saved override round-trips as the identical string and re-solves after
  load.
- Quotients below `N` still narrow through `toIndex`, and all unrelated solver,
  validation, UI, and persistence behavior is unchanged.
- Production changes are confined to `src/core/manifold.ts`; test changes are
  confined to `src/core/manifold.test.ts` and `src/state/store.test.ts`.

## Assumptions ledger

- `solveStage` validates `machineCount` as a non-negative safe integer before
  lane solving (`src/core/manifold.ts:180-231`). The lower-level lane export does
  not repeat validation; direct test callers construct safe inputs.
- Negative overrides are rejected before feed-belt math, and degenerate or
  infeasible lanes return before this loop (`src/core/manifold.ts:338-360`).
- `Fraction.floorDiv` returns an exact `bigint`, while `Fraction.parse` accepts
  arbitrary-length decimal strings without number coercion
  (`src/core/fraction.ts:85-113,188-195`).
- Plans persist `Selection` user intent verbatim, including override strings,
  and load re-derives the solve (`src/data/plan-store.ts:1-7` and
  `src/state/store.ts:711-729`).
