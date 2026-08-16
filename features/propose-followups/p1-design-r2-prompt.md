# Design review r2 (delta-scoped) — S21 P1 (#103)

Re-review of `features/propose-followups/p1-brainstorm.md` (**v2**) in
`/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, commit
`680edb4`).

At r1 you both returned NEEDS_REWORK and landed the **same BLOCKER
independently**. All findings are folded. Review the deltas — do not
re-litigate what r1 already settled.

## The deltas (the ONLY changes since v1)

1. **Axis 2 RE-DECIDED (the BLOCKER).** v1 accepted the ordering change,
   justified by rendered names carrying an `Alternate: ` prefix. You both
   refuted that at `docs-loader.ts:190`. v2 instead **preserves today's order**
   with a module-private comparator inside `candidateRowsFor` (spec item 3),
   lifted verbatim from the deleted `:558-561`. `AltCompare.tsx:80` needs no
   ordering (gate + `byId` Map only). Option (c) — abandon the consolidation —
   is recorded as seriously weighed, since the simplify lens's "fully
   redundant" premise is now known false.
2. **Ticket-label self-correction RETRACTED.** v1 said `refactor` was the wrong
   label; under the new pick the diff is behaviour-preserving, so it is right.
3. **Spec item 6 rebuilt from the invariant**, not a symbol grep. Now names the
   three executable failures you found (`:840`, `:842-844`, `:1274-1287`),
   reclassifies `:375-378` and `:381-388` as judgment calls (`:381-388` → DELETE),
   and adds `:813`, `:990`, `:993`.
4. **Chip pin relocated** (spec item 7) to `ChainBuilder.gating.test.tsx`, with
   the force-included lone-producer state spelled out in Axis 3.
5. **Test-plan header rewritten** — each row names the mutant it kills and is
   typed revert-bidirectional vs guard pin.
6. **Set-agreement claim scoped** to items with ≥2 eligible producers and
   reclassified from MEASURED to a theorem about the identical filters.
7. **Full distribution recorded** (69/63/28/21/11/3, Σ=195) after a re-run; the
   twin `63`s are a genuine coincidence. Spec item 9 adds a durable pin.
8. **Existing pins credited** — `AltCompare.test.tsx:138-151`,
   `chain-builder-adapter.test.ts:1106-1108`.
9. **Axis 6 added + split to #116** — the missing alternate marker.

## Your question

Do these close r1 without opening anything new?

- **Is the Axis-2 pick actually correct?** Walk it: with the comparator moved
  into `candidateRowsFor`, is the rendered comparison order **byte-identical** to
  today for all three of `liquid_fuel`, `plastic`, `rubber` AND for the
  `coal` / `liquid_turbo_fuel` zero-non-alternate cases? Is `AltCompare.tsx:80`
  genuinely order-insensitive (check the `< 2` gate AND the `byId` Map AND the
  `byId.get(row.recipeId)!` non-null assertion at `:95`)?
- **Is spec item 6 NOW complete?** Hunt for a fourth executable assertion of the
  old `{0} ∪ [2,∞)` invariant that neither of you named at r1. Search by
  behaviour (any `candidateCount` expectation, any `toEqual([])` on a
  producer list, any `every(...)` over counts), not by symbol.
- **Does spec item 7 describe a state that can actually be constructed** in
  `ChainBuilder.gating.test.tsx`? Walk the render path at
  `ChainBuilder.tsx:709-734` for a lone-producer item with a force-included
  excluded-machine override and confirm the picker renders and the chip reads
  `"machine excluded"`.
- **Is the retraction in delta 2 correct** — is the diff, as v2 now specs it,
  genuinely free of user-visible change?
- Any residue of v1's refuted premise anywhere in the document.
- Any new hole the Axis-2 re-decision opens — in particular, does keeping a
  comparison-specific comparator leave the consolidation worth doing at all, or
  has it eroded to the point where option (c) is the honest call? Say so plainly
  if you think it has.

## Do NOT re-litigate (r1 settled these)

- Axis 3's "the render is unchanged" claim — you both attacked it and could not
  break it. `candidateCount` has exactly five readers, all `>= 2`.
- That nothing outside `src/` imports `candidateRecipesFor`.
- That #106 does not depend on the removed surface.
- That the three ordering diffs are correctly derived.
- Axis 5 / #115 and Axis 6 / #116 being split out rather than built here.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings. If it is genuinely ready,
APPROVE honestly — do not manufacture a finding to justify a second round.

Do NOT spawn nested verification agents; verify yourself and return your verdict
directly.
