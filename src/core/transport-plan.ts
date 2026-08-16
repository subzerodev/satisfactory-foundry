/**
 * The derive + routing layer for per-link transport (Stage 7 / Phase 2, frozen
 * Axis 1 / deliverable 3). `computeLinkTransport` resolves a link's raw
 * `LinkTransport` config + its required rate + the flowing item + the plan tiers
 * into a P1 fleet result — dispatching each mode to the right core function per
 * Assumption #6. It is PURE (Fraction in, Fraction/bigint out — no floats, no
 * store, no DOM), so the whole routing contract is node-testable; wording lives
 * in the sibling `transport-text.ts` (advice.ts's discipline).
 *
 * The raw trip text is `Fraction.parse`'d HERE, at derive time — a malformed or
 * non-positive value surfaces as a `TransportError` on the inspector, exactly
 * like a clock error surfaces on the stage surface (never a crash).
 *
 * Solved-only (Assumption #3): the caller passes a rate only when the link's
 * required demand resolves (producer + consumer solved). An unsolved link shows
 * the mode select but no fleet math — the caller passes `rate: null` and this
 * module returns a `{ kind: "unsolved" }` result carrying the parsed config.
 */

import { Fraction } from "./fraction.ts";
import {
  continuousRuns,
  vehicleFleet,
  trainOptions,
  droneFleet,
} from "./transport.ts";
import type {
  ContinuousResult,
  VehicleFleetResult,
  TrainOption,
  DroneFleetResult,
  Cargo,
  TripInput,
  DroneTripInput,
} from "./transport.ts";
import {
  TRUCK_SLOTS,
  TRACTOR_SLOTS,
  EXPLORER_SLOTS,
  FLUID_TRUCK_TANK_M3,
  FREIGHT_CAR_SLOTS,
  FREIGHT_CAR_TANK_M3,
  TRUCK_DOCK_SECONDS,
  FLUID_TRUCK_DOCK_SECONDS,
  TRAIN_LOCKOUT_SECONDS,
  TRUCK_TOP_SPEED_KMH,
  TRACTOR_TOP_SPEED_KMH,
  EXPLORER_TOP_SPEED_KMH,
  FLUID_TRUCK_TOP_SPEED_KMH,
  LOCOMOTIVE_TOP_SPEED_KMH,
  BATTERY_ENERGY_MJ,
  TRUCK_STATION_POWER_MW,
} from "./transport-facts.ts";
import type { DroneFuel } from "./transport-facts.ts";
import type { LinkTransport, TransportMode } from "./link-transport.ts";

export interface CatalogItem {
  isFluid: boolean;
  stackSize: Fraction | null;
}

export interface TierTable {
  belt: Fraction[];
  pipe: Fraction[];
}

// ---------------------------------------------------------------------------
// Result shapes — a discriminated union the inspector + edge chip read.
// ---------------------------------------------------------------------------

/** A parse/precondition failure for a link's transport config (surfaced as a
 *  message on the inspector, the clock-error precedent). */
export interface TransportError {
  kind: "error";
  message: string;
}

/** The link's required rate did not resolve (unsolved endpoints) — the mode is
 *  known but no fleet math is available (Assumption #3). */
export interface TransportUnsolved {
  kind: "unsolved";
  mode: TransportMode;
}

/** A belt/pipe continuous result + the tier that produced its laneRate. */
export interface TransportContinuous {
  kind: "continuous";
  mode: "belt" | "pipe";
  result: ContinuousResult;
  /** 1-based tier index the laneRate came from (unlocked top tier). */
  tierIndex: number;
  /**
   * The applied pipe derate as an exact percentage Fraction (S8P2), or null when
   * none (belt always; pipe with no derate text). Kept as a field — not re-parsed
   * from the raw config in the wording layer — to hold the single-parse invariant
   * (the derive owns the one `Fraction.parse`). `result.laneRate` is ALREADY the
   * derated value; this field only lets wording LABEL that the derate is active.
   */
  deratePercent: Fraction | null;
}

/** A road-vehicle result (truck/tractor/explorer/fluid-truck) + station power. */
export interface TransportVehicle {
  kind: "vehicle";
  mode: "truck" | "tractor" | "explorer" | "fluid-truck";
  result: VehicleFleetResult;
  /** Truck-station operating power (MW) for BOTH route ends. */
  stationPowerMw: Fraction;
}

