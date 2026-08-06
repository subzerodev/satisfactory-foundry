# Boundary review r1 — S20 P1 (#100): Propose customization implementation

Review the CUMULATIVE diff against the frozen v7 design. Worktree:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s20-p1`
(branch feature/s20-p1, 4 commits over develop at 611b42d).

Diff (1810 lines):
`/home/subzerodev/workspace/satisfactory-foundry/features/propose-grows-up/p1-boundary-r1.diff`

## A. Contract anchors

- Frozen contract: `features/propose-grows-up/p1-brainstorm.md` (v7
  FROZEN, in the worktree) — spec items 1-5 + the walk cases as
  acceptance criteria. Item 6 (docs) absent by design.
- The review-of-record pins (six design rounds): core rawItemIds guard
  before selectProducer with target immunity + raw>override; the 8
  adapter surfaces and NOTHING else (esp.: AltCompare call sites
  UNTOUCHED — #103 defers that); effectiveDefaultRecipe == selectProducer
  default policy exactly; producerRecipesFor ungated with
  default-first-else-ascending; pickerOptionsFor TOTAL with catalog-valid
  force-include only; cause precedence forced>constrained>natural with
  forced excluded from other lines; picker affordance iff options ≥ 2 OR
  force-included (never candidateCount-gated); labels compose; clear rule
  SET-unless-effective-default; chip ≥2 semantics unchanged; ephemeral
  posture (no store surface); Discard/Apply keep choices.

## B. Claims to verify

1. Every hunk against the contract — scope creep (P2/P3 leak, store
   surface, AltCompare edits beyond nothing), dead code.
2. Implementer claims: 812/812 + check clean (re-run if you have shell);
   default-empty byte-identical core regression really pinned; P0
   preview tests untouched EXCEPT the declared RawInputRow-shape update.
3. TWO DECLARED DEVIATIONS: (a) PreviewRow gains itemId (depth-sorted
   rows vs id-sorted stages — positional alignment unsafe): legitimate
   necessity or spec drift? (b) RawInputRow extends ItemRateRow +
   ProposalPreview.rawInputs widened; the P0 all-raw test updated with
   Iron Ore now "constrained" (its only bundled producer is the excluded
   converter recipe) — verify that catalog claim yourself and judge
   whether the test update preserves P0's intent.
4. The 6-cycle bidirectionality log — real breaks, real FAILs naming the
   new tests, byte-identical restores.
5. The sharpest implementation edges: the re-propose path uses the SAME
   options everywhere (Propose, control changes, Apply — no path builds
   with stale/different options); pickerItemId lifecycle (row vanishes
   while its picker is open — raw-marked or collapsed: state cleaned or
   inert?); the constrained-line inline recovery's override wiring; the
   affordance predicate's exact implementation vs the pin; label
   composition rendering.
6. UI accessibility + theme-token discipline for the new controls; the
   T0 RAW-toggle suppression.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings.
