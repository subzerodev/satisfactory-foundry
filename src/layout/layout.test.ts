// Vitest globals (config `globals: true`) — no `vitest` import, matching the
// sibling src/core tests: the layout purity block bans package imports, and
// describe/it/expect are ambient here just as they are for the core solver.
import { Fraction } from "../core/fraction.ts";
import type {
  StageSolveResult,
  FeedLaneResult,
  OutputLaneResult,
} from "../core/manifold.ts";
import { layoutStage } from "./layout.ts";
import {
  FOOTPRINTS,
  SPLITTER_FOOTPRINT,
  MERGER_FOOTPRINT,
  DEFAULT_FOOTPRINT,
} from "./footprints.ts";

const F = (n: number): Fraction => Fraction.from(n);

/** A feed lane with explicit belts (entersAfterMachine set per belt). */
function feedLane(
  itemId: string,
  belts: { index: number; entersAfterMachine: number; capacity: number }[],
): FeedLaneResult {
  return {
    itemId,
    kind: "belt",
    perMachineDemand: F(0),
    totalDemand: F(0),
    belts: belts.map((b) => ({
      index: b.index,
      capacity: F(b.capacity),
      overridden: false,
      entersAfterMachine: b.entersAfterMachine,
    })),
    segments: [],
    findings: [],
  };
}

/** An output lane with explicit break-outs (startsAfterMachine set per belt). */
function outputLane(
  itemId: string,
  breakouts: {
    index: number;
    startsAfterMachine: number;
    capacity: number;
    load: number;
  }[],
): OutputLaneResult {
  return {
    itemId,
    kind: "belt",
    perMachineOutput: F(0),
    totalOutput: F(0),
    breakouts: breakouts.map((b) => ({
      index: b.index,
      capacity: F(b.capacity),
      startsAfterMachine: b.startsAfterMachine,
      load: F(b.load),
    })),
    segments: [],
    findings: [],
  };
}

function solve(
  feeds: FeedLaneResult[],
  outputs: OutputLaneResult[],
): StageSolveResult {
  return { feeds, outputs, findings: [] };
}

// ── Row placement ─────────────────────────────────────────────────────────

describe("layoutStage — machine row: pitch + grid origins", () => {
  it("pitches at ceilTo10(width)+10 with sub-metre width (gap 11 legal)", () => {
    // Constructor width 79 → ceilTo10(79)=80 → pitch 90; gap = 90−79 = 11.
    const layout = layoutStage(solve([], []), "constructor_mk1", 3);
    expect(layout.machines.length).toBe(3);
    expect(layout.machines.map((m) => m.x)).toEqual([0, 90, 180]);
    // True-size rects — width stays 79, never rounded up to the pitch.
    expect(layout.machines[0]).toEqual({ x: 0, y: 0, w: 79, h: 99 });
    const pitch = layout.machines[1]!.x - layout.machines[0]!.x;
    expect(pitch - layout.machines[0]!.w).toBe(11); // pitch − width, not a gap const
  });

  it("pitches a metre-aligned width without inflating it (Smelter 50→60)", () => {
    const layout = layoutStage(solve([], []), "smelter_mk1", 2);
    expect(layout.machines.map((m) => m.x)).toEqual([0, 60]);
    expect(layout.machines[0]).toEqual({ x: 0, y: 0, w: 50, h: 100 });
  });

  it("pitches an exact-metre width (Foundry 100→110)", () => {
    const layout = layoutStage(solve([], []), "foundry_mk1", 2);
    expect(layout.machines.map((m) => m.x)).toEqual([0, 110]);
    expect(layout.machines[0]!.w).toBe(100);
  });

  it("emits true-size rects on the y=0 row, one per machine", () => {
    const layout = layoutStage(solve([], []), "assembler_mk1", 4);
    expect(layout.machines.length).toBe(4);
    expect(layout.machines.every((m) => m.y === 0)).toBe(true);
    expect(layout.machines.every((m) => m.w === 90 && m.h === 160)).toBe(true);
  });
});

