# Stage 7 / Phase 1 — transport core math (ticket #31) — brainstorm v3 (FROZEN)

**Goal.** A pure `src/core` transport solver: given a link's required rate and
a transport mode + trip parameters, compute the sustaining fleet — belt/pipe
run counts for continuous modes; vehicle counts for truck/train/drone; and for
trains, the cars-per-train vs number-of-trains space as comparable options
(Michael's verbatim requirement). Every constant cites
`docs/research/transport-facts.md` (P0, frozen @ develop 8cbce08).

## Already settled — do NOT re-litigate

- Fact source: `docs/research/transport-facts.md` is the single citation
  source; description strings are non-authoritative (epic #27 P0 decision).
- **User-supplied trip time is the primary input** for vehicle modes;
  `distance / topSpeed` only as a labeled optimistic bound (fact table
  Unknowns #1/#8, epic decision).
- Train tradeoff structure: cars scale cargo at zero time cost (parallel
  docking in one 27.08 s lockout) but cost one 50 MW platform per car per
  end; more trains divide effective round-trip (fact table, epic decision).
- Drone model: `T_round = 2d/v(fuel) + 102 s`; batteries = 4 + 1/km at 6000
  MJ; fuel-speed table (fact table).
- src/core is pure TS, exact `Fraction` rationals, floats only at labeled
  display boundaries (repo architecture; CLAUDE.md).
- All-Claude review roster (epic #2 decision, user directive).

## Axis 1 — module shape & constants home

**Pick: `src/core/transport.ts` (solver) + `src/core/transport-facts.ts`
(constants), mirroring the `reconcile.ts` idiom and the `tiers.ts` precedent.**

- `transport.ts`: pure functions, typed input structs, discriminated-union /
  plain-data results, doc header citing this brainstorm — exactly the
  `reconcile.ts` shape. No store, no DOM, no catalog dependency.
- `transport-facts.ts`: the P0 constants as `Fraction`s, each with a comment
  citing its fact-table row (the `src/data/tiers.ts` precedent for
  hardcoded-cited constants — but living in core, importing only
  `./fraction.ts`). It holds ONLY the vehicle/train/drone constants that
  have no existing home: vehicle cargo slots (Truck 48, Tractor 25,
  Explorer 12, Drone 9, Freight Car 32), fluid volumes (Fluid Truck 3200,
  Freight Car 2400 m³), docking times (truck 8 s, fluid-truck 9 s, train
  lockout 27.08 s, drone 2×51 s), drone trip energy (24 000 MJ + 6 MJ/m),
  battery 6000 MJ, top speeds (as optimistic-bound inputs only), station
  powers (truck 20 MW, train station 50 MW, platform 50 MW, drone port
  100 MW), loco flat-haul guidance (13 cars). **Belt/pipe tier rates are
  NOT in this module** — see Axis 2: they stay in `src/data/tiers.ts` and
  reach the solver as caller-supplied parameters (the lint layering bans
  core→data imports, even type-only; `manifold.ts` already models the
  correct params-in shape with its `capacities` input field).
- **Why not extend the catalog parser to admit vehicles:** the loader's
  admission regex is FGBuildable-scoped by design; vehicles are a different
  class family, and P1 needs five scalar capacities, not a parser feature.
  If a later phase wants parser-sourced vehicle rows, that is its own
  data-layer decision (flagged for P2, not assumed).
- **Stack size is a caller-supplied parameter** (`stackSize: Fraction` per
  item). The catalog does not currently carry `mStackSize`; adding it is a
  data-layer change that belongs to P2 (which owns how the UI resolves item →
  stack). P1's math just takes the number. (The enum→number table lives in
  the fact table; P2 will need the parser to read `mStackSize` + map the six
  enum values — recorded as a P2 input, not done here.)

## Axis 2 — per-mode fleet model (all exact)

Everything below is exact rational — no floats anywhere in P1. Times in
seconds (`Fraction`), rates in items-or-m³ per minute (`Fraction`), distances
in meters. The 60 s/min conversion is explicit at each formula site.

**Continuous modes (belt, pipe):**
`runs = ceil(rate / laneRate)` where `laneRate: Fraction` is a
**caller-supplied parameter** — the caller (src/data / src/ui) resolves the
tier from `TIER_TABLE` and passes the rate in, exactly as `solveStage` takes
`capacities: { belt: Fraction[]; pipe: Fraction[] }` today. No tier numbers
are duplicated OR imported into core (core→data imports are lint-banned).
The pipe nominal-ceiling caveat (sloshing) is a MODULE-LEVEL INVARIANT: a
doc-comment on the pipe result type, not a per-result field — P2 keys its
caveat wording off the result type it statically holds (simplify fold, v3).

**Vehicle modes (truck, tractor, explorer, fluid truck, train, drone):**

```
cargoPerTrip = slots × stackSize        (solid)  |  tankVolume (fluid)
T_round      = T_trip + dockingOverhead (mode-specific, from facts)
ratePerVehicle = cargoPerTrip × 60 / T_round     (per minute)
nVehicles    = ceil(rate × T_round / (cargoPerTrip × 60))
```

- `T_trip` input is a discriminated union — the honest-input rule as a type:
  `{ kind: "measured"; roundTripSeconds: Fraction }` (user measured it
  in-game; primary) or `{ kind: "estimated"; distanceMeters: Fraction }`
  (module computes `2 × d / v_top` — a lower bound). Every result carries
  `tripBasis: "measured" | "estimated"` so P2 can label optimism without
  re-deriving it.
- Docking overhead per mode: truck-likes `2 × 8 s` (fluid truck `2 × 9 s`),
  trains `2 × 27.08 s`, drones `102 s` total (2 × 51 s). From
  `transport-facts.ts`, cited.
- Mode/phase legality (pipe-only-fluids, no-fluid-drones, fluid-truck/
  freight-car fluid variants) is a P1 concern only insofar as the math needs
  the right capacity constant: the API takes `cargo: {kind:"solid", slots,
  stackSize} | {kind:"fluid", tankVolume}` and cannot express an illegal
  pairing (e.g. the drone helper only accepts solid cargo). Enforcing which
  modes a given item may use in the UI is P2's job.

**Truck-station belt ceiling** is NOT modeled in P1 (station buffer 48 slots
+ 3-in/2-out belts): transfer is instant as of 1.2 and multi-vehicle
queueing is explicitly not groundable (fact table Unknown #3) — no fake cap
is computed, and the unmodeled-queueing caveat is a doc-comment on the
truck result type (module-level invariant, not a per-result field; the
provable-claim discipline puts honesty in what P2 renders, as S6 did with
the ≈ label — simplify fold, v3).

## Axis 3 — train cars-vs-trains enumeration

**Pick: enumerate consist sizes, return ALL feasible options as comparable
rows — no ranking, no "best" (Michael: comparable options, not a single
answer).**

```
trainOptions(rate, cargoPerCar, T_round, opts) -> TrainOption[]
TrainOption = {
  carsPerTrain: number            // c = 1 .. maxCars (default 13; override in opts).
                                  // Also the platform count per route end — one
                                  // platform per car (fact table); no separate field
  nTrains: number                 // ceil(rate × T_round / (c × cargoPerCar × 60))
  stationPowerMw: Fraction        // 2 × (50 + 50×c): TWO physical stations (one per
                                  // route end), each one 50 MW Train Station + c
                                  // 50 MW platforms (symmetry: Assumption #6)
  locosSuggested: number          // ceil(c / 13) flat-haul guidance
  throughput: Fraction            // delivered rate this option sustains
  perPlatformCeiling: Fraction    // min(cargoPerCar×60/T_round, (T_round−27.08s)/T_round × beltFeed)
  ceilingBound: boolean           // true when the per-platform ceiling binds (a REAL
                                  // discriminator — varies per row; stays)
}
// Type-level doc-comment: same-track multi-train feasibility (headway/signal
// blocks) is qualitative and NOT modeled (fact table Unknown #7) — a
// module-level invariant, not a per-row field (simplify fold, v3).
```

- Enumeration bound: `c = 1..maxCars`, default 13 (the flat-haul guidance
  from the fact table — beyond it a flat consist needs multiple locos; the
  option row surfaces `locosSuggested` instead of silently capping). Callers
  (P2 UI) may raise the bound; the math is total either way.
- `beltFeed` defaults to the caller's belt tier × 2 (dual-feed per platform,
  fact table) — a parameter, not an assumption.
- The per-platform ceiling formula is the fact table's, applied exactly; the
  27.08 s enters as `Fraction.of(2708, 100)`.
- Multi-train same-track feasibility stays qualitative: the invariant lives
  in the result type's doc-comment; P2's caveat wording keys off holding a
  TrainOption at all, not off a runtime constant.

## Axis 4 — drone model

```
droneFleet(rate, stackSize, fuel, tripInput) -> {
  nDrones, ratePerDrone, tripBasis,
  batteriesPerTrip: Fraction | null,   // (24000 + 6 × d_roundtrip) / fuelMJ; null when tripBasis=measured and no distance given
  portPowerMw: Fraction,               // 100 per home port, constant
}
// Type-level doc-comment: destination-port queueing beyond one drone per
// port is not modeled (fact table Unknowns) — module-level invariant, not a
// per-result field (simplify fold, v3).
```

- `v(fuel)` from the fact-table fuel-speed table (7 rows, `transport-facts.ts`).
- cargo = `9 × stackSize`, solid only (typed away, Axis 2).
- Battery/fuel cost needs a distance; with a measured-time-only input the
  energy cost is honestly `null` (P2 may prompt for distance separately),
  never inferred from time × speed (that would launder the speed assumption
  back in).
- `d_flight` ambiguity (Unknown #4): the API names the parameter
  `roundTripFlightMeters` and the result is exact in terms of it; what the
  user should enter is P2 guidance.

## Axis 5 — non-goals (P1 boundary)

- No UI, no wording — results are plain data with caveat FLAGS; P2 owns all
  display text (the S6 advice.ts split: core math exact, UI labels floats).
- No plan-schema change (link transport mode/distance persistence is P2).
- No catalog/parser change (stack-size parsing is P2's input; noted above).
- No pathfinding/physics: trip time is input, never computed from a map.
- No float anywhere: P1 introduces NO new float boundary — display rounding
  stays in `src/ui` (advice.ts / format.ts pattern).

## Test plan sketch

Fact-table validation targets as fixtures: the wiki's precomputed train
ceilings recomputed from the formula with the EXACT lockout constant —
they cross-check against the wiki's figures within the wiki's own rounding
artifact (the wiki used its rounded 0.4513 min, so e.g. stack 50 → exact
800000/559 ≈ 1431.13 vs the wiki's displayed 1431.17; amendment per the
#31 boundary decision, 2026-08-04), drone battery cases
(0 km → 4 batteries; 5 km → 9), truck example (48 × 100 stack, 60 s measured
round trip + 16 s docking → exact fleet), estimated-vs-measured basis
propagation, enumeration bound + ceiling-binding rows, ceil edge (exact
divisibility → no over-count). Bidirectionality log per the R2 rule.

## Assumptions ledger

1. Docking overhead is additive to user-measured drive time (the user
   measures driving, the module adds docking) — API doc states it; if a user
   measures full round trip including docking, P2 can offer a toggle
   (P2 scope). Grounded: fact-table docking rows are fixed animations.
2. The 27.08 s lockout applies per docking END (departure + destination),
   i.e. `2 ×` per round trip — grounded in the fact table's train formula
   section (`T_round = T_travel + 2 × 27.08 s`).
3. Consist docking is parallel (all cars in one lockout) — fact table,
   platforms row.
4. Belt/pipe tier rates reach the solver as caller-supplied `Fraction`
   parameters resolved from `src/data/tiers.ts` by the caller — the lint
   layering bans core→data imports (eslint.config.js core block, type-only
   included), and `manifold.ts`'s `capacities` input field is the
   established legal shape (both verified in source this session).
5. Stack sizes arrive as `Fraction` params from the caller; the six-value
   enum mapping is the fact table's (P2 wires it).
6. `stationPowerMw` assumes a SYMMETRIC station set — one 50 MW Train
   Station + c 50 MW platforms at EACH of the two route ends (the normal
   load/unload pairing). A route with an asymmetric end (e.g. unload-only
   sharing an existing station) differs; P2 may expose per-end overrides if
   wanted. Grounded: fact-table station/platform power rows.

## Revision history

- v1 (2026-08-04): initial, grounded in the frozen fact table + reconcile.ts
  / tiers.ts source reads.
- v2 (2026-08-04): dual-review r1 folds (both reviewers NEEDS_REWORK on the
  same defect):
  - BLOCKER (both) — v1's "re-export tiers.ts through transport-facts.ts"
    violated the core purity lint (core→data banned, type-only included;
    v1's Assumption #4 had verified only tiers.ts's export shape, not the
    layering). Folded to the reviewers' shared fix, which is the repo's own
    idiom: tier rates are caller-supplied params (manifold.ts `capacities`
    precedent); transport-facts.ts holds only the homeless vehicle
    constants; Assumption #4 rewritten with the real grounding.
  - NIT (both) — the `2×` in stationPowerMw was an implicit symmetric-ends
    assumption: made explicit in the field comment + new Assumption #6.
- v3 (2026-08-04): simplify pass (one-shot, post-convergence)
  APPROVED_WITH_NITS. Dispositions:
  - N1 FOLDED (the reviewer's strongest finding, and correct): the four
    always-true caveat fields (nominalCeiling / stationQueueingUnmodeled /
    headwayUnmodeled / destinationQueueingUnmodeled) carried zero
    information and cited an "S6 data-flag precedent" that does not exist
    (S6's honesty mechanism is the ≈ label; every real core boolean varies
    per case). Replaced with doc-comments on the result types —
    module-level invariants stated once. `ceilingBound` (genuinely varying)
    stays.
  - N3 FOLDED: `platformsPerSide` was `carsPerTrain` restated; dropped,
    identity doc-commented on `carsPerTrain`.
  - N2 REJECTED (keep `tripBasis`), per the reviewer's own lean: results
    are handed to display helpers that do not hold the trip input (the S6
    advice.ts narrow-params idiom), and the echo keeps the optimism label
    derivable from the result alone — the exact mislabeling the
    honest-input rule guards against.
  - N4–N7: reviewer affirmations (enumeration shape, facts module split,
    trip union, generic-core + thin wrappers) — no change.
