# S21 P1 (#103) — adapter consolidation: retire `candidateRecipesFor`

**Status:** v3 — in review (r2 folded).
**Ticket:** #103 (Stage 21 milestone 92, epic #108). **BLOCKED-BY #116.**
**Origin:** simplify-pass finding from the S20 P1 design gate (#100), deferred
out of that phase because the AltCompare call sites were pinned untouched
mid-arc.

## Purpose

`candidateRecipesFor` and `producerRecipesFor` apply a **character-identical**
filter (`primaryOutputId === itemId` ∧ machine not excluded) and differ only in
a `< 2 ⇒ []` gate and the tail ordering. The gate is a **UI affordance living
inside a data function**. Retiring `candidateRecipesFor` leaves one enumeration
function and one exported surface.

## Sequencing — #116 LANDS FIRST (Axis 2, re-decided at r2)

This phase is **blocked-by #116** (add an `(alt)` marker to the comparison row).
The reason is the whole story of this design and is stated here, up front,
because it is the single most important thing a reader needs:

- The comparison table marks alternates **nowhere**. Row order is the only
  signal (`candidateRecipesFor` groups non-alternates first).
- So deleting that ordering — which the consolidation naturally does — destroys
  the signal. That is the r1 BLOCKER.
- Preserving the ordering (v2's answer) means writing a comparator and an
  ordering pin **that #116 will make redundant**.
- Landing #116 first makes the signal explicit, at which point the ordering is
  free to go and **#103 gets its full win**: no comparator, no ordering pin, no
  residual risk.

## Grounding — MEASURED against the bundled catalog

Probe re-run 2026-08-15 over all 195 catalog items. **Full eligible-producer
distribution** (recorded in full because r1 flagged the twin `63`s as a possible
transcription slip — a genuine coincidence; the sum to 195 is the check):

| Eligible producers `n` | Items |
|---|---|
| 0 | 69 |
| **1** | **63** |
| 2 | 28 |
| 3 | 21 |
| 4 | 11 |
| 5 | 3 |
| **Total** | **195** |

**63 items have exactly one** eligible producer; **63 have two or more**
(28+21+11+3), cross-checked against `candidateRecipesFor`'s non-empty count.

**Set agreement — scoped.** *Among the 63 items with ≥2 eligible producers* the
two functions return identical SETS. This is **not an empirical fact — it is a
theorem**: the two filters are the same expression
(`chain-builder-adapter.ts:552-554` vs `:613-615`). Only an edit to one filter
can break it. For the 63 lone-producer items the sets differ trivially and by
design (`[]` vs `[x]`) — that is Axis 3.

**Ordering.** Order differs for exactly 3 items — `liquid_fuel`, `plastic`,
`rubber` — positions 2/3 only, leading row identical:

```
liquid_fuel  cand=[liquid_fuel, residual_fuel, alternate_diluted_fuel]
             prod=[liquid_fuel, alternate_diluted_fuel, residual_fuel]
plastic      cand=[plastic, residual_plastic, alternate_plastic_1]
             prod=[plastic, alternate_plastic_1, residual_plastic]
rubber       cand=[residual_rubber, rubber, alternate_recycled_rubber]
             prod=[residual_rubber, alternate_recycled_rubber, rubber]
```

A divergence **requires** an item to have ≥2 non-alternate eligible producers
AND ≥1 alternate — necessary but **not sufficient** (r2 fold): it additionally
requires an alternate id to sort ahead of a non-default non-alternate id.
Counterexample to the stronger reading: non-alternates `{a_std, b_std}` plus
alternate `{z_alt}` yields the same list under both comparators. The direction
this design actually relies on — **0 or 1 non-alternates ⇒ the orderings
coincide** — is sound, and is why the `coal` / `liquid_turbo_fuel`
counterexamples below are harmless.

### The research-gate correction this design is built on

The ticket's stated precondition — *"every item with ≥2 eligible producers has a
non-null effective default"* — is **FALSE**: `coal` (2 eligible, both alternates)
and `liquid_turbo_fuel` (3 eligible, all alternates) are counterexamples. The
ticket says that means the consolidation "needs an ordering shim or dies here."

It does not die, because **the precondition is the wrong test for what it was
protecting.** Its purpose was that the two orderings coincide for AltCompare's
baseline row — and in both counterexamples both orderings put the *same* recipe
first (`alternate_coal_1`; `alternate_turbo_blend_fuel`), because with zero
non-alternates both comparators degenerate to ascending id. `coal`'s eligible
list is independently pinned in live source at
`chain-builder-adapter.test.ts:2090-2094`. Recorded as the `decision` audit
comment on #103, 2026-08-07.

## Decision axes

### Axis 1 — where the `< 2` gate goes

**Options:** (a) caller-side at each site that wants it; (b) a thin
`comparableRecipesFor` wrapper retaining the gate; (c) keep both functions.

**PICK (a).** (b) is the same duplication under a new name.

**Correction folded at r2 (both reviewers, IMPORTANT).** v1/v2 justified this by
saying `AltCompare.tsx:81` is *"dead code today, redundant with the function's
internal gate"*. **That is false and it is the same error class as the r1
BLOCKER** — asserting a surface's behaviour without tracing its output.
`candidateRecipesFor` returns `[]` (not "nothing") below 2, so
`candidates.length < 2` fires **on the empty array** and is what makes the block
*absent* rather than an *empty table*. Delete `:81` today and `altCompareModel`
proceeds, finds the lane, builds `rows: []`, and returns a **non-null**
`{itemName, rows: []}` — which `AltCompare.tsx:130-133` renders as the
`.alt-compare` header over an empty `<tbody>`. `AltCompare.test.tsx:138-151`
fails **today** if `:81` is removed.

The true justification is the first half of the sentence and it is *stronger*:
**one of the two gate-consumers already applies the gate itself, so
consolidation makes it the only one.** Recorded precisely because a frozen
design claiming a live production guard is dead is how that guard later gets
deleted.

**Third consumer, named for completeness (r2):** `candidateRowsFor`
(`chain-builder-adapter.ts:948`, docstring at `:939`) also consumes the gate —
which is why Axis 4 exists. "Exactly two production sites" was an undercount.

### Axis 2 — the three ordering diffs — **RE-DECIDED AT r2**

> **v1 was wrong and both r1 reviewers killed it.** v1 accepted the order
> change, justified by rendered names carrying an `Alternate: ` prefix. **The
> parser STRIPS it** (`src/data/docs-loader.ts:190`,
> `displayName: r.displayName.replace(/^Alternate:\s*/, "")`, consumed as the
> `isAlternate` signal at `:185-186`, pinned by `docs-loader.test.ts:175`).
> `chain-builder-adapter.ts:975` sets `recipeName: candidate.displayName`
> (stripped), `CandidateRow` has **no `isAlternate` field** (`:514-538`), and
> `AltCompare.tsx:155` renders the bare name. I measured the parser's INPUT and
> asserted about its OUTPUT. `ChainBuilder.tsx:668` re-adds `(alt)` by hand via
> `recipeLabel` — picker-only, never called by AltCompare — which is the
> corroboration that was sitting in the repo the whole time.

**Options:** (a) accept the order change **as things stand** — REFUTED at r1;
(b) preserve the order with a comparator inside `candidateRowsFor` — v2's pick;
(c) abandon the consolidation; **(d) land #116 first, then accept the order
change** — surfaced by the r2 adversarial reviewer.

**PICK (d).**

The r1 BLOCKER's real content is *"the grouping is the only alternate signal."*
The right response is not to preserve the grouping forever — it is to **make the
signal explicit and then let the grouping go**. Under (d):

- #116 adds an `(alt)` marker to the comparison row. Alternate status becomes
  explicit text rather than implicit position.
- #103 then takes `producerRecipesFor`'s order directly. **No comparator, no
  ordering pin, no residual risk** — the full consolidation the simplify lens
  originally asked for.

**Why (b) is now rejected**, having been the v2 pick: it writes a comparator and
an ordering pin *in the knowledge that #116 will make both redundant*. The r2
adversarial reviewer's own accounting of (b) is decisive — "net production LOC ≈
break-even, against ~12 test-site migrations plus three new pins." A
break-even simplification is not worth a migration; the (d) version is a real
one.

**Why (c) is rejected.** Both r2 reviewers judged the consolidation worth doing:
the duplicated filter is a live drift hazard, both gate-consumers already hold
their own gate, and the phase adds chip/order/distribution pins the repo lacks
entirely. Under (d) the win is larger still.

**Cost of (d), stated honestly:** #116 is a user-visible feature and needs its
own design + full gate before #103 resumes, so the arc gets one more cycle.
That is the price of not writing code we already know we will delete.

**Consequence:** the accepted order change returns, so the ticket's `refactor`
label is **not** accurate — `rubber` will compare in a new order. v2's
retraction of v1's label-correction is itself retracted. The change is small,
deliberate, pinned, and by then accompanied by an explicit marker; but it is
user-visible and the spec says so.

### Axis 3 — `candidateCount` changes range from `{0} ∪ [2,∞)` to `{0,1} ∪ [2,∞)`

Affects **63 items** — a third of the catalog — and the ticket says nothing
about it.

**The rendered output is unchanged.** Both r1 and r2 reviewers attacked this and
could not break it. The sole consumer is `RecipePicker`
(`ChainBuilder.tsx:729-734`), branching on `candidateCount >= 2`:

```ts
const chipLabel =
  candidateCount >= 2 ? `${candidateCount} recipes` : "machine excluded";
```

Old `0` and new `1` are both `< 2` → identical branch, identical
`"machine excluded"` chip. Exhaustively verified: `candidateCount`'s only
readers are `ChainBuilder.tsx:502, 679, 701, 730, 732`; no truthiness, `> 0`,
`!== 0`, sort, filter, snapshot, or serialization read exists in `src/`. The
affordance gate at `:724` keys on `options.length` / `forceIncluded` and is
explicitly *"Decoupled from candidateCount"* (`:723`).

**The one state where `candidateCount === 1` renders at all** — needed to write
its test, verified constructible by both r2 reviewers: the picker renders only
when `options.length >= 2 || forceIncluded` (`ChainBuilder.tsx:715-724`). With
one eligible producer that requires a **force-included current recipe on an
excluded machine plus exactly one other eligible producer**. `selectProducer`
(`src/core/chain-builder.ts:107-117`) bypasses the exclusion filter for a valid
override, so the excluded-machine recipe really does become the stage's recipe;
`ChainBuilder.tsx:148-149` seeds `overrides` from `proposePrefs`, which
`ChainBuilder.gating.test.tsx:222-230`'s `mount()` already sets. The chip reads
`"machine excluded"` for `candidateCount` of both `0` and `1`.

### Axis 4 — `candidateRowsFor`'s contract

`candidateRowsFor` (`:942`) calls `candidateRecipesFor` at `:948`; its docstring
(`:939`) says *"Empty when X has <2 candidates"*. After the swap it returns ONE
row for a lone-producer item.

**PICK: swap it and let the caller's gate stand.** Its only production caller is
`AltCompare.tsx:90`, unreachable for a lone candidate because `:81` already
returned null. Docstring becomes "one row per eligible producer; the caller
gates the block."

**Rejected:** re-adding a `< 2 ⇒ []` guard inside `candidateRowsFor` — the exact
smell being retired, one function down.

### Axis 5 — tier-awareness for compare (the S20 P3 scope addition)

**DECISION: label locked candidates; never hide them.** Hiding is unsafe —
AltCompare serves the APPLIED graph, where a stage may legitimately run a recipe
above the propose tier. Data available: `catalog.recipeUnlocks` (S20 P3) and
`proposePrefs.unlockedTier` (`store.ts:289`, persisted).

**DECISION: not built here.** Split to **#115**.

### Axis 6 — the missing alternate marker → **#116**, now a PREDECESSOR

Surfaced at r1: the comparison table marks alternates nowhere. Fragile
independently of this refactor — any future re-ordering silently destroys the
signal, which is the trap v1 fell into.

**Split to #116**, and per Axis 2 (d) it is now **blocked-by**, not a follow-up.
Its proposed shape: carry `isAlternate` onto `CandidateRow` and render an
`(alt)` tag, mirroring `ChainBuilder.tsx:668`.

## Spec — assumes #116 has landed

1. **Delete** `candidateRecipesFor` (`chain-builder-adapter.ts:546-562`).
2. `:341` — `candidateCount:` from
   `producerRecipesFor(catalog, s.itemId, excludedMachineIds).length`.
3. `:948` (`candidateRowsFor`) — source from
   `producerRecipesFor(catalog, itemId)` and **use its order directly**. No
   comparator (Axis 2 (d)). Update the docstring per Axis 4.
4. `AltCompare.tsx:80` — call `producerRecipesFor(catalog, itemId)`; the
   `< 2 ⇒ null` gate at `:81` is UNCHANGED and becomes the **only** gate. Update
   the import at `:22`. Order-insensitive here (gate + `byId` **Map**, consumed
   only via `.get()` at `:89`/`:95`; both call sites use the same 2-arg form, so
   the sets are equal and the non-null assertion holds).
5. **Doc corrections** — every claim that becomes false:
   - `:109-111` — `candidateCount` is the eligible producer count (`0`, `1`, or
     more); note the chip's `>= 2` rule preserves the display.
   - `:281` — "candidateCount (alternate-recipe count)".
   - `:502-511` — the section header framing the block around "Candidate
     enumeration" by the deleted function.
   - `:600-601` — `producerRecipesFor`'s docstring contrasts itself against a
     function that will not exist.
   - `:939` — `candidateRowsFor`'s "Empty when <2".
   - `ChainBuilder.tsx:691` — stays TRUE; **verify, do not edit.**
6. **Test migration — rebuilt from the INVARIANT, not the symbol.** **FOUR
   executable failures** (r2 fold: v2's "two" undercounted its own list):
   - **`:840`** — `expect(countByName.get("Plate")).toBe(0)` → **FAILS**, flip
     to `1`.
   - **`:842-844`** — `every((c) => c === 0 || c >= 2)` → **FAILS**. This IS the
     deleted invariant; delete it.
   - **`:1274-1287`** — the whole `it("keeps the P0 ≥2-gate semantics (a lone
     candidate → 0)")`; `:1284-1286` expects `0` → **FAILS**. Retitle and flip.
   - **`:375-378`** — a mechanical re-point leaves `toEqual([])`, which
     **FAILS** (becomes `["r_std"]`). Correct expectation `["r_std"]` — an
     **upgrade**: today's `toEqual([])` passes even if the filter dropped
     everything.
   - **`:381-388`** — `it("returns empty when the item has fewer than 2
     candidates")` exists SOLELY to pin the deleted gate. **DELETE**; its
     fixture duplicates `:1099-1108`, which survives.
   - Stale comments/titles: **`:813`** (title), **`:815`**, **`:841`** (both
     name the deleted function and its invariant — r2 fold; v2 omitted them
     despite listing the comparable `:572`), **`:990`**, **`:993`**.
   - **`:1098-1105`** — delete `:1104-1105`, retitle `:1098`. The positive
     assertion already exists at `:1106-1108`; do not duplicate.
   - Genuinely mechanical: `30, 346, 572, 603, 995, 997, 1007-1008, 1276`.
     (**`387` removed from this list at r2** — it is inside the `:381-388`
     DELETE.)
7. **The chip pin goes in a COMPONENT test.** The label is an inline expression
   in the non-exported `RecipePicker` (`ChainBuilder.tsx:729-730`);
   `chain-builder-adapter.test.ts` has no render, and **no test anywhere asserts
   the chip strings**. It lands in `ChainBuilder.gating.test.tsx` (jsdom pragma;
   `mount()` at `:214-237` already accepts `overrides` + `excludedMachineIds`;
   the chip walk is `openPickerOptions` at `:317-323`) and must construct the
   force-included state from Axis 3. **Without this an implementer will put
   another count assertion back into the adapter suite — the pass-either-way
   failure this phase exists to avoid.**
8. **Ordering pin:** `rubber` compares as
   `[residual_rubber, alternate_recycled_rubber, rubber]` — the **new** order.
   Fails if the swap is not made.
9. **Distribution pin** replacing the deleted probe: assert against the bundled
   catalog that ≥1 item has exactly one eligible producer and that
   `candidateCount` for such an item is `1`.

## Test plan

Each row names **the mutant it kills** and is typed **revert-bidirectional**
(fails if the swap is reverted) vs **guard pin** (fails if a specific guard is
deleted). v1's blanket "each row fails when reverted" was false for two rows.

| Pin | Kills | Kind |
|---|---|---|
| `rubber` order is `[residual_rubber, alternate_recycled_rubber, rubber]` | not making the swap | revert-bidirectional |
| `candidateCount` for a lone-producer item is `1` (`:1274-1287`, retitled) | not making the swap | revert-bidirectional |
| An item with ≥2 producers keeps its exact `candidateCount` | a swap that changes a count it must not | revert-bidirectional |
| `:375-378` yields `["r_std"]` | a filter that drops the surviving recipe | revert-bidirectional (an upgrade on today) |
| Chip reads `"machine excluded"`, never `"1 recipes"`, in the force-included lone-producer state | someone "fixing" the chip to print the raw count | **guard pin** |
| `altCompareModel` → `null` for a lone-producer item | deleting `AltCompare.tsx:81` | **guard pin** |

**The last row already exists** — `AltCompare.test.tsx:138-151`. Do NOT
duplicate it. **r2 correction:** it guards `:81` **today** (deleting `:81` fails
it right now), so its significance does not change — what changes is that `:81`
becomes the *only* gate. v2 wrongly said it "becomes" the guard.

## Assumptions ledger

| Assumption | Grounding |
|---|---|
| The two filters are identical expressions | VERIFIED — `:552-554` vs `:613-615`. A **theorem**, not a measurement |
| Sets agree **among items with ≥2 eligible producers** | Follows from the above. NOT true unscoped — the 63 lone-producer items differ `[]` vs `[x]` by design |
| Distribution 69/63/28/21/11/3, Σ=195 | MEASURED — probe re-run 2026-08-15; twin `63`s a real coincidence |
| Order differs for exactly 3 items, positions 2/3 | MEASURED; re-derived from the comparators by all four reviewer runs |
| ≥2 non-alternates ∧ ≥1 alternate is **necessary, not sufficient**, for divergence | r2 counterexample: `{a_std, b_std}` + `{z_alt}` gives the same list both ways |
| **The rendered recipe name does NOT carry `Alternate: `** | VERIFIED — stripped at `docs-loader.ts:190`, pinned by `docs-loader.test.ts:175`. **v1 asserted the opposite — the r1 BLOCKER** |
| The comparison table has no alternate marker at all | VERIFIED — `CandidateRow` (`:514-538`) has no `isAlternate`; `AltCompare.tsx:155` renders the bare name; `recipeLabel` is picker-only |
| **`AltCompare.tsx:81` is LIVE today, not dead** | VERIFIED — `candidateRecipesFor` returns `[]`, so the `< 2` branch fires on it; deleting `:81` yields a non-null model and an empty rendered table. **v1/v2 asserted the opposite — the r2 IMPORTANT** |
| `candidateCount`'s only consumer is `RecipePicker` | VERIFIED by all four reviewer runs — `ChainBuilder.tsx:502, 679, 701, 730, 732` |
| `candidateRowsFor`'s only production caller is `AltCompare.tsx:90` | VERIFIED — grep over `src/`, non-test |
| Nothing outside `src/` imports `candidateRecipesFor` | VERIFIED at r1 |
| #106 does not depend on the removed surface | VERIFIED at r1 — it brands `gateCatalog`'s return; deleting a helper reduces the sites to brand |
| No fourth executable assertion of the old invariant exists | VERIFIED at r2 by BOTH reviewers, swept by behaviour not symbol |
| Spec item 7's force-included state is constructible | VERIFIED at r2 by both, traced through `selectProducer` → `stageRecipeId` → `forceIncluded` → the chip |

## Revision history

- **v1** (2026-08-15) — first draft. Probe re-run independently rather than
  trusted from the audit trail; surfaced the 63 lone-producer items driving
  Axis 3.
- **v2** (2026-08-15) — r1 fold. Both reviewers NEEDS_REWORK on the **same
  BLOCKER**, independently: v1's Axis-2 premise (rendered names carry
  `Alternate: `) refuted at `docs-loader.ts:190`. Axis 2 → preserve the order
  with a comparator. Spec item 6 rebuilt from the invariant (v1's symbol grep
  had missed three executable failures). Chip pin relocated to a component test.
  Test-plan header corrected. Set-agreement claim scoped and reclassified as a
  theorem. Axis 6 opened.
- **v3** (2026-08-15) — r2 fold. Both reviewers NEEDS_REWORK, no BLOCKER,
  converging on the same IMPORTANT.
  - **Axis 2 RE-DECIDED to (d)** — sequence #116 BEFORE #103 (r2 adversarial;
    an option neither r1 reviewer nor I had weighed). v2's pick wrote a
    comparator and an ordering pin that #116 would make redundant; the r2
    accounting of (b) as "net production LOC ≈ break-even against ~12 test-site
    migrations" is what decided it. **This is a synthesis, not a reversal**: the
    r1 BLOCKER's content is "the grouping is the only alternate signal", and the
    answer is to make the signal explicit, then let the grouping go. #103 is now
    **blocked-by #116**.
  - **"`AltCompare.tsx:81` is dead code" CORRECTED (both, IMPORTANT).** It is
    live and load-bearing: `candidateRecipesFor` returns `[]`, the `< 2` branch
    fires on the empty array, and it is what makes the block absent rather than
    an empty table. **Same error class as the r1 BLOCKER** — asserting a
    surface's behaviour without tracing its output — which is why it is recorded
    in the ledger rather than quietly fixed. The surviving justification is
    stronger than the one it replaces.
  - **Test-plan rationale corrected** — `AltCompare.test.tsx:138-151` guards
    `:81` today; v2 wrongly said it would "become" that guard.
  - **"Exactly two gate consumers" was an undercount** — `candidateRowsFor` is a
    third.
  - **Divergence rule downgraded** from "exactly when" to necessary-not-
    sufficient, with the r2 counterexample recorded.
  - **Executable-failure count corrected** from two to four (v2's prose
    contradicted its own list — the precise trap item 6 was rebuilt to prevent).
  - **`387` removed** from the mechanical list (it is inside the `:381-388`
    DELETE); **`:815` and `:841`** added as stale comments v2 omitted.
  - **#116 recorded by number** in Axis 6; two off-by-one citations fixed
    (`:939` not `:940`; `openPickerOptions` at `:317-323` not `:302-320`).
  - **Label retraction re-retracted** — under (d) the order change returns, so
    `refactor` is not accurate. Stated in Axis 2.
