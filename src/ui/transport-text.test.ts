/**
 * Wording tests for transport-text (Stage 7 / Phase 2). Exact "X/min"-style
 * strings vs the "≈" estimated discipline, the caveat sentences, the train
 * comparison rows, the edge chip, and the unsustainable-train predicate + hint
 * gate. Pure — no DOM.
 */

import { describe, it, expect } from "vitest";
import { Fraction } from "../core/fraction.ts";
import { continuousRuns, trainOptions } from "../core/transport.ts";
import type { TrainOption } from "../core/transport.ts";
import type {
  TransportContinuous,
  TransportVehicle,
  TransportTrain,
  TransportDrone,
} from "../core/transport-plan.ts";
import {
  continuousLine,
  vehicleLine,
  droneLine,
  droneBatteryLine,
  caveatFor,
  pipeCaveat,
  trainRows,
  trainBeltFeedFootnote,
  trainSharedEndsFootnote,
  edgeChip,
  routeEdgeChip,
  unsustainableTrainRow,
  unsustainableTrainText,
  ESTIMATED_SUFFIX,
} from "./transport-text.ts";

function vehicle(
  nVehicles: bigint,
  ratePerVehicle: number,
  basis: "measured" | "estimated",
  exactRate?: Fraction,
): TransportVehicle {
  return {
    kind: "vehicle",
    mode: "truck",
    result: {
      roundTripSeconds: Fraction.from(100),
      cargoPerTrip: Fraction.from(9600),
      ratePerVehicle: exactRate ?? Fraction.from(ratePerVehicle),
      nVehicles,
      tripBasis: basis,
    },
    stationPowerMw: Fraction.from(40),
  };
}

describe("transport-text — fleet lines + estimated suffix", () => {
  it("continuous line names the run count + exact laneRate", () => {
    const plan: TransportContinuous = {
      kind: "continuous",
      mode: "belt",
      result: continuousRuns("belt", Fraction.from(600), Fraction.from(480)),
      tierIndex: 4,
      deratePercent: null,
    };
    expect(continuousLine(plan)).toBe("2 belts sustain 480/min each");
    const one: TransportContinuous = {
      kind: "continuous",
      mode: "belt",
      result: continuousRuns("belt", Fraction.from(400), Fraction.from(480)),
      tierIndex: 4,
      deratePercent: null,
    };
    expect(continuousLine(one)).toBe("1 belt sustains 480/min each");
  });

  it("measured vehicle line has NO optimistic suffix (exact)", () => {
    expect(vehicleLine(vehicle(3n, 480, "measured"))).toBe(
      "3 trucks sustain 480/min each over this trip",
    );
  });

  it("estimated vehicle line carries the optimistic suffix", () => {
    const line = vehicleLine(vehicle(3n, 480, "estimated"));
    expect(line.endsWith(ESTIMATED_SUFFIX)).toBe(true);
    expect(line).toContain("at top speed — optimistic");
  });

  it("singular vs plural noun on the vehicle count", () => {
    expect(vehicleLine(vehicle(1n, 100, "measured"))).toContain(
      "1 truck sustains ",
    );
    expect(vehicleLine(vehicle(3n, 100, "measured"))).toContain(
      "3 trucks sustain ",
    );
  });
});

describe("transport-text — drone lines", () => {
  function drone(
    batteries: Fraction | null,
    basis: "measured" | "estimated",
    fuel: TransportDrone["fuel"] = "battery",
  ): TransportDrone {
    return {
      kind: "drone",
      mode: "drone",
      fuel,
      result: {
        nDrones: 2n,
        ratePerDrone: Fraction.from(50),
        roundTripSeconds: Fraction.from(200),
        tripBasis: basis,
        batteriesPerTrip: batteries,
        portPowerMw: Fraction.from(100),
      },
    };
  }

  it("drone line + exact battery cost", () => {
    const plan = drone(Fraction.from(6), "measured");
    expect(droneLine(plan)).toBe("2 drones sustain 50/min each");
    expect(
      droneLine({ ...plan, result: { ...plan.result, nDrones: 1n } }),
    ).toBe("1 drone sustains 50/min each");
    expect(droneBatteryLine(plan)).toBe("6 batteries per round trip");
  });

  it("null batteries → the add-distance prompt", () => {
    expect(droneBatteryLine(drone(null, "measured"))).toBe(
      "add flight distance for battery cost",
    );
  });

  it("non-battery fuel → exact MJ, never a battery count (honest units)", () => {
    // 6 battery-equivalents × 6000 MJ = exactly 36000 MJ; the word
    // "batteries" must not appear for a uranium-fuelled drone.
    const plan = drone(Fraction.from(6), "measured", "uranium-fuel-rod");
    expect(droneBatteryLine(plan)).toBe("round-trip energy 36000 MJ");
    expect(droneBatteryLine(plan)).not.toContain("batteries");
    expect(droneBatteryLine(drone(null, "measured", "uranium-fuel-rod"))).toBe(
      "add flight distance for energy cost",
    );
  });
});

