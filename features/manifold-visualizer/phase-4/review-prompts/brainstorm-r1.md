# Review request — Phase 4 brainstorm, round 1 (manifold-visualizer arc)

Artifact: `/home/subzerodev/workspace/satisfactory-foundry/features/manifold-visualizer/phase-4/brainstorm.md`
Worktree/repo root: `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop` @ 8daffc6)
Stage: DESIGN (brainstorm). Phase 4 = the final phase: src/ui React components for the v1 manifold visualizer.

## A. Current-state anchors (verify claims against these live sources)

- `src/state/store.ts` — the frozen Phase 3 store contract the UI consumes
  (`useAppStore`, eight actions, `CatalogState`/`SolveState`/`Selection`
  unions, dense override arrays, `uploadError` semantics).
- `src/core/manifold.ts` — `StageSolveResult` / `FeedLaneResult` /
  `OutputLaneResult` / `FeedBelt` / `BreakoutBelt` / `BusSegment` / `Finding`
  types; the infeasible-lane "Render nothing" emission (~lines 318-342 feed,
  458-478 output).
- `src/core/fraction.ts` — `toString()` (lines ~199-204) and
  `toDecimalString(dp)` (~210-234, half-up rounding).
- `src/data/types.ts`, `src/data/tiers.ts` — catalog shapes, TIER_TABLE
  (belt 6 tiers, pipe 2).
- `src/data/stage-input.ts` — `StageOptions` + throw-vs-finding boundary.
- `docs/superpowers/specs/2026-08-03-manifold-visualizer-design.md` §UI +
  §Testing — the approved v1 mockup and testing clause (authoritative for
  scope).
- `src/App.tsx`, `src/main.tsx`, `index.html`, `package.json`,
  `vite.config.ts` (vitest env: node), `eslint.config.js` (purity rules scope
  src/core only), `tsconfig.app.json` (jsx: react-jsx).
- Reuse reference (external repo, read-only):
  `/home/subzerodev/workspace/satisfactory-planner/src/ui/screens/DocsUpload.svelte`
  — the UTF-16 BOM `decodeFile` the brainstorm proposes porting.
- Settled-decision context: epic #2 Decisions block + #3/#4/#5 audit trails
  (summarized in the brainstorm's "Already settled" list — the arc's
  operating rule is that those are NOT re-litigated; flag the brainstorm if it
  contradicts one).

## B. Claims to verify (the brainstorm's load-bearing picks)

1. Axis 1/2: presentational-components + single connected App; file layout;
   boot line `void appStore.getState().init()` in main.tsx.
2. Axis 3: layout.ts purity invariant — all coordinates from integer machine
   indices/counts; Fractions never numerically converted; compression + label
   stepping formulas.
3. Axis 4: `formatRate` exactness rule (decimal only when Fraction.parse
   round-trips; fraction-string fallback) against the real fraction.ts API.
4. Axis 5: tier-color resolution via Fraction.eq against TIER_TABLE +
   OVERRIDE_COLOR; native SVG `<title>` hover; findings→highlight matching by
   lane + span.
5. Axis 6: control→action mapping against the real store signatures (incl.
   prefix-count tier toggles presented as a toggle row; overrides editing
   addressed by solve-result belt list; no UI-side pre-validation).
6. Axis 7 (the ticket's explicit ask): the pinned testing posture — pure-module
   unit tests + renderToStaticMarkup smoke tests in the existing node env +
   manual gate walk; ZERO new deps (no jsdom/@testing-library). Verify
   feasibility (react-dom present; vitest env node; no config change needed)
   and that it honors the v1 spec's "UI stays thin" clause.
7. Axis 8: the UTF-16 decode port necessity + `uploadDocsText(text)` handoff.
8. Degenerate/invalid rendering rules vs the actual solver/store emissions.
9. Assumptions ledger — each entry's grounding claim is accurate.

Review the artifact per your discipline. Verdict: one of APPROVED /
APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED, with severity-tagged, line-cited
findings.
