# Satisfactory transport logistics — provenance-cited fact table

Purpose: ground an exact-arithmetic transport planner (given items/min needed at a
destination and a trip distance/time, compute how many belts / pipes / trucks /
trains / drones sustain the rate; for trains, compare cars-per-train vs
number-of-trains).

- **Retrieval date:** 2026-08-04. All wiki facts were fetched live from
  https://satisfactory.wiki.gg on this date — none are from memory.
- **Game version:** the wiki currently reflects **patch 1.2.x** (individual pages
  cite 1.2.0.0–1.2.3.1; last-edited dates April–July 2026). Facts that changed
  between 1.0 and 1.2 are flagged **[1.2 change]** with the 1.0 value where known.
- **Provenance convention:** `Docs.json (parser)` = the repo's bundled game-data
  export (`public/bundled-docs/en-US.json`), which the app can re-derive at any
  time; these rows use the wiki only as a cross-check. The bundled export was
  verified **content-identical** (all 2868 classes, zero field diffs) to the
  locally installed game's own export
  (`~/.local/share/Steam/steamapps/common/Satisfactory/CommunityResources/Docs/en-US.json`,
  UTF-16) on 2026-08-04 — parser rows are grounded in the installed game
  version, not merely a downloaded snapshot. Wiki-grounded rows carry
  the full page URL. **Every Docs.json row below was cross-checked against the
  wiki and agrees unless explicitly flagged.**
- The bundled Docs.json contains `Desc_FluidTruck_C` (introduced to the game in
  patch 1.2.0.0), so the bundled snapshot is itself 1.2-era — Docs.json and the
  wiki describe the same game version, **with one known exception**: the Freight
  Car's `mDescription` string still reads "1600 m³" (the pre-1.2 fluid
  capacity; the real 1.2 value is 2400 m³ — see Trains). Structured fields are
  current; **description strings can lag patches. Never parse capacities out of
  `mDescription` prose** — use structured fields where they exist and the wiki
  where they don't.

A note on wiki speed units: vehicle infoboxes render the unit ambiguously
("m/h"), but corroborating page text uses km/h throughout (e.g. the Factory Cart
page states 50 km/h and "0–50 km/h" acceleration figures, the Explorer's
140 km/h achievement reference, the Tractor's deliberately-chosen 69). All
speeds below are reported as **km/h**.

---

## Stack sizes

Items in Docs.json carry `mStackSize` ∈ {SS_ONE, SS_SMALL, SS_MEDIUM, SS_BIG,
SS_HUGE, SS_FLUID}. The enum→number mapping below is grounded per category by a
representative item's wiki page (the enum membership itself comes from the
parser: 32 / 49 / 609 / 30 / 15 / 15 items respectively).

| Fact | Value | Source |
|---|---|---|
| SS_ONE | 1 (equipment, packages; 32 items in Docs.json) | Docs.json (parser) enum; numeric value is the trivial minimum — no wiki exemplar fetched (see Unknowns) |
| SS_SMALL | 50 — exemplar: Heavy Modular Frame "Stack size 50" | https://satisfactory.wiki.gg/wiki/Heavy_Modular_Frame |
| SS_MEDIUM | 100 — exemplar: Iron Ore "Stack size 100" | https://satisfactory.wiki.gg/wiki/Iron_Ore |
| SS_BIG | 200 — exemplars: Iron Plate "Stack size 200", Battery "Stack size 200" | https://satisfactory.wiki.gg/wiki/Iron_Plate ; https://satisfactory.wiki.gg/wiki/Battery |
| SS_HUGE | 500 — exemplar: Concrete "Stack size 500" | https://satisfactory.wiki.gg/wiki/Concrete |
| SS_FLUID | numeric slot-volume NOT independently grounded (see Unknowns); irrelevant to the planner — every fluid container below publishes an explicit tank volume in m³ | — |

**Planner rule:** solid cargo per vehicle/car = `slots × stackSize(item)`. The
per-item stack size must come from the parser (`mStackSize` enum → this table),
never from a hardcoded per-item list.

---

## Belts (Conveyor Belts Mk.1–Mk.6)

