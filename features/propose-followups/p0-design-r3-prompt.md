# Design review r3 (delta-scoped) — S21 P0 (#104)

Re-review of `features/propose-followups/p0-brainstorm.md` (v3) in
`/home/subzerodev/workspace/satisfactory-foundry` (develop).

**This design has now proposed THREE rules. Two are dead:**

| rule | keyed on | killed by | how it failed |
|---|---|---|---|
| v1 | live exclusion set | r1 (both) | negation of `machineLever` → user ticks Constructor → `coal` loses picker AND hint |
| v2 | `EXCLUDED_MACHINE_IDS` constant | r2 (both) | negation of `tierLever` → user un-ticks Converter at TIER ≤ 8 → `ore_iron` loses a real "raise TIER" recovery (`iron_limestone` unlocks at tier 9) |
| **v3** | **BOTH — the conjunction** | ? | ? |

## The deltas (the ONLY changes since v2)

1. **The rule is now `isRawResource ∧ P(EXCLUDED_MACHINE_IDS) ∧ P(live)`**
   where `P(S) ≔ producerRecipesFor(ungated, itemId, S).length === 0`.
   Explicitly the CONJUNCTION of two emptiness tests, not `P(CONST ∪ live)`
   (the union is weaker — implied by either conjunct — and would re-admit
   the coal regression). Rationale: each lever's precondition falsifies its
   own conjunct, so neither cell can be swallowed.
2. **The BLOCKER residue is gone** — the predicate is stated ONCE, as code,
   in the Axis 2 "concretely" paragraph, using the bindings that actually
   exist in `causeOf`.
3. **Axis 3 now enumerates the CONJUNCTION** of tier × user-exclusions, not
   just the two dimensions separately.
4. **Cell reachability re-argued** from the untouched 20 non-raw items and
   the synthetic matrix fixtures (v2's "keys on neither varying dimension"
   was a non-sequitur).
5. **Five falsified comments, not three** — adding the `RawCause` typedoc
   and the `causeOf` block comment; `:338-339` citation fixed.
6. **"Safe by construction" replaced** with the real argument (the cycle
   guard genuinely demotes producers to raw and they DO reach `causeOf`).
7. **Two new test rows as a load-bearing pair** — one fails against v1, one
   fails against v2.

## Your question — the only one that matters

**Does the conjunction have a counterexample?** Two rules died here; find
the third failure or state plainly that there isn't one. Specifically:

- Walk every combination of {defaults, user excludes a producer machine,
  user un-excludes a default-excluded machine} × {TIER null, TIER gating a
  producer} for a raw item, and check the rule gives the answer whose
  recovery is actually actionable.
- Is there a case where BOTH conjuncts hold but a recovery still exists
  (a false natural-ization)? Or where one conjunct fails but no recovery
  exists (a needless constrained line)?
- Verify the claim that the conjunction ≠ the union, and that the union
  would re-admit the coal regression.
- Do the two new test rows actually fail against their respective dead
  rules?
- Any residue of v1 or v2 anywhere in the doc.

Do NOT re-litigate the measurements (settled at r1). Do NOT spawn nested
agents. If the conjunction genuinely holds, APPROVE and say so — do not
manufacture a third finding to justify another round. Return exactly one
verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED) with
severity-tagged, line-cited findings.
