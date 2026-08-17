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
  parallelCount: number; // derived physical bus lines; feed 1|2, output always 1
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
        | "negative-override"
        | "overrides-exceed-belt-count";
      detail: string;
    };

const ZERO = Fraction.from(0);
const HUNDREDTH = Fraction.of(1, 100);

/**
 * Convert an exact bigint machine index to a JS `number`, throwing (never
 * truncating) past MAX_SAFE_INTEGER. Machine indices come from
 * `Fraction.floorDiv`/`ceilDiv` bigints; the guard makes the boundary explicit
 * rather than silently corrupting a plan.
 */
function toIndex(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(
      `manifold: index ${value} exceeds Number.MAX_SAFE_INTEGER; ` +
        "stage is implausibly large.",
    );
  }
  return Number(value);
}

/**
 * Smallest unlocked tier whose capacity ≥ `need`. Tiers are validated ascending
 * before any lane solve, so the first satisfying entry is the smallest. Returns
 * the top tier when `need` exceeds every tier (the caller guards feasibility
 * separately: on the feed side `d ≤ B` is checked first, so a remainder ≤ B
 * always has a satisfying tier).
 */
function smallestTierAtLeast(tiers: Fraction[], need: Fraction): Fraction {
  for (const t of tiers) {
    if (t.gte(need)) {
      return t;
    }
  }
  // Unreachable given the feasibility guard; return top tier as a total fn.
  const top = tiers[tiers.length - 1];
  if (top === undefined) {
    throw new RangeError("smallestTierAtLeast: empty tier list.");
  }
  return top;
}

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
 * After negative overrides have been rejected, a lane is degenerate — solves
 * to empty arrays with no findings — when the stage has no machines or the
 * lane's clock-scaled rate is zero. Thus a zero-machine stage warns only about
 * a negative override; oversize arrays remain silent until a lane actually
 * solves (N > 0 and a nonzero rate).
 */
function isDegenerate(input: StageInput, rate: Fraction): boolean {
  return input.machineCount === 0 || rate.isZero();
}

/** Return the first lane-local finding for a negative capacity override. */
function negativeOverrideFinding(lane: LaneInput): Finding | null {
  const overrides = lane.overrides;
  if (overrides === undefined) {
    return null;
  }
  for (let i = 0; i < overrides.length; i++) {
    const override = overrides[i];
    if (override !== null && override !== undefined && override.isNegative()) {
      return {
        type: "invalid-input",
        reason: "negative-override",
        detail: `lane ${lane.itemId} override ${i + 1} must be zero or positive; got ${override.toString()}.`,
      };
    }
  }
  return null;
}

/**
 * Result of draining one bus span under the head-first-draw model: how many
 * machines were fully served, the (possibly zero) partial received by the next
 * machine, and the flow that survives past the span's last machine.
 */
interface SpanDrain {
  fullServed: number; // machines that drew a full `d`
  partialReceived: Fraction; // what the (fullServed+1)-th machine got; < d
  survived: Fraction; // flow surviving past the span's last machine
}

/**
 * Drain a span of `machineCount` machines, each demanding `d`, from an
 * `available` supply, head-first. `available >= 0`, `d > 0`, `machineCount >= 1`.
 */
function drainSpan(
  available: Fraction,
  d: Fraction,
  machineCount: number,
): SpanDrain {
  const capacity = available.floorDiv(d); // bigint: machines a full-d draw covers
  if (capacity >= BigInt(machineCount)) {
    return {
      fullServed: machineCount,
      partialReceived: ZERO,
      survived: available.sub(Fraction.from(machineCount).mul(d)),
    };
  }
  const fullServed = toIndex(capacity);
  const partialReceived = available.sub(Fraction.from(fullServed).mul(d));
  return { fullServed, partialReceived, survived: ZERO };
}

/**
 * Combine `D` demand into `k` belts on the given tiers: `k−1` top-tier belts +
 * the smallest tier ≥ the remainder. `k = D.ceilDiv(B)` with `B` the top tier.
 * Feasibility (`d ≤ B`) is guaranteed by the caller.
 */
function combineFeedBelts(
  D: Fraction,
  tiers: Fraction[],
  B: Fraction,
): Fraction[] {
  const k = toIndex(D.ceilDiv(B));
  const belts: Fraction[] = [];
  for (let i = 0; i < k - 1; i++) {
    belts.push(B);
  }
  const remainder = D.sub(B.mul(Fraction.from(k - 1)));
  belts.push(smallestTierAtLeast(tiers, remainder));
  return belts;
}

