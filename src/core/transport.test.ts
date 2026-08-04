import { Fraction } from "./fraction.ts";
import {
  continuousRuns,
  vehicleFleet,
  trainOptions,
  droneFleet,
} from "./transport.ts";
import type { Cargo, TripInput } from "./transport.ts";
import {
  TRUCK_SLOTS,
  FREIGHT_CAR_SLOTS,
  DRONE_SLOTS,
  TRUCK_DOCK_SECONDS,
  BATTERY_ENERGY_MJ,
  DRONE_PORT_POWER_MW,
} from "./transport-facts.ts";

// The transport solver is pure exact-Fraction math. These tables pin every
// production behavior: continuous run counts, vehicle fleet math with
// measured-vs-estimated basis propagation, the train cars-vs-trains enumeration
// (bound, power, ceiling binding), and the drone model (fuel-speed round trip,
// the exact battery formula, and the null-battery honesty rule). Wiki-computed
// ceilings are validated as EXACT fractions from the 27.08 s constant; where the
// wiki's 2-dp figure diverges it is a documented rounding artifact (see below).

describe("transport-facts — cited constants", () => {
  it("exposes the vehicle/train/drone constants the solver consumes", () => {
    expect(TRUCK_SLOTS.eq(Fraction.from(48))).toBe(true);
    expect(FREIGHT_CAR_SLOTS.eq(Fraction.from(32))).toBe(true);
    expect(DRONE_SLOTS.eq(Fraction.from(9))).toBe(true);
    expect(TRUCK_DOCK_SECONDS.eq(Fraction.from(8))).toBe(true);
    expect(BATTERY_ENERGY_MJ.eq(Fraction.from(6000))).toBe(true);
    expect(DRONE_PORT_POWER_MW.eq(Fraction.from(100))).toBe(true);
  });
});

describe("continuousRuns — belt/pipe run count = ceil(rate / laneRate)", () => {
  it("exact divisibility → no over-count", () => {
    // 240 / 120 = 2 exactly → 2 runs, not 3.
    const r = continuousRuns("belt", Fraction.from(240), Fraction.from(120));
    expect(r.runs).toBe(2n);
    expect(r.kind).toBe("belt");
  });

  it("fractional remainder rounds up", () => {
    const r = continuousRuns("belt", Fraction.from(250), Fraction.from(120));
    expect(r.runs).toBe(3n);
  });

  it("zero required rate → zero runs", () => {
    const r = continuousRuns("pipe", Fraction.from(0), Fraction.from(300));
    expect(r.runs).toBe(0n);
    expect(r.kind).toBe("pipe");
  });

  it("non-positive laneRate is a caller bug → throws", () => {
    expect(() =>
      continuousRuns("belt", Fraction.from(60), Fraction.from(0)),
    ).toThrow(RangeError);
  });
});

