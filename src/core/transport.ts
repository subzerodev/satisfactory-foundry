/**
 * Transport fleet solver (Stage 7 / Phase 1). Given a link's required rate and a
 * transport mode + trip parameters, compute the sustaining fleet: run counts for
 * continuous modes (belt/pipe), vehicle counts for truck/train/drone, and for
 * trains the cars-per-train vs number-of-trains space as comparable options.
 *
 * Pure `src/core`: exact `Fraction` rationals throughout, zero floats, no store /
 * DOM / catalog dependency. Belt/pipe tier rates are NOT hardcoded here — they
 * arrive as caller-supplied `Fraction` parameters (the caller resolves the tier
 * from `src/data/tiers.ts`; core→data imports are lint-banned). The 60 s/min
 * conversion is explicit at every rate site. See
 * `features/logistics/phase-1/brainstorm.md`.
 *
 * MODULE-LEVEL INVARIANTS (stated once here, echoed on the relevant result
 * types; they are always-true qualitative caveats, never per-result fields):
 *  - Pipe nominal ceiling: `pipeRuns` capacity is a NOMINAL upper bound; real
 *    manifold flow undershoots it (sloshing, "by design and normal"). P2 keys
 *    its caveat wording off the `ContinuousResult` type it statically holds.
 *  - Truck-station queueing: multi-vehicle-per-station queueing/swap time beyond
 *    the 8 s (9 s fluid) docking animation is NOT wiki-groundable (Unknown #3);
 *    no fake station cap is computed. Caveat is on `VehicleFleetResult`.
 *  - Train headway: same-track multi-train feasibility (signal blocks) is
 *    qualitative and NOT modeled (Unknown #7). Caveat is on `TrainOption`.
 *  - Drone destination queueing: a destination port serializes deliveries beyond
 *    one drone; that degradation is NOT modeled (Drones Unknowns). Caveat is on
 *    `DroneFleetResult`.
 */

import { Fraction } from "./fraction.ts";
import {
  DRONE_ENERGY_PER_METER_MJ,
  DRONE_FUEL_SPEED_MS,
  DRONE_PORT_POWER_MW,
  DRONE_ROUND_TRIP_DOCK_SECONDS,
  DRONE_SLOTS,
  DRONE_TRIP_ENERGY_MJ,
  FLAT_HAUL_CARS_PER_LOCO,
  FREIGHT_PLATFORM_POWER_MW,
  TRAIN_LOCKOUT_SECONDS,
  TRAIN_STATION_POWER_MW,
} from "./transport-facts.ts";
import type { DroneFuel } from "./transport-facts.ts";

/** Seconds per minute — the sole rate-conversion constant, spelled out at use. */
const SECONDS_PER_MINUTE = Fraction.from(60);

// ── Continuous modes (belt, pipe) ────────────────────────────────────────────

/**
 * A continuous-mode fleet result. `runs = ceil(rate / laneRate)` where
 * `laneRate` is the caller-supplied per-lane throughput (items or m³ per minute)
 * for the chosen tier. `kind` distinguishes belt from pipe so callers can key
 * the pipe nominal-ceiling caveat (a module-level invariant) off the type.
 */
export interface ContinuousResult {
  kind: "belt" | "pipe";
  /** Caller-supplied per-lane rate that produced this result (echoed for display). */
  laneRate: Fraction;
  /** Number of parallel lanes needed: `ceil(rate / laneRate)`. */
  runs: bigint;
}

/**
 * Belt/pipe run count. `laneRate` is the caller-resolved tier rate (per minute);
 * no tier numbers live in core. Zero required rate → zero runs. A non-positive
 * `laneRate` is a caller bug and throws (division would be undefined / negative).
 */
export function continuousRuns(
  kind: "belt" | "pipe",
  rate: Fraction,
  laneRate: Fraction,
): ContinuousResult {
  if (!laneRate.gt(Fraction.from(0))) {
    throw new RangeError("continuousRuns: laneRate must be positive.");
  }
  const runs = rate.lte(Fraction.from(0)) ? 0n : rate.ceilDiv(laneRate);
  return { kind, laneRate, runs };
}

// ── Vehicle modes (truck, tractor, explorer, fluid truck) ────────────────────

/**
 * Cargo per trip, discriminated by state. Solid cargo = `slots × stackSize`
 * (both caller-supplied `Fraction`s); fluid cargo = a tank volume in m³. The
 * union makes an illegal pairing (e.g. fluid cargo on a solid-only mode)
 * unrepresentable at the boundary rather than a runtime check.
 */
export type Cargo =
  | { kind: "solid"; slots: Fraction; stackSize: Fraction }
  | { kind: "fluid"; tankVolume: Fraction };

