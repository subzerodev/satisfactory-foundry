# S21 P1 (#103) — adapter consolidation: retire `candidateRecipesFor`

**Status:** v1 — DRAFT, not frozen.
**Ticket:** #103 (Stage 21 milestone 92, epic #108).
**Origin:** simplify-pass finding from the S20 P1 design gate (#100), deferred
out of that phase because the AltCompare call sites were pinned untouched
mid-arc.

## Purpose

`candidateRecipesFor` and `producerRecipesFor` apply the SAME filter
(`primaryOutputId === itemId` ∧ machine not excluded) and differ only in two
things: a `< 2 ⇒ []` gate, and the tail ordering. The gate is a **UI affordance
living inside a data function** — the comparison block wants "don't offer a
comparison of one". Retiring `candidateRecipesFor` moves that gate to the caller
that actually wants it and leaves one enumeration function.

## Grounding — MEASURED against the bundled catalog, not recalled

Probe run 2026-08-15 over all 195 catalog items, comparing
`candidateRecipesFor(cat, id, EXCLUDED_MACHINE_IDS)` against
`producerRecipesFor(cat, id, EXCLUDED_MACHINE_IDS)`:

| Measure | Value |
|---|---|
| Items total | 195 |
| Items with a non-empty candidate list (≥2 eligible) | 63 |
| **SET differences** | **0** |
| **ORDER-only differences** | **3** — `liquid_fuel`, `plastic`, `rubber` |
| Items with EXACTLY 1 eligible producer (`cand` = 0, `prod` = 1) | **63** |

The three ordering diffs, verbatim from the probe:

```
liquid_fuel  cand=[liquid_fuel, residual_fuel, alternate_diluted_fuel]
             prod=[liquid_fuel, alternate_diluted_fuel, residual_fuel]
plastic      cand=[plastic, residual_plastic, alternate_plastic_1]
             prod=[plastic, alternate_plastic_1, residual_plastic]
rubber       cand=[residual_rubber, rubber, alternate_recycled_rubber]
             prod=[residual_rubber, alternate_recycled_rubber, rubber]
```

In all three the **leading (baseline) row is identical**; only positions 2 and 3
swap. `candidateRecipesFor` groups every non-alternate before every alternate;
`producerRecipesFor` leads with the effective default and then sorts the tail by
plain ascending id, which can lift an alternate above a standard recipe (`rubber`
is the clearest case).

### The research-gate correction this design is built on

The ticket's stated precondition — *"every item with ≥2 eligible producers has a
non-null effective default"* — is **FALSE**: `coal` (2 eligible, both alternates)
and `liquid_turbo_fuel` (3 eligible, all alternates) are counterexamples. The
ticket says a counterexample means the consolidation "needs an ordering shim or
dies here."

It does not die, because **the precondition is the wrong test for what it was
protecting.** Its stated purpose was that the two orderings coincide for
AltCompare's baseline row — and in both counterexamples the two orderings put the
*same* recipe first (`alternate_coal_1`; `alternate_turbo_blend_fuel`), because
when the effective default is null `producerRecipesFor` degenerates to plain
ascending id and `candidateRecipesFor`'s alternate-group is the whole list, also
ascending id. Baseline agreement holds. Recorded as the `decision` audit comment
on #103, 2026-08-07.

## Decision axes

### Axis 1 — where the `< 2` gate goes

**Options:** (a) caller-side at each site that wants it; (b) a thin
`comparableRecipesFor` wrapper retaining the gate; (c) keep both functions.

**PICK (a).** (b) is the same duplication under a new name. There are exactly two
production sites that consume the gate and **one of them already applies it
itself**: `AltCompare.tsx:81` does `if (candidates.length < 2) return null` —
today that check is dead code, redundant with the function's internal gate.
Consolidation makes the existing caller-side check the live one. That is the
whole argument for (a): the gate is already written where it belongs.

### Axis 2 — the three ordering diffs

**Options:** (a) accept the new order; (b) change `producerRecipesFor` to the
grouped ordering; (c) re-sort caller-side in AltCompare.

**PICK (a) — accept.** Reasons, in order of weight:

1. **The alternate status is already in the row text.** Recipe display names
   carry a literal `Alternate: ` prefix — verified in the bundled data:
   `'Alternate: Diluted Fuel'`, `'Alternate: Recycled Rubber'` vs `'Rubber'`,
   `'Residual Rubber'`. AltCompare renders `row.recipeName`
   (`AltCompare.tsx:155`), so grouping alternates last is **redundant with what
   the user reads**. That is what makes accepting the change cheap rather than a
   silent legibility loss.
2. (b) would change the **picker's** order too, which the S20 P1 frozen design
   fixed as default-first-then-ascending. Re-opening a frozen decision to protect
   an incidental one is backwards.
3. (c) reintroduces ordering logic at the call site, which is most of what the
   consolidation is deleting.

**This is a real, if small, user-visible change** and must be recorded as such —
NOT as "no behaviour change". The ticket carries a `refactor` label; the label is
wrong on this point and the spec says so rather than letting the label imply a
guarantee the diff does not make.

### Axis 3 — `candidateCount` changes range from `{0} ∪ [2,∞)` to `{0,1} ∪ [2,∞)`

This is the axis the ticket's one-line consolidation glosses over, and the one
with the widest blast radius: **63 items** flip from count `0` to count `1`.

**The measured finding: the rendered output is unchanged.** The sole consumer is
`RecipePicker` (`ChainBuilder.tsx:729-734`), which branches on `candidateCount >= 2`:

```ts
const chipLabel =
  candidateCount >= 2 ? `${candidateCount} recipes` : "machine excluded";
```

Both the old value (`0`) and the new value (`1`) are `< 2`, so both take the same
branch and render the identical `"machine excluded"` chip. The divergence lives
**entirely below the threshold the consumer tests.** Additionally the affordance
itself is gated at `ChainBuilder.tsx:724` on `pickerOptionsFor(...).length < 2 &&
!forceIncluded`, so a lone-producer item does not render the picker at all unless
its current recipe is force-included — in which case options ≥ 2 and the chip is
`"machine excluded"` either way.

**PICK: take the naive swap, and pay the documentation debt explicitly.** Two
artifacts assert the old invariant in prose and must change, or they become
lies:

- `chain-builder-adapter.ts:109-111` — *"(candidateRecipesFor length — 0 or ≥2 by
  construction)"*.