| Fact | Value | Source |
|---|---|---|
| Mk.1 throughput | 60 items/min | https://satisfactory.wiki.gg/wiki/Conveyor_Belts |
| Mk.2 throughput | 120 items/min | https://satisfactory.wiki.gg/wiki/Conveyor_Belts |
| Mk.3 throughput | 270 items/min | https://satisfactory.wiki.gg/wiki/Conveyor_Belts |
| Mk.4 throughput | 480 items/min | https://satisfactory.wiki.gg/wiki/Conveyor_Belts |
| Mk.5 throughput | 780 items/min | https://satisfactory.wiki.gg/wiki/Conveyor_Belts |
| Mk.6 throughput | 1200 items/min (reintroduced in 1.0; unchanged through 1.2.2.0) | https://satisfactory.wiki.gg/wiki/Conveyor_Belts |
| No Mk.7+ exists | confirmed | https://satisfactory.wiki.gg/wiki/Conveyor_Belts |

**Cross-check:** matches the app's existing tier table (60/120/270/480/780/1200)
exactly. No conflict.

---

## Pipelines

| Fact | Value | Source |
|---|---|---|
| Pipeline Mk.1 flow | 300 m³/min | https://satisfactory.wiki.gg/wiki/Pipelines |
| Pipeline Mk.2 flow | 600 m³/min | https://satisfactory.wiki.gg/wiki/Pipelines |
| Pipe segment storage | 1.327 m³ per meter of length | https://satisfactory.wiki.gg/wiki/Pipelines |
| Head lift | required to move liquids vertically (~1.3 m needed even to fill a horizontal pipe); does not apply to gases; pumps add head lift | https://satisfactory.wiki.gg/wiki/Pipelines |
| Sloshing | flow in pipeline manifolds routinely drops below nominal max ("by design and normal"); mitigations: pre-fill pipes, loopbacks | https://satisfactory.wiki.gg/wiki/Pipelines |

**Cross-check:** matches the app's existing 300/600. No conflict.
**Planner caveat:** nominal pipe capacity is an upper bound; manifold sloshing
means real sustained flow can undershoot it (see Planner model implications).

---

## Road vehicles (Truck / Tractor / Explorer / Fluid Truck / Factory Cart) + Truck Station

### Cargo capacities

| Fact | Value | Source |
|---|---|---|
| Truck inventory | 48 slots (solid) | Docs.json (parser) — wiki cross-check agrees: https://satisfactory.wiki.gg/wiki/Truck |
| Tractor inventory | 25 slots | Docs.json (parser) — wiki agrees: https://satisfactory.wiki.gg/wiki/Tractor |
| Explorer inventory | 12 slots | Docs.json (parser) — wiki agrees: https://satisfactory.wiki.gg/wiki/Explorer |
| Factory Cart inventory | 1 slot | https://satisfactory.wiki.gg/wiki/Factory_Cart |
| Fluid Truck tank | **3200 m³** (single fluid inventory) **[1.2 change: vehicle introduced in patch 1.2.0.0 — does not exist in 1.0/1.1]** | https://satisfactory.wiki.gg/wiki/Fluid_Truck (Docs.json cross-check: 1-slot fluid inventory; the Docs.json `mDescription` string also states 3200 m³ — agrees, but description strings are non-authoritative, see intro) |

### Speeds (top speed on flat ground — NOT autopilot cruise; see Unknowns)

| Fact | Value | Source |
|---|---|---|
| Truck top speed | 89 km/h (0–50 km/h in 4 s) | https://satisfactory.wiki.gg/wiki/Truck |
| Tractor top speed | 69 km/h (0–50 km/h in 6.7 s; the value is a deliberate dev choice per wiki commentary) | https://satisfactory.wiki.gg/wiki/Tractor |
| Explorer top speed | 107 km/h (0–50 km/h in 1.8 s; can exceed 140 km/h downhill per achievement note) | https://satisfactory.wiki.gg/wiki/Explorer |
| Fluid Truck top speed | 89 km/h (same chassis as Truck) | https://satisfactory.wiki.gg/wiki/Fluid_Truck |
| Factory Cart top speed | 50 km/h | https://satisfactory.wiki.gg/wiki/Factory_Cart |

### Fuel

