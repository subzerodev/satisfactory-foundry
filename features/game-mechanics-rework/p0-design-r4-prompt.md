# Review request — #140 arc P0 design (r4)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/game-mechanics-rework/p0-brainstorm-spec.md` (uncommitted, revision r4)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `64a8fcf`)
**Stage:** design re-review after fold. r3 verdicts: code-reviewer NEEDS_REWORK (the derived-value D4 enumeration, folded), adversarial NEEDS_REWORK (the merge-clamp downward loss, nested-verifier confirmed, folded).

## The r3 → r4 delta to verify (scope to this)

1. **The single-owner clamp** (supersedes the two-stage shape): the merge site keeps ONLY the integer-≥1 validity floor and drops its upper bound; the ready transition (the four verified sites :1441/:1463/:1521/:1588) is the sole upper clamp against live `catalog.tiers`. Attack the load-bearing premise: is there ANY consumer of `unlockedTiers` between merge and the first ready set — a selector, a render, a derive, a persistence write — for which an unbounded (e.g. 999) count is NOT inert? Trace the pre-ready render tree (initializing / needs-upload screens) and the derive guards. Also: does the merge-site change alter behaviour for the CURRENT (constant-equal) world in any observable way (it shouldn't — today's clamp only ever bites on counts > 6, which only a modded past could produce)?
2. **The loss-free reboot pin** (persisted 7 + 7-tier catalog stays 7) and the junk floor pin — non-vacuous and implementable?
3. **The D4 derived-value enumeration** (from the code-reviewer's r3 fold): spot-check `transport.test.ts:252,271,284` and `transport-plan.test.ts:264,271-272` against source once more.

Settled across r1-r3 (do not re-litigate): parse rules, round-trip + 7→8, real-file guard, identity pins, no fifth consumer, ready-site completeness, no same-set ordering hazard, the sliceTier totality argument.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
