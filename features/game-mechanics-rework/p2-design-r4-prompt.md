# Review request — #152 P2 design (r4)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/game-mechanics-rework/p2-brainstorm-spec.md` (uncommitted, r4)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `88a87d2`)
**Stage:** design re-review after fold. r3 verdicts: code-reviewer APPROVED; adversarial NEEDS_REWORK (1 IMPORTANT — the LEFT token candidate vs the hand-off label; folded).

## The r3 → r4 delta to verify (scope to this — ONE symmetric collision clause)

The collision rule now covers both token candidates with one principle ("a rendered token displaces the endpoint label on its own side"): RIGHT candidate → entry label pushes +20px (unchanged from r2); LEFT candidate at a boundary equal to a stretch's `x2` → that stretch's hand-off label is SUPPRESSED (tooltip keeps it findable). A left-fallback fixture pin (modeled on coincident-feed-marks.test.tsx:119-123) is added. Verify:

1. The left-candidate geometry as stated (token glyphs `[coordinate−32, coordinate−4]`; hand-off glyphs left of `x2−3`; rows +29 vs +35) against coincident-feed-marks.ts and the spec's own layout math.
2. The suppress-vs-push adjudication: is dropping the hand-off (rather than pushing it or the token) the simplest shape that keeps every number findable? Any case where suppression hides the ONLY rendering of a load-bearing number with no tooltip fallback?
3. The fixture pin's shape — does the cited left-fallback test shape actually produce a LEFT-placed token at a boundary that can carry a positive hand-off?
4. No new contradiction with the r2 entry-push clause or the thinning rules.

Settled across r1-r3 (do not re-litigate): everything in the prior settled lists plus the ledger correction, halo pin, "peak" scoping, and the right-candidate/entry adjudication (code-reviewer r3 verified the entry side clear of the left candidate).

This is round four; the delta is one clause + one pin. If it is faithful, an honest APPROVED ends the loop — do not manufacture.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
