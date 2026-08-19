# Review request — #145 design (r4): post-simplify correctness re-check

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/pipe-parallel-count/brainstorm-spec.md` (revision r4)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `adb9979`)
**Stage:** correctness re-check after a simplify-pass fold. r3 was APPROVED + APPROVED; the simplify pass then removed one planned test. Verify the fold did not break correctness. Scope strictly to the delta.

## The r3 → r4 delta

The r3 "new belt regression pin" is REMOVED from Tests. Replacement: the existing fixture `manifold.test.ts:311-333` (106-refinery plan — eight x2 spans at peak 840, `segment-over-capacity` asserted absent) is cited as the standing belt-invariance guard; the bidirectionality obligation is scoped to the TWO pipe pins only, with belt fixtures explicitly expected NOT to fail on revert.

## What to verify

1. `manifold.test.ts:311-333` really pins belt-over-peak → `parallelCount 2` + finding-absent (read it; is it a belt lane — `solveFeed` default kind?).
2. The simplify reviewer's impossibility argument: with the predicate reverted (`bundleEligible = belt.capacity.lte(B)`), is there ANY belt input whose solve differs from the fixed version? If yes, the removed belt pin was load-bearing and the fold is wrong — that would be a BLOCKER-grade finding.
3. The reworded bidirectionality bullet is consistent with the workflow rule (one revert-FAIL per distinct production behaviour: the pipe suppression IS the only behaviour change, so two pipe pins suffice).

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
