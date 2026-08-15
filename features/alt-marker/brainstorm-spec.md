# #116 — AltCompare row gets an `(alt)` marker

**Status:** v4 — CORRECTNESS-APPROVED (r3: APPROVED_WITH_NITS ×2, nits folded).
Awaiting the one-shot simplify pass before freeze.
**Ticket:** #116 (Stage 21 milestone 92). **Blocks #103.**
**Tier:** 2 (single feature, user-visible, no sub-phases).

## Purpose

The alternate-recipe comparison table marks alternates **nowhere**. Comparing
rubber recipes today renders:

```
Residual Rubber
Rubber
Recycled Rubber      <- an ALTERNATE, indistinguishable from the others
```

The only thing conveying "this row is an alternate" is its **position** —
`candidateRecipesFor` groups every non-alternate before every alternate
(`src/ui/chain-builder-adapter.ts:558-561`). That is implicit, undocumented, and
destroyed by any re-ordering.

**Why it is a predecessor of #103, not a follow-up.** #103 retires
`candidateRecipesFor`, which naturally drops that grouping. Its design spent two
review rounds discovering it therefore could NOT drop the grouping, and would
have had to preserve it with a comparator plus an ordering pin *that this ticket
makes redundant*. Landing this first lets #103 take the full simplification.
Decided at the #103 r2 gate (Axis 2 option (d)).

## Grounding — verified at source

- The game data **does** prefix alternates: `mDisplayName` is literally
  `"Alternate: Recycled Rubber"`. **The parser strips it** —
  `src/data/docs-loader.ts:185-186` derives `isAlternate` from the prefix, `:190`
  deletes it (`displayName: r.displayName.replace(/^Alternate:\s*/, "")`), and
  `:192` assigns the flag. Pinned by `src/data/docs-loader.test.ts:174-176`.
- So `CatalogRecipe.isAlternate` (`src/data/types.ts:90`) is the **only**
  surviving signal, and it is populated for every recipe.
- `CandidateRow` (`chain-builder-adapter.ts:514-538`) has **no** `isAlternate`
  field; `:975` sets `recipeName: candidate.displayName` (the stripped name).
- `AltCompare.tsx:155` renders `{row.recipeName}` bare.
- **The repo hand-rolls this marker in TWO places, both `<option>` text** (r1
  fold — v1 said one):
  - `ChainBuilder.tsx:668` — `if (recipe.isAlternate) tags.push("(alt)")`, inside
    `recipeLabel` (`:660-674`), consumed as `<option>` text at `:556` and `:755`.
  - `ControlsStrip.tsx:17-19` — `optionLabel`, `` r.isAlternate ? `${r.displayName} (alt)` : r.displayName ``,
    consumed as `<option>` text at `:83-86`.

  Neither is called by AltCompare. That **both** are `<option>` text is what makes
  Axis C's premise load-bearing rather than anecdotal.

## Decision axes

### Axis A — where `isAlternate` comes from

**Options:** (a) a new field on `CandidateRow`, set in `candidateRowsFor`;
(b) computed in the component from `catalog.recipes[row.recipeId].isAlternate`.

**PICK (a).** `AltCompare.tsx:9-12` states the architecture: *"A thin shell (the
LinkInspector precedent): all logic lives in the pure exported helpers … so the
component is a render pass over the model."* (b) puts a catalog lookup back in
the render and makes the behaviour un-testable at the model level.

### Axis B — reuse `recipeLabel` wholesale?

**Rejected.** `recipeLabel` composes three tags — `(alt)`, `(default)`,
`(machine excluded)` — and the latter two do not belong here:

- `(default)` is a **separate signal this ticket was not asked to add**. (r1
  fold: v1 said it was "meaningless because the current row is already marked",
  which **conflates two different things** — `effectiveDefaultRecipe`
  (`chain-builder-adapter.ts:581`) is the *policy* default, `isCurrent` is the
  *applied* recipe, and they diverge exactly when the user is running an
  alternate. The conclusion stands; the stated reason was wrong.)
