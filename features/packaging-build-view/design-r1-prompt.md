# Review request — #157 design (r1)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/packaging-build-view/brainstorm-spec.md` (uncommitted, r1)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD ccc90fb)
**Stage:** design review (Tier-2 merged brainstorm+spec for #157 — packaging chains join the build view + belt lane counts). #156 (extraction-panel restructure) consumes this design's outputs; it is NOT under review here.

## A. Current-state anchors (verify against live source)

- `src/core/transport.ts:50-77` — `solveContinuous` and its `runs = ceil(rate/laneRate)` claim.
- `src/ui/transport-text.ts:243-277` — `edgeChip`, the belt-null case + its comment.
- `src/core/manifold.ts:17-32,231` — `LaneInput`/`StageInput` shapes, `solveStage`.
- `src/core/link-plan.ts:40-93,102-119` — `LinkPlanLink.interstep`, `EffectiveLinkCargo`, `ReadyLinkPlan`, `derivePackagingPlan`; the pair-rate usage at :80-83.
- `src/ui/App.tsx:170-185,455-503` — the App-local `view` state and the three tabs rendering the active stage's `solve.result`.
- `src/core/machine-power.ts` — `effectiveMachinePower` / `MachinePowerProjection`.
- `src/ui/extraction-plan.ts:10-16` — `ExtractionSelection.packaging`.
- Settled decisions cited: #157 comment 24989 (Michael: own view), the #146 deferral, the #133 single-sizing-source rule, #154's 24px/pan floor.

## B. Claims/proposals to verify

1. **A1 adapter**: is `packagingStageInputs → solveStage` faithful to the solver's contracts (mixed pipe+belt feeds legal; clock semantics `d = perMachineRate × clock/100` match how `derivePackagingPlan` sized the machine counts — i.e. will the drawn manifold's demand agree with the plan's machine counts, no double-clocking)?
2. **A2 selector**: is the enumeration source (extraction `packaging` + link `interstep`) complete — any third place a packaging chain can live? Is App-local subject state sound given the store precedent cited?
3. **A4 belt chip**: verify the change is one case in `edgeChip` and that `runs`/`laneRate` genuinely exist on every continuous belt plan reaching it (all `edgeChip` call sites); flag any call site where a belt plan could carry a degenerate `laneRate`.
4. **The deleted-behaviour sweep**: is the grep token set sufficient for every pin on the belt-no-chip behavior? Run it yourself; name anything it misses.
5. **Assumptions ledger**: the unpackage-side pair field names are declared UNVERIFIED with a drift-hunt gate — acceptable, or must the spec resolve them now?
6. Research-gate / grounding: any fork resolved by assumption that needs research or user input instead? Any citation that does not resolve?

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
