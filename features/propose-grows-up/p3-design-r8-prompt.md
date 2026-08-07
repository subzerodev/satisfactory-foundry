# Design review r8 (delta-scoped) — S20 P3 (#102)

Re-review of `features/propose-grows-up/p3-brainstorm.md` (v8) in
`/home/subzerodev/workspace/satisfactory-foundry` (develop). At r7 you
both returned NEEDS_REWORK, converging on the same three items with
the same proofs; the adversarial added a fourth. All four are folded.

## The deltas (the ONLY changes since v7)

1. **`:441` pin REMOVED, not reworded** (both, IMPORTANT). Your
   no-op proof is now recorded verbatim in spec 8 so a later round
   cannot re-add a phantom assertion; `:441` is changed for
   consistency and pinned nowhere. The `(default)` tag pin MOVES to a
   normal stage row's picker (fed by `:387` → `:615`), where the
   gated default is non-null by construction.
2. **`:237` row is now TWO-STEP** (code-reviewer IMPORTANT /
   adversarial NIT): choose the gated default D′, then raise TIER
   back to "all" — correct reverts the stage to D, the missed edit
   stays pinned to D′ by the spurious override.
3. **Catalog-independent validation RESTORED** (code-reviewer
   IMPORTANT / adversarial NIT): Axis 1 validates `unlockedTier` with
   `Number.isInteger(v) && v >= 0 ? v : null`. Only the
   CATALOG-DERIVED bound stays dropped (that is what had the
   hydration-order problem). The below-range failure you described —
   renders "all", gates everything, sticky because picking "all"
   fires no `onChange` — is recorded as the rationale.
4. **Second non-tsc-forced fixture named** (adversarial, IMPORTANT):
   `catalog-store.test.ts:145-160` gets `recipeUnlocks: {}` so its
   corrupted-recipe test still reaches the reviver path it names
   instead of throwing early at the new shape guard while staying
   green. `chain-view.test.ts:186-188` recorded as verified-inert.

## Your question

Do these close r7 without opening anything new?
- Is the `:441` no-op proof, as now written in the spec, correct and
  complete — and does the relocated `(default)` pin actually bite at
  a normal stage row (walk it)?
- Does the two-step `:237` assertion genuinely discriminate? Walk
  both paths through to the second step.
- Does `Number.isInteger(v) && v >= 0` close every below-range and
  non-integer case without reintroducing any catalog dependency?
- Is the non-tsc-forced fixture list NOW complete (hunt for a third)?
- Any residue, any new hole.

This design has been through seven rounds. Deltas you have already
confirmed sound must not be re-litigated. If it is genuinely ready,
APPROVE honestly — do not manufacture an eighth finding. If something
real remains, say so plainly and cite it.

Do NOT spawn nested verification agents; verify yourself and return
your verdict directly.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS /
NEEDS_REWORK / BLOCKED) with severity-tagged, line-cited findings.
