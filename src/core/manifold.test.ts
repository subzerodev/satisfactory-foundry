import { Fraction } from "./fraction.ts";
import {
  solveStage,
  solveFeedLane,
  solveOutputLane,
  type LaneInput,
  type StageInput,
  type Finding,
} from "./manifold.ts";

const F = (n: number) => Fraction.from(n);
const R = (num: number, den: number) => Fraction.of(num, den);

// Standard belt tier table used across most rows (Mk1..Mk4): 60/120/270/480.
const BELTS = [60, 120, 270, 480].map((n) => Fraction.from(n));
// Pipe tier table (Mk1/Mk2): 300/600 — same math, different capacities.
const PIPES = [300, 600].map((n) => Fraction.from(n));

function stage(over: Partial<StageInput>): StageInput {
  return {
    machineCount: 20,
    clockPercent: Fraction.from(100),
    capacities: { belt: BELTS, pipe: PIPES },
    feeds: [],
    outputs: [],
    ...over,
  };
}

function feed(over: Partial<LaneInput> = {}): LaneInput {
  return {
    itemId: "iron-ore",
    kind: "belt",
    perMachineRate: Fraction.from(30),
    ...over,
  };
}

function invalidReasons(findings: Finding[]): string[] {
  return findings
    .filter((f) => f.type === "invalid-input")
    .map((f) => (f.type === "invalid-input" ? f.reason : ""));
}

// ── Row 9: degenerate inputs — empty lanes, no findings, no crashes ──────────
describe("solveStage — degenerate (spec row 9)", () => {
  it("N=0: every lane solves empty with no findings", () => {
    const result = solveStage(
      stage({
        machineCount: 0,
        feeds: [feed()],
        outputs: [
          feed({ itemId: "iron-ingot", perMachineRate: Fraction.from(30) }),
        ],
      }),
    );
    expect(result.findings).toEqual([]);
    expect(result.feeds).toHaveLength(1);
    expect(result.outputs).toHaveLength(1);
    const f = result.feeds[0]!;
    expect(f.belts).toEqual([]);
    expect(f.segments).toEqual([]);
    expect(f.findings).toEqual([]);
    // rates still reported (d = 0 × 30 = 0 after scaling), totals derived
    expect(f.perMachineDemand.eq(Fraction.from(30))).toBe(true);
    expect(f.totalDemand.isZero()).toBe(true);
    const o = result.outputs[0]!;
    expect(o.breakouts).toEqual([]);
    expect(o.segments).toEqual([]);
    expect(o.findings).toEqual([]);
  });

  it("empty feeds (extractor-style stage): no lanes, no findings", () => {
    const result = solveStage(stage({ feeds: [], outputs: [feed()] }));
    expect(result.findings).toEqual([]);
    expect(result.feeds).toEqual([]);
    expect(result.outputs).toHaveLength(1);
  });

  it("zero-rate lane solves empty even when N>0", () => {
    const result = solveStage(
      stage({ feeds: [feed({ perMachineRate: Fraction.from(0) })] }),
    );
    expect(result.findings).toEqual([]);
    const f = result.feeds[0]!;
    expect(f.perMachineDemand.isZero()).toBe(true);
    expect(f.belts).toEqual([]);
    expect(f.segments).toEqual([]);
    expect(f.findings).toEqual([]);
  });

  it("fluid-only lanes: pipe kind through the degenerate path shares the math", () => {
    // Pipes exercised via the degenerate (N=0) path only — no real pipe
    // combination solve exists in the ten rows.
    const result = solveStage(
      stage({
        machineCount: 0,
        feeds: [
          feed({
            kind: "pipe",
            itemId: "water",
            perMachineRate: Fraction.from(120),
          }),
        ],
      }),
    );
    expect(result.findings).toEqual([]);
    const f = result.feeds[0]!;
    expect(f.kind).toBe("pipe");
    expect(f.belts).toEqual([]);
    expect(f.segments).toEqual([]);
  });
});