/**
 * Trip-time input as a discriminated union — the honest-input rule as a type.
 * `measured` is the primary input (the user timed the route in-game); `estimated`
 * derives an optimistic lower bound `2 × d / v_top` and is labeled as such on
 * every result. `topSpeedKmh` (km/h) accompanies the estimate so the module can
 * convert to seconds without importing a per-mode speed table into every call.
 */
export type TripInput =
  | { kind: "measured"; roundTripSeconds: Fraction }
  | {
      kind: "estimated";
      distanceMeters: Fraction;
      topSpeedKmh: Fraction;
    };

/** Whether a result's trip time was measured or estimated (echoed for P2 labeling). */
export type TripBasis = "measured" | "estimated";

/**
 * Resolve a `TripInput` to an exact drive time in seconds plus its basis.
 * Estimated: `2 × d / v_top`, with v_top converted km/h → m/s as
 * `topSpeedKmh × 1000 / 3600`. Distance is one-way; the round trip is `2 × d`.
 */
function resolveDriveSeconds(trip: TripInput): {
  driveSeconds: Fraction;
  basis: TripBasis;
} {
  if (trip.kind === "measured") {
    return { driveSeconds: trip.roundTripSeconds, basis: "measured" };
  }
  // km/h → m/s: × 1000 / 3600. round-trip meters = 2 × one-way distance.
  const metersPerSecond = trip.topSpeedKmh
    .mul(Fraction.from(1000))
    .div(Fraction.from(3600));
  const roundTripMeters = trip.distanceMeters.mul(Fraction.from(2));
  return {
    driveSeconds: roundTripMeters.div(metersPerSecond),
    basis: "estimated",
  };
}

/** Cargo per trip as an exact `Fraction` (solid: slots × stackSize; fluid: tank). */
function cargoPerTrip(cargo: Cargo): Fraction {
  return cargo.kind === "solid"
    ? cargo.slots.mul(cargo.stackSize)
    : cargo.tankVolume;
}

/**
 * A road-vehicle fleet result. Module-level invariant: multi-vehicle-per-station
 * queueing beyond the docking animation is NOT modeled (see file header) — this
 * type's presence is the caveat P2 renders; there is no per-result flag.
 */
export interface VehicleFleetResult {
  /** Round-trip time in seconds: drive time + docking overhead. */
  roundTripSeconds: Fraction;
  /** Cargo delivered per trip (items or m³). */
  cargoPerTrip: Fraction;
  /** Sustained rate one vehicle delivers, per minute: `cargo × 60 / T_round`. */
  ratePerVehicle: Fraction;
  /** Vehicles needed: `ceil(rate × T_round / (cargo × 60))`. */
  nVehicles: bigint;
  /** Whether the trip time was measured or estimated. */
  tripBasis: TripBasis;
}

/**
 * Shared vehicle fleet math for truck/tractor/explorer/fluid truck. Docking
 * overhead is the caller's per-END animation (`dockSecondsPerEnd`, 8 s solid /
 * 9 s fluid from facts) applied at both ends: `T_round = drive + 2 × dock`.
 * `rate` and the result rate are per minute; the 60 s/min conversion is explicit.
 */
export function vehicleFleet(
  rate: Fraction,
  cargo: Cargo,
  trip: TripInput,
  dockSecondsPerEnd: Fraction,
): VehicleFleetResult {
  const { driveSeconds, basis } = resolveDriveSeconds(trip);
  const roundTripSeconds = driveSeconds.add(
    dockSecondsPerEnd.mul(Fraction.from(2)),
  );
  const cargo1 = cargoPerTrip(cargo);
  // ratePerVehicle = cargo × 60 / T_round  (per minute)
  const ratePerVehicle = cargo1.mul(SECONDS_PER_MINUTE).div(roundTripSeconds);
  // nVehicles = ceil(rate × T_round / (cargo × 60))
  const nVehicles = rate.lte(Fraction.from(0))
    ? 0n
    : rate.mul(roundTripSeconds).ceilDiv(cargo1.mul(SECONDS_PER_MINUTE));
  return {
    roundTripSeconds,
    cargoPerTrip: cargo1,
    ratePerVehicle,
    nVehicles,
    tripBasis: basis,
  };
}

// ── Train cars-vs-trains enumeration ─────────────────────────────────────────

/**
 * One feasible train configuration: `carsPerTrain` cars per consist, `nTrains`
 * trains, with the derived power/throughput/ceiling. Enumerated across
 * `c = 1..maxCars`; callers compare rows (Michael: comparable options, no
 * "best", no ranking).
 *
 * MODULE-LEVEL INVARIANT: same-track multi-train feasibility (headway / signal
 * blocks) is qualitative and NOT modeled (Unknown #7). It is a property of
 * holding a `TrainOption` at all, not a per-row field — P2 keys its caveat off
 * the type.
 */
