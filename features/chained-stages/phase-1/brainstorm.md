# Stage 3 / Phase 1 brainstorm — graph model (ticket #16, epic #12)

Date: 2026-08-03
Status: v5 — FROZEN (correctness converged r5 after five rounds; simplify APPROVED_WITH_NITS, both prose nits folded). This document is the binding Phase 1 contract.
Inputs: live post-#11 store (`src/state/store.ts` @ post-#11 develop: Selection,
SolveState, derive, plans machinery incl. the serialized-op chain),
`src/data/plan-store.ts` (PlanFileV1 `stages[]` + reserved `links[]`),
`src/core/manifold.ts` (per-stage solver — untouched this arc), epic #12 +
FEATURE.md decomposition.

## Already settled — do NOT re-litigate

1. Growth-path directive + auto-greenlit gates; all-Claude roster.
2. The per-stage solver is frozen: chaining NEVER re-enters solver math —
   a stage solves exactly as v1 does; chaining compares *totals* between
   stages. Core purity absolute.
3. PlanFileV1 is the serialization target (`stages[]` array + reserved
   `links` — populated in Phase 3, not this phase).
4. Phase 1 is HEADLESS + compatibility-preserving: the v1 UI keeps working;
   no new deps; Phase 2 brings the canvas.
5. All store-concurrency conventions from #11 (serialized total ops for
   IDB-touching actions; sync actions mutate-then-derive).

## Axis 1 — Store shape: stages map + active cursor

**Pick:** replace the singleton `selection`/`solve` pair with:

```ts
interface StageNode {
  id: string;            // crypto.randomUUID — stable across renames (Stage-2 rule)
  name: string;          // display name, default "Stage N"
  selection: Selection;  // unchanged shape
  solve: SolveState;     // per-stage, derived eagerly (v1 semantics per stage)
}
interface AppState {
  stages: Record<string, StageNode>;
  stageOrder: string[];         // insertion order (canvas + list stability)
  activeStageId: string;        // the stage the v1 UI edits
  links: StageLink[];
  reconciliation: LinkFinding[]; // derived, see Axis 3
  // catalog / catalogSource / uploadError / plans / planError unchanged
}
```

- **The default stage ("Stage 1") + `activeStageId` live in the
  INITIAL-STATE LITERAL** (r1 fold — not created in `init()`): zustand's
  persist `merge` runs synchronously during `createAppStore`, before
  `init()`, and must find `stages[activeStageId].selection` to write
  hydrated tiers into. The v1 single-stage case IS a one-node graph.
- **Persistence is REWRITTEN, not inherited** (r1 fold): `partialize` and
  `merge` currently read/write the flat `selection.unlockedTiers`; both
  are rewritten to `stages[activeStageId].selection.unlockedTiers`
  (hydration still clamps via `clampTier`; hydrated tiers then propagate
  to all stages per the tiers-global rule below).
- **Compatibility shim:** the six v1 selection setters (`selectRecipe`,
  `setMachineCount`, `setClockPercentText`, `setUnlockedTiers`,
  `setOverride`, `clearOverrides`) — plus the two selection-writing async
  actions (`loadPlan`, `uploadDocsText`) — keep their exact signatures and
  operate on the ACTIVE stage (r1 wording fold: six setters, not "eight
  selection actions"). The v1 UI (App, ControlsStrip, Schematic, …)
  continues to read `stages[activeStageId].selection/.solve` through two
  tiny selectors (`activeSelection(s)`, `activeSolve(s)`) — App's wiring
  changes a few lines, components unchanged.
- New graph actions: `addStage()`, `removeStage(id)`, `renameStage(id,
  name)`, `setActiveStage(id)`, `addLink(link)`, `removeLink(id)` — all
  synchronous (no IDB this phase) → mutate-then-recompute, no chain needed.
  **`addStage` seeds the new stage's `unlockedTiers` from the ACTIVE
  stage's copy** (r2 fold — the tiers-global invariant must hold on the
  CREATE path too; `defaultSelection()`'s full table would silently
  out-unlock the rest of the factory). Everything else in the new stage is
  default (null recipe, count 1, clock "100", empty overrides).
