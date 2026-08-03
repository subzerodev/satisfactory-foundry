import { describe, it, expect } from "vitest";
import { Fraction } from "../core/fraction.ts";
import { solveStage } from "../core/manifold.ts";
import type { StageInput } from "../core/manifold.ts";
import { computeLayout, LAYOUT } from "./layout.ts";
import { FIXTURE_TIERS, WORKED_INPUT, workedResult } from "./fixtures.ts";

function stage(machineCount: number): StageInput {
  return { ...WORKED_INPUT, machineCount };
}

describe("computeLayout — worked example (N=20)", () => {
  const layout = computeLayout(workedResult(), 20);

  it("emits one machine per count", () => {
    expect(layout.machines.length).toBe(20);
  });

  it("pitches wide enough to label every machine", () => {
    // usable 912 / 20 = 45.6 → floor 45, within [8,48]; ≥ labelPitch so step 1.
    expect(layout.pitch).toBe(45);
    expect(layout.labelStep).toBe(1);
    expect(layout.scrolled).toBe(false);
    expect(layout.machines.every((m) => m.labeled)).toBe(true);
  });

  it("places the second feed belt arrow at boundary 16", () => {
    const feed = layout.feeds[0]!;
    // belt index 1 enters after machine 16 → x = marginX + 16×pitch.
    const arrow = feed.belts[1]!;
    expect(arrow.x).toBe(LAYOUT.marginX + 16 * layout.pitch);
  });

  it("spans segments at machine edges with a seam at boundary 16", () => {
    const feed = layout.feeds[0]!;
    const first = feed.segments[0]!; // machines 1–16
    expect(first.x1).toBe(LAYOUT.marginX + 0 * layout.pitch);
    expect(first.x2).toBe(LAYOUT.marginX + 16 * layout.pitch);
    const second = feed.segments[1]!; // machines 17–20
    expect(second.x1).toBe(LAYOUT.marginX + 16 * layout.pitch);
    expect(second.x2).toBe(LAYOUT.marginX + 20 * layout.pitch);
    // Interior seam at the second segment's start boundary.
    expect(feed.seams).toEqual([LAYOUT.marginX + 16 * layout.pitch]);
  });

  it("stacks lane bands per the vertical formula", () => {
    expect(layout.feeds[0]!.y).toBe(LAYOUT.marginY);
    expect(layout.feeds[0]!.busY).toBe(LAYOUT.marginY + LAYOUT.laneH - 8);
    const machineTop = LAYOUT.marginY + 1 * LAYOUT.laneH + LAYOUT.busH;
    const outBandY = machineTop + LAYOUT.machineH + LAYOUT.busH;
    expect(layout.outputs[0]!.y).toBe(outBandY);
    expect(layout.outputs[0]!.busY).toBe(outBandY + 8);
    expect(layout.height).toBe(
      LAYOUT.marginY * 2 +
        1 * LAYOUT.laneH +
        LAYOUT.busH * 2 +
        LAYOUT.machineH +
        1 * LAYOUT.laneH,
    );
  });

  it("passes through belt indices and spans, never re-derives", () => {
    const feed = layout.feeds[0]!;
    expect(feed.segments.map((s) => s.beltIndex)).toEqual([0, 1]);
    expect(feed.segments.map((s) => [s.fromMachine, s.toMachine])).toEqual([
      [1, 16],
      [17, 20],
    ]);
  });
});

describe("computeLayout — compression", () => {
  it("clamps pitch and steps labels for N=200", () => {
    const layout = computeLayout(solveStage(stage(200)), 200);
    expect(layout.pitch).toBe(LAYOUT.minPitch);
    // ceil(200 × labelPitch / usable) = ceil(200×20/912) = ceil(4.386) = 5.
    expect(layout.labelStep).toBe(5);
    expect(layout.machines[0]!.labeled).toBe(true);
    expect(layout.machines[199]!.labeled).toBe(true);
  });

  it("scrolls and widens for N=2000", () => {
    const layout = computeLayout(solveStage(stage(2000)), 2000);
    expect(layout.scrolled).toBe(true);
    expect(layout.width).toBe(LAYOUT.marginX * 2 + LAYOUT.minPitch * 2000);
  });
});

describe("computeLayout — degenerate", () => {
  it("emits an empty machine row for N=0 without throwing", () => {
    const layout = computeLayout(solveStage(stage(0)), 0);
    expect(layout.machines.length).toBe(0);
    // Degenerate lanes solve to empty arrays — no tracks with belts/segments.
    expect(layout.feeds.every((t) => t.belts.length === 0)).toBe(true);
  });

  it("emits an empty track for an infeasible lane", () => {
    // One machine demands 500/min — past the top belt (480) → empty belts.
    const infeasible: StageInput = {
      machineCount: 4,
      clockPercent: Fraction.from(100),
      capacities: FIXTURE_TIERS,
      feeds: [
        {
          itemId: "ore_iron",
          kind: "belt",
          perMachineRate: Fraction.from(500),
        },
      ],
      outputs: [],
    };
    const layout = computeLayout(solveStage(infeasible), 4);
    expect(layout.feeds[0]!.belts).toEqual([]);
    expect(layout.feeds[0]!.segments).toEqual([]);
  });
});
