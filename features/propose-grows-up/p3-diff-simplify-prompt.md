# Simplify review — S20 P3 (#102) diff, post-convergence

Stage: DIFF. The correctness pair has converged (boundary r2:
APPROVED_WITH_NITS ×2) on the cumulative diff of branch
feature/s20-p3 over develop, in the worktree
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s20-p3`.
Diff: `features/propose-grows-up/p3-boundary-r2.diff` (or
`git diff develop...HEAD`). Do NOT re-check correctness. Your one
question: **is this implementation simpler than it needs to be — and
if not, what is the simplest correct shape?**

What the diff builds: FGSchematic → `catalog.recipeUnlocks` (with the
full cache round-trip), persisted propose preferences (overrides,
machine exclusions, tier) in the existing localStorage slice with
seed-and-mirror, and tier gating via a `gateCatalog` projection
derived at two sites and threaded to five gate-sensitive call sites,
plus a four-cell recovery lever matrix and a jsdom seam-test file.

Surfaces to pressure:
- **The four-cell lever matrix** (`chain-builder-adapter.ts`
  `leverOf`) — four wordings from two booleans. Is that the minimum
  information, or would fewer branches carry it? (Design review
  established it must never emit a FALSE lever hint; weigh that.)
- **The two derivation sites** for `gated` (component body memo +
  inside `repropose` from the patch tier). Genuinely both needed, or
  does one suffice?
- **`PreviewOptions.ungatedCatalog?`** — a second catalog threaded
  through options. Simplest way to give causeOf both worlds?
- **Seed-and-mirror** — component state duplicating store state, with
  a mirror call in each handler. Cheaper shape available given
  `rawItemIds` must stay ephemeral?
- **The jsdom seam file** (~500 lines) — any row redundant with
  another, or with an adapter-level test?
- **The schematic parse** — two-pass with a raw collection buffer.
  Necessary, or expressible in one pass?
- Anything built that no consumer reads; any test that re-pins what
  another already pins.

Frozen constraints (NOT simplification targets): alternate-inclusive
lever predicates; the quote-excluding ref capture; `recipeUnlocks`
through all cache seams; null-prototype maps; `!== undefined` for the
patch tier; the carve-outs that stay ungated; identity-at-null.

Verdict is advisory (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED — only BLOCKED escalates). Return severity-tagged, line-cited
findings naming the simpler shape for each. Do NOT spawn nested
agents.
