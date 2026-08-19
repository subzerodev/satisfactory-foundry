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
    // usable 912 / 20 = 45.6 → floor 45, within [24,48]; a wide pitch, fits.
    expect(layout.pitch).toBe(45);
    expect(layout.scrolled).toBe(false);
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

  it("passes each segment's exact entryFlow through", () => {
    const feed = layout.feeds[0]!;
    // Head segment entry flow is belt 1's 480 (exact-drain worked example);
    // feed entryFlow = residue-in + capacity = the old peakFlow, unchanged.
    expect(feed.segments[0]!.entryFlow.eq(Fraction.from(480))).toBe(true);
    expect(feed.segments[1]!.entryFlow.eq(Fraction.from(120))).toBe(true);
  });
});

describe("computeLayout — entryFlow ≠ belt capacity (N=17 under-filled span)", () => {
  it("keeps the honest span entry flow when the breakout's tier exceeds its load", () => {
    // Output side, N=17: the second breakout spans machine 17 only — load
    // 30/min but assigned tier Mk1 (60/min). entryFlow = load must stay 30, not
    // the belt's capacity — the divergence the boundary review r1 caught.
    const result = solveStage(stage(17));
    const out = computeLayout(result, 17).outputs[0]!;
    const last = out.segments[out.segments.length - 1]!;
    expect(last.fromMachine).toBe(17);
    expect(last.entryFlow.eq(Fraction.from(30))).toBe(true);
    expect(
      result.outputs[0]!.breakouts[last.beltIndex]!.capacity.eq(
        Fraction.from(60),
      ),
    ).toBe(true);
  });
});

describe("computeLayout — the readable pitch floor + pan (#154)", () => {
  it("floors at 24 and scrolls at Michael's N=106: pitch 24, width 2592", () => {
    // floor(912/106) = 8 < 24 → clamp floors to the readable 24. width = 48 +
    // 24·106 = 2592; 24·106 = 2544 > 912 → pans instead of cramming.
    const layout = computeLayout(solveStage(stage(106)), 106);
    expect(layout.pitch).toBe(LAYOUT.minPitch);
    expect(layout.pitch).toBe(24);
    expect(layout.scrolled).toBe(true);
    expect(layout.width).toBe(LAYOUT.marginX * 2 + 24 * 106);
    expect(layout.width).toBe(2592);
  });

  it("keeps N=20 wide and unscrolled (pitch 45, not floored)", () => {
    const layout = computeLayout(workedResult(), 20);
    expect(layout.pitch).toBe(45);
    expect(layout.scrolled).toBe(false);
  });

  it("floors at 24 and scrolls for N=161 too", () => {
    const layout = computeLayout(solveStage(stage(161)), 161);
    expect(layout.pitch).toBe(24);
    expect(layout.scrolled).toBe(true);
  });

  it("scrolls and widens at the 24 floor for N=2000", () => {
    const layout = computeLayout(solveStage(stage(2000)), 2000);
    expect(layout.scrolled).toBe(true);
    expect(layout.width).toBe(LAYOUT.marginX * 2 + LAYOUT.minPitch * 2000);
  });

  it("pins the N=38/39 scroll boundary (the 24px sliver, r1)", () => {
    // floor(912/38) = 24 → 24·38 = 912, NOT > 912 → fits at viewW 960.
    const at38 = computeLayout(solveStage(stage(38)), 38);
    expect(at38.pitch).toBe(24);
    expect(at38.scrolled).toBe(false);
    expect(at38.width).toBe(LAYOUT.viewW);
    // floor(912/39) = 23 clamps up to 24 → 24·39 = 936 > 912 → a 24px overflow
    // scroll (imperceptible in use; rounding it away would reintroduce sub-24
    // pitch — accepted r1).
    const at39 = computeLayout(solveStage(stage(39)), 39);
    expect(at39.pitch).toBe(24);
    expect(at39.scrolled).toBe(true);
    expect(at39.width).toBe(LAYOUT.marginX * 2 + 24 * 39);
    expect(at39.width).toBe(984);
  });

  it("keeps N≤38 pixel-identical to the old fit range (AC4): N=38 fits at 960", () => {
    // floor(912/N) < 24 ⇔ N ≥ 39, so N ≤ 38 never floored below 24 even before
    // #154 — the pitch (and therefore every coordinate) is unchanged. N=38 is
    // the boundary: pitch 24, unscrolled, width 960.
    const layout = computeLayout(solveStage(stage(38)), 38);
    expect(layout.pitch).toBe(24);
    expect(layout.scrolled).toBe(false);
    expect(layout.width).toBe(960);
  });
});

