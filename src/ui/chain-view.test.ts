/**
 * Pure-derive tests for the chain drawn-distance measure feed (Stage 7 / Phase
 * 3, Axis 3), the surface that survives the Combined-view removal (#75):
 * nearest-edge geometry + whole-meter rounding, and the drawn-distance measure-
 * feed mapping (the drone 2× round-trip vs road one-way units trap). Node env,
 * zero React. The connector/power-footer derivations went with the deleted
 * Combined component, so their describes + the shared site/stage fixtures they
 * used are gone with them.
 */

import { describe, it, expect } from "vitest";
import { Fraction } from "../core/fraction.ts";
import type { SolveState, StageLink, StageNode } from "../state/store.ts";
import type { Catalog } from "../data/types.ts";
import {
  nearestEdgeConnector,
  drawnMeters,
  isEstimatedLink,
  applyDrawnDistance,
  drawnDistanceDm,
} from "./chain-view.ts";

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

function link(
  id: string,
  from: string,
  to: string,
  itemId: string,
  transport?: StageLink["transport"],
): StageLink {
  return {
    id,
    fromStageId: from,
    itemId,
    toStageId: to,
    ...(transport !== undefined ? { transport } : {}),
  };
}

// ---------------------------------------------------------------------------
// Connector geometry + distance (Axis 2 / Axis 3).
// ---------------------------------------------------------------------------

