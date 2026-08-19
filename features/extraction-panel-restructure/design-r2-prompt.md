# Review request — #156 design (r2)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/extraction-panel-restructure/brainstorm-spec.md` (uncommitted, r2)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD cb194af)
**Stage:** design re-review after fold. r1: code-reviewer NEEDS_REWORK (2 IMPORTANT + 5 NIT); adversarial APPROVED_WITH_NITS (3 low). All folded.

## The r1 → r2 delta to verify (scope to this — six folds)

1. **The widened sweep** (`packager|unpackager|package ·|unpackage|/min packaged|empty containers|forward|return`) + the full known-now list (GraphCanvas :782 re-derive with the substring-change note; LinkInspector :286-287 and :289-290 re-derive; :291-292 advisory KEEPs; smoke clear). Run the new grep yourself over the three files — is every hit now covered by a disposition, and are the KEEPs right?
2. **A1 disambiguation**: the checkbox `<label>` + span stays structurally intact, styled as the section head — verify against `GraphCanvas.tsx:695-703` that this yields no duplicate text and no orphaned checkbox, and that the NEW "Extraction" label (a separate element) has no equivalent ambiguity.
3. **The routeSummary lift**: private at `GraphCanvas.tsx:840-847` → exported from transport-text.ts, both call sites consume it. Any consumer/test of the current private function whose behavior could change from the move (it shouldn't — pure move), and is transport-text.ts the right home (it owns edgeChip/routeEdgeChip)?
4. **A3 bounds contract**: total drops `variableBoundsMw` (chainPowerText precedent, `advice.ts:133-140`) while per-group lines keep theirs — coherent and implementable?
5. **A4**: the pointer now names the DRAWING selector (`App.tsx:675-677,257,272`) — accurate?
6. **The citation fix** (:840-847) — resolves?

Settled at r1 (do not re-litigate): the A1-A5 shapes themselves, the strip's prop sufficiency (demand-derived figures), the "—" fallback, the canisters-in-circulation exclusion, the no-sum-helper finding.

This is round two; the delta is six folds. If they are faithful, an honest APPROVED ends the loop — do not manufacture.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