describe("transport-text — caveats", () => {
  it("each mode's fixed caveat sentence", () => {
    expect(caveatFor("pipe")).toBe(
      "nominal ceiling — manifolds can sustain less",
    );
    expect(caveatFor("truck")).toBe(">1 vehicle: station queueing not modeled");
    expect(caveatFor("train")).toBe("signal headway not modeled");
    expect(caveatFor("drone")).toBe("shared destination ports queue");
    expect(caveatFor("belt")).toBeNull();
  });

  it("pipeCaveat without a derate = today's static nominal-ceiling line", () => {
    const plan: TransportContinuous = {
      kind: "continuous",
      mode: "pipe",
      result: continuousRuns("pipe", Fraction.from(600), Fraction.from(300)),
      tierIndex: 1,
      deratePercent: null,
    };
    expect(pipeCaveat(plan)).toBe(
      "nominal ceiling — manifolds can sustain less",
    );
  });

  it("pipeCaveat WITH a derate names the percent + its user-assumption provenance", () => {
    const plan: TransportContinuous = {
      kind: "continuous",
      mode: "pipe",
      result: continuousRuns("pipe", Fraction.from(600), Fraction.from(150)),
      tierIndex: 1,
      deratePercent: Fraction.from(50),
    };
    expect(pipeCaveat(plan)).toBe(
      "derated to 50% of nominal — your assumption, not a game constant",
    );
    // Exact fractional percentage renders exactly (no float).
    expect(
      pipeCaveat({ ...plan, deratePercent: Fraction.of(67, 2) }),
    ).toContain("derated to 33.5% of nominal");
  });
});

