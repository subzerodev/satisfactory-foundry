# Stage 8 / Phase 1 — interaction polish: one-click apply + site focus (ticket #37) — brainstorm v3 (FROZEN)

**Goal.** Two parked affordances land: the under-supply suggestion gains an
explicit APPLY (set the producer to the suggested ×N and re-derive), and
clicking a site in the Combined view focuses that stage.

## Already settled — do NOT re-litigate

- The ×N semantics are frozen S6P2 decisions: `suggestSupply` is exact
  ceilDiv; the fan-out rule makes ×N the producer's TOTAL across all its
  outgoing same-item links ("×N total" wording when siblings exist) —
  applying it satisfies every consumer of that item by construction.
- S6P2 deferred one-click-apply GENERALLY ("an apply button mutates
  another stage from an edge — a UX/undo question that earns its own
  ticket if wanted; recorded") — this phase IS that recorded ticket, not
  a re-open (r1 precision fold: the deferral was general, not
  mode-vs-count scoped).
- The P0 epic decision binds: link-transport resolution via planForLink
  (this phase doesn't resolve transport, but must not add new preambles).
- Combined-view site chrome + selection idioms are frozen P3 shapes.
- All-Claude roster; full gate; browser walk.

## Axis 1 — the apply affordance: where and what

**Pick: a supply line + apply button in the LinkInspector (the link's
established detail panel), NOT a clickable edge chip and NOT a findings
button.**

- The inspector already opens on edge selection (P2) and is the one place
  a link's detail renders with real buttons (the P3 "use drawn distance"
  precedent — same panel, same interaction grammar). New inspector block
  for under-supplied links: "supply short 102.5/min — apply ×19 to
  Smelters" (names the producer; the ×N and shortfall come from the SAME
  `supplySuggestionFor` data the edge label renders — one source, no
  recomputation drift).
- Why not the edge chip: SVG edge labels as click targets are fiddly and
  undiscoverable; the chip stays display-only (unchanged).
- Why not FindingsPanel: under-supply findings are chain-level rows
  without link selection context; the button belongs where the user is
  already looking at THAT link. (Findings wording unchanged.)
- Visibility rule: the block renders only when the link is under-supplied
  AND the suggestion is non-null (solved producer) — the same solved-only
  discipline everywhere else. Over-supplied/matched links: no block.

## Axis 2 — the apply action mechanics

**Pick: a new store action `setStageMachineCount(stageId, n)` — the
per-stage generalization of the existing active-only `setMachineCount` —
with apply calling it for the PRODUCER stage.**

