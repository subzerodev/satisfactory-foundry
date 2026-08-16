# Design review r2 (delta-scoped) — #116, AltCompare `(alt)` marker

Re-review of `features/alt-marker/brainstorm-spec.md` (**v2**) in
`/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, commit
`1be3de9`).

At r1 you both returned NEEDS_REWORK, converging on the same IMPORTANT
independently. All findings folded. Review the deltas only.

## The deltas (the ONLY changes since v1)

1. **Test fixtures decorrelated (the converged IMPORTANT).** v1's pins were
   satisfied by `isAlternate ≡ !isCurrent`, because every fixture makes the
   current recipe the non-alternate. Both pins now put the **alternate**
   current: `candidateRowsFor(cat, "ingot", "r_alt", F(120))` and
   `selection("r_alt")`. The mutant, its user-facing consequence, and the
   surviving positional mutant are all named in the test plan.
2. **Assertion forms specified** — the absence half is
   `toContain("<td>Standard</td>")` (a whole-document `not.toContain` is
   unwritable against a flat SSR string); the presence half keeps the parens
   because the fixture recipe is literally named `"Alternate"`.
3. **Axis C RE-DECIDED to zero cost** — reuse the existing `.alt-compare-mark`
   (`app.css:1605-1607`) instead of adding `.alt-compare-alt`. **Spec item 4
   (the CSS addition) is DELETED.** The coupling counter-argument is named and
   rejected.
4. **Axis B's two stated reasons corrected** (conclusion unchanged): the
   `(default)` argument conflated the POLICY default (`effectiveDefaultRecipe`)
   with the APPLIED recipe (`isCurrent`); "excluded recipes are filtered out
   entirely" overclaimed — compare passes no exclusions at
   `chain-builder-adapter.ts:948` and is blind to USER exclusions, which v2
   records as deliberate per #103 Axis 5.
5. **`ControlsStrip.tsx:17-19` added** as the second hand-rolled `(alt)` site,
   both `<option>` text.
6. **Styling explicitly ungated**, consistent with the file's stated
   "browser walk is the visual gate" split.
7. **Citations trued up** — `types.ts:90`, `AltCompare.tsx:152`, `:9-12`,
   `docs-loader.ts:185-186` + `:192`.

## Your question

Do these close r1 without opening anything new?

- **Walk the decorrelated pins against the mutant.** With `r_alt` current, does
  `isAlternate: candidate.id !== currentRecipeId` actually FAIL both pins? Write
  out what each renders. Confirm the specified assertion strings are
  byte-accurate against what `AltCompare.tsx:154-162` emits with
  `.alt-compare-mark` — in particular whether React inserts anything between
  `{row.recipeName}` and the `<span>`, and whether the `r_std` row really
  renders exactly `<td>Standard</td>` when it is NOT the current row.
- **Is there a THIRD correlation** the new fixtures still hide? `r_alt` is the
  foundry recipe and `r_std` the smelter one — does `isAlternate` now alias
  `machineId`, row index, or anything else in this 2-recipe fixture? Name any
  mutant that survives v2's pins.
- **Is reusing `.alt-compare-mark` right**, or does the coupling argument v2
  rejects actually bite? Check whether anything else keys off that class.
- **Does deleting spec item 4 leave the marker unstyled** in any state?
- Any residue of v1's refuted claims; any new hole.

## Do NOT re-litigate (r1 settled these)

- The no-jsdom `renderToStaticMarkup` route and that the pin is writable.
- Axis A (field on `CandidateRow`), Axis E ("nothing else changes" — verified
  exhaustively), Axis F (no `tags` abstraction).
- That both existing `(alt)` sites are `<option>` text.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings. This is a small change that
has now had a full round — if it is ready, APPROVE honestly rather than
manufacturing a finding.

Do NOT spawn nested verification agents; verify yourself and return your verdict
directly.
