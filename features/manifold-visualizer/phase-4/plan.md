# Phase 4 implementation plan — src/ui (ticket #6, epic #2)

Date: 2026-08-03
Status: v1 — under dual-review
Branch: `feature/phase-4.0` (worktree `.worktrees/phase-4.0/`), cut from
develop @ 7b59c64.
Binding contract: the FROZEN spec `features/manifold-visualizer/phase-4/spec.md`
(v2) — file inventory §1, module contracts §2, component contracts §3, styling
§4, test plan §5, exit criteria §6. This plan sequences the work; it restates
no contract. On any plan-vs-spec divergence, the spec wins.

## Pre-implementation drift hunt (MANDATORY, before any code)

Verify against live source in this worktree — do not trust this plan's or the
spec's citations blindly:

1. `src/core/fraction.ts` — exact names/signatures: `Fraction.parse(string)`,
   `.eq()`, `.toString()`, `.toDecimalString(dp)`, `Fraction.from`.
2. `src/core/manifold.ts` — exported types + exact field names:
   `StageSolveResult`, `FeedLaneResult`, `OutputLaneResult`, `FeedBelt`
   (`index`, `capacity`, `overridden`, `entersAfterMachine`), `BreakoutBelt`
   (`index`, `capacity`, `startsAfterMachine`, `load`), `BusSegment`
   (`fromMachine`, `toMachine`, `peakFlow`, `beltIndex`), `Finding` union
   (all four variants + optionality), `LaneKind`, `StageInput`, `solveStage`.
3. `src/state/store.ts` — exports: `appStore`, `useAppStore` (overloads),
   `createAppStore`, types `Store`, `Selection`, `CatalogState`, `SolveState`;
   the eight action signatures.
4. `src/data/types.ts` (`Catalog`, `CatalogRecipe`, `CatalogItem`,
   `CatalogMachine`, `TierTable`), `src/data/tiers.ts` (`TIER_TABLE`).
5. Toolchain: `tsconfig.app.json` (`jsx: react-jsx`, `noUncheckedIndexedAccess`,
   `verbatimModuleSyntax` — type-only imports must use `import type`),
   `vite.config.ts` (vitest `environment: 'node'`, `globals: true`),
   `eslint.config.js` (core-only purity rules — `src/ui` unaffected),
   `package.json` (react 19, react-dom 19, zustand 5; NO new deps allowed).
6. Planner decode source (read-only reference):
   `~/workspace/satisfactory-planner/src/ui/screens/DocsUpload.svelte:14-26`.

Log any drift found as a `DRIFT:` line in the commit body that fixes it.

## Task sequence (3 tasks → 3 commits, TDD within each)

### Task 1 — pure modules + unit tests (commit 1)

`src/ui/decode.ts`, `src/ui/format.ts`, `src/ui/colors.ts`, `src/ui/layout.ts`
per spec §2, with `decode.test.ts`, `format.test.ts`, `colors.test.ts`,
`layout.test.ts` per spec §5 (tests written first per module, red → green).
Fixtures: the worked-example `StageInput` (spec §5 header — `d=30`, `N=20`,
`belt: [60,120,270,480]`, `pipe: [300,600]`) built once in a shared local
helper inside the test files (no production fixture module — test-only).
Acceptance: `npm test` green (155 existing + new); `npm run check` green.

### Task 2 — presentational components + css + smoke tests (commit 2)

`UploadScreen.tsx`, `ControlsStrip.tsx`, `SummaryCards.tsx`, `Schematic.tsx`,
`LaneOverrides.tsx`, `FindingsPanel.tsx`, `Legend.tsx` per spec §3.1–3.7;
`app.css` per spec §4; `smoke.test.tsx` per spec §5 (renderToStaticMarkup,
exact strings incl. the mockup label row and the `peak … of …` title form).
None of these files may import the store. Acceptance: tests + check green.

### Task 3 — connected shell + boot + verification log (commit 3)

`src/ui/App.tsx` per spec §3.8 (sole `useAppStore` importer);
`src/App.tsx` → re-export; `src/main.tsx` boot line + css import path per
spec §1/§3.8. Bidirectionality: append Phase 4 evidence to
`features/manifold-visualizer/r2-verification.log` — one representative
revert per module family (e.g. break `formatRate`'s scan, break a layout
boundary formula, break a component string) showing PASS → FAIL → PASS with
real vitest FAIL lines naming the new tests. Acceptance: `npm test`,
`npm run check`, `npm run build` all green; zero diffs outside `src/ui/`,
`src/App.tsx`, `src/main.tsx`, `features/manifold-visualizer/`.

## Boundaries & discipline

- **No new dependencies; no config file changes.** If something appears to
  need one, STOP and report — that is a spec deviation, not an implementation
  detail.
- **No store/solver/data changes.** `src/core`, `src/data`, `src/state` are
  read-only this phase. The UI adapts; never the reverse.
- **No UI-side math** beyond spec §2.4's integer-index geometry and §2.2's
  formatting. Fractions are never converted to JS numbers.
- Comment density matches the existing codebase (sparse, why-only).
- One commit per task, conventional messages (`feat(ui): …`), each body
  noting DRIFT lines if any.
- The dev-server manual walk is the team lead's job after the boundary
  review dispatch — the implementer does not need a browser.

## Post-implementation (team lead, not the implementer)

Cumulative `git diff develop...HEAD` dual-review (all-Claude roster) →
simplify → merge `--no-ff` → completion report + changelog → close #6.