- `(machine excluded)` requires an `excludedMachineIds` set **AltCompare does not
  have**. (r1 fold: v1 claimed excluded recipes are "filtered out entirely",
  which **overclaims**. `candidateRowsFor` calls `candidateRecipesFor(catalog,
  itemId)` with no exclusions argument (`:948`), so it uses the hardcoded
  `EXCLUDED_MACHINE_IDS` default (`:31-34`) and is blind to the USER's machine
  exclusions — a user-excluded producer CAN appear as a compare row. That is
  **consistent with the deliberate ungated-compare decision** recorded at #103
  Axis 5: AltCompare serves the APPLIED graph, where a stage may legitimately
  run a recipe the propose surfaces would exclude. Not a defect; just not what
  v1 said.)

**Mirror `recipeLabel`'s `(alt)` idiom, not its implementation.**

### Axis C — how the marker is styled — **RE-DECIDED AT r1**

**Options:** (a) plain text, like `ChainBuilder.tsx:668` and
`ControlsStrip.tsx:18`; (b) a **new** `.alt-compare-alt` class mirroring
`.alt-compare-byproducts` — v1's pick; (c) **reuse the existing
`.alt-compare-mark`**.

**PICK (c) — reuse `.alt-compare-mark`. Zero new CSS.**

v1 chose (b) and self-flagged it as "the one place this design spends anything".
The r1 adversarial reviewer pointed out I never surveyed (c), which costs
nothing. `.alt-compare-mark` (`app.css:1605-1607`, `color: var(--fg-muted)`) is
defined exactly once and is already **the compare table's inline-muted-marker
class**, used at `AltCompare.tsx:169` for the `current` mark. An `(alt)` tag is
the same kind of thing — an inline muted marker in this table — so this is
correct reuse, not coincidental coupling.

**The counter-argument, named and rejected:** reusing it couples two meanings, so
a future restyle of `current` would also move `(alt)`. Real, but both are
"muted inline marker" and want the same treatment; splitting them when that stops
being true is a two-line change. Speculating a divergence now is the
generalization the parsimony ladder warns against.

**Why (a) is still rejected.** Both existing plain-text sites are `<option>`
text, where sub-parts **cannot** be styled — the plain text is *forced, not
chosen*. A `<td>` has no such constraint, and rendering `(alt)` at full weight
risks reading as part of the recipe name, which is the exact confusion this
ticket removes.

**Consequence: v1's spec item 4 (add CSS) is DELETED.** This also dissolves the
r1 nit that nothing gated it.

### Axis D — cell composition order

`{recipeName} (alt) · +{byproducts}` — the marker binds to the name; byproducts
are a property of the *subtree*, not the recipe's identity.

### Axis E — does anything else change?

**No**, and r1 verified it exhaustively: `CandidateRow` is constructed in exactly
one place (`chain-builder-adapter.ts:973-985`) and consumed in exactly one
(`AltCompare.tsx:90-97`, mounted once at `App.tsx:388`). No test builds a
`CandidateRow` literal; no `toMatchSnapshot`/`toMatchInlineSnapshot` exists in the
repo; every adapter pin is field-by-field (`:416-426`, `:438-442`, `:466-472`,
`:518-522`, `:560-564`, `:593-597`, `:617-631`, `:876-882`), so a new required
field breaks no typecheck and no assertion. Not the ordering, not the `< 2` gate,
not `swapPayloadFor`, not `candidateCount`, no serialization.

### Axis F — generalize to a `tags: string[]` for #115?

**No — YAGNI.** #115 will add a second marker to this row, which is real and
known. But two booleans is not an abstraction problem, and a tag framework for
one existing plus one unbuilt consumer is premature. **Noted on #115** so its
design revisits with two concrete cases. (r1 note: a `tags` abstraction would
eventually have *three* sites counting `ControlsStrip` — still not enough, and
those two are `<option>` strings with different composition rules.)

## Spec