| Fact | Value | Source |
|---|---|---|
| Truck manual fuel burn | 75 MW-equivalent (`mManualFuelConsumption = 75`) | Docs.json (parser) — wiki agrees ("75 MW" burn rate): https://satisfactory.wiki.gg/wiki/Truck |
| Fluid Truck manual fuel burn | 75 MW-equivalent | Docs.json (parser) — wiki agrees: https://satisfactory.wiki.gg/wiki/Fluid_Truck |
| Tractor manual fuel burn | 55 MW-equivalent | Docs.json (parser) — wiki agrees: https://satisfactory.wiki.gg/wiki/Tractor |
| Explorer manual fuel burn | 90 MW-equivalent | Docs.json (parser) — wiki agrees: https://satisfactory.wiki.gg/wiki/Explorer |
| Fuel burn time per item | `fuelEnergy(MJ) / burnRate(MW)` seconds (wiki fuel tables are consistent with this, e.g. Packaged Turbofuel 2000 MJ / 90 MW ≈ 22.22 s in the Explorer) | https://satisfactory.wiki.gg/wiki/Explorer |
| Autopilot fuel field | `mAutopilotFuelConsumption = 0.05` on Truck/Tractor/Explorer/Fluid Truck — **units/semantics not documented anywhere consulted** (see Unknowns) | Docs.json (parser) |
| Factory Cart fuel | needs none; Truck Stations will nonetheless force-load fuel into a docked cart (wiki advises keeping fuel out of cart-serving stations) | https://satisfactory.wiki.gg/wiki/Factory_Cart |

### Truck Station (docking + transfer)

| Fact | Value | Source |
|---|---|---|
| Docking animation | **8 seconds** per docking ("The loading / unloading animation takes 8 seconds.") — Fluid Truck Station: **9 s** (`mLoadUnloadCycleLength = 9`, parser-only; no wiki figure found) | https://satisfactory.wiki.gg/wiki/Truck_Station + Docs.json (parser: `Build_TruckStation_C.mLoadUnloadCycleLength = 8`, `Build_FluidTruckStation_C.mLoadUnloadCycleLength = 9`) |
| Transfer model | **instant at end of docking** (as of 1.2) — the in-game "transfers up to 120 stacks per minute" description is a carryover from a previous system and "not actually how they function" **[1.2 change]** | https://satisfactory.wiki.gg/wiki/Truck_Station |
| Station buffer (solid) | 48 slots | Docs.json (parser: `mStorageInventorySize = 48`) — wiki agrees: https://satisfactory.wiki.gg/wiki/Truck_Station |
| Fluid Truck Station buffer | 3200 m³ | https://satisfactory.wiki.gg/wiki/Truck_Station (Docs.json cross-check: 1-slot fluid inventory; the `mDescription` string also states 3200 m³) |
| Belt/pipe I/O | standard: 3 belt in, 2 belt out; fluid: 1 belt in, 2 pipe in, 2 pipe out | https://satisfactory.wiki.gg/wiki/Truck_Station |
| Power | 20 MW operating; 0.1 MW standby | Docs.json (parser: 20 MW) — wiki agrees and adds the 0.1 MW standby figure: https://satisfactory.wiki.gg/wiki/Truck_Station |
| Automation | Truck/Tractor/Explorer/Factory Cart record self-driving routes and dock automatically | https://satisfactory.wiki.gg/wiki/Truck ; https://satisfactory.wiki.gg/wiki/Factory_Cart |

**Docs.json precision:** `mItemTransferRate` / `mMaximumStackTransferRate` are
placeholder-zero in the export precisely because the 1.2 transfer model is
instant-on-undock. The docking *duration* itself IS parser-derivable —
`mLoadUnloadCycleLength` (8 s solid / 9 s fluid station) — and the wiki's 8 s
figure cross-checks it.

---

## Trains (Locomotive / Freight Car / Freight Platform / Signals)

### Rolling stock

