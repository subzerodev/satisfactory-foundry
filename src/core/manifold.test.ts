import { Fraction } from "./fraction.ts";
import {
  solveStage,
  type LaneInput,
  type StageInput,
  type Finding,
} from "./manifold.ts";

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
