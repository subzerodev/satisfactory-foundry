/**
 * Transport constants for the Stage 7 / Phase 1 solver (`transport.ts`).
 *
 * Every value here is a `Fraction` cited to a single row of
 * `docs/research/transport-facts.md` (P0, frozen @ develop 8cbce08) — the one
 * authoritative fact source (description strings are non-authoritative). This
 * module holds ONLY the vehicle / train / drone constants that have no existing
 * home; it deliberately carries NO belt/pipe tier rates. Those live in
 * `src/data/tiers.ts` and reach the solver as caller-supplied `Fraction`
 * parameters — the core purity lint bans core→data imports (type-only
 * included), so duplicating or importing tier numbers here is illegal. See
 * `features/logistics/phase-1/brainstorm.md` Axis 1.
 *
 * Imports only `./fraction.ts` (the sole legal core dependency).
 */

import { Fraction } from "./fraction.ts";

// ── Vehicle solid cargo slots ────────────────────────────────────────────────
// Solid cargo per vehicle/car = slots × stackSize(item); stackSize is a
// caller-supplied parameter (fact table "Stack sizes" / "Planner rule").

/** Truck inventory: 48 slots. Fact table "Cargo capacities" → Truck. */
export const TRUCK_SLOTS = Fraction.from(48);
/** Tractor inventory: 25 slots. Fact table "Cargo capacities" → Tractor. */
export const TRACTOR_SLOTS = Fraction.from(25);
/** Explorer inventory: 12 slots. Fact table "Cargo capacities" → Explorer. */
export const EXPLORER_SLOTS = Fraction.from(12);
/** Drone cargo: 9 slots per trip (solid only). Fact table "Drones" → Drone cargo. */
export const DRONE_SLOTS = Fraction.from(9);
/** Freight Car solid capacity: 32 slots. Fact table "Rolling stock" → Freight Car (solid). */
export const FREIGHT_CAR_SLOTS = Fraction.from(32);

// ── Fluid tank volumes (m³) ──────────────────────────────────────────────────

/**
 * Fluid Truck tank: 3200 m³ (single fluid inventory; vehicle introduced in
 * patch 1.2.0.0). Fact table "Cargo capacities" → Fluid Truck tank.
 */
export const FLUID_TRUCK_TANK_M3 = Fraction.from(3200);
/**
 * Freight Car fluid capacity: 2400 m³ (raised from 1600 in patch 1.2.0.0; the
 * bundled Docs.json `mDescription` still reads the stale 1600 — never parse it).
 * Fact table "Rolling stock" → Freight Car (fluid).
 */
export const FREIGHT_CAR_TANK_M3 = Fraction.from(2400);

// ── Docking overhead (seconds, per docking END) ──────────────────────────────
// T_round adds one docking at EACH route end (2× per round trip); the split
// below is the per-end animation duration. Solid vs fluid truck stations differ.

/**
 * Truck Station docking animation: 8 s per docking. Fact table "Truck Station"
 * → Docking animation (`mLoadUnloadCycleLength = 8`, wiki 8 s cross-check).
 */
export const TRUCK_DOCK_SECONDS = Fraction.from(8);
/**
 * Fluid Truck Station docking: 9 s per docking (`mLoadUnloadCycleLength = 9`,
 * parser-only). Fact table "Truck Station" → Docking animation (fluid).
 */
export const FLUID_TRUCK_DOCK_SECONDS = Fraction.from(9);
/**
 * Train platform docking lockout: 27.08 s (0.4513 min) per docking — all cars
 * dock in parallel within this one window. Fact table "Stations & platforms" →
 * Docking lockout. Encoded exactly as 2708/100.
 */
export const TRAIN_LOCKOUT_SECONDS = Fraction.of(2708, 100);
/**
 * Drone landing/take-off animation: 51 s per port visit. A round trip touches
 * both ports → 2 × 51 s = 102 s stationary even at zero distance. Fact table
 * "Drones" → Docking overhead.
 */
export const DRONE_DOCK_SECONDS_PER_PORT = Fraction.from(51);
/** Drone round-trip fixed animation overhead: 2 × 51 s = 102 s. Derived from above. */
export const DRONE_ROUND_TRIP_DOCK_SECONDS = DRONE_DOCK_SECONDS_PER_PORT.mul(
  Fraction.from(2),
);

// ── Drone trip energy ────────────────────────────────────────────────────────

/**
 * Drone fixed round-trip energy: 24 000 MJ (`mTripPowerCost`). Fact table
 * "Drones" → Trip energy cost (fixed). Reconciles to 4 batteries at 6000 MJ.
 */