| Fact | Value | Source |
|---|---|---|
| Freight Car capacity (solid) | 32 slots | Docs.json (parser) — wiki agrees: https://satisfactory.wiki.gg/wiki/Freight_Car |
| Freight Car capacity (fluid) | **2400 m³** **[1.2 change: raised in patch 1.2.0.0 from 1600 m³]** — ⚠ the bundled Docs.json `mDescription` still says the stale 1600; use the wiki's 2400, never the description string | https://satisfactory.wiki.gg/wiki/Freight_Car |
| A car carries solids OR one fluid, never both / never two fluids | confirmed | https://satisfactory.wiki.gg/wiki/Freight_Car |
| Locomotive top speed | ~120 km/h self-powered on flat rail; automated trains are capped around 200 km/h (reachable only with gravity assist) | https://satisfactory.wiki.gg/wiki/Electric_Locomotive |
| Locomotive power | 25 MW min – 110 MW max; regenerative braking returns up to 33 MW | Docs.json (parser: Min=25/Max=110) — wiki agrees and adds regen figure: https://satisfactory.wiki.gg/wiki/Electric_Locomotive |
| Loco-to-car ratio (flat) | ~13 fully-loaded cars per locomotive on flat terrain; ~100 *empty* cars theoretical flat max | https://satisfactory.wiki.gg/wiki/Freight_Car ; https://satisfactory.wiki.gg/wiki/Electric_Locomotive |
| Loco-to-car ratio (grades) | drops to ~2–3 fully-loaded cars per locomotive on steep 4 m ramps; wiki's design target: consist "should always be capable of reaching at least 54 km/h" on inclines | https://satisfactory.wiki.gg/wiki/Freight_Car ; https://satisfactory.wiki.gg/wiki/Electric_Locomotive |
| Consist size vs top speed | flat-ground top speed is not the limiter; grades are — add locomotives for slopes, not for flat speed | https://satisfactory.wiki.gg/wiki/Electric_Locomotive |

### Stations & platforms

| Fact | Value | Source |
|---|---|---|
| One platform per car | each Freight Car docks at its own (Fluid) Freight Platform; platforms line up behind the Train Station in consist order and all transfer during the same docking | https://satisfactory.wiki.gg/wiki/Freight_Platform ; https://satisfactory.wiki.gg/wiki/Freight_Car |
| Docking lockout | **27 s (0.45 min)** per docking — during it, all belts/pipes on the platform stop; transfer happens within this window. Cited to the game field `mTimeToCompleteLoad = 27.000000`; the wiki's 27.08 s was retired (#140 decision 24796). | Docs.json / headers (`Build_TrainDockingStation_C.mTimeToCompleteLoad`) |
| Platform buffer (solid) | 48 slots; belts fill/drain the buffer between dockings | Docs.json (parser: 8×6 storage) — wiki agrees: https://satisfactory.wiki.gg/wiki/Freight_Platform |
| Platform buffer (fluid) | **3200 m³** **[1.2 change: raised in patch 1.2.0.0]** | https://satisfactory.wiki.gg/wiki/Freight_Platform |
| Platform power | 50 MW during transfer; 0.1 MW at rest | Docs.json (parser: 50 MW) — wiki adds the idle figure: https://satisfactory.wiki.gg/wiki/Freight_Platform |
| Train Station power | 50 MW | Docs.json (parser) |
| Platform belt I/O ceiling | dual Mk.6 belts per platform side → 2400 items/min theoretical belt feed | https://satisfactory.wiki.gg/wiki/Tutorial:Train_throughput |

**Docs.json precision:** `mDockForDuration = 0` in the export (placeholder),
but both platform classes carry `mTimeToCompleteLoad = mTimeToCompleteUnload
= 27.0` — the authoritative game value. The wiki's 27.08 s was RETIRED (#140
decision 24796): the extra 0.08 s has no support in the headers or Docs.json,
so it was a wiki artifact, not a real timer. **Use the game field's 27 s exactly
(= 27/60 = 0.45 min).**

### Sustained throughput per platform (wiki-computed ceilings, dual Mk.6 feed, optimal round-trip duration)

