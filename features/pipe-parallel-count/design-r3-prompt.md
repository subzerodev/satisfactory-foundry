# Review request — #145 design (r3): pipe parallelCount suppression

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/pipe-parallel-count/brainstorm-spec.md` (uncommitted, revision r3)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `adb9979`)
**Stage:** design re-review after fold. r2 verdicts: code-reviewer APPROVED; adversarial-reviewer NEEDS_REWORK (1 MAJOR: a second pre-existing pipe-bundling test in the UI layer, `parallel-feed-belts.test.tsx:201`, uncounted).

## The r2 → r3 delta to verify (scope your review to this)

1. **Tests section** gains the `parallel-feed-belts.test.tsx:177-214` rewrite disposition: pipe sub-render assertion re-anchors from `"parallel-rail seg-error lane-pipe"` to `"bus-seg seg-error lane-pipe"`; case renamed; the belt sub-render (`minimalParallelResult(115)`, hand-built belt segment) explicitly kept as the surviving rail/short-label coverage. Verify: (a) the cited fixture and class strings against live source (`parallel-feed-belts.test.tsx:177-214`, `Schematic.tsx:183-184,218-221`); (b) the claim that `seg-error` persists on the pipe sub-render post-fix (it starves AND gains `segment-over-capacity`); (c) the claim that the belt sub-render is genuinely unaffected.
2. **AC1/AC4** now name exactly two rewritten pipe fixtures and two touched test files. Verify no THIRD pre-existing test pins pipe bundling — the r2 adversarial sweep cleared `smoke.test.tsx`, `extraction-plan.test.ts`, `LinkInspector.dom.test.tsx`, and all of `manifold.test.ts`; spot-check its clearances rather than redoing the whole sweep, plus any test file it did not name that renders Schematic with a pipe lane.

r1/r2-survived theses (B1 predicate sufficiency, B3 production-consumer sweep, B4 no-persistence, B5 belt byte-identity, the two-comment touch-up, the core fixture rewrite) are settled — do not re-litigate without new evidence.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
