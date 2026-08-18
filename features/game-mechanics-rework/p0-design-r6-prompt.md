# Review request — #140 arc P0 design (r6)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/game-mechanics-rework/p0-brainstorm-spec.md` (uncommitted, revision r6)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `64a8fcf`)
**Stage:** design re-review after fold. r5 verdicts: code-reviewer APPROVED_WITH_NITS (2 wording NITs, folded), adversarial NEEDS_REWORK (1 IMPORTANT — the junk-pin note's false "missing never reaches the merge" premise, whose literal instruction would fail store.test.ts:850-860; folded).

## The r5 → r6 delta to verify (scope to this — three text edits only)

1. **The corrected junk-pin note** (the "Junk sanitization pin" bullet in Tests): it now states the three-branch sanitizer — `undefined` → max (bucket 1, RETAINED), present positive integer → kept (bucket 2), present anything else → 1 (bucket 3) — with the missing-row-vs-missing-field distinction and the `store.ts:2384-2387` / `store.test.ts:850-860` grounding. Verify: is the note now consistent with the merge trichotomy above it, and would an implementer following it verbatim keep :850-860 green?
2. **The mirror clarification** in the placement pin: "plus the global field" replaced by "the top-level `state.selection` mirror needs no separate clamp — `mirrorActive` (`store.ts:595-597`) re-derives it from the clamped active stage at the end of `deriveAllStages`". Verify the mirrorActive citation and that deriveAllStages does call it after mapping.
3. **The transitive-safety note** for the plan-stamping paths (`rebuildFromPlan` `store.ts:726/:803`, `applyProposalToSlice` `store.ts:854` copy live ready-clamped values; stored plan tiers dead-on-read `store.ts:702`). Verify the citations.

Settled across r1-r5 (do not re-litigate): everything in the prior settled lists plus the trichotomy's exhaustiveness over the real value space, the four placement sites, the sliceTier totality citation, both store.test.ts citations.

This is round six; the delta is three prose corrections, no design change. If they are faithful, an honest APPROVED ends the loop — do not manufacture.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
