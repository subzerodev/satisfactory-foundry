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
// drawnDistanceDm — the two-site measure (Stage 17, ticket #89).
//
// The chain composer retired: drawnDistanceDm is now a PURE pair measure —
// only the two endpoint stages' positions + footprints enter. The four pins
// below lock that contract: DECOUPLING (moving a third stage cannot change the
// readout — the exact inversion of the retired global-K coupling pin), the
// exact pair value (fractional now that the chain grid-rounding is gone),
// COINCIDENT endpoints reading 0 dm with no special case (the primitive is
// total), and the near-coincident FLOOR (edge distance = CHAIN_GUTTER, NOT a
// smooth approach to 0).
// ---------------------------------------------------------------------------

describe("drawnDistanceDm — two-site measure (#89)", () => {
  // A single solved smelter stage: one output lane, one machine. layoutStage
  // renders this to a 1×2-tile foundation bbox (80×160 dm) — the geometry the
  // pins' exact distances are computed against.
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

  // siteFor reads only catalog.recipes[recipeId].machineId.
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

  // Pin 1 — DECOUPLING (replaces the retired global-K coupling pin, same
  // fixture). A=(0,0), B=(100,0). Each smelter bbox is 80×160 dm; the A-B pair
  // drives k = (leftWidth 80 + gutter 80)/dx 100 = 1.6, so origins scale to a
  // 160 dm gap → nearest edges (A right 80,80) ↔ (B left 160,80) = 80 dm. This
  // is byte-identical for BOTH C positions — moving C cannot touch A↔B (the
  // exact inversion of the old test, where the near C drove it to 240 dm). The
  // 80 dm equals the old far-C value EXACTLY: the retired ceilTo10(160) snap was
  // a no-op on this already-grid-aligned geometry.
  it("A↔B is IDENTICAL regardless of a third stage C (decoupling)", () => {
    const withCFar = drawnDistanceDm("AB", catalog, stages, stageOrder, links, {
      A: { x: 0, y: 0 },
      B: { x: 100, y: 0 },
      C: { x: 0, y: 300 },
    });
    const withCNear = drawnDistanceDm(
      "AB",
      catalog,
      stages,
      stageOrder,
      links,
      {
        A: { x: 0, y: 0 },
        B: { x: 100, y: 0 },
        C: { x: 50, y: 5 }, // the position that drove A↔B to 240 dm under the old K
      },
    );
    expect(withCFar).not.toBeNull();
    expect(withCNear).not.toBeNull();
    // Both read 80 dm — the pair value — and are equal: C is decoupled.
    expect(withCFar!).toBeCloseTo(80);
    expect(withCNear!).toBeCloseTo(80);
    expect(withCNear!).toBeCloseTo(withCFar!);
  });

  // Pin 2 — the exact pair value at a k-driven diagonal (no round-number
  // assumption; the chain grid-rounding is gone). A=(0,0), B=(80,60): dx=80,
  // dy=60; leftWidth=80 (A), topHeight=160 (A); kx=(80+80)/80=2, ky=(160+80)/60
  // =4 → k=min=2. B origin scales to (160,120). Nearest edges: A right (80,80)
  // ↔ B top (200,120) → Δ=(120,40) → √16000 = 40√10 ≈ 126.49 dm — NOT a
  // multiple of 10.
  it("reads the exact (fractional) nearest-edge distance for a known pair", () => {
    const d = drawnDistanceDm("AB", catalog, stages, stageOrder, links, {
      A: { x: 0, y: 0 },
      B: { x: 80, y: 60 },
    });
    expect(d).not.toBeNull();
    expect(d!).toBeCloseTo(Math.sqrt(16000)); // 40√10 ≈ 126.4911
  });

  // Pin 3 — coincident endpoints read 0 dm with NO special-case code. The
  // primitive is total: all-Infinity per-axis → K_MIN, both boxes land at the
  // same origin, and nearestEdgeConnector on identical boxes returns 0 naturally.
  it("reads 0 dm for coincident endpoints (falls out of the total primitive)", () => {
    const d = drawnDistanceDm("AB", catalog, stages, stageOrder, links, {
      A: { x: 10, y: 10 },
      B: { x: 10, y: 10 },
    });
    expect(d).not.toBeNull();
    expect(d!).toBeCloseTo(0);
  });

  // Pin 4 — the near-coincident FLOOR on an axis-aligned approach. A=(0,0),
  // B=(1,0): as the canvas delta shrinks, k grows (here k=(80+80)/1=160) but the
  // scaled origin separation converges to leftWidth+gutter = 160 dm, so the
  // nearest-EDGE distance floors at the gutter = 80 dm (160 − leftWidth 80) —
  // NOT leftWidth+gutter (that is the ORIGIN separation), and NOT a smooth
  // approach to 0. The measure jumps to 0 only when the endpoints are EXACTLY
  // coincident (Pin 3).
  it("floors the near-coincident axis-aligned edge distance at CHAIN_GUTTER (80 dm)", () => {
    const d = drawnDistanceDm("AB", catalog, stages, stageOrder, links, {
      A: { x: 0, y: 0 },
      B: { x: 1, y: 0 },
    });
    expect(d).not.toBeNull();
    expect(d!).toBeCloseTo(80); // == CHAIN_GUTTER, the gutter-enforced floor
  });
});
