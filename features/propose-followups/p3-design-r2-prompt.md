# Design review r2 — S21 P3 (#105): explicit byproduct routing

Re-review `features/propose-followups/p3-brainstorm.md` in the repo at
`/home/subzerodev/workspace/satisfactory-foundry`. This is a DESIGN re-review
after r1.

This review is degraded because the third-party Claude reviewer is unavailable
by user directive. You are a fresh Codex agent copying the requested reviewer
role. Return exactly one verdict:

`APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` / `BLOCKED`

with severity-tagged, line-cited findings. Tag your verdict as
`(degraded: same-vendor, third-party reviewer unavailable)`.

## Prior r1 verdicts

- code-reviewer: NEEDS_REWORK — one byproduct source could be checked into
  multiple consumers, double-counting the same source output under per-link
  reconciliation.
- adversarial-reviewer: APPROVED_WITH_NITS — stable key unspecified; store guard
  tests missing unresolved/self route payload rows.

## v2 delta to verify

1. Routeability now spends each source output `(fromItemId,itemId)` once:
   if one byproduct source could feed two consumers, only the first
   deterministic consumer row is routeable and the later rows stay display-only.
   The store apply hard guard also tracks spent `(fromStageId,itemId)` and
   accepts only the first selected route from that source output.
2. Stable route key is explicitly `(fromItemId,itemId,toItemId)`.
3. Test plan now includes source fan-out suppression, full route keys, unresolved
   payload filtering, self-route filtering, and store-level source fan-out
   filtering.

## Questions

- Does the v2 source-spending rule close the double-counting gap without
  creating a new misleading behavior?
- Does this interact correctly with the existing primary-lane collision and
  multi-source aggregate suppressions?
- Are stale route selections now total across source changes?
- Is the test plan bidirectional enough for the v2 fold?

Do not re-litigate P2 display-only routing or the demand-feedback deferral
unless the v2 edits create a new concrete defect.
