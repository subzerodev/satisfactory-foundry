# Review request — #140 arc P0 design (r5)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/game-mechanics-rework/p0-brainstorm-spec.md` (uncommitted, revision r5)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `64a8fcf`)
**Stage:** design re-review after fold. r4 verdicts: code-reviewer APPROVED_WITH_NITS (junk-floor convention, folded), adversarial NEEDS_REWORK (2 IMPORTANT: the false "unobservable" claim / two pinned tests, and the before-the-solve placement; 1 NIT — all folded).

## The r4 → r5 delta to verify (scope to this)

1. **Merge semantics, complete:** missing/corrupt-JSON → fallback-full (store.test.ts:850-860 unchanged); present integer ≥1 → kept as-is (store.test.ts:862-874 rewritten to deferred semantics: pre-ready 99 persists + pipe floors to 1, clamp asserted at a driven ready transition); corrupt scalar → floor 1. Verify the two test citations and that the missing-vs-corrupt-vs-present trichotomy is exhaustive against the actual merge code shape (store.ts:2382-2408 — what does the current code do with e.g. `belt: "6"` string-number? does the trichotomy cover it?).
2. **Placement pin:** composed into mapSelection at :1521/:1588 (+ the global field), plain pre-clamp before :1483 for :1441/:1463. Verify the four sites' shapes once more and that "plus the global field" is coherent (where does the global unlockedTiers live vs per-stage selections — confirm both exist and both need the clamp).
3. **History correction** (identity-mapper mischaracterization).

Settled across r1-r4 (do not re-litigate): everything in the prior settled lists plus the pre-ready-consumer premise, the D4 enumeration, the ready-site completeness, the loss-free direction.

This is round five. If the delta is faithful and no NEW defect exists in it, an honest APPROVED ends the loop — do not manufacture.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
