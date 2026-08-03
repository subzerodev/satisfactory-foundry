/**
 * Pure manifold solver (v1). Given a production stage — one recipe on N
 * machines at a uniform clock — computes, per lane, how many belts/pipes feed
 * or drain the manifold, where each enters/breaks out along the machine row,
 * and where the bus over-saturates or starves. All math is exact rational
 * (`Fraction`); no floats, no DOM, no framework imports (src/core purity).
 *
 * Formulas cited from the frozen v1 design spec (§Core math / §Validation) and
 * the Phase 1 spec's pinned resolutions; see
 * features/manifold-visualizer/phase-1/spec.md.
 */

import { Fraction } from "./fraction.ts";

export type LaneKind = "belt" | "pipe";

export interface LaneInput {
  itemId: string; // opaque label, passed through
  kind: LaneKind;
  perMachineRate: Fraction; // base rate at 100% clock, per minute
  overrides?: (Fraction | null)[]; // per-belt capacity override by auto-slot
  // index; null = keep auto. Unclamped (may
  // exceed B); never silently fixed.
}

export interface StageInput {
  machineCount: number; // validated integer ≥ 0
  clockPercent: Fraction; // uniform; d = perMachineRate × clockPercent/100
  capacities: { belt: Fraction[]; pipe: Fraction[] }; // unlocked tiers, ascending (validated, not sorted)
  feeds: LaneInput[];
  outputs: LaneInput[];
}

export interface FeedBelt {
  index: number; // 0-based along the manifold
  capacity: Fraction; // assigned (or overridden) capacity
  overridden: boolean;
  entersAfterMachine: number; // 0 = at the head, before machine 1
}

export interface BusSegment {
  fromMachine: number; // 1-based inclusive span
  toMachine: number;
  peakFlow: Fraction; // span maximum (feed: at head; output: at tail)
  beltIndex: number; // attribution: the belt whose entry/break-out starts this span
}

export interface FeedLaneResult {
  itemId: string;
  kind: LaneKind;
  perMachineDemand: Fraction; // d
  totalDemand: Fraction; // D = N × d
  belts: FeedBelt[];
  segments: BusSegment[];
  findings: Finding[];
}

export interface BreakoutBelt {
  index: number; // 0-based along the collection bus
  capacity: Fraction; // smallest unlocked tier ≥ load
  startsAfterMachine: number; // 0 = collects from machine 1
  load: Fraction; // total flow this belt carries (= Σ its span emissions)
}

export interface OutputLaneResult {
  itemId: string;
  kind: LaneKind;
  perMachineOutput: Fraction; // p (clock-scaled)
  totalOutput: Fraction; // N × p
  breakouts: BreakoutBelt[];
  segments: BusSegment[];
  findings: Finding[];
}

export interface StageSolveResult {
  feeds: FeedLaneResult[];
  outputs: OutputLaneResult[];
  findings: Finding[]; // stage-global invalid-input only (the four
  // pre-solve validations). All lane-scoped
  // findings — including the lane-local
  // invalid-input 'overrides-exceed-belt-count'
  // — live on their lane's findings array.
}

export type Finding =
  | {
      type: "infeasible-machine-demand";
      itemId: string;
      demand: Fraction;
      topCapacity: Fraction;
    }
  | {
      type: "segment-over-capacity";
      itemId: string;
      fromMachine: number;
      toMachine: number;
      peakFlow: Fraction;
      busCapacity: Fraction;
    }
  | {
      type: "starved-machines";
      itemId: string;
      partial?: { machine: number; received: Fraction; shortfall: Fraction };
      starvedFrom?: number;
      starvedTo?: number;
    }
  | {
      type: "invalid-input";
      reason:
        | "capacities-not-ascending"
        | "negative-rate"
        | "nonpositive-clock"
        | "bad-machine-count"
        | "overrides-exceed-belt-count";
      detail: string;
    };

const ZERO = Fraction.from(0);
const HUNDREDTH = Fraction.of(1, 100);