export function solveFeedLane(
  input: StageInput,
  lane: LaneInput,
): FeedLaneResult {
  const d = scaledRate(input, lane);
  const N = input.machineCount;
  const D = Fraction.from(N).mul(d);
  const base: FeedLaneResult = {
    itemId: lane.itemId,
    kind: lane.kind,
    perMachineDemand: d,
    totalDemand: D,
    belts: [],
    segments: [],
    findings: [],
  };
  const negativeOverride = negativeOverrideFinding(lane);
  if (negativeOverride !== null) {
    base.findings.push(negativeOverride);
    return base;
  }
  if (isDegenerate(input, d)) {
    return base;
  }

  const tiers =
    lane.kind === "belt" ? input.capacities.belt : input.capacities.pipe;
  const B = tiers[tiers.length - 1]!; // non-empty + validated ascending

  // Infeasibility: a single machine outdemands the top belt. Render nothing.
  if (d.gt(B)) {
    base.findings.push({
      type: "infeasible-machine-demand",
      itemId: lane.itemId,
      demand: d,
      topCapacity: B,
    });
    return base;
  }

  // Combination, then override replacement by auto-slot index (count fixed).
  const autoCaps = combineFeedBelts(D, tiers, B);
  const overrides = lane.overrides;
  if (overrides !== undefined && overrides.length > autoCaps.length) {
    base.findings.push({
      type: "invalid-input",
      reason: "overrides-exceed-belt-count",
      detail: `lane ${lane.itemId}: ${overrides.length} overrides for ${autoCaps.length} belts.`,
    });
    return base;
  }

  const belts: FeedBelt[] = [];
  let cumulative = ZERO; // Σ capacities of prior belts (post-override)
  for (let j = 0; j < autoCaps.length; j++) {
    const override = overrides?.[j] ?? null;
    const capacity = override ?? autoCaps[j]!;
    // floor(S/d) on post-override capacities can exceed N when an oversize
    // override pushes prior cumulative capacity past the whole stage's demand;
    // clamp to N so a belt that would enter past the last machine reports
    // entersAfterMachine = N (its span start = N+1 > end -> no segment, the
    // belt is simply unused). Keeps every emitted index ≤ N.
    const entryQuotient = j === 0 ? 0n : cumulative.floorDiv(d);
    const entersAfterMachine =
      entryQuotient >= BigInt(N) ? N : toIndex(entryQuotient);
    belts.push({
      index: j,
      capacity,
      overridden: override !== null,
      entersAfterMachine,
    });
    cumulative = cumulative.add(capacity);
  }

  // Segments partitioned by entry points; drain head-first, carrying survived
  // flow forward. Empty spans (two belts entering at the same machine) pass
  // their capacity through without a segment.
  const segments: BusSegment[] = [];
  let survivedIn = ZERO;
  for (let j = 0; j < belts.length; j++) {
    const belt = belts[j]!;
    const start = belt.entersAfterMachine + 1;
    // Clamp the non-last span end to N as well (mirrors the output side): the
    // next belt's entersAfterMachine is already ≤ N, but this keeps the bound
    // explicit and robust to any future entry-point change.
    const end =
      j + 1 < belts.length ? Math.min(belts[j + 1]!.entersAfterMachine, N) : N;
    const available = survivedIn.add(belt.capacity);
    if (start > end) {
      // No machines exclusively in this belt's span; capacity carries forward.
      survivedIn = available;
      continue;
    }
    const span = end - start + 1;
    const peakFlow = available; // feed side: peak at the head, just after entry
    // A normal incoming slot fits one unlocked line. Head-first drain leaves
    // survivedIn < d, while d <= B and belt.capacity <= B, so its peak is <2B:
    // exact ceil division is therefore bounded to 1|2. An oversized explicit
    // slot remains one invalid line and keeps the capacity finding below.
    const bundleEligible = belt.capacity.lte(B);
    const parallelCount = bundleEligible
      ? Math.max(1, Number(peakFlow.ceilDiv(B)))
      : 1;
    segments.push({
      fromMachine: start,
      toMachine: end,
      peakFlow,
      beltIndex: belt.index,
      parallelCount,
    });

    if (!bundleEligible && peakFlow.gt(B)) {
      base.findings.push({
        type: "segment-over-capacity",
        itemId: lane.itemId,
        fromMachine: start,
        toMachine: end,
        peakFlow,
        busCapacity: B,
      });
    }

    const drain = drainSpan(available, d, span);
    if (drain.fullServed < span) {
      const finding: Extract<Finding, { type: "starved-machines" }> = {
        type: "starved-machines",
        itemId: lane.itemId,
      };
      // Global index of the machine after the fully-served ones.
      const boundary = start + drain.fullServed;
      let runStart = boundary;
      if (!drain.partialReceived.isZero()) {
        finding.partial = {
          machine: boundary,
          received: drain.partialReceived,
          shortfall: d.sub(drain.partialReceived),
        };
        runStart = boundary + 1;
      }
      if (runStart <= end) {
        finding.starvedFrom = runStart;
        finding.starvedTo = end;
      }
      base.findings.push(finding);
    }
    survivedIn = drain.survived;
  }

  base.belts = belts;
  base.segments = segments;
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
  const negativeOverride = negativeOverrideFinding(lane);
  if (negativeOverride !== null) {
    base.findings.push(negativeOverride);
    return base;
  }
  if (isDegenerate(input, p)) {
    return base;
  }

  const N = input.machineCount;
  const tiers =
    lane.kind === "belt" ? input.capacities.belt : input.capacities.pipe;
  const T = tiers[tiers.length - 1]!; // non-empty + validated ascending

  // Infeasibility mirror: one machine's output exceeds the best belt.
  if (p.gt(T)) {
    base.findings.push({
      type: "infeasible-machine-demand",
      itemId: lane.itemId,
      demand: p,
      topCapacity: T,
    });
    return base;
  }

  // Break-out walk: a collection belt carries at most `machinesPerBelt`
  // machines' emissions before its load would exceed T; it breaks out and a
  // fresh belt starts. `floor(T/p) ≥ 1` here since p ≤ T.
  const machinesPerBelt = toIndex(T.floorDiv(p));
  const overrides = lane.overrides;

  // Belt count is the walk's result: ceil(N / machinesPerBelt). Computed as an
  // exact rational through the toIndex guard (mirroring the feed side) — no raw
  // float division on machine-derived counts. (The spec's ceil(N×p/T) coincides
  // only when p divides T evenly; the walk is authoritative — see the spec's
  // solveOutputLane section, ticket #3 decision.)
  const beltCount = toIndex(
    Fraction.from(N).ceilDiv(Fraction.from(machinesPerBelt)),
  );

  if (overrides !== undefined && overrides.length > beltCount) {
    base.findings.push({
      type: "invalid-input",
      reason: "overrides-exceed-belt-count",
      detail: `lane ${lane.itemId}: ${overrides.length} overrides for ${beltCount} break-out belts.`,
    });
    return base;
  }

  const breakouts: BreakoutBelt[] = [];
  const segments: BusSegment[] = [];
  for (let b = 0; b < beltCount; b++) {
    const start = b * machinesPerBelt + 1;
    const end = Math.min((b + 1) * machinesPerBelt, N);
    const spanMachines = end - start + 1;
    const load = Fraction.from(spanMachines).mul(p);
    const override = overrides?.[b] ?? null;
    const capacity = override ?? smallestTierAtLeast(tiers, load);

    breakouts.push({
      index: b,
      capacity,
      startsAfterMachine: start - 1, // 0 = collects from machine 1
      load,
    });

    // Output side: peak flow is at the tail (just before break-out / lane end),
    // = the full span load, since each belt collects only its own machines.
    segments.push({
      fromMachine: start,
      toMachine: end,
      peakFlow: load,
      beltIndex: b,
      parallelCount: 1,
    });

    // Over-capacity iff the (overridden) belt cannot carry its span load. On
    // auto belts capacity ≥ load by construction, so only an undersize override
    // triggers this; busCapacity is the binding overridden capacity.
    if (load.gt(capacity)) {
      base.findings.push({
        type: "segment-over-capacity",
        itemId: lane.itemId,
        fromMachine: start,
        toMachine: end,
        peakFlow: load,
        busCapacity: capacity,
      });
    }
  }

  base.breakouts = breakouts;
  base.segments = segments;
  return base;
}
