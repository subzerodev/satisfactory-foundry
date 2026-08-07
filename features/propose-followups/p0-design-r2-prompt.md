# Design review r2 (delta-scoped) — S21 P0 (#104)

Re-review of `features/propose-followups/p0-brainstorm.md` (v2) in
`/home/subzerodev/workspace/satisfactory-foundry` (develop). At r1 you both
returned NEEDS_REWORK — and you both independently re-derived and CONFIRMED
every measurement, so the central argument stood; the defects were the
un-enumerated dimensions and the bookkeeping.

## The deltas (the ONLY changes since v1)

1. **The rule now keys on the `EXCLUDED_MACHINE_IDS` CONSTANT**, not the
   live exclusion set (your shared MAJOR). Rationale recorded: the live-set
   form was the exact negation of `tierLever` and consumed the matrix's
   `machine`/`both` cells; the constant makes the classification a property
   of the catalog, not the session. The converse direction is argued safe by
   construction — un-excluding the Converter makes the item a STAGE, so it
   never reaches `causeOf`.
2. **Axis 3 now enumerates BOTH varying dimensions** (tier AND user
   exclusions) and argues all four matrix cells stay reachable.
3. **The broken pinned test is named** —
   `chain-builder-adapter.test.ts:212-234`, assertion AND rationale comment,
   recorded as the only such break.
4. **Spec item 2's "no change expected" is retracted** — the
   `ChainBuilder.tsx:476` consequence (propose a natural-ized raw item as
   the TARGET → "Nothing to build", rate line disappears) is now recorded as
   a deliberately ACCEPTED visible UI change, with walk + test rows.
5. **Three falsified invariant comments named** (adapter :250-255, :340-346;
   `types.ts:20-27`'s "sole consumer").
6. **The amended biconditional is stated**; tests assert NAMED SETS not
   counts; the tier pin is identified as `coal @ TIER ≤ 2`; packager cases
   named; the `items`-map source and `=== true` idiom pinned; the
   no-parser-bump fact added to the ledger.

## Your question

- **Does the constant-keyed rule have its own counterexample?** This is the
  second rule this design has proposed; the first died to `coal`. Hunt an
  item or a user action where keying on the constant gives the wrong answer.
  In particular re-check the "converse is safe by construction" claim
  yourself against `selectProducer` — if a raw item can reach `causeOf`
  while the Converter is un-excluded, the rule misfires.
- Do all four `leverOf` cells genuinely stay reachable now?
- Is the accepted "Nothing to build" consequence actually acceptable, or
  does it lose something the doc has not noticed (e.g. for a raw target the
  user typed a rate for)?
- Are the test rows sufficient — would the `coal`-with-Constructor-excluded
  row actually FAIL against the v1 live-set rule?
- Any residue of the v1 rule anywhere in the doc.

Do NOT re-litigate the measurements (both of you already confirmed them).
Do NOT spawn nested agents. Return exactly one verdict (APPROVED /
APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED) with severity-tagged,
line-cited findings.
