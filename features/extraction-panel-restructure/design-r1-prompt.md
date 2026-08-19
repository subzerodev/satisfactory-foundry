# Review request — #156 design (r1)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/extraction-panel-restructure/brainstorm-spec.md` (uncommitted, r1)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD cb194af — #157 is MERGED; review against this base)
**Stage:** design review (Tier-2 merged brainstorm+spec for #156 — the extraction panel's packaging block gets a chain visual + structured info; LinkInspector mirrors).

## A. Current-state anchors (verify against live source)

- `src/ui/GraphCanvas.tsx` — the `PackagingEditor` result block (machines/rates/routes prose lines) and `routeSummary` (post-#157 it surfaces belt counts via `edgeChip`).
- `src/ui/LinkInspector.tsx:209-214,269-278` — the interstep editor region.
- `src/core/link-plan.ts:48-66` — `EffectiveLinkCargo`/`ReadyLinkPlan` fields the strip consumes.
- `src/core/machine-power.ts:11-21,55` — `MachinePowerProjection`, `machinePowerProjection`.
- `src/ui/app.css:1422-1431` — `.extraction-panel` width/type.
- Settled: the #156 c24987 split (panel = numbers + compact visual; drawing = #157), #133 single-sizing-source, the landed #157 surfaces.

## B. Claims/proposals to verify

1. **A2 the shared strip**: are the props it needs (plan figures, endpoint labels, route texts) genuinely sufficient for BOTH call sites (extraction + link interstep) — anything the link case needs that the extraction case lacks or vice versa (e.g. the link case's materialSupply vs materialDemand asymmetry, `link-plan.ts:48-56`)? Is "—" for unsized plans the right honest fallback given how `deriveExtractionPackagingPlan`/`deriveLinkPlan` surface partial states?
2. **A3 total power**: is summing two `MachinePowerProjection`s with exact/estimated rules well-defined against the live type (variableBoundsMw handling — sum them or drop them?); does a sum helper already exist anywhere (grep)?
3. **A2 route texts**: does `routeSummary` (GraphCanvas) have an equivalent in LinkInspector's interstep block, or does the strip need its own route-text derivation for the link case — and does the spec account for that?
4. **The sweep**: run the spec's grep over the two DOM test files + smoke — is the "re-derive onto the strip markup" disposition complete, or do pins exist the token set misses (run wider greps if suspicious)?
5. **A1/A4**: any correctness concern in section labels replacing the toggle heading (aria semantics of the existing checkbox label) or the static pointer line (does the #157 subject-selector label text it references match what #157 actually renders)?
6. Grounding: every citation resolves; no fork resolved by assumption that needs research or the user.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
