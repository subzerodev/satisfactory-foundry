# Design review r4 (delta-scoped) — S20 P2 (#101)

Re-review of `features/propose-grows-up/p2-brainstorm.md` (v4) in
`/home/subzerodev/workspace/satisfactory-foundry` (develop). At r3 you
both returned NEEDS_REWORK on one finding: v3's `(itemId, toItemId)`
suggestion key collides when two producing stages emit the same
byproduct B toward one consumer (`ChainProposal.byproducts` has no
per-item merge — chain-builder.ts:328-334).

## The delta (the ONLY change from r3)

Axis 4's scan is now explicitly two-step:
1. aggregate `byproducts` rates per distinct item (exact Fraction sum)
   — collapsing multi-producer emissions of the same B into one total;
2. match consumers and emit ONE suggestion per (B, consumer) pair.

Uniqueness of `(itemId, toItemId)` is claimed **by construction** (one
entry per pair), covering BOTH multiplicity directions; the summed rate
is also the displayed figure. Spec item 6 adds the matching test: two
producing stages emitting the same byproduct toward one consumer → ONE
suggestion with the exact summed rate.

## Your question

Does the aggregation fix hold? Specifically:
- Is the by-construction uniqueness argument airtight against
  chain-builder.ts's actual byproduct emission (:328-334) and stage
  identity (one stage per item)?
- Is the summed rate the honest display figure (any case where summing
  across producers misleads)?
- Does the added test pin the collision case bidirectionally?
- Any new hole the aggregation itself opens?

Everything else in v4 was already approved — do not re-litigate it.
Return exactly one verdict (APPROVED / APPROVED_WITH_NITS /
NEEDS_REWORK / BLOCKED) with line-cited findings.
