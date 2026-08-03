# Review request — Phase 4 spec, round 1 (manifold-visualizer arc)

Artifact: `/home/subzerodev/workspace/satisfactory-foundry/features/manifold-visualizer/phase-4/spec.md`
Worktree/repo root: `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop` @ 1694418)
Stage: DESIGN (spec). The frozen brainstorm (same dir, v2 FROZEN + revision history) is the binding design; the spec's job is to make it precisely implementable without contradicting it.

## A. Current-state anchors

- `features/manifold-visualizer/phase-4/brainstorm.md` (FROZEN v2 — the spec must conform to it).
- `src/state/store.ts` — store contract (state unions, eight actions, override cell shapes).
- `src/core/manifold.ts` — result + Finding types (exact field names/optionality).
- `src/core/fraction.ts` — `toString`, `toDecimalString(dp)` (half-up), `parse`, `eq`.
- `src/data/types.ts`, `src/data/tiers.ts` — catalog + TIER_TABLE.
- `docs/superpowers/specs/2026-08-03-manifold-visualizer-design.md` §UI/§Testing.
- `src/App.tsx`, `src/main.tsx`, `vite.config.ts`, `package.json`, `tsconfig.app.json`, `eslint.config.js`.
- `/home/subzerodev/workspace/satisfactory-planner/src/ui/screens/DocsUpload.svelte` (decode port source).
- Settled decisions: epic #2 Decisions block; the brainstorm's "Already settled" list.

## B. What to verify (the spec's load-bearing precision)

1. §2.2 formatRate algorithm: correctness of the den===1 shortcut via toString; the dp 1..4 round-trip scan against half-up rounding (can a trimmed string still parse-equal?); the `1/32` fallback row's arithmetic; every format.test row's expected value.
2. §2.2 findingText field usage vs the real `Finding` union (names, optionality — e.g. `starved-machines` partial/starvedFrom/starvedTo; `invalid-input.detail`).
3. §2.4 layout formulas: boundary-x formula shared by arrows/segments/seams (entersAfterMachine 0..N, fromMachine−1/toMachine edges); pitch clamp + scrolled predicate; labelStep arithmetic incl. the N=200 test row (`ceil(200×20/912) = 5`?) and N=2000 width; height accumulation coherence; N=0/empty-lane behavior.
4. §3 component prop contracts vs store/solver types (Selection.overrides cell access `overrides[side][itemId]?.[index] ?? ""`; valueAsNumber NaN routing to the store's bad-machine-count verdict — check store.ts derive actually verdicts NaN; CatalogRecipe fields; UploadScreen reason strings vs CatalogState).
5. §3.8 App wiring: whole-store subscription; uploadError banner + header re-upload path; init boot line; findings concatenation (stage-global ⊕ per-lane — check StageSolveResult.findings comment about where lane findings live).
6. §5 test plan feasibility in the node env with zero new deps (tsx test files under the react-jsx transform; renderToStaticMarkup assertions match what the components would emit; fixtures via raw StageInput + solveStage without a catalog — verify solveStage's input requirements allow this; the worked-example numbers: d=30, N=20, tiers [60,120,270,480] → belts [480,120], entry after 16; output breakout after 16).
7. §6 exit criteria completeness vs ticket #6 acceptance criteria.
8. Conformance: nothing contradicts the frozen brainstorm or a settled epic decision.

Verdict: APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
