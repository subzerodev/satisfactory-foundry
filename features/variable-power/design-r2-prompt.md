# Review request — #142 design (r2): recipe-level variable power

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/variable-power/brainstorm-spec.md` (uncommitted, revision r2)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `016cc54`)
**Stage:** design re-review after fold. r1 verdicts: code-reviewer APPROVED_WITH_NITS (D3 imprecision + 3 nits), adversarial-reviewer NEEDS_REWORK (the same D3 finding, deepened: the adapter is not a projection consumer; link-plan blends two recipes; extraction omitted). All folded.

## The r1 → r2 delta to verify (scope to this)

1. **D3 rewritten** with per-surface integration mechanisms: (a) advice.ts call-site swap with two named knock-ons — `stagePowerOf` returning `variablePower` alongside power (currently discards the recipe, `advice.ts:164-183,:182`) and the structural `ChainCatalog.recipes` type widening (`advice.ts:158`); (b) chain-builder-adapter as an IN-LOOP correction inside `proposalMetrics` (`:794-808`) before summing, `subtreePowerText` untouched; (c) link-plan and extraction-plan pass-through with the constant-power rationale (link-plan blends TWO recipes). Verify each citation and that the described mechanisms are implementable as stated — especially that `stage.recipeId` really is in scope at the adapter loop and that correcting power BEFORE summing yields the right `powerVaries` flag semantics (a variable machine with recipe fields still sets `powerVaries = true` — should it? The bounds are now exact per-recipe; is the "(varies)" cost-sheet suffix still the honest output? Flag if the spec should say).
2. **Deletion sweep** now records the inspected-and-excluded fifth match.

Settled by r1 (do not re-litigate): the gate equivalence (3 carriers only), the Plutonium arithmetic, the optional-field + 6→7 bump soundness, the pass-through safety of constant-power surfaces.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
