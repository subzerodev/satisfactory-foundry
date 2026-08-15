# #116 — AltCompare row gets an `(alt)` marker

**Status:** v1 — DRAFT, not frozen.
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
`candidateRecipesFor`, which naturally drops that grouping. Its design went
through two review rounds discovering that it therefore could not drop the
grouping — and would have had to preserve it with a comparator plus an ordering
pin *that this ticket makes redundant*. Landing this first lets #103 take the
full simplification. Decided at the #103 r2 gate (Axis 2 option (d)).

## Grounding — verified at source

- The game data **does** prefix alternates: `mDisplayName` is literally
  `"Alternate: Recycled Rubber"`. **The parser strips it** —
  `src/data/docs-loader.ts:185-190` consumes the prefix as the `isAlternate`
  signal (`:185-186`) then deletes it (`:190`,
  `displayName: r.displayName.replace(/^Alternate:\s*/, "")`). Pinned by
  `src/data/docs-loader.test.ts:175`.
- So `CatalogRecipe.isAlternate` (`src/data/types.ts:80`) is the **only**
  surviving signal, and it is already populated for every recipe.
- `CandidateRow` (`chain-builder-adapter.ts:514-538`) has **no** `isAlternate`
  field; `:975` sets `recipeName: candidate.displayName` (the stripped name).
- `AltCompare.tsx:155` renders `{row.recipeName}` bare.
- **The repo already solved this once:** `ChainBuilder.tsx:668` re-adds the
  marker by hand — `if (recipe.isAlternate) tags.push("(alt)")` — inside
  `recipeLabel` (`:660-674`), which is **picker-only** and which AltCompare
  never calls.

## Decision axes

### Axis A — where `isAlternate` comes from

**Options:** (a) a new field on `CandidateRow`, set in `candidateRowsFor`;
(b) computed in the component from `catalog.recipes[row.recipeId].isAlternate`.

**PICK (a).** `AltCompare.tsx:8-13` states the component's architecture
explicitly: *"A thin shell (the LinkInspector precedent): all logic lives in the
pure exported helpers … so the component is a render pass over the model."*
(b) puts a catalog lookup back in the render and makes the behaviour
un-testable without a DOM. (a) keeps it node-testable at the model level.

### Axis B — reuse `recipeLabel` wholesale?

**Rejected.** `recipeLabel` composes three tags — `(alt)`, `(default)`,
`(machine excluded)`. The latter two are **wrong here**: excluded-machine
recipes are filtered out of the candidate list entirely, and "default" is
meaningless in a table that already marks the *current* row
(`AltCompare.tsx:153`, `.alt-compare-current` + a `current` mark at `:169`).
Reusing it would print noise. **Mirror its `(alt)` idiom, not its
implementation** — that is the reuse the situation actually supports.

### Axis C — plain text or a styled span

**Options:** (a) plain text, exactly like `ChainBuilder.tsx:668`; (b) a muted
`<span>`, like the existing `.alt-compare-byproducts`.

**PICK (b).** The reasoning matters, because (a) looks like the
consistency-preserving choice and is not: **ChainBuilder's plain text is forced,
not chosen.** Its `(alt)` lives inside an `<option>` label, and sub-parts of an
`<option>` cannot be styled. A `<td>` has no such constraint, and this table
already has an idiom for inline metadata beside the recipe name —
`.alt-compare-byproducts` (`src/ui/app.css:1609-1612`,
`color: var(--fg-muted); font-size: 12px`). Rendering `(alt)` at full weight
risks reading as part of the recipe name, which is the exact confusion this
ticket exists to remove.

New class `.alt-compare-alt` mirroring that treatment — 4 lines. Flagged
explicitly for the simplify pass as the one place this design spends anything.

### Axis D — cell composition order

`{recipeName} (alt) · +{byproducts}` — the marker binds to the name and
precedes the byproducts note, which is a property of the *subtree*, not the
recipe's identity.

### Axis E — does anything else change?

**No.** Not the ordering, not the `< 2` presence gate, not the Apply payload,
not `swapPayloadFor`, not `candidateCount`. Purely additive display. Stated so
the diff's blast radius is unambiguous at the boundary gate.

### Axis F — generalize to a `tags: string[]` for #115?