/** The train cars-vs-trains comparison + the belt tier that fed `beltFeed`. */
export interface TransportTrain {
  kind: "train";
  mode: "train";
  options: TrainOption[];
  /** Whether the trip was measured or estimated (drives the optimistic suffix —
   *  TrainOption carries no tripBasis echo, so it keys off the input, r3). */
  tripBasis: "measured" | "estimated";
  /** 1-based belt tier index whose ×2 dual-feed set `beltFeed`. */
  beltTierIndex: number;
  /** The per-platform dual-feed belt ceiling (per minute) used for the rows. */
  beltFeed: Fraction;
  /**
   * Which route ends were flagged shared (S8P2), echoed so wording can name them
   * in the asymmetry footnote. Absent-or-true, verbatim from the config; both
   * absent ⇒ no override (the footnote is omitted). The station MW column already
   * reflects the exclusion via the core `countedEnds` — this field is label-only.
   */
  sharedEnds: { from?: true; to?: true } | undefined;
}

/** A drone fleet result. */
export interface TransportDrone {
  kind: "drone";
  mode: "drone";
  /** The selected fuel — wording needs it: "N batteries" is only an honest
   *  unit when battery IS the fuel; other fuels render exact MJ instead. */
  fuel: DroneFuel;
  result: DroneFleetResult;
}

export type TransportPlan =
  | TransportError
  | TransportUnsolved
  | TransportContinuous
  | TransportVehicle
  | TransportTrain
  | TransportDrone;

// ---------------------------------------------------------------------------
// Per-mode constant tuples (fact-table grounded, resolved from core exports).
// ---------------------------------------------------------------------------

/** Slots + dock + top speed for the four road modes (fluid-truck's slots are
 *  irrelevant — it carries a fluid tank; see cargoFor). */
const ROAD_SPEC: Record<
  "truck" | "tractor" | "explorer" | "fluid-truck",
  { dockSeconds: Fraction; topSpeedKmh: Fraction }
> = {
  truck: { dockSeconds: TRUCK_DOCK_SECONDS, topSpeedKmh: TRUCK_TOP_SPEED_KMH },
  tractor: {
    dockSeconds: TRUCK_DOCK_SECONDS,
    topSpeedKmh: TRACTOR_TOP_SPEED_KMH,
  },
  explorer: {
    dockSeconds: TRUCK_DOCK_SECONDS,
    topSpeedKmh: EXPLORER_TOP_SPEED_KMH,
  },
  "fluid-truck": {
    dockSeconds: FLUID_TRUCK_DOCK_SECONDS,
    topSpeedKmh: FLUID_TRUCK_TOP_SPEED_KMH,
  },
};

// Truck Station operating power: 20 MW per station × 2 ends. Not exported from
// transport.ts's train-only power model, so composed here from the fact-table
// constant via the same "both ends" doubling the train option uses.
const VEHICLE_STATION_POWER_BOTH_ENDS = TRUCK_STATION_POWER_MW.mul(
  Fraction.from(2),
);

// ---------------------------------------------------------------------------
// Mode legality by item phase (Axis 3 — the UI never offers an illegal pairing).
// ---------------------------------------------------------------------------

/** The transport modes legal for a fluid item: pipe / fluid-truck / train. */
export const FLUID_MODES: readonly TransportMode[] = [
  "pipe",
  "fluid-truck",
  "train",
];

/** The transport modes legal for a solid item: belt / truck / tractor /
 *  explorer / train / drone. */
export const SOLID_MODES: readonly TransportMode[] = [
  "belt",
  "truck",
  "tractor",
  "explorer",
  "train",
  "drone",
];

/** The modes offered for an item, filtered by phase (fluid vs solid). */
export function legalModesFor(item: CatalogItem): readonly TransportMode[] {
  return item.isFluid ? FLUID_MODES : SOLID_MODES;
}

// ---------------------------------------------------------------------------
// computeLinkTransport — the derive + routing entry point.
// ---------------------------------------------------------------------------