export const DRONE_TRIP_ENERGY_MJ = Fraction.from(24000);
/**
 * Drone per-meter energy: 6 MJ/m (`mTripPowerPerMeterCost`; = 6000 MJ/km, =
 * 1 battery/km). Fact table "Drones" → Trip energy cost (distance).
 */
export const DRONE_ENERGY_PER_METER_MJ = Fraction.from(6);
/**
 * Battery energy: 6000 MJ each. Fact table "Drones" → Battery energy. The
 * default drone fuel; 24000/6000 = 4 fixed batteries per round trip.
 */
export const BATTERY_ENERGY_MJ = Fraction.from(6000);

// ── Fuel-dependent drone flight speed (m/s) ──────────────────────────────────
// Introduced in 1.0: drone flight speed varies by fuel. Fact table "Drones" →
// Fuel-dependent flight speed (7 rows). Keyed by fuel item id for lookup.

export type DroneFuel =
  | "packaged-fuel"
  | "packaged-turbofuel"
  | "battery"
  | "packaged-rocket-fuel"
  | "uranium-fuel-rod"
  | "packaged-ionized-fuel"
  | "plutonium-fuel-rod";

/**
 * Drone flight speed in m/s by fuel. Fact table "Drones" → Fuel-dependent
 * flight speed: Packaged Fuel 50, Packaged Turbofuel 60, Battery 75, Packaged
 * Rocket Fuel 75, Uranium Fuel Rod 90, Packaged Ionized Fuel 100, Plutonium
 * Fuel Rod 100. Battery (75 m/s = 270 km/h) is the default fuel.
 */
export const DRONE_FUEL_SPEED_MS: Readonly<Record<DroneFuel, Fraction>> = {
  "packaged-fuel": Fraction.from(50),
  "packaged-turbofuel": Fraction.from(60),
  battery: Fraction.from(75),
  "packaged-rocket-fuel": Fraction.from(75),
  "uranium-fuel-rod": Fraction.from(90),
  "packaged-ionized-fuel": Fraction.from(100),
  "plutonium-fuel-rod": Fraction.from(100),
};

// ── Vehicle top speeds (km/h) ────────────────────────────────────────────────
// USED ONLY as an optimistic lower-bound trip-time input (distance / topSpeed);
// never as an autopilot cruise speed (Unknowns #1/#8). Reported in km/h.

/** Truck top speed: 89 km/h. Fact table "Speeds" → Truck. */
export const TRUCK_TOP_SPEED_KMH = Fraction.from(89);
/** Tractor top speed: 69 km/h. Fact table "Speeds" → Tractor. */
export const TRACTOR_TOP_SPEED_KMH = Fraction.from(69);
/** Explorer top speed: 107 km/h. Fact table "Speeds" → Explorer. */
export const EXPLORER_TOP_SPEED_KMH = Fraction.from(107);
/** Fluid Truck top speed: 89 km/h (same chassis as Truck). Fact table "Speeds" → Fluid Truck. */
export const FLUID_TRUCK_TOP_SPEED_KMH = Fraction.from(89);
/**
 * Locomotive flat-rail self-powered top speed: 120 km/h. Fact table "Rolling
 * stock" → Locomotive top speed (self-powered on flat rail).
 */
export const LOCOMOTIVE_TOP_SPEED_KMH = Fraction.from(120);

// ── Station / port power (MW) ────────────────────────────────────────────────

/** Truck Station operating power: 20 MW. Fact table "Truck Station" → Power. */
export const TRUCK_STATION_POWER_MW = Fraction.from(20);
/** Train Station power: 50 MW. Fact table "Stations & platforms" → Train Station power. */
export const TRAIN_STATION_POWER_MW = Fraction.from(50);
/** Freight Platform transfer power: 50 MW (one per car). Fact table "Stations & platforms" → Platform power. */
export const FREIGHT_PLATFORM_POWER_MW = Fraction.from(50);
/** Drone Port power: 100 MW constant (always-on). Fact table "Drones" → Drone Port power. */
export const DRONE_PORT_POWER_MW = Fraction.from(100);

// ── Locomotive flat-haul guidance ────────────────────────────────────────────

/**
 * Flat-haul guidance: ~13 fully-loaded cars per locomotive on flat terrain.
 * Fact table "Rolling stock" → Loco-to-car ratio (flat). Used as the default
 * enumeration bound for cars-per-train and to suggest locomotive count
 * (`ceil(cars / 13)`). Beyond it a flat consist needs multiple locos.
 */
export const FLAT_HAUL_CARS_PER_LOCO = 13;