- **Decision: tiers stay GLOBAL** (they model game progression, not
  per-stage config — one unlock state for the save). They remain in each
  stage's `Selection` (moving them out would break the frozen
  Selection/PlanFileV1 shape); `setUnlockedTiers` writes ALL stages
  (progression applies factory-wide); persist/hydrate reads the active
  stage's copy. Cheap, shape-preserving, honest to the game model.
  **The tier-write path inventory is exhaustive (r3 fold):** set
  (`setUnlockedTiers` → all stages), hydrate (merge → active, propagated
  to all), create (`addStage` seeds from active), and **loadPlan — which
  from this phase PRESERVES the current global tiers instead of adopting
  the saved plan's** (tiers are progression, not plan content; a
  months-old plan must not downgrade the factory's unlocks). This
  **deliberately supersedes the Stage-2 tier-restore semantics** — two
  Stage-2 tests are affected (r4 pin, both named): the clamp-on-load row
  tests a code path that is **REMOVED, not updated** (loadPlan's
  `clampTier(saved.unlockedTiers…)` reads disappear entirely — that test
  is deleted with its path); the plain round-trip row's tiers assertion
  coincidentally survives (tiers unmutated between save and load) but its
  tiers expectation is re-pointed at the current-global value for honesty.
  Consequence acknowledged (r4): the plan file's `unlockedTiers` becomes
  **write-only / dead-on-read** — saved for shape-compatibility (the
  frozen Selection/PlanFileV1 shape requires it; `isSelectionShape` still
  validates it) but never read back from Phase 1 on. The change is flagged
  for the boundary reviewers as intended and logged in FEATURE.md's
  Decisions. Under the
  complete inventory, every path preserves all-stages-identical, so
  "active = any" holds inductively.

## Boundary amendment (2026-08-03, boundary r1 — the mirror)

The implementation surfaced a contract reconciliation both boundary
reviewers ratified: Axis 1's "replace the singleton selection/solve pair"
and the "54-row suite passes with only two sanctioned edits" pin are
jointly satisfiable ONLY by keeping top-level `selection`/`solve` as
**live mirrors of the active stage** — `stages[activeStageId]` is
canonical; every mutation that touches the active stage (or moves the
cursor) re-points the mirrors to the same freshly-built objects
(`mirrorActive`); no path mutates a stage's selection in place, so the
two references are identical by construction. `activeSelection`/
`activeSolve` read the mirrors (behavior-equivalent to reading the
canonical map). Precision note: the parse-FAILURE upload path re-derives
the active stage + recomputes reconciliation — idempotent (unchanged
inputs → unchanged outputs), behavior-equivalent to the cadence table's
"none".

## Axis 2 — Link model

```ts
interface StageLink {
  id: string;                 // uuid
  fromStageId: string;        // producer
  itemId: string;             // the item flowing
  toStageId: string;          // consumer
}
```

- A link means "the item's output belts of `from` feed the item's input
  lane of `to`". Item-level, not belt-level (belt-level routing is the
  physical-layout layer's business, Stage 4).
- Validity rules (checked at add + re-checked on any recipe change, as
  reconciliation findings rather than hard rejections where possible):
  - `from` must currently produce `itemId`, `to` must consume it — a
    recipe change that breaks this yields a `dangling-link` finding (the
    link is kept, flagged — mirrors the dangling-recipeId posture: never
    silently delete user structure).
  - No self-links (`from === to`) — hard-refused at `addLink`.
  - At most one link per `(toStageId, itemId)` (a feed lane has one
    upstream source in v1 chaining; merging multiple producers is future
    scope) — hard-refused at `addLink`.
  - Cycles: **allowed structurally, NOT flagged this phase** (r1 fold —
    the promised `cycle` finding contradicted the per-link-local
    reconciliation contract, which carries no topology and cannot detect
    one). Factories do have loops (recycled water); per-link
    reconciliation is cycle-indifferent by construction, so allowing them
    costs nothing. Whether the CANVAS wants a cycle *indicator* is a
    Phase 2 design question, explicitly deferred (recorded in FEATURE.md
    at fold time).
- `removeStage` cascades: links touching the stage are removed with it
  (structure the user explicitly deleted), unlike recipe-change dangling.
- **removeStage edge rules (r1 fold):** the removed id is spliced from
  `stageOrder` and its `stages` entry deleted (r2 wording pin); removing
  the ACTIVE stage moves `activeStageId` to the first remaining stage in
  `stageOrder` (the cursor ALWAYS resolves — the v1 UI's
  `stages[activeStageId]` read is total); removing the LAST stage is
  **refused as a no-op** (the ≥1-stage invariant; the Phase 2 UI disables
  the control at one stage).

## Axis 3 — Reconciliation: pure module, totals-level

New pure module `src/core/reconcile.ts` (zero deps — belongs in core: it is
exact-Fraction math over solver outputs, no store/DOM knowledge):

