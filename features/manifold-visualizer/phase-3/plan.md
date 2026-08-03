# Phase 3 implementation plan — src/state store (ticket #5)

Date: 2026-08-03 · Status: v1, plan dual-review pending · Branch: `feature/phase-3.0`
Spec: `features/manifold-visualizer/phase-3/spec.md` (FROZEN; the frozen
brainstorm's pinned rules are normative where cited). Worktree:
`.worktrees/phase-3.0/`.

## Shape

One implementation agent, one worktree, two sequential TDD tasks, one commit
each. `npm test` + `npm run check` green before every commit;
bidirectionality log at the end.

**Pre-impl drift hunt (mandatory first step):** verify against live source —
zustand 5.0.14 exports (`zustand/vanilla` createStore, `zustand/middleware`
persist + createJSONStorage, `zustand/react` useStore); the data-layer
surfaces (`parseCatalogFromText`, `loadCatalog`/`saveCatalog` +
`resetDbCache`, `toStageInput` + `StageOptions` + throw messages,
`DocsParseError`, `TIER_TABLE` lengths); `solveStage`/`StageSolveResult`;
`Fraction.parse` semantics. Resolve the react-packaging hatch (spec ledger):
hook in `store.ts` unless `npm test` breaks under node — expected: it won't.
Any drift → stop and report.

## Task 1 — store core: types, state, actions, derive

- `src/state/store.ts`: the frozen types + flat `AppState`; `createStore`
  with `persist` (partialize/merge/`satis_foundry:tiers`/injectable
  storage); all eight actions with the pinned semantics (replacement-keyed
  override clear, recipeId re-validation, dense `setOverride` padding, tier
  clamping, wide catch + `uploadError` cleared at entry,
  mutate-fully-then-derive-once); `derive()` per the frozen Axis 3 pipeline;
  `useAppStore` hook export.
- Tests (spec rows 1, 4, 5, 6): catalog lifecycle (empty/hit/stale via real
  cache under fake-indexeddb); live derivation through the REAL
  parse→toStageInput→solveStage pipeline (DOCS_FRAGMENT-style fixture,
  20-machine iron worked example both sides); invalid-input routing (all
  reasons + the count-excess `solved`+finding split); override discipline
  (dense padding, clear triggers, machineCount/clock non-triggers).
- Commit: `feat(state): app store — selection, catalog lifecycle, live derive`.

## Task 2 — upload matrix + persistence tests (no new production code expected)

- Tests (spec rows 2, 3, 7): the four-sub-case upload matrix (parse-fail
  fresh-boot / parse-fail while-ready keeps overrides / parse+save success
  clears / parse-success+save-fail via broken-`indexedDB`-factory swap after
  `resetDbCache` — test-side only, the Phase 2 seam); re-upload
  re-validation (dangling id → null → idle; surviving id → fresh solve,
  overrides cleared); persistence (tiers survive store re-create via the
  object-stub storage; corrupt stored JSON → defaults; stored value is
  exactly `{unlockedTiers}`; key `satis_foundry:tiers`).
- Any production fix these tests force goes in this commit with a note.
- Commit: `test(state): upload matrix, re-validation, persistence`.

## Definition of done

1. `npm test` green (existing 131 + new store tests); `npm run check` green;
   `npm run build` green.
2. Scope: `git diff` touches ONLY `src/state/**` + the log + these docs;
   zero dependency delta; core purity untouched.
3. Bidirectionality log
   `features/manifold-visualizer/phase-3/r2-verification.log` (worktree):
   per behaviour class (derive recompute, clear rule, invalid routing, upload
   matrix branch, persistence merge) — PASS → break → genuine referenced
   vitest FAIL → restore → green.
4. Two commits as named, co-author trailer
   "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>", no push, no
   merge, `develop` untouched.

## Out of scope (hard guardrails)

No UI/React components (the hook export is the only react-adjacent line);
no changes to src/core or src/data; no new deps; spec + brainstorm frozen —
contradictions are stop-and-report.

## Assumptions

- Frozen spec/brainstorm are implementation-ready (5 total design rounds).
- The save-fail injection seam is test-side only (proven in spec review
  against shipped `db.ts`).
