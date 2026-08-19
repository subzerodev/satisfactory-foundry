# Review request — #156 design (r5, scoped re-run on the r4 fix)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/extraction-panel-restructure/brainstorm-spec.md` (uncommitted, r5)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD cb194af)
**Stage:** scoped re-run after the r4 fold. r4: both reviewers NEEDS_REWORK on ONE defect (the Total-line recompute site named PackagingEditor, whose props carry none of the inputs). Fixed.

## The r4 → r5 delta to verify (scope STRICTLY to this — one relocation + bookkeeping)

1. **The Total line now computes AND renders in `ExtractionPanel`, below `<PackagingControls/>`.** Verify against `GraphCanvas.tsx`: (a) all three inputs are genuinely native to that scope (`result` from the `:357` derive, `selection`, `catalog` — and the machine-power resolution path `catalog.extractors[selection.machineId].machineId` → `catalog.machines[…].power` per `src/ui/extraction-plan.ts:97-121`); (b) the render location (below PackagingControls, when the packaging plan is ready) is coherent with the section structure A1 defines and with `packagingVisible`/`packagingPlan` in `ExtractionPanel` (`GraphCanvas.tsx:426-442`); (c) Changes item 2's rewording matches.
2. **The clock pin:** `core/clock.ts` `parseClockText(selection.clockPercentText)` — the derive's own parse (`src/ui/extraction-plan.ts:123-127`). Confirm the citation and that no divergent-parse risk remains in the spec's wording.
3. **Bookkeeping:** the stale helper-UNVERIFIED ledger line is replaced; the `src/ui/` path qualifications are fixed; the r5 revision entry is faithful to the r4 verdicts.

Settled (do not re-litigate): everything else, including the Total line's existence (recorded rejection), the purity-hide rule (r4-verified), the inline two-branch sum, the combined packaging figure, A1/A2/A4/A5, the sweep.

This is round five; the delta is one relocation the r4 reviewers themselves prescribed. If it is faithful, an honest APPROVED ends the loop — do not manufacture.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
