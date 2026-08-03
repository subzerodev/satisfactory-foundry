# Phase 2 completion — src/data Docs.json parser + catalog (ticket #4, epic #2)

Date: 2026-08-03
Branch: `feature/phase-2.0` → merged `--no-ff` into `develop` (5 commits;
worktree + branch removed). Trunk verified: 131/131 tests, `check` + `build`
green.

## What landed

- `src/data/` (7 modules + colocated tests, 1604 diff lines): the Docs.json
  parser ported from satisfactory-planner and trimmed to v1 (no power, no
  stack sizes), producing an exact-`Fraction` catalog — every numeric read via
  `Fraction.parse` on the file's original strings, fluids normalized ÷1000
  exactly, loud `DocsParseError`s replacing the port's silent defaults.
- `toStageInput`: the catalog→solver mapping (lane kinds from `isFluid`,
  tier-prefix slicing, lane-addressed overrides with distinctness assertion,
  the stated throw-vs-finding boundary) + `parseRational` (strict
  `Fraction.toString()` reviver).
- IndexedDB cache: database `satis_foundry` v1 (deliberately distinct from
  the planner's), `StoredCatalog` with string-serialized Fractions + SHA-256
  hash + parser version, never-throw `{hit|stale|empty}` loads.
- Integration proof: a parsed fixture recipe reproduces the Phase 1
  20-smelter worked example on the REAL solver, both feed and output sides.
- One new devDependency: `fake-indexeddb`. Core purity untouched.

## What the gate caught

- **Design (brainstorm 2 rounds, spec 1, plan 1):** the `parseRational`
  internals type error (Fraction.of never takes a Fraction — nested-verifier
  confirmed); the unpinned IndexedDB name (cross-app collision with
  `satis_planner`); the skip-vs-throw boundary made explicit (no real recipe
  wrongly rejected); the throw-vs-finding principle grounded in a real
  solver-assert hazard (empty capacity lists); the one-lane-per-(itemId,side)
  precondition; the output-side product Amount pin for the integration
  fixture.
- **Boundary diff review:** first-try double-APPROVED with zero findings —
  the arc's first clean boundary. Simplify folded one unreachable guard
  (`4fe6543`, same class as core's `08f1d29`), scoped re-check APPROVED.

## Acceptance criteria (ticket #4) — final status

- Brainstorm+spec dual-reviewed + frozen, port-grounded — **met**.
- Exact-Fraction catalog, decimal-string exactness end-to-end — **met**
  (mechanically: zero float call sites in `src/data`).
- Catalog→StageInput proven against the live solver — **met** (both sides).
- IndexedDB cache hit/stale/empty + loud upload failures — **met**.
- check + tests green; core purity untouched — **met** (131/131).
- Cumulative diff dual-reviewed; merged `--no-ff` — **met**.

## Handed to Phase 3

The store's inputs are all live on `develop`: `parseCatalogFromText`,
`saveCatalog`/`loadCatalog`, `toStageInput(recipe, catalog, opts)`, and the
solver. Phase 3 wires selection state (recipe, machineCount, clock %,
unlocked tiers, overrides) + derived solve; unlocked tiers persist to
localStorage (v1 spec §Architecture).
