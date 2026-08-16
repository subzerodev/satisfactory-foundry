# Negative load override validation (#121)

Status: Frozen after design correctness convergence and simplify disposition.

## Problem

The UI accepts arbitrary override text. `parseOverrideSide` rejects malformed
text but accepts negative `Fraction` values, which then violate `drainSpan`'s
`available >= 0` precondition. Direct callers of `solveFeedLane` and
`solveOutputLane` can pass the same invalid values without the store.

## Settled contract

- Negative feed or output overrides are invalid.
- Zero is valid and means no material is delivered/carried by that slot.
- The app surfaces negative text through the existing `SolveState` reason
  `bad-override`; no new UI error channel is needed.
- The pure solver independently rejects negatives so its public functions do
  not rely on store-only validation.
- Serialization shape and existing positive-override semantics do not change.

## Target design

### Store boundary

In `parseOverrideSide`, parse each non-null cell once. If the result is
negative, throw a `RangeError` naming the item and one-based override slot.
The existing `derive` catch converts it to `status: "invalid"`, reason
`bad-override`. Zero passes unchanged.

### Pure solver boundary

Add `negative-override` to the lane-local `invalid-input` reason union. Before
either lane solver performs count, entry, or drain math, scan its optional
override array **immediately after constructing the empty lane result and
before every degenerate, infeasible, count, entry, or drain early return**. On
the first negative value, emit one lane-local
`invalid-input` finding with the item and one-based slot, then return the
otherwise-empty lane result.

Use one small shared helper in `manifold.ts` because feed and output need the
identical check and finding shape. Do not broaden global stage validation:
an invalid override belongs to its lane, matching
`overrides-exceed-belt-count` and preserving solved sibling lanes for direct
core callers. The app still stops earlier at the store boundary.

Both boundaries own one exact detail template:

```text
lane <itemId> override <one-based slot> must be zero or positive; got <value>.
```

The first negative array cell wins. Tests use a nonzero index so zero-based vs
one-based mistakes cannot pass.

### Zero behavior

- Feed zero reaches the existing head-first drain. With no surviving prior
  flow it reports complete starvation; with carry-in it may partially serve
  the span from that exact residual. Both are existing manifold behavior.
- Output zero reaches the existing binding-capacity comparison and emits
  `segment-over-capacity` with capacity zero.

No special zero branch is added; tests pin the existing mathematically defined
paths.

## Test-first sequence

1. Store RED: negative feed and output strings each yield `bad-override` with
   the exact detail template above; zero remains `solved`.
2. Core RED: direct feed and output lane calls with a negative override each
   return one `negative-override` lane finding and no belts/segments. Use two
   negative cells and assert the earlier one's one-based slot/detail wins.
3. Core characterization: zero feed with no carry-in reports full starvation;
   a zero second feed with residual carry pins partial service; zero output
   reports over-capacity against zero.
4. Precedence matrix: negative overrides still win for `N=0`, zero-rate, and
   `d > B` lanes, and an array that also exceeds the auto belt count, on both
   feed and output paths.
5. `solveStage` integration: one invalid feed and one invalid output lane each
   keep the finding lane-local, leave stage findings empty, and do not prevent
   valid feed/output siblings from solving.
6. Implement the shared core guard and store parse check.
7. Run focused store/manifold tests, `npm run check`, full tests, and build.

## Acceptance criteria

- Negative override text cannot reach manifold arithmetic from the app.
- Direct pure solver calls cannot violate `drainSpan`'s nonnegative precondition.
- Zero has explicit, tested feed and output behavior.
- Positive, null, malformed, excess-count, persistence, and sibling-lane
  behavior remain unchanged.
- No format bump or new UI component.

## Assumptions ledger

- `Fraction.isNegative()` is the exact sign test already used for lane rates in
  `solveStage`.
- Lane-local invalid findings are the existing core precedent for override
  value/shape problems.
- The store's `bad-override` catch is the established user-facing boundary and
  already renders through `FindingsPanel`.