/** A capacity list is valid iff strictly ascending and every entry positive. */
function capacitiesValid(list: Fraction[]): boolean {
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c === undefined || c.lte(ZERO)) {
      return false;
    }
    if (i > 0) {
      const prev = list[i - 1];
      if (prev === undefined || c.lte(prev)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * `solveStage`: the four stage-global validations, the degenerate
 * short-circuit, then per-lane solves with findings routed stage vs lane.
 */
export function solveStage(input: StageInput): StageSolveResult {
  const stageFindings: Finding[] = [];

  // 1. Stage validation — the four stage-global, non-partial-solvable checks.
  if (
    !Number.isInteger(input.machineCount) ||
    !Number.isSafeInteger(input.machineCount) ||
    input.machineCount < 0
  ) {
    stageFindings.push({
      type: "invalid-input",
      reason: "bad-machine-count",
      detail: `machineCount must be a non-negative safe integer; got ${input.machineCount}.`,
    });
  }
  if (input.clockPercent.lte(ZERO)) {
    stageFindings.push({
      type: "invalid-input",
      reason: "nonpositive-clock",
      detail: `clockPercent must be > 0; got ${input.clockPercent.toString()}.`,
    });
  }
  if (
    !capacitiesValid(input.capacities.belt) ||
    !capacitiesValid(input.capacities.pipe)
  ) {
    stageFindings.push({
      type: "invalid-input",
      reason: "capacities-not-ascending",
      detail:
        "each capacity list must be strictly ascending and positive (belt + pipe).",
    });
  }
  for (const lane of [...input.feeds, ...input.outputs]) {
    if (lane.perMachineRate.isNegative()) {
      stageFindings.push({
        type: "invalid-input",
        reason: "negative-rate",
        detail: `perMachineRate must be ≥ 0; lane ${lane.itemId} has ${lane.perMachineRate.toString()}.`,
      });
    }
  }

  // Any stage-global violation aborts the solve with empty lanes: garbage in,
  // findings out. A meaningful partial solve is impossible for these four.
  if (stageFindings.length > 0) {
    return { feeds: [], outputs: [], findings: stageFindings };
  }

  const feeds = input.feeds.map((lane) => solveFeedLane(input, lane));
  const outputs = input.outputs.map((lane) => solveOutputLane(input, lane));
  return { feeds, outputs, findings: [] };
}

/** Per-machine rate scaled by the stage clock: rate × clockPercent/100. */
function scaledRate(input: StageInput, lane: LaneInput): Fraction {
  return lane.perMachineRate.mul(input.clockPercent).mul(HUNDREDTH);
}

/**
 * A lane is degenerate — solves to empty arrays with no findings — when the
 * stage has no machines or the lane's clock-scaled rate is zero. The check
 * precedes every lane solve: a zero-machine stage warns about nothing, oversize
 * overrides included (the stale-overrides finding fires only when a lane
 * actually solves, i.e. N > 0).
 */
function isDegenerate(input: StageInput, rate: Fraction): boolean {
  return input.machineCount === 0 || rate.isZero();
}

export function solveFeedLane(
  input: StageInput,
  lane: LaneInput,
): FeedLaneResult {
  const d = scaledRate(input, lane);
  const D = Fraction.from(input.machineCount).mul(d);
  const base: FeedLaneResult = {
    itemId: lane.itemId,
    kind: lane.kind,
    perMachineDemand: d,
    totalDemand: D,
    belts: [],
    segments: [],
    findings: [],
  };
  if (isDegenerate(input, d)) {
    return base;
  }
  // Stub — greened in Task 2.
  return base;
}

export function solveOutputLane(
  input: StageInput,
  lane: LaneInput,
): OutputLaneResult {
  const p = scaledRate(input, lane);
  const total = Fraction.from(input.machineCount).mul(p);
  const base: OutputLaneResult = {
    itemId: lane.itemId,
    kind: lane.kind,
    perMachineOutput: p,
    totalOutput: total,
    breakouts: [],
    segments: [],
    findings: [],
  };
  if (isDegenerate(input, p)) {
    return base;
  }
  // Stub — greened in Task 3.
  return base;
}
