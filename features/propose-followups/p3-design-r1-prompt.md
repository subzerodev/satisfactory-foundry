# Design review r1 — S21 P3 (#105): explicit byproduct routing

Review `features/propose-followups/p3-brainstorm.md` in the repo at
`/home/subzerodev/workspace/satisfactory-foundry`. This is a DESIGN review; no
implementation diff exists yet.

This review is degraded because the third-party Claude reviewer is unavailable
by user directive. You are a fresh Codex agent copying the requested reviewer
role. Return exactly one verdict:

`APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` / `BLOCKED`

with severity-tagged, line-cited findings.

## Required context

The P2 design of record is
`features/propose-grows-up/p2-brainstorm.md`, especially Axis 4 and the revision
history. P2 removed ROUTE after r1 reviewers found:

1. duplicate `(toStageId,itemId)` lanes could enter through
   `applyProposalToSlice`, unlike `addLink`/`canLink`;
2. per-link reconciliation could produce contested partial-supply findings;
3. stale ROUTE-toggle semantics were unspecified;
4. demand-feedback semantics were not designed.

## Live source anchors to verify

- `src/core/chain-builder.ts:77-82`, `:350-357` — proposal byproducts currently
  lack source identity.
- `src/ui/chain-builder-adapter.ts:861-894` — display suggestions aggregate by
  item before matching consumers.
- `src/state/store.ts:875-902` — proposal apply maps primary links then appends.
- `src/state/store.ts:949-960`, `:1615-1628` — public graph duplicate/self
  refusal.
- `src/state/store.ts:609-624` and `src/core/reconcile.ts:50-78` — per-link
  reconciliation.
- `src/ui/ChainBuilder.tsx:103-132`, `:275-284` — preview snapshots and current
  apply call.

## Questions to pressure-test

1. Is widening `ChainProposal.byproducts` with `fromItemId` the right minimal
   source-identity move, or does it create unnecessary churn compared with
   re-deriving sources in the adapter?
2. Does the "routeable only when single-source, no primary collision, no self
   route" rule fully protect the store's one-feed-lane invariant?
3. Is the partial-supply decision coherent: route means "send this byproduct
   lane", and existing under/over reconciliation remains a diagnostic?
4. Is deferring byproduct demand feedback explicit enough, or does the proposed
   behavior become misleading without it?
5. Are stale route toggles total across re-proposes and Apply?
6. Are the tests sufficient and bidirectional, especially the duplicate-lane
   refusal and stale-selection rows?

Tag your verdict as `(degraded: same-vendor, third-party reviewer unavailable)`.