1. `chain-builder-adapter.ts` — add to `CandidateRow` (`:514-538`):
   ```ts
   /** True when this candidate is an ALTERNATE recipe. The parser strips the
    *  game's "Alternate: " name prefix (docs-loader.ts:190), so `recipeName`
    *  cannot carry it and the comparison table has no other signal. */
   isAlternate: boolean;
   ```
2. `chain-builder-adapter.ts:~975` — set `isAlternate: candidate.isAlternate`.
   **Read the mutant warning in the test plan before writing this line.**
3. `AltCompare.tsx:155` — render after the name, before byproducts, reusing the
   existing class:
   ```tsx
   {row.recipeName}
   {row.isAlternate && <span className="alt-compare-mark"> (alt)</span>}
   ```
4. Verify `AltCompare.tsx`'s header docstring does not enumerate row fields;
   edit only if it does.

**No CSS change** (Axis C).

## Test plan

Two pins, in `src/ui/chain-builder-adapter.test.ts` and
`src/ui/AltCompare.test.tsx`.

### The mutant that nearly shipped — BOTH r1 reviewers found it independently

v1 specified both pins as presence-AND-absence and called that sufficient. **It
is not.** **All eight** `candidateRowsFor` call sites pass a NON-ALTERNATE as the
current recipe — `"r_std"` at `chain-builder-adapter.test.ts:412, 435, 466, 591,
876`, `"r_widget_a"` at `:514` and `:559`, and `"ingot_iron"` at `:617`; plus
`AltCompare.test.tsx:263` seeding `selection("r_std")`. So across the whole suite
**`isAlternate` is perfectly aliased with `!isCurrent`.**

(r3 fold: v2's enumeration listed only five of the eight. The conclusion held at
every site, but note `:617` aliases for a *different structural reason* — it runs
against the REAL bundled catalog with **five** candidates, 1 non-alternate + 4
alternates (`:601-614`), so the alias comes from every alternate being
non-current rather than from a 2-row bijection. A sweep claiming completeness
should be complete.)

The new field goes in one line below `isCurrent: candidate.id === currentRecipeId`
(`chain-builder-adapter.ts:976`), which makes

```ts
isAlternate: candidate.id !== currentRecipeId   // WRONG
```

**v1's** most plausible slip — and it passes presence, absence, and produces
**byte-identical HTML**. The same holds for
`{!row.isCurrent && <span…>}` in the render. (r3 fold: v2 called this "the single
most plausible slip" full stop, which now contradicts the `===` mirror analysis
below — that one is *more* plausible. Scoped to v1 so the two sections agree.)

**What it would ship:** one click after Apply the user is running the alternate.
Under the mutant they see `(alt)` on every *standard* row and none on the
alternate they are on — the exact inversion this ticket exists to prevent, green.

### v2's fix was WRONG — it inverted the correlation instead of removing it (r2, both reviewers, again independently)

v2 "decorrelated" by making the ALTERNATE the current recipe. That does not
work, and the reason is structural: **both fixtures hold exactly two recipes,
exactly one of them alternate** (`AltCompare.test.tsx:73-88`,
`chain-builder-adapter.test.ts:395-409`). In a fixture of that shape
`isAlternate` is a **bijection** with `isCurrent` whichever recipe is current —
v1 got `≡ !isCurrent`, v2 got `≡ isCurrent`. The alias family was never closed,
only flipped.

So the **mirror-image mutant survives v2's pins byte-identically**:

```ts
isCurrent:   candidate.id === currentRecipeId,
isAlternate: candidate.id === currentRecipeId,   // WRONG — copy the line, forget the RHS
```

It is **more plausible than v1's `!==`** (a verbatim duplicate needs copy alone;
`!==` needs copy *plus* negate) and **strictly worse in effect**: it misfires in
the **default** state, so a user sitting on the standard recipe sees `(alt)` on
the standard row and nothing on the actual alternate. v1's mutant at least
required an Apply first.

**This is the exact failure the lesson at the bottom of this section names** —
*bidirectionality does not kill correlation with an adjacent field* — and v2's
own fix failed to act on it. Recorded rather than quietly corrected, because the
tempting fix (change which row is current) is the one that does not work.