- The existing `setMachineCount` writes the ACTIVE selection only; the
  apply targets the producer of the selected LINK, which is often not the
  active stage. Silently switching the active stage to reuse the old
  action would be a surprising side effect (the user is inspecting a
  link, not editing a stage) — rejected. The new action writes the named
  stage's selection.machineCount + re-derives — built by generalizing
  applyActiveSelection to a stageId parameter over the existing
  primitives (deriveStage + mirrorActive + recomputeReconciliation; see
  Assumption #2 — no ready-made per-stage helper exists).
- `setMachineCount` (active) DELEGATES to the generalized helper as its
  stageId = activeStageId case (simplify fold, v3 — this was a decided
  mechanic, not a fork: a separate re-derive path would duplicate the
  primitive composition; the existing active-path tests pin the behavior
  unchanged).
- No special undo: the count lands in the ordinary Machines input (visible
  when that stage is active) — editable like any hand-entered value (the
  ticket's recorded posture). The button is idempotent (applying twice is
  a no-op: the suggestion disappears once supply covers demand).
- Fan-out safety (confirmed from the frozen S6P2 record): ×N =
  ceilDiv(Σ all consumers' totalDemand, perMachineOutput) — so the apply
  can only close shortfalls, never create one for a sibling consumer.
  After re-derive, sibling links' labels update naturally.

## Axis 3 — combined-view site focus

**Pick: clicking a site focuses that stage via the existing
`setActiveStage(id)` — SELECT-ONLY; the view stays Combined. Mechanically
this is a PROP THREAD, not a store call: ChainBlueprint is store-free by
frozen invariant ("App is the sole store importer"), so App passes
`onSelectStage` (→ setActiveStage) and `activeStageId` down through
ChainBlueprint into SiteGlyph, whose `<g>` gains a handler prop (r1
fold — the implementer must NOT add a store import there).**

- Why select-only: switching views on click would yank the user out of
  the overview they were reading (the whole point of Combined). Selecting
  updates the active stage, so the per-stage panels below (recipe,
  Machines, clock, overrides) now edit the clicked site — focus without
  navigation. A second affordance for "go to this stage's blueprint" is
  NOT added (scope cut, recorded; the view toggle is one click away).
- Visual feedback: the focused site's bbox gets the established selected
  outline idiom (the `.selected` accent treatment from stage nodes,
  applied as a chain-bp-site modifier class). The outline's guarantee
  (r1-corrected reason): the Combined view only renders when the ACTIVE
  stage's solve is "solved" (the App gate), and solved stages always
  render as sites — so whenever Combined is visible the active site
  exists. ("activeStageId always resolves" is necessary but not the
  operative guarantee.)
- Skipped (unsolved) stages aren't rendered, so they aren't clickable in
  the combined view — acceptable: the graph canvas remains the universal
  selector (recorded, not a gap to fix here).
- Accessibility/mechanics: the `<g>` gets role="button" + cursor:pointer
  + a key handler per the SVG-interaction idiom (drift-hunt: check how
  React Flow nodes expose keyboard selection for parity-in-spirit; SVG
  click on a `<g>` with onClick is the mechanical shape).

## Axis 4 — non-goals

- No apply for over-supply (reducing counts is a judgment call the user
  makes — a surplus is not a problem; S6 renders it muted, unchanged).
- No clock-based balancing apply (the S6 record contemplated "count
  and/or exact clock" — count-only ships; a clock apply would need a
  policy for count-vs-clock tradeoffs nobody has asked for. Recorded.)
- No mode changes, no transport writes, no chip changes, no findings
  wording changes.
- No multi-link batch apply.

## Test plan sketch

Store: setStageMachineCount writes the named (non-active) stage +
re-derives, active stage untouched; the active-action delegation (if
taken) preserves existing behavior. graph-flow/inspector data: the supply
block's presence rule (under-supplied + solved producer only; absent for
matched/over/unsolved); the apply payload (producer id + suggested count)
matches supplySuggestionFor for both single-consumer and fan-out cases;
idempotence (post-apply the suggestion nulls). ChainBlueprint: the site
click emits the focus for the right stageId; the active-site modifier
class renders on the active site. Bidirectionality log per the R2 rule.
Browser walk: apply ×19 on the walk chain and watch the edge label flip
to surplus; click the other site in Combined and edit its recipe.

## Assumptions ledger

1. `supplySuggestionFor` is graph-flow-private today; the inspector needs
   its data. The ONE viable shape (r1 fold — the previously-suggested
   "edge-data path" does not exist; the inspector reads the store, and
   the suggestion is inlined into the edge label string, not edge data):
   EXPORT supplySuggestionFor and have the inspector call it with its
   store-selected stages/links, adding one `reconciliation` selector to
   gate the block on the linkId-keyed under-supply finding.
2. The reuse basis for setStageMachineCount (r1-corrected citation):
   `applyActiveSelection` is a small helper hardcoded to the active id —
   it GENERALIZES trivially to a stageId parameter over the same
   primitives (deriveStage + mirrorActive + recomputeReconciliation).
   No existing action writes a named non-active stage's selection
   (rename writes only the name; remove deletes) — the new action is
   built from the primitives, not found ready-made.
3. `setActiveStage(id)` exists and is the complete focus semantic
   (verified in store source this session at ~235/1104).
4. Under-supply detection for the inspector reuses the existing
   reconciliation findings (the linkId-keyed under-supply finding) — no
   new detection math.

## Revision history

- v1 (2026-08-04): initial, grounded in advice.ts/graph-flow/store/
  ChainBlueprint source reads this session.
- v2 (2026-08-04): dual-review r1 — [code-reviewer] NEEDS_REWORK
  (3 IMPORTANT + 2 NITs); [adversarial-reviewer] APPROVED_WITH_NITS (4)
  — heavily overlapping groundedness gaps, all folded:
  - Axis 3 hid a prop thread: ChainBlueprint is store-free, so the click
    is App-threaded (onSelectStage + activeStageId props; SiteGlyph
    handler prop) — never a store import there.
  - Assumption #1's "edge-data path" alternative did not exist: the one
    viable shape stated (export supplySuggestionFor + a reconciliation
    selector).
  - Assumption #2 cited the wrong precedent: rename/remove never
    re-derive a selection; the real basis is applyActiveSelection's
    trivial stageId generalization over the existing primitives.
  - The outline guarantee's operative reason corrected (the Combined
    view's solved-gate on the active stage).
  - The S6P2 deferral wording made precise (general, not mode/count
    scoped).
  Both reviewers PROVED the safety-critical claims under refutation:
  idempotence (ceilDiv rounds up; the finding clears; the block
  disappears) and fan-out (per-link-local reconcile + total-demand ceil
  ⇒ no sibling can be left short). Also verified: reconciliation is one
  selector away; ChainSite carries stageId; setActiveStage guards stale
  ids.
- v3 (2026-08-04): r2 APPROVED×2 (0 — the mirrorActive probe resolved IN
  the design's favor: the mirror must stay active-keyed, so the
  generalization is a one-line swap). Simplify pass APPROVED_WITH_NITS
  (1, FOLDED): the setMachineCount delegation "MAY" was a false fork —
  decided as DELEGATE (the active setter becomes the activeStageId case
  of the generalized helper). All other probes affirmed minimal (the
  supply block mirrors the MeasureFeed idiom 1:1; the two-prop thread is
  the store-free minimum; a11y right-sized; non-goals disciplined).
  FROZEN.
