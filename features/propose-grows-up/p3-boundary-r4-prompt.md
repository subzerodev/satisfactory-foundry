# Boundary review r4 (delta-scoped) — S20 P3 (#102)

Final delta re-run. Worktree:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s20-p3`
(branch feature/s20-p3, 21 commits over develop). 896 tests green,
check clean.

At r3 you both returned NEEDS_REWORK on one IMPORTANT (the exclusions
carve-out's ledger mutation no longer compiled, so its 16 red rows
were a crash, not a bite) plus accuracy nits. All folded.

## The delta (3 commits, `72826fb..HEAD`, 281 lines)

`features/propose-grows-up/p3-boundary-r4-delta.diff`

1. **The carve-out is now genuinely pinned.** The implementer ran the
   mutation a real regression would look like —
   `excludableMachines(preview?.gated ?? catalog)` — which COMPILES
   and failed **nothing**, confirming the adversarial's prediction
   that the property was unpinned. The new row proposes first, then
   asserts at tier 0 (where the Smelter's only recipe is gated out)
   that its checkbox is present, checked, the count is 4, and
   clicking it clears the exclusion. Measured bite: 1. The ledger
   entry is corrected from 16 to 1, and the METHOD section now states
   the compile requirement with this as the worked example.
2. **The refactor's headline behaviour is now a jsdom row**, not a
   claim: propose → make Rate unparseable → change tier; the picker
   still offers a recipe the new tier gates out while the TIER select
   shows the new tier. Pinned by a new ledger entry (1 row).
3. **Accuracy**: `Preview.gated`'s doc now names the stage pickers
   and constrained rows and calls out the TIER select as the
   deliberate exception; "ten rows" → 9 (it rose from 8 because the
   new headline row also uses the selector); the final check is
   `git status --porcelain -uno` with the four untracked review
   artifacts named as out of scope (they are the team lead's prompts
   and diffs).

Final ledger: **48 behaviors, 46 pinned, 2 confirmed no-ops, none
unpinned** — every count now matching its own recorded output.

## Claims to verify

- **The new carve-out row genuinely discriminates** — would it fail
  under `excludableMachines(preview?.gated ?? catalog)`? Derive it;
  this is the row that exists because the previous evidence was
  false, so it must not be the seventh pass-either-way test.
- **The new headline row discriminates** in both halves.
- The corrected counts (1, 9, 48/46/2) each match their own recorded
  output.
- No other ledger entry has a mutation that fails to compile against
  live source post-refactor — the r3 finding was found in one entry;
  confirm it is not present in others.
- Nothing else regressed; the tree is complete (no test without its
  production counterpart).

If this delta holds, the phase is done — say so plainly. Do NOT
re-litigate anything approved at r1/r2/r3. Do NOT spawn nested
agents. Return exactly one verdict (APPROVED / APPROVED_WITH_NITS /
NEEDS_REWORK / BLOCKED) with severity-tagged, line-cited findings.