**The fix: pin BOTH polarities, and decorrelate the adapter fixture properly.**

| Pin | File | Form | Kills |
|---|---|---|---|
| The flag is right regardless of what is current | `chain-builder-adapter.test.ts` | a **THREE-recipe** local fixture — two non-alternates + one alternate — with a *non-alternate* current; assert the whole triple `rows.map(r => r.isAlternate)` equals `[false, false, true]` | hardcoded `true`/`false`, `=== currentRecipeId`, `!== currentRecipeId`, **and** the positional `index > 0` — all four in one assertion |
| The marker follows the RECIPE, not the selection | `AltCompare.test.tsx` | **two** `renderToStaticMarkup` passes in the same seeding harness — `selection("r_std")` and `selection("r_alt")` — asserting in **both** that `html` contains `<td>Alternate<span class="alt-compare-mark"> (alt)</span></td>` **and** `<td>Standard</td>` | forgetting the render, hardcoding it on every row, and the render-side `row.isCurrent` / `!row.isCurrent` substitutions |

**Why the three-recipe fixture for the adapter.** With recipes ordered
non-alternates-first (`chain-builder-adapter.ts:558-561`), a 2-non-alt + 1-alt
fixture with the first current gives three mutually distinct vectors —
`isAlternate = [F,F,T]`, `isCurrent = [T,F,F]`, `index > 0 = [F,T,T]` — so a
single `toEqual` separates the real field from every plausible impostor.

It needs a **local** catalog. The blocker against widening the describe-scoped
`cat` (`chain-builder-adapter.test.ts:395-409`) is `:413`
(`expect(rows).toHaveLength(2)`) plus the positional destructure at `:414`.
Per-test catalogs are already idiomatic in that file (`varCat` `:448`, `bpCat`
`:478`, `selfCat` `:573`). (r3 fold: v2 cited `AltCompare.test.tsx:175` here —
**the wrong file**; that file has no bearing on the adapter pin, and there is no
`CAT` in `chain-builder-adapter.test.ts` at all. As written it could have sent an
implementer to put the three-recipe pin in the render file.)

**Do NOT reuse `ingotCatalog()`** (`chain-builder-adapter.test.ts:894-941`) — it
is the obvious shortcut and it is the **wrong shape**: 1 non-alternate + 2
alternates gives `isAlternate = [F,T,T]`, which is exactly `index > 0`, so the
positional mutant would survive.

**The load-bearing constraint is that the current recipe must NOT be the
alternate.** If it were, `isCurrent` would be `[F,F,T] ≡ isAlternate` and the
`=== currentRecipeId` mutant would survive again. *Which* non-alternate is
current does not matter — `[T,F,F]` and `[F,T,F]` both kill all four mutants.

**Why two render passes rather than a third fixture.** The render reads
`row.isAlternate` with no index in scope, so the positional mutant is
unreachable there; only the `isCurrent` substitutions matter, and asserting the
**identical** two substrings at both polarities kills them at zero fixture cost.
That the assertion is byte-identical in both passes is the point: *the marker is
invariant under which row is current.*

**Two assertion-form traps, named because the obvious form is wrong:**

- The absence half **cannot** be `expect(html).not.toContain("(alt)")` —
  `renderToStaticMarkup` returns one flat string containing both rows. It must be
  scoped to the cell: `toContain("<td>Standard</td>")`. That exact string holds —
  `AltCompare.tsx:154-162` emits the byproducts span only when non-null, and the
  `CAT` fixture's chains produce none.
- The presence half **must keep the parens**. The fixture's alternate recipe is
  *named* `"Alternate"` (`AltCompare.test.tsx:82`), so a bare `toContain("alt")`
  would pass on the recipe name alone.

**The positional mutant is now KILLED, not acknowledged.** v2 recorded
`isAlternate: index > 0` as a deliberate gap, on the grounds that killing it
needed a two-non-alternate fixture costing "more than this ticket should spend."
That pricing was wrong once the same fixture also had to kill the `===` and
`!==` correlations: one fixture now buys three mutants instead of one, so it is
cheap rather than expensive. The whole alias family is closed.