describe("transport-text — train rows + chip", () => {
  // A modest consist enumeration for a solid item (stack 200 → 6400/car).
  function trainPlan(
    rate: number,
    basis: "measured" | "estimated",
  ): TransportTrain {
    return {
      kind: "train",
      mode: "train",
      options: trainOptions(
        Fraction.from(rate),
        Fraction.from(6400),
        Fraction.from(400),
        { beltFeed: Fraction.from(960) },
      ),
      tripBasis: basis,
      beltTierIndex: 4,
      beltFeed: Fraction.from(960),
      sharedEnds: undefined,
    };
  }

  it("fleet lines use the ≈ form for non-terminating per-vehicle rates", () => {
    // 4800/7 per truck is non-terminating → "≈ 685.7", never "4800/7".
    const plan = vehicle(3n, 100, "measured", Fraction.of(4800, 7));
    const line = vehicleLine(plan);
    expect(line).toContain("≈ 685.7/min");
    expect(line).not.toContain("/7");
  });

  it("non-terminating sustained rate renders the honest ≈ form, never n/d", () => {
    // roundTrip 10354/25 s (an arbitrary measured input, not a lockout
    // derivation) with cargo 6400/car: 6400×60/(10354/25) is
    // non-terminating → the cell must read "≈ …", not a raw fraction.
    const plan = {
      ...trainPlan(300, "measured"),
      options: trainOptions(
        Fraction.from(300),
        Fraction.from(6400),
        Fraction.of(10354, 25),
        { beltFeed: Fraction.from(960) },
      ),
    };
    const rows = trainRows(plan);
    expect(rows[0]!.sustainedRate.startsWith("≈ ")).toBe(true);
    expect(rows[0]!.sustainedRate).not.toContain("/");
  });

  it("one row per consist; station-limited marker tracks ceilingBound", () => {
    const plan = trainPlan(300, "measured");
    const rows = trainRows(plan);
    expect(rows).toHaveLength(13);
    // stationLimited mirrors the P1 ceilingBound flag on each row.
    rows.forEach((r, i) => {
      expect(r.stationLimited).toBe(plan.options[i]!.ceilingBound);
    });
  });

  it("belt-feed footnote names the tier + exact rate", () => {
    expect(trainBeltFeedFootnote(trainPlan(300, "measured"))).toBe(
      "belt feed: Mk4 × 2 = 960/min per platform",
    );
  });

  it("shared-ends footnote: null when no end is flagged (default station set)", () => {
    const plan = trainPlan(300, "measured"); // sharedEnds undefined
    expect(trainSharedEndsFootnote(plan, "Smelter", "Assembler")).toBeNull();
  });

  it("shared-ends footnote names ONE flagged end (singular 'end shared')", () => {
    const from = {
      ...trainPlan(300, "measured"),
      sharedEnds: { from: true as const },
    };
    expect(trainSharedEndsFootnote(from, "Smelter", "Assembler")).toBe(
      "Smelter end shared — excluded from station MW",
    );
    const to = {
      ...trainPlan(300, "measured"),
      sharedEnds: { to: true as const },
    };
    expect(trainSharedEndsFootnote(to, "Smelter", "Assembler")).toBe(
      "Assembler end shared — excluded from station MW",
    );
  });

  it("shared-ends footnote names BOTH flagged ends (plural 'ends shared')", () => {
    const both = {
      ...trainPlan(300, "measured"),
      sharedEnds: { from: true as const, to: true as const },
    };
    expect(trainSharedEndsFootnote(both, "Smelter", "Assembler")).toBe(
      "Smelter and Assembler ends shared — excluded from station MW",
    );
  });

  it("edge chip: estimated basis prefixes ≈", () => {
    const est = edgeChip(trainPlan(300, "estimated"));
    expect(est).not.toBeNull();
    expect(est!.startsWith("· ≈")).toBe(true);
    const meas = edgeChip(trainPlan(300, "measured"));
    expect(meas!.startsWith("· ≈")).toBe(false);
    expect(meas!.startsWith("· ")).toBe(true);
  });

  it("belt continuous → the lane count chip (#157)", () => {
    // 600/min over a 480/min belt tier → ceil(600/480) = 2 lanes (non-trivial).
    const plan: TransportContinuous = {
      kind: "continuous",
      mode: "belt",
      result: continuousRuns("belt", Fraction.from(600), Fraction.from(480)),
      tierIndex: 4,
      deratePercent: null,
    };
    expect(edgeChip(plan)).toBe("· 2 belts");
  });

  it("belt continuous of exactly one lane → the singular 'belt' noun (#157)", () => {
    // 480/min over a 480/min belt tier → exactly 1 lane, exercising the noun arm.
    const plan: TransportContinuous = {
      kind: "continuous",
      mode: "belt",
      result: continuousRuns("belt", Fraction.from(480), Fraction.from(480)),
      tierIndex: 4,
      deratePercent: null,
    };
    expect(edgeChip(plan)).toBe("· 1 belt");
  });
});

describe("routeEdgeChip", () => {
  it("labels forward and empty-return route summaries independently", () => {
    expect(routeEdgeChip("forward", vehicle(2n, 100, "measured"))).toBe(
      "· forward 2 trucks",
    );
    expect(routeEdgeChip("empty return", vehicle(3n, 100, "estimated"))).toBe(
      "· empty return ≈ 3 trucks",
    );
  });

  it("omits unsolved and error route summaries", () => {
    expect(
      routeEdgeChip("forward", { kind: "unsolved", mode: "truck" }),
    ).toBeNull();
    expect(
      routeEdgeChip("forward", { kind: "error", message: "bad trip" }),
    ).toBeNull();
  });

  it("labels a belt route summary with its lane count (#157)", () => {
    // routeEdgeChip has no belt guard of its own — it delegates to edgeChip, so
    // the #157 belt chip flows straight through to the route label.
    // 600/min over a 270/min belt tier → ceil(600/270) = 3 lanes (non-trivial).
    expect(
      routeEdgeChip("forward", {
        kind: "continuous",
        mode: "belt",
        result: continuousRuns("belt", Fraction.from(600), Fraction.from(270)),
        tierIndex: 3,
        deratePercent: null,
      }),
    ).toBe("· forward 3 belts");
  });
});

