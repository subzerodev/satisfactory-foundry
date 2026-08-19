# Review request — #145 design (r2): pipe parallelCount suppression

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/pipe-parallel-count/brainstorm-spec.md` (uncommitted, revision r2)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `adb9979`)
**Stage:** design re-review after fold. r1 verdicts: code-reviewer NEEDS_REWORK (1 IMPORTANT + 1 NIT), adversarial-reviewer NEEDS_REWORK (same MAJOR independently + 3 NITs). All folded; dispositions in `## Revision history`.

## The r1 → r2 delta to verify

1. **Tests section** now rewrites `manifold.test.ts:361-374` in place as the new pipe pin (both assertions inverted, test renamed); acceptance criteria 1/4/5 reworded accordingly. Verify the cited fixture lines and that this is the ONLY pre-existing test asserting pipe bundling (the r1 reviewers established: line 780's parallelCount case is an output lane; `solveFeed` defaults `kind: "belt"` at test line 244 — spot-check both).
2. **D1's comment touch-up** now covers BOTH stale comments: the block comment `manifold.ts:418-421` AND the type comment `manifold.ts:46` ("feed 1|2, output always 1"). Verify both exist as described.
3. **Consequence enumeration** now names the overridden-at-B pipe slot (`.lte` is ≤ — verify against `fraction.ts:158`).
4. **D2 citation** corrected to `manifold.ts:564`.

Both r1 reviews confirmed the core theses sound (B1 predicate sufficiency across empty-span/entry-clamp/override/degenerate paths; B3 no kind-coupled consumer; B4 no persistence; B5 belt byte-identity) — do not re-litigate without new evidence.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