| Fact | Value | Source |
|---|---|---|
| Time-to-Fill formula | `TtF = (stackSize × 32) / beltSpeed + 0.45 min` (solid car; fluid car: 2400 m³ in place of stackSize × 32) | https://satisfactory.wiki.gg/wiki/Tutorial:Train_throughput |
| Throughput, TtF ≥ RtD | `(RtD − 0.45) / RtD × beltSpeed` | https://satisfactory.wiki.gg/wiki/Tutorial:Train_throughput |
| Throughput, TtF < RtD | `(TtF / RtD) × beltSpeed` — wait-limited (see note below) | https://satisfactory.wiki.gg/wiki/Tutorial:Train_throughput |
| Max sustained, stack 50 | 1431.17 items/min per platform | https://satisfactory.wiki.gg/wiki/Tutorial:Train_throughput |
| Max sustained, stack 100 | 1793.08 items/min per platform | https://satisfactory.wiki.gg/wiki/Tutorial:Train_throughput |
| Max sustained, stack 200 | 2052.62 items/min per platform | https://satisfactory.wiki.gg/wiki/Tutorial:Train_throughput |
| Max sustained, stack 500 | 2247.83 items/min per platform | https://satisfactory.wiki.gg/wiki/Tutorial:Train_throughput |
| Max sustained, fluid | 979.06 m³/min per fluid platform (1958.12 m³/min packaged with can-recycling, 2 cars/cycle) | https://satisfactory.wiki.gg/wiki/Tutorial:Train_throughput |
| Optimality condition | ceilings above require RtD exactly equal to TtF — "nearly impossible" in practice; treat as upper bounds | https://satisfactory.wiki.gg/wiki/Tutorial:Train_throughput |

Note on the TtF < RtD branch: the wiki's formula expresses that when the train
returns before the platform can possibly have refilled, throughput is capacity-
limited to one carload per round trip — `(TtF/RtD) × beltSpeed` with the wiki's
TtF is its published form; the planner's cleaner equivalent is
`min(carCapacity/RtD, (RtD − 0.45)/RtD × beltSpeed)` per platform.

### Signals / same-track train count

| Fact | Value | Source |
|---|---|---|
| Block signal rule | one train per block: "When a train is occupying one of these Blocks, other trains will be unable to enter it" | https://satisfactory.wiki.gg/wiki/Train_Signals |
| Path signal rule | multiple trains may enter one block "if their paths within the block do not intersect" (reserved routes) | https://satisfactory.wiki.gg/wiki/Train_Signals |
| Unsignaled shared track | trains collide — signals are mandatory for multi-train routes | https://satisfactory.wiki.gg/wiki/Train_Signals |
| Block sizing guidance | no hard rule; wiki suggests blocks of roughly the longest train's length, up to ~300–400 m to avoid signal spam | https://satisfactory.wiki.gg/wiki/Train_Signals |
| Braking distance | automated trains begin braking ~250 m before a red signal | https://satisfactory.wiki.gg/wiki/Train_Signals |

---

## Drones (Drone / Drone Port / Battery)

| Fact | Value | Source |
|---|---|---|
| Drone cargo | 9 slots per trip (solid only; drones do not carry raw fluids) | Docs.json (parser) — wiki agrees: https://satisfactory.wiki.gg/wiki/Drone |
| Drone Port power | 100 MW **constant** — "always consumes 100 MW regardless if a Drone is docking or not" | Docs.json (parser: 100 MW) — wiki adds the always-on detail: https://satisfactory.wiki.gg/wiki/Drone_Port |
| Port inventories | two 18-slot buffers (outgoing + incoming) | Docs.json (parser: 3×6 storage) — wiki agrees: https://satisfactory.wiki.gg/wiki/Drone_Port |
| Trip energy cost (fixed) | `mTripPowerCost = 24 000 MJ` per round trip | Docs.json (parser) |
| Trip energy cost (distance) | `mTripPowerPerMeterCost = 6 MJ/m` (= 6000 MJ/km) | Docs.json (parser) |
| Battery energy | 6000 MJ each; stack size 200 | https://satisfactory.wiki.gg/wiki/Battery |
| Reconciliation | 24 000 MJ ÷ 6000 MJ = **4 batteries fixed per round trip**; 6000 MJ/km = **1 battery per km** — exactly matching the wiki's patch-note history ("default round-trip Battery cost … to 4", "1 Battery per kilometre", patch 0.4.0.11). Docs.json and wiki agree; fuel energy is the unit, so higher-energy fuels consume proportionally fewer items | Docs.json (parser) + https://satisfactory.wiki.gg/wiki/Drone |
| Fuel-dependent flight speed | introduced in 1.0 ("speed of the Drones is different based on the fuel used"): Packaged Fuel 50 m/s, Packaged Turbofuel 60 m/s, **Battery 75 m/s (270 km/h)**, Packaged Rocket Fuel 75 m/s, Uranium Fuel Rod 90 m/s, Packaged Ionized Fuel 100 m/s, Plutonium Fuel Rod 100 m/s | https://satisfactory.wiki.gg/wiki/Drone |
| Docking overhead | "the landing and take-off animation takes 51 seconds each" per port visit; a round trip touching both ports spends ~102 s stationary in animations even at zero distance | https://satisfactory.wiki.gg/wiki/Drone |
| Fuel draw timing | drone takes the full round-trip fuel at takeoff | https://satisfactory.wiki.gg/wiki/Drone |
| Range | no hard max range documented; fuel "consumed by distance", so range is bounded by fuel carried/available, not a map constant | https://satisfactory.wiki.gg/wiki/Drone_Port |
| Multi-drone ports | a port hosts ONE home drone but can be the *destination* of any number of drones (extras circle and queue — throughput degrades) | https://satisfactory.wiki.gg/wiki/Drone_Port |
| Port item transfer time | not documented on the wiki beyond the animation window (see Unknowns); `mTransferSpeed = 0` placeholder in Docs.json | — |