**No — YAGNI.** #115 (tier-locked labeling) will add a second marker to this
same row, which is a real and *known* second case, not a hypothetical. But two
booleans on a row is not a problem worth an abstraction, and designing a tag
framework for one existing plus one unbuilt consumer is exactly the premature
generalization the parsimony ladder warns against. **Noted on #115** so its
design revisits the question with two concrete cases in hand rather than one.

## Spec

1. `chain-builder-adapter.ts` — add to `CandidateRow` (`:514-538`):
   ```ts
   /** True when this candidate is an ALTERNATE recipe. The parser strips the
    *  game's "Alternate: " name prefix (docs-loader.ts:190), so `recipeName`
    *  cannot carry it and the comparison table has no other signal. */
   isAlternate: boolean;
   ```
2. `chain-builder-adapter.ts:~975` — set `isAlternate: candidate.isAlternate`
   in the returned row object.
3. `AltCompare.tsx:155` — render the marker after the name, before byproducts:
   ```tsx
   {row.recipeName}
   {row.isAlternate && <span className="alt-compare-alt"> (alt)</span>}
   ```
4. `src/ui/app.css` — add `.alt-compare-alt` beside `.alt-compare-byproducts`
   (`:1609`), same muted treatment.
5. Update `AltCompare.tsx`'s header docstring only if it enumerates row fields
   (**verify; do not edit speculatively**).

## Test plan

Two pins, both bidirectional, in `src/ui/AltCompare.test.tsx` and
`src/ui/chain-builder-adapter.test.ts`.

| Pin | File | Kills |
|---|---|---|
| The alternate candidate's row has `isAlternate: true` AND the standard candidate's row has `isAlternate: false` | `chain-builder-adapter.test.ts` | not wiring the field (spec 1-2), and wiring it to a constant |
| Rendered HTML contains `(alt)` **and** the standard row's cell does NOT | `AltCompare.test.tsx` | forgetting the render (spec 3), and hardcoding the marker on every row |

**Both rows must assert presence AND absence.** A pin that only checks the
alternate row passes against `isAlternate: true` hardcoded on every row — the
pass-either-way failure mode this repo has now hit nine times across two arcs.

**The render pin uses `renderToStaticMarkup`, NOT jsdom.** This is the file's own
established discipline, stated in its header (`AltCompare.test.tsx:1-7`): *"the
component itself gets a node-env SSR smoke (renderToStaticMarkup, no jsdom)"*,
with a worked example at `:255-287` that already seeds a solved store slice and
renders the full table. **This matters beyond style:** a third jsdom test file
would trigger #109 (extract the shared jsdom harness). The SSR route tests the
real render and incurs none of that.

The existing `CAT` fixture already has `ingot` with a standard **and** an
alternate producer, so both assertions land on one render.

## Assumptions ledger

| Assumption | Grounding |
|---|---|
| `CatalogRecipe.isAlternate` is populated for every recipe | VERIFIED — set unconditionally at `docs-loader.ts:185-191` |
| `recipeName` cannot carry the alternate signal | VERIFIED — stripped at `docs-loader.ts:190`, pinned by `docs-loader.test.ts:175` |
| The comparison table has no other alternate signal | VERIFIED — `CandidateRow` has no such field; `AltCompare.tsx:155` renders the bare name; `recipeLabel` is picker-only |
| `<option>` sub-parts cannot be styled — so ChainBuilder's plain text is forced | Standard HTML behaviour; it is why Axis C does not simply copy it |
| `.alt-compare-byproducts` is the in-file idiom for inline muted metadata | VERIFIED — `app.css:1609-1612` |
| `AltCompare.test.tsx` can render without jsdom | VERIFIED — `renderToStaticMarkup` used at `:251` and `:279`; file header states the discipline |
| Only 2 jsdom test files exist today, so #109 is not yet triggered | VERIFIED — `grep -l "vitest-environment jsdom" src/` returns `ChainBuilder.rawtarget.test.tsx`, `ChainBuilder.gating.test.tsx` |
| The `CAT` fixture has both a standard and an alternate ingot producer | VERIFIED — `AltCompare.test.tsx:25` comment + fixture |

## Revision history

- **v1** (2026-08-15) — first draft. Promoted from a #103 follow-up to its
  predecessor at the #103 r2 design gate.