// ── Row 10: stage-global validation inputs → invalid-input findings ──────────
describe("solveStage — stage validation (spec row 10)", () => {
  it("non-ascending capacities → capacities-not-ascending, empty lanes", () => {
    const result = solveStage(
      stage({
        capacities: {
          belt: [Fraction.from(120), Fraction.from(60)],
          pipe: PIPES,
        },
        feeds: [feed()],
      }),
    );
    expect(invalidReasons(result.findings)).toContain(
      "capacities-not-ascending",
    );
    expect(result.feeds).toEqual([]);
    expect(result.outputs).toEqual([]);
  });

  it("equal (non-strict) capacities → capacities-not-ascending", () => {
    const result = solveStage(
      stage({
        capacities: {
          belt: [Fraction.from(60), Fraction.from(60)],
          pipe: PIPES,
        },
      }),
    );
    expect(invalidReasons(result.findings)).toContain(
      "capacities-not-ascending",
    );
  });

  it("non-positive capacity entry → capacities-not-ascending", () => {
    const result = solveStage(
      stage({
        capacities: {
          belt: [Fraction.from(0), Fraction.from(60)],
          pipe: PIPES,
        },
      }),
    );
    expect(invalidReasons(result.findings)).toContain(
      "capacities-not-ascending",
    );
  });

  it("negative perMachineRate → negative-rate, empty lanes", () => {
    const result = solveStage(
      stage({ feeds: [feed({ perMachineRate: Fraction.from(-5) })] }),
    );
    expect(invalidReasons(result.findings)).toContain("negative-rate");
    expect(result.feeds).toEqual([]);
  });

  it("zero clock → nonpositive-clock", () => {
    const result = solveStage(
      stage({ clockPercent: Fraction.from(0), feeds: [feed()] }),
    );
    expect(invalidReasons(result.findings)).toContain("nonpositive-clock");
    expect(result.feeds).toEqual([]);
  });

  it("negative clock → nonpositive-clock", () => {
    const result = solveStage(stage({ clockPercent: Fraction.from(-50) }));
    expect(invalidReasons(result.findings)).toContain("nonpositive-clock");
  });

  it("fractional machineCount → bad-machine-count", () => {
    const result = solveStage(stage({ machineCount: 3.5, feeds: [feed()] }));
    expect(invalidReasons(result.findings)).toContain("bad-machine-count");
    expect(result.feeds).toEqual([]);
  });

  it("negative machineCount → bad-machine-count", () => {
    const result = solveStage(stage({ machineCount: -1 }));
    expect(invalidReasons(result.findings)).toContain("bad-machine-count");
  });
});

