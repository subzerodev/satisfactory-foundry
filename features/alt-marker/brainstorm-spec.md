# #116 — AltCompare row gets an `(alt)` marker

**Status:** v2 — in review (r1 folded).
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
is not.** Every existing fixture uses `r_std` as the current recipe
(`chain-builder-adapter.test.ts:412, 435, 466, 591, 876`; `AltCompare.test.tsx:263`
seeds `selection("r_std")`), and `r_std` is the non-alternate. So across the whole
suite **`isAlternate` is perfectly aliased with `!isCurrent`.**

The new field goes in one line below `isCurrent: candidate.id === currentRecipeId`
(`chain-builder-adapter.ts:976`), which makes

```ts
isAlternate: candidate.id !== currentRecipeId   // WRONG
```

the single most plausible slip — and it passes presence, absence, and produces
**byte-identical HTML**. The same holds for
`{!row.isCurrent && <span…>}` in the render.

**What it would ship:** one click after Apply the user is running the alternate.
Under the mutant they see `(alt)` on every *standard* row and none on the
alternate they are on — the exact inversion this ticket exists to prevent, green.

**The fix costs one argument: decorrelate the fixture by making the ALTERNATE the
current recipe.**

| Pin | File | Form | Kills |
|---|---|---|---|
| Rows carry the right flag with the alternate CURRENT | `chain-builder-adapter.test.ts` | `candidateRowsFor(cat, "ingot", "r_alt", F(120))`; assert the `r_alt` row has `isAlternate: true` **and** the `r_std` row has `isAlternate: false` | hardcoded `true`/`false`, an inversion, **and** the `!isCurrent` correlation |
| The marker renders on the alternate and NOT on the standard row | `AltCompare.test.tsx` | seed `selection("r_alt")`; assert `html` contains `<td>Alternate<span class="alt-compare-mark"> (alt)</span></td>` **and** contains `<td>Standard</td>` | forgetting the render, hardcoding it on every row, **and** the `!isCurrent` correlation |

**Two assertion-form traps, named because the obvious form is wrong:**

- The absence half **cannot** be `expect(html).not.toContain("(alt)")` —
  `renderToStaticMarkup` returns one flat string containing both rows. It must be
  scoped to the cell: `toContain("<td>Standard</td>")`. That exact string holds —
  `AltCompare.tsx:154-162` emits the byproducts span only when non-null, and the
  `CAT` fixture's chains produce none.
- The presence half **must keep the parens**. The fixture's alternate recipe is
  *named* `"Alternate"` (`AltCompare.test.tsx:82`), so a bare `toContain("alt")`
  would pass on the recipe name alone.

**Acknowledged, not pinned:** a positional mutant (`isAlternate: index > 0`) also
survives, because `candidateRecipesFor` orders non-alternates first
(`chain-builder-adapter.ts:558-561`). Killing it needs a fixture with two
non-alternates plus an alternate — more than this ticket should spend, and #103
retires that ordering anyway. Recorded so the gap is deliberate, not missed.

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
| **`isAlternate` aliases `!isCurrent` in every existing fixture** | VERIFIED — `chain-builder-adapter.test.ts:412, 435, 466, 591, 876`; `AltCompare.test.tsx:263`. **This is the r1 IMPORTANT and the reason the fixtures change** |
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
  - **Citations trued up** — `types.ts:90` (not `:80`), `AltCompare.tsx:152` (not
    `:153`), `:9-12` (not `:8-13`), `docs-loader.ts:185-186` + `:192` (not
    `:185-191`).
