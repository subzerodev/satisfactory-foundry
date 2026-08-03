# Phase 1 implementation plan — src/core manifold solver (ticket #3)

Date: 2026-08-03 · Status: v1, plan dual-review pending · Branch: `feature/phase-1.0`
Spec: `features/manifold-visualizer/phase-1/spec.md` (FROZEN — the contract;
this plan adds no design, only execution order). Worktree: `.worktrees/phase-1.0/`.

## Shape

One implementation agent, one worktree, three sequential tasks, TDD per task
(tests from the spec's ten-row plan written first, then the code that greens
them). One commit per task. The agent runs `npm test` + `npm run check` green
before each commit, and produces the bidirectionality log at the end.

**Pre-impl drift hunt (mandatory first step):** verify against live source
before writing anything — `src/core/fraction.ts` exports and exact signatures
(`Fraction.of/from/parse`, `add/sub/mul/div`, `compare/eq/lt/lte/gt/gte`,
`isZero/isNegative`, `floorDiv/ceilDiv → bigint`, `floor/ceil → bigint`,
`toString/toDecimalString`); the eslint core allowlist (relative imports only);
tsconfig types. Any spec-vs-source drift found → stop and report, do not
improvise.

## Task 1 — types + solveStage skeleton + stage validation + degenerate handling

- `src/core/manifold.ts`: all exported types exactly as the spec's Types
  section (verbatim field names/semantics); `solveStage` implementing stage
  validation (the four stage-global checks → stage findings, abort with empty
  lanes) and the degenerate short-circuit (N=0 / empty / zero-rate lanes →
  empty lanes, no findings — precedes lane solve).
- `src/core/manifold.test.ts`: spec test rows 9 (degenerate incl. pipes
  capacity table) + 10 (validation reasons) + the N=0 × oversize-overrides
  precedence case.
- Lane solvers stubbed to empty results (typed, compiling) — greened in
  Tasks 2–3.
- Commit: `feat(core): manifold types, stage validation, degenerate handling`.

## Task 2 — feed lane solve

- `solveFeedLane` per the spec Behaviour section: d/D/B; infeasibility;
  combination `k = D.ceilDiv(B)` + smallest-tier remainder; overrides
  (capacity replacement by index; oversize → lane-local invalid-input, lane
  empty); entry points `floor(S/d)` on actual capacities; segments with
  `beltIndex` + `peakFlow` (= survivedIntoSpan + beltCapacity) under
  nominal-delivery head-first draw; `segment-over-capacity` (peakFlow > B);
  per-span `starved-machines` with the emission invariants (≤1 partial +
  fully-starved run).
- bigint→number index guard (shared helper; throws past MAX_SAFE_INTEGER).
- Tests: spec rows 1 (feed half), 2, 3, 4, 5 (both cases), 6, 7, 8 (feed).
- Commit: `feat(core): feed lane solver — combination, entries, segments, starvation`.

## Task 3 — output lane solve + integration

- `solveOutputLane` per the spec's output mirror: p/T; infeasibility mirror;
  break-out spans via cumulative `floor(T/p)` walk; count `ceil(N×p/T)`;
  `BreakoutBelt` (index/capacity/startsAfterMachine/load); output overrides
  (capacity by index, positions fixed); segments (peak at tail, beltIndex =
  collecting belt); `segment-over-capacity` with binding-limit `busCapacity`.
- `solveStage` wires lane mapping + findings routing (stage-global vs lane).
- Tests: row 1 output mirror; output override undersize case; full-stage
  integration asserting the complete 20-smelter `StageSolveResult` shape.
- Commit: `feat(core): output lane solver + solveStage integration`.

## Definition of done (the agent's exit gate)

1. `npm test` green (existing 70 Fraction tests + all new manifold tests);
   `npm run check` green; `npm run build` green.
2. Purity proof re-run: a temporary `import React from 'react'` in
   manifold.ts fails `check` citing the allowlist; removed; green again.
3. Bidirectionality log `features/manifold-visualizer/phase-1/r2-verification.log`
   (in the worktree): per behaviour class (combination math, entry points,
   starvation emission, over-capacity, output break-outs) — PASS → sed-break →
   genuine referenced vitest FAIL → restore → green.
4. Three commits as above, co-author trailer, no push, no merge, `develop`
   untouched.

## Out of scope (hard guardrails)

No changes to `fraction.ts`, eslint config, tsconfigs, package.json, or any
file outside `src/core/manifold.ts` + `src/core/manifold.test.ts` + the
verification log. No catalog/store/UI code. No new deps. Spec is frozen — a
contradiction found in it is a stop-and-report, not a local fix.

## Assumptions

- The spec's test-plan expectations are implementation-ready (both reviewers
  hand-verified rows 1–8 numerics during the design gate).
- Fraction API is sufficient and unchanged (re-verified in the drift hunt).