// ── N=0 × oversize-overrides precedence (degenerate short-circuit wins) ───────
describe("solveStage — N=0 precedence over oversize overrides", () => {
  it("N=0 with an oversize overrides array emits NO finding", () => {
    // With N>0 this lane would combine to k belts and an oversize overrides
    // array would raise overrides-exceed-belt-count. At N=0 the degenerate
    // short-circuit precedes the lane solve: nothing to warn about.
    const result = solveStage(
      stage({
        machineCount: 0,
        feeds: [
          feed({
            overrides: [
              Fraction.from(480),
              Fraction.from(480),
              Fraction.from(480),
              Fraction.from(480),
            ],
          }),
        ],
      }),
    );
    expect(result.findings).toEqual([]);
    const f = result.feeds[0]!;
    expect(f.findings).toEqual([]);
    expect(f.belts).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Task 2 — feed lane solver
// ═══════════════════════════════════════════════════════════════════════════

// Build a feed-lane result directly. Belt tiers default to BELTS; caller can
// override N, d (via rate), clock, tiers, and overrides.
function solveFeed(opts: {
  n?: number;
  rate?: Fraction;
  clock?: Fraction;
  belts?: Fraction[];
  overrides?: (Fraction | null)[];
  kind?: LaneKindLocal;
}) {
  const s = stage({
    machineCount: opts.n ?? 20,
    clockPercent: opts.clock ?? F(100),
    capacities: { belt: opts.belts ?? BELTS, pipe: PIPES },
  });
  const lane = feed({
    perMachineRate: opts.rate ?? F(30),
    kind: opts.kind ?? "belt",
    overrides: opts.overrides,
  });
  return solveFeedLane(s, lane);
}
type LaneKindLocal = "belt" | "pipe";

describe("solveFeedLane — combination + entries + segments (spec row 1)", () => {
  it("20-smelter worked example: k=2, belts [480, 120@after-16]", () => {
    const r = solveFeed({ n: 20, rate: F(30) });
    expect(r.perMachineDemand.eq(F(30))).toBe(true);
    expect(r.totalDemand.eq(F(600))).toBe(true);
    expect(r.belts).toHaveLength(2);
    expect(r.belts[0]!.capacity.eq(F(480))).toBe(true);
    expect(r.belts[0]!.entersAfterMachine).toBe(0);
    expect(r.belts[0]!.overridden).toBe(false);
    expect(r.belts[1]!.capacity.eq(F(120))).toBe(true);
    expect(r.belts[1]!.entersAfterMachine).toBe(16);
    expect(r.segments).toHaveLength(2);
    expect(r.segments[0]!).toMatchObject({
      fromMachine: 1,
      toMachine: 16,
      beltIndex: 0,
    });
    expect(r.segments[0]!.peakFlow.eq(F(480))).toBe(true);
    expect(r.segments[1]!).toMatchObject({
      fromMachine: 17,
      toMachine: 20,
      beltIndex: 1,
    });
    expect(r.segments[1]!.peakFlow.eq(F(120))).toBe(true);
    expect(r.findings).toEqual([]);
  });
});

describe("solveFeedLane — fractional rates (spec row 2)", () => {
  it("N=13, d=37.5: k=2, remainder 7.5 -> 60-tier, entry after machine 12", () => {
    const r = solveFeed({ n: 13, rate: R(75, 2) });
    expect(r.perMachineDemand.eq(R(75, 2))).toBe(true);
    expect(r.totalDemand.eq(R(975, 2))).toBe(true); // 487.5
    expect(r.belts.map((b) => b.capacity.toString())).toEqual(["480", "60"]);
    expect(r.belts[1]!.entersAfterMachine).toBe(12); // floor(480/37.5)=12
    expect(r.segments).toHaveLength(2);
    expect(r.segments[0]!).toMatchObject({ fromMachine: 1, toMachine: 12 });
    expect(r.segments[0]!.peakFlow.eq(F(480))).toBe(true);
    expect(r.segments[1]!).toMatchObject({ fromMachine: 13, toMachine: 13 });
    // survived into span2 = 480 - 12*37.5 = 30; peak = 30 + 60 = 90
    expect(r.segments[1]!.peakFlow.eq(F(90))).toBe(true);
    expect(r.findings).toEqual([]);
  });
});

describe("solveFeedLane — exact-multiple boundary (spec row 3)", () => {
  it("D=960, B=480: k=2, remainder 480 -> top tier", () => {
    const r = solveFeed({ n: 32, rate: F(30) }); // D=960
    expect(r.totalDemand.eq(F(960))).toBe(true);
    expect(r.belts.map((b) => b.capacity.toString())).toEqual(["480", "480"]);
    expect(r.belts[1]!.entersAfterMachine).toBe(16); // floor(480/30)=16
    expect(r.segments[0]!).toMatchObject({ fromMachine: 1, toMachine: 16 });
    expect(r.segments[1]!).toMatchObject({ fromMachine: 17, toMachine: 32 });
    expect(r.segments[0]!.peakFlow.eq(F(480))).toBe(true);
    expect(r.segments[1]!.peakFlow.eq(F(480))).toBe(true);
    expect(r.findings).toEqual([]);
  });
});

describe("solveFeedLane — bounded parallel feed buses (#120)", () => {
  it("models Michael's 106-refinery Mk5 plan as 17 feeds and exactly eight x2 spans", () => {
    const r = solveFeed({
      n: 106,
      rate: F(120),
      belts: [F(60), F(120), F(270), F(480), F(780)],
    });

    expect(r.belts).toHaveLength(17);
    expect(r.belts.map((b) => b.entersAfterMachine)).toEqual([
      0, 6, 13, 19, 26, 32, 39, 45, 52, 58, 65, 71, 78, 84, 91, 97, 104,
    ]);
    const bundled = r.segments.filter((s) => s.parallelCount === 2);
    expect(bundled).toHaveLength(8);
    expect(bundled.every((s) => s.peakFlow.eq(F(840)))).toBe(true);
    expect(
      r.segments
        .filter((s) => !s.peakFlow.eq(F(840)))
        .every((s) => s.parallelCount === 1),
    ).toBe(true);
    expect(r.findings.some((f) => f.type === "segment-over-capacity")).toBe(
      false,
    );
  });

  it("uses one line at B, two just above B, and never exceeds two for eligible slots", () => {
    const atBoundary = solveFeed({
      n: 20,
      rate: F(30),
      overrides: [F(475), F(455)],
    });
    expect(atBoundary.segments[1]!.peakFlow.eq(F(480))).toBe(true);
    expect(atBoundary.segments[1]!.parallelCount).toBe(1);

    const aboveBoundary = solveFeed({
      n: 20,
      rate: F(30),
      overrides: [F(475), F(456)],
    });
    expect(aboveBoundary.segments[1]!.peakFlow.eq(F(481))).toBe(true);
    expect(aboveBoundary.segments[1]!.parallelCount).toBe(2);
    expect(
      aboveBoundary.segments.every(
        (s) => s.parallelCount === 1 || s.parallelCount === 2,
      ),
    ).toBe(true);
    expect(aboveBoundary.segments.every((s) => s.peakFlow.lt(F(960)))).toBe(
      true,
    );
  });

  it("applies the same exact bundle rule to a non-divisible pipe lane", () => {
    const r = solveFeed({
      n: 3,
      rate: F(350),
      kind: "pipe",
      belts: BELTS,
    });
    expect(r.belts.map((b) => b.capacity.toString())).toEqual(["600", "600"]);
    expect(r.segments[1]!.peakFlow.eq(F(850))).toBe(true);
    expect(r.segments[1]!.parallelCount).toBe(2);
    expect(r.findings.some((f) => f.type === "segment-over-capacity")).toBe(
      false,
    );
  });

  it("keeps starvation authoritative on an otherwise valid x2 segment", () => {
    const r = solveFeed({
      n: 20,
      rate: F(30),
      overrides: [F(25), F(480)],
    });
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0]!.peakFlow.eq(F(505))).toBe(true);
    expect(r.segments[0]!.parallelCount).toBe(2);
    expect(r.findings.some((f) => f.type === "segment-over-capacity")).toBe(
      false,
    );
    expect(r.findings.some((f) => f.type === "starved-machines")).toBe(true);
  });
});

describe("solveFeedLane — clock scaling (spec row 4)", () => {
  it("150% scales d exactly to 45", () => {
    const r = solveFeed({ n: 10, rate: F(30), clock: F(150) });
    expect(r.perMachineDemand.eq(F(45))).toBe(true); // 30 * 150/100
    expect(r.totalDemand.eq(F(450))).toBe(true);
    // k=1, smallest tier >= 450 is 480; single belt at head
    expect(r.belts.map((b) => b.capacity.toString())).toEqual(["480"]);
    expect(r.belts[0]!.entersAfterMachine).toBe(0);
    expect(r.segments[0]!.peakFlow.eq(F(480))).toBe(true);
    expect(r.findings).toEqual([]);
  });

  it("66 2/3% scales d exactly to 20 (no float drift)", () => {
    const r = solveFeed({ n: 6, rate: F(30), clock: R(200, 3) });
    expect(r.perMachineDemand.eq(F(20))).toBe(true); // 30 * (200/3)/100 = 20
    expect(r.totalDemand.eq(F(120))).toBe(true);
    expect(r.belts.map((b) => b.capacity.toString())).toEqual(["120"]);
    expect(r.findings).toEqual([]);
  });
});

describe("solveFeedLane — override breaks manifold (spec row 5)", () => {
  it("override 480->240 (D=300): machines 9-10 fully starved, no partial", () => {
    // N=10, d=30 -> D=300; k=1 auto belt = smallest tier >=300 = 480.
    const r = solveFeed({ n: 10, rate: F(30), overrides: [F(240)] });
    expect(r.belts).toHaveLength(1);
    expect(r.belts[0]!.capacity.eq(F(240))).toBe(true);
    expect(r.belts[0]!.overridden).toBe(true);
    // supply 240 -> floor(240/30)=8 full, remainder 0 -> no partial
    const starved = r.findings.filter((f) => f.type === "starved-machines");
    expect(starved).toHaveLength(1);
    const s = starved[0]!;
    if (s.type !== "starved-machines") throw new Error("type");
    expect(s.partial).toBeUndefined();
    expect(s.starvedFrom).toBe(9);
    expect(s.starvedTo).toBe(10);
    // no over-capacity (240 <= B 480)
    expect(r.findings.some((f) => f.type === "segment-over-capacity")).toBe(
      false,
    );
  });

  it("override 480->251.25: machine 9 partial (recv 11.25/short 18.75), 10 starved", () => {
    const r = solveFeed({ n: 10, rate: F(30), overrides: [R(1005, 4)] }); // 251.25
    const starved = r.findings.filter((f) => f.type === "starved-machines");
    expect(starved).toHaveLength(1);
    const s = starved[0]!;
    if (s.type !== "starved-machines") throw new Error("type");
    expect(s.partial).toBeDefined();
    expect(s.partial!.machine).toBe(9);
    expect(s.partial!.received.eq(R(45, 4))).toBe(true); // 11.25
    expect(s.partial!.shortfall.eq(R(75, 4))).toBe(true); // 18.75
    expect(s.starvedFrom).toBe(10);
    expect(s.starvedTo).toBe(10);
  });
});

describe("solveFeedLane — override exceeds bus cap (spec row 6)", () => {
  it("B=270, override->480: segment-over-capacity peakFlow 480 / busCapacity 270", () => {
    // tiers 60/120/270 (top=270). N=8, d=30 -> D=240 -> k=1 belt = 270. Override->480.
    const r = solveFeed({
      n: 8,
      rate: F(30),
      belts: [F(60), F(120), F(270)],
      overrides: [F(480)],
    });
    expect(r.belts[0]!.capacity.eq(F(480))).toBe(true);
    expect(r.segments[0]!.parallelCount).toBe(1);
    const over = r.findings.filter((f) => f.type === "segment-over-capacity");
    expect(over).toHaveLength(1);
    const o = over[0]!;
    if (o.type !== "segment-over-capacity") throw new Error("type");
    expect(o.peakFlow.eq(F(480))).toBe(true);
    expect(o.busCapacity.eq(F(270))).toBe(true);
    expect(o.fromMachine).toBe(1);
    expect(o.toMachine).toBe(8);
    // supply 480 >= demand 240 -> no starvation
    expect(r.findings.some((f) => f.type === "starved-machines")).toBe(false);
  });
});

describe("solveFeedLane — over-B override clamps entry/span to N (regression)", () => {
  it("N=20, override belt0->630: entry <= 20, one span [1..20], no index > 20", () => {
    // auto [480, 120@16]; override belt0->630 pushes belt1's raw entry to
    // floor(630/30)=21 > N. Without the clamp, a phantom segment/finding
    // toMachine:21 leaks for a 20-machine stage. Values independently verified
    // against the implementation before asserting.
    const r = solveFeed({ n: 20, rate: F(30), overrides: [F(630)] });

    // Belt 1 would enter past the last machine -> clamped to N, so it is unused.
    expect(r.belts[1]!.entersAfterMachine).toBeLessThanOrEqual(20);
    expect(r.belts[1]!.entersAfterMachine).toBe(20);

    // Exactly one real segment, spanning the whole stage, peakFlow 630.
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0]!).toMatchObject({
      fromMachine: 1,
      toMachine: 20,
      beltIndex: 0,
    });
    expect(r.segments[0]!.peakFlow.eq(F(630))).toBe(true);

    // Exactly one over-capacity finding [1..20] vs busCapacity 480.
    const over = r.findings.filter((f) => f.type === "segment-over-capacity");
    expect(over).toHaveLength(1);
    const o = over[0]!;
    if (o.type !== "segment-over-capacity") throw new Error("type");
    expect(o.fromMachine).toBe(1);
    expect(o.toMachine).toBe(20);
    expect(o.peakFlow.eq(F(630))).toBe(true);
    expect(o.busCapacity.eq(F(480))).toBe(true);

    // supply 630 >= demand 600 -> no starvation.
    expect(r.findings.some((f) => f.type === "starved-machines")).toBe(false);

    // No emitted index anywhere exceeds N.
    for (const b of r.belts) {
      expect(b.entersAfterMachine).toBeLessThanOrEqual(20);
    }
    for (const seg of r.segments) {
      expect(seg.fromMachine).toBeLessThanOrEqual(20);
      expect(seg.toMachine).toBeLessThanOrEqual(20);
    }
    for (const f of r.findings) {
      if (f.type === "segment-over-capacity") {
        expect(f.fromMachine).toBeLessThanOrEqual(20);
        expect(f.toMachine).toBeLessThanOrEqual(20);
      }
    }
  });
});

