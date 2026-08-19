# Review request — #151 P1 design (r3)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/game-mechanics-rework/p1-brainstorm-spec.md` (uncommitted, r3)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `67d1fcd`)
**Stage:** design re-review after fold. r2 verdicts: both reviewers NEEDS_REWORK on the IDENTICAL single gap — `src/ui/layout.test.ts` missing from the sweep enumeration. Nothing else was found.

## The r2 → r3 delta to verify (scope to this — ONE sweep addition)

The Tests sweep now enumerates `src/ui/layout.test.ts` as the seventh pin file: feed pins at :80-81 (480/120), the output pin at :94 (30 → entryFlow = load), and the note that both describe TITLES carry the old `peakFlow` name. Verify the citations and the re-derivation notes are correct against the live file, and confirm the seven-file reconciliation (manifold.test.ts, src/layout/layout.test.ts, parallel-feed-belts.test.tsx, stage-input.test.ts, format.test.ts, smoke.test.tsx, src/ui/layout.test.ts) now covers every test file with `parallelCount|peakFlow|maxParallelCount` hits.

Settled across r1-r2 (do not re-litigate): the arithmetic identity + 8411 check, the mod invariant and its clamped-entry edge (re-derived by three independent contexts now), cascade formulas, the complete D5 source enumeration, the `flow` rename's collision-freedom, pipe honesty, decision conformance.

This is round three; the delta is one sweep entry. If it is faithful, an honest APPROVED ends the loop — do not manufacture.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
