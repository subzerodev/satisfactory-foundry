import { describe, it, expect } from "vitest";
import { Fraction } from "../core/fraction.ts";
import { solveStage } from "../core/manifold.ts";
import type { StageInput } from "../core/manifold.ts";
import { bandMode, computeLayout, LAYOUT } from "./layout.ts";
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

  it("exposes machineTop for the component to consume, not re-derive", () => {
    expect(layout.machineTop).toBe(
      LAYOUT.marginY + 1 * LAYOUT.laneH + LAYOUT.busH,
    );
  });

  it("passes each segment's exact peakFlow through", () => {
    const feed = layout.feeds[0]!;
    // Head segment peaks at belt 1's 480 entry (exact-drain worked example).
    expect(feed.segments[0]!.peakFlow.eq(Fraction.from(480))).toBe(true);
    expect(feed.segments[1]!.peakFlow.eq(Fraction.from(120))).toBe(true);
  });
});

describe("computeLayout — peakFlow ≠ belt capacity (N=17 under-filled span)", () => {
  it("keeps the honest span peak when the breakout's tier exceeds its load", () => {
    // Output side, N=17: the second breakout spans machine 17 only — load
    // 30/min but assigned tier Mk1 (60/min). peakFlow must stay 30, not the
    // belt's capacity — the divergence the boundary review r1 caught.
    const result = solveStage(stage(17));
    const out = computeLayout(result, 17).outputs[0]!;
    const last = out.segments[out.segments.length - 1]!;
    expect(last.fromMachine).toBe(17);
    expect(last.peakFlow.eq(Fraction.from(30))).toBe(true);
    expect(
      result.outputs[0]!.breakouts[last.beltIndex]!.capacity.eq(
        Fraction.from(60),
      ),
    ).toBe(true);
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

describe("bandMode — the LOD threshold (Stage 12 P1 Axis 1)", () => {
  it("is the pitch clamp's own floor: false at N=114, true at N=115", () => {
    // USABLE/minPitch = 912/8 = 114. floor(912/114)=8 (not floored) → readable
    // ticks; floor(912/115)=7 (<8, clamp floors) → band. The boundary is exact.
    expect(bandMode(114)).toBe(false);
    expect(bandMode(115)).toBe(true);
    // The layout carries the same decision.
    expect(computeLayout(solveStage(stage(114)), 114).band).toBe(false);
    expect(computeLayout(solveStage(stage(115)), 115).band).toBe(true);
  });

  it("leaves the significant set empty below the threshold", () => {
    // Off = the full per-machine tick row renders, so no significant subset.
    expect(computeLayout(solveStage(stage(114)), 114).significant).toEqual([]);
  });
});

describe("computeLayout — band significant set (N=161)", () => {
  // A starving 161-machine feed (belt 0 under-capped to 50/min) so the union
  // spans EVERY significant kind: feed entries, output breakouts, each segment's
  // bounds, AND finding-referenced machines — the starve names machine 148
  // (partial) and 149 (starvedFrom), interior indices at NO segment/entry
  // boundary, proving the finding union member is included (the r1 HIGH: a
  // finding must keep "machine 148" locatable in the band).
  const starving: StageInput = {
    machineCount: 161,
    clockPercent: Fraction.from(100),
    capacities: FIXTURE_TIERS,
    feeds: [
      {
        itemId: "ore_iron",
        kind: "belt",
        perMachineRate: Fraction.from(30),
        overrides: [Fraction.from(50)],
      },
    ],
    outputs: [
      { itemId: "iron_ingot", kind: "belt", perMachineRate: Fraction.from(30) },
    ],
  };

  it("is the exact set-union of entries, breakouts, segment bounds, finding machines — nothing else", () => {
    const layout = computeLayout(solveStage(starving), 161);
    expect(layout.band).toBe(true);
    expect(layout.significant).toEqual([
      1, 2, 16, 17, 18, 32, 33, 34, 48, 49, 50, 64, 65, 66, 80, 81, 82, 96, 97,
      98, 112, 113, 114, 128, 129, 130, 144, 145, 146, 148, 149, 160, 161,
    ]);
  });

  it("includes finding-referenced interior machines absent from any boundary", () => {
    const layout = computeLayout(solveStage(starving), 161);
    // 148 (partial.machine) and 149 (starvedFrom) are NOT segment bounds, feed
    // entries, or output breakouts — they enter the set ONLY via the finding.
    expect(layout.significant).toContain(148);
    expect(layout.significant).toContain(149);
  });

  // --- Axis B (#78): the labeled subset of the significant set. ------------
  it("labels every finding-referenced machine (priority tier always kept)", () => {
    const layout = computeLayout(solveStage(starving), 161);
    // 148 + 149 are the finding-referenced pair — both must carry a label even
    // though they sit one index (8px) apart (findability beats aesthetics).
    expect(layout.labeledSignificant).toContain(148);
    expect(layout.labeledSignificant).toContain(149);
  });

  it("labeledSignificant is a subset of significant", () => {
    const layout = computeLayout(solveStage(starving), 161);
    const sig = new Set(layout.significant);
    expect(layout.labeledSignificant.every((m) => sig.has(m))).toBe(true);
  });

  // The finding-referenced (priority) tier for THIS fixture: the starve names
  // 148 (partial) + 149 (starvedFrom), and every over-capacity feed segment
  // names its from/to bound as a finding too — so the priority tier is the full
  // set below, ALL force-labeled. (This is larger than the {148,149} pair the
  // frozen contract sketched; see the r2 log — the design is unchanged, only the
  // expected literal moved to the real solve's finding set.)
  const PRIORITY = new Set([
    2, 17, 18, 33, 34, 49, 50, 65, 66, 81, 82, 97, 98, 113, 114, 129, 130, 145,
    148, 149, 161,
  ]);

  it("saturated fixture: greedy adds nothing; the residual is exactly the nine adjacent priority pairs", () => {
    const layout = computeLayout(solveStage(starving), 161);
    // On this starving fixture every greedy candidate sits within 2 indices of
    // a priority label, so the labeled subset IS the priority tier — the
    // generic ≥3-index greedy-spacing guarantee is exercised by the no-finding
    // fixture below (here the spacing loop would be vacuous: every consecutive
    // kept pair is priority-priority).
    expect(layout.labeledSignificant).toEqual(
      [...PRIORITY].sort((x, y) => x - y),
    );
    // The by-design findability residual, characterized HONESTLY: force-kept
    // priority labels closer than 3 indices. On this fixture that is exactly
    // NINE adjacent pairs (each segment-over-capacity from/to bound pair, plus
    // the starve pair) — not only {148,149}.
    const kept = layout.labeledSignificant;
    const closePairs: Array<[number, number]> = [];
    for (let i = 1; i < kept.length; i++) {
      if (kept[i]! - kept[i - 1]! < 3)
        closePairs.push([kept[i - 1]!, kept[i]!]);
    }
    expect(closePairs).toEqual([
      [17, 18],
      [33, 34],
      [49, 50],
      [65, 66],
      [81, 82],
      [97, 98],
      [113, 114],
      [129, 130],
      [148, 149],
    ]);
  });

  it("pins the labeled subset for N=161 (21 labels vs 33 significant ticks)", () => {
    const layout = computeLayout(solveStage(starving), 161);
    // The priority tier saturates this dense fixture, so greedy fill adds
    // nothing new: the labeled subset IS the finding-referenced set. Thinning is
    // still real (21 labels < 33 ticks) — the elided 12 are the non-finding
    // significant boundaries (1, 16, 32, … the segment/entry ticks) that crowd
    // against a neighbouring priority label.
    expect(layout.labeledSignificant).toEqual([
      2, 17, 18, 33, 34, 49, 50, 65, 66, 81, 82, 97, 98, 113, 114, 129, 130,
      145, 148, 149, 161,
    ]);
    // Strictly fewer labels than ticks — the thinning is real.
    expect(layout.labeledSignificant.length).toBeLessThan(
      layout.significant.length,
    );
    // {148,149} is one of the NINE by-design adjacent priority pairs (the full
    // residual set is pinned in the saturated-fixture test above).
    expect(layout.labeledSignificant).toContain(148);
    expect(layout.labeledSignificant).toContain(149);
    // A non-finding boundary that crowds a priority label IS thinned out: 146 is
    // a segment bound (non-priority) 2 indices from priority 148 → dropped.
    expect(layout.significant).toContain(146);
    expect(layout.labeledSignificant).not.toContain(146);
  });

  // A NO-finding band fixture (plain worked input at N=161): the priority tier
  // is empty, so this isolates the GREEDY fill — the crowding source is the
  // consecutive significant PAIRS (16/17, 32/33, …) at the 8px band pitch.
  it("greedy-fills a no-finding band: drops the crowding second-of-pair, keeps ≥ 3 apart", () => {
    const layout = computeLayout(solveStage(stage(161)), 161);
    expect(layout.band).toBe(true);
    // significant carries the pairs (16,17), (32,33), … (160,161).
    expect(layout.significant).toContain(16);
    expect(layout.significant).toContain(17);
    // Greedy keeps the first of each pair, drops the second (8px < 20px pitch):
    expect(layout.labeledSignificant).toEqual([
      1, 16, 32, 48, 64, 80, 96, 112, 128, 144, 160,
    ]);
    // Every kept label is ≥ 3 indices apart (no priority tier to except).
    const kept = layout.labeledSignificant;
    for (let i = 1; i < kept.length; i++) {
      expect(kept[i]! - kept[i - 1]!).toBeGreaterThanOrEqual(3);
    }
  });

  it("labeledSignificant is empty below the band threshold", () => {
    // band=false ⇒ no significant subset, no labels.
    expect(
      computeLayout(solveStage(stage(114)), 114).labeledSignificant,
    ).toEqual([]);
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
