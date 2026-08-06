# Design review r2 — S20 P1 (#100): fold delta only

R1 (both NEEDS_REWORK) findings all folded → v2. Axis-1 core mechanics
(raw param, precedence, target immunity) survived both r1 attacks
unchanged — do not re-litigate. This round checks the FOLD DELTA.

Artifact: `/home/subzerodev/workspace/satisfactory-foundry/features/propose-grows-up/p1-brainstorm.md` (v2).

## The delta

1. **Override set/clear rewritten** around `effectiveDefaultRecipe(catalog,
   itemId, exclusions)` = EXACTLY selectProducer's default policy
   (non-alternate, non-excluded, ascending id). Clear only when chosen id
   === effective default's id; null default ⇒ every choice is an explicit
   override, nothing clears; "(default)" tag marks the effective default
   only.
2. **Constrained-raw honesty:** rawInputs rows gain `cause: "natural" |
   "forced" | "constrained"`; constrained = catalog has ≥1 producer
   recipe but none eligible under current exclusions + default policy;
   constrained raws render on their own labeled line (notice styling)
   pointing at the exclusions panel; forced raws covered by the strip.
3. **toProposalPreview parameterized** for exclusions so the chip count
   always equals the picker list (defaults preserve P0 callers).
4. Walk copy retracted "honestly errors"; new walk case: override to an
   alternate, exclude the default's machine, re-choose the same
   alternate → override KEPT (null default), stage survives.
5. New tests: effectiveDefaultRecipe (incl. null case), candidateCount
   with current exclusions, cause annotation.

## Verify

- Is the effectiveDefaultRecipe clear-rule now watertight — trace the r1
  trap scenario end-to-end against the rule; any remaining path where
  clearing changes the outcome away from the shown selection? What about
  choosing the default while an override for a DIFFERENT recipe exists —
  clear correct? The stale-override case (override target recipe's
  machine later excluded — override still bypasses exclusions per frozen
  core semantics: does the picker's current-selection display remain
  truthful)?
- Is the "constrained" definition computable as stated (catalog has ≥1
  producer recipe but none eligible) and does it correctly classify: an
  alternate-only item under default exclusions; an ore; a user-forced
  raw that ALSO has no eligible producer (forced wins?)? Pin the
  classification precedence.
- Does the delta stay inside P1 scope (no P2/P3 leak); defaults genuinely
  preserve P0/AltCompare behavior?

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings.
