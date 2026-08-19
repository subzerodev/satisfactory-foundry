# Review request — #151 P1 design (r2)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/game-mechanics-rework/p1-brainstorm-spec.md` (uncommitted, r2)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `67d1fcd`)
**Stage:** design re-review after fold. r1 verdicts: code-reviewer NEEDS_REWORK (4 IMPORTANT — blast-radius under-enumeration, all folded); adversarial NEEDS_REWORK (2 IMPORTANT folded; 1 IMPORTANT rejected — the non-final-oversize-override residue claim, refuted by the mod invariant with a worked counterexample, independently confirmed by the code-reviewer in the same round).

## The r1 → r2 delta to verify (scope to this)

1. **The completed D5 enumeration** — verify each newly added site against live source: `Blueprint.tsx:270-277` (`bp-parallel-max`), `layout/layout.ts:61,135,206,243` (`maxParallelCount`), `SummaryCards.tsx:32-61` (the whole block incl. `highestPeak`+`oneLineTier`), `FindingsPanel.tsx:88`, `format.ts:66` (`firstLockedTierForOneLine` dead after both consumers die — confirm no third consumer), `format.ts:133,139,157`, `layout.ts:83,237,266`, `Schematic.tsx:172,177`. Then hunt for anything STILL missing: grep `parallelCount|peakFlow|maxParallelCount` over src/ (excluding tests) and check every hit appears in D5.
2. **The completed sweep** — the four added pin files (`stage-input.test.ts:78`, `format.test.ts:114-135 + :152-164`, `smoke.test.tsx:292,545,969,997,1031`, `parallel-feed-belts.test.tsx:392-396`) exist as cited; hunt for test pins still missing (grep the same tokens over `src/**/*.test.*`).
3. **The mod-invariant statement (D1)** — is the universal residue bound argued correctly from `manifold.ts:376-395` (post-override cumulative → `cumulative mod d`), and is the rejection of the r1 adversarial claim sound? Verify with your own counterexample if in doubt. Also confirm the clamped-entry edge (`entryQuotient ≥ N` → unused belts carry capacity forward into the terminal surplus) does not create a machine-bearing stretch with residue-in ≥ d.
4. **The splitter partial-machine inclusion** — consistent with `drainSpan`'s shape.

Settled in r1 (do not re-litigate): the 8411 arithmetic identity, the entry boundaries, the cascade formulas (all pinned values re-derived), pipe Level-1 honesty as the decided change, buffer splitter-only arithmetic, decision conformance, the single-head cascade assumption.

This is round two; the delta is enumeration completion plus one strengthened invariant. If the delta is faithful and complete, an honest APPROVED ends the loop — do not manufacture.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
