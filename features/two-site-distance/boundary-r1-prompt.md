# Boundary review r1 — Stage 17 (#89): two-site drawn distance + chain-engine retirement

Review the CUMULATIVE implementation diff for Stage 17 against its frozen design
contract. Worktree (absolute path, review against THIS tree):
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/two-site`

The diff (develop...HEAD, 3 commits) is at:
`/home/subzerodev/workspace/satisfactory-foundry/features/two-site-distance/boundary-r1.diff`

## A. Current-state anchors (verify against live source in the worktree)

- Frozen contract: `features/two-site-distance/brainstorm.md` (v3 FROZEN 2026-08-06).
  The diff must implement THIS, no more, no less.
- `src/ui/chain-view.ts` — drawnDistanceDm must now be: resolve link → both
  endpoint stages solved (else null) → private siteFor(stage) per endpoint
  (recipeId → machineId → layoutStage) → k = requiredScaleForPair(posA, layoutA,
  posB, layoutB) → boxes {x: pos.x×k, y: pos.y×k, w: cols×FOUNDATION_TILE,
  h: rows×FOUNDATION_TILE} (NO origin term, NO grid rounding) →
  nearestEdgeConnector(boxA, boxB).distanceDm. 6-arg signature preserved
  (LinkInspector.tsx:145-152 caller unchanged); `stageOrder` → `_stageOrder`
  (noUnusedParameters is on).
- `src/layout/layout.ts` — requiredScaleForPair is the TOTAL primitive (per-axis
  `dx > 0 ? … : Infinity` guards, K_MIN on all-Infinity): there must be NO
  coincident special case anywhere in the new code. Its old step-1-invariant
  comments (formerly ~:498-500 and ~:388) must be REWRITTEN to state coincident
  input is a SUPPORTED case yielding K_MIN — not a can't-happen. ceilTo10 and
  layoutStage must survive (layoutStage pitch uses ceilTo10).
- RETIRED (must be fully gone, zero live references): layoutChain, fanCoincident,
  the K max-over-pairs loop, chain grid-rounding, ChainLayout/ChainArrangement/
  ChainSite/ChainPlacement, buildChain, buildChainSites, solvedStageIds,
  siteWorldBox, and their test blocks including the S15 three-stage coupling pin
  (chain-view.test.ts, formerly :197-240).
- KEPT surface (must be untouched in behavior): nearestEdgeConnector, drawnMeters,
  applyDrawnDistance, isEstimatedLink, layoutStage, siteBox, and all S12–S16 pins.
- `tsconfig.app.json:23` — noUnusedLocals + noUnusedParameters true; the deletion
  sweep must leave no unused residue.

## B. Diffs/claims to verify

1. The diff at the path above (960 lines). Verify each hunk against the contract
   and the anchors — flag any special-casing, rounding, origin terms, retained
   dead code, or retired-name references that survive.
2. Claim: four new pins in `src/ui/chain-view.test.ts`:
   - DECOUPLING: A=(0,0), B=(100,0), C smelters — A↔B identical (80dm) for
     C=(0,300) and C=(50,5). The old engine gave 80 vs 240. Verify the fixture
     actually exercises the decoupling (C must have mattered under the old code).
   - Pair value: A=(0,0), B=(80,60), k=2 → 40√10 ≈ 126.49 dm — verify the
     expected value is derived, fractional-dm aware, not a round-number assumption.
   - Coincident: same position → 0dm with NO special-case code path.
   - FLOOR: A=(0,0), B=(1,0) → exactly CHAIN_GUTTER (80dm) EDGE distance —
     verify the pin measures edge distance, not the 160dm origin separation.
3. Claim: bidirectionality log at
   `features/two-site-distance/r2-verification.log` (in the worktree). Confirm it
   exists and contains, per distinct behavior, a genuine framework FAIL line
   (vitest ×/FAIL) captured with the production code broken, referencing the
   diff's test names, then a restore + green re-run. NEEDS_REWORK if missing or
   if any FAIL is not genuine.
4. Claim: full suite 764/764 green in-worktree, npm run check clean, only the
   four source/test files + the log touched, S12–S16 pins unchurned.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings.
