# Phase 3 completion — src/state Zustand store (ticket #5, epic #2)

Date: 2026-08-03
Branch: `feature/phase-3.0` → merged `--no-ff` into `develop` (3 commits +
plan; worktree + branch removed). Trunk verified: 155/155 tests, `check` +
`build` green.

## What landed

- `src/state/store.ts` (477 lines): the single app store — catalog lifecycle
  (init / upload with the four-sub-case matrix), selection (recipe, machine
  count, clock text, unlocked tiers, dense per-belt overrides), eager
  `derive()` recomputing the live solve through the real
  parse→toStageInput→solveStage pipeline, tiers-only localStorage
  persistence (`satis_foundry:tiers`), and the `useAppStore` React hook for
  Phase 4.
- `src/state/store.test.ts` (24 tests): all seven spec rows headless —
  lifecycle, the full upload matrix (incl. save-fail via the broken-IDB
  seam), re-upload re-validation, live derivation reproducing the Phase 1
  worked example both sides (tiers pinned to 4), invalid-input routing,
  override discipline, persistence round-trips.

## What the gate caught

- **Design (brainstorm 4 rounds — the arc's hardest):** dangling recipeId
  crash after re-upload; sparse-override spurious findings; the upload-error
  state modelled three inconsistent ways; the same-id/changed-lanes silent
  override misapply; and finally the clear-rule's own self-contradiction —
  resolved as **clear iff the in-memory catalog is replaced** (parse
  success, any save outcome; never on parse failure).
- **Plan review:** the tier-dependence trap — the worked-example values
  require `belt: 4`; the default 6-tier table would solve to a single 780
  belt (would have been a baffling implementation failure).
- **Boundary diff (converged first-try):** replacement pivot proven
  half-state-free; persist merge traced through zustand's real hydrate
  paths; two cosmetic test-wording nits folded (`226a01b`).
- **Simplify (all three stages):** APPROVED clean each time.

## Acceptance criteria (ticket #5) — final status

- Brainstorm+spec dual-reviewed + frozen — **met** (6 design rounds total).
- Full headless flow (init/upload/errors, never a crash) — **met**.
- Live recompute + findings exposure + throw-cases as state — **met**.
- Tiers persist/restore; nothing else — **met**.
- check + tests green; core purity untouched; zero new deps — **met** (155/155).
- Cumulative diff dual-reviewed; merged `--no-ff` — **met**.

## Handed to Phase 4

The UI consumes `useAppStore` + the actions: upload screen
(`uploadDocsText`, catalog states + `uploadError`), recipe picker
(`catalog.recipes`, `selectRecipe`), controls (`setMachineCount`,
`setClockPercentText`, `setUnlockedTiers`, `setOverride`), schematic +
warnings (`solve` — `solved`'s `StageSolveResult` incl. findings, `invalid`
reasons). Everything renders from state; no UI-side math.
