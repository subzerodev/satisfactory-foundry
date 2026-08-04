# Stage 8 / Phase 3 — auto-chain builder: target item + rate → a proposed chain (ticket #39) — brainstorm v3 (FROZEN)

**Goal.** Pick a target item and a rate; the app proposes a complete
multi-stage chain — recipe per stage, machine counts (exact minimal
integers), and the links — which the user reviews and APPLIES into the
normal editable graph. A proposal, not a fait accompli: everything lands
as ordinary stages/links.

## Already settled — do NOT re-litigate

- The ticket body pins: machine counts are "exact, minimal integers per
  link demand" (ceil, not clocks); the proposal applies as ORDINARY
  editable stages/links; exact math in pure core; alt-recipe
  OPTIMIZATION is P4's job, not P3's.
- Epic #36 decisions bind: transport resolution via planForLink (the
  proposal writes no transport configs — every new link is belt-default,
  so nothing here touches it); named-stage selection writes go through
  applyStageSelection (the proposal's BULK build follows the
  rebuildFromPlan idiom instead — see Axis 5 — writing whole stages, not
  re-deriving one selection); config edits preserve sibling fields (not
  triggered: the proposal only creates).
- Store invariants are hard walls: one feed lane per `(toStageId,
  itemId)` (addLink refusal), no self-links, ≥1 stage, tiers-global.
- src/core purity: no imports from state/ui/data (type-only included) —
  core modules define their OWN narrow input interfaces (reconcile.ts's
  `LinkInput` precedent) and import only Fraction.
- All-Claude roster; full gate; browser walk (UI phase).

## Axis 0 — scope: one phase, not a core/UI split

**Pick: single phase.** The epic allowed splitting core/UI children at
pickup; declined. The UI half is deliberately thin — one panel (target
select + rate field + propose/apply) and one bulk store action — while
all the novelty is the core solver. A phase boundary through that pair
would gate a ~thin UI on its own full design/review cycle and review the
solver without its one consumer visible. P2's same-shaped single phase
(core + schema + derive + UI, ~1400 lines) went through the full gate
comfortably. Recorded, revisitable at freeze if the design balloons.

## Axis 1 — the solver: demand-driven DFS over primary outputs, one stage per item

