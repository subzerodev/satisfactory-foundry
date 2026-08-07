# Design review r4 (delta-scoped) — S21 P0 (#104)

Re-review of `features/propose-followups/p0-brainstorm.md` (v4) in
`/home/subzerodev/workspace/satisfactory-foundry` (develop).

**At r3 you BOTH confirmed the conjunction rule HOLDS** — neither could
construct a counterexample, and one of you proved it algebraically
(`P(S) ⟺ Prod ⊆ S`, so the rule fires ⟺ `Prod ⊆ CONST ∩ live`). The rule
itself is therefore SETTLED and is not in scope. Every r3 finding was
bookkeeping.

## The deltas (the ONLY changes since v3)

1. **BLOCKER fix — the predicate now exists in exactly ONE place.** Spec
   item 1 had still stated the dead v2 form (the third half-applied fold in
   this doc). It now *references* the Axis 2 code block and restates
   nothing; every other mention points at it. **I verified this by grep**
   rather than by assumption — `producerRecipesFor(ungated, itemId, …)`
   now appears only in the `P(S)` definition, the single code block, and a
   quotation of `leverOf`'s own source.
2. **The Axis 3 argument is replaced with your algebraic formulation**:
   `P(live)` is definitionally `¬tierLever` (identical call, `:381`), so no
   row with an actionable tier recovery can natural-ize on any combination;
   and when the rule fires, `machineLever` can only point inside `CONST`,
   so the only suppressed recovery is the degenerate one Axis 1 decided to
   suppress. The two prose bullets are now correctly qualified.
3. **The `water` row is corrected** — that cell is `natural` today AND
   under the rule (`effectiveDefaultRecipe` resolves the non-alternate
   `unpackage_water`); "constrained" and "conservative by construction"
   were both wrong. Conclusion (unchanged from today) survives.
4. **The missing cell is recorded** — `ore_iron @ defaults @ TIER ≤ 8`
   renders `lever: "both"` today and NO line under the rule, stated as the
   intended outcome of Axis 1 rather than left to be discovered.
5. NITs: "conjunct" → "conjuncts"; the USER EXCLUSIONS bullet now admits
   `both` as well as `machine`.

## Your question

Narrow, and please keep it narrow:

- Is the predicate genuinely stated once now? Grep it yourself. This doc
  has had three half-applied folds; that is the failure mode to check.
- Is the adopted algebraic argument stated correctly (it is yours — verify
  I transcribed it faithfully, including the `machineLever ⊆ CONST` half)?
- Are the two corrected rows (`water`, `ore_iron @ defaults @ TIER ≤ 8`)
  now accurate against source?
- Any remaining v1/v2 residue anywhere.

Do NOT re-litigate the rule (settled at r3), the measurements (settled at
r1), or anything already approved. Do NOT spawn nested agents. **If the
bookkeeping is now correct, APPROVE and say the design is ready to freeze
— do not manufacture a finding to justify a fifth round.** Return exactly
one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED) with
severity-tagged, line-cited findings.