describe("vehicleFleet — shared road-vehicle math", () => {
  it("truck: 48×100 stack, 60 s measured round trip + 2×8 s docking → exact fleet", () => {
    const cargo: Cargo = {
      kind: "solid",
      slots: TRUCK_SLOTS,
      stackSize: Fraction.from(100),
    };
    const trip: TripInput = {
      kind: "measured",
      roundTripSeconds: Fraction.from(60),
    };
    const r = vehicleFleet(Fraction.from(300), cargo, trip, TRUCK_DOCK_SECONDS);
    // T_round = 60 + 2×8 = 76 s; cargo/trip = 4800.
    expect(r.roundTripSeconds.eq(Fraction.from(76))).toBe(true);
    expect(r.cargoPerTrip.eq(Fraction.from(4800))).toBe(true);
    // ratePerVehicle = 4800 × 60 / 76 = 72000/19 per minute (exact).
    expect(r.ratePerVehicle.eq(Fraction.of(72000, 19))).toBe(true);
    // nVehicles = ceil(300 × 76 / (4800 × 60)) = ceil(22800/288000) = 1.
    expect(r.nVehicles).toBe(1n);
    expect(r.tripBasis).toBe("measured");
  });

  it("exact-divisibility ceil edge: rate = 2 × ratePerVehicle → exactly 2 (no over-count)", () => {
    const cargo: Cargo = {
      kind: "solid",
      slots: TRUCK_SLOTS,
      stackSize: Fraction.from(100),
    };
    const trip: TripInput = {
      kind: "measured",
      roundTripSeconds: Fraction.from(60),
    };
    // ratePerVehicle = 72000/19; twice that = 144000/19 → nVehicles exactly 2.
    const r = vehicleFleet(
      Fraction.of(144000, 19),
      cargo,
      trip,
      TRUCK_DOCK_SECONDS,
    );
    expect(r.nVehicles).toBe(2n);
  });

  it("estimated trip propagates tripBasis and computes 2×d/v_top drive time", () => {
    const cargo: Cargo = {
      kind: "solid",
      slots: TRUCK_SLOTS,
      stackSize: Fraction.from(100),
    };
    // distance 1000 m, top speed 89 km/h → m/s = 89000/3600. round trip 2000 m.
    const trip: TripInput = {
      kind: "estimated",
      distanceMeters: Fraction.from(1000),
      topSpeedKmh: Fraction.from(89),
    };
    const r = vehicleFleet(Fraction.from(300), cargo, trip, TRUCK_DOCK_SECONDS);
    expect(r.tripBasis).toBe("estimated");
    // drive = 2000 / (89000/3600) = 7200000/89000 = 7200/89 s; + 16 s docking.
    const expectedDrive = Fraction.of(7200, 89);
    expect(r.roundTripSeconds.eq(expectedDrive.add(Fraction.from(16)))).toBe(
      true,
    );
  });

  it("fluid cargo uses the tank volume directly (union bars solid/fluid confusion)", () => {
    const cargo: Cargo = { kind: "fluid", tankVolume: Fraction.from(3200) };
    const trip: TripInput = {
      kind: "measured",
      roundTripSeconds: Fraction.from(60),
    };
    // Fluid truck station docks 9 s/end.
    const r = vehicleFleet(Fraction.from(600), cargo, trip, Fraction.from(9));
    expect(r.cargoPerTrip.eq(Fraction.from(3200))).toBe(true);
    expect(r.roundTripSeconds.eq(Fraction.from(78))).toBe(true); // 60 + 18
  });

  it("zero required rate → zero vehicles", () => {
    const cargo: Cargo = {
      kind: "solid",
      slots: TRUCK_SLOTS,
      stackSize: Fraction.from(100),
    };
    const trip: TripInput = {
      kind: "measured",
      roundTripSeconds: Fraction.from(60),
    };
    const r = vehicleFleet(Fraction.from(0), cargo, trip, TRUCK_DOCK_SECONDS);
    expect(r.nVehicles).toBe(0n);
  });
});

