# Manifold visualizer — final feature report (Stage 1 arc, epic #2)

Date: 2026-08-03
Status: feature-complete on `develop` @ 4d9c7fe · release PR `develop → main` open for review
Spec of record: `docs/superpowers/specs/2026-08-03-manifold-visualizer-design.md`
(+ per-phase frozen brainstorm/spec/plan under `features/manifold-visualizer/phase-{1..4}/`)

## What v1 delivers

For one production stage — a recipe on N machines at a uniform clock — the app
computes and draws: how many belts/pipes must feed the manifold, the exact
machine boundary where each feed enters, where the output bus saturates and
breaks out to a fresh belt, per-segment steady-state peak flows, and honest
findings (infeasibility, over-capacity, starvation) whenever no clean
manifold exists. Docs.json uploads (real UTF-16 files) parse to an exact
catalog cached in IndexedDB; unlocked tiers persist; every control change
recomputes live. All solver math is exact rational (`Fraction`) end to end —
the UI never converts a rate to a float.

## Architecture as built (= as designed)

| Layer | Contents | Tests |
|---|---|---|
| `src/core` | `Fraction` + the manifold solver (pure TS, lint-enforced zero-dep) | 100 |
| `src/data` | Docs.json parser (planner port, trimmed), catalog, IndexedDB cache, `toStageInput` | 31 |
| `src/state` | one Zustand store: catalog lifecycle, selection, eager derive, tiers persistence | 24 |
| `src/ui` | React components + pure layout/format/colors/decode modules; SVG schematic | 53 |

208/208 tests, `check` (tsc + eslint + prettier) and `build` green on trunk.
Zero dependencies added across the entire arc (react/zustand were Stage 0).

## Process record (the numbers)

- 4 phases, each: brainstorm → spec → plan (all dual-reviewed to convergence,
  all-Claude roster per user directive) → worktree implementation → cumulative
  boundary dual-review → simplify pass → `--no-ff` merge. USER GATE at every
  phase boundary.
- **The boundary gate caught a real defect at 5 of 5 phase-level reviews**,
  incl. Phase 4's peakFlow-tooltip substitution (wrong number on ordinary
  solves, masked by a worked-example coincidence) and Phase 1's phantom-index
  clamp. Design-stage review reshaped every phase's contract before code
  (dangling-recipeId crash, override clear-rule contradiction, label
  double-print, UTF-16 upload trap, tier-dependent test values).
- Bidirectionality logs (`phase-N/r2-verification.log`) prove every new test
  fails when its production behavior is broken.
- Growth path preserved: chained stages, physical layout, save/load, importer
  all remain structurally open (presentational schematic re-hostable; store
  serializable; no geometry in core).

## Verification of the epic's acceptance

- Full v1 user flow — **verified** in the dev server: UTF-16 Docs.json upload
  → recipe pick → 20 Smelters @ Mk4 reproduces the design spec's worked
  example on screen (entry after machine 16 both sides, exact labels +
  tooltips); invalid/infeasible states render honestly.
- Solver correctness carried by table-driven Vitest suites — **208/208**.
- Nothing structurally blocks the growth path — **held** (reviewed each
  phase; simplify passes confirmed no speculative machinery either).
- All child issues (#3, #4, #5, #6) closed and reconciled with board #21.

## Release

- Release PR: develop → main — link recorded on epic #2 (opened via the
  secrets-broker; user review gates the merge).
- Post-merge: epic #2 → Done; Stage 1 milestone closes.
