# Review request — Stage 10 / P1 brainstorm v2 (r2, scoped to the r1 folds + coherence)

Artifact: `/home/subzerodev/workspace/satisfactory-foundry/features/canvas-ergonomics/phase-1/brainstorm.md` (now v2)
Worktree: `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`)

r1 ran on v1: both reviewers NEEDS_REWORK, zero contradictions. Six findings were folded into v2 (see the artifact's Revision history). This r2 verifies the folds land correctly and the artifact stays coherent.

## A. Current-state anchors

Same as r1 (`review-prompt-v1.md` §A) plus:
- `node_modules/@xyflow/react/dist/esm/index.mjs` :3328 (`fitViewQueued: fitView ?? false`), :3407 (single consumption) — the fitView-is-initial-only claim
- `node_modules/@xyflow/react/dist/base.css` :66-69 (absolute pane)
- `src/ui/GraphCanvas.tsx` :239-247 (the `derived` useMemo deps), :493-497 (bottom-right power Panel)
- `src/data/plan-store.ts` :392-438 (version-exact validators)

## B. The six folds to verify

1. `flowDirection` joins the `derived` useMemo deps AND becomes a `graphToFlow` arg (stale-handleBounds fix on the loaded-plan toggle path).
2. Call sites corrected to FOUR incl. the :627 rebuild fallback; addStage cite :1260.
3. fitView effect: a child inside the RF tree runs `useReactFlow().fitView()` keyed on `flowDirection`. Is the effect-after-commit timing sound (does RF's internal node store hold the re-slotted positions by the time the effect fires)? Is assumption 8 (useReactFlow inside `<ReactFlow>`'s implicit provider) correct for RF 12.11.2?
4. Grip-occlusion: named + mitigated (power-panel corner inset; walk asserts a real drag; escalation fallback recorded). Is the mitigation coherent, or does it need more at design level?
5. `userPlaced` seeded by `rebuildFromPlan` from `entry.position !== undefined`; drag-END set; remove prune; not persisted. Check the semantics are now complete and implementable (no remaining unrecoverable-distinction hole).
6. Test-plan + ledger updates (grip-drag assert, fitView assert, seeding test, ledger items 7-8).

Also: re-check overall internal consistency of v2 (the folds touched Axes 1 and 3, the test plan, and the ledger — no contradiction introduced).

Verdict: one of APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED, with severity-tagged line-cited findings.
