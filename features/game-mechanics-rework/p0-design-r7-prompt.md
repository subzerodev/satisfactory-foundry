# Review request — #140 arc P0 design (r7)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/game-mechanics-rework/p0-brainstorm-spec.md` (uncommitted, revision r7)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `64a8fcf`)
**Stage:** design re-review after fold. r6 verdicts: code-reviewer APPROVED; adversarial NEEDS_REWORK (1 IMPORTANT — the note put store.test.ts:850-860 on the sanitizer path when zustand's hydration `.catch` means corrupt JSON never reaches `options.merge`; team lead independently verified against node_modules/zustand/esm/middleware.mjs before folding).

## The r6 → r7 delta to verify (scope to this — two path-precision corrections, no disposition change)

1. **Trichotomy bucket 1** now says: corrupt-JSON never reaches the merge (`JSON.parse` throws in `createJSONStorage.getItem`; `toThenable` short-circuits to the hydration `.catch`; the seed default survives — that is how :850-860 passes), and the sanitizer's `undefined` branch is exercised by the missing-FIELD case (valid JSON, absent field / null-or-array container). Verify this against zustand's middleware source (`node_modules/zustand/esm/middleware.mjs` — `createJSONStorage`, `toThenable`, the hydrate then-chain).
2. **The junk-pin note** carries the same correction (missing row → seed, corrupt JSON → aborted hydration + seed, missing field → sanitizer `undefined → max`). Verify the note and the trichotomy now agree with each other and with the code.

The three-branch sanitizer disposition (`undefined` → max; present positive integer → kept; present anything else → 1) is UNCHANGED and was verified green against both tests in r6 by both reviewers — do not re-litigate it.

Settled across r1-r6 (do not re-litigate): everything in the prior settled lists plus the mirror clarification and the transitive-safety citations (both cleared clean in r6 by the adversarial).

This is round seven; the delta is two path-precision sentences. If they now match the zustand mechanics, an honest APPROVED ends the loop — do not manufacture.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