/**
 * Resolve a link's transport config into a fleet plan. `rate` is the link's
 * required per-minute demand (null ⇒ unsolved → no fleet math). `transport`
 * absent ⇒ belt default. `item` supplies stackSize/isFluid; `tiers` +
 * `unlockedTiers` resolve the belt/pipe laneRate and the train belt feed.
 *
 * Errors: a solid-vehicle/train/drone mode on an item with a null stackSize
 * (SS_FLUID or unknown enum) returns a `TransportError` ("stack size unknown") —
 * the honest-absent posture; a malformed/non-positive trip string likewise.
 */
export function computeLinkTransport(
  rate: Fraction | null,
  transport: LinkTransport | undefined,
  item: CatalogItem,
  tiers: TierTable,
  unlockedTiers: { belt: number; pipe: number },
): TransportPlan {
  const config: LinkTransport = transport ?? { mode: "belt" };
  const mode = config.mode;

  if (rate === null) {
    return { kind: "unsolved", mode };
  }

  switch (config.mode) {
    case "belt":
      return continuousPlan("belt", rate, tiers, unlockedTiers, undefined);
    case "pipe":
      // Only pipe carries the S8P2 derate; belt is never derated.
      return continuousPlan(
        "pipe",
        rate,
        tiers,
        unlockedTiers,
        config.deratePercentText,
      );
    case "truck":
    case "tractor":
    case "explorer":
    case "fluid-truck":
      return vehiclePlan(config.mode, config.trip, rate, item);
    case "train":
      return trainPlan(
        config.trip,
        config.sharedEnds,
        rate,
        item,
        tiers,
        unlockedTiers,
      );
    case "drone":
      return dronePlan(config.fuel, config.trip, rate, item);
  }
}

// ── belt / pipe ──────────────────────────────────────────────────────────────

function continuousPlan(
  mode: "belt" | "pipe",
  rate: Fraction,
  tiers: TierTable,
  unlockedTiers: { belt: number; pipe: number },
  deratePercentText: string | undefined,
): TransportPlan {
  const kind = mode; // "belt" | "pipe" — the tier kind and the P1 kind coincide.
  const count = unlockedTiers[kind];
  const tierRate = tiers[kind][count - 1];
  if (tierRate === undefined) {
    return {
      kind: "error",
      message: `no unlocked ${kind} tier to size against`,
    };
  }

  // Pipe derate (S8P2): parse the raw text to a (0,100] percentage and scale the
  // lane rate by pct/100 — a smaller effective laneRate raises the run count via
  // the UNCHANGED core. Absent ⇒ no derate (belt is never derated). The parsed
  // derate rides on the result so wording can label it as the user's assumption.
  let laneRate = tierRate;
  let deratePercent: Fraction | null = null;
  if (deratePercentText !== undefined) {
    const parsed = parseDeratePercent(deratePercentText);
    if (parsed.kind === "error") return parsed;
    deratePercent = parsed.value;
    laneRate = tierRate.mul(deratePercent).div(Fraction.from(100));
  }

  return {
    kind: "continuous",
    mode,
    result: continuousRuns(kind, rate, laneRate),
    tierIndex: count,
    deratePercent,
  };
}

/** Parse a pipe derate percentage: a Fraction in (0,100] (100 = no derate; > 100
 *  a boost, refused; ≤ 0 refused). Malformed / out-of-range → a labeled
 *  TransportError, matching the module's parse-error idiom. */
function parseDeratePercent(
  text: string,
): { kind: "ok"; value: Fraction } | TransportError {
  let pct: Fraction;
  try {
    pct = Fraction.parse(text);
  } catch {
    return {
      kind: "error",
      message: `derate must be a number between 0 and 100; got ${JSON.stringify(text)}`,
    };
  }
  if (!pct.gt(Fraction.from(0)) || !pct.lte(Fraction.from(100))) {
    return {
      kind: "error",
      message: `derate must be between 0 and 100; got ${JSON.stringify(text)}`,
    };
  }
  return { kind: "ok", value: pct };
}

// ── road vehicles ────────────────────────────────────────────────────────────

/** The solid slots for a road mode (fluid-truck uses a tank, handled separately). */
const ROAD_SLOTS: Record<"truck" | "tractor" | "explorer", Fraction> = {
  truck: TRUCK_SLOTS,
  tractor: TRACTOR_SLOTS,
  explorer: EXPLORER_SLOTS,
};

