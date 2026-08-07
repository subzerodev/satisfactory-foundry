# Boundary review r2 (delta-scoped) — S21 P0 (#104)

Re-review after the r1 fold. Worktree:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s21-p0`
(branch feature/s21-p0, 4 commits over develop at `e24b05c`).

Delta (1 commit, `1c23b2c..HEAD`):
`features/propose-followups/p0-boundary-r2-delta.diff`

At r1 you both returned NEEDS_REWORK. You had already verified — and these
are NOT in scope again — the predicate (conjunction, transcribed verbatim),
the load-bearing pair (disjoint singletons), the five invariant comments,
the amended pin as the only break, the catalog ground truth, and the
declared deviation in both halves.

## The seven folds

1. **M1's failing SET corrected** — now names all five rows, surfacing what
   the bad description hid: the v2-killer pair row also kills the blanket
   rule. All eight mutation sets now use named-row shorthand, ending the
   "all four coal rows" ambiguity.
2. **The eighth pass-either-way test fixed** — the decorative
   `.chain-builder-metrics` assertion dropped, the false mechanism corrected
   in both the comment and the file header. The rate was carried by the
   CONSTRAINED line (`ChainBuilder.tsx:541`), not the metrics `<dl>`, which
   was already absent because `isEmpty` was already true pre-change.
3. **The headline outcome is now pinned** — the control test asserts the
   plain RAW line for a non-empty chain. The implementer reports this raised
   **M5's bite from 5 to 6**, which is its evidence the new assertions
   discriminate.
4. **15/5, not 14/6** — in the log AND the source comment at
   `chain-builder-adapter.test.ts:2029`.
5. `RawCause` typedoc now documents THREE `natural` routes.
6. The alternate-only row's stated reason now names the `isRawResource`
   guard, not the conjuncts.
7. `types.ts:21` now claims truthiness-safety rather than one exact
   spelling.

## Two corrections the implementer made to MY relayed instructions

Both worth verifying, since they mean the fold is not a literal application
of the r1 findings:

- **My suggested assertion in item 3 was WRONG.** I proposed
  `toContain("Iron Ore 60/min")`; the true rate is **90/min** (Iron Plate
  60/min draws 90 ore/min). It probed the real value and used that. Verify
  the number is right and the assertion bites.
- **Item 4: it confirms 15/5 and states its original 14/6 was an arithmetic
  error while its NAMES were correct throughout.** Verify the final counts
  and names agree with each other and with the catalog.

## Claims to verify

- Each of the seven folds actually landed and is correct.
- **M5's bite really moved 5 → 6**, and the new assertions are the reason —
  i.e. the improvement pin genuinely discriminates rather than decorating.
- The predicate is byte-intact (the implementer reports the only adapter
  diff is the item-5 typedoc).
- All 8 mutants still killed; the pair still bites disjoint singletons.
- No NEW pass-either-way assertion introduced by this fold. Nine have been
  found in this project; the fold that fixes the eighth is a natural place
  for a ninth.
- 908/908 green + check clean (re-run if you have shell).

Do NOT re-litigate anything cleared at r1. Do NOT spawn nested agents.
Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings.