**The full survivor sweep** (r2 adversarial, over everything in
`candidateRowsFor`'s callback scope, `:950-986`) — fields aliased with
`isAlternate` in a 2-row fixture are `machineId`, `displayName`,
`outputs[0].perMinute`, the derived `machines`/`power`/`rawDraw`, array
position, and `currentRecipeId` equality. Only the last two are plausible
implementation slips, and both are now pinned.

**Deliberately NOT pinned, stated in full so the completeness claim is honest**
(r3 fold — v3 named only the styling here):

- Hardcoded `machineId` / `displayName` / rate constants. Not slips an
  implementer produces.
- `index === candidates.length - 1` (or any hand-tuned positional constant). **No
  finite fixture can close the positional family** — an index expression can
  encode any vector. `index > 0` is pinned because it is the only positional form
  derived from a real structural property (the non-alternates-first ordering).
  Note the render cannot reach positional mutants at all: `AltCompare.tsx:149`
  destructures `({ row, apply })` with **no index parameter**, so reaching one
  requires deliberately adding a second `.map` argument.
- **Axis D's composition order.** Spec item 3 places the marker after the name
  and before byproducts, but the fixture's recipes are single-output so
  `byproducts` is `null` on every row — a marker emitted *after* the byproducts
  span renders byte-identically. Cosmetic, and spec item 3 gives the literal JSX,
  so it does not justify a fixture; recorded rather than left silent.
- The styling itself (see below).

**The two pins cover each other's blind spots**, which is why both are needed:
the render passes exercise the real `candidateRowsFor` (`AltCompare.tsx:90`), so
they independently kill the `===` / `!==` correlations, while the three-recipe
fixture kills the positional mutant the render cannot see. A fourth mutant falls
out free — `candidate.id !== effectiveDefaultRecipe(catalog, itemId)?.id` gives
`[F,T,T]` on three rows and would have survived any two-row fixture.

**The render pin uses `renderToStaticMarkup`, NOT jsdom** — this file's own
discipline (`AltCompare.test.tsx:1-7`), with a worked store-seeding example at
`:265-286`. A third jsdom file would trigger #109; the SSR route tests the real
render and incurs none of it. r1 verified the pin is writable as specified: `CAT`
(`:63-94`) carries `r_std` "Standard" (smelter, non-alternate) and `r_alt`
"Alternate" (foundry, `isAlternate: true`), both primary-producing `ingot`.

**Not gated: the styling.** Under Axis C there is no new CSS, but reuse of
`.alt-compare-mark` is asserted only as a class name in markup, not as a computed
style. Consistent with this file's stated split — *"the browser walk is the visual
gate"* (`AltCompare.test.tsx:5-6`). Stated explicitly rather than left silent.

## Assumptions ledger

| Assumption | Grounding |
|---|---|
| `CatalogRecipe.isAlternate` is populated for every recipe | VERIFIED — derived `docs-loader.ts:185-186`, assigned `:192` |
| `recipeName` cannot carry the alternate signal | VERIFIED — stripped `docs-loader.ts:190`, pinned `docs-loader.test.ts:174-176` |
| The comparison table has no other alternate signal | VERIFIED — `CandidateRow` (`:514-538`) has no such field; `AltCompare.tsx:155` renders the bare name; both hand-rolled markers are `<option>`-only |
| Both existing `(alt)` sites are `<option>` text, so plain text is FORCED | VERIFIED — `ChainBuilder.tsx:556, 755`; `ControlsStrip.tsx:83-86` |
| `.alt-compare-mark` is the table's inline-muted-marker class | VERIFIED — `app.css:1605-1607`, defined once, used at `AltCompare.tsx:169` |
| `AltCompare.test.tsx` can render without jsdom | VERIFIED — `renderToStaticMarkup` at `:251`, `:279`; seam-stub `:265-286` |
| Only 2 jsdom files exist, so #109 stays untriggered | VERIFIED by both r1 reviewers |
| `CandidateRow` is constructed in exactly ONE place | VERIFIED by both r1 reviewers — `:973-985`; no literals, no snapshots, no whole-object `toEqual` |
| **`isAlternate` is a BIJECTION with `isCurrent` in both 2-recipe fixtures, whichever recipe is current** | VERIFIED — each holds exactly 2 recipes, exactly 1 alternate (`AltCompare.test.tsx:73-88`, `chain-builder-adapter.test.ts:395-409`). **This is why v2's "make the alternate current" fix failed and why the adapter needs a 3-recipe fixture** |
| The alias also holds at the 5-candidate BUNDLED fixture, for a different reason | VERIFIED (r3) — `chain-builder-adapter.test.ts:601-617` is 1 non-alternate + 4 alternates with the non-alternate current, so the alias comes from *every alternate being non-current*, not from a bijection. Same conclusion, different mechanism |
| The alternate sorts LAST for any legal id choice | VERIFIED (r3, both reviewers) — `chain-builder-adapter.ts:558-561` keys on `isAlternate` FIRST and uses id only as a tiebreak, so `isAlternate = [F,F,T]` is id-independent |
| Compare is blind to USER machine exclusions | VERIFIED — `:948` passes no exclusions, defaulting to `EXCLUDED_MACHINE_IDS` (`:31-34`). Consistent with #103 Axis 5's ungated-compare decision |

## Revision history

- **v1** (2026-08-15) — first draft. Promoted from a #103 follow-up to its
  predecessor at the #103 r2 design gate.
- **v2** (2026-08-15) — r1 fold. Both reviewers NEEDS_REWORK, converging on the
  **same IMPORTANT independently**.
  - **The tenth pass-either-way test, caught at design time.** v1's
    presence-AND-absence pins are aliased: every fixture makes the current recipe
    the non-alternate, so `isAlternate ≡ !isCurrent` and the most plausible
    implementation slip — writing `candidate.id !== currentRecipeId` one line
    below `isCurrent: candidate.id === currentRecipeId` — passes both halves with
    byte-identical HTML. Fixtures now put the ALTERNATE current. Bidirectionality
    kills constants and inversions; it does **not** kill correlation with an
    adjacent field, which is the lesson worth keeping.
  - **Axis C RE-DECIDED to zero-cost reuse** (adversarial). v1 added a new
    `.alt-compare-alt` class without surveying `.alt-compare-mark`, which already
    is this table's inline-muted-marker class. Spec item 4 deleted.
  - **Axis B's two stated reasons CORRECTED** (both wrong, conclusion unchanged):
    `(default)` vs `isCurrent` conflated *policy* default with *applied* recipe;
    "excluded recipes are filtered out entirely" overclaimed — compare uses the
    hardcoded default set and is blind to user exclusions, which is deliberate
    per #103 Axis 5.
  - **Assertion forms specified** (code-reviewer) — the absence half cannot be a
    whole-document negation, and the presence half must keep the parens because
    the fixture recipe is literally named "Alternate".
  - **Second hand-rolled site added** — `ControlsStrip.tsx:17-19`; it strengthens
    Axis C by making the `<option>` premise a pattern rather than an anecdote.
  - **Positional mutant acknowledged** as a deliberate, reasoned gap.
  - **Citations trued up** — `types.ts:90` (not `:80`), `:9-12` (not `:8-13`),
    `docs-loader.ts:185-186` + `:192` (not `:185-191`). (r2 nit: v2 also claimed
    a correction to `AltCompare.tsx:152`, but no claim in the body rests on that
    line — the body correctly cites `:155` and `:154-162`. Dangling correction
    removed so a later reader does not "fix" the correct citation.)
- **v3** (2026-08-15) — r2 fold. Both reviewers NEEDS_REWORK, converging on the
  **same IMPORTANT independently for the second round running**.
  - **v2's fix was wrong in the most instructive way: it INVERTED the
    correlation rather than removing it.** Both fixtures hold exactly two
    recipes, exactly one alternate, so `isAlternate` is a *bijection* with
    `isCurrent` whichever recipe is current — v1 got `≡ !isCurrent`, v2 got
    `≡ isCurrent`. The mirror-image mutant (`isAlternate: candidate.id ===
    currentRecipeId`, a verbatim copy of the line above) survives v2's pins
    byte-identically, is **more** plausible than v1's `!==` (copy alone vs copy
    plus negate), and is **worse** — it misfires in the DEFAULT state rather
    than only after an Apply. v2 stated the correct lesson and then failed to
    apply it; recorded rather than quietly fixed, because the tempting fix is
    the one that does not work.
  - **Adapter pin → a three-recipe local fixture.** Two non-alternates + one
    alternate with a non-alternate current yields three mutually distinct
    vectors (`[F,F,T]` / `[T,F,F]` / `[F,T,T]`), so one `toEqual` kills the
    constants, both `currentRecipeId` correlations, and the positional mutant.
  - **Render pin → two passes at both polarities**, asserting the identical two
    substrings each time (the marker is invariant under which row is current).
    The positional mutant is unreachable in the render, so no third fixture.
  - **The positional mutant is now killed, not acknowledged** — v2 priced that
    fixture against one mutant; it buys three.
  - **Full survivor sweep recorded**, naming what remains deliberately unpinned
    and why.
  - **Byte-accuracy confirmed by both reviewers** — React 19.2's
    `renderToStaticMarkup` emits no `<!-- -->` separators under
    `generateStaticMarkup`, and separators only ever fall between two adjacent
    *text* nodes anyway; JSX strips the whitespace-only newlines around the
    marker child and preserves the span's leading space. Both specified
    substrings hold exactly.
  - **Axis C reuse re-confirmed** — `.alt-compare-mark` has one declaration, one
    consumer, and zero references in tests or descendant selectors; no state
    leaves the marker unstyled.
