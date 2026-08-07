# Boundary review r3 (delta-scoped) — S21 P0 (#104)

The correctness re-run required after a simplify fold. Worktree:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s21-p0`
(branch feature/s21-p0, 6 commits over develop at `e24b05c`).

Delta (2 commits, `8114924..HEAD`, 337 lines):
`features/propose-followups/p0-boundary-r3-delta.diff`

You converged at r2 (APPROVED_WITH_NITS ×2). The one-shot diff simplify pass
then ran (APPROVED_WITH_NITS; logic declared at its minimum, two
re-expressions of the predicate explicitly rejected). Per the fold contract
a simplify fold re-runs the CORRECTNESS pair only. This is that re-run.

## The delta

**From your r2 nits** (commit `1fe9d3f`):
- the 90/min assertion scoped to `.chain-builder-metrics` — the implementer
  verified this by ISOLATING the row (siblings disabled, M5 applied) and
  confirming it now fails alone: `expected 'Σ POWER24 MWΣ MACHINES6RAW—' to
  contain 'Iron Ore 90/min'`;
- `types.ts`'s three-vs-TWO contradiction resolved; the adapter's stale
  "mandates `=== true`" citation corrected; the redundant
  `not.toContain("120/min")` dropped and its false justification fixed.

**From the simplify pass** (commit `04fd0b7`):
- **~45 lines of process archaeology removed from live source** — tombstones
  for removed assertions and rebuttals of unsubmitted drafts. Facts kept,
  correction history deleted.
- **One subsumed adapter row DELETED** (`[iron/water]`). Evidence: M5's kill
  count fell 6 → 5, losing exactly that row, every other mutant's set
  byte-identical. Spec item 4's requirement to pin the converter and packager
  cases is now met by the stronger whole-set assertion (`[eleven/one]`'s
  named set contains `ore_iron`, `water`, `liquid_oil`, `nitrogen_gas`), with
  the rationale moved into that row's comment.
- The 15-name enumeration now points at the log's §M6; `"11 of the 12"`
  became count-free prose; the forward-pointing `hasAnyProducer`
  parenthetical dropped (the `"this branch's natural"` qualifier KEPT, since
  that is what satisfies spec item 1's falsified-claim fix).

## Claims to verify

- **The deletion is safe.** Does `[eleven/one]` genuinely subsume what
  `[iron/water]` pinned — including the `lever === null` half? Confirm the
  M5 6 → 5 evidence and that no other mutant's set changed.
- **No coverage lost to the archaeology strip.** It removed comments only —
  verify no assertion, no test, and no load-bearing *fact* went with them.
  Spec item 1 requires five invariant comments to be correct; confirm all
  five still are after the strip.
- **The scoped 90/min assertion bites alone** (the implementer's isolation
  probe is a claim — check it).
- The predicate is still byte-intact; all 8 mutants still killed; the
  load-bearing pair still bites disjoint singletons.
- **No new pass-either-way assertion.** Nine have been found in this project.
  A fold that DELETES a test and rewrites comments is a plausible home for a
  tenth — and for a silently weakened pin.
- 907/907 green (net −1, the deleted row) + check clean.

Do NOT re-litigate anything cleared at r1/r2. Do NOT spawn nested agents.
If this holds, say the phase is ready to merge. Return exactly one verdict
(APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED) with
severity-tagged, line-cited findings.