describe("computeLayout — machineRowH parameter (P3 build-view ruler)", () => {
  it("shrinks the view by exactly 28px at rulerH 12 vs the default 40", () => {
    // The build view passes LAYOUT.rulerH (12); the machines view keeps the
    // default machineH (40). The whole difference is the 28px the machine block
    // shed — height and the output lanes drop by exactly that.
    const result = workedResult();
    const ruler = computeLayout(result, 20, LAYOUT.rulerH);
    const block = computeLayout(result, 20);
    expect(block.height - ruler.height).toBe(28);
    expect(LAYOUT.machineH - LAYOUT.rulerH).toBe(28);
    // The output lane's top drops by the same 28 (the risen outputTop).
    expect(block.outputs[0]!.y - ruler.outputs[0]!.y).toBe(28);
  });

  it("keeps machineTop IDENTICAL across both row heights (the register pin)", () => {
    // machineTop carries no machineRowH term — it registers with the feed lanes
    // + P2 rows ABOVE the machine row, so shrinking the row must not move it.
    const result = workedResult();
    const ruler = computeLayout(result, 20, LAYOUT.rulerH);
    const block = computeLayout(result, 20);
    expect(ruler.machineTop).toBe(block.machineTop);
    // And every feed-lane pixel is untouched (the P2 register guarantee).
    expect(ruler.feeds[0]!.y).toBe(block.feeds[0]!.y);
    expect(ruler.feeds[0]!.busY).toBe(block.feeds[0]!.busY);
  });

  it("defaults the third argument to machineH 40 (the ~21 call sites stay valid)", () => {
    // A call WITHOUT the third argument type-checks (npm run check is the real
    // gate) and equals the explicit machineRowH-40 result — so the existing call
    // sites keep the block layout unchanged.
    const result = workedResult();
    const bare = computeLayout(result, 20);
    const explicit = computeLayout(result, 20, LAYOUT.machineH);
    expect(bare).toEqual(explicit);
  });

  it("computes significant non-empty at N=106, on the 17-stretch boundaries", () => {
    // significant is the solver-derived union — non-empty, its MAJOR ticks
    // landing on the 16-machine feed-stretch boundaries (16/17, 32/33, …),
    // solver-derived, never a pitch-thinning artifact.
    const layout = computeLayout(solveStage(stage(106)), 106);
    expect(layout.significant.length).toBeGreaterThan(0);
    expect(layout.significant).toEqual([
      1, 16, 17, 32, 33, 48, 49, 64, 65, 80, 81, 96, 97, 106,
    ]);
    // Each MAJOR tick x = the machine's left edge = a feed segment boundary x.
    const feed = layout.feeds[0]!;
    const boundaryXs = new Set(feed.segments.flatMap((s) => [s.x1, s.x2]));
    // The interior stretch boundaries (indices 16,17,32,… map to seg x's).
    const xOf = (index: number) => layout.machines[index - 1]!.x;
    // machine 17's left edge is the head segment's x2 (a real boundary).
    expect(boundaryXs.has(xOf(17))).toBe(true);
  });
});

describe("computeLayout — the significant set (dense N)", () => {
  it("computes the significant set at a dense N: the solver-derived union", () => {
    // significant is the solver-derived set-union at every N — NON-EMPTY, the
    // build-view ruler draws its MAJOR ticks from it. (Band mode retired with
    // #154; there is no density gate anymore.)
    const layout = computeLayout(solveStage(stage(114)), 114);
    expect(layout.significant.length).toBeGreaterThan(0);
    // The stretch boundaries the WORKED fixture emits (16-machine feed spans):
    // machine 1 (head), then the (16k, 16k+1) segment-boundary pairs, ending at
    // 114. Pinned exactly so the un-gated union can't silently drift.
    expect(layout.significant).toEqual([
      1, 16, 17, 32, 33, 48, 49, 64, 65, 80, 81, 96, 97, 112, 113, 114,
    ]);
  });
});

describe("computeLayout — the significant set at N=161", () => {
  // A starving 161-machine feed (belt 0 under-capped to 50/min) so the union
  // spans EVERY significant kind: feed entries, output breakouts, each segment's
  // bounds, AND finding-referenced machines — the starve names machine 148
  // (partial) and 149 (starvedFrom), interior indices at NO segment/entry
  // boundary, proving the finding union member is included (the r1 HIGH: a
  // finding must keep "machine 148" locatable).
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
