# S21 P1 (#103) — adapter consolidation: retire `candidateRecipesFor`

**Status:** v4 — in review (r3 folded; re-based on the merged #116 world).
**Ticket:** #103 (Stage 21 milestone 92, epic #108). **UNBLOCKED** — #116 merged
as `b3ed867`.
**Origin:** simplify-pass finding from the S20 P1 design gate (#100), deferred
out of that phase because the AltCompare call sites were pinned untouched
mid-arc.

## Purpose

`candidateRecipesFor` and `producerRecipesFor` apply a **character-identical**
filter (`primaryOutputId === itemId` ∧ machine not excluded) and differ only in
a `< 2 ⇒ []` gate and the tail ordering. The gate is a **UI affordance living
inside a data function**. Retiring `candidateRecipesFor` leaves one enumeration
function and one exported surface.

## Sequencing — #116 HAS LANDED (Axis 2, re-decided at r2)

This phase WAS blocked-by #116 (add an `(alt)` marker to the comparison row),
which **merged as `b3ed867`**. The reason is the whole story of this design:

- The comparison table USED TO mark alternates **nowhere**. Row order was the
  only signal (`candidateRecipesFor` groups non-alternates first). **#116 fixed
  that** — `CandidateRow.isAlternate` now exists and `AltCompare` renders an
  `(alt)` span.
- So deleting that ordering — which the consolidation naturally does — destroys
  the signal. That is the r1 BLOCKER.
- Preserving the ordering (v2's answer) means writing a comparator and an
  ordering pin **that #116 will make redundant**.
- Landing #116 first made the signal explicit, so the ordering is now
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
(`chain-builder-adapter.ts:555-557` vs `:613-615`). Only an edit to one filter
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
`chain-builder-adapter.test.ts:2126-2130`. Recorded as the `decision` audit
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
(`chain-builder-adapter.ts:951`, docstring at `:939`) also consumes the gate —
which is why Axis 4 exists. "Exactly two production sites" was an undercount.

### Axis 2 — the three ordering diffs — **RE-DECIDED AT r2**

> **v1 was wrong and both r1 reviewers killed it.** v1 accepted the order
> change, justified by rendered names carrying an `Alternate: ` prefix. **The
> parser STRIPS it** (`src/data/docs-loader.ts:190`,
> `displayName: r.displayName.replace(/^Alternate:\s*/, "")`, consumed as the
> `isAlternate` signal at `:185-186`, pinned by `docs-loader.test.ts:175`).
> `chain-builder-adapter.ts:978` sets `recipeName: candidate.displayName`
> (stripped); AT THE TIME `CandidateRow` had **no `isAlternate` field** and
> `AltCompare.tsx:155` rendered the bare name. (#116 has since added both —
> that is the fix, not the state this paragraph describes.) I measured the parser's INPUT and
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

`candidateRowsFor` (`:945`) calls `candidateRecipesFor` at `:948`; its docstring
(`:942`) says *"Empty when X has <2 candidates"*. After the swap it returns ONE
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

**Split to #116, which has MERGED** (`b3ed867`). Shipped shape: `isAlternate` on
`CandidateRow` (`chain-builder-adapter.ts:521-523`, set at `:980`) rendered as
an `(alt)` span at `AltCompare.tsx:156-158`, reusing the existing
`.alt-compare-mark` class. This axis is CLOSED; it is recorded here because it
is what unblocked Axis 2 (d).

## Spec — assumes #116 has landed

1. **Delete** `candidateRecipesFor` (`chain-builder-adapter.ts:549-565`).
2. `:341` — `candidateCount:` from
   `producerRecipesFor(catalog, s.itemId, excludedMachineIds).length`.
3. `:951` (`candidateRowsFor`) — source from
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
6. **Test migration — grounded on the SYMBOL, not on line numbers.**

   > **Do not trust line numbers in this section.** #116 merged after v3 was
   > written and shifted every citation past its insertion points. v3's final
   > bullet was a bare number list, and four of those numbers (`995`, `997`,
   > `1007-1008`, `1276`) now point at code containing no `candidateRecipesFor`
   > at all — an implementer working them verbatim would edit unrelated
   > assertions. Numbers rot; the symbol does not.

   **Start by running `grep -n candidateRecipesFor src/ui/chain-builder-adapter.test.ts`
   and work every hit.** As of `develop` @ `2c3d65d` that is: `30, 346, 375,
   387, 588, 619, 851, 877, 924, 1026, 1031, 1033, 1043, 1044, 1134, 1140,
   1141, 1312`.

   **The judgment calls, named by TEST rather than by line** (these are the ones
   a mechanical re-point gets wrong):

   - `it("counts candidates per item (0 or >=2 by construction) …")` — contains
     TWO executable failures: the `Plate` expectation (currently `0`) must flip
     to `1`, and the `every((c) => c === 0 || c >= 2)` assertion **IS** the
     deleted invariant and must be **deleted**. Its title and two inline
     comments also name the deleted function.
   - `it("keeps the P0 ≥2-gate semantics (a lone candidate → 0)")` — the whole
     test encodes the deleted gate; its expectation flips `0` → `1`. Retitle.
     This is the natural home for the test-plan's lone-producer-count row.
   - `it("excludes converter/packager recipes from candidacy")` — a mechanical
     re-point leaves `toEqual([])`, which **FAILS** (becomes `["r_std"]`). The
     correct expectation is `["r_std"]`, and this is an **upgrade**: today's
     `toEqual([])` passes even if the filter dropped everything.
   - `it("returns empty when the item has fewer than 2 candidates")` — exists
     SOLELY to pin the deleted gate. **DELETE**; its fixture is duplicated by
     the surviving lone-candidate test.
   - `it("lists a LONE eligible candidate (no ≥2 gate, unlike candidateRecipesFor)")`
     — delete the two `candidateRecipesFor` contrast lines and retitle. The
     positive assertion the design wants **already exists** in the same body; do
     not write a duplicate.
   - `describe("S20 P1 — candidateRecipesFor custom exclusions")` and its lead
     comment — rename/retarget.
   - The section-header comment reading *"frozen spec item 5: options plumbing,
     candidateRecipesFor exclusions param, …"* — names both the deleted function
     and its parameter.
   - The inline comment *"default (Smelter), non-alternate → first"* states the
     DELETED comparator's rule. (Its sibling *"The default leads; the four
     alternates follow ascending by id"* stays TRUE under `producerRecipesFor` —
     verify, do not edit.)

   Everything else in the grep is a straight re-point to `producerRecipesFor`.

   **#116's three pins were re-checked under the new ordering and are
   UNAFFECTED** — no update needed, recorded so the next reviewer does not
   re-derive it. `it("carries isAlternate from the RECIPE, not from the
   selection")`, `it("flags isAlternate against REAL parsed names…")` and
   `AltCompare.test.tsx`'s `it("marks the ALTERNATE row, whichever row is
   current")` all assert on fixtures with **exactly one non-alternate**, so the
   coincidence rule above (0 or 1 non-alternates ⇒ the two orderings agree)
   applies. Note the synthetic case is saved by the **default-first clause**
   specifically: plain ascending id would give `[r_alt, r_std]` and flip the
   vector to `[true, false]`. Also swept and unaffected: the
   `const [std, alt] = model.rows` destructure in `AltCompare.test.tsx` and the
   `rows[0]` indexing in the adapter suite, both on one-non-alternate fixtures.
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
| **The comparison table NOW HAS an alternate marker** | VERIFIED post-#116 — `CandidateRow.isAlternate` at `chain-builder-adapter.ts:521-523`, set at `:980`, rendered at `AltCompare.tsx:156-158`. **This row previously asserted the OPPOSITE as VERIFIED**; #116 is what made Axis 2 (d) valid, so a ledger denying the marker would invite a later pass to delete it |
| #116's three pins survive the reordering | VERIFIED at r3 by BOTH reviewers — all three assert on fixtures with exactly ONE non-alternate, so the coincidence rule applies. The synthetic case is saved specifically by the **default-first clause**: plain ascending id would give `[r_alt, r_std]` and flip the vector |
| `CandidateRow`'s construction is untouched by spec item 3 | VERIFIED at r3 — item 3 changes only the SOURCE of `candidates`; the row literal, including `isAlternate`, is unaffected |
| Spec item 8's `rubber` order is correct and overlaps no #116 pin | VERIFIED at r3 against the bundled catalog — three eligible producers, two non-alternate; no #116 pin touches `rubber` |
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

- **v4** (2026-08-15) — r3 fold, after #116 merged. Both reviewers NEEDS_REWORK,
  converging on the same two, **both mechanical re-basing rather than design
  defects**. The plan's shape was confirmed sound on every axis they attacked.
  - **A ledger row asserted the OPPOSITE of live source, as VERIFIED.** It said
    the comparison table has no alternate marker — #116 added one, and Axis 2
    (d) *depends* on that. A frozen design denying the marker is how a later
    pass deletes it, which is the failure mode this document already records
    twice against itself.
  - **Every citation past #116's insertion points was stale** (+3/+4 in the
    adapter, +16/+36 in its test file). The dangerous case: spec item 6's final
    bullet was a bare number list, and four of those numbers now point at code
    containing no `candidateRecipesFor` at all — an implementer working them
    verbatim would have edited unrelated assertions.
  - **Spec item 6 is now grounded on the SYMBOL, not on line numbers** — it
    opens with the `grep` to run, and names every judgment call by TEST NAME.
    Numbers rot across a merge; the symbol does not. This is the durable fix for
    a defect that has now bitten twice.
  - **Recorded what r3 verified** so the next reviewer does not re-derive it:
    #116's three pins survive the reordering (all three fixtures have exactly
    one non-alternate); `CandidateRow`'s construction is untouched by item 3;
    the `rubber` pin is correct and overlaps nothing.
  - Two further stale-comment sites added, and the "still worth doing" judgment
    re-confirmed now that the comparator cost is gone entirely.