describe("transport-text — unsustainable-train finding", () => {
  // Build options where even the max-car row cannot sustain the rate AND the
  // belt-feed arm binds (small beltFeed vs a large per-car cargo → ceilingBound
  // true, so the hint's belt-feed branch is exercised). A huge rate exceeds the
  // pair ceiling at every consist size.
  function tinyOptions(): TrainOption[] {
    return trainOptions(
      Fraction.from(100000), // absurd rate
      Fraction.from(6400), // 32 × stack 200
      Fraction.from(120),
      { beltFeed: Fraction.from(100), maxCars: 3 },
    );
  }

  it("flags a rate above the max-car pair ceiling; returns the max row", () => {
    const options = tinyOptions();
    const row = unsustainableTrainRow(Fraction.from(100000), options);
    expect(row).not.toBeNull();
    expect(row!.carsPerTrain).toBe(3); // the max-car row
  });

  it("finding wording renders a non-terminating ceiling as ≈, never n/d", () => {
    // #140 P0: with the corrected 27 s lockout, RtD 140 / beltFeed 100 yields a
    // per-platform ceiling of 565/7 (non-terminating, belt-term binds); at 4
    // cars the pair ceiling 2260/7 stays non-terminating (denominator 7 does not
    // cancel), so the ≈-approximation branch is exercised. 2260/7 ≈ 322.9.
    const options = trainOptions(
      Fraction.from(100000),
      Fraction.from(6400),
      Fraction.from(140),
      { beltFeed: Fraction.from(100), maxCars: 4 },
    );
    const row = unsustainableTrainRow(Fraction.from(100000), options);
    const text = unsustainableTrainText(
      "Iron Ingot",
      Fraction.from(100000),
      row!,
    );
    expect(text).toContain("max ≈ 322.9/min");
    expect(text).not.toMatch(/max \d+\/\d+/);
  });

  it("finding wording renders a non-terminating REQUIRED RATE as ≈ too", () => {
    // A 100/3-style clock yields a non-terminating demand (2800/3 ≈ 933.3);
    // the rate token must not leak n/d either.
    const options = trainOptions(
      Fraction.of(2800, 3),
      Fraction.from(6400),
      Fraction.from(120),
      { beltFeed: Fraction.from(100), maxCars: 3 },
    );
    const row = unsustainableTrainRow(Fraction.of(2800, 3), options);
    const text = unsustainableTrainText(
      "Iron Ingot",
      Fraction.of(2800, 3),
      row!,
    );
    expect(text).toContain("Iron Ingot: ≈ 933.3/min exceeds");
    expect(text).not.toContain("2800/3");
  });

  it("a sustainable rate returns null (no finding)", () => {
    const options = trainOptions(
      Fraction.from(10),
      Fraction.from(6400),
      Fraction.from(400),
      { beltFeed: Fraction.from(960) },
    );
    expect(unsustainableTrainRow(Fraction.from(10), options)).toBeNull();
  });

  it("hint appends the belt-feed sentence when the max row is ceilingBound", () => {
    const options = tinyOptions();
    const row = unsustainableTrainRow(Fraction.from(100000), options)!;
    expect(row.ceilingBound).toBe(true); // the belt-feed arm binds here
    const text = unsustainableTrainText(
      "Iron Plate",
      Fraction.from(100000),
      row,
    );
    expect(text).toContain("Iron Plate:");
    expect(text).toContain(
      "A faster belt feed would raise the station ceiling.",
    );
  });

  it("hint omits the belt-feed sentence when the row is NOT ceilingBound", () => {
    // Capacity-bound: no beltFeed → the per-trip capacity term binds, never belt.
    const options = trainOptions(
      Fraction.from(100000),
      Fraction.from(1),
      Fraction.from(60),
      { maxCars: 3 },
    );
    const row = unsustainableTrainRow(Fraction.from(100000), options)!;
    expect(row.ceilingBound).toBe(false);
    const text = unsustainableTrainText(
      "Iron Plate",
      Fraction.from(100000),
      row,
    );
    expect(text).not.toContain("belt feed would raise");
  });
});
