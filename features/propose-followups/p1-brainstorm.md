# S21 P1 (#103) — adapter consolidation: retire `candidateRecipesFor`

**Status:** v2 — in review (r1 folded; both reviewers returned NEEDS_REWORK on
the same BLOCKER).
**Ticket:** #103 (Stage 21 milestone 92, epic #108).
**Origin:** simplify-pass finding from the S20 P1 design gate (#100), deferred
out of that phase because the AltCompare call sites were pinned untouched
mid-arc.

## Purpose

`candidateRecipesFor` and `producerRecipesFor` apply a **character-identical**
filter (`primaryOutputId === itemId` ∧ machine not excluded) and differ only in
a `< 2 ⇒ []` gate and the tail ordering. The gate is a **UI affordance living
inside a data function** — the comparison block wants "don't offer a comparison
of one". Retiring `candidateRecipesFor` leaves one enumeration function and
moves both UI policies to the comparison-specific surface that wants them.

## Grounding — MEASURED against the bundled catalog

Probe re-run 2026-08-15 over all 195 catalog items. **Full eligible-producer
distribution** (recorded in full because r1 flagged the twin `63`s as a possible
transcription slip — they are a genuine coincidence, and the distribution sums
to 195, which is the check):

| Eligible producers `n` | Items |
|---|---|
| 0 | 69 |
| **1** | **63** |
| 2 | 28 |
| 3 | 21 |
| 4 | 11 |
| 5 | 3 |
| **Total** | **195** |

So **63 items have exactly one** eligible producer and **63 have two or more**
(28+21+11+3), independently cross-checked against `candidateRecipesFor`'s
non-empty count, which is also 63.

**Set agreement — scoped correctly (r1 fold).** *Among the 63 items with ≥2
eligible producers*, the two functions return identical SETS. This is **not an
empirical fact about the catalog — it is a theorem**: the two filters are the
same expression (`chain-builder-adapter.ts:552-554` vs `:613-615`). The only
thing that could break it is an edit to one filter, not a catalog change. For
the 63 items with exactly one producer the sets differ trivially and by design
(`[]` vs `[x]`) — that difference is Axis 3, and v1's unqualified "0 set
differences everywhere" was wrong precisely because it papered over it.

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

Both r1 reviewers independently re-derived this from the comparators and
confirmed the general rule: **a divergence arises exactly when an item has ≥2
non-alternate eligible producers AND ≥1 alternate.** With 0 or 1 non-alternates
the two orderings provably coincide — which is also why the `coal` /
`liquid_turbo_fuel` counterexamples below are harmless.

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
with zero non-alternates both comparators degenerate to plain ascending id.
Recorded as the `decision` audit comment on #103, 2026-08-07.

## Decision axes

### Axis 1 — where the `< 2` gate goes

**Options:** (a) caller-side at each site that wants it; (b) a thin
`comparableRecipesFor` wrapper retaining the gate; (c) keep both functions.

**PICK (a).** (b) is the same duplication under a new name. There are exactly two
production sites that consume the gate and **one of them already applies it
itself**: `AltCompare.tsx:81` does `if (candidates.length < 2) return null` —
today that check is dead code, redundant with the function's internal gate.
Consolidation makes the existing caller-side check the live one.

### Axis 2 — the three ordering diffs — **RE-DECIDED AT r1**

> **v1 was WRONG and both reviewers independently killed it.** v1 accepted the
> order change, justified primarily by: *"Recipe display names carry a literal
> `Alternate: ` prefix … so grouping alternates last is redundant with what the
> user reads."*
>
> **That premise is refuted by live source.** The parser STRIPS the prefix:
> `src/data/docs-loader.ts:190` —
> `displayName: r.displayName.replace(/^Alternate:\s*/, "")` — consuming it as
> the `isAlternate` signal (`:185-186`) and deleting it from the string. It is
> pinned by an existing test (`docs-loader.test.ts:175`,
> `expect(wet.displayName).toBe("Wet Concrete"); // Alternate: prefix stripped`).
> `chain-builder-adapter.ts:975` then sets `recipeName: candidate.displayName`
> (stripped), `CandidateRow` has **no `isAlternate` field**
> (`chain-builder-adapter.ts:514-538`), and `AltCompare.tsx:155` renders
> `{row.recipeName}` bare.
>
> **I measured the parser's INPUT and asserted about its OUTPUT.** The decisive
> corroboration is in the repo itself: `ChainBuilder.tsx:668` has to re-add the
> marker by hand (`if (recipe.isAlternate) tags.push("(alt)")`) — via
> `recipeLabel`, which is **picker-only** and which AltCompare does not call.
>
> **Consequence:** the comparison table has NO alternate marker of any kind
> today. The non-alternate-first grouping is the **only** signal that a row is an
> alternate. Deleting it is exactly the "silent legibility loss" v1 ruled out.

**Options now:** (a) accept the order change — **REFUTED, dead**; (b) preserve
today's order with a comparison-specific comparator; (c) abandon the
consolidation entirely.

**(c) is genuinely on the table** and was weighed, not dismissed: the simplify
lens proposed this consolidation on the premise that the two functions are
redundant, and that premise is now known to be false — they differ in an ordering
that is load-bearing. If preserving it cost much, closing #103 as
not-worth-the-churn would be the honest call.

**PICK (b).** It costs a four-line comparator and it is the *same principle as
Axis 1*: a UI policy belongs at the UI-facing surface, not baked into a shared
enumeration function. What survives the consolidation is real — the duplicated
filter, the gate, and one exported symbol all go — and what remains is a small
private comparator in the one function that actually wants comparison ordering.
(c) is rejected because the win is still real and the cost is bounded and known.

**Where the comparator lives: `candidateRowsFor`, not `AltCompare`.** Only
`candidateRowsFor`'s output order reaches the render. `AltCompare.tsx:80` uses
its list for the `< 2` gate and to build a `byId` **Map** — neither is
order-sensitive — so that call site needs no ordering at all.

**Consequence for the ticket's label: v1's self-correction is RETRACTED.** v1
said the `refactor` label was wrong because the change was not
behaviour-preserving. Under (b) the ordering is preserved and the
`candidateCount` change is invisible (Axis 3), so **the diff genuinely has zero
user-visible effect and the `refactor` label is accurate.**

### Axis 3 — `candidateCount` changes range from `{0} ∪ [2,∞)` to `{0,1} ∪ [2,∞)`

This affects **63 items** — a third of the catalog — and the ticket's one-line
consolidation says nothing about it.

**The rendered output is unchanged, and both r1 reviewers attacked this and could
not break it.** The sole consumer is `RecipePicker`
(`ChainBuilder.tsx:729-734`), which branches on `candidateCount >= 2`:

```ts
const chipLabel =
  candidateCount >= 2 ? `${candidateCount} recipes` : "machine excluded";
```

Both the old value (`0`) and the new value (`1`) are `< 2` → identical branch,
identical `"machine excluded"` chip. Verified exhaustively by both reviewers: no
truthiness, `> 0`, `!== 0`, sort, filter, snapshot, or serialization read of
`candidateCount` exists anywhere in `src/`. The affordance gate at
`ChainBuilder.tsx:724` keys on `options.length` / `forceIncluded` and is
explicitly *"Decoupled from candidateCount"* (`:723`), so it cannot interact.

**PICK: take the swap; pay the documentation debt explicitly** (spec items 5-6).

**The one state where `candidateCount === 1` renders at all** — needed to write
its test, and named here so the implementer does not have to rediscover it: the
picker renders only when `options.length >= 2 || forceIncluded`
(`ChainBuilder.tsx:715-724`). With exactly one eligible producer, that requires a
**force-included current recipe on an excluded machine plus exactly one other
eligible producer**. In that state the chip reads `"machine excluded"` both
before and after the change.

### Axis 4 — `candidateRowsFor`'s contract

`candidateRowsFor` (`:942`) calls `candidateRecipesFor` at `:948` and documents
*"Empty when X has <2 candidates"*. After the swap it returns ONE row for a
lone-producer item.

**PICK: swap it, add the Axis-2 comparator, and let the caller's gate stand.**
Its only production caller is `AltCompare.tsx:90`, unreachable for a lone
candidate because `:81` already returned null. The docstring changes from "empty
when <2" to "one row per eligible producer, comparison-ordered; the caller
gates the block."

**Rejected:** re-adding a `< 2 ⇒ []` guard inside `candidateRowsFor` — the exact
smell being retired, one function further down.

### Axis 5 — tier-awareness for compare (the S20 P3 scope addition)

**DECISION: label locked candidates; never hide them.** Hiding is unsafe —
AltCompare serves the APPLIED graph, where a stage may legitimately run a recipe
above the propose tier, so gating could hide the very recipe the stage is
running. Data is available: `catalog.recipeUnlocks` (S20 P3) and
`proposePrefs.unlockedTier` (`store.ts:289`, persisted); AltCompare already reads
the store.

**DECISION: this ticket does NOT build it** — #103 is a pure consolidation.
Split to **#115**, open and linked.

### Axis 6 — the missing alternate marker (NEW, surfaced by r1)

r1 established that the comparison table marks alternates **nowhere**, and that
row ordering is carrying that information implicitly. That is fragile
independently of this refactor: any future re-ordering silently destroys the
signal, which is precisely the trap v1 fell into.

**DECISION: not built here** — it is a new user-visible surface and #103 is a
refactor. Split to its **own ticket**, opened now, to add an `(alt)` marker to
the comparison row (mirroring `ChainBuilder.tsx:668`, the existing in-repo
pattern). Once it lands, the Axis-2 ordering stops being load-bearing and the
grouped comparator could then be revisited — noted on that ticket so the
dependency is not rediscovered.

## Spec

1. **Delete** `candidateRecipesFor` (`chain-builder-adapter.ts:546-562`).
2. `chain-builder-adapter.ts:341` — `candidateCount:` computes from
   `producerRecipesFor(catalog, s.itemId, excludedMachineIds).length`.
3. `chain-builder-adapter.ts:948` (`candidateRowsFor`) — source from
   `producerRecipesFor(catalog, itemId)`, then apply a module-private
   **comparison comparator** reproducing today's order EXACTLY: non-alternate
   before alternate; within each group ascending recipe id (lifted verbatim from
   the deleted `:558-561`). Update the docstring per Axis 4.
4. `AltCompare.tsx:80` — call `producerRecipesFor(catalog, itemId)`; the existing
   `< 2 ⇒ null` gate at `:81` is UNCHANGED and becomes load-bearing. Update the
   import at `:22`. **No ordering needed here** (gate + `byId` Map only).
5. **Doc corrections** — every claim that becomes false:
   - `chain-builder-adapter.ts:109-111` — `candidateCount` is now the eligible
     producer count (`0`, `1`, or more); state that the chip's `>= 2` rule is what
     preserves the display.
   - `chain-builder-adapter.ts:281` — "candidateCount (alternate-recipe count)".
   - `chain-builder-adapter.ts:502-511` — the section header framing the block
     around "Candidate enumeration" by the deleted function.
   - `chain-builder-adapter.ts:600-601` — `producerRecipesFor`'s docstring
     contrasts itself against a function that will not exist.
   - `chain-builder-adapter.ts:940` — `candidateRowsFor`'s "Empty when <2".
   - `ChainBuilder.tsx:691` — stays TRUE; **verify, do not edit.**
6. **Test migration — rebuilt from the INVARIANT, not the symbol** (r1: v1's list
   was a `candidateRecipesFor` grep and therefore missed every site that asserts
   the old invariant without naming the function). Two of these are **executable
   failures**, not prose:
   - **`:840`** — `expect(countByName.get("Plate")).toBe(0)`. `plate` has one
     producer → becomes `1`. **WILL FAIL.** Flip to `1`.
   - **`:842-844`** — `expect([...countByName.values()].every((c) => c === 0 || c >= 2)).toBe(true)`.
     **WILL FAIL.** This assertion IS the deleted invariant; delete it.
   - **`:1274-1287`** — the whole `it("keeps the P0 ≥2-gate semantics (a lone
     candidate → 0)")`; `:1284-1286` expects `0`, becomes `1`. **WILL FAIL.**
     Retitle and flip — this is the natural home for the test-plan's
     lone-producer-count row.
   - **`:813`** — title *"(0 or >=2 by construction)"* — stale.
   - **`:375-378`** — `it("excludes converter/packager recipes from candidacy")`.
     A mechanical re-point leaves `toEqual([])`, which **FAILS** (becomes
     `["r_std"]`). The correct expectation is `["r_std"]` — note this is an
     **upgrade**: today's `toEqual([])` passes even if the filter dropped
     everything, whereas the new form pins both that the excluded recipes are
     absent and that the smelter one survives.
   - **`:381-388`** — `it("returns empty when the item has fewer than 2
     candidates")` exists SOLELY to pin the deleted gate. **DELETE it**, do not
     re-point; its fixture duplicates `:1099-1108`, which survives.
   - **`:990` / `:993`** — `describe("S20 P1 — candidateRecipesFor custom
     exclusions")` and its comment — rename/retarget.
   - **`:1098-1105`** — delete `:1104-1105` and retitle `:1098`. The positive
     assertion the design wants **already exists** at `:1106-1108`; do not write
     a duplicate.
   - Remaining lines (`30, 346, 387, 572, 603, 995, 997, 1007-1008, 1276`) are
     genuinely mechanical re-points.
7. **The chip pin goes in a COMPONENT test, not the adapter suite.** The chip
   label is an inline expression inside the non-exported `RecipePicker`
   (`ChainBuilder.tsx:729-730`); `chain-builder-adapter.test.ts` has no render,
   and **no test anywhere currently asserts `"N recipes"` or `"machine
   excluded"`**. The pin lands in `ChainBuilder.gating.test.tsx` (jsdom pragma +
   an existing picker-chip walk at `:302-320`) and must construct the
   force-included state named in Axis 3. **Without this instruction an
   implementer will put another count assertion back into the adapter suite,
   which is the pass-either-way failure this phase is trying to avoid.**
8. **Ordering pin:** `rubber` compares as `[residual_rubber, rubber,
   alternate_recycled_rubber]` — i.e. **unchanged from today**. Under Axis 2 (b)
   this pins that the comparator was carried over, and it FAILS if the
   implementer takes the naive swap.
9. **Distribution pin** replacing the deleted probe: assert against the bundled
   catalog that ≥1 item has exactly one eligible producer and that
   `candidateCount` for such an item is `1`, so the Axis-3 measurement stops
   depending on a script that no longer exists.

## Test plan

**Header restated per r1** — v1 claimed "each row must FAIL with the production
change reverted", which was false for two rows and would hand a boundary reviewer
a false negative. Each row now names **the mutant it kills**, and rows are
marked **revert-bidirectional** (fails if the swap is reverted) vs **guard pin**
(fails if a specific guard is deleted).

| Pin | Kills | Kind |
|---|---|---|
| `rubber` order is `[residual_rubber, rubber, alternate_recycled_rubber]` | the naive swap (dropping the Axis-2 comparator) | revert-bidirectional |
| `candidateCount` for a lone-producer item is `1` (`:1274-1287`, retitled) | not making the swap | revert-bidirectional |
| An item with ≥2 producers keeps its exact `candidateCount` | a swap that changes a count it must not | revert-bidirectional |
| `:375-378` yields `["r_std"]` | a filter that drops the surviving recipe | revert-bidirectional (and an upgrade on today) |
| Chip reads `"machine excluded"`, never `"1 recipes"`, in the force-included lone-producer state | someone "fixing" the chip to print the raw count | **guard pin** — passes either way on the swap itself |
| `altCompareModel` → `null` for a lone-producer item | deleting `AltCompare.tsx:81` | **guard pin** |

**The last row already exists** — `AltCompare.test.tsx:138-151`. Do NOT add a
duplicate. Its significance changes rather than its code: today it passes via the
function's internal gate; after the change it passes via `AltCompare.tsx:81`, so
it becomes the bidirectional guard against that line being deleted as "redundant"
— which is exactly what it currently looks like.

## Assumptions ledger

| Assumption | Grounding |
|---|---|
| The two filters are identical expressions | VERIFIED at source — `chain-builder-adapter.ts:552-554` vs `:613-615`. A **theorem**, not a measurement (r1 fold) |
| Sets agree **among items with ≥2 eligible producers** | Follows from the above; scoped per r1. NOT true unscoped — the 63 lone-producer items differ `[]` vs `[x]` by design |
| Eligible-producer distribution 69/63/28/21/11/3, summing to 195 | MEASURED — probe re-run 2026-08-15, twin `63`s confirmed a real coincidence |
| Order differs for exactly 3 items, positions 2/3 | MEASURED, and independently re-derived from the comparators by both r1 reviewers |
| **The rendered recipe name does NOT carry `Alternate: `** | VERIFIED at source — stripped at `docs-loader.ts:190`, pinned by `docs-loader.test.ts:175`. **v1 asserted the opposite; this is the r1 BLOCKER** |
| The comparison table has no alternate marker at all | VERIFIED — `CandidateRow` (`:514-538`) has no `isAlternate`; `AltCompare.tsx:155` renders the bare name; `recipeLabel` (`ChainBuilder.tsx:660-674`) is picker-only |
| `candidateCount`'s only consumer is `RecipePicker` | VERIFIED by both r1 reviewers — `ChainBuilder.tsx:502`, `:679`, `:701`, `:730`, `:732`; no other read of any kind |
| `candidateRowsFor`'s only production caller is `AltCompare.tsx:90` | VERIFIED — grep over `src/`, non-test |
| Nothing outside `src/` imports `candidateRecipesFor` | VERIFIED by r1 — only the adapter, its test, AltCompare, and historical `features/**` docs |
| S21 P2 (#106) does not depend on the removed surface | VERIFIED by r1 — #106 brands `gateCatalog`'s return; deleting a helper strictly reduces the sites to brand, as `FEATURE.md:53` says |
| No test currently asserts the chip strings | VERIFIED by r1 — zero hits for `"N recipes"` / `"machine excluded"` across `src/ui/*.test.*` |

## Revision history

- **v1** (2026-08-15) — first draft. Probe re-run independently rather than
  trusted from the audit trail; surfaced the 63 lone-producer items driving
  Axis 3.
- **v2** (2026-08-15) — r1 fold. Both reviewers returned NEEDS_REWORK on the
  **same BLOCKER**, reached independently.
  - **Axis 2 RE-DECIDED (BLOCKER).** v1's justification for accepting the order
    change was refuted at source: the `Alternate: ` prefix is stripped by the
    parser and never reaches the rendered row, so the grouping v1 called
    "redundant" is in fact the comparison table's ONLY alternate signal. v1
    measured the parser's input and asserted about its output. Now: preserve the
    order with a comparator in `candidateRowsFor`. Option (c) — abandon the
    consolidation — recorded as seriously weighed, since the simplify lens's
    original "fully redundant" premise is now known false.
  - **Ticket-label self-correction RETRACTED** — under the new pick the diff is
    genuinely behaviour-preserving, so `refactor` is accurate after all.
  - **Spec item 6 rebuilt from the invariant** (both, IMPORTANT). v1's list was a
    symbol grep and missed three executable failures — `:840`, `:842-844`,
    `:1274-1287` — all three verified by me against source before folding.
    `:375-378` and `:381-388` reclassified as judgment calls; `:381-388` is now a
    DELETE.
  - **Chip pin relocated** (code-reviewer, IMPORTANT). v1 said "rewrite `:841` to
    pin the chip", which is not implementable in an adapter suite with no render;
    it now lands in `ChainBuilder.gating.test.tsx` with the force-included state
    named explicitly.
  - **Test-plan header corrected** (code-reviewer, IMPORTANT). v1's blanket
    bidirectionality claim was false for two rows; rows now name their mutant and
    are typed revert-bidirectional vs guard pin.
  - **Set-agreement claim scoped** (both, IMPORTANT) and reclassified from
    MEASURED to a theorem about identical filters.
  - **Existing pins credited** (both, NIT) — `AltCompare.test.tsx:138-151` and
    `chain-builder-adapter.test.ts:1106-1108` already exist; the spec now says so
    to prevent duplicates.
  - **Distribution recorded in full** (adversarial, NIT) — the twin `63`s were a
    fair suspicion; re-run confirms a genuine coincidence. Spec item 9 adds a
    durable pin so the claim no longer rests on a deleted script.
  - **Axis 6 opened** — the missing alternate marker is real, independent of this
    refactor, and split to its own ticket.
