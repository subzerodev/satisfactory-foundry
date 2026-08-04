/**
 * Routing tests for computeLinkTransport (Stage 7 / Phase 2). Pure over
 * Fractions: each mode dispatches to the right P1 core fn with the right
 * fact-grounded tuple, and trip parsing / stack-size absence surface as errors.
 * Node env, no DOM.
 */

import { describe, it, expect } from "vitest";
import { Fraction } from "../core/fraction.ts";
import { TIER_TABLE } from "../data/tiers.ts";
import type { CatalogItem } from "../data/types.ts";
import {
  computeLinkTransport,
  legalModesFor,
  SOLID_MODES,
  FLUID_MODES,
} from "./transport-plan.ts";

const FULL_TIERS = {
  belt: TIER_TABLE.belt.length,
  pipe: TIER_TABLE.pipe.length,
};

const solid: CatalogItem = {
  id: "iron_plate",
  displayName: "Iron Plate",
  isFluid: false,
  stackSize: Fraction.from(200),
};
const fluid: CatalogItem = {
  id: "water",
  displayName: "Water",
  isFluid: true,
  stackSize: null,
};
const unknownStack: CatalogItem = {
  id: "mystery",
  displayName: "Mystery",
  isFluid: false,
  stackSize: null,
};

const rate = Fraction.from(600);

describe("computeLinkTransport — legality + unsolved", () => {
  it("filters modes by item phase", () => {
    expect(legalModesFor(solid)).toEqual(SOLID_MODES);
    expect(legalModesFor(fluid)).toEqual(FLUID_MODES);
  });

  it("returns unsolved (mode only) when rate is null", () => {
    const plan = computeLinkTransport(
      null,
      { mode: "truck", trip: { kind: "estimated", distanceText: "500" } },
      solid,
      TIER_TABLE,
      FULL_TIERS,
    );
    expect(plan).toEqual({ kind: "unsolved", mode: "truck" });
  });
});

describe("computeLinkTransport — belt / pipe", () => {
  it("absent transport defaults to belt, sizing against the unlocked top tier", () => {
    const plan = computeLinkTransport(rate, undefined, solid, TIER_TABLE, {
      belt: 4,
      pipe: 2,
    });
    if (plan.kind !== "continuous") throw new Error("expected continuous");
    expect(plan.mode).toBe("belt");
    // rate 600 / Mk4 480 → 2 belts; laneRate is the Mk4 rate.
    expect(plan.result.runs).toBe(2n);
    expect(plan.result.laneRate.eq(Fraction.from(480))).toBe(true);
    expect(plan.tierIndex).toBe(4);
  });

  it("pipe sizes against the unlocked pipe tier", () => {
    const plan = computeLinkTransport(
      rate,
      { mode: "pipe" },
      fluid,
      TIER_TABLE,
      { belt: 6, pipe: 1 },
    );
    if (plan.kind !== "continuous") throw new Error("expected continuous");
    // 600 / Pipe Mk1 300 → 2 pipes.
    expect(plan.result.runs).toBe(2n);
    expect(plan.result.laneRate.eq(Fraction.from(300))).toBe(true);
  });
});

describe("computeLinkTransport — road vehicles", () => {
  it("truck: solid cargo = 48 × stackSize, dock 8s, measured trip", () => {
    const plan = computeLinkTransport(
      rate,
      {
        mode: "truck",
        trip: { kind: "measured", roundTripSecondsText: "120" },
      },
      solid,
      TIER_TABLE,
      FULL_TIERS,
    );
    if (plan.kind !== "vehicle") throw new Error("expected vehicle");
    // cargo 48×200 = 9600; T_round = 120 + 16 = 136; ratePerVehicle = 9600×60/136.
    expect(plan.result.cargoPerTrip.eq(Fraction.from(9600))).toBe(true);
    expect(plan.result.roundTripSeconds.eq(Fraction.from(136))).toBe(true);
    expect(plan.result.tripBasis).toBe("measured");
    // Station power: 20 MW × 2 ends = 40 MW.
    expect(plan.stationPowerMw.eq(Fraction.from(40))).toBe(true);
  });

  it("fluid-truck: 3200 m³ tank, dock 9s (fluid item)", () => {
    const plan = computeLinkTransport(
      rate,
      {
        mode: "fluid-truck",
        trip: { kind: "measured", roundTripSecondsText: "100" },
      },
      fluid,
      TIER_TABLE,
      FULL_TIERS,
    );
    if (plan.kind !== "vehicle") throw new Error("expected vehicle");
    expect(plan.result.cargoPerTrip.eq(Fraction.from(3200))).toBe(true);
    // T_round = 100 + 2×9 = 118.
    expect(plan.result.roundTripSeconds.eq(Fraction.from(118))).toBe(true);
  });

  it("estimated trip echoes tripBasis estimated", () => {
    const plan = computeLinkTransport(
      rate,
      { mode: "tractor", trip: { kind: "estimated", distanceText: "500" } },
      solid,
      TIER_TABLE,
      FULL_TIERS,
    );
    if (plan.kind !== "vehicle") throw new Error("expected vehicle");
    expect(plan.result.tripBasis).toBe("estimated");
  });

  it("a solid mode on an unknown-stack item errors (stack size unknown)", () => {
    const plan = computeLinkTransport(
      rate,
      { mode: "truck", trip: { kind: "estimated", distanceText: "500" } },
      unknownStack,
      TIER_TABLE,
      FULL_TIERS,
    );
    expect(plan).toEqual({ kind: "error", message: "stack size unknown" });
  });

  it("a malformed trip string errors", () => {
    const plan = computeLinkTransport(
      rate,
      { mode: "truck", trip: { kind: "estimated", distanceText: "abc" } },
      solid,
      TIER_TABLE,
      FULL_TIERS,
    );
    if (plan.kind !== "error") throw new Error("expected error");
    expect(plan.message).toMatch(/one-way distance/);
  });

  it("a zero trip value errors", () => {
    const plan = computeLinkTransport(
      rate,
      { mode: "truck", trip: { kind: "measured", roundTripSecondsText: "0" } },
      solid,
      TIER_TABLE,
      FULL_TIERS,
    );
    if (plan.kind !== "error") throw new Error("expected error");
    expect(plan.message).toMatch(/> 0/);
  });
});