describe("trainOptions — cars-vs-trains enumeration", () => {
  // Optimal RtD for stack 50: TtF = (50×32)/2400 min + 27.08 s, in seconds.
  // (1600/2400)×60 = 40 s fill + 27.08 s = 67.08 s round trip at optimality.
  const stackSize = Fraction.from(50);
  const cargoPerCar = FREIGHT_CAR_SLOTS.mul(stackSize); // 1600
  const optimalRtdSeconds = Fraction.of(6708, 100); // 40 + 27.08 = 67.08 s
  const beltFeed = Fraction.from(2400); // dual Mk.6

  it("default bound is 13 rows (flat-haul guidance); c raises with opts", () => {
    const rows = trainOptions(
      Fraction.from(1000),
      cargoPerCar,
      optimalRtdSeconds,
      { beltFeed },
    );
    expect(rows).toHaveLength(13);
    expect(rows[0]?.carsPerTrain).toBe(1);
    expect(rows[12]?.carsPerTrain).toBe(13);

    const wider = trainOptions(
      Fraction.from(1000),
      cargoPerCar,
      optimalRtdSeconds,
      { maxCars: 20, beltFeed },
    );
    expect(wider).toHaveLength(20);
  });

  it("stationPowerMw = 2 × (50 + 50 × c) and locosSuggested = ceil(c/13)", () => {
    const rows = trainOptions(
      Fraction.from(1000),
      cargoPerCar,
      optimalRtdSeconds,
      { maxCars: 26, beltFeed },
    );
    const c2 = rows[1];
    expect(c2?.carsPerTrain).toBe(2);
    // 2 × (50 + 100) = 300 MW.
    expect(c2?.stationPowerMw.eq(Fraction.from(300))).toBe(true);
    expect(c2?.locosSuggested).toBe(1);
    // c = 14 → ceil(14/13) = 2 locomotives suggested.
    const c14 = rows[13];
    expect(c14?.carsPerTrain).toBe(14);
    expect(c14?.locosSuggested).toBe(2);
  });

  it("stack-50 per-platform ceiling = EXACT 800000/559 from the 27.08 s constant", () => {
    // At the optimal RtD the belt term and capacity term coincide; the exact
    // fraction the 27.08 s constant yields is 800000/559. This rounds to 1431.13
    // at 2 dp — NOT the wiki's precomputed 1431.17, which was derived from the
    // rounded 0.4513 min (= 27.078 s). We assert the honest exact value; the
    // 0.04/min gap is a documented rounding artifact, not a math error.
    const rows = trainOptions(
      Fraction.from(1),
      cargoPerCar,
      optimalRtdSeconds,
      { beltFeed },
    );
    const c1 = rows[0];
    expect(c1?.perPlatformCeiling.eq(Fraction.of(800000, 559))).toBe(true);
    expect(c1?.perPlatformCeiling.toDecimalString(2)).toBe("1431.13");
  });

  it("ceilingBound varies per row: belt feed binds when it is the smaller term", () => {
    // A long round trip with a low belt feed makes the belt term bind for a
    // large consist (capacity term rises with cargoPerCar/RtD only via RtD,
    // while the belt term is capped at beltFeed). Use a short RtD so the belt
    // term (throttled by the 27.08 s lockout fraction) falls below capacity.
    const rows = trainOptions(
      Fraction.from(1000),
      cargoPerCar,
      Fraction.from(30), // RtD 30 s < some capacity terms
      { beltFeed: Fraction.from(120) }, // a low single-belt feed
    );
    // With a low belt feed and short RtD, the belt term binds for the 1-car row.
    const c1 = rows[0];
    // capacity term = 1600 × 60 / 30 = 3200/min; belt term = (30−27.08)/30 × 120
    //   = (2.92/30) × 120 = 11.68/min → belt binds.
    expect(c1?.ceilingBound).toBe(true);
    expect(c1?.perPlatformCeiling.eq(Fraction.of(1168, 100))).toBe(true);
  });

  it("without beltFeed the belt term never binds (ceilingBound false)", () => {
    const rows = trainOptions(
      Fraction.from(1000),
      cargoPerCar,
      optimalRtdSeconds,
    );
    expect(rows[0]?.ceilingBound).toBe(false);
    // ceiling falls back to the pure capacity term = 1600 × 60 / (6708/100).
    expect(
      rows[0]?.perPlatformCeiling.eq(
        Fraction.from(1600).mul(Fraction.from(60)).div(Fraction.of(6708, 100)),
      ),
    ).toBe(true);
  });

  it("nTrains uses ceil (exact divisibility → no over-count)", () => {
    // One-car cargo 1600, RtD 60 s. ratePerTrain(c=1) = 1600 × 60 / 60 = 1600.
    // rate = 3200 = 2 × 1600 → nTrains exactly 2, not 3.
    const rows = trainOptions(
      Fraction.from(3200),
      cargoPerCar,
      Fraction.from(60),
      {
        beltFeed,
      },
    );
    expect(rows[0]?.nTrains).toBe(2);
  });
});