describe("solveFeedLane — exact feed-entry clamp before narrowing (#122)", () => {
  it.each([
    ["MAX_SAFE_INTEGER", Fraction.from(Number.MAX_SAFE_INTEGER)],
    [
      "larger than MAX_SAFE_INTEGER",
      Fraction.from(BigInt(Number.MAX_SAFE_INTEGER) + 1n),
    ],
  ])(
    "clamps a %s override quotient to N without losing exactness",
    (_, override) => {
      const r = solveFeed({
        n: 3,
        rate: R(1, 2),
        belts: [F(1)],
        overrides: [override],
      });

      expect(r.belts).toHaveLength(2);
      expect(r.belts[0]!.capacity.eq(override)).toBe(true);
      expect(r.belts[1]!.entersAfterMachine).toBe(3);
      expect(r.belts.every((b) => b.entersAfterMachine <= 3)).toBe(true);
      expect(r.segments).toHaveLength(1);
      expect(r.segments[0]!).toMatchObject({
        fromMachine: 1,
        toMachine: 3,
        beltIndex: 0,
      });

      const over = r.findings.filter((f) => f.type === "segment-over-capacity");
      expect(over).toHaveLength(1);
      expect(over[0]!.peakFlow.eq(override)).toBe(true);
      expect(over[0]!).toMatchObject({ fromMachine: 1, toMachine: 3 });
    },
  );

  it("clamps the exact equality boundary to N", () => {
    const r = solveFeed({
      n: 3,
      rate: R(1, 2),
      belts: [F(1)],
      overrides: [R(3, 2)],
    });

    expect(r.belts[1]!.entersAfterMachine).toBe(3);
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0]!).toMatchObject({
      fromMachine: 1,
      toMachine: 3,
      beltIndex: 0,
    });
  });
});

