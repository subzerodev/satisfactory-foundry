# Design review r2 — S20 P0 (#99): fold delta only

Correctness r1 on p0-brainstorm v1: code-reviewer APPROVED_WITH_NITS
(1 IMPORTANT + 2 NIT), adversarial NEEDS_REWORK (2 Major + 2 Minor). All
findings folded → v2. This round re-checks the FOLD DELTA only — both r1
reviewers verified the core axes (extraction real, longest-path depth
correct, alternates count consistent with P1); do not re-litigate them.

Artifact: `/home/subzerodev/workspace/satisfactory-foundry/features/propose-grows-up/p0-brainstorm.md` (v2).

## The delta

1. `candidateRecipesFor(catalog, itemId)` arg order corrected; Axis 3 now
   leans on its returns-[]-below-2 contract (length 0 or ≥2 by
   construction; chip shown when nonzero).
2. Walk's Σ POWER check rewritten: empty-graph precondition; the cost
   sheet is the exact figure, TitleBlock is float/whole-MW/`Σ ≈` over ALL
   store stages by design; check = value agreement modulo the TitleBlock's
   rounding, never string equality.
3. Ground-truth anchors corrected (:166-169, :262-307, :190-214,
   :224-240, :118 vs :244); depth wording now states the link direction
   (links point input→consumer, chain-builder.ts:245; traversal walks
   to→from).

## Verify against live source

- Each corrected citation/signature is now accurate.
- The rewritten Σ POWER check is achievable as stated (empty graph +
  Apply → TitleBlock `Σ ≈ N MW` == cost-sheet exact value rounded to
  whole MW — confirm chainPowerText's rounding is round-half via
  toFixed(0) and whether that can disagree with "rounded to whole MW"
  wording on .5 boundaries; flag if the wording needs "within 1 MW").
- No unintended edits beyond the delta.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings.
