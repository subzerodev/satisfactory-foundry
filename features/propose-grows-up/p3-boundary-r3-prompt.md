# Boundary review r3 (delta-scoped) — S20 P3 (#102)

Re-review after the simplify fold + the r2 nit fold. Worktree:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s20-p3`
(branch feature/s20-p3, 18 commits over develop).

At r2 you both returned APPROVED_WITH_NITS — the correctness pair
CONVERGED. The one-shot diff-stage simplify pass then ran
(APPROVED_WITH_NITS: 1 MEDIUM + 4 LOW), and per the fold contract a
simplify fold re-runs the CORRECTNESS pair only. This is that re-run.

## The delta (3 commits, `d96dff5..HEAD`, 745 lines)

`features/propose-grows-up/p3-boundary-r3-delta.diff`

1. **The MEDIUM (structural)** — the two `gated` derivation sites
   collapse to one: `Preview` gains `gated: Catalog`, snapshotted by
   `repropose` beside `clockText`; the four consumers read
   `preview.gated`; `chooseRecipe` gains an early null-preview
   guard. DELETED: the `useMemo` + import, the hazard comment about
   the hook needing to sit above the null-catalog guard, the
   second-disjunct rebinding, and the memo-dep seam row.
   This dissolves the r4-r6 memo-placement question rather than
   answering it, and removes a real skew (repropose returns early on
   an unparseable Rate while onTierChange has already set the tier).
2. **Four LOWs** — subsumed TIER row deleted; subsumed normalized-id
   row folded; `parseTechTier` rows folded into one `it.each`; and
   the vacuous `if (ore) expect(...)` replaced with optional
   chaining — **which went red immediately: that row had been
   asserting nothing since it was written**, because the fixture
   gated the DEFAULT recipe, collapsing `ingot` to raw and pruning
   `ore` from the closure. Fixture now gates the alternates.
3. **The r2 nits** — the wrapping-label naming pin added (both
   directions verified); three overclaiming comments retargeted; the
   log's carve-out (a) split three ways; the "reproducible" harness
   wording corrected.

Log re-swept after the refactor: **47 behaviors, 45 pinned, 2
confirmed no-ops, none unpinned**, including a new entry ("the
preview CARRIES the gated world it was solved against") that reddens
four rows.

## Claims to verify

- **The structural refactor is behaviour-preserving.** All four
  consumers still receive the GATED world; nothing now reads a
  stale or ungated catalog; the early null-preview guard in
  `chooseRecipe` changes no reachable behaviour. Confirm the skew the
  reviewer described is genuinely unrepresentable now.
- **The deleted memo-dep seam row left no hole** — with no memo there
  is no dep array, but confirm no OTHER property it happened to pin
  is now unpinned.
- **Each of the four LOW edits is behaviour-preserving**, and the
  repaired `ore` fixture now genuinely exercises what its row claims
  (this was defect #6 of the pass-either-way class — verify the
  repair, do not assume it).
- **The new wrapping-label pin discriminates** in both directions.
- The three retargeted comments now match what their assertions
  actually check.
- 894/894 green + check clean (re-run if you have shell).
- **The implementer hit its own documented harness hazard a second
  time** (ran the sweep with uncommitted test edits; the final
  `git checkout -- src/` wiped them; recovered by re-applying and
  committing first). Verify the final tree is complete — no test
  present without its production counterpart, and no ledger entry
  describing a mutation whose target string is absent from live
  source.

Do NOT re-litigate anything approved at r1/r2. Do NOT spawn nested
agents. Return exactly one verdict (APPROVED / APPROVED_WITH_NITS /
NEEDS_REWORK / BLOCKED) with severity-tagged, line-cited findings.