// ── Lane geometry ─────────────────────────────────────────────────────────

describe("layoutStage — lane geometry", () => {
  it("places 1..3 feed lanes at y = −(20 + f×60)", () => {
    const feeds = [feedLane("a", []), feedLane("b", []), feedLane("c", [])];
    const layout = layoutStage(solve(feeds, []), "smelter_mk1", 2);
    expect(layout.feedLanes.map((l) => l.bus.from.y)).toEqual([-20, -80, -140]);
    // Bus is a straight lane spanning the row: 0 → N×pitch (Smelter pitch 60).
    expect(layout.feedLanes[0]!.bus).toEqual({
      from: { x: 0, y: -20 },
      to: { x: 120, y: -20 },
    });
  });

  it("places 1..3 output lanes at y = machineDepth + 20 + o×60", () => {
    // Smelter depth (length) = 100 → 120, 180, 240.
    const outputs = [
      outputLane("x", []),
      outputLane("y", []),
      outputLane("z", []),
    ];
    const layout = layoutStage(solve([], outputs), "smelter_mk1", 2);
    expect(layout.outputLanes.map((l) => l.bus.from.y)).toEqual([
      120, 180, 240,
    ]);
  });

  it("preserves solve feed/output lane order", () => {
    const feeds = [feedLane("iron", []), feedLane("coal", [])];
    const outputs = [outputLane("steel", [])];
    const layout = layoutStage(solve(feeds, outputs), "foundry_mk1", 1);
    expect(layout.feedLanes.map((l) => l.itemId)).toEqual(["iron", "coal"]);
    expect(layout.outputLanes.map((l) => l.itemId)).toEqual(["steel"]);
  });

  it("emits N junctions per lane, one per machine column", () => {
    const feeds = [feedLane("a", [])];
    const outputs = [outputLane("b", [])];
    const layout = layoutStage(solve(feeds, outputs), "smelter_mk1", 5);
    expect(layout.feedLanes[0]!.junctions.length).toBe(5);
    expect(layout.outputLanes[0]!.junctions.length).toBe(5);
  });

  it("centres the 40×40 junction on its column and on the bus line", () => {
    // Smelter width 50, pitch 60; feed lane 0 busY=−20.
    // col 1 centreX = 60 + floor(50/2) = 85 → x = 85−20 = 65; y = −20−20 = −40.
    const layout = layoutStage(
      solve([feedLane("a", [])], []),
      "smelter_mk1",
      3,
    );
    const j = layout.feedLanes[0]!.junctions[1]!;
    expect(j).toEqual({ x: 65, y: -40, w: 40, h: 40 });
    expect(j.w).toBe(SPLITTER_FOOTPRINT.width);
    expect(j.h).toBe(SPLITTER_FOOTPRINT.length);
  });

  it("uses the merger footprint on output-lane junctions", () => {
    const layout = layoutStage(
      solve([], [outputLane("b", [])]),
      "smelter_mk1",
      1,
    );
    const j = layout.outputLanes[0]!.junctions[0]!;
    expect(j.w).toBe(MERGER_FOOTPRINT.width);
    expect(j.h).toBe(MERGER_FOOTPRINT.length);
  });
});

// ── Marks ─────────────────────────────────────────────────────────────────

