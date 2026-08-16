# Design review r3 — S21 P3 (#105): explicit byproduct routing

Re-review `features/propose-followups/p3-brainstorm.md` in the repo at
`/home/subzerodev/workspace/satisfactory-foundry`. This is a DESIGN re-review
after r2.

This review is degraded because the third-party Claude reviewer is unavailable
by user directive. You are a fresh Codex agent copying the requested reviewer
role. Return exactly one verdict:

`APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` / `BLOCKED`

with severity-tagged, line-cited findings. Tag your verdict as
`(degraded: same-vendor, third-party reviewer unavailable)`.

## Prior r2 verdicts

- adversarial-reviewer: NEEDS_REWORK — store hard guard did not validate stale
  payloads whose source/consumer stage items still resolve but whose item lanes
  are wrong, creating dangling links.
- code-reviewer: NEEDS_REWORK — UI spec did not require routeability/display
  and Apply filtering to use the preview's solved `gated` catalog snapshot.
  Also NIT: stale-selection tests must include a source change with the same
  `(itemId,toItemId)` display row.

## v3 delta to verify

1. Store apply validation now checks every route payload against the proposal
   plus ready catalog snapshot: source proposed stage recipe outputs `itemId`;
   consumer proposed stage recipe inputs `itemId`. Unready catalog refuses
   byproduct routes while still applying normal proposal stages/links.
2. UI design now requires display decoration, routeability, and Apply filtering
   to use `preview.gated`, not live `catalog`.
3. Test plan adds stale source-output payload, stale consumer-input payload,
   same display row with changed source, and failed-re-propose-after-tier-change
   rows.

## Questions

- Do the new store guards close the dangling-link route API hole without
  weakening the append-only proposal apply behavior?
- Is using `preview.gated` sufficient and correctly scoped for route display,
  checkbox routeability, and Apply filtering?
- Are the new tests bidirectional against the r2 failures?
- Any remaining unhandled stale route case?

Do not re-litigate already-approved scope choices unless the v3 edits create a
new concrete defect.
