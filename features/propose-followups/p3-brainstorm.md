# S21 P3 (#105) — explicit byproduct routing from Propose

**Ticket:** #105 · **Epic:** #108 · **Milestone:** 92 · **Status:** v5 — FROZEN (review of record: r5 APPROVED ×2; simplify folded)

## Purpose

Turn S20 P2's display-only byproduct feed suggestions into an explicit,
user-selected route that Apply can materialize as a normal `StageLink`.
Nothing routes silently: a route exists only when the user checks its ROUTE
control before Apply.

## Already settled — do NOT re-litigate

- S20 P2 suggestions are the base and are display-only until this phase. The
  frozen P2 design (`features/propose-grows-up/p2-brainstorm.md`) deliberately
  removed ROUTE after both r1 reviewers found unsafe routed-link mechanics.
- The store invariant stands: at most one feed lane per `(toStageId,itemId)`.
  `addLink` and `canLink` refuse duplicates; #105 must bring the Propose apply
  path into the same posture for routed byproducts.
- Reconciliation is per-link-local today. This phase does not redesign it into
  an aggregate lane solver.
- Demand feedback from routed byproducts is deferred. A selected byproduct route
  does not resize the proposal, subtract raw demand, or create a second producer
  for the same consumer lane.

## Ground truth (verified against live source)

- `ChainProposal.byproducts` reports non-primary outputs only as `{ itemId,
rate }`, with no source-stage identity (`src/core/chain-builder.ts:77-82`,
  `:350-357`). That was correct for P2 display, but a `StageLink` needs a
  producer stage.
- `byproductSuggestions` aggregates byproduct rates per item and emits one
  display row per `(itemId,toItemId)` (`src/ui/chain-builder-adapter.ts:861-894`).
  The aggregation is intentionally source-less, which is why it cannot directly
  route two producers of one byproduct into one consumer.
- `applyProposalToSlice` maps primary proposal links with a plain `.map` and
  appends them (`src/state/store.ts:875-902`). Its append-only comment is true
  for primary proposal links, but not sufficient for optional byproduct links.
- The public graph API refuses self-links and duplicate `(toStageId,itemId)`
  lanes in both `canLink` and `addLink` (`src/state/store.ts:949-960`,
  `:1615-1628`).
- Reconciliation maps each link independently to one producer output total and
  one consumer demand total (`src/state/store.ts:609-624`), then emits at most
  one finding per link (`src/core/reconcile.ts:50-78`).
- The preview stores solved snapshots for rate, clock and gated catalog
  (`src/ui/ChainBuilder.tsx:103-132`); Apply currently passes only
  `(proposal, clockText)` (`src/ui/ChainBuilder.tsx:275-284`).
- The current P2 display call still passes the live ungated `catalog` into
  `byproductSuggestions` (`src/ui/ChainBuilder.tsx:626`), but route controls
  must not inherit that posture. Routeability, display decoration, and Apply
  filtering must use `preview.gated`, the solved catalog snapshot.

## Decision axes

### Axis 1 — Source identity for routed byproducts

Options:

- Re-derive source byproducts in the UI from `proposal.stages` plus recipes.
- Widen `ChainProposal.byproducts` with `fromItemId`.

**Pick: widen `ChainProposal.byproducts` to `{ fromItemId, itemId, rate }`.**
Routing consumes source identity, so the proposal should carry it at the same
layer that emits the byproduct rate. The P2 display helper keeps its aggregate
output unchanged by ignoring `fromItemId`; #105's route helper consumes it.
This avoids a UI-side shadow copy of core emission math.

### Axis 2 — Which suggestions get a ROUTE control

**Only unambiguous, collision-free suggestions are routeable in this phase.**

A display suggestion `(itemId,toItemId)` receives a ROUTE checkbox iff:

1. exactly one proposal byproduct source emits `itemId` for that consumer;
2. `fromItemId !== toItemId`;
3. no primary proposal link already owns `(toItemId,itemId)`;
4. no earlier accepted routed byproduct owns `(toItemId,itemId)`.
5. the same source output `(fromItemId,itemId)` has exactly one possible
   consumer.

The three excluded cases stay display-only:

- **primary-lane collision**: if the proposal already links the primary producer
  of B into the consumer of B, a byproduct B route would duplicate the same feed
  lane. Do not offer it.