describe("solveFeedLane — oversize overrides array (spec row 7)", () => {
  it("overrides longer than k -> lane-local invalid-input, lane empty", () => {
    // k=1 (D=300 <= 480), overrides length 2 > 1.
    const r = solveFeed({ n: 10, rate: F(30), overrides: [F(240), F(240)] });
    expect(r.belts).toEqual([]);
    expect(r.segments).toEqual([]);
    expect(r.findings).toHaveLength(1);
    const f = r.findings[0]!;
    expect(f.type).toBe("invalid-input");
    if (f.type !== "invalid-input") throw new Error("type");
    expect(f.reason).toBe("overrides-exceed-belt-count");
  });

  it("via solveStage: finding is on the lane, siblings solve, stage findings empty", () => {
    const s = solveStage(
      stage({
        machineCount: 10,
        feeds: [
          feed({ itemId: "bad", overrides: [F(240), F(240)] }),
          feed({ itemId: "good" }),
        ],
      }),
    );
    expect(s.findings).toEqual([]); // stage array clean
    const bad = s.feeds.find((l) => l.itemId === "bad")!;
    const good = s.feeds.find((l) => l.itemId === "good")!;
    expect(bad.findings.some((f) => f.type === "invalid-input")).toBe(true);
    expect(bad.belts).toEqual([]);
    // sibling unaffected: D=300 -> k=1 belt 480
    expect(good.belts).toHaveLength(1);
    expect(good.findings.some((f) => f.type === "invalid-input")).toBe(false);
  });
});

