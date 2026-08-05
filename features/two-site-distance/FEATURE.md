# Two-site drawn distance: the chain engine retires (Stage 17 arc)

**Started:** 2026-08-05
**Status:** SHIPPED 2026-08-06
**Current phase:** — (arc closed)
**Ticket:** #89 (board #21, Stage 17 milestone 88; decided by Michael on #81)

## Phase status

- Single-cycle arc COMPLETE (merged 2026-08-06, `9c6c178`, net −285
  lines, 764 tests). Design: brainstorm v3 FROZEN after THREE
  correctness rounds — r1 killed the false coincident-guard premise
  (requiredScaleForPair is already total) and the siteWorldBox
  local-origin mischaracterization, r2 caught the floor 2× mislabel
  (the pin measures edge distance = CHAIN_GUTTER 80dm, not the
  160dm origin separation); simplify folded the stale step-1-
  invariant comment rewrite into the retirement, the _stageOrder
  retention REJECTED-with-rationale. Implementation: 3 commits,
  zero drift; drawnDistanceDm = siteFor per endpoint → pairwise
  requiredScaleForPair → unrounded boxes → nearestEdgeConnector;
  layoutChain/fanCoincident/K-loop/chain types/buildChain/
  buildChainSites/solvedStageIds/siteWorldBox retired. Four pins:
  decoupling (A↔B 80dm identical for both C positions — old engine
  gave 80 vs 240), pair value 40√10 ≈ 126.49dm (fractional),
  coincident 0dm (falls out of the total primitive), floor =
  CHAIN_GUTTER 80dm exact. Boundary: r1 APPROVED + APPROVED
  first-round; diff-simplify APPROVED_WITH_NITS (2 orphaned exports
  → folded e592545); r2 fold pair APPROVED + APPROVED. Walk:
  Computer chain — moving the unrelated Plastic stage left the
  Cable→Computer readout at 22 m (the decoupling, live), moving the
  Cable endpoint changed it 22→51 m; both DWG + VELLUM.

## Decisions log

- 2026-08-05 (#81, Michael): "Yes, simplify it" — drawn distance
  becomes a pure two-site measure; supersedes the S15 keep on #77.
- 2026-08-06 (freeze): no coincident special case anywhere — the
  total primitive yields 0dm naturally; boxes carry no origin term
  and no grid rounding; near-coincident floors at CHAIN_GUTTER edge
  distance (axis-aligned), exact-coincident snaps to 0.
- 2026-08-06 (simplify fold): CHAIN_GUTTER + FOUNDATION_TILE
  de-exported — after the retirement neither crosses a module
  boundary; their consumer-naming comments were asserting a
  coupling that does not exist.