- `chain-builder-adapter.test.ts:841` — *"Never a bare 1 — candidateRecipesFor
  returns [] below 2."*

**The test at `:841` is the danger point of this whole phase.** It pins an
INTERNAL invariant that the change deliberately breaks, while the USER-VISIBLE
behaviour it was standing in for (the chip never reads "1 recipes") still holds.
Deleting it would drop the user-visible guarantee on the floor; keeping it
verbatim would fail. It must be **rewritten to pin the chip**, not the count —
i.e. assert that no lone-producer item renders a `"1 recipes"` chip. Anything
else is the pass-either-way failure mode this arc has now hit eight times.

### Axis 4 — `candidateRowsFor`'s contract

`candidateRowsFor` (`:942`) calls `candidateRecipesFor` at `:948` and documents
*"Empty when X has <2 candidates"*. After the swap it would return ONE row for a
lone-producer item.

**PICK: swap it, and let the caller's gate stand.** Its only production caller is
`AltCompare.tsx:90`, which is unreachable for a lone candidate because `:81`
already returned null. The docstring changes from "empty when <2" to "one row per
eligible producer; the caller gates the block". The function becomes honest about
what it does rather than encoding its caller's policy.

**Rejected:** re-adding a `< 2 ⇒ []` guard inside `candidateRowsFor`. That is the
exact smell being retired, one function further down.

### Axis 5 — tier-awareness for compare (the S20 P3 scope addition)

Carried here by the #103 comment of 2026-08-07: P3 shipped tier gating for the
propose surfaces only; AltCompare stays ungated **by design**, because it serves
the APPLIED graph where a stage may legitimately run a recipe above the propose
tier, so naive gating could hide the very recipe the stage currently uses. The
comment asks this ticket to *decide* the question now that `catalog.recipeUnlocks`
exists.

**DECISION: label locked candidates; never hide them.** Hiding is unsafe for the
stated reason (it can hide the running recipe). Labeling is honest in both
directions: it tells a planner "this option exists but you have not unlocked it"
without removing a row the applied graph may depend on. The data is available and
the tier is reachable — `proposePrefs.unlockedTier` is in the store
(`store.ts:289`) and persisted, and AltCompare already reads the store directly.

**DECISION: this ticket does NOT build it.** #103 is a pure consolidation;
bolting a new user-visible tag onto it mixes a feature into a refactor and would
make the diff's risk profile dishonest. The build gets its **own ticket**, opened
now and linked, per the standing rule that new work is ticketed immediately
rather than parked in a design doc.

**Note for that ticket, so it is not rediscovered:** `unlockedTier` defaults to
`null` ("all"), so for most users the tag never renders — it is a no-op until a
tier is actually set. That makes it cheap, and it also means its test must set a
tier explicitly or it will pass without exercising anything.

## Spec