describe("droneFleet — fuel-speed round trip + exact battery cost", () => {
  it("0 km → 4 batteries (fixed 24000 / 6000)", () => {
    const r = droneFleet(
      Fraction.from(100),
      Fraction.from(100),
      "battery",
      { kind: "estimated", roundTripFlightMeters: Fraction.from(0) },
      BATTERY_ENERGY_MJ,
    );
    expect(r.batteriesPerTrip?.eq(Fraction.from(4))).toBe(true);
    expect(r.tripBasis).toBe("estimated");
    expect(r.portPowerMw.eq(Fraction.from(100))).toBe(true);
  });

  it("5 km round-trip flight → 9 batteries ((24000 + 6×5000)/6000)", () => {
    const r = droneFleet(
      Fraction.from(100),
      Fraction.from(100),
      "battery",
      { kind: "estimated", roundTripFlightMeters: Fraction.from(5000) },
      BATTERY_ENERGY_MJ,
    );
    expect(r.batteriesPerTrip?.eq(Fraction.from(9))).toBe(true);
  });

  it("estimated trip: T_round = d/v(fuel) + 102 s, rate per drone exact", () => {
    // battery 75 m/s, d 5000 m → 5000/75 s + 102 s = 200/3 + 102 = 506/3 s.
    const r = droneFleet(
      Fraction.from(100),
      Fraction.from(100),
      "battery",
      { kind: "estimated", roundTripFlightMeters: Fraction.from(5000) },
      BATTERY_ENERGY_MJ,
    );
    expect(r.roundTripSeconds.eq(Fraction.of(506, 3))).toBe(true);
    // cargo = 9 × 100 = 900; ratePerDrone = 900 × 60 / (506/3) = 81000/253.
    expect(r.ratePerDrone.eq(Fraction.of(81000, 253))).toBe(true);
  });

  it("measured trip WITHOUT distance → batteriesPerTrip is null (never inferred)", () => {
    const r = droneFleet(
      Fraction.from(100),
      Fraction.from(100),
      "battery",
      { kind: "measured", roundTripSeconds: Fraction.from(200) },
      BATTERY_ENERGY_MJ,
    );
    expect(r.batteriesPerTrip).toBeNull();
    expect(r.tripBasis).toBe("measured");
  });

  it("measured trip WITH distance → battery cost computed from the given distance", () => {
    const r = droneFleet(
      Fraction.from(100),
      Fraction.from(100),
      "battery",
      {
        kind: "measured",
        roundTripSeconds: Fraction.from(200),
        roundTripFlightMeters: Fraction.from(5000),
      },
      BATTERY_ENERGY_MJ,
    );
    expect(r.batteriesPerTrip?.eq(Fraction.from(9))).toBe(true);
    // measured time is used verbatim, not overridden by the distance.
    expect(r.roundTripSeconds.eq(Fraction.from(200))).toBe(true);
  });

  it("nDrones uses ceil (exact divisibility → no over-count)", () => {
    // ratePerDrone from the 506/3 s trip = 81000/253. rate = 2 × that → 2 drones.
    const r = droneFleet(
      Fraction.of(162000, 253),
      Fraction.from(100),
      "battery",
      { kind: "estimated", roundTripFlightMeters: Fraction.from(5000) },
      BATTERY_ENERGY_MJ,
    );
    expect(r.nDrones).toBe(2n);
  });

  it("zero required rate → zero drones", () => {
    const r = droneFleet(
      Fraction.from(0),
      Fraction.from(100),
      "battery",
      { kind: "estimated", roundTripFlightMeters: Fraction.from(5000) },
      BATTERY_ENERGY_MJ,
    );
    expect(r.nDrones).toBe(0n);
  });
});