function vehiclePlan(
  mode: "truck" | "tractor" | "explorer" | "fluid-truck",
  trip:
    | { kind: "measured"; roundTripSecondsText: string }
    | {
        kind: "estimated";
        distanceText: string;
      },
  rate: Fraction,
  item: CatalogItem,
): TransportPlan {
  const spec = ROAD_SPEC[mode];
  // Cargo: fluid-truck → a fixed tank; the solid modes → slots × stackSize.
  let cargo: Cargo;
  if (mode === "fluid-truck") {
    cargo = { kind: "fluid", tankVolume: FLUID_TRUCK_TANK_M3 };
  } else {
    if (item.stackSize === null) {
      return { kind: "error", message: "stack size unknown" };
    }
    cargo = {
      kind: "solid",
      slots: ROAD_SLOTS[mode],
      stackSize: item.stackSize,
    };
  }

  const parsedTrip = parseVehicleTrip(trip, spec.topSpeedKmh);
  if (parsedTrip.kind === "error") return parsedTrip;

  return {
    kind: "vehicle",
    mode,
    result: vehicleFleet(rate, cargo, parsedTrip.trip, spec.dockSeconds),
    stationPowerMw: VEHICLE_STATION_POWER_BOTH_ENDS,
  };
}

/** Parse a road trip's raw text into a P1 `TripInput` (estimated distance is
 *  ONE-WAY meters — the arm's field name; measured is a round-trip in seconds). */
function parseVehicleTrip(
  trip:
    | { kind: "measured"; roundTripSecondsText: string }
    | {
        kind: "estimated";
        distanceText: string;
      },
  topSpeedKmh: Fraction,
): { kind: "ok"; trip: TripInput } | TransportError {
  if (trip.kind === "measured") {
    const seconds = parsePositive(trip.roundTripSecondsText, "round-trip time");
    if (seconds.kind === "error") return seconds;
    return {
      kind: "ok",
      trip: { kind: "measured", roundTripSeconds: seconds.value },
    };
  }
  const meters = parsePositive(trip.distanceText, "one-way distance");
  if (meters.kind === "error") return meters;
  return {
    kind: "ok",
    trip: { kind: "estimated", distanceMeters: meters.value, topSpeedKmh },
  };
}

// ── train ────────────────────────────────────────────────────────────────────

function trainPlan(
  trip:
    | { kind: "measured"; roundTripSecondsText: string }
    | {
        kind: "estimated";
        distanceText: string;
      },
  sharedEnds: { from?: true; to?: true } | undefined,
  rate: Fraction,
  item: CatalogItem,
  tiers: TierTable,
  unlockedTiers: { belt: number; pipe: number },
): TransportPlan {
  // cargoPerCar: fluid → 2400 m³; solid → 32 × stackSize.
  let cargoPerCar: Fraction;
  if (item.isFluid) {
    cargoPerCar = FREIGHT_CAR_TANK_M3;
  } else {
    if (item.stackSize === null) {
      return { kind: "error", message: "stack size unknown" };
    }
    cargoPerCar = FREIGHT_CAR_SLOTS.mul(item.stackSize);
  }

  // roundTripSeconds: measured passes through; estimated is
  // 2×d/v(LOCOMOTIVE_TOP_SPEED_KMH) + 2×TRAIN_LOCKOUT_SECONDS (Assumption #6 —
  // the caller owns the lockout per the trainOptions contract).
  let roundTripSeconds: Fraction;
  let tripBasis: "measured" | "estimated";
  if (trip.kind === "measured") {
    const seconds = parsePositive(trip.roundTripSecondsText, "round-trip time");
    if (seconds.kind === "error") return seconds;
    roundTripSeconds = seconds.value;
    tripBasis = "measured";
  } else {
    const meters = parsePositive(trip.distanceText, "one-way distance");
    if (meters.kind === "error") return meters;
    // km/h → m/s: × 1000 / 3600. round-trip meters = 2 × one-way.
    const metersPerSecond = LOCOMOTIVE_TOP_SPEED_KMH.mul(
      Fraction.from(1000),
    ).div(Fraction.from(3600));
    const travelSeconds = meters.value
      .mul(Fraction.from(2))
      .div(metersPerSecond);
    roundTripSeconds = travelSeconds.add(
      TRAIN_LOCKOUT_SECONDS.mul(Fraction.from(2)),
    );
    tripBasis = "estimated";
  }

  // beltFeed = unlocked belt tier × 2 (dual feed, the P1 default rule).
  const beltTierIndex = unlockedTiers.belt;
  const beltTierRate = tiers.belt[beltTierIndex - 1];
  if (beltTierRate === undefined) {
    return {
      kind: "error",
      message: "no unlocked belt tier for the station feed",
    };
  }
  const beltFeed = beltTierRate.mul(Fraction.from(2));

  // sharedEnds → countedEnds (S8P2): each flagged end is billed elsewhere, so it
  // drops from THIS link's station-power ledger. countedEnds = 2 − (flagged),
  // clamped to the 0|1|2 the core option takes; absent ⇒ 2 (today's behavior).
  const flagged = (sharedEnds?.from ? 1 : 0) + (sharedEnds?.to ? 1 : 0);
  const countedEnds = (2 - flagged) as 0 | 1 | 2;

  return {
    kind: "train",
    mode: "train",
    options: trainOptions(rate, cargoPerCar, roundTripSeconds, {
      beltFeed,
      countedEnds,
    }),
    tripBasis,
    beltTierIndex,
    beltFeed,
    sharedEnds,
  };
}