1. **Delete** `candidateRecipesFor` from `chain-builder-adapter.ts` (`:546-562`)
   and from the test file's import list.
2. `chain-builder-adapter.ts:341` — `candidateCount:` computes from
   `producerRecipesFor(catalog, s.itemId, excludedMachineIds).length`.
3. `chain-builder-adapter.ts:948` (`candidateRowsFor`) — source candidates from
   `producerRecipesFor(catalog, itemId)`; update the docstring per Axis 4.
4. `AltCompare.tsx:80` — call `producerRecipesFor(catalog, itemId)`; the existing
   `< 2 ⇒ null` gate at `:81` is UNCHANGED and becomes load-bearing. Update the
   import at `:22`.
5. **Doc corrections** (each is a claim that becomes false):
   - `chain-builder-adapter.ts:109-111` — `candidateCount` is now the eligible
     producer count (`0`, `1`, or more); state that the chip's `≥ 2` rule is what
     preserves the display.
   - `chain-builder-adapter.ts:600-601` — the `producerRecipesFor` docstring
     contrasts itself against `candidateRecipesFor`, which will not exist.
   - `chain-builder-adapter.ts:940` — `candidateRowsFor`'s "Empty when <2".
   - `ChainBuilder.tsx:691` — "The chip reads 'N recipes' when candidateCount ≥ 2"
     stays TRUE; verify rather than edit.
6. **Test migration** — every `candidateRecipesFor` reference in
   `chain-builder-adapter.test.ts` (lines 30, 346, 375, 387, 572, 603, 815, 841,
   888, 990, 995, 997, 1007-1008, 1098, 1104-1105, 1276) is re-pointed or
   rewritten. Two need judgment, not mechanical replacement:
   - **`:841`** — rewrite to pin the CHIP per Axis 3, not the count.
   - **`:1098-1105`** — the test's whole point is "producerRecipesFor lists a lone
     candidate where candidateRecipesFor returns []". With the sibling gone the
     contrast is untestable; restate it as a positive assertion about
     `producerRecipesFor` alone (a lone eligible producer yields a 1-element
     list), and do not silently delete it.
7. **A new test row** pinning the accepted Axis-2 change: `rubber` compares as
   `[residual_rubber, alternate_recycled_rubber, rubber]`. The improvement is
   pinned as well as the regression — the S21 P0 boundary r1 lesson.

## Test plan (bidirectionality)

Each row must FAIL with the production change reverted:

| Pin | Bites when |
|---|---|
| `rubber` candidate order is `[residual_rubber, alternate_recycled_rubber, rubber]` | the swap is not made (old order groups non-alternates first) |
| A lone-producer item's row renders `"machine excluded"`, never `"1 recipes"` | someone "fixes" the chip to print the raw count |
| `candidateCount` for a lone-producer item is `1` | the swap is not made (was `0`) |
| An item with ≥2 producers keeps its exact `candidateCount` | the swap changes a count it must not |
| `altCompareModel` returns `null` for a lone-producer item | the caller-side `< 2` gate at `AltCompare.tsx:81` is dropped |

That last row is the one that matters most: `AltCompare.tsx:81` transitions from
dead code to the only thing preventing a one-row comparison table. A test that
does not cover it would let a later cleanup delete it as "redundant" — which it
currently looks like.

## Assumptions ledger

| Assumption | Grounding |
|---|---|
| The two functions agree on SETS everywhere | MEASURED — 0 set diffs across 195 items, probe 2026-08-15 |
| Order differs for exactly 3 items, positions 2/3 only | MEASURED — probe output quoted above |
| Alternate status is visible in row text without grouping | MEASURED — `mDisplayName` carries `Alternate: ` in the bundled data |
| `candidateCount`'s only consumer is `RecipePicker` | VERIFIED — grep over `src/`, non-test: `ChainBuilder.tsx:502` (pass-through), `:679` (prop type), `:730`/`:732` (the two branches) |
| `candidateRowsFor`'s only production caller is `AltCompare.tsx:90` | VERIFIED — grep over `src/`, non-test |
| `AltCompare.tsx:81` already gates at `< 2` | VERIFIED — read at source |
| `unlockedTier` is reachable from the store for the Axis-5 follow-up | VERIFIED — `store.ts:289`, inside the persisted `ProposePrefs` |

## Revision history

- **v1** (2026-08-15) — first draft. Built on the #103 research-gate decision of
  2026-08-07, with that probe INDEPENDENTLY RE-RUN before designing rather than
  trusted from the audit trail; the re-run reproduced the 0-set/3-order result and
  additionally surfaced the 63 lone-producer items, which the original probe did
  not report and which drive Axis 3.
