# Boundary diff review r5 — S21 P3 (#105): self/multi-source interaction fold

Re-review the cumulative implementation diff in
`features/propose-followups/p3-boundary-r5.diff` for the worktree
`/home/subzerodev/workspace/satisfactory-foundry`.

This review is degraded because the third-party Claude reviewer is unavailable
by user directive. You are a fresh Codex agent copying the requested reviewer
role. Return exactly one verdict:

`APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` / `BLOCKED`

with severity-tagged, line-cited findings. Tag your verdict as
`(degraded: same-vendor, third-party reviewer unavailable)`.

## Prior r4 verdicts

- code-reviewer: APPROVED — no findings.
- adversarial-reviewer: NEEDS_REWORK — self-route candidates were removed
  before multi-source ambiguity counts, so a self emitter plus a second emitter
  could expose the second as a false single-source route.

## r5 fold to verify

1. `byproductRouteSuggestions` now builds/counts self candidates with every
   other source candidate, then filters `fromItemId === toItemId` from the final
   eligible set. This preserves direct self suppression while making the self
   emitter contribute to `(itemId,toItemId)` ambiguity.
2. The new adapter test models a Silica stage that consumes and emits Water plus
   an Aluminum Scrap stage that also emits Water. Before the production fold it
   failed by exposing `scrap water silica`; afterward the helper returns no
   route.
3. The prior direct self, ordinary multi-source, source fan-out, and primary
   collision tests remain green.

## Review focus

- Confirm the r4 interaction is fixed without weakening another suppression
  invariant.
- Check whether counting self candidates before final filtering has any
  unintended source-fan-out or display-collision consequence.
- Re-check the cumulative implementation against the frozen design and #105.
