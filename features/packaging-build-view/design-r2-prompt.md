# Review request — #157 design (r2)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/packaging-build-view/brainstorm-spec.md` (uncommitted, r2)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD ccc90fb)
**Stage:** design re-review after fold. r1 verdicts: code-reviewer NEEDS_REWORK (2 IMPORTANT + 2 NIT); adversarial-reviewer NEEDS_REWORK (1 IMPORTANT, overlapping). All folded.

## The r1 → r2 delta to verify (scope to this)

1. **The A4 guard lift** (the fold for the false "everywhere" claim): the spec now lifts the MODE half of `graph-flow.ts:521` (`link.transport.mode === "belt"`) so a configured belt link flows `planForLink → edgeChip` and chips "N belts", while the UNDEFINED half stays (default belt links remain chipless; the `graph-flow.test.ts:1047-1058` pin is dispositioned KEEP). Verify against live source: (a) does `planForLink` actually produce a `kind: "continuous"` belt plan for a configured belt link (so the lifted path yields a chip rather than null/unsolved)? (b) is the undefined-half KEEP disposition right — is there any way an undefined-transport link could/should be sized? (c) does the lift create any OTHER surface change the spec doesn't name (other transportChipFor callers, edge-label consumers)?
2. **The sweep's new known-now entries**: `transport-text.test.ts:314-330` (`:329` routeEdgeChip belt-null → RE-DERIVE, unsolved/error arms KEEP) and `graph-flow.test.ts:1047-1058` (KEEP). Verify both dispositions against the live tests; run the spec's greps yourself and name anything still missing.
3. **The two NIT fixes**: A3/A5 now cite `machinePowerProjection` (`machine-power.ts:55`, used at `link-plan.ts:181`); the unpackage-side pair fields are re-labeled VERIFIED (`packaging-pair.ts:29-31,:134-136`). Confirm both citations resolve.

Settled at r1 (do not re-litigate): the A1 adapter + no-double-clocking (verified by both reviewers), A2 enumeration completeness (`store.ts:112,:161`), A3 stacked groups + Blueprint caveat, no-degenerate-laneRate (`transport.ts:73-75`), the #146/#133/#154 settled-decision list.

This is round two; the delta is one guard-lift decision + sweep-map completion + two citation fixes. If they are faithful, an honest APPROVED ends the loop — do not manufacture.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
