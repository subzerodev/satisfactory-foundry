# Stage 7 / Phase 2 — transport UI (ticket #32) — brainstorm v3-r4 (FROZEN)

**Goal.** Links carry a transport mode + trip input; the UI surfaces the P1
fleet math where the user plans: a link inspector shows the computed fleet and
the train cars-vs-trains comparison; edges get a compact transport summary;
genuinely infeasible transport is a finding. Plus the owed P1 non-goal:
`mStackSize` into the catalog.

## Already settled — do NOT re-litigate

- P1 API is frozen and landed (develop a916912): `continuousRuns(rate,
  laneRate)`, `vehicleFleet(rate, cargo, trip, dockSecondsPerEnd)`,
  `trainOptions(rate, cargoPerCar, roundTripSeconds, opts)`, `droneFleet(…)`.
  Tier rates / stack sizes / top speeds are CALLER-supplied; `tripBasis`
  echoes measured/estimated; `batteriesPerTrip` is null on
  measured-without-distance; module invariants are type doc-comments whose
  display wording P2 owns (epic #27 P1-landed decision).
- User-supplied trip time primary; `distance / topSpeed` a labeled optimistic
  bound (epic decision; fact table Unknowns).
- Provable-claim wording only (the S6 precedent); floats confined to labeled
  UI display boundaries (advice.ts / format.ts pattern).
- Fact table = the constant source; description strings non-authoritative.
- All-Claude roster; full gate.

## Axis 1 — plan schema: where per-link transport config lives

**Pick: `StageLink.transport?: LinkTransport` (state) ↔ `PlanFileV3` with
optional `transport` on `PlanLinkV3` (persistence), explicit v2→v3 migration.**

```ts
// src/state/store.ts — runtime shape. RAW USER TEXT, parsed at derive time —
// the established Selection idiom (clockPercentText / capacity overrides are
// stored as strings and Fraction.parse'd in the derive with errors surfaced).
// MODE-DISCRIMINATED (the P1 Cargo/DroneTripInput discipline: illegal states
// are unrepresentable, not runtime-guarded — simplify fold, v3):
type LinkTransport =
  | { mode: "belt" | "pipe" }                       // trip-less continuous
  | {
      mode: "truck" | "tractor" | "explorer" | "fluid-truck" | "train";
      // UNITS: estimated distance is ONE-WAY meters for all five modes —
      // the UI labels it "one-way distance". MECHANISM differs by entry
      // point (see the P1-routing note below): the four road modes hand a
      // TripInput to vehicleFleet, which doubles and adds docking
      // internally; TRAIN goes to trainOptions, which takes plain
      // roundTripSeconds — the P2 derive itself computes
      // 2×d / v(LOCOMOTIVE_TOP_SPEED_KMH) + 2×TRAIN_LOCKOUT_SECONDS for
      // estimated, and passes measured seconds straight through (the
      // caller owns the lockout per the trainOptions doc contract).
      trip: { kind: "measured"; roundTripSecondsText: string }
          | { kind: "estimated"; distanceText: string };
    }
  | {
      mode: "drone";
      fuel: DroneFuel; // default "battery" at creation
      // UNITS: drone distance is ROUND-TRIP flight meters (the P1
      // DroneTripInput arm names) — labeled "round-trip flight distance".
      // The measured arm's optional flightMetersText is the battery-cost
      // add-on; the estimated arm's flightMetersText IS the trip input.
      trip: { kind: "measured"; roundTripSecondsText: string;
              flightMetersText?: string }
          | { kind: "estimated"; flightMetersText: string };
    };
```

The units trap (one-way vs round-trip) is thereby enforced by field NAMES per
arm, not a prose warning: no drone field can be fed a one-way distance and
vice versa; `fuel` cannot exist on a truck link; a flight add-on cannot
appear on an estimated drone trip (whose distance is already the input).

Parse errors surface exactly like clock errors do today (derive-time error on
the owning surface, never a crash).

- **`transport` is OPTIONAL; absent ⇒ `mode: "belt"`** — today's implicit
  semantics stay the default, so every existing plan/link keeps its exact
  current meaning and rendering. No config = no new UI noise.
- **File form (`PlanLinkV3`)**: `PlanLinkV2 + transport?` — i.e. the
  INDEX-based `{from, to, itemId}` link identity stays exactly as today
  (state links are id-based, file links index-based; the existing id↔index
  bridge at save/load is untouched). Only the TRANSPORT PAYLOAD is shared
  verbatim between state and file: both carry the same raw user text (the
  Selection precedent — plan files carry `clockPercentText` etc. unparsed).
  Validated by extending
  `validatePlanFile`: mode ∈ the enum, trip/flight strings must
  `Fraction.parse` positive, the drone arm's `fuel` ∈ the 7-key `DroneFuel`
  union. Invalid
  transport on an otherwise-valid link **fails validation** (consistent with
  the file validator's strictness elsewhere — no silent dropping).
- **Migration `migrateV2`**: mechanical — links map to themselves with
  `transport` absent. Save always writes v3 (the v1→v2 precedent).
- **Why per-link and not per-stage-pair or global:** Michael's requirement is
  per-route ("mine coal in one location and transport … to the other");
  a link IS the route.

## Axis 2 — stack size into the catalog (the owed P1 input)

**Pick: `CatalogItem.stackSize: Fraction | null` (null for fluids), parsed
from `mStackSize` via the fact-table enum map; `CATALOG_PARSER_VERSION → 3`.**

- Enum map (fact table §Stack sizes): SS_ONE 1, SS_SMALL 50, SS_MEDIUM 100,
  SS_BIG 200, SS_HUGE 500. **SS_FLUID → `null`** (fluid cargo math uses tank
  volumes, never stacks; the fact table records the slot-volume as
  planner-irrelevant). An UNRECOGNIZED enum value also → `null` (honest
  absent, not a guessed number) — solid-vehicle math for such an item is
  unavailable rather than wrong, surfaced as "stack size unknown" in the
  inspector.
- Parser version 2 → 3: existing caches discard + re-parse (the established
  stale-discard semantics; uploads fall back to bundled — no raw source
  stored, unchanged posture).
- Serialization: items currently ROUND-TRIP RAW through catalog-store
  (`items: catalog.items` / `items: data.items`) — safe only because
  CatalogItem has no Fraction fields today. Adding `stackSize` therefore
  requires a NEW `StoredCatalogItem` shape (`stackSize` as `string | null`)
  plus `serializeItem`/`reviveItem`, following the StoredRecipe/
  StoredMachinePower pattern — it does NOT join an existing item path
  (structured clone would silently strip the Fraction prototype otherwise).
- Consumer churn (mechanical but budgeted): every CatalogItem construction
  site must gain the field — the docs-loader item literal, and fixtures in
  catalog-store.test.ts, graph-flow.test.ts, stage-input.test.ts
  (smoke.test.tsx builds no CatalogItem — r2 verified, no edit there);
  docs-loader.test.ts's EXACT-KEYS assertion on item objects
  (["displayName","id","isFluid"]) must add "stackSize".

## Axis 3 — surfaces: link inspector + edge summary

**Pick: a `LinkInspector` panel (selected-edge side panel, the FindingsPanel /
SummaryCards visual idiom) as the transport home; edges get one compact
summary chip. No transport UI on stage cards.**

- **Edge selection**: `@xyflow/react` 12.x supports selectable edges and
  nothing in GraphCanvas disables interactivity — but the CURRENT
  `onEdgesChange` handles only `remove` and explicitly discards selection
  changes. P2 adds the `select` arm (mirroring the existing node select
  handler) and tracks a `selectedLinkId`. Selecting a link opens the
  inspector (deselect closes). The inspector shows:
  - the link identity line (producer → consumer · item · required rate — the
    solved link demand, the same solved-only discipline as S6 power);
  - **mode select** (8 options, filtered by phase legality: fluid items offer
    pipe / fluid-truck / train; solids offer belt / truck / tractor /
    explorer / train / drone — the P1 `Cargo` union made illegal pairings
    untypeable; the UI simply never offers them). Tractor/explorer/
    fluid-truck clear the surface-area bar because each is already a P1
    constant tuple served by the generic `vehicleFleet` — one select option
    + one legality-row entry each, zero new math or caveat surface
    (simplify-affirmed, v3);
  - **trip input** for vehicle modes: a measured/estimated toggle + one
    number field (seconds or meters) — mirroring the honest-input union
    1:1; estimated results are ALWAYS suffixed "at top speed — optimistic"
    (driven by the tripBasis echo for vehicleFleet/droneFleet results;
    TrainOption carries no echo, so the train suffix is driven by the
    input's own trip.kind);
  - **results**: fleet line ("3 trucks sustain 480/min over this trip"),
    station/port power for the mode (from the P1 catalogue constants),
    battery line for drones (or "add distance for battery cost" when null);
  - **train mode**: the comparison table — one row per `TrainOption`
    (cars | trains | station MW | sustained rate | "station-limited" marker
    on `ceilingBound` rows; platforms/end is NOT a column — it equals cars,
    stated once in a "1 platform per car per end" footnote). All rows shown
    (Michael: comparable options, no "best"); `beltFeed` = the plan's
    unlocked belt tier × 2 (dual feed, the P1 default rule) with the tier
    named in a footnote line;
  - **caveat lines** (the P1 invariant doc-comments made words, each a fixed
    provable sentence): pipe "nominal ceiling — manifolds can sustain less",
    truck ">1 vehicle: station queueing not modeled", train "signal headway
    not modeled", drone "shared destination ports queue".
- **Edge label chip**: configured non-belt links append a compact summary to
  the existing edge label — mode + count ("· 3 trucks", "· 2×4-car trains",
  "· 5 drones"), with "≈" when estimated-basis. Belt-mode links render
  exactly as today (zero visual change for existing plans).
- **Float boundary**: all rendered numbers go through the existing
  advice.ts/format.ts labeled boundary idiom — a new `transport-text.ts`
  UI helper module (pure, testable, advice.ts's sibling) owns
  fleet/option-row/caveat text so the components stay thin.

## Axis 4 — findings integration

**Pick: exactly ONE new finding type — `transport-rate-unsustainable` — and
only where the math proves it: a train link whose required rate exceeds
what one station pair can sustain at any enumerated consist size.**

- **The exact predicate** (in exposed P1 fields only):
  `rate > perPlatformCeiling × maxCars`, evaluated on the max-car row —
  per-platform ceiling × platform count (one platform per car). NOT
  `throughput < rate` (`throughput` is the delivered rate of a ceil-rounded
  fleet and is the wrong test).
- The finding's hint reuses the S6 provable wording shape: "a faster belt
  feed would raise the station ceiling" — gated directly on that row's
  `ceilingBound` (its documented meaning IS "the belt-feed arm binds"); no
  UI-side recomputation of the min() arms is needed or wanted.
- NOT findings (rejected): under-configured links (belt default is valid);
  truck/drone counts (any rate is sustainable by adding vehicles — the
  unmodeled-queueing caveat is a caveat line, not a finding; inventing a cap
  would violate provable-claim); estimated-basis (a label, not a problem).
- Wiring: the findings assembly follows the S6 FindingsPanel prop pattern
  (data computed in graph-flow/store derive, wording in the panel).

## Axis 5 — non-goals (P2 boundary)

- No transport power in the chain Σ / SummaryCards: stations and ports
  belong to routes, not stages — mixing them into the per-stage Σ changes
  its meaning. Recorded as a P3-or-later decision (the combined blueprint is
  where sites/stations become spatial anyway). Inspector-only display.
- No vehicle admission into the catalog parser (P1 catalogue constants
  serve; re-decide only if a phase needs per-mod vehicle data).
- No pathfinding/auto-distance: distance/time entry is manual (P3 may feed
  measured-on-blueprint distances — its brainstorm decides).
- No one-click "apply suggested mode"; no per-end station-power overrides
  (Assumption #6's pointer stays future).
- In-scope housekeeping (r2 adversarial catch): correct transport.ts's
  `ceilingBound` doc-comment — it claims the flag "varies across the
  enumeration," but both ceiling terms are c-independent, so it is constant
  across rows for fixed inputs (a real per-CONFIG discriminator, not
  per-row). One comment line, fixed in the P2 diff.

## Test plan sketch

transport-text rows (fleet/option/caveat/estimated-suffix wording, exact "80
MW"-style vs ≈ discipline); store: link transport set/clear actions +
re-derive; plan-store: v3 round-trip, v2→v3 migration (absent transport),
validator refusals (bad mode, unparseable Fraction string, zero trip);
docs-loader: stackSize parse rows (each enum value, fluid null, unknown-enum
null) + parser-version discard; graph-flow: edge chip presence/absence +
≈-on-estimated; findings: the unsustainable-train case + its binding-arm hint
gate. Bidirectionality log per the R2 rule. Browser walk on the live chain
(Michael's plan: configure a train link, read the comparison table).

## Assumptions ledger

1. React Flow edge selection is available on 12.11.2 and nothing disables
   it wholesale (verified in GraphCanvas props this round); the missing
   piece is OUR handler — `onEdgesChange` currently drops selection changes,
   so P2 adds the select arm (Axis 3). If custom edges need
   `interactionWidth`/selectable props, that's mechanical (drift hunt).
2. The plan-file Fraction-as-string convention matches Selection's existing
   serialization (verified: plan files store Selection; clock strings parse
   via Fraction) — the validator extension mirrors it.
3. Solved-only discipline: transport results render only when the link's
   required rate resolves (producer+consumer solved); unsolved links show
   the mode select but no fleet math (mirrors S6 power rendering).
4. `beltFeed` from the plan's unlocked belt tier × 2 assumes both feed belts
   are the same tier — the game's dual-feed platform norm (fact table); a
   per-platform override is future scope. "The plan's unlocked belt tier" is
   WELL-DEFINED for a two-stage link: unlockedTiers is a plan-global
   invariant (the store stamps the current global tiers over every stage —
   "tiers are progression, not plan content"), so a link's endpoints cannot
   disagree (confirmed by both r1 reviewers against store source).
5. The P1 drone measured arm accepts optional `roundTripFlightMeters` for
   the battery estimate, and the drone estimated arm's distance is
   ROUND-TRIP flight meters while the road `TripInput` estimated distance is
   ONE-WAY (both verified in transport.ts source this session — the Axis 1
   units trap note encodes this).
6. **Train P1 routing contract** (r3 fold): train links call `trainOptions`,
   NOT `vehicleFleet` — it takes plain `roundTripSeconds` and its doc
   contract puts the lockout on the caller. The P2 derive builds
   `2×d_oneway / v(LOCOMOTIVE_TOP_SPEED_KMH) + 2×TRAIN_LOCKOUT_SECONDS`
   for an estimated trip and passes measured seconds through unchanged
   (the per-platform ceiling re-subtracts its one window internally —
   P1-documented). All constants are P1 catalogue exports; the union's
   fields are sufficient (both r3 reviewers verified the arithmetic).

## Revision history

- v1 (2026-08-04): initial, grounded in the landed P1 API + store/plan-store
  /docs-loader source reads this session.
- v2 (2026-08-04): dual-review r1 folds — [code-reviewer] NEEDS_REWORK
  (2 IMPORTANT + 2 NITs), [adversarial-reviewer] APPROVED_WITH_NITS (4 NITs),
  overlapping heavily; all six distinct findings folded, both IMPORTANTs
  team-lead-verified against source first:
  - IMPORTANT — items round-trip RAW through catalog-store (no existing item
    serialize path to "join"): Axis 2 now specifies the new
    StoredCatalogItem + serializeItem/reviveItem work.
  - IMPORTANT — CatalogItem field addition breaks fixtures + the
    docs-loader exact-keys assertion: consumer-churn bullet added.
  - NIT — "state and file agree" scoped to the transport payload; PlanLinkV3
    stated as PlanLinkV2 + transport? (index-based identity untouched).
  - NIT — findings predicate corrected to rate > perPlatformCeiling ×
    maxCars on the max-car row; "throughput < rate" phrasing dropped.
  - NIT — binding-arm hint gated on ceilingBound directly (exposed; its
    documented meaning is the belt arm binding) — no arm recomputation.
  - NIT — edge-selection wiring honestly stated: 12.x supports it, the
    current onEdgesChange discards it, P2 adds the select arm.
  - Also recorded: the beltFeed two-stage ambiguity probe RESOLVED in the
    design's favor by both reviewers (unlockedTiers is plan-global).
- v3-r3 (2026-08-04): round 3 scoped to the simplify folds — code-reviewer
  APPROVED_WITH_NITS (2), adversarial NEEDS_REWORK (2 IMPORTANT + 1 NIT),
  same roots; all folded:
  - IMPORTANT — the vehicle arm's units note attributed the road TripInput
    doubling mechanism to trains, but trains route to trainOptions (plain
    roundTripSeconds, caller-owned lockout): the arm comment now splits the
    mechanisms and new Assumption #6 records the full train routing
    contract (both reviewers verified the union's FIELDS are sufficient —
    the defect was mis-attribution, not missing data).
  - IMPORTANT/NIT — "droneFuel" flat-name residue in the validator prose:
    corrected to the drone arm's `fuel`.
  - NIT — the estimated-suffix driver: tripBasis echo exists only on
    vehicleFleet/droneFleet results; the train suffix keys off the input's
    trip.kind. Wording corrected.
- v3 (2026-08-04): simplify pass (one-shot, post-convergence)
  APPROVED_WITH_NITS — all three folded:
  - NIT 1 (the reviewer's strongest, folded): LinkTransport rebuilt as a
    MODE-DISCRIMINATED union (belt/pipe arm trip-less; vehicle arm; drone
    arm carrying fuel + its own trip union) — deletes the two flat drone
    optionals, makes the three illegal states uncompilable, and encodes the
    units trap in per-arm field names. Mirrors P1's Cargo/DroneTripInput
    discipline; the file form mirrors the same union.
  - NIT 2 (folded): one sentence recording why tractor/explorer/fluid-truck
    clear the surface-area bar (existing P1 constant tuples, generic math).
  - NIT 3 (folded): platforms/end dropped as a table column (≡ cars);
    footnote instead.
  - Affirmed without change: the V3 version bump (the validator's strictness
    makes it the simplest correct shape), transport-text.ts as a sibling
    module, the StoredCatalogItem necessity, the single-finding discipline,
    no speculative P3 scaffolding.
- v2-r2 (2026-08-04): round 2 scoped to the folds — adversarial APPROVED
  (0 in-scope; predicate arithmetic proven: both ceiling terms
  c-independent so the max-car row maximizes the pair ceiling; plus an
  out-of-scope catch — transport.ts's ceilingBound "varies per row" comment
  is inaccurate, folded into Axis 5 as P2 housekeeping); code-reviewer
  APPROVED_WITH_NITS (1: smoke.test.tsx builds no CatalogItem — dropped
  from the churn list). Correctness CONVERGED.