---

## Planner model implications

Common shape for all vehicle modes (exact rational arithmetic, `Fraction`):

```
cargoPerTrip  = slots × stackSize(item)        (solid)  |  tank m³ (fluid)
sustainedRate = cargoPerTrip / T_round
nVehicles     = ceil(rate × T_round / cargoPerTrip)
```

`T_round` (round-trip time) should be **user-supplied** as the honest primary
input for every vehicle mode — see Unknowns. Where the user supplies distance
instead, the facts above support only *bounds* (top speed → lower-bound time),
which the UI must label as optimistic.

### Belts
`nBelts(mk) = ceil(rate / beltRate[mk])`, beltRate = {60, 120, 270, 480, 780,
1200}. Exact; no time dimension.

### Pipelines
`nPipes(mk) = ceil(rate / pipeRate[mk])`, pipeRate = {300, 600} m³/min — as a
**nominal ceiling**. Surface the sloshing caveat (manifolds sustain less than
nominal); a user-facing derate factor is a UX choice, not a wiki-grounded
number.

### Trucks / Tractors / Explorers / Fluid Trucks
- `cargoPerTrip`: Truck 48 × stack, Tractor 25 × stack, Explorer 12 × stack,
  Fluid Truck 3200 m³ (1.2+ only).
- `T_round = T_drive + 2 × 8 s` (one 8 s docking at each end; 9 s per end for
  Fluid Truck Stations; transfer itself is instant as of 1.2).
- Station-side rate cap: a station moves at most one vehicle-load per
  (8 s + vehicle swap time); swap/queueing time is not wiki-grounded, so the
  planner should cap station throughput only by belt I/O (3 in / 2 out) and
  flag multi-vehicle queueing as approximate.
- Fuel cost per trip ≈ `burnRate(MW) × T_round` in MJ under manual-drive rates
  (75/55/90 MW); autopilot burn semantics are unknown (see below) — present fuel
  as an estimate, not a guarantee.

### Trains
Two coupled decisions the planner can now model exactly:
- **Cars per train** scales `cargoPerTrip = nCars × 32 × stackSize` (or
  `nCars × 2400 m³`) at zero time cost — all cars dock in parallel in the same
  27 s lockout, but each car permanently occupies one 50 MW platform at each
  end. Grade feasibility: warn beyond ~13 loaded cars per locomotive (flat) and
  ~2–3 on steep ramps.
- **Number of trains** divides the effective `RtD` a single consist provides:
  `nTrains = ceil(rate × T_round / cargoPerTrip)` with
  `T_round = T_travel + 2 × 27 s`.
