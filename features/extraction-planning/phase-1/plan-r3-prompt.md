# #112 Phase 1 implementation-plan review r3

Review `features/extraction-planning/phase-1/implementation-plan.md` in:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-112-extraction-p1-design`.

R2 returned `NEEDS_REWORK` / `NEEDS_REWORK`. R3 folds every finding:

1. The required-catalog-literal scan covers both TS and TSX.
2. DOM interactions live in a new `.dom.test.tsx` with an explicit jsdom pragma,
   real `createRoot`/`act`, deterministic store reset, and cleanup.
3. Opening raw B while A is open must replace A, keep final focus in B, and not
   run A's close-focus restoration.
4. The Chromium harness imports the exact production stack/panel units consumed
   by GraphCanvas and renders real React Flow Panel/Controls/control chrome.
5. The harness forces and first asserts a measured 340px canvas, then checks all
   six notice/extraction/combined x 360/720 geometry rows.

Recheck the full plan against frozen r6 and live source. Return line-cited
BLOCKER/IMPORTANT/NIT findings and exactly one verdict: `APPROVED`,
`APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
