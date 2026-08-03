# Design review — Phase 1 brainstorm: src/core manifold solver (ticket #3, epic #2)

Review the brainstorm at
`/home/subzerodev/workspace/satisfactory-foundry/features/manifold-visualizer/phase-1/brainstorm.md`
(worktree root: `/home/subzerodev/workspace/satisfactory-foundry`).

This is a **design-stage** review of a Tier-3 phase brainstorm (axes + picks;
the spec comes next). Return exactly one verdict — APPROVED /
APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED — with severity-tagged
(BLOCKER / IMPORTANT / NIT), line-cited findings.

## A. Current-state anchors (verify against live source)

- **The frozen v1 feature spec** (authoritative math):
  `/home/subzerodev/workspace/satisfactory-foundry/docs/superpowers/specs/2026-08-03-manifold-visualizer-design.md`
  — §Core math (feed steps 1–6, output mirror), §Validation and edge cases,
  §Growth path. The brainstorm must not contradict or re-open it.
- **The live Fraction API**:
  `/home/subzerodev/workspace/satisfactory-foundry/src/core/fraction.ts` —
  verify the brainstorm's "Fraction API suffices" claim (signatures of
  `ceilDiv`/`floorDiv`, `mul`, comparisons) against actual source.
- **Stage 0 spec** boundary constraints:
  `docs/superpowers/specs/2026-08-03-stage0-bootstrap-design.md` (capacities
  lift to Fraction; floorDiv/ceilDiv are Fraction ÷ Fraction → bigint).
- Board decisions (mirrored in the brainstorm's "Already settled" list and
  epic #2's Decisions block, quoted in
  `features/manifold-visualizer/FEATURE.md`).

## B. Claims to verify

1. **Settled-list fidelity** — the "Already settled" list faithfully mirrors
   the v1 spec + epic decisions; nothing settled is re-opened; nothing
   presented as settled is actually new.
2. **Axis picks are sound and sufficient** — entry-point shape, clock
   application, input/result/finding types, module layout. Would any pick
   structurally block the growth path (chained stages compose StageInputs;
   physical-layout layer consumes the same solve result)?
3. **The Phase 2 contract is complete** — is `StageInput` sufficient for the
   parser/catalog to target without core changes? Anything missing that the
   v1 spec's UI section will need from the result types (e.g. what the
   schematic renders: entry arrows, segment colors/hover flows, break-out
   arrows, summary cards' totals + belt counts)?
4. **Semantics precision** — entry `entersAfterMachine: 0 = head`; 1-based
   segment spans; the exact-boundary rule; ascending-capacities precondition
   (validate vs sort); bigint→number index guard. Any ambiguity or off-by-one
   trap the spec stage must pin?
5. **Findings variants** — do the four listed cover the v1 spec's validation
   section, or is something missing (e.g. override-induced segment overflow is
   segment-over-capacity — is starvation reported per the spec's "naming the
   exact machines and shortfall amounts"?)?
6. **Assumptions ledger** — each assumption grounded as claimed.

Scope guard: Phase 1 only — no catalog/store/UI design; flag scope creep
either direction.
