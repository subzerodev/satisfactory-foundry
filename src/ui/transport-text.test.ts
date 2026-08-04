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
} from "./transport-plan.ts";
import {
  continuousLine,
  vehicleLine,
  droneLine,
  droneBatteryLine,
  caveatFor,
  trainRows,
  trainBeltFeedFootnote,
  edgeChip,
  unsustainableTrainRow,
  unsustainableTrainText,
  ESTIMATED_SUFFIX,
} from "./transport-text.ts";

function vehicle(
  nVehicles: bigint,
  ratePerVehicle: number,
  basis: "measured" | "estimated",
): TransportVehicle {
  return {
    kind: "vehicle",
    mode: "truck",
    result: {
      roundTripSeconds: Fraction.from(100),
      cargoPerTrip: Fraction.from(9600),
      ratePerVehicle: Fraction.from(ratePerVehicle),
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
    };
    expect(continuousLine(plan)).toBe("2 belts sustain 480/min each");
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
    expect(vehicleLine(vehicle(1n, 100, "measured"))).toContain("1 truck ");
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
    };
  }

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

  it("edge chip: estimated basis prefixes ≈", () => {
    const est = edgeChip(trainPlan(300, "estimated"));
    expect(est).not.toBeNull();
    expect(est!.startsWith("· ≈")).toBe(true);
    const meas = edgeChip(trainPlan(300, "measured"));
    expect(meas!.startsWith("· ≈")).toBe(false);
    expect(meas!.startsWith("· ")).toBe(true);
  });

  it("belt continuous → no chip (renders as today)", () => {
    const plan: TransportContinuous = {
      kind: "continuous",
      mode: "belt",
      result: continuousRuns("belt", Fraction.from(600), Fraction.from(480)),
      tierIndex: 4,
    };
    expect(edgeChip(plan)).toBeNull();
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