```ts
export interface LinkInput {
  linkId: string;
  supply: Fraction | null;   // producer's totalOutput for itemId (null = lane absent)
  demand: Fraction | null;   // consumer's totalDemand for itemId (null = lane absent)
}
export type LinkFinding =
  | { type: "under-supply"; linkId: string; supply: Fraction; demand: Fraction; shortfall: Fraction }
  | { type: "over-supply";  linkId: string; supply: Fraction; demand: Fraction; surplus: Fraction }
  | { type: "dangling-link"; linkId: string; end: "from" | "to" }
export function reconcileLinks(inputs: LinkInput[]): LinkFinding[]
```

- Per-link comparison of exact totals: `supply.lt(demand)` → under-supply
  with the exact shortfall; `supply.gt(demand)` → over-supply (informational
  severity — surplus is normal in factories; the UI renders it muted).
  Exact match → no finding. Either lane absent → dangling; when BOTH ends
  are absent, exactly one finding is emitted with `end: "from"` (r1 fold —
  deterministic tie-break: the producer end is reported first).
- **The recompute cadence is ENUMERATED** (r1 fold — "any change" was not
  implementable without a missed path). Per mutation class:

  | Mutation | Solves re-derived | Reconciliation |
  |---|---|---|
  | selectRecipe / setMachineCount / setClockPercentText / setOverride / clearOverrides | active stage | recompute |
  | setUnlockedTiers (tiers-global: writes ALL stages) | **ALL stages** | recompute |
  | uploadDocsText, parse SUCCESS (catalog replaced) | **ALL stages** — and EVERY stage first gets the #5 treatment: recipeId re-validated against the new catalog (absent → null) + overrides cleared (r1 fold B1 — the dangling-id/misaddressed-override class must be closed for INACTIVE stages too) | recompute |
  | uploadDocsText, parse FAILURE | none (existing semantics) | none |
  | init (cache hit / bundled / degrade) | **ALL stages** | recompute |
  | loadPlan (active stage's selection replaced EXCEPT unlockedTiers — current global tiers preserved, r3 fold) | active stage | recompute (a recipe change here surfaces dangling-link findings naturally) |
  | addStage / renameStage / setActiveStage | none | none (rename/cursor don't affect flows; a new stage has no links yet) |
  | addLink / removeLink / removeStage | none | recompute |

  The store maps stage solves → `LinkInput[]` (a lookup, not math) and
  calls the pure function.
- Deliberately NOT in scope: auto-balancing, propagating rates downstream,
  belt-level matching. Chaining v1 = honest comparison, the user adjusts
  machine counts themselves (the tool's whole ethos).

## Axis 4 — What happens to plan actions this phase

`savePlanAs`/`loadPlan` currently serialize the single selection. This
phase they serialize **the active stage only** (unchanged PlanFileV1 single
`stages[0]`, `links: []`) — full-graph serialization is Phase 3's contract
(needs its own review of format semantics for links/order/active-cursor).
Loading a plan replaces the ACTIVE stage's selection **except
`unlockedTiers`, which keep the current global value** (r3 fold — tiers
are progression, not plan content; graph untouched).
This keeps Phase 1's diff honest and Phase 3's design free. Recorded
loudly so nobody mistakes it for the final semantics.

## Testing posture (inherited; zero new deps)

- `reconcile.test.ts` (core): table-driven exact cases — under/over/exact
  with fractional rates (75/2-class), dangling ends, empty inputs.
- Store tests: default-stage boot (v1 equivalence: the existing 54-row
  store suite keeps passing UNCHANGED — that suite IS the compatibility
  proof); add/remove/rename stages; active-cursor switching; link
  add-refusals (self, duplicate consumer-item) vs kept-and-flagged
  (dangling after recipe change); cascade on removeStage +
  active-cursor-move + last-stage-refusal; **re-upload re-validates EVERY
  stage** (inactive dangling recipeId → null, overrides cleared — the B1
  pin); reconciliation recompute per the cadence table (one row per
  mutation class); tiers-write-to-all-stages re-derives all solves;
  cycles permitted without findings (structural indifference row).
- Smoke: none needed this phase (no UI change beyond App reading through
  the two selectors — existing smoke suite keeps passing, which is itself
  the assertion).
- Bidirectionality log: `features/chained-stages/phase-1/r2-verification.log`
  (created at implementation).

## Assumptions ledger

1. Post-#11 store surface as read this session (13 actions, plans chain,
   Selection shape) — grounded: store.ts @ post-#11 develop.
2. The existing store test suite passing unchanged is a sufficient
   single-stage compatibility oracle — grounded: it exercises every v1
   action against the same signatures the shim preserves.
3. `FeedLaneResult.totalDemand` / `OutputLaneResult.totalOutput` are the
   correct totals for link comparison — grounded: manifold.ts types
   (D = N×d clock-scaled; totalOutput mirrors).
4. Per-link local reconciliation needs no graph traversal (cycles cost
   nothing) — by construction: each finding reads exactly one link's two
   endpoint solves.
5. Writing tiers to all stages preserves the frozen Selection shape;
   the persist merge/partialize pair is REWRITTEN (not inherited) to the
   active stage's copy, with the default stage present in the initial
   state before hydration (r1 fold — Axis 1).

## Revision history

- **r1 correctness (2026-08-03):** code-reviewer NEEDS_REWORK (1 IMPORTANT
  + 2 NIT); adversarial NEEDS_REWORK (3 blocking + 3 in-place). Folded in
  v2:
  1. **B1 — multi-stage catalog replacement:** uploadDocsText (parse
     success) gives EVERY stage the #5 treatment (recipeId re-validation +
     override clear) and re-derives all solves. `init` re-derives all
     stages but needs NO #5 treatment (r2 correction: persistence is
     tiers-only, so every stage at init is default — derive's dangling
     guard suffices; an override-clear there would be spurious).
  2. **B2 — cadence enumerated:** the mutation table replaces "any
     change"; setUnlockedTiers/upload/init re-derive ALL stages.
  3. **B3 — cycle contradiction resolved by DROPPING cycle-flagging**
     from Phase 1 (per-link reconciliation is cycle-indifferent; a canvas
     indicator is a deferred Phase 2 question, noted in FEATURE.md).
  4. **N1 — persistence:** merge/partialize rewrite acknowledged; default
     stage pinned to the initial-state literal (pre-hydration).
  5. **N2 — loadPlan cadence** covered by the table (dangling-link
     findings surface naturally).
  6. **N3 — removeStage edges:** cursor moves to first remaining;
     last-stage removal refused (≥1 invariant).
  7. **NITs:** "six selection setters" wording; dangling-link both-null
     tie-break = end:"from".
