# Review request — #145 diff (r1): pipe parallelCount suppression

**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry`, branch `feature/pipe-parallel-count` @ `00d6e08` (parent `develop` @ `542060b`; a `docs(143)` backfill commit `b1ca566` sits above and is NOT part of this review).
**Diff:** `features/pipe-parallel-count/diff-r1.diff` (the `src/` diff of `git diff develop...HEAD`, regenerate with `git diff 542060b..00d6e08 -- src/` if in doubt).
**Frozen spec:** `features/pipe-parallel-count/brainstorm-spec.md` (r4 — correctness APPROVED + APPROVED twice, simplify finding folded). The diff must implement the frozen spec exactly; deviation is a finding even if defensible.

## What to verify

1. **Spec conformance.** Production = exactly the one predicate (`lane.kind === "belt" &&` conjunct) + the two comment updates (`manifold.ts:46` type comment, the block comment above the predicate). Tests = exactly the two pipe fixture rewrites (core `manifold.test.ts` renamed pin asserting parallelCount 1 everywhere + one `segment-over-capacity` with `busCapacity 600`; UI `parallel-feed-belts.test.tsx` re-anchored to `"bus-seg seg-error lane-pipe"` + renamed). Nothing else. Confirm no belt fixture changed.
2. **The added UI negative assertion** (`expect(pipeHtml).not.toContain("parallel-rail")`) — is it spec-conformant or scope creep? (The spec said "re-anchor the assertion"; the negative is a strengthening. Judge whether it's a faithful strengthening or a deviation to flag.)
3. **Bidirectionality log** `features/pipe-parallel-count/r2-verification.log`: genuine FAIL lines for BOTH pipe pins with only `manifold.ts` stashed, green restored. Reject if theatre.
4. **Suite health:** 1145 tests green at commit; `npm run check` clean. Re-run if in doubt.
5. **Belt byte-identity:** the diff contains no change that could alter a belt solve (the r4-settled tautology argument — verify the diff, not the argument).

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