describe("layoutStage — belt-drop marks (feed)", () => {
  it("drops a mark at each entersAfterMachine boundary incl. head 0", () => {
    // Smelter pitch 60. belt 0 at head (0) → x=0; belt 1 after machine 2 → x=120.
    const feeds = [
      feedLane("a", [
        { index: 0, entersAfterMachine: 0, capacity: 780 },
        { index: 1, entersAfterMachine: 2, capacity: 480 },
      ]),
    ];
    const layout = layoutStage(solve(feeds, []), "smelter_mk1", 4);
    const marks = layout.feedLanes[0]!.marks;
    expect(marks.map((m) => m.at.x)).toEqual([0, 120]);
    expect(marks.map((m) => m.index)).toEqual([0, 1]);
    // capacity passes through as a Fraction label (no geometry math on it).
    expect(marks[0]!.capacity.eq(F(780))).toBe(true);
    // feed marks carry no load.
    expect(marks[0]!.load).toBeUndefined();
    // mark sits on the lane's bus line (feed 0 → y=−20).
    expect(marks.every((m) => m.at.y === -20)).toBe(true);
  });

  it("emits coincident marks — two belts, one boundary, distinct indices", () => {
    // Empty-span / clamp-to-N case: both belts share entersAfterMachine = N.
    // The layout emits one mark PER belt at the same point; P2 owns overlap.
    const feeds = [
      feedLane("a", [
        { index: 0, entersAfterMachine: 0, capacity: 780 },
        { index: 1, entersAfterMachine: 3, capacity: 780 },
        { index: 2, entersAfterMachine: 3, capacity: 780 },
      ]),
    ];
    const layout = layoutStage(solve(feeds, []), "smelter_mk1", 3);
    const marks = layout.feedLanes[0]!.marks;
    expect(marks.length).toBe(3); // one per belt, never deduped
    // Smelter pitch 60: boundary 3 → x=180.
    expect(marks[1]!.at).toEqual({ x: 180, y: -20 });
    expect(marks[2]!.at).toEqual({ x: 180, y: -20 });
    expect(marks[1]!.index).toBe(1);
    expect(marks[2]!.index).toBe(2);
  });
});

describe("layoutStage — break-out marks (output)", () => {
  it("marks each startsAfterMachine boundary with capacity + load", () => {
    // Smelter depth 100, pitch 60. output lane 0 busY=120.
    // breakout 0 at 0 → x=0; breakout 1 after machine 3 → x=180.
    const outputs = [
      outputLane("b", [
        { index: 0, startsAfterMachine: 0, capacity: 780, load: 600 },
        { index: 1, startsAfterMachine: 3, capacity: 480, load: 300 },
      ]),
    ];
    const layout = layoutStage(solve([], outputs), "smelter_mk1", 6);
    const marks = layout.outputLanes[0]!.marks;
    expect(marks.map((m) => m.at.x)).toEqual([0, 180]);
    expect(marks.every((m) => m.at.y === 120)).toBe(true);
    expect(marks[0]!.capacity.eq(F(780))).toBe(true);
    // break-out marks DO carry load.
    expect(marks[0]!.load!.eq(F(600))).toBe(true);
    expect(marks[1]!.load!.eq(F(300))).toBe(true);
  });
});

// ── Foundations ─────────────────────────────────────────────────────────────

describe("layoutStage — foundation inflation to 80 dm tiles", () => {
  it("inflates the true bounding box up to the next 80 dm multiple", () => {
    // Smelter 50×100, N=2, pitch 60 → row spans x∈[0,120], y∈[0,100].
    // One feed (busY −20, junction top −40) and one output (busY 220 for depth
    // 100 → 100+20+0=120; junction bottom 140). bbox: x[0..120], y[−40..140].
    const layout = layoutStage(
      solve([feedLane("a", [])], [outputLane("b", [])]),
      "smelter_mk1",
      2,
    );
    const f = layout.foundations;
    // minY −40 floors to −80; maxY 140 → far edge 140−(−80)=220 → ceil 240 → 3 rows.
    // minX 0; maxX 120 → 2 cols (160 ≥ 120).
    expect(f.origin).toEqual({ x: 0, y: -80 });
    expect(f.cols).toBe(2);
    expect(f.rows).toBe(3);
  });

  it("does not over-inflate on an exact 80-boundary bounding box", () => {
    // Packager 80×80, N=1, no lanes → machine rect x[0..80], y[0..80] exactly.
    const layout = layoutStage(solve([], []), "packager", 1);
    const f = layout.foundations;
    expect(f.origin).toEqual({ x: 0, y: 0 });
    expect(f.cols).toBe(1); // 80 → exactly 1 tile, not 2
    expect(f.rows).toBe(1);
  });

  it("adds a whole tile for one dm over an 80-boundary", () => {
    // A single machine 81 wide (via default footprint miss would be 100; instead
    // stub a footprint table). Use a custom footprint table for exact control.
    const table = { widget: { width: 81, length: 80 } };
    const layout = layoutStage(solve([], []), "widget", 1, table);
    const f = layout.foundations;
    // pitch = ceilTo10(81)+10 = 100. machine rect width 81 → maxX 81 → 2 cols.
    expect(f.cols).toBe(2); // 81 crosses the 80 boundary → a second tile
    expect(f.rows).toBe(1); // length 80 exact → 1 tile
  });
});

