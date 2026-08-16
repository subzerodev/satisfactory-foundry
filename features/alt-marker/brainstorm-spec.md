# #116 — AltCompare row gets an `(alt)` marker

**Status:** v5 — FROZEN (correctness pair APPROVED_WITH_NITS at r3; simplify pass
dispositioned).
**Ticket:** #116 (Stage 21 milestone 92). **Blocks #103.**
**Tier:** 2 (single feature, user-visible, no sub-phases).

## Purpose

The alternate-recipe comparison table marks alternates **nowhere**:

```
Residual Rubber
Rubber
Recycled Rubber      <- an ALTERNATE, indistinguishable from the others
```

The only thing conveying "this row is an alternate" is its **position** —
`candidateRecipesFor` groups non-alternates first
(`chain-builder-adapter.ts:558-561`). That is implicit and destroyed by any
re-ordering.

**Why it precedes #103.** #103 retires `candidateRecipesFor`, which drops that
grouping. Landing this first lets #103 take the full simplification instead of
preserving the grouping with a comparator it would then delete. Decided at the
#103 r2 gate (Axis 2 option (d)).

## Grounding — verified at source

- The game data prefixes alternates (`mDisplayName` = `"Alternate: Recycled
  Rubber"`), but **the parser strips it**: `docs-loader.ts:185-186` derives
  `isAlternate` from the prefix, `:190` deletes it, `:192` assigns the flag.
  Pinned by `docs-loader.test.ts:174-176`.
- `CatalogRecipe.isAlternate` (`types.ts:90`) is therefore the **only** surviving
  signal, populated for every recipe.
- `CandidateRow` (`chain-builder-adapter.ts:514-538`) has no `isAlternate` field;
  `:975` sets `recipeName` to the stripped name; `AltCompare.tsx:155` renders it
  bare.
- **The repo hand-rolls this marker in two places, both `<option>` text:**
  `ChainBuilder.tsx:668` (via `recipeLabel`, consumed at `:556`/`:755`) and
  `ControlsStrip.tsx:17-19` (consumed at `:83-86`). Neither is called by
  AltCompare.

## Decision axes

**A — where `isAlternate` comes from.** A field on `CandidateRow`, set in
`candidateRowsFor`; not computed in the component. `AltCompare.tsx:9-12` states
the architecture: *"all logic lives in the pure exported helpers … the component
is a render pass over the model."* Computing it in the render would put a catalog
lookup back in the component and make the behaviour un-testable at model level.

**B — not reusing `recipeLabel` wholesale.** It composes `(alt)`, `(default)` and
`(machine excluded)`. `(default)` is a separate signal, out of scope. `(machine
excluded)` needs an exclusions set AltCompare does not have — compare is
deliberately ungated (#103 Axis 5). Mirror its `(alt)` idiom, not its
implementation.

**C — styling: reuse `.alt-compare-mark`. Zero new CSS.** It is already this
table's inline-muted-marker class (`app.css:1605-1607`,
`color: var(--fg-muted)`), used at `AltCompare.tsx:169` for the `current` mark;
an `(alt)` tag is the same kind of thing. Plain text is rejected because both
existing plain-text sites are `<option>` text where sub-parts **cannot** be
styled — the plain text there is *forced, not chosen*. A `<td>` has no such
constraint, and `(alt)` at full weight risks reading as part of the recipe name.
(Reuse couples two meanings; splitting them if that ever stops being right is a
two-line change.)

**E — nothing else changes.** `CandidateRow` is constructed at exactly one site
(`chain-builder-adapter.ts:973-985`) and consumed at exactly one
(`AltCompare.tsx:90-97`, mounted once at `App.tsx:388`). No test builds a
`CandidateRow` literal; no snapshots exist in the repo; every adapter pin is
field-by-field. So a new required field breaks no typecheck and no assertion.
Not the ordering, not the `< 2` gate, not `swapPayloadFor`, not `candidateCount`,
no serialization.

**F — no `tags: string[]` abstraction.** #115 will add a second marker to this
row, but two booleans is not an abstraction problem. Noted on #115 so its design
revisits with two concrete cases.

## Spec

1. Add to `CandidateRow` (`chain-builder-adapter.ts:514-538`):
   ```ts
   /** true ⇒ this row's recipe is an ALTERNATE. The parser strips the game's
    *  "Alternate: " prefix (docs-loader.ts:190), so `recipeName` cannot carry it. */
   isAlternate: boolean;
   ```