- **v4** (2026-08-15) — r3 fold. **Both reviewers APPROVED_WITH_NITS** — the
  correctness pair has converged. All findings were citation-precision defects in
  the *justifications*; none changed a line of what gets written.
  - **Wrong-file citation** (both, NIT). v3 justified the local adapter fixture
    by citing `AltCompare.test.tsx:175`, which has no bearing on the adapter pin
    — and `chain-builder-adapter.test.ts` contains no `CAT` at all. Re-pointed to
    `:413`/`:414`. Added the near-miss shortcut `ingotCatalog()` (`:894-941`) and
    why it must NOT be reused (1 non-alt + 2 alts ⇒ `[F,T,T]` ≡ `index > 0`).
  - **Unretired superlative** (adversarial, NIT) — v3 still called v1's `!==` "the
    single most plausible slip" while separately arguing the `===` mirror is more
    plausible. Scoped to v1.
  - **Incomplete alias enumeration** (adversarial, NIT) — v3 listed five of the
    **eight** `candidateRowsFor` call sites. All eight pass a non-alternate as
    current, so the conclusion held everywhere; but `:617` runs against the REAL
    bundled catalog with 5 candidates and aliases for a *different structural
    reason*, which the ledger's "exactly 2 recipes" explanation did not cover.
  - **Unpinned-list completed** (code-reviewer, NIT) — v3 claimed to name
    everything deliberately unpinned and named only the styling. Axis D's
    composition order is also unpinned (single-output fixtures ⇒ `byproducts` is
    `null`, so a marker after the byproducts span is byte-identical), as is the
    unclosable positional-constant family.
  - **Recorded from the r3 verification, not previously claimed:** the alternate
    sorts LAST for *any* legal id choice (the comparator keys on `isAlternate`
    first, id only as tiebreak); the two pins **cover each other's blind spots**
    (the render kills the `===`/`!==` correlations by exercising the real
    `candidateRowsFor`, the 3-row fixture kills the positional the render cannot
    reach); and a **fourth** mutant falls free —
    `!== effectiveDefaultRecipe(...)?.id` gives `[F,T,T]` on three rows.