**Pick: `src/core/chain-builder.ts` — a pure, exact demand-propagation
builder. `proposeChain(target itemId, rate, recipes) → ChainProposal`
(r1 rename: `buildChain` already exists in chain-view.ts:104 as the
blueprint-LAYOUT composer — a same-name solver would be a readability
trap).
The proposal is a DAG keyed by ITEM: one proposed stage per distinct
item in the closure (the stage runs that item's selected recipe), links
follow recipe inputs, machine counts are ceilDiv of aggregated demand.**

- Why one-stage-per-item (not one-stage-per-consumer-need): the store's
  `(to, itemId)` uniqueness makes multiple producers of the same item
  feeding one consumer ILLEGAL — one producing stage per item satisfies
  it by construction, and it matches how a human builds (one Iron Ingot
  block feeding everything that wants ingots). Demand for an item is the
  SUM over all consumers in the proposal (the S6 fan-out rule's shape:
  ceilDiv(Σ totalDemand, perMachineOutput)).
- Demand propagation: start at the target with the requested rate;
  a stage's machine count `n = ceilDiv(demand, recipe.primaryOutput
  perMinute)` (100% clock — the ticket's minimal-integers rule); its
  input demands are `n × input.perMinute`... **no — wait, that
  over-states.** Two candidate demand models:
  (a) input demand = `n × input.perMinute` (what the built stages will
  actually consume — ceil first, then propagate); or
  (b) input demand = `demand × input/output ratio` (the exact fractional
  need, ignoring the ceil surplus).
  **Pick (a):** the proposal must be self-consistent AS BUILT — the
  reconciliation runs on real machine counts, and under (b) an upstream
  stage sized for the fractional need can under-supply the ceil'd
  downstream count (a proposal that appears with red "short" findings on
  arrival is a broken proposal). Under (a) every link arrives `ok` or
  muted-surplus by construction (ceil only ever over-produces). The cost
  — slight cascade over-build — is the honest price of integer machines
  and mirrors what the S6 apply button already does.
- Iteration order: process items in dependency order (the DFS finishes
  children before parents — demand must be FULLY aggregated across all
  consumers before a stage's count is fixed, so the traversal is:
  collect the closure + demands breadth-first with accumulation, THEN
  ceil counts bottom-up... precisely: topological order on the item DAG;
  ceil a stage only after every consumer of its item has a fixed count).
- Exactness: Fraction end to end; counts are bigint via ceilDiv; no
  floats anywhere.

## Axis 2 — recipe selection policy

**Pick: for item X, the candidate producers are recipes with
`primaryOutputId === X`, `isAlternate === false`, and whose machine is
NOT the Converter or the Packager. If multiple candidates remain, pick
the first by ascending recipe id (deterministic, documented, boring —
P4 owns choosing better). If zero remain, X is RAW (a leaf — see
Axis 3).**

- Primary-output only: an item producible only as a BYPRODUCT (Water
  from Aluminum Scrap, Heavy Oil Residue from Plastic) is NOT auto-
  chained through that producer — byproduct routing is a planning
  judgment P3 doesn't automate (Axis 4). This rule also keeps the
  candidate set aligned with the catalog's own `primaryOutputId` field
  (the port's primary-output rule — already a landed concept).
- Why exclude Converter recipes: the Converter's resource-conversion
  set ("Iron Ore (Limestone)", "Limestone (Sulfur)", …) makes nearly
  every ORE recipe-producible from every other, forming dense cycles —
  and auto-proposing "make your Iron Ore from Limestone" inverts what
  any player means by a chain proposal (ores come from miners, which
  are not in the recipe catalog at all). Excluding the machine class
  restores the natural boundary: ores/raw fluids terminate as RAW.
- Why exclude Packager recipes: every fluid has a package/unpackage
  recipe PAIR (Fuel ⇄ Packaged Fuel), so packaged forms would resolve
  through their unpackage recipe and vice versa — a 2-cycle in the
  default set. Packaging is logistics, not production; excluded the
  same way. (A user targeting "Packaged Fuel" itself gets a RAW leaf —
  acceptable for P3, recorded; P4's comparison surface is where
  packaging tradeoffs belong.)
- Cycle guard regardless: the traversal keeps the DFS path's item set;
  a candidate whose inputs revisit an on-path item is skipped (next
  candidate; none left → RAW). The OBSERVABLE behavior on a guard hit
  is a SILENT demotion to RAW (r1 fold — stated so the test asserts it
  deliberately, not by accident): the item lands in rawInputs like any
  leaf; no error, no hang. With converters+packagers excluded the
  bundled catalog's default set is acyclic — VERIFIED at review (the r1
  adversarial pass ran the full scan: 0 cycles under single-producer
  selection), so the guard is a pinned backstop; the acyclicity test
  row stays as the regression pin for future catalog updates.
- Determinism matters because proposals must be reproducible (same
  target + rate + catalog ⇒ identical proposal — a testable invariant).

## Axis 3 — termination: raw leaves are unlinked feeds, not stages

**Pick: an item with no candidate producer (ores, raw fluids, excluded
forms) terminates the recursion. It produces NO stage and NO link — the
consuming stages simply have that input un-fed, exactly like a
hand-built stage before its supply exists.** The proposal reports the
raw items + their total rates (the UI shows "raw inputs: Iron Ore
780/min, Water 360/min…") so the user knows what the chain expects from
extraction.

- Why not raw "source stages": a stage needs a recipe (defaultStage's
  no-recipe state renders "no recipe" and solves nothing) — a fake
  extraction stage would need fake recipes the catalog doesn't have.
  Unlinked inputs are already a first-class, findings-free state.
- The un-fed inputs do NOT create under-supply findings (reconciliation
  is link-keyed — no link, no finding) — verified shape; the chain
  renders clean on arrival.

## Axis 4 — byproducts: reported, never routed

**Pick: non-primary outputs of proposed stages are left unconnected
(surplus) and REPORTED in the proposal summary ("byproducts: Silica
150/min, Water 240/min"). No auto-routing, no sinks.** Routing a
byproduct into the chain (Aluminum's water loop) is a real optimization
with real tradeoffs (P4 territory at the earliest; recorded). An
unconsumed output is already a muted, legal state everywhere in the app.

## Axis 5 — the apply: one bulk store action, additive, rebuildFromPlan's idiom

**Pick: a store action `applyChainProposal(proposal)` that APPENDS the
proposed stages/links to the current graph: fresh uuids, names from the
recipe display names, positions via consecutive `placementSlot(seq)`
(the existing monotonic counter), selection = { recipeId, machineCount,
clock "100", tiers copied from the active stage (the tiers-global
invariant — addStage's own seeding rule), empty overrides }, then ONE
`deriveAllStages` + reconciliation recompute + mirrorActive (the
rebuildFromPlan composition, additive instead of replacing).** The
bigint→number narrowing at this boundary is explicit (r1 fold):
`ProposedStage.machineCount` is bigint; `Selection.machineCount` is a
safe-integer number — the apply narrows via the `toIndex` precedent
(manifold.ts:127: throw past MAX_SAFE_INTEGER, never silently truncate).

- Append-only merge policy (the ticket's fork): the proposal NEVER
  reuses or edits existing stages. Reuse-matching ("you already have an
  Iron Ingot stage — merge?") is a genuinely hard UX/semantics question
  (which count wins? whose overrides?) deferred and recorded. Appending
  is collision-free by construction: all links are between fresh ids,
  so no `(to, itemId)` clash with existing links is possible.
- The proposal's target stage becomes the active stage after apply
  (setActiveStage's semantic — focus lands where the user's intent is).
- No plan-file changes: the applied result is ordinary stages/links; a
  save writes ordinary v4. The ChainProposal type itself is never
  persisted (session-ephemeral).

## Axis 6 — the UI: a Build panel, preview-then-apply

**Pick: a "Build chain" block (new thin component `ChainBuilder.tsx`)
rendered near the stage controls: an item select (all catalog items,
sorted by display name), a rate text field (raw text, Fraction.parse at
propose time — the Selection idiom, labeled error on garbage), and a
Propose button. Proposing renders a PREVIEW LIST (pure data → rows):
one row per proposed stage ("Iron Ingot — Smelter ×12 — 360/min") plus
the raw-inputs line and the byproducts line, with Apply / discard
buttons. Apply calls the store action; discard drops the local state.**

- The preview is component-local state (the proposal is ephemeral —
  no store field; the store only gains the apply action). Solver runs
  are cheap (a catalog-sized DFS) and synchronous.
- The solver is called through a thin ui adapter that narrows the
  catalog to the core input shape (core's own interfaces — Axis 7).
- Wording precedent: counts and rates through formatRate /
  formatRateOrApprox where fractional (the S6/S7 display discipline).
- Placement: the panel lives with the graph-side controls (near
  "+ stage" — the graph is what it populates). Exact spot at
  implementation; browser walk verifies.

## Axis 7 — layering: core module with its own narrow types

**Pick: `src/core/chain-builder.ts` defines its OWN input interfaces
(the reconcile.ts `LinkInput` precedent): a minimal
`BuilderRecipe { id, machineId, isAlternate, primaryOutputId,
inputs/outputs: { itemId, perMinute: Fraction }[] }` plus the machine-
class exclusions passed as data (the caller supplies the Converter/
Packager machine ids to exclude — core hard-codes no catalog ids,
mirroring how tier rates are caller-supplied). `CatalogRecipe` is
structurally assignable to `BuilderRecipe`, so the ui adapter is a
type-level pass-through, zero copying.**

- The exclusion set as a PARAMETER keeps core catalog-agnostic (core
  cannot name "converter" — that string is data knowledge); the ui
  adapter owns resolving which machine ids are excluded. The ids are
  the NORMALIZED forms (r1 fold — settled at review, no longer a
  drift-hunt item): `converter` and `packager` (normalizeClassName
  snake-cases + lowercases `Build_Converter_C`/`Build_Packager_C`;
  both machines verified admitted into the catalog via the
  FGBuildableManufacturer class match).
- Output shape: `ChainProposal { stages: ProposedStage[], links:
  ProposedLink[], rawInputs: { itemId, rate }[], byproducts: { itemId,
  rate }[] }` with ProposedStage = { itemId, recipeId, machineCount:
  bigint, outputRate: Fraction } and ProposedLink = { fromItemId,
  toItemId } — TWO fields (simplify fold, v3): under one-stage-per-item
  + primary-output selection the flowing item ≡ fromItemId by
  construction, so a third itemId field would carry no independent
  information; the apply builds `StageLink.itemId = link.fromItemId`
  (item-keyed — the store action maps item keys to fresh stage uuids).

## Axis 8 — non-goals

- No alt-recipe choice or comparison (P4); no optimization objective
  (min machines / min power) — the default-recipe chain is THE proposal.
- No reuse/merge with existing stages (recorded above).
- No byproduct routing, no sink stages, no extraction stages.
- No transport configs on proposed links (belt default; P2's knobs are
  per-link user edits after the fact).
- No persistence of proposals; no undo beyond the ordinary editability
  of what was applied (the S8P1 posture: applied results are ordinary
  editable values).
- No clock-based exact sizing (counts are ceil integers; the user can
  hand-tune clocks after — the ticket's own rule).
- No target-rate re-propose diffing (change rate → propose again → new
  preview; applying twice appends two chains — the preview's Apply
  clears the preview after applying to make the double-apply an
  explicit re-propose, recorded).

## Test plan sketch

Core (the bulk): single-recipe chain (target=iron_plate → plate+ingot
stages, ceil counts, one link); fan-in aggregation (a target whose tree
needs iron_ingot via two consumers → ONE ingot stage sized for the sum
— the ceil-after-aggregate order pinned); deep chain demand cascade
under model (a) (upstream counts sized from CEIL'D downstream
consumption — a fixture where fractional-need sizing would under-supply
proves the model choice); byproduct report (refinery recipe → non-
primary outputs listed, unrouted); raw termination (ore/water leaves →
rawInputs totals, no stages); exclusion policy (converter/packager
recipes never selected; an item whose only producers are excluded →
raw); alternate exclusion; deterministic tie-break (two candidate
recipes → ascending-id pick, same output on repeat); cycle guard (a
synthetic recipe set with a 2-cycle → guard skips / RAW, never hangs);
bundled-catalog acyclicity + full-closure smoke (build a deep real
target, e.g. Heavy Modular Frame, assert it terminates + every link's
supply ≥ demand exactly). Store: applyChainProposal appends (existing
stages/links untouched, fresh ids, positions monotonic, tiers seeded
from active, target becomes active, derive runs — links all `ok` or
surplus, never short); the empty-proposal no-op. UI adapter: catalog →
core narrowing + exclusion-id resolution. ChainBuilder component data
helpers: rate parse errors; preview rows' wording. Bidirectionality log
per the R2 rule. Browser walk: propose Heavy Modular Frame @ 10/min,
inspect the preview, apply, watch the graph populate with ok links,
edit one stage to prove ordinariness.

## Assumptions ledger

1. `CatalogRecipe` carries `primaryOutputId` (= outputs[0], the port's
   primary-output rule), `isAlternate`, `machineId`, and per-minute
   `RecipeIO` rates (verified this session: src/data/types.ts:58-72;
   isAlternate detection at docs-loader.ts:134-141).
2. Core purity mechanics: reconcile.ts defines its own `LinkInput` and
   imports only Fraction (verified: reconcile.ts:15-17) — the
   own-narrow-types pattern the builder copies.
3. The bulk-build composition exists: rebuildFromPlan builds stages
   key-by-key with fresh uuids + placementSlot + deriveAllStages +
   mirrorActive (verified: store.ts:556-640); addStage seeds tiers from
   the active stage (store.ts:1079-1092); addLink's refusals are
   self-link + duplicate (to,itemId) (store.ts:1167-1176, r1 cite fix)
   — appending fresh-id subgraphs cannot trip them (r1 verified
   BOTH ways: externally every proposed link targets a fresh uuid;
   internally one-stage-per-item forbids duplicate lanes).
4. ceilDiv on Fraction exists and is the suggestSupply idiom (S6P2
   frozen: ×N = ceilDiv(Σ totalDemand, perMachineOutput)).
5. Un-fed stage inputs create no findings (reconciliation is
   link-keyed) — the raw-leaf posture rests on this; drift-hunt
   re-verifies against reconcile.ts before code.
6. The Converter and Packager machines are admitted catalog machines
   with normalized ids `converter` / `packager` (SETTLED at r1 review —
   both reviewers verified against the bundled snapshot; the test still
   pins them). The machine-exclusion is load-bearing for the 23 of 25
   converter recipes that are NOT isAlternate ("Coal (Limestone)" etc.
   — verified un-flagged under the id/displayName detection); 2 ARE
   isAlternate (Recipe_Alternate_Diamond_Pink_C,
   Recipe_Alternate_IonizedFuel_Dark_C) so the two filters overlap
   there (r1 groundedness fix — v1 claimed the universal "NOT flagged",
   which was false; behavior unchanged since both filters exclude
   them).
7. A catalog-sized DFS is cheap enough to run synchronously on propose
   (recipes ≈ hundreds; the closure is a fraction of that).

## Revision history

- v1 (2026-08-04): initial, grounded in this session's reads of
  src/data/types.ts (CatalogRecipe/RecipeIO/primaryOutputId),
  docs-loader.ts (isAlternate), store.ts (rebuildFromPlan composition,
  addStage tier seeding, addLink refusals, placementSlot),
  reconcile.ts (own-narrow-types precedent), and the S6P2 ceilDiv
  fan-out record.
- v2 (2026-08-05): dual-review r1 — [code-reviewer] APPROVED_WITH_NITS
  (2); [adversarial-reviewer] APPROVED_WITH_NITS (1 MAJOR-groundedness
  + 2 MINOR). Converged first round; all findings folded:
  - Assumption #6's universal "converter recipes are NOT isAlternate"
    was FALSE (the adversarial catalog scan found 2 of 25 flagged);
    restated honestly — behavior unchanged (both filters exclude
    them), the machine-exclusion load-bearing for the other 23.
  - Core entry renamed proposeChain (buildChain collides with
    chain-view.ts's layout composer).
  - Axis 5 gains the explicit bigint→number narrowing (toIndex
    precedent, throw-not-truncate).
  - The exclusion ids pinned as the normalized `converter`/`packager`
    (settled at review, off the drift-hunt list).
  - The cycle-guard's observable behavior stated (silent RAW) so the
    test asserts it deliberately; the addLink cite range fixed
    (:1167-1176).
  Verified clean by the reviewers (recorded): demand model (a) provably
  self-consistent against manifold/stage-input/reconcile semantics
  (ceil ⇒ supply ≥ demand ⇒ links arrive ok-or-surplus; model (b)
  refuted by counter-example); append collision-free BOTH ways;
  CatalogRecipe→BuilderRecipe structurally assignable;
  bundled-catalog empirics: 0 cycles under the policy, ≤1 candidate
  for all common intermediates, Empty Canister safely
  Constructor-produced (Packager exclusion breaks no chain), water
  RAW; un-fed inputs create no findings (reconcile iterates links
  only). No re-litigation of settled decisions found.
- v3 (2026-08-05): simplify pass (one-shot, post-convergence)
  APPROVED_WITH_NITS (1 actionable). Disposition:
  - FOLDED: ProposedLink loses its redundant third field — the flowing
    item ≡ fromItemId by the design's own one-stage-per-item +
    primary-output rules (the store's three-field StageLink precedent
    doesn't transfer: there a producer can feed multiple distinct-item
    lanes; here the producer key IS the item).
  Affirmed minimal without change: the single-phase scope (revisit
  hatch already recorded), excludedMachineIds as a data parameter (the
  caller-pre-filter alternative would move the acyclicity invariant
  out of tested core), the ceil-after-aggregate exposition (names the
  real fan-in ordering constraint), the proposal shape otherwise, the
  preview UI, and the test plan (guard row and acyclicity row test
  different things). FROZEN.