export interface TrainOption {
  /**
   * Cars per train, `c = 1..maxCars`. Also the platform count per route end —
   * one 50 MW platform per car (fact table); there is no separate platform field.
   */
  carsPerTrain: number;
  /** Trains needed: `ceil(rate × T_round / (c × cargoPerCar × 60))`. */
  nTrains: number;
  /**
   * Station power in MW for BOTH route ends: `2 × (50 + 50 × c)` — one 50 MW
   * Train Station + c 50 MW platforms at each end (symmetric station set,
   * Assumption #6).
   */
  stationPowerMw: Fraction;
  /** Locomotives suggested for a flat haul: `ceil(c / 13)` guidance. */
  locosSuggested: number;
  /** Delivered rate (per minute) this option sustains: `nTrains × c × cargoPerCar × 60 / T_round`. */
  throughput: Fraction;
  /**
   * Per-platform sustained ceiling (per minute):
   * `min(cargoPerCar × 60 / T_round, (T_round − 27.08 s) / T_round × beltFeed)`.
   */
  perPlatformCeiling: Fraction;
  /**
   * True when the belt-feed term of `perPlatformCeiling` binds (i.e. the belt
   * feed, not the per-trip capacity, is the limit). Both ceiling terms are
   * c-INDEPENDENT (neither the capacity term `cargoPerCar × 60 / T_round` nor
   * the belt term `(T_round − 27.08 s) / T_round × beltFeed` reference `c`), so
   * for fixed inputs this flag is CONSTANT across the enumeration — a per-CONFIG
   * discriminator (which of the two terms wins for the given cargo/trip/belt
   * feed), not a per-row one.
   */
  ceilingBound: boolean;
}

/** Options for train enumeration; all fields optional with fact-grounded defaults. */
export interface TrainOptions {
  /** Enumeration bound: c = 1..maxCars. Default 13 (flat-haul guidance). */
  maxCars?: number;
  /**
   * Belt-feed ceiling per platform, per minute. Default: caller's belt tier × 2
   * (dual-feed per platform). Callers must supply it to bind the belt ceiling;
   * absent it, the belt term is treated as unbounded and never binds.
   */
  beltFeed?: Fraction;
}

/**
 * Enumerate feasible train consist sizes as comparable rows. `cargoPerCar` is
 * the exact per-car cargo (`32 × stackSize` solid, or `2400` m³ fluid — the
 * caller builds it via {@link cargoPerTrip} on a one-car cargo). `roundTripSeconds`
 * is `T_travel + 2 × 27.08 s` (the caller adds the lockout, or passes a measured
 * round trip; the per-platform ceiling re-subtracts one 27.08 s window per the
 * wiki formula). Returns one row per `c = 1..maxCars`; the math is total.
 */
export function trainOptions(
  rate: Fraction,
  cargoPerCar: Fraction,
  roundTripSeconds: Fraction,
  opts: TrainOptions = {},
): TrainOption[] {
  const maxCars = opts.maxCars ?? FLAT_HAUL_CARS_PER_LOCO;
  const beltFeed = opts.beltFeed ?? null;
  const options: TrainOption[] = [];
  for (let c = 1; c <= maxCars; c++) {
    const cFrac = Fraction.from(c);
    const consistCargo = cargoPerCar.mul(cFrac);
    // nTrains = ceil(rate × T_round / (c × cargoPerCar × 60))
    const nTrains = rate.lte(Fraction.from(0))
      ? 0n
      : rate
          .mul(roundTripSeconds)
          .ceilDiv(consistCargo.mul(SECONDS_PER_MINUTE));
    // throughput = nTrains × c × cargoPerCar × 60 / T_round  (per minute)
    const throughput = Fraction.from(nTrains)
      .mul(consistCargo)
      .mul(SECONDS_PER_MINUTE)
      .div(roundTripSeconds);
    // stationPowerMw = 2 × (station + c × platform), both ends.
    const stationPowerMw = TRAIN_STATION_POWER_MW.add(
      FREIGHT_PLATFORM_POWER_MW.mul(cFrac),
    ).mul(Fraction.from(2));
    // locosSuggested = ceil(c / 13)
    const locosSuggested = Number(
      Fraction.from(c).ceilDiv(Fraction.from(FLAT_HAUL_CARS_PER_LOCO)),
    );
    // Per-platform ceiling: min(cargoPerCar × 60 / T_round, beltTerm).
    const capacityTerm = cargoPerCar
      .mul(SECONDS_PER_MINUTE)
      .div(roundTripSeconds);
    let perPlatformCeiling: Fraction;
    let ceilingBound: boolean;
    if (beltFeed === null) {
      perPlatformCeiling = capacityTerm;
      ceilingBound = false;
    } else {
      // beltTerm = (T_round − 27.08 s) / T_round × beltFeed
      const beltTerm = roundTripSeconds
        .sub(TRAIN_LOCKOUT_SECONDS)
        .div(roundTripSeconds)
        .mul(beltFeed);
      if (beltTerm.lt(capacityTerm)) {
        perPlatformCeiling = beltTerm;
        ceilingBound = true;
      } else {
        perPlatformCeiling = capacityTerm;
        ceilingBound = false;
      }
    }
    options.push({
      carsPerTrain: c,
      nTrains: Number(nTrains),
      stationPowerMw,
      locosSuggested,
      throughput,
      perPlatformCeiling,
      ceilingBound,
    });
  }
  return options;
}

