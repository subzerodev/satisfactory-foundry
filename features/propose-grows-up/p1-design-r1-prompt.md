# Design review r1 — S20 P1 (#100): Propose customization core

Review the merged brainstorm+spec at
`/home/subzerodev/workspace/satisfactory-foundry/features/propose-grows-up/p1-brainstorm.md`
against the live repo at `/home/subzerodev/workspace/satisfactory-foundry`
(develop, P0 merged).

## A. Current-state anchors (verify against live source)

- `src/core/chain-builder.ts` — `proposeChain(target, rate, recipes,
  excludedMachineIds, overrides = new Map())` (:170-176); selectProducer's
  override-first validate-and-fall-back (:101-130); the DFS cycle guard
  demoting revisited producers to raw (~:201-247).
- `src/ui/chain-builder-adapter.ts` — `proposeChainForCatalog` (:42-53,
  passes EXCLUDED_MACHINE_IDS, no overrides); `candidateRecipesFor`
  (:288-303, module-constant exclusions INTERNALLY at :292);
  `EXCLUDED_MACHINE_IDS` (:27); P0's PreviewRow.candidateCount + chip.
- `src/ui/ChainBuilder.tsx` — component-local preview; Apply clears it
  (frozen ephemeral posture); AltCompare consumes candidateRecipesFor.
- Epic #98: P1 scope = picker + treat-as-raw + exclusions; persistence
  is P3.

## B. Claims / choices to verify

1. **Axis 1:** the rawItemIds core param — is the closure-walk guard
   placement sound (demand still aggregates into rawInputs like a
   natural leaf)? Attack the pinned precedence (raw > override) and the
   target-immunity guard: is silently ignoring a target raw-mark the
   right totality call vs erroring? Interaction with the cycle guard?
2. **Axis 2:** the optional-args compatibility claims (existing callers
   + tests untouched); candidateRecipesFor's parameterization — any
   caller that would silently change behavior? Is excludableMachines'
   recipe-referenced filter the right list for the panel?
3. **Axis 3:** keep-stale-entries semantics — genuinely inert via the
   core's totality? Discard/Apply keeping choices — consistent with the
   frozen ephemeral-preview posture (the PREVIEW is ephemeral; are the
   CHOICES a new kind of state that posture should govern — argue it)?
   Synchronous re-propose per click at catalog scale?
4. **Axis 4:** picker semantics (choosing default CLEARS the override —
   map holds only deviations: right?); the RAW strip as the undo surface
   (a raw row vanishes — is the strip sufficient recovery); exclusions
   panel from excludableMachines; one-open-picker state.
5. **Unbuildable-by-exclusion degradation:** verify the claim that
   over-excluding degrades via the existing no-producer raw-leaf path —
   no new failure mode, and the UI communicates it honestly (does it? the
   items silently become RAW — is that honest enough or a trap?).
6. **Scope:** nothing from P2/P3 leaks; no store surface; Apply unchanged.
7. **Test plan** sufficiency + bidirectionality; the byte-identical
   default-empty regression pin.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings.
