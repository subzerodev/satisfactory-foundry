# Design review r4 — S21 P3 (#105): explicit byproduct routing

Re-review `features/propose-followups/p3-brainstorm.md` in the repo at
`/home/subzerodev/workspace/satisfactory-foundry`. This is a DESIGN re-review
after r3.

This review is degraded because the third-party Claude reviewer is unavailable
by user directive. You are a fresh Codex agent copying the requested reviewer
role. Return exactly one verdict:

`APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` / `BLOCKED`

with severity-tagged, line-cited findings. Tag your verdict as
`(degraded: same-vendor, third-party reviewer unavailable)`.

## Prior r3 verdicts

- code-reviewer: APPROVED.
- adversarial-reviewer: NEEDS_REWORK — store route validation world was
  ambiguous because `preview.gated` lives in `ChainBuilder`, while the store
  slice only has the live catalog. A valid implementation could accidentally
  validate route payloads against the wrong catalog.

## v4 delta to verify

1. `applyChainProposal` gains an options bag:
   `{ clockPercentText?: string; byproductRoutes?: ProposedByproductRoute[];
catalog?: Catalog }`.
2. Legacy `applyChainProposal(proposal, "150")` remains supported for clock-only
   callers.
3. When byproduct routes are present, the UI passes
   `{ clockPercentText: preview.clockText, byproductRoutes, catalog:
preview.gated }`.
4. The store validates routes only against the explicit catalog snapshot. Missing
   catalog snapshot refuses all byproduct routes while still applying primary
   proposal stages/links. Store validation against the live catalog slice is out
   of scope/forbidden.

## Questions

- Does the options-bag contract remove the r3 ambiguity completely?
- Does it preserve existing clock-only/default apply behavior?
- Is the "missing catalog refuses routes" fallback total and non-surprising?
- Any new API-shape or test-plan gap introduced by the options bag?

Do not re-litigate already-approved scope choices unless the v4 edits create a
new concrete defect.
