# Boundary review — Stage 10 / P1 cumulative diff (resizable canvas + flow direction, ticket #51)

Worktree: `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/canvas-p1` (branch feature/canvas-p1, 6 commits over develop)
Diff: `features/canvas-ergonomics/phase-1/boundary.diff` (cumulative `git diff develop...HEAD`, 1797 lines) — in the worktree
Frozen spec: `features/canvas-ergonomics/phase-1/brainstorm.md` (v3 FROZEN — the authoritative design incl. test plan + assumptions ledger)

## A. Current-state anchors

The worktree source is the artifact: src/state/store.ts, src/data/plan-store.ts, src/ui/graph-flow.ts, src/ui/GraphCanvas.tsx, src/ui/app.css, and all test files. Compare against the develop base where useful (`git show develop:src/...`).

## B. What to verify

1. **Spec conformance** — every frozen pick implemented as designed: CSS seam (560px/min 340/max 85vh/resize vertical/radius 0, power-panel grip inset); store `flowDirection` + `userPlaced` semantics (switch re-slots ONLY non-userPlaced by order index, pure write, never marks; drag-END marks; remove prunes; four placementSlot sites direction-threaded incl. the :627 rebuild fallback using the FILE's direction); plan-file v5 (top-level flowDirection + per-stage `userPlaced?: true`, save unconditional positions + flag-only-when-set, migrateV4 identity+LR, version-exact validator, header rationale); graph-flow direction-aware `stageHandles` + `graphToFlow` param; GraphCanvas memo dep (flowDirection in the `derived` deps — load-bearing), StageNode Handle sides, toggle button in top-left Panel, fitView effect child (skip initial mount).
2. **The implementer's one plumbing addition (scrutinize hardest):** `loadPlanWithOrigin` + a `v5Native` boolean threaded into `rebuildFromPlan`, because after `migrateV4` an all-auto v5 file and a positioned pre-v5 file are byte-identical yet must seed `userPlaced` differently (v5 → from flags; pre-v5 → position-presence). Is this correct, minimal, and consistent with the spec's seeding rule? Any path that loads a plan WITHOUT threading the origin (import/export, rename-persist, list/load UI paths) and therefore seeds wrongly?
3. **Test bidirectionality** — `features/canvas-ergonomics/phase-1/r2-verification.log` must exist and contain, per distinct new production behavior, a genuine vitest FAIL line (captured with the production code reverted/broken) naming the diff's new tests, plus the restore + green re-run. NEEDS_REWORK if missing or no genuine FAIL.
4. **Churned pins** — 6 enumerated (v4→v5 bumps in plan-store.test.ts + store.test.ts; "unknown format_version" 5→6). Verify each is honest version-bump churn mirroring the recorded v3→v4 precedent, not weakened coverage.
5. **Regressions** — the RF semi-controlled resync model untouched in spirit; no behavior change to links/solve/reconciliation/transport; layer rules (src/core untouched); comment idiom (why-comments, matching density); no stray scope.

Verdict: one of APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED, with severity-tagged file:line-cited findings.