// ── drone ────────────────────────────────────────────────────────────────────

function dronePlan(
  fuel: DroneFuel,
  trip:
    | {
        kind: "measured";
        roundTripSecondsText: string;
        flightMetersText?: string;
      }
    | { kind: "estimated"; flightMetersText: string },
  rate: Fraction,
  item: CatalogItem,
): TransportPlan {
  // Drones carry solids only (the mode is never offered for fluids); a null
  // stackSize (unknown enum) is unavailable, not guessed.
  if (item.stackSize === null) {
    return { kind: "error", message: "stack size unknown" };
  }

  let droneTrip: DroneTripInput;
  if (trip.kind === "measured") {
    const seconds = parsePositive(trip.roundTripSecondsText, "round-trip time");
    if (seconds.kind === "error") return seconds;
    // The measured arm's flight distance is OPTIONAL (the battery-cost add-on);
    // absent ⇒ batteriesPerTrip is honestly null (never inferred from time).
    if (trip.flightMetersText !== undefined) {
      const meters = parsePositive(
        trip.flightMetersText,
        "round-trip flight distance",
      );
      if (meters.kind === "error") return meters;
      droneTrip = {
        kind: "measured",
        roundTripSeconds: seconds.value,
        roundTripFlightMeters: meters.value,
      };
    } else {
      droneTrip = { kind: "measured", roundTripSeconds: seconds.value };
    }
  } else {
    const meters = parsePositive(
      trip.flightMetersText,
      "round-trip flight distance",
    );
    if (meters.kind === "error") return meters;
    droneTrip = { kind: "estimated", roundTripFlightMeters: meters.value };
  }

  // Fuel drives flight SPEED inside droneFleet; the battery cost is expressed in
  // battery-equivalents (the only P1-grounded fuel energy — the fact table
  // frames drone cost as "4 + 1/km batteries").
  return {
    kind: "drone",
    mode: "drone",
    fuel,
    result: droneFleet(
      rate,
      item.stackSize,
      fuel,
      droneTrip,
      BATTERY_ENERGY_MJ,
    ),
  };
}

// ---------------------------------------------------------------------------
// Shared trip-string parsing (positive Fraction, else a labeled error).
// ---------------------------------------------------------------------------

function parsePositive(
  text: string,
  label: string,
): { kind: "ok"; value: Fraction } | TransportError {
  let value: Fraction;
  try {
    value = Fraction.parse(text);
  } catch {
    return {
      kind: "error",
      message: `${label} must be a positive number; got ${JSON.stringify(text)}`,
    };
  }
  if (!value.gt(Fraction.from(0))) {
    return {
      kind: "error",
      message: `${label} must be > 0; got ${JSON.stringify(text)}`,
    };
  }
  return { kind: "ok", value };
}