- **multi-source aggregate**: if two stages emit B and one consumer uses B, the
  P2 display line can honestly show the summed byproduct rate, but a single
  `StageLink` cannot represent that aggregate. Do not offer a route until the
  graph has aggregate feed semantics.
- **source fan-out**: if one source byproduct B could feed two consumers, all of
  those rows stay display-only. Per-link reconciliation has no aggregate
  source-consumption ledger, so route controls are suppressed until the user can
  choose a split or the graph has aggregate semantics.

The store apply path repeats the same duplicate/self checks as a hard guard, so
the UI is not the enforcer of graph validity. It also validates every route
payload against the proposal plus the solved catalog snapshot: `fromItemId` must
name a proposed stage whose recipe outputs `itemId`, and `toItemId` must name a
proposed stage whose recipe inputs `itemId`. Source fan-out is already
suppressed before route controls exist; the store still treats a second selected
route for the same `(fromStageId,itemId)` as invalid and refuses it.

### Axis 3 — Partial-supply semantics

**A routed byproduct link means "send this byproduct lane to that input", not
"this fully satisfies that input".** Existing reconciliation remains honest:
it compares the selected byproduct source's output lane against the consumer's
full demand and may emit under-supply or over-supply.

That is not a false alarm under the one-feed-lane graph model. Because #105
refuses primary-lane collisions, an under-supply finding means the explicit
route is not enough by itself and the graph needs further manual adjustment.
Changing that into an aggregate "byproduct plus raw/top-up supply" model would
require a new lane representation and is out of scope.

The checkbox label includes the source rate (`ROUTE 10/min from Fuel`) so the
user opts into a concrete lane amount before Apply. The existing post-Apply
reconciliation surfaces exact short/surplus diagnostics.

### Axis 4 — Apply payload and stale toggle posture

`applyChainProposal` takes a single options bag with a default:

```ts
type ApplyChainProposalOptions = {
  clockPercentText?: string;
  byproductRoutes?: ProposedByproductRoute[];
  catalog?: Catalog;
};

type ProposedByproductRoute = {
  fromItemId: string;
  itemId: string;
  toItemId: string;
};
```

Existing clock callers update from `applyChainProposal(proposal, "150")` to
`applyChainProposal(proposal, { clockPercentText: "150" })`; default callers use
`applyChainProposal(proposal)` and still seed `"100"`. When byproduct routes are
present, `catalog` is REQUIRED and is the proposal's solved catalog snapshot
(`preview.gated`). If routes are passed without a catalog snapshot, the store
refuses all byproduct routes while still applying the primary proposal
stages/links. The store never validates route payloads against its live catalog
slice.

The UI stores selected route keys in component state. The stable key is the full
route identity `(fromItemId,itemId,toItemId)`, not the display key
`(itemId,toItemId)`, so a re-propose that changes the source cannot preserve a
checked stale route. On every successful re-propose it intersects the selection
with the current routeable key set; Apply also filters through the current
routeable rows. Stale selections therefore cannot throw and cannot route a
disappeared stage. Apply and Discard clear the preview-local selection.

### Axis 5 — Demand feedback

Deferred. The proposal solver still sizes the consumer as if the byproduct
input is externally/raw supplied unless that item already has a normal primary
producer in the chain. A checked route only affects the applied graph links.
That matches the ticket's "explicit routing" surface without smuggling in a
feedback loop whose fixed point has not been designed.

## Spec (file-by-file)

1. **`src/core/chain-builder.ts`** — add `ProposedByproduct extends ItemRate`
   with `fromItemId`; make `ChainProposal.byproducts` use it; emit
   `fromItemId: itemId` when recording each non-primary output. Existing
   byproduct rates stay byte-identical.
2. **`src/ui/chain-builder-adapter.ts`** — keep `byproductSuggestions` as the
   aggregate display helper, now ignoring `fromItemId`. Add
   `byproductRouteSuggestions(proposal,catalog)` returning routeable rows with
   source identity/rate and a stable key `(fromItemId,itemId,toItemId)`. The
   helper groups by
   `(itemId,toItemId)`, suppresses multi-source groups, suppresses primary-link
   lane collisions, suppresses all source fan-out groups, and suppresses
   self-routes.