// ── Drone model ──────────────────────────────────────────────────────────────

/**
 * Drone trip input. Mirrors {@link TripInput} but the estimated branch names a
 * `roundTripFlightMeters` distance directly (drones fly a known route, not a
 * road; what the user should enter is P2 guidance — Unknown #4). Battery/fuel
 * cost needs a distance, so a `measured` input without one yields `null` energy
 * cost — never inferred from time × speed (that would launder the speed back in).
 */
export type DroneTripInput =
  | {
      kind: "measured";
      roundTripSeconds: Fraction;
      roundTripFlightMeters?: Fraction;
    }
  | { kind: "estimated"; roundTripFlightMeters: Fraction };

/**
 * A drone fleet result. Module-level invariant: destination-port queueing beyond
 * one drone per port is NOT modeled (see file header) — the caveat is on this
 * type, not a per-result flag.
 */
export interface DroneFleetResult {
  nDrones: bigint;
  /** Sustained rate one drone delivers, per minute. */
  ratePerDrone: Fraction;
  /** Round-trip time in seconds used for the rate (drive + 102 s animation). */
  roundTripSeconds: Fraction;
  tripBasis: TripBasis;
  /**
   * Batteries (or generic fuel units) per round trip:
   * `(24000 + 6 × d_roundtrip) / fuelMJ`. `null` when the trip is `measured`
   * and no `roundTripFlightMeters` was given — honestly unknown, never inferred.
   */
  batteriesPerTrip: Fraction | null;
  /** Home-port power in MW: 100 constant per drone's home port. */
  portPowerMw: Fraction;
}

/**
 * Drone fleet math. Cargo = `9 × stackSize` (solid only). `T_round = 2d/v(fuel)
 * + 102 s` for an estimated trip, or the measured round trip; `v(fuel)` from the
 * fuel-speed table. `fuelEnergyMj` is the per-unit fuel energy (6000 MJ for
 * batteries) — energy cost divides by it. The 60 s/min conversion is explicit.
 */
export function droneFleet(
  rate: Fraction,
  stackSize: Fraction,
  fuel: DroneFuel,
  trip: DroneTripInput,
  fuelEnergyMj: Fraction,
): DroneFleetResult {
  const cargo = DRONE_SLOTS.mul(stackSize);
  let roundTripSeconds: Fraction;
  let basis: TripBasis;
  let flightMeters: Fraction | null;
  if (trip.kind === "measured") {
    roundTripSeconds = trip.roundTripSeconds;
    basis = "measured";
    flightMeters = trip.roundTripFlightMeters ?? null;
  } else {
    // 2d / v(fuel) is already round-trip if roundTripFlightMeters is the full
    // path; v in m/s → seconds. Then add the fixed 102 s animation overhead.
    const speed = DRONE_FUEL_SPEED_MS[fuel];
    const flightSeconds = trip.roundTripFlightMeters.div(speed);
    roundTripSeconds = flightSeconds.add(DRONE_ROUND_TRIP_DOCK_SECONDS);
    basis = "estimated";
    flightMeters = trip.roundTripFlightMeters;
  }
  // ratePerDrone = cargo × 60 / T_round
  const ratePerDrone = cargo.mul(SECONDS_PER_MINUTE).div(roundTripSeconds);
  const nDrones = rate.lte(Fraction.from(0))
    ? 0n
    : rate.mul(roundTripSeconds).ceilDiv(cargo.mul(SECONDS_PER_MINUTE));
  // batteriesPerTrip = (24000 + 6 × d_roundtrip) / fuelMJ; null when no distance.
  const batteriesPerTrip =
    flightMeters === null
      ? null
      : DRONE_TRIP_ENERGY_MJ.add(
          DRONE_ENERGY_PER_METER_MJ.mul(flightMeters),
        ).div(fuelEnergyMj);
  return {
    nDrones,
    ratePerDrone,
    roundTripSeconds,
    tripBasis: basis,
    batteriesPerTrip,
    portPowerMw: DRONE_PORT_POWER_MW,
  };
}