describe("solveFeedLane — negative and zero overrides", () => {
  it("rejects the first negative override before belt math", () => {
    const r = solveFeed({
      n: 20,
      rate: F(30),
      overrides: [null, F(-5), F(-10)],
    });

    expect(r.belts).toEqual([]);
    expect(r.segments).toEqual([]);
    expect(r.findings).toEqual([
      {
        type: "invalid-input",
        reason: "negative-override",
        detail: "lane iron-ore override 2 must be zero or positive; got -5.",
      },
    ]);
  });

  it.each([
    ["N=0", { n: 0, rate: F(30), overrides: [null, F(-5)] }],
    ["zero-rate", { n: 10, rate: F(0), overrides: [null, F(-5)] }],
    ["d > B", { n: 5, rate: F(812), overrides: [null, F(-5)] }],
    ["oversize array", { n: 10, rate: F(30), overrides: [null, F(-5)] }],
  ])("negative override wins over %s", (_case, opts) => {
    const r = solveFeed(opts);

    expect(r.belts).toEqual([]);
    expect(r.segments).toEqual([]);
    expect(r.findings).toEqual([
      {
        type: "invalid-input",
        reason: "negative-override",
        detail: "lane iron-ore override 2 must be zero or positive; got -5.",
      },
    ]);
  });

  it("zero supply reports complete starvation", () => {
    const r = solveFeed({ n: 10, rate: F(30), overrides: [F(0)] });

    expect(r.belts[0]!.capacity.isZero()).toBe(true);
    expect(r.segments[0]!.peakFlow.isZero()).toBe(true);
    expect(r.segments[0]!.parallelCount).toBe(1);
    expect(r.findings).toEqual([
      {
        type: "starved-machines",
        itemId: "iron-ore",
        starvedFrom: 1,
        starvedTo: 10,
      },
    ]);
  });

  it("a zero second feed serves its span from residual carry only", () => {
    const r = solveFeed({
      n: 13,
      rate: R(75, 2),
      overrides: [null, F(0)],
    });

    expect(r.belts[1]!.capacity.isZero()).toBe(true);
    expect(r.segments[1]!.peakFlow.eq(F(30))).toBe(true);
    expect(r.segments[1]!.parallelCount).toBe(1);
    expect(r.findings).toEqual([
      {
        type: "starved-machines",
        itemId: "iron-ore",
        partial: {
          machine: 13,
          received: F(30),
          shortfall: R(15, 2),
        },
      },
    ]);
  });
});