3. **`src/state/store.ts`** — export `ProposedByproductRoute` and
   `ApplyChainProposalOptions`; update `applyChainProposal` to accept
   `(proposal, options: ApplyChainProposalOptions = {})`. In
   `applyProposalToSlice`, build primary links first. Route validation reads the
   explicit catalog
   snapshot from the options bag (the UI passes `preview.gated`) and checks that
   the route's source proposal stage recipe outputs `itemId` and its consumer
   proposal stage recipe inputs `itemId`; a missing catalog snapshot refuses all
   byproduct routes but still applies the proposal's primary stages/links.
   Append byproduct route links only when both fresh ids resolve, `from !== to`,
   `(toStageId,itemId)` is not already present among existing/new links, and
   `(fromStageId,itemId)` has not already been spent by an earlier accepted
   route.
4. **`src/ui/ChainBuilder.tsx`** — add preview-local selected route keys.
   Compute both display suggestions and routeable rows from `preview.gated`, not
   from the live `catalog`, so a failed re-propose after a tier change cannot
   decorate or apply a stale preview against the wrong world. Render the existing
   suggestion line as a checkbox when a routeable row exists for that
   `(itemId,toItemId)`; otherwise render the P2 display-only line. Apply passes
   selected route payloads filtered against the current routeable rows and calls
   `applyChainProposal(preview.proposal, { clockPercentText: preview.clockText,
byproductRoutes, catalog: preview.gated })`, then clears the selection
   afterward. The preview also retains the base catalog object identity; if a
   successful Docs re-upload replaces that object before Apply, Apply refuses
   the entire stale preview, clears it and asks the user to propose again.
5. **`src/ui/app.css`** — style the ROUTE checkbox with the existing suggestion
   line tokens; no layout-wide redesign.
6. **Tests**:
   - core proposal test pins `fromItemId` on byproduct emissions;
   - adapter tests pin routeable single-source output, primary-link collision
     suppression, multi-source aggregate suppression, source fan-out
     suppression, full route keys, and self-route suppression;
   - store tests pin successful routed `StageLink`, duplicate-lane refusal, and
     no-route default behavior, options-bag `clockPercentText` seeding,
     non-empty routes without `catalog` refusing only byproduct links while
     primary stages/links still apply, plus unresolved route payloads, stale
     source-output payloads, stale consumer-input payloads, self-route
     filtering, and source fan-out filtering;
   - jsdom ChainBuilder test pins toggling ROUTE and Apply creating the route,
     stale selection dropped after a re-propose where the route disappears, the
     same display `(itemId,toItemId)` remaining while `fromItemId` changes, and
     a failed re-propose after tier change still deriving routeability/display
     from `preview.gated`;
   - bidirectionality log mutates out duplicate refusal and stale filtering.

## Out of scope

- Aggregate feed lanes or multiple producers into one `(toStageId,itemId)`.
- Byproduct demand feedback into proposal sizing.
- Store route validation against the live catalog slice.
- Legacy positional clock argument compatibility.
- Auto-routing any byproduct without an explicit checked ROUTE control.
- Persisting route choices across sessions or across Discard.

## Assumptions ledger

- A proposal still has one stage per primary item — grounded in
  `proposeChain`'s `plans: Map<itemId,Plan>` and `idByItem` apply map.
- Store output lanes include byproducts, so a `StageLink.itemId` pointing at a
  non-primary output can reconcile — grounded in `toStageInput` using recipe
  outputs and `mapLinkInputs` looking up `solve.result.outputs` by item id.
- Skipping ambiguous/multi-source route controls is acceptable for this phase
  because P2 already shows the aggregate suggestion and the current graph cannot
  encode the aggregate route without violating the lane invariant.

## Revision history

- v1 (2026-08-16): initial #105 design. Carries P2 r1 reviewer findings into a
  scoped routeable subset: route only single-source, no primary collision;
  repeat duplicate refusal in the store; keep partial-supply reconciliation as
  a diagnostic; defer demand feedback.
- v2 (2026-08-16): r1 review fold. **Code-reviewer IMPORTANT (one source
  byproduct could be routed to multiple consumers, double-counting source supply
  under per-link reconciliation) — FOLDED**: routeability and apply now spend
  each `(fromItemId,itemId)` once, leaving later consumers display-only.
  **Adversarial NIT (stable key unspecified) — FOLDED**: key is explicitly
  `(fromItemId,itemId,toItemId)`. **Adversarial NIT (store guard tests missing
  unresolved/self rows) — FOLDED** in the test plan.
