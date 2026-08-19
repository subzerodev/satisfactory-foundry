# Review request — #154 design (r4)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/build-view-pan/brainstorm-spec.md` (uncommitted, r4)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `66f985a`)
**Stage:** design re-review after fold. r3 verdicts: code-reviewer APPROVED; adversarial NEEDS_REWORK (2 IMPORTANT: the case-sensitive gate blind to MachineBand; the false "no grep tokens" claim — both folded, plus the widened discard list).

## The r3 → r4 delta to verify (scope to this — three text folds)

1. **The case-insensitive gate** (`grep -rin "band|labeledsignificant|labelstep|minpitch|114" src/`): run it yourself — does `-i` with the single `band` token now surface MachineBand at Machines.tsx:24/:109 plus every casing (bandMode, machine-band), and does the collapsed token set lose nothing the old set caught?
2. **The corrected p2-drawing framing** (map-only-for-semantics; the :326 `fromMachine: 114` data hit dispositioned discard-as-data) — accurate now?
3. **The widened discard/disposition list** — layout.test.ts:46/:50-52 (lane-band sense, discard) and smoke.test.tsx:221/:234 (`not.toContain("machine-band")` — dispositioned KEEP as permanent absence pins). Is KEEP the right call (post-retirement they assert the build view never draws a band — meaningful, or vacuous since nothing CAN draw one)? Adjudicate honestly; a vacuous-forever pin should be deleted instead.

Settled across r1-r3 (do not re-litigate): everything prior, plus the map dispositions verified in r3, the :230-237 keep, the labelStep coherence, the inversion's mechanism itself.

This is round four; the delta is three text folds. If they are faithful, an honest APPROVED ends the loop — do not manufacture.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
