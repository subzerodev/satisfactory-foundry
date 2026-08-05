# Review r1 — Stage 14 correction brainstorm v1 (tickets #74 + #75 + #76)

Artifact: /home/subzerodev/workspace/satisfactory-foundry/features/view-correction/brainstorm.md (v1, develop 0a92ced).
Worktree: /home/subzerodev/workspace/satisfactory-foundry (read-only for you). The old schematic source is at git ref `ba35744` (use `git show ba35744:src/ui/layout.ts` etc. via Bash if available; the code-reviewer without shell should verify the quoted geometry against the brainstorm's own grounded-state section and the S13 diff record in features/field-fixes-2/).

User directive (verbatim, settled, not reviewable): "no you removed the wrong one i liked the first view and dont want this combined one" — restore schematic (first/default), remove Combined, Blueprint stays.

## A. Current-state anchors (verify against live source)

- src/ui/App.tsx — ChainBlueprint import (:22) + render branch (:434); the S13 View union + .view-tab tabs; default "blueprint".
- src/ui/chain-view.ts — exports at :68-:352 (solvedStageIds, buildChainSites, buildChain, drawnDistanceDm, nearestEdgeConnector, drawnMeters, isVehicleModeLink, ChainConnector, chainConnectors, isEstimatedLink, applyDrawnDistance, ChainPowerFooter, chainTransportPower). LinkInspector.tsx:28-33 imports exactly drawnDistanceDm, drawnMeters, applyDrawnDistance, isEstimatedLink; store.test.ts:13 imports applyDrawnDistance.
- src/layout/layout.ts — layoutChain (:356) and its consumers; layoutStage (Blueprint's).
- src/ui/svg-scale.ts — local REF_W = 960 (S13), no LAYOUT import.
- The S13 deletion record: features/field-fixes-2/ (brainstorm + r2-verification.log) and the merge bafae8c.

## B. Claims/design to verify

1. **Axis A restore mechanics**: is ba35744 the right restore point (the schematic files unchanged there since S12P1)? Does the restore plan cover everything the S13 deletion removed (component, geometry module + test, CSS blocks, smoke tests) WITHOUT re-coupling svg-scale to LAYOUT? Is flipping the default to "schematic" + [SCHEMATIC | BLUEPRINT] tabs consistent with the S13 boot-test claim (its bp-svg assertion is view-independent)?
2. **Axis B partial deletion**: verify the chain-view consumer split against source — is the ChainBlueprint-only list actually consumer-free once ChainBlueprint dies (hunt for OTHER consumers of solvedStageIds/buildChain/chainConnectors/chainTransportPower — e.g. App.tsx footer, GraphCanvas, graph-flow)? Is layoutChain truly buildChain-only? Does blueprint-zoom survive correctly with one consumer? Any chain-bp CSS shared with .bp-* survivors?
3. **Axis C geometry**: verify the decoded garble mechanism (output busY = track.y + 8 vs name baseline y + 12 → crossing; feed 36px clear) against the ba35744 source / the brainstorm's quotes. Does busY + 18 clear the bus stroke, the seams (busY ± 6), belt arrows, and stay inside the 56px row? Any output-lane element between busY+7 and busY+18 the lift would newly hit? Is applying the S12 halo to .lane-name sound in the schematic's screen-space (non-dm) context?
4. **Test plan + #71 closure**: is closing #71 as resolved-by-restore legitimate (helpers regain production consumers)? Are the proposed pins real (output-name y pin + seam-clearance assertion)?
5. **Loop-done judgment**: implementable as written, or what load-bearing gap remains?

Verdict: exactly one of APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED, severity-tagged, line-cited findings.
