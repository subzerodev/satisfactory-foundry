# Review request — #140 arc P0 design (r3)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/game-mechanics-rework/p0-brainstorm-spec.md` (uncommitted, revision r3)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `64a8fcf`)
**Stage:** design re-review after fold. r2 verdicts: code-reviewer NEEDS_REWORK (1 BLOCKER: the persist-merge clampTier cannot bind pre-catalog; 1 IMPORTANT: wrong D4 test-line enumeration; 1 NIT), adversarial NEEDS_REWORK (same clamp defect independently + the vacuous-pin hazard + precision notes). All folded.

## The r2 → r3 delta to verify (scope to this)

1. **The two-stage clamp** (D1b): merge-site keeps the constant as pre-catalog best-effort; the authoritative re-clamp fires inside the same `set()` at EVERY catalog→ready transition (init hit branch, the loadBundled applies, uploadDocsText, the #144 refresh apply). Verify: (a) that list of ready-transition sites is COMPLETE against live store.ts (any other path installing `status:"ready"`?); (b) the totality argument (sliceTier RangeError at stage-input.ts:70-74, caught into a mislabeled invalid stage at store.ts:553) is correctly cited; (c) the store.ts:541-544 unreachability-comment update is named.
2. **The non-vacuous clamp pin**: persisted 6 vs parsed 3-tier belt table → clamps at ready, solves cleanly. Is the fixture shape implementable in the existing harness (a docs fixture with only 3 belt classes)?
3. **The corrected D4 enumeration**: re-verify a few lines from a fresh grep (`transport.test.ts` 23,154,155,158,238,240,242,259,268; `src/ui/transport-plan.test.ts:257`) — and確認 whether :264 (cited in r1 for transport-plan) was real or another carry-over error.
4. **The prop cascade + sliceTier signature notes** — accurate as now stated?

Settled across r1/r2 (do not re-litigate): the parse rules, round-trip + 7→8 bump, real-file guard, two identity pins, no fifth consumer, colors degrade, docs/ sweep scope.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