// ── Fallback ─────────────────────────────────────────────────────────────────

describe("layoutStage — unknown machineId fallback", () => {
  it("applies the 100×100 default and emits an unknown-footprint finding", () => {
    const layout = layoutStage(solve([], []), "mystery_machine", 2);
    expect(layout.findings).toEqual([
      { type: "unknown-footprint", machineId: "mystery_machine" },
    ]);
    // default 100×100 → pitch ceilTo10(100)+10 = 110; true-size 100×100 rects.
    expect(layout.machines.map((m) => m.x)).toEqual([0, 110]);
    expect(layout.machines[0]).toEqual({
      x: 0,
      y: 0,
      w: DEFAULT_FOOTPRINT.width,
      h: DEFAULT_FOOTPRINT.length,
    });
  });

  it("emits no findings for a known machineId", () => {
    const layout = layoutStage(solve([], []), "constructor_mk1", 1);
    expect(layout.findings).toEqual([]);
  });
});

// ── Zero-machine pinned shape ────────────────────────────────────────────────

describe("layoutStage — zero-machine stage: the pinned empty shape", () => {
  const feeds = [feedLane("a", []), feedLane("b", [])];
  const outputs = [outputLane("c", [])];
  const layout = layoutStage(solve(feeds, outputs), "smelter_mk1", 0);

  it("has no machines", () => {
    expect(layout.machines).toEqual([]);
  });

  it("keeps every lane present with a zero-length bus at the row origin", () => {
    expect(layout.feedLanes.length).toBe(2);
    expect(layout.outputLanes.length).toBe(1);
    for (const lane of [...layout.feedLanes, ...layout.outputLanes]) {
      expect(lane.bus.from).toEqual({ x: 0, y: 0 });
      expect(lane.bus.to).toEqual({ x: 0, y: 0 }); // from == to
      expect(lane.junctions).toEqual([]);
      expect(lane.marks).toEqual([]);
    }
  });

  it("has 0×0 foundations at the origin", () => {
    expect(layout.foundations).toEqual({
      origin: { x: 0, y: 0 },
      cols: 0,
      rows: 0,
    });
  });

  it("still preserves lane itemIds and order", () => {
    expect(layout.feedLanes.map((l) => l.itemId)).toEqual(["a", "b"]);
    expect(layout.outputLanes.map((l) => l.itemId)).toEqual(["c"]);
  });
});

// ── Footprint constants (splitter/merger pins — no separate footprints test) ──

describe("footprints — junction constants", () => {
  it("pins Conveyor Splitter at 40×40 dm", () => {
    expect(SPLITTER_FOOTPRINT).toEqual({ width: 40, length: 40 });
  });

  it("pins Conveyor Merger at 40×40 dm", () => {
    expect(MERGER_FOOTPRINT).toEqual({ width: 40, length: 40 });
  });

  it("pins the DEFAULT footprint at 100×100 dm", () => {
    expect(DEFAULT_FOOTPRINT).toEqual({ width: 100, length: 100 });
  });

  it("keys the table by every bundled producer machineId", () => {
    // The 11 producers the bundled catalog references (drift tripwire).
    expect(Object.keys(FOOTPRINTS).sort()).toEqual(
      [
        "assembler_mk1",
        "blender",
        "constructor_mk1",
        "converter",
        "foundry_mk1",
        "hadron_collider",
        "manufacturer_mk1",
        "oil_refinery",
        "packager",
        "quantum_encoder",
        "smelter_mk1",
      ].sort(),
    );
  });
});
