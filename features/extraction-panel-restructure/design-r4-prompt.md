# Review request — #156 design (r4, scoped re-run on the simplify folds)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/extraction-panel-restructure/brainstorm-spec.md` (uncommitted, r4)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD cb194af)
**Stage:** scoped correctness re-run after the simplify-pass folds. r2 correctness: converged (APPROVED + APPROVED_WITH_NITS folded). Simplify: NEEDS_REWORK advisory (2 findings), dispositioned — one folded fully, one folded-in-part/rejected-in-part (the rejection rationale is a user-facing commitment; do not re-litigate the rejection itself).

## The r3 → r4 delta to verify (scope STRICTLY to the A3 rewrite + Changes item 5)

1. **The combined-figure fold:** the figures block now shows `plan.power` via `packagingPowerText` only (no per-group packaging power). Verify this matches what the plan exposes (`link-plan.ts:63,181-185`) and leaves no dangling per-group reference elsewhere in the spec.
2. **The Total line's new shape:** computed locally in `PackagingEditor`'s scope — baseline projection via the existing `machinePowerProjection` (catalog machine power + `result.count` + the extractor clock) + `plan.power`, inline two-branch sum (exact+exact → exact; else ≈ float; bounds dropped). Verify: (a) the claimed inputs are genuinely reachable in that scope (`GraphCanvas.tsx` — the PackagingEditor/ExtractionPanel component tree: catalog, selection, result); (b) the clock the baseline used is recoverable there without re-parsing drift (how does `deriveExtractionPlan` parse the clock, and can the panel reuse the same parse — `extraction-plan.ts`); (c) no derive signature changes anywhere (A1's promise); (d) the purity-mix hide rule is well-defined against the purity states (`result.purity` / `selection.purityMix`).
3. **Changes item 5 rewrite** (helper cut): coherent with A3; no orphaned references to the helper or its unit tests remain.

Settled (do not re-litigate): everything else — A1/A2/A4/A5, the strip, the sweep map incl. the mw token, the routeSummary lift, the Total line's EXISTENCE (user-facing commitment, rejection recorded).

This is a scoped round on one section's rewrite. If it is faithful and implementable, an honest APPROVED ends the loop — do not manufacture.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