describe("solveFeedLane — infeasible single machine (spec row 8)", () => {
  it("d=812 vs top 480 -> infeasible-machine-demand, empty lane", () => {
    const r = solveFeed({ n: 5, rate: F(812) });
    expect(r.belts).toEqual([]);
    expect(r.segments).toEqual([]);
    const inf = r.findings.filter(
      (f) => f.type === "infeasible-machine-demand",
    );
    expect(inf).toHaveLength(1);
    const f = inf[0]!;
    if (f.type !== "infeasible-machine-demand") throw new Error("type");
    expect(f.demand.eq(F(812))).toBe(true);
    expect(f.topCapacity.eq(F(480))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Task 3 — output lane solver + solveStage integration
// ═══════════════════════════════════════════════════════════════════════════

function solveOut(opts: {
  n?: number;
  rate?: Fraction;
  clock?: Fraction;
  belts?: Fraction[];
  overrides?: (Fraction | null)[];
}) {
  const s = stage({
    machineCount: opts.n ?? 20,
    clockPercent: opts.clock ?? F(100),
    capacities: { belt: opts.belts ?? BELTS, pipe: PIPES },
  });
  const lane = feed({
    itemId: "iron-ingot",
    perMachineRate: opts.rate ?? F(30),
    overrides: opts.overrides,
  });
  return solveOutputLane(s, lane);
}

describe("solveOutputLane — mirror of the 20-smelter example (spec row 1)", () => {
  it("break-outs after 16, loads 480/120, capacities 480/120", () => {
    const r = solveOut({ n: 20, rate: F(30) });
    expect(r.perMachineOutput.eq(F(30))).toBe(true);
    expect(r.totalOutput.eq(F(600))).toBe(true);
    expect(r.breakouts).toHaveLength(2);
    expect(r.breakouts[0]!).toMatchObject({ index: 0, startsAfterMachine: 0 });
    expect(r.breakouts[0]!.load.eq(F(480))).toBe(true);
    expect(r.breakouts[0]!.capacity.eq(F(480))).toBe(true);
    expect(r.breakouts[1]!).toMatchObject({ index: 1, startsAfterMachine: 16 });
    expect(r.breakouts[1]!.load.eq(F(120))).toBe(true);
    expect(r.breakouts[1]!.capacity.eq(F(120))).toBe(true);
    expect(r.segments).toHaveLength(2);
    // peak at the tail = span load
    expect(r.segments[0]!).toMatchObject({
      fromMachine: 1,
      toMachine: 16,
      beltIndex: 0,
    });
    expect(r.segments[0]!.peakFlow.eq(F(480))).toBe(true);
    expect(r.segments[1]!).toMatchObject({
      fromMachine: 17,
      toMachine: 20,
      beltIndex: 1,
    });
    expect(r.segments[1]!.peakFlow.eq(F(120))).toBe(true);
    expect(r.findings).toEqual([]);
  });
});

describe("solveOutputLane — override undersize (segment-over-capacity)", () => {
  it("break-out 0 override 480->270 (< load 480): over-capacity, busCapacity=270", () => {
    const r = solveOut({ n: 20, rate: F(30), overrides: [F(270)] });
    expect(r.breakouts[0]!.capacity.eq(F(270))).toBe(true);
    const over = r.findings.filter((f) => f.type === "segment-over-capacity");
    expect(over).toHaveLength(1);
    const o = over[0]!;
    if (o.type !== "segment-over-capacity") throw new Error("type");
    expect(o.fromMachine).toBe(1);
    expect(o.toMachine).toBe(16);
    expect(o.peakFlow.eq(F(480))).toBe(true); // the span load
    expect(o.busCapacity.eq(F(270))).toBe(true); // the binding overridden cap
    // no starvation on the output side, ever
    expect(r.findings.some((f) => f.type === "starved-machines")).toBe(false);
  });
});

describe("solveOutputLane — parallel cardinality compatibility (#120)", () => {
  it("keeps every output segment single-line without changing findings", () => {
    const r = solveOut({ n: 37, rate: F(30), overrides: [F(270)] });
    expect(r.segments.length).toBeGreaterThan(1);
    expect(r.segments.every((segment) => segment.parallelCount === 1)).toBe(
      true,
    );
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]!.type).toBe("segment-over-capacity");
  });
});

describe("solveOutputLane — negative and zero overrides", () => {
  it("rejects the first negative override before break-out math", () => {
    const r = solveOut({
      n: 20,
      rate: F(30),
      overrides: [null, F(-5), F(-10)],
    });

    expect(r.breakouts).toEqual([]);
    expect(r.segments).toEqual([]);
    expect(r.findings).toEqual([
      {
        type: "invalid-input",
        reason: "negative-override",
        detail: "lane iron-ingot override 2 must be zero or positive; got -5.",
      },
    ]);
  });

  it.each([
    ["N=0", { n: 0, rate: F(30), overrides: [null, F(-5)] }],
    ["zero-rate", { n: 10, rate: F(0), overrides: [null, F(-5)] }],
    ["p > T", { n: 5, rate: F(812), overrides: [null, F(-5)] }],
    ["oversize array", { n: 10, rate: F(30), overrides: [null, F(-5)] }],
  ])("negative override wins over %s", (_case, opts) => {
    const r = solveOut(opts);

    expect(r.breakouts).toEqual([]);
    expect(r.segments).toEqual([]);
    expect(r.findings).toEqual([
      {
        type: "invalid-input",
        reason: "negative-override",
        detail: "lane iron-ingot override 2 must be zero or positive; got -5.",
      },
    ]);
  });

  it("zero output capacity reports the binding segment over capacity", () => {
    const r = solveOut({ n: 20, rate: F(30), overrides: [F(0)] });

    expect(r.breakouts[0]!.capacity.isZero()).toBe(true);
    expect(r.findings).toEqual([
      {
        type: "segment-over-capacity",
        itemId: "iron-ingot",
        fromMachine: 1,
        toMachine: 16,
        peakFlow: F(480),
        busCapacity: F(0),
      },
    ]);
  });
});

describe("solveOutputLane — infeasibility mirror (p > T)", () => {
  it("p=812 vs top 480 -> infeasible-machine-demand, empty lane", () => {
    const r = solveOut({ n: 5, rate: F(812) });
    expect(r.breakouts).toEqual([]);
    expect(r.segments).toEqual([]);
    const inf = r.findings.filter(
      (f) => f.type === "infeasible-machine-demand",
    );
    expect(inf).toHaveLength(1);
    const f = inf[0]!;
    if (f.type !== "infeasible-machine-demand") throw new Error("type");
    expect(f.demand.eq(F(812))).toBe(true);
    expect(f.topCapacity.eq(F(480))).toBe(true);
  });
});

describe("solveOutputLane — p ∤ T break-out walk (ticket #3 decision)", () => {
  it("N=25, p=37.5, T=480: walk gives 3 belts (NOT ceil(937.5/480)=2)", () => {
    // floor(T/p) = floor(480/37.5) = 12 machines per belt -> ceil(25/12) = 3.
    // The design doc's ceil(N×p/T) = ceil(937.5/480) = 2 would under-count:
    // 2 belts cap at 24 machines, leaving machine 25 uncollected. The walk is
    // authoritative (independently verified against the implementation before
    // asserting).
    const r = solveOut({ n: 25, rate: R(75, 2) });
    expect(r.perMachineOutput.eq(R(75, 2))).toBe(true);
    expect(r.totalOutput.eq(R(1875, 2))).toBe(true); // 937.5
    expect(r.breakouts).toHaveLength(3);

    expect(r.breakouts[0]!).toMatchObject({ index: 0, startsAfterMachine: 0 });
    expect(r.breakouts[0]!.load.eq(F(450))).toBe(true); // 12 × 37.5
    expect(r.breakouts[0]!.capacity.eq(F(480))).toBe(true);

    expect(r.breakouts[1]!).toMatchObject({ index: 1, startsAfterMachine: 12 });
    expect(r.breakouts[1]!.load.eq(F(450))).toBe(true);
    expect(r.breakouts[1]!.capacity.eq(F(480))).toBe(true);

    expect(r.breakouts[2]!).toMatchObject({ index: 2, startsAfterMachine: 24 });
    expect(r.breakouts[2]!.load.eq(R(75, 2))).toBe(true); // 1 × 37.5
    expect(r.breakouts[2]!.capacity.eq(F(60))).toBe(true); // smallest tier ≥ 37.5

    expect(r.segments.map((s) => [s.fromMachine, s.toMachine])).toEqual([
      [1, 12],
      [13, 24],
      [25, 25],
    ]);
    // peak at the tail = span load
    expect(r.segments[0]!.peakFlow.eq(F(450))).toBe(true);
    expect(r.segments[1]!.peakFlow.eq(F(450))).toBe(true);
    expect(r.segments[2]!.peakFlow.eq(R(75, 2))).toBe(true);
    expect(r.findings).toEqual([]);
  });
});

describe("solveStage — full 20-smelter integration", () => {
  it("assembles feed + output lanes with clean shape and no findings", () => {
    const result = solveStage(
      stage({
        machineCount: 20,
        feeds: [feed({ itemId: "iron-ore", perMachineRate: F(30) })],
        outputs: [feed({ itemId: "iron-ingot", perMachineRate: F(30) })],
      }),
    );
    expect(result.findings).toEqual([]);
    expect(result.feeds).toHaveLength(1);
    expect(result.outputs).toHaveLength(1);

    const fe = result.feeds[0]!;
    expect(fe.itemId).toBe("iron-ore");
    expect(fe.totalDemand.eq(F(600))).toBe(true);
    expect(fe.belts.map((b) => b.capacity.toString())).toEqual(["480", "120"]);
    expect(fe.belts.map((b) => b.entersAfterMachine)).toEqual([0, 16]);
    expect(fe.segments.map((s) => [s.fromMachine, s.toMachine])).toEqual([
      [1, 16],
      [17, 20],
    ]);
    expect(fe.findings).toEqual([]);

    const ou = result.outputs[0]!;
    expect(ou.itemId).toBe("iron-ingot");
    expect(ou.totalOutput.eq(F(600))).toBe(true);
    expect(ou.breakouts.map((b) => b.capacity.toString())).toEqual([
      "480",
      "120",
    ]);
    expect(ou.breakouts.map((b) => b.startsAfterMachine)).toEqual([0, 16]);
    expect(ou.breakouts.map((b) => b.load.toString())).toEqual(["480", "120"]);
    expect(ou.segments.map((s) => [s.fromMachine, s.toMachine])).toEqual([
      [1, 16],
      [17, 20],
    ]);
    expect(ou.findings).toEqual([]);
  });

  it("keeps negative overrides lane-local while valid siblings solve", () => {
    const result = solveStage(
      stage({
        machineCount: 20,
        feeds: [
          feed({ itemId: "bad-feed", overrides: [null, F(-5)] }),
          feed({ itemId: "good-feed" }),
        ],
        outputs: [
          feed({ itemId: "bad-output", overrides: [null, F(-5)] }),
          feed({ itemId: "good-output" }),
        ],
      }),
    );

    expect(result.findings).toEqual([]);
    const badFeed = result.feeds.find((lane) => lane.itemId === "bad-feed")!;
    const goodFeed = result.feeds.find((lane) => lane.itemId === "good-feed")!;
    const badOutput = result.outputs.find(
      (lane) => lane.itemId === "bad-output",
    )!;
    const goodOutput = result.outputs.find(
      (lane) => lane.itemId === "good-output",
    )!;

    expect(badFeed.belts).toEqual([]);
    expect(badFeed.segments).toEqual([]);
    expect(invalidReasons(badFeed.findings)).toEqual(["negative-override"]);
    expect(goodFeed.belts).not.toEqual([]);
    expect(goodFeed.findings).toEqual([]);

    expect(badOutput.breakouts).toEqual([]);
    expect(badOutput.segments).toEqual([]);
    expect(invalidReasons(badOutput.findings)).toEqual(["negative-override"]);
    expect(goodOutput.breakouts).not.toEqual([]);
    expect(goodOutput.findings).toEqual([]);
  });
});