- **Per-platform belt ceiling** (binding at short RtD / big stacks):
  `platformRate ≤ min(carCapacity / RtD, (RtD − 27 s) / RtD × beltFeed)`
  with `beltFeed ≤ 2400/min` (dual Mk.6). The wiki's precomputed ceilings
  (1431/1793/2053/2248 per stack tier; 979.06 m³/min fluid) are good validation
  targets for the exact math.
- **Same-track feasibility:** one train per signal block; more trains on one
  route need the route partitioned into ≥ nTrains blocks plus station
  approaches that don't serialize (path signals). The planner can state this
  qualitatively; there is no wiki-groundable formula for max trains per route.

### Drones
- `cargoPerTrip = 9 × stackSize`.
- `T_round = 2d / v(fuel) + 102 s` (fixed animation overhead; v from the
  fuel-speed table, e.g. 75 m/s on batteries). Long routes amortize the fixed
  102 s — drone efficiency *rises* with distance.
- Battery cost per round trip: `(24 000 MJ + 6 MJ/m × d_flight) / 6000 MJ`
  batteries — i.e. 4 + 1/km. Generalizes to any fuel by dividing by that fuel's
  MJ. Note `d_flight` ambiguity below.
- Rate per drone: `cargoPerTrip / T_round`; `nDrones = ceil(rate / ratePerDrone)`.
  Each drone needs its own home port (100 MW, always-on); a shared destination
  port serializes deliveries (queueing → degrade beyond ~1 drone per
  destination port per `T_round/102 s` slots — approximate, flag it).

### Unknowns / not wiki-groundable

These go to the user as inputs or caveats — do NOT hardcode:

1. **Autopilot cruise speed for road vehicles.** The wiki documents only top
   speeds; real autopilot speed depends on the recorded path (turns, slopes,
   collisions). The planner should accept a **user-supplied trip time**
   (recorded in-game from the vehicle route UI) as the honest input, offering
   `distance / topSpeed` only as a labeled lower bound.
2. **`mAutopilotFuelConsumption = 0.05` semantics/units** — undocumented in
   both Docs.json and the wiki. Do not build fuel math on it.
3. **Truck Station vehicle swap/queueing time** (beyond the 8 s animation) —
   not documented; multi-vehicle-per-station throughput is approximate.
4. **Drone `d_flight` definition** — whether the 6 MJ/m applies to one-way port
   separation, doubled, or actual flown path (drones climb to cruise altitude
   and detour). Present battery cost as ≈ 4 + (round-trip km); let users
   calibrate against observed consumption.
5. **Drone port item-transfer time** distinct from the 51 s animation — not
   documented (`mTransferSpeed = 0` placeholder). Assume transfer completes
   within the animation window.
6. **Exact drone climb/descent profile** (affects `T_round` beyond the 102 s
   constant on short hops).
7. **Max trains per route** — signal-block feasibility is qualitative; no
   closed-form headway number exists (braking ~250 m before red is the only
   hard figure).
8. **Train travel time vs distance** — acceleration curves and grade physics
   are not published; as with road vehicles, prefer user-supplied leg time
   (the in-game timetable shows it), with `distance / 120 km/h` as a labeled
   lower bound.
9. **SS_FLUID numeric slot volume** — the community/modding figure (50 m³ per
   fluid slot) could not be fetched from a citable source this session
   (docs.ficsit.app returned 403); irrelevant to the planner since all fluid
   containers publish explicit tank volumes.
10. **SS_ONE exemplar citation** — value 1 is definitionally trivial and its
    32 members (equipment/packages) are not bulk-transport goods; no wiki page
    was fetched for it. If the planner ever ships SS_ONE cargo math, ground it
    then.
