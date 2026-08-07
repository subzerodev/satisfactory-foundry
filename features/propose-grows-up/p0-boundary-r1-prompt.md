# Boundary review r1 — S20 P0 (#99): Propose info layer implementation

Review the CUMULATIVE diff against the frozen design. Worktree (review
against THIS tree):
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s20-p0`
(branch feature/s20-p0, 3 commits over develop at 1617ae3).

Diff (814 lines):
`/home/subzerodev/workspace/satisfactory-foundry/features/propose-grows-up/p0-boundary-r1.diff`

## A. Contract anchors

- Frozen contract: `features/propose-grows-up/p0-brainstorm.md` (v3
  FROZEN, in the worktree) — spec items 1-4. Item 5 (docs) is the team
  lead's; do not flag its absence.
- PINNED points: `proposalMetrics` returns { powerMw, powerVaries, minMw,
  maxMw, machineCount: bigint, rawInputs: ItemRate[] RAW rows };
  degenerate envelope minMw===maxMw===powerMw on constant chains; the
  compare path re-composes with BYTE-IDENTICAL output (23 pre-existing
  alt-compare tests unchanged); depth = longest-path-from-target walking
  links to→from, ties by existing row order, unreachable rows last; row
  fields { depth, feeds, candidateCount }; candidateRecipesFor
  catalog-first, length 0 or ≥2; chip "N recipes" when nonzero; cost
  sheet Σ POWER (exact, varies suffix) / Σ MACHINES / RAW above the rows;
  T<n> markers on first row of each depth; "→ feeds …" suffix; NO new
  state/controls/store surface.

## B. Claims to verify

1. Every hunk against the contract — scope creep (P1+ leaking in), dead
   code, settled-decision violations.
2. Implementer claims: 782/782 + check clean (re-run if you have shell);
   compare-path regression genuinely byte-identical (inspect how the
   compare path now composes over proposalMetrics — or whether it still
   computes independently, which would violate the reuse contract).
3. THREE DECLARED DEVIATIONS — judge each:
   (a) history was re-cut into a build-clean 3-commit order after a
   self-caught non-buildable intermediate commit (worktree-local, never
   pushed) — acceptable hygiene or a red flag?
   (b) a 4th CSS class `.chain-builder-feeds` beyond the spec's three —
   legitimate rendering necessity or creep?
   (c) the standalone "Raw inputs:" preview line was FOLDED into the cost
   sheet's RAW line and the old `.chain-builder-raw` selector deleted —
   the spec says RAW lives in the sheet and "byproducts stays where it
   is" but never explicitly said to remove the old raw line. Is the fold
   the correct reading of Axis 4, and is the deletion clean (no orphaned
   references/tests)?
4. The bidirectionality log `p0-r2-verification.log` — 4 real breaks with
   genuine FAILs naming the new tests, restore, green, and the
   adapter-byte-identical-after-restore claim.
5. Depth implementation details: longest-path totality (cycle safety —
   can proposal.links ever cycle, and if so does the walk terminate?),
   the diamond test's honesty, feeds ordering determinism.
6. Rendering: tier markers/chips/suffix markup accessibility + theme
   token usage (dark blocks redefine tokens, so no per-theme overrides
   needed — verify that reasoning against app.css).

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings.
