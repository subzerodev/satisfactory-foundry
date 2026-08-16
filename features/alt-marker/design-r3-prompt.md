# Design review r3 (delta-scoped) — #116, AltCompare `(alt)` marker

Re-review of `features/alt-marker/brainstorm-spec.md` (**v3**) in
`/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, commit
`5dbd157`).

At r2 you both returned NEEDS_REWORK, converging on the same IMPORTANT
independently — for the second round running. Folded. Review the deltas only.

## The deltas (the ONLY changes since v2)

1. **v2's fix is recorded as WRONG and replaced.** v2 made the alternate the
   current recipe; you showed that inverts the correlation rather than removing
   it, because both fixtures hold exactly 2 recipes with exactly 1 alternate, so
   `isAlternate` is a bijection with `isCurrent` either way. The mirror-image
   mutant (`isAlternate: candidate.id === currentRecipeId`) is now named, with
   its higher plausibility and worse (default-state) consequence.
2. **Adapter pin → a THREE-recipe LOCAL fixture** — two non-alternates + one
   alternate, a *non-alternate* current — asserting the whole triple
   `rows.map(r => r.isAlternate)` equals `[false, false, true]`. Claimed to kill
   the constants, `=== currentRecipeId`, `!== currentRecipeId`, and the
   positional `index > 0`, in one assertion.
3. **Render pin → TWO `renderToStaticMarkup` passes**, `selection("r_std")` and
   `selection("r_alt")`, asserting the **identical** two substrings in both.
   Claimed to kill the render-side `row.isCurrent` / `!row.isCurrent`
   substitutions. Positional is argued unreachable in the render (no index in
   scope).
4. **The positional mutant is now killed rather than acknowledged** — v2 priced
   that fixture against one mutant; it buys three.
5. **Full survivor sweep recorded**, naming what stays deliberately unpinned.
6. **Dangling `AltCompare.tsx:152` correction removed** from the revision
   history.

## Your question

- **Walk the three-recipe fixture concretely.** With `candidateRecipesFor`'s
  ordering (`chain-builder-adapter.ts:558-561`: non-alternates first, then
  ascending id), pick actual ids and confirm the three vectors really are
  mutually distinct: `isAlternate = [F,F,T]`, `isCurrent = [T,F,F]`,
  `index > 0 = [F,T,T]`. Does the claim survive **any** legal id choice, or only
  some? If the ordering could place the alternate anywhere other than last, say
  so.
- **Hunt a FOURTH correlation in the NEW fixture.** Two non-alternates and one
  alternate — does `isAlternate` now alias `machineId`, `outputs.length`, rate,
  `displayName`, or anything else an implementer could plausibly reach for?
  Your r2 sweep was over a 2-row fixture; redo it for 3.
- **Walk the two render passes against both substitutions.** Confirm
  `{row.isCurrent && …}` fails the `selection("r_std")` pass and
  `{!row.isCurrent && …}` fails the `selection("r_alt")` pass, and that the two
  specified substrings genuinely hold in **both** passes (in particular: does
  making `r_alt` current change the `r_std` name cell in any way?).
- **Is the positional mutant genuinely unreachable in the render?** Check
  whether an index is in scope at `AltCompare.tsx:148-162`.
- Any residue of v1's or v2's refuted claims; any new hole.

## Do NOT re-litigate (settled at r1/r2)

- Byte-accuracy of the two substrings — you both verified React 19.2's
  `renderToStaticMarkup` emits no separators and JSX strips the surrounding
  whitespace.
- Axis A, Axis B's corrected reasons, Axis C (`.alt-compare-mark` reuse), Axis E
  ("nothing else changes"), Axis F (no `tags` abstraction).
- The no-jsdom route and the #109 argument.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings. This design has had two full
rounds on a small change; if the alias family is genuinely closed, APPROVE
honestly rather than manufacturing a third finding. If it is not closed, say so
plainly and name the surviving mutant.

Do NOT spawn nested verification agents; verify yourself and return your verdict
directly.