11. **Fluid Truck Station 9 s cycle** — `mLoadUnloadCycleLength = 9` is
    parser-only; no wiki corroboration found for the fluid-station figure
    (the wiki's 8 s statement is on the solid Truck Station page).
12. **1.0-baseline values for the 1.2-changed facts** (fluid freight car, fluid
    platform, fluid truck existence, instant truck-station transfer): this doc
    records current-wiki (1.2.x) values. The bundled Docs.json snapshot matches
    on structured fields, but its Freight Car `mDescription` string retains the
    stale 1600 m³ (see Trains) — one documented case of description-string lag.
    If the app ever targets a 1.0 Docs.json, re-verify those rows.

## Revision history

- **r1 (2026-08-04):** initial fact-gathering (wiki fetch + Docs.json extract).
  Dual-review round 1: code-reviewer APPROVED (0 findings); adversarial-reviewer
  NEEDS_REWORK (1 IMPORTANT + 2 NITs), all verified against the live JSON and
  folded:
  - IMPORTANT — Freight Car `mDescription` retains stale 1600 m³ vs the 1.2
    wiki's 2400 m³: intro "same game version" claim narrowed with the exception;
    a never-parse-capacities-from-description-prose rule added; the Trains row
    now carries the ⚠ conflict; Unknown #12 records the concrete case.
  - NIT — "wiki-only ground" for docking times overstated: the parser carries
    `mLoadUnloadCycleLength` (8 s solid / 9 s fluid — the 9 s is a NEW fact the
    fold surfaced, added with a parser-only caveat, Unknown #11) and
    `mTimeToCompleteLoad/Unload = 27.0` (corroborates the wiki's 27.08 s
    lockout); both "gap confirmed" notes rewritten as "precision" notes.
  - NIT — 3200 m³ figures (Fluid Truck, Fluid Truck Station) also present in
    Docs.json description strings: provenance labels corrected (agrees, with
    the non-authoritative-strings caveat).
- **r2 (2026-08-04):** dual-review round 2 (scoped to the r1 folds):
  code-reviewer APPROVED_WITH_NITS (2), adversarial-reviewer NEEDS_REWORK
  (1 IMPORTANT + 1 NIT) — converging on the same two issues, both folded:
  - IMPORTANT/NIT — the "0.08 s is docking-sequence overhead" parenthetical
    was the doc's own inference asserted as fact (neither cited wiki page
    decomposes the 27.08 s; the JSON offers rival timers): rewritten as an
    explicitly unconfirmed inference with candidates listed.
  - NIT — Unknowns numbering read 10, 12, 11 after the r1 insertion:
    renumbered in order (fluid-station 9 s is now #11, 1.0-baselines #12;
    r1-entry cross-references updated to the current numbering).
  - Strengthening (user-directed, not a reviewer finding): Michael pointed
    out the game is installed on this machine — the bundled export was
    verified content-identical to the installed game's
    `CommunityResources/Docs/en-US.json` (2868 classes, zero diffs); recorded
    in the provenance convention. The stale Freight Car 1600 m³ description
    is therefore the installed game's own string, not snapshot drift.
- **r3 (2026-08-04):** dual-review round 3 (scoped to the r2 folds):
  code-reviewer APPROVED (0 findings). Adversarial-reviewer NEEDS_REWORK,
  claiming the installed export reads "1600/m³" (slash) vs the bundled
  "1600 m³" — refuting content-identity. **REJECTED with counter-evidence**
  (team-lead codepoint-level verification): both files carry U+202F NARROW
  NO-BREAK SPACE at the identical position (`0x31 0x36 0x30 0x30 0x202f 0x6d
  0xb3`); the "slash" was the 0x2F low byte of U+202F in the installed file's
  UTF-16LE misread as ASCII. (The reviewer's Fluid-Truck "control" string
  uses a plain 0x20 space in the source text — both files identical there
  too.) Full parsed equality re-asserted True. Beware when eyeballing the
  UTF-16 file raw: U+202F renders as "/ " in a naive byte read. Correctness
  gate converged on the unchanged artifact.
- **Simplify pass (2026-08-04, one-shot post-convergence):**
  APPROVED_WITH_NITS — "a parsimonious artifact"; caveat structure affirmed
  (stated once at document level). Two NITs, both REJECTED with rationale:
  - NIT 1 (formula section re-inlines table constants → symbolic references):
    rejected — this doc is a retrieval-dated frozen snapshot, not living
    code; its constants change only via re-research, which rewrites both
    sites together, and the inline numbers are what makes the formula
    sketches directly readable for the P1 design authors. Both copies were
    verified consistent by the correctness rounds.
  - NIT 2 (head-lift + regen-braking rows have no formula consumer):
    rejected per the reviewer's own lean — single-line cited context rows
    within a research doc's context mandate (regen braking is also plausible
    P1+ power-model context).
