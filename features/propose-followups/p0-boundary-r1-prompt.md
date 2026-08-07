# Boundary review r1 — S21 P0 (#104): ore constrained-vs-natural

Review the CUMULATIVE diff against the frozen v5 design. Worktree:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s21-p0`
(branch feature/s21-p0, 3 commits over develop at `e24b05c`).

Diff (710 lines): `features/propose-followups/p0-boundary-r1.diff`
(or `git diff develop...HEAD` in the worktree).

## A. Contract anchors

- **Frozen contract:** `features/propose-followups/p0-brainstorm.md` (v5
  FROZEN, in the worktree). Spec items 1-4 are acceptance criteria (item 5,
  docs, is the team lead's).
- **Read the revision history.** Four design rounds; THREE rules were
  proposed and TWO killed by counterexample. The surviving rule is the
  CONJUNCTION of two vacuity tests (default constant AND live exclusions) —
  NOT the union, which is weaker and re-admits the coal regression.
- The predicate exists in exactly ONE executable place in the spec (the
  Axis 2 code block); three propositional restatements agree with it.

## B. Claims to verify

1. Every hunk against the contract — scope creep, dead code. The change
   should touch `causeOf` + comments + tests and nothing else.
2. **The implemented predicate is the CONJUNCTION**, transcribed from the
   code block — not one conjunct, not the union. This is the whole design.
3. All FIVE invariant comments updated (spec item 1), including the
   `RawCause` typedoc and `types.ts`'s "sole consumer"/"only reader" claims.
4. The amended pin (`chain-builder-adapter.test.ts:212-234`) — assertion AND
   rationale — and that it was genuinely the only existing break.
5. **The load-bearing test PAIR actually discriminates**: `coal` +
   Constructor-excluded must fail against the dead live-set rule; `ore_iron`
   + Converter-un-excluded @ TIER ≤ 8 must fail against the dead
   constant-only rule. Derive each; if either passes under both dead rules
   it is not doing its job.
6. The accepted UI change (spec item 2) is pinned, with its negative
   assertions guarded against passing vacuously.
7. **A DECLARED DEVIATION** — the implementer reports that the spec's
   nominated `polymer_resin` spot-pin is NON-DISCRIMINATING (its producer is
   in neither exclusion set, so both conjuncts already hold and the guard is
   irrelevant to it). It kept that row and ADDED `packaged_water`, which it
   says does enforce the claim. **Verify both halves of that finding** —
   that `polymer_resin` genuinely cannot fail, and that `packaged_water`
   genuinely can. This is a defect in the frozen spec, so judge whether the
   substitution is right and whether anything else in item 4 has the same
   problem.
8. **The bidirectionality log** (`p0-r2-verification.log`): 8 mutations
   claimed, all compiling, all killed. Verify the mutations compile against
   live source (a crash is not a bite), that the failing SETS are sane, and
   the implementer's report that `P(CONST ∪ live)` fails BOTH pair rows
   (stronger than the spec predicted) — it says it investigated rather than
   banked that. Confirm the reasoning.
9. 908/908 green + check clean (re-run if you have shell).

This project's recurring failure is tests that pass whether the code is
right or wrong — SEVEN instances so far, and item 7 above is the seventh,
found in the spec itself. Hunt an eighth.

Do NOT spawn nested agents. Return exactly one verdict (APPROVED /
APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED) with severity-tagged,
line-cited findings.