describe("computeLinkTransport — train (Assumption #6 routing)", () => {
  it("estimated builds 2d/v + 2×lockout; beltFeed = unlocked belt × 2", () => {
    const plan = computeLinkTransport(
      Fraction.from(300),
      { mode: "train", trip: { kind: "estimated", distanceText: "6000" } },
      solid,
      TIER_TABLE,
      { belt: 4, pipe: 2 },
    );
    if (plan.kind !== "train") throw new Error("expected train");
    expect(plan.tripBasis).toBe("estimated");
    // beltFeed = Mk4 (480) × 2 = 960.
    expect(plan.beltFeed.eq(Fraction.from(960))).toBe(true);
    expect(plan.beltTierIndex).toBe(4);
    // One row per c = 1..13 (default maxCars).
    expect(plan.options).toHaveLength(13);
    // cargoPerCar = 32 × 200 = 6400 → first row's throughput is positive.
    expect(plan.options[0]!.carsPerTrain).toBe(1);
  });

  it("measured passes the round trip straight through (caller-owned lockout)", () => {
    const plan = computeLinkTransport(
      Fraction.from(300),
      {
        mode: "train",
        trip: { kind: "measured", roundTripSecondsText: "200" },
      },
      solid,
      TIER_TABLE,
      { belt: 6, pipe: 2 },
    );
    if (plan.kind !== "train") throw new Error("expected train");
    expect(plan.tripBasis).toBe("measured");
    // beltFeed = Mk6 (1200) × 2 = 2400.
    expect(plan.beltFeed.eq(Fraction.from(2400))).toBe(true);
  });

  it("fluid item uses the 2400 m³ freight-car tank", () => {
    const plan = computeLinkTransport(
      Fraction.from(300),
      {
        mode: "train",
        trip: { kind: "measured", roundTripSecondsText: "200" },
      },
      fluid,
      TIER_TABLE,
      FULL_TIERS,
    );
    if (plan.kind !== "train") throw new Error("expected train");
    // A single-car consist throughput reflects the 2400 tank (positive rate).
    expect(plan.options[0]!.throughput.gt(Fraction.from(0))).toBe(true);
  });
});

describe("computeLinkTransport — drone", () => {
  it("estimated: 9 × stackSize cargo, battery cost from flight meters", () => {
    const plan = computeLinkTransport(
      Fraction.from(100),
      {
        mode: "drone",
        fuel: "battery",
        trip: { kind: "estimated", flightMetersText: "2000" },
      },
      solid,
      TIER_TABLE,
      FULL_TIERS,
    );
    if (plan.kind !== "drone") throw new Error("expected drone");
    expect(plan.result.tripBasis).toBe("estimated");
    // batteries = (24000 + 6×2000) / 6000 = 36000/6000 = 6.
    expect(plan.result.batteriesPerTrip!.eq(Fraction.from(6))).toBe(true);
  });

  it("measured without distance → batteriesPerTrip null (never inferred)", () => {
    const plan = computeLinkTransport(
      Fraction.from(100),
      {
        mode: "drone",
        fuel: "battery",
        trip: { kind: "measured", roundTripSecondsText: "180" },
      },
      solid,
      TIER_TABLE,
      FULL_TIERS,
    );
    if (plan.kind !== "drone") throw new Error("expected drone");
    expect(plan.result.batteriesPerTrip).toBeNull();
  });

  it("measured WITH optional distance → battery cost present", () => {
    const plan = computeLinkTransport(
      Fraction.from(100),
      {
        mode: "drone",
        fuel: "battery",
        trip: {
          kind: "measured",
          roundTripSecondsText: "180",
          flightMetersText: "2000",
        },
      },
      solid,
      TIER_TABLE,
      FULL_TIERS,
    );
    if (plan.kind !== "drone") throw new Error("expected drone");
    expect(plan.result.batteriesPerTrip!.eq(Fraction.from(6))).toBe(true);
  });
});
