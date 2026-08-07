# Simplify review — S20 P3 (#102) design, post-convergence

Stage: DESIGN. The correctness pair has converged (r3: APPROVED +
APPROVED_WITH_NITS, nit folded) on
`features/propose-grows-up/p3-brainstorm.md` (v3) in the repo at
`/home/subzerodev/workspace/satisfactory-foundry`. Do NOT re-check
correctness. Your one question: **is this design simpler than it needs
to be — and if not, what is the simplest correct shape?**

Scope of the design (two features, the arc's last phase):
1. **Persistent propose preferences** — recipe overrides + machine
   exclusions persisted in the existing localStorage store slice
   beside `unlockedTiers`; ChainBuilder seeds component state from
   them and mirrors changes back. rawItemIds + clock stay ephemeral.
2. **Tier gating** — `docs-loader` parses FGSchematic into
   `catalog.recipeUnlocks` (normalized recipe id → {tier, source});
   `unlockedTier` rides the propose options bag; the adapter gates
   internally via `gateCatalog` (identity at null); causeOf splits
   ungated-hasAnyProducer from gated-effectiveness; constrained rows
   get a four-cell lever matrix (tier / machine / either / both) for
   the recovery wording; a TIER select in the controls row.

Surfaces to pressure for over-engineering:
- The **lever matrix**: four wordings from two booleans — is that the
  simplest honest shape, or would a single "raise TIER and/or edit
  MACHINE EXCLUSIONS" line carry the same information at a fraction of
  the branching? (Weigh: the correctness pair required no FALSE hint;
  a union-phrasing may satisfy that trivially.)
- `RecipeUnlock.source` (`milestone|alternate|mam|other`) — does any
  consumer in this design read `source`, or is only `tier` used?
- The `proposePrefs` shape: three fields in one persisted object vs
  reusing existing shapes; is the read-validation ceremony
  proportionate?
- `gateCatalog` as a whole-catalog projection vs a simpler predicate
  threaded where needed.
- Test-plan bulk: rows that re-pin what another row already pins.
- Anything specced that no consumer reads.

Frozen constraints (NOT simplification targets): the alternate-
inclusive lever predicates (r2/r3 correctness fix); normalization of
schematic refs; AltCompare stays ungated; identity-at-null byte
stability; the parser-version bump; persistence home (localStorage
slice).

Verdict is advisory (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED — only BLOCKED escalates). Return severity-tagged, line-cited
findings naming the simpler shape for each.