2. Set `isAlternate: candidate.isAlternate` in `candidateRowsFor` (`~:975`).
   **Read the test plan before writing this line.**
3. `AltCompare.tsx:155` — after the name, before byproducts (the marker binds to
   the recipe's identity; byproducts to its subtree):
   ```tsx
   {row.recipeName}
   {row.isAlternate && <span className="alt-compare-mark"> (alt)</span>}
   ```
4. **No CSS change** (Axis C). **No docstring change** — `AltCompare.tsx:4` does
   enumerate *"machines, power, raw draw, byproducts"*, but those are comparison
   **metrics**; `(alt)` is an *identity* marker, not a metric, so the clause stays
   true.

## Test plan

### The mutant this plan exists to kill

Both reviewers, at two successive rounds, found that the obvious pins do not
discriminate. The field goes in one line below
`isCurrent: candidate.id === currentRecipeId` (`chain-builder-adapter.ts:976`),
so the plausible slips are `candidate.id === currentRecipeId` (a verbatim copy)
and `candidate.id !== currentRecipeId`.

**Both fixtures hold exactly two recipes, exactly one alternate, so
`isAlternate` is a *bijection* with `isCurrent` whichever recipe is current** —
`≡ !isCurrent` with the standard current, `≡ isCurrent` with the alternate
current. Presence-and-absence assertions therefore pass against the mutant, with
byte-identical HTML. Moving which row is current only *rotates* which mutant
survives; it does not decorrelate.

**The fix is to assert at BOTH polarities.** The pair breaks the correlation
that no single call can.

### The two pins

| Pin | File | Form |
|---|---|---|
| The flag follows the RECIPE, not the selection | `chain-builder-adapter.test.ts` | two calls on the existing `cat` — `candidateRowsFor(cat, "ingot", "r_std", F(120))` and `(…, "r_alt", …)` — each asserting `rows.map(r => r.isAlternate)` equals `[false, true]` |
| The marker follows the RECIPE, not the selection | `AltCompare.test.tsx` | two `renderToStaticMarkup` passes in the existing seeding harness (`:263-287`) — `selection("r_std")` and `selection("r_alt")` — each asserting `html` contains `<td>Alternate<span class="alt-compare-mark"> (alt)</span></td>` **and** `<td>Standard</td>` |

That the assertion is **identical at both polarities** is the point: the marker is
invariant under which row is current.

**Mutants killed:** hardcoded `true`/`false` (`[T,T]`/`[F,F]`);
`=== currentRecipeId` (fails the `r_std` call); `!== currentRecipeId` (fails the
`r_alt` call); `!candidate.isAlternate`; and render-side
`{row.isCurrent && …}` / `{!row.isCurrent && …}`, which fail the first and
second pass respectively.

**Two assertion-form traps** — the obvious forms are wrong:
- The absence half **cannot** be `expect(html).not.toContain("(alt)")` —
  `renderToStaticMarkup` returns one flat string containing both rows. Scope it
  to the cell: `toContain("<td>Standard</td>")`.
- The presence half **must keep the parens**: the fixture's alternate is *named*
  `"Alternate"` (`AltCompare.test.tsx:82`), so a bare `toContain("alt")` would
  pass on the recipe name alone.

**Deliberately not pinned.** A positional mutant (`isAlternate: index > 0`)
survives both pins — but **neither** map callback exposes an index
(`chain-builder-adapter.ts:950` is `candidates.map((candidate) => {`;
`AltCompare.tsx:149` destructures `({ row, apply })`), so reaching one requires
deliberately adding a parameter, which is not an implementer slip. No finite
fixture closes the positional family anyway. Also unpinned: the styling (this
file's stated split — *"the browser walk is the visual gate"*,
`AltCompare.test.tsx:5-6`), and hardcoded `machineId`/`displayName` constants,
which are not slips anyone produces with `candidate.isAlternate` in scope.

**No jsdom.** The render pin uses `renderToStaticMarkup` per this file's own
discipline (`AltCompare.test.tsx:1-7`, worked example at `:265-286`). A third
jsdom file would trigger #109.

## Assumptions ledger

| Assumption | Grounding |
|---|---|
| `CatalogRecipe.isAlternate` is populated for every recipe | VERIFIED — derived `docs-loader.ts:185-186`, assigned `:192` |
| `recipeName` cannot carry the alternate signal | VERIFIED — stripped `docs-loader.ts:190`, pinned `docs-loader.test.ts:174-176` |
| The table has no other alternate signal | VERIFIED — `CandidateRow` has no such field; `AltCompare.tsx:155` renders the bare name; both hand-rolled markers are `<option>`-only |
| Both existing `(alt)` sites are `<option>` text, so plain text is FORCED | VERIFIED — `ChainBuilder.tsx:556`, `:755`; `ControlsStrip.tsx:83-86` |
| `.alt-compare-mark` is the table's inline-muted-marker class, safe to reuse | VERIFIED — `app.css:1605-1607`; one declaration, one consumer (`AltCompare.tsx:169`), zero references in tests or descendant selectors |
| The exact-substring assertions are byte-accurate | VERIFIED — React 19.2's `renderToStaticMarkup` emits no `<!-- -->` separators under `generateStaticMarkup` (and separators only fall between two adjacent *text* nodes); JSX strips the whitespace-only newlines around the marker child and preserves the span's leading space |
| `CandidateRow` is constructed at exactly ONE site | VERIFIED — `:973-985`; no literals, no snapshots, no whole-object `toEqual` |
| **`isAlternate` is a bijection with `isCurrent` in both 2-recipe fixtures, whichever is current** | VERIFIED — `AltCompare.test.tsx:73-88`, `chain-builder-adapter.test.ts:395-409`. **This is why both pins assert at two polarities** |
| All eight `candidateRowsFor` call sites pass a non-alternate as current | VERIFIED — `chain-builder-adapter.test.ts:412, 435, 466, 514, 559, 591, 617, 876`. `:617` aliases for a different reason (5 candidates, all alternates non-current) |
| Neither map callback exposes an index | VERIFIED — `chain-builder-adapter.ts:950`, `AltCompare.tsx:149` |
| Compare is blind to USER machine exclusions | VERIFIED — `:948` passes none, defaulting to `EXCLUDED_MACHINE_IDS`. Deliberate per #103 Axis 5 |

## Revision history

- **v1** (2026-08-15) — first draft; promoted from a #103 follow-up to its
  predecessor at the #103 r2 gate.
- **v2** — r1 fold (both NEEDS_REWORK, same finding independently). The pins were
  satisfied by `isAlternate ≡ !isCurrent`; fixtures changed to put the alternate
  current. Axis C re-decided from a new CSS class to reusing `.alt-compare-mark`
  after the reviewer noted I never surveyed the zero-cost option. Axis B's two
  stated reasons corrected (conclusion unchanged). `ControlsStrip` added as the
  second hand-rolled site.
- **v3** — r2 fold (both NEEDS_REWORK, same finding independently). **v2's fix
  was wrong: it inverted the correlation rather than removing it** — with two
  recipes and one alternate the two fields are a bijection either way, so the
  mirror mutant (`=== currentRecipeId`, a verbatim copy of the line above)
  survived, and was worse because it misfires in the *default* state. Replaced
  with a three-recipe fixture plus two render passes.
- **v4** — r3 fold (both **APPROVED_WITH_NITS**; correctness converged). All
  citation-precision: a wrong-file citation, five of eight call sites
  enumerated, an unretired superlative, an incomplete unpinned list.
- **v5** — simplify pass dispositioned (advisory NEEDS_REWORK; does not gate).
  **Folded:** the three-recipe fixture is DROPPED — it was bought solely to kill
  the positional mutant, which the doc had *itself* ruled implausible for the
  render on the grounds that no index is in scope; `chain-builder-adapter.ts:950`
  has no index either, so I was applying two standards to one construct. Two
  polarities on the existing fixture kill every plausible mutant, so the
  `ingotCatalog()` warning and the "current must not be the alternate" constraint
  both dissolve with it. Axis D deleted (a non-decision; spec item 3 carries it
  in a clause). Spec item 4's deferred look-and-decide resolved here instead of
  handed to the implementer. Field docstring cut to two lines to match its
  neighbours. Revision history compressed from ~95 lines to this, with the two
  facts that lived only there — the SSR byte-accuracy rationale and the
  `.alt-compare-mark` safety check — promoted into the ledger. Document 447 →
  ~200 lines. **Rejected:** dropping the adapter pin entirely in favour of the
  render pin alone — the field is an adapter concern and belongs pinned in the
  adapter's own suite, and at two calls on an existing fixture it costs ~6 lines.
