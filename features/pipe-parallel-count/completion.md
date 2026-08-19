# #145 — completion note

**Landed:** merge 8bb244a on develop (fix 00d6e08, spec 542060b). Pushed.

**What landed:** pipe lanes never claim "2 parallel lines". One predicate —
`bundleEligible = lane.kind === "belt" && capacity ≤ B` — grounded in the
game headers (parallel pipes share a pressure group, FGPipeNetwork.h). An
over-tier pipe peak now emits the existing segment-over-capacity finding:
an honest build error instead of a physically false doubled pipe. Belt
behaviour byte-identical (proven tautologous; the belt x2 redesign is the
#140 arc's job).

**What the reviewers caught:**
- Design r1 (both reviewers, independently): the core pipe fixture at
  manifold.test.ts:361 pinned the old behaviour — unenumerated.
- Design r2 (adversarial): its UI twin at parallel-feed-belts.test.tsx:201
  (a CSS-class pin derived from parallelCount) — the deletion sweep had
  missed consumer-output assertions. Memory rule updated.
- Simplify (design): the planned belt regression pin was redundant (the
  106-refinery fixture already guards it) AND unsatisfiable (belt-invariant
  fix ⇒ no belt test can fail on revert) — removed as r4, re-checked
  APPROVED + APPROVED.
- Diff gate: zero findings from either reviewer; simplify APPROVED.

**Acceptance criteria:** all five hold (belt byte-identity; pipe over-tier ⇒
parallelCount 1 + finding; production diff = manifold.ts only; 1145 tests +
lint green on the merged trunk). Bidirectionality log captured both pipe
pins failing on revert, including the old render's false
"2 parallel lines × 600/min" aria-label.
