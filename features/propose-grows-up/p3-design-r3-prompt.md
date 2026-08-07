# Design review r3 (delta-scoped) — S20 P3 (#102)

Re-review of `features/propose-grows-up/p3-brainstorm.md` (v3) in
`/home/subzerodev/workspace/satisfactory-foundry` (develop). At r2 you
both returned NEEDS_REWORK on ONE cell: the v2 lever predicates were
`effectiveDefaultRecipe`-based (alternate-blind, adapter :460 skips
alternates) while branch entry is `producerRecipesFor`-based
(alternate-inclusive, :483-485) — alternate-only-all-gated items got
NO recovery line, regressing P1's always-emitted message
(ChainBuilder.tsx:450-455).

## The delta (the ONLY change from the v2 you reviewed)

Axis 4's matrix (plus the matching spec-8 test rows and a
ground-truth cross-ref NIT): predicates are now ALTERNATE-INCLUSIVE —
`tierLever = producerRecipesFor(ungated, exclusions).length > 0`,
`machineLever = producerRecipesFor(gated, ∅).length > 0`; "recovery"
is defined as the inline picker becoming non-empty (P1's affordance,
which alternates participate in). Four wordings partition the two
booleans: machine-only / tier-only / either / both-required. Totality
argued: constrained ⇒ hasAnyProducer(ungated) ⇒
producerRecipesFor(ungated, ∅) non-empty ⇒ the joint recovery always
exists; no cell defers to the picker branch.

## Your question

Does the corrected matrix hold?
- Verify the totality argument against the adapter source: is
  producerRecipesFor(ungated, ∅) non-empty EXACTLY when
  hasAnyProducer(ungated)? (producerRecipesFor filters only by
  machine exclusions — check :483-485.)
- Walk the r2 failing cell: alternate-only, all alternates tier-gated
  → tierLever true (ungated + exclusions restores them), machineLever
  false → TIER wording, picker returns on raise. Also the
  all-excluded sub-case → machineLever true → EXCLUSIONS wording
  (P1's line restored).
- The "either" wording (both levers true — producers split across the
  two worlds): honest?
- At unlockedTier null: gated ≡ ungated ⇒ tierLever ≡ machineLever?
  No: tierLever = producerRecipesFor(ungated, exclusions) — at null
  this equals the branch-entry condition, which was EMPTY (else
  branch) ⇒ tierLever false, machineLever = producerRecipesFor(gated=
  ungated, ∅) — P1's semantics exactly (the exclusions line iff
  clearing exclusions helps... verify this reduces to P1's current
  behavior at ChainBuilder.tsx:450-455 or is an honest refinement of
  it, and say which).
- Any new hole.

Everything else in v3 was approved at r2 — do not re-litigate.
Return exactly one verdict (APPROVED / APPROVED_WITH_NITS /
NEEDS_REWORK / BLOCKED) with line-cited findings.
