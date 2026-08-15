# S21 P2 (#106) — Branded `GatedCatalog`: measurement report and verdict

Ticket #106, epic #108, milestone 92 (Stage 21). Run on `develop` @ `bc2b435`,
i.e. **after P1 (#103) landed** (merge `0805af0`) — so the count below is of the
consolidated surface #106's `blocked-by` existed to produce.

**v4. Recommendation: CLOSE #106 as won't-do.** A brand would close nothing the
existing suite misses. What ships is a documentation change on `gateCatalog` —
required regardless, since its comment pointed at this ticket as the fix.

This is a measurement report, not a build spec. v1 and v2 proposed builds; both
were refuted by review. `## Revision history` keeps the trail, because the wrong
turns are the reusable part.

## Verdict

| | |
|---|---|
| Places in `ChainBuilder.tsx` where the gated/ungated swap **compiles** | **10** (8 call sites + 2 object-literal fields) |
| Already caught — swapping turns `ChainBuilder.gating.test.tsx` red | **8** |
| Green and **provably inert** (`byproductSuggestions`) | 1 |
| Green and a **real gap** (`recipeLabel` in the recovery select) | 1 → split to **#117** |
| **Net new coverage a brand would add** | **zero** |

## The measurement

`seam-detection.sh` (beside this file), run on a clean tree. Per row: write the
one-token slip into `ChainBuilder.tsx`, run `npx tsc -b` + the full 912-test
suite, restore. Slips are matched by **content** with a one-occurrence
assertion; the suite verdict requires a summary line to be present before it is
believed.

```
SEAM SLIP                              BRAND    TESTS
SOLVE proposeChainForCatalog           missed   RED
S1 Preview.gated                       missed   RED
S2 RecipePicker prop                   missed   RED
S3 toProposalPreview                   missed   RED
S4 ungatedCatalog                      missed   RED
S5 excludableMachines                  missed   RED
S7 effectiveDefaultRecipe              missed   RED
S8 recipeLabel (recovery select)       missed   green (UNDETECTED)
S6 byproductSuggestions                missed   green (UNDETECTED)
U1 producerRecipesFor                  missed   RED
```

`BRAND` reads `missed` throughout because this run is on plain `develop`, where
no brand exists. **`brand-probe.patch` (beside this file) is the five-seam brand**
— apply it and re-run to reproduce the BRAND column: CAUGHT for S1, S2, S4, S6
and the direct (non-`??`) S5 form. Every one of those except S6 is already RED,
and S6 is inert. Applying the patch alone gives `tsc -b` exit 0 and 912 green
with **no test file touched**, so the churn estimate is measured too.

### Why `byproductSuggestions` is inert

Both r2 reviewers traced this independently and landed in the same place, and
r3 re-verified exhaustiveness. `byproductSuggestions` reads the catalog in
exactly two expressions — `catalog.items[id]?.displayName` and
`catalog.recipes[stage.recipeId]` over `proposal.stages` — and the only use of
the resolved recipe is `recipe.inputs`. Both are invariant across the worlds:

- `gateCatalog` returns `{ ...catalog, recipes }`, so `items` is the **same
  object** — pinned by the `toBe` assertion in `chain-builder-adapter.test.ts`
  ("carries items/machines/tiers through by reference").
- Every `stage.recipeId` is a key of the gated map by construction: the solve
  runs against `gatedCat`, `proposeChainForCatalog` hands the solver
  `Object.values(catalog.recipes)`, and the override path resolves within that
  same array (`src/core/chain-builder.ts`, `selectProducer`).

So both worlds return the identical value in every reachable state. Green
because there is nothing to observe.

### Why `recipeLabel` is not

No such argument exists — it is simply untested. `recipeLabel` appends its
`(default)` tag by comparing against `effectiveDefaultRecipe`, which the two
worlds can answer differently, and the recovery `<select>`'s option list is
built with the **live** exclusion set while the `constrained` cause was computed
with the **solved** one. Nothing in the suite selects
`.chain-builder-constrained select` or its options. Tracked as **#117**, which
carries the pass-either-way warning: a test that does not force the two worlds
to disagree will pass regardless.

### Two mechanism limits found along the way

Recorded because they are what a future "let's just brand it" proposal must
answer:

1. **Union laundering.** `preview?.gated ?? catalog` types as plain `Catalog`:
   TypeScript subtype-reduces the union, and `Catalog` then satisfies a negative
   brand's optional `?: never`. Measured by binding the expression to a
   `const __t: 1` and reading tsc's error. It launders **only** when the left
   operand is nullable. This is exactly the idiom the jsdom row at
   `ChainBuilder.gating.test.tsx:458-477` guards, and it also defeats
   `PreviewOptions.ungatedCatalog` at its own site, where `preview` is not
   narrowed.
2. **A brand cannot be sealed.** `GatedCatalog` must be exported to annotate
   anything, and `x as GatedCatalog` — or `<GatedCatalog>x`, or spreading an
   existing gated value — mints one from any module. "Only `gateCatalog` mints"
   would be grep-checked at best, never compiler-enforced.

## What ships

One doc comment on `gateCatalog`, plus this evidence directory. It was
**required regardless**: the comment read "the wiring is pinned by tests, not by
the compiler (a branded type is ticket #106)" — a pointer to a ticket now
closing. The same stale pointer in `ChainBuilder.gating.test.tsx`'s header
("deferred to #106") is corrected in the same commit.

No production behaviour changes; no test changes; 912 green.

## Why not the smaller ticket

Both r2 reviewers offered a fallback: keep `Preview.gated`,
`RecipePickerProps.catalog` and `PreviewOptions.ungatedCatalog` on
prevention-localisation alone — a `tsc` error at the slip line instead of a red
assertion in another file. ~8 lines, measured zero churn.

**Declined**, and at r3 the reviewer who proposed it agreed. The whole remaining
benefit is *better error localisation for defects that are already caught*. That
does not earn a new exported type pair — especially one carrying a measured
laundering hole, which invites a reader to assume more coverage than exists. The
jsdom rows must survive either way (a type cannot assert that a recipe is absent
from a rendered `<select>`), so the brand would be a partial guard advertised as
a total one.

Neither of the two call sites the reviewers found missing (`effectiveDefaultRecipe`,
`recipeLabel`) would have been caught by that fallback anyway: both are leaf
helpers called from **both** worlds, so no brand can narrow their parameters —
the same fact that refuted #106's own proposed shape.

## Revisit trigger

If a future change makes a green row stop being inert — most plausibly if
**#105**'s routing work makes `byproductSuggestions` resolve consumers against
the catalog rather than the proposal's stages — re-run the harness before
assuming this verdict still holds.

## Assumptions ledger

| Assumption | How grounded |
|---|---|
| 8 of 10 swap-legal sites are already RED | Measured — `seam-detection.sh`, full suite per row |
| The enumeration is complete | Two r3 reviewers independently swept `ChainBuilder.tsx` and agreed on the same ten; the two they added to v3's eight are now rows S7/S8 |
| The `byproductSuggestions` slip is behaviour-preserving | Traced by both r2 reviewers and re-verified exhaustive at r3 (two catalog reads, one use of the result) |
| The `recipeLabel` slip is NOT provably inert | Absence of an argument, not proof of a defect — #117's first task is to settle it either way |
| A brand would catch S1, S2, S4, S6 + direct S5 | Measured — `brand-probe.patch` applied, all rows re-run |
| Applying the brand costs zero test churn | Measured — tsc exit 0, 912 green, no test file touched |
| `preview?.gated ?? catalog` launders | Measured — `const __t: 1` probe |
| P1 landed before this measurement | `git log`: merge `0805af0`, HEAD `bc2b435`; `candidateRecipesFor` absent from `src/` |

## Revision history

- **v1** (2026-08-15): proposed branding four seams. Correctly refuted #106's
  own shape (narrowing the leaf helpers — `producerRecipesFor` has 11 production
  call sites spanning both worlds, so narrowing it would forbid the call P3's
  carve-out requires) and correctly established the negative brand. Every claim
  about *value*, though, was argued rather than measured.
  **r1 = NEEDS_REWORK ×2.** BLOCKER: "S4 is the negative brand's only production
  guard" was false — `excludableMachines` and `byproductSuggestions` were missed,
  both named in the very P3 correction v1 cited as its foundation. Also: the
  detection-reach premise was refuted; 26 → 21, with a repair instruction that
  would have corrupted five tests; `pickerOptionsFor` asserted un-narrowable but
  never measured; and "`gateCatalog` is the only expression that can mint a
  `GatedCatalog`" was false.
- **v2** (2026-08-15): replaced the arguments with measurements, dropped the
  `toProposalPreview` seam, found the union-laundering hole, and rested the case
  on `byproductSuggestions` being the one uncovered seam.
  **r2 = NEEDS_REWORK ×2**, both landing the same BLOCKER independently: **that
  seam is inert**, so the measurement was right and the *interpretation* was
  wrong — the precise failure mode measuring was supposed to end. Both also
  found `proposeChainForCatalog` missing from the enumeration, and that the S5
  "direct slip" credited the brand with a catch `strict` null-checking already
  makes.
- **v3** (2026-08-15): measured the missing solve-world seam (RED) and re-ran
  every row from a corrected harness. Verdict: close won't-do.
  **r3 (diff stage) = NEEDS_REWORK ×2**, both landing the same BLOCKER again:
  **"eight call sites" was false** — the enumeration counted two object-literal
  fields as call sites and omitted two real ones. Folded as S7
  (`effectiveDefaultRecipe`, measured **RED** — a ninth already-caught seam) and
  S8 (`recipeLabel`, measured **green** — a real gap, now #117). Also folded:
  the stale `#106` pointer left in `ChainBuilder.gating.test.tsx:22`; `FEATURE.md`
  stale on both P1 and P2; the brand patch not shipping, leaving the BRAND
  column unreproducible (now `brand-probe.patch`); line-number citations that
  this commit's own +14-line hunk would invalidate (now expression-based); the
  harness's absence-based green (now requires a summary line); and the
  `as GatedCatalog` bullet cut from the comment as generic TypeScript trivia
  about a type that exists nowhere in `src/`.
  **One finding rejected with counter-evidence:** r3 flagged the `bc2b435`
  provenance anchor as unverifiable, the session snapshot showing `955adf8` as
  most recent. `git log` confirms HEAD **is** `bc2b435`; the reviewer's snapshot
  predated two commits. The anchor stands.
- **Harness note, thrice-bitten.** This measurement produced a false all-clear
  twice and had a third path open. (1) A line-numbered script silently failed to
  apply all seven slips after an added import shifted every line. (2) Piping
  `vitest` into `grep -q` under `set -o pipefail` returned the *pipeline's*
  status — vitest's non-zero exit whenever tests fail — inverting every RED to
  green. (3) An absence-based read scored a crashed or collect-failed run as
  green. All three are now guarded, and each guard carries the comment saying
  why. Every false result read like a real finding.