- v3 (2026-08-16): r2 review fold. **Adversarial IMPORTANT (store API could
  still materialize a dangling byproduct link when stale payload item lanes do
  not match the still-existing source/consumer stages) — FOLDED**: apply now
  validates source recipe outputs and consumer recipe inputs against the ready
  catalog snapshot before writing the route. **Code-reviewer IMPORTANT
  (`ChainBuilder` route derivation could use live ungated catalog instead of the
  preview's solved `gated` snapshot) — FOLDED**: display decoration,
  routeability, and Apply filtering all use `preview.gated`. **Code-reviewer NIT
  (stale-selection test must cover same display row with changed source) —
  FOLDED** in the jsdom plan.
- v4 (2026-08-16): r3 adversarial fold. **IMPORTANT (store route validation
  world was ambiguous: the store slice's live catalog is not necessarily the
  proposal's solved `preview.gated` snapshot) — FOLDED**: `applyChainProposal`
  gains an options bag carrying explicit `catalog: preview.gated` for route
  validation; missing catalog means no byproduct routes are written. Legacy
  clock-string callers remain valid.
- v4 nits folded (2026-08-16): r4 = APPROVED_WITH_NITS ×2. Shared NIT
  (missing-catalog route fallback not explicitly tested) — **FOLDED** in the
  store test plan. Code-reviewer NIT (options-bag clock seeding not explicitly
  tested) — **FOLDED** in the store test plan. Correctness pair CONVERGED.
- v5 (2026-08-16): one-shot simplify pass (degraded same-vendor
  claude-simplify-reviewer, NEEDS_REWORK advisory) — **FOLDED both findings**:
  source fan-out now suppresses all affected rows instead of first-wins, and
  `applyChainProposal` uses one options-bag API rather than dual positional
  string/options forms. Because this changes the approved API/routeability
  contract, correctness pair re-runs on the simplify fold.
- v6 (2026-08-16): boundary r3 = APPROVED / APPROVED_WITH_NITS. **Adversarial
  NIT (direct self-route suppression was unpinned) — FOLDED** with a focused
  adapter row and mutation failure. **Adversarial NIT (the frozen jsdom plan's
  same-display/source-change and failed-tier-repropose rows were absent) —
  FOLDED** with full-key selection and separate snapshot label/routeability
  rows, each backed by mutation failures.
- v7 (2026-08-16): boundary r4 = APPROVED / NEEDS_REWORK. **Adversarial
  IMPORTANT (self filtering ran before multi-source counting, so a self emitter
  plus a second emitter could expose the second as a false single-source
  route) — FOLDED**: self candidates now participate in ambiguity counts and
  are removed only from the final eligible set. A red-first interaction row
  exposed `scrap water silica` before the fold and passes afterward.
- v8 (2026-08-16): boundary r5 = NEEDS_REWORK ×2. **Shared IMPORTANT (counting
  self-consumption as source fan-out suppressed a legal external consumer) —
  FOLDED**: self candidates contribute to display ambiguity but not source
  fan-out counts, then remain excluded from final routes. A red-first row pins
  the surviving `silica water solution` route.
- v9 (2026-08-16): boundary r6 = NEEDS_REWORK ×2. **Shared IMPORTANT (a Docs
  catalog replacement could leave an old preview whose routes validated against
  `preview.gated` while applied stages re-derived against the new live catalog)
  — FOLDED**: previews retain their base catalog identity and Apply refuses the
  entire preview after replacement, clears it, and requests a fresh proposal.
  A red-first jsdom row pins zero graph mutation.
- v10 (2026-08-16): boundary r7 = APPROVED_WITH_NITS ×2. **Shared NIT (the
  replacement guard lacked a non-null-tier success row) — FOLDED**: a tier-0
  preview applies successfully against its unchanged base catalog. Comparing
  the live base with `preview.gated` instead of `preview.sourceCatalog` makes
  the row fail.
- v11 (2026-08-16): boundary r8 = APPROVED ×2; one-shot diff simplify =
  APPROVED_WITH_NITS. **Simplify NIT (public `byproductRouteKey` had no real
  caller) — FOLDED** by inlining the full key at route construction and removing
  its self-test. **Simplify NIT (`usedTargetLanes` included existing links whose
  targets cannot match fresh proposal UUIDs) — FOLDED** by seeding from new
  primary proposal links only; accepted routes still extend the set.