describe("nearestEdgeConnector + drawnMeters", () => {
  it("connects the nearest edge midpoints of two horizontally separated boxes", () => {
    // A: origin (0,0) 80×80; B: origin (240,0) 80×80. Nearest edges are A's
    // right midpoint (80,40) and B's left midpoint (240,40) — a 160 dm gap.
    const a = { x: 0, y: 0, w: 80, h: 80 };
    const b = { x: 240, y: 0, w: 80, h: 80 };
    const c = nearestEdgeConnector(a, b);
    expect(c.from).toEqual({ x: 80, y: 40 });
    expect(c.to).toEqual({ x: 240, y: 40 });
    expect(c.distanceDm).toBeCloseTo(160);
    // 160 dm ÷ 10 = 16 m.
    expect(drawnMeters(c.distanceDm)).toBe(16);
  });

  it("measures the straight-line distance dm → whole meters", () => {
    // A 3-4-5 triangle in dm: from (0,0) to (30,40) → 50 dm → 5 m.
    const a = { x: 0, y: 0, w: 0, h: 0 };
    const b = { x: 30, y: 40, w: 0, h: 0 };
    const c = nearestEdgeConnector(a, b);
    expect(c.distanceDm).toBeCloseTo(50);
    expect(drawnMeters(c.distanceDm)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Axis 3 — the measure feed (the units trap in ONE mapping site).
// ---------------------------------------------------------------------------

describe("applyDrawnDistance — the units trap per arm", () => {
  it("writes road one-way meters into distanceText (drawn dm ÷ 10)", () => {
    const l = link("l", "p", "c", "iron_ingot", {
      mode: "truck",
      trip: { kind: "estimated", distanceText: "" },
    });
    // 4120 dm drawn → 412 one-way meters.
    const next = applyDrawnDistance(l, 4120);
    expect(next).toEqual({
      mode: "truck",
      trip: { kind: "estimated", distanceText: "412" },
    });
  });

  it("writes train one-way meters into distanceText", () => {
    const l = link("l", "p", "c", "iron_ingot", {
      mode: "train",
      trip: { kind: "estimated", distanceText: "" },
    });
    const next = applyDrawnDistance(l, 4120);
    expect(next).toEqual({
      mode: "train",
      trip: { kind: "estimated", distanceText: "412" },
    });
  });

  it("writes drone ROUND-TRIP meters (2×) into flightMetersText, keeping fuel", () => {
    const l = link("l", "p", "c", "iron_ingot", {
      mode: "drone",
      fuel: "packaged-fuel",
      trip: { kind: "estimated", flightMetersText: "" },
    });
    // 4120 dm drawn → 412 one-way → 824 round-trip.
    const next = applyDrawnDistance(l, 4120);
    expect(next).toEqual({
      mode: "drone",
      fuel: "packaged-fuel",
      trip: { kind: "estimated", flightMetersText: "824" },
    });
  });

  it("returns null for a measured link (never downgrade better information)", () => {
    const l = link("l", "p", "c", "iron_ingot", {
      mode: "truck",
      trip: { kind: "measured", roundTripSecondsText: "60" },
    });
    expect(applyDrawnDistance(l, 4120)).toBeNull();
    expect(isEstimatedLink(l)).toBe(false);
  });

  it("returns null for a belt link (no trip to fill)", () => {
    const l = link("l", "p", "c", "iron_ingot");
    expect(applyDrawnDistance(l, 4120)).toBeNull();
    expect(isEstimatedLink(l)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// drawnDistanceDm — the global K-coupling pin (#77).
//
// drawnDistanceDm derives site origins through layoutChain, whose scale K is a
// MAX over ALL site pairs (layout.ts:389-402). So the measured A↔B distance is
// NOT a property of the A-B pair alone — a third stage C can drive K up and
// stretch A↔B. This pin makes that byte-identical contract explicit: it locks
// BOTH the A↔B distance at two C positions AND the fact that moving C alone
// changes A↔B. It is the value guard that forbids replacing the engine with a
// naive two-site measure without a deliberate, ticket-tracked semantics change.
// ---------------------------------------------------------------------------

describe("drawnDistanceDm — global K-coupling (three stages)", () => {
  // A single solved smelter stage: one output lane, one machine. layoutStage
  // renders this to a 1×2-tile foundation bbox (80×160 dm) — the geometry the
  // pin's exact distances are computed against.
  function smelterSolve(): SolveState {
    return {
      status: "solved",
      result: {
        feeds: [],
        outputs: [
          {
            itemId: "iron_ingot",
            kind: "belt" as const,
            perMachineOutput: Fraction.from(15),
            totalOutput: Fraction.from(15),
            breakouts: [],
            segments: [],
            findings: [],
          },
        ],
        findings: [],
      },
    } as SolveState;
  }

  function smelterStage(id: string): StageNode {
    return {
      id,
      name: id,
      selection: {
        recipeId: "smelt_iron",
        machineCount: 1,
        clockPercentText: "100",
        unlockedTiers: { belt: 4, pipe: 2 },
        overrides: { feeds: {}, outputs: {} },
      },
      solve: smelterSolve(),
    };
  }

  // buildChainSites reads only catalog.recipes[recipeId].machineId.
  const catalog = {
    recipes: { smelt_iron: { machineId: "smelter_mk1" } },
  } as unknown as Catalog;

  const stages = {
    A: smelterStage("A"),
    B: smelterStage("B"),
    C: smelterStage("C"),
  };
  const stageOrder = ["A", "B", "C"];
  const links: StageLink[] = [link("AB", "A", "B", "iron_ingot")];

  it("pins A↔B = 80 dm when C is far, 240 dm when C is near — the C-move couples A↔B", () => {
    // A=(0,0), B=(100,0) fixed. Each smelter's foundation bbox is 80×160 dm.
    //
    // C far — C=(0,300): the A-B pair (dx=100) drives K = (80+80)/100 = 1.6;
    // C's pairs sit 300 px away and need less scale, so A-B origins scale to a
    // 160 dm gap → nearest edges (A right 80,80) ↔ (B left 160,80) = 80 dm.
    const cFar = {
      A: { x: 0, y: 0 },
      B: { x: 100, y: 0 },
      C: { x: 0, y: 300 },
    };
    const dFar = drawnDistanceDm(
      "AB",
      catalog,
      stages,
      stageOrder,
      links,
      cFar,
    );
    expect(dFar).not.toBeNull();
    expect(dFar!).toBeCloseTo(80);

    // C near — C=(50,5): now the C-A / C-B pairs (dx=50) drive K = 160/50 = 3.2,
    // dominating the A-B pair. A-B origins scale to a 320 dm gap → A↔B = 240 dm.
    // A and B never moved; ONLY C did — proving the max-over-pairs coupling.
    const cNear = {
      A: { x: 0, y: 0 },
      B: { x: 100, y: 0 },
      C: { x: 50, y: 5 },
    };
    const dNear = drawnDistanceDm(
      "AB",
      catalog,
      stages,
      stageOrder,
      links,
      cNear,
    );
    expect(dNear).not.toBeNull();
    expect(dNear!).toBeCloseTo(240);

    // The coupling itself: moving C alone changed the A↔B distance.
    expect(dNear!).not.toBeCloseTo(dFar!);
  });
});
