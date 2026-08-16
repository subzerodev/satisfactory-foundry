# Design review r5 — S21 P3 (#105): simplify-fold re-review

Re-review `features/propose-followups/p3-brainstorm.md` in the repo at
`/home/subzerodev/workspace/satisfactory-foundry`. This is a correctness
re-review after the one-shot simplify pass was folded.

This review is degraded because the third-party Claude reviewer is unavailable
by user directive. You are a fresh Codex agent copying the requested reviewer
role. Return exactly one verdict:

`APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` / `BLOCKED`

with severity-tagged, line-cited findings. Tag your verdict as
`(degraded: same-vendor, third-party reviewer unavailable)`.

## Prior state

Correctness converged at r4 APPROVED_WITH_NITS ×2. The one-shot simplify pass
then found two simplifications, both folded. Do not rerun simplify.

## v5 delta to verify

1. Source fan-out is no longer first-wins. If one source byproduct can feed
   multiple proposed consumers, all those rows stay display-only.
2. `applyChainProposal` no longer supports the legacy positional clock string.
   It takes `(proposal, options: ApplyChainProposalOptions = {})`, where
   `clockPercentText` defaults to `"100"` inside the store implementation.
   Current callers/tests will be updated to pass `{ clockPercentText: "150" }`
   for non-default clocks.
3. Route validation still uses explicit `catalog: preview.gated`, refuses
   routes without catalog, validates source outputs and consumer inputs, refuses
   duplicate target lanes, self-routes, and repeated source spending.

## Questions

- Does suppress-all source fan-out preserve correctness and simplify the
  previously approved source-spending contract?
- Does the single options-bag API preserve existing default and non-default
  clock behavior without introducing an API ambiguity?
- Are tests specified for the migrated options-bag clock path and missing-catalog
  route fallback?

Do not re-litigate already-approved scope choices unless the v5 simplification
creates a new concrete defect.
