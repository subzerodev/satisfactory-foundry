# Boundary review r2 (delta-scoped) — #116

At r1 you both returned **APPROVED_WITH_NITS** on the `feature/alt-marker` diff.
The folds changed the diff, so the correctness pair re-runs. **Review only the
delta**, commit `a5cc873..cc2a0e6`.

Delta diff:
`/tmp/claude-1000/-home-subzerodev-workspace-satisfactory-foundry/78d7d7a8-7929-4fa7-9357-e78884a0e550/scratchpad/alt-marker-delta.diff`
(3 files, +88/-3). Worktree: `.worktrees/alt-marker`, branch `feature/alt-marker`.
**No production code changed in this delta** — `src/ui/chain-builder-adapter.ts`
and `src/ui/AltCompare.tsx` are untouched since r1.

## The three changes

1. **A NEW test** — `chain-builder-adapter.test.ts`, *"flags isAlternate against
   REAL parsed names, not a name prefix (#116)"*. This is the substantive one.

   The r1 adversarial reviewer named
   `isAlternate: candidate.displayName.startsWith("Alternate")` as a mutant that
   **survives both shipped pins** and is silently wrong in production, then
   waived it because closing it looked like it required renaming a fixture
   recipe shared by many pins. I took a cheaper close it did not consider:
   assert against the **real bundled catalog**, using the 5-candidate compare
   fixture already in that file.

2. **`renderWithCurrent` now builds its snapshot once per render** and returns a
   stable reference (r1 code-reviewer NIT: `getServerSnapshot` is contractually
   required to be cached; the precedent test hoists a single `seeded` object).

3. **`verification.log`** — stale `:950` → `:953` citation fixed, plus a new
   "MUTANT A6" section recording the measurement for change 1.

## What to verify

- **Is the new pin genuinely bidirectional, and is it non-redundant?** The log
  claims: the mutant **compiles** (`tsc -b` exit 0, so the kill is behavioural);
  **both shipped pins still PASS** against it (proving they are blind to it and
  the new row earns its place); and the new row **fails** with
  `[false,false,false,false,false]` vs `[false,true,true,true,true]`. Re-derive
  each claim. In particular confirm the expected vector `[F,T,T,T,T]` is correct
  for `candidateRowsFor(catalog, "iron_ingot", "ingot_iron", F(60))` against the
  real bundled catalog — an existing pin at the same fixture already asserts the
  candidate id order.
- **The second assertion in that row** — `rows.some(r => r.recipeName.startsWith("Alternate"))` is `false` — is meant to pin the row's own PREMISE so it cannot rot into a tautology if the parser ever stops stripping the prefix. Does it actually achieve that, or is it itself vacuous?
- **Change 2:** does hoisting the snapshot preserve the test's meaning (two
  renders, two different seeded states), and is the seam still restored in
  `finally`?
- **Did adding a required-field assertion to a shared bundled fixture weaken or
  break any existing pin** in that describe block?
- Anything the delta got wrong.

## Do NOT re-litigate (settled at r1)

- The three production lines, the two original pins, their polarities, and the
  original verification log's 8 mutants — you both verified these.
- That the positional mutant is unreachable and the `machineId`/`displayName`
  *constant* mutants are not slips.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings. This is a small delta on an
already-approved diff — approve honestly if it is sound.

Do NOT spawn nested verification agents; verify yourself and return your verdict
directly.
