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
import type { StageLink } from "../state/store.ts";
import {
  nearestEdgeConnector,
  drawnMeters,
  isEstimatedLink,
  applyDrawnDistance,
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