- **r2 correctness (2026-08-03):** code-reviewer NEEDS_REWORK (1 IMPORTANT
  + 1 NIT); adversarial APPROVED_WITH_NITS (2). Folded in v3:
  1. **Tier-seeding on CREATE (IMPORTANT):** addStage seeds unlockedTiers
     from the ACTIVE stage's copy — the tiers-global invariant now holds
     on set, hydrate, AND create paths.
  2. **init/#5 divergence corrected:** init re-derives all stages, no
     override-clear (vacuous — persistence is tiers-only, init stages are
     default; spurious-clear risk removed).
  3. stageOrder splice stated; provenance pin de-hashed.
  Refuted clean r2: B1×catalogSource/uploadError independence;
  all-stage clear matches the #5 epic letter; plan-chain ops correctly
  absent; cycle drop honest; tie-break determinism.
- **r3 correctness (2026-08-03):** code-reviewer APPROVED_WITH_NITS (1 —
  half-applied hash de-pin, folded); adversarial NEEDS_REWORK (1 BLOCKING).
  Folded in v4: **loadPlan was a fourth unenumerated tier-write path**
  (desync trace: load a plan with old tiers into one of several stages) —
  resolved as option (b): loadPlan PRESERVES the current global tiers
  (tiers are progression, not plan content), deliberately superseding the
  Stage-2 tier-restore semantics (test row updates at implementation;
  flagged for boundary reviewers). Tier-write inventory now exhaustive:
  set / hydrate / create / loadPlan — "active = any" inductive.
  Refuted clean r3: init-row consistency; splice; removeStage×tiers.
- **r4 correctness (2026-08-03):** code-reviewer APPROVED_WITH_NITS (2) +
  adversarial NEEDS_REWORK (1 IMPORTANT + 1 NIT), largely the SAME finding
  from both (the adversarial reviewed pre-parallel-fold). Folded in v5:
  both superseded Stage-2 tests named with accurate fates (clamp-on-load
  path REMOVED with its test; round-trip re-pointed); the write-only /
  dead-on-read tiers consequence acknowledged; Axis 4 carve-out added;
  supersession logged in FEATURE.md Decisions. Refuted clean r4: desync
  sealed; inventory exhaustive (four write-sites traced, no fifth);
  merge-propagation vacuously real; exactness AC untouched.
