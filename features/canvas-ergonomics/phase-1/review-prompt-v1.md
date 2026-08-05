# Review request — Stage 10 / P1 brainstorm v1 (resizable canvas + flow direction)

Artifact: `/home/subzerodev/workspace/satisfactory-foundry/features/canvas-ergonomics/phase-1/brainstorm.md`
Worktree: `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`)

## A. Current-state anchors (verify against live source)

- `src/ui/app.css` :785-797 — `.graph-canvas` (340px, overflow hidden, border-radius 6px)
- `src/ui/GraphCanvas.tsx` :93-94 (Handle left/right), :328-354 (onNodesChange / drag-END commit), :488-492 (top-left Panel with ＋ stage), :469-483 (ReactFlow props)
- `src/ui/graph-flow.ts` :35-36 (NODE_WIDTH 220 / NODE_HEIGHT 96), :154-176 (stageHandles left/right)
- `src/state/store.ts` :185-197 (positions + placementSeq), :588-653 (rebuildFromPlan), :690-769 (applyProposalToSlice), :782-788 (placementSlot), :944-947 (seed), :1256-1262 (addStage placement), :1404-1410 (setStagePosition)
- `src/data/plan-store.ts` :1-24 (version posture incl. the v4 bump rationale), :37-120 (V1–V4 shapes)
- `node_modules/@xyflow/react/dist/esm/index.mjs` :1273 (ResizeObserver → updateDimensions); `node_modules/@xyflow/system/dist/esm/index.mjs` :2917
- Stage 9/10 records: `features/drawing-identity/FEATURE.md`, `features/canvas-ergonomics/FEATURE.md`, `features/canvas-ergonomics/phase-0/brainstorm.md` (the P0 base-rule decisions bind)

## B. Claims/design to verify

The brainstorm's five axes:

1. CSS-only resize seam: height 560px default, `resize: vertical`, min 340 / max 85vh, radius-0 fold; RF tracks via ResizeObserver; no persistence of size.
2. `flowDirection: "LR"|"TB"` on the store graph slice, persisted per-plan via a plan-file **v5 bump** (not v4-in-place; not app-level localStorage) — check the stated rationale against the recorded v4 precedent.
3. Mechanics: both handle sites take direction; `graphToFlow` gains the param; StageNode reads the store; `placementSlot(seq, dir)` transpose; three call sites + rebuild fallback thread it; `setFlowDirection` re-slots only non-`userPlaced` stages by stageOrder index; `userPlaced` set on drag-END, pruned on remove, NOT persisted (loaded positions count as user-placed).
4. Direction toggle button in the canvas top-left Panel next to ＋ stage, base P0 button look.
5. Non-goals as listed.

Review for: correctness of every citation, unstated regressions (RF semi-controlled resync model — does the direction switch's bulk position write interact safely with the derive/merge in GraphCanvas.tsx:297-326?), the v5-vs-v4-vs-app-level fork, the userPlaced semantics (especially across save/load), test-plan honesty, and conflicts with settled Stage 9/10 decisions.

Verdict: one of APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED, with severity-tagged line-cited findings.
