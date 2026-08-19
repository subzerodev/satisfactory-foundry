# Review request — #154 design (r5)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/build-view-pan/brainstorm-spec.md` (uncommitted, r5)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `66f985a`)
**Stage:** design re-review after fold. r4 verdicts: code-reviewer APPROVED; adversarial NEEDS_REWORK (1 IMPORTANT — the undispositioned :616-624 hit + the misdirecting category rule; 1 NIT — the KEEP pins are green-by-construction). Both folded; the KEEP-vs-DELETE reviewer split resolved against the r4 code-reviewer on the no-producer-anywhere argument.

## The r4 → r5 delta to verify (scope to this — two disposition changes)

1. **smoke.test.tsx:616-624 → RE-PIN** (plain rects+caption render at N=114, threshold framing dropped) and the category-rule scoping ("114-as-threshold → re-derive" now applies to LAYOUT-VALUE assertions only; threshold-PREMISE tests delete or re-pin). Verify the test's shape against live source (does it carry a full-rect-row assertion worth keeping?) and that the scoped rule leaves no other threshold-premise test misdirected (grep 114 over the tests once more).
2. **smoke.test.tsx:221/:234 KEEP → DELETE** with the no-producer rationale. Verify machine-band genuinely has no producer outside Machines.tsx's MachineBand (so post-deletion the pins cannot fail) and that the sibling class="machine" pins remain and carry the leakage guard.

Settled across r1-r4 (do not re-litigate): everything prior, including the -i gate's sufficiency and the rest of the disposition map.

This is round five; the delta is two dispositions + one rule scoping. If they are faithful, an honest APPROVED ends the loop — do not manufacture.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
