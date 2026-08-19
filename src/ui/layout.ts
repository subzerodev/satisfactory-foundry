/**
 * Pure schematic geometry: solve result + machine count → plain-number layout.
 * Coordinates derive ONLY from integer machine indices, counts, and array
 * positions — never from a Fraction (rates appear only as formatted strings,
 * elsewhere). Spans, belt indices, item ids, and each segment's exact
 * `entryFlow` pass through untouched (entryFlow is display data, never a
 * coordinate).
 */

import type { Fraction } from "../core/fraction.ts";
import type {
  StageSolveResult,
  FeedLaneResult,
  OutputLaneResult,
  Finding,
} from "../core/manifold.ts";

export const LAYOUT = {
  viewW: 960,
  marginX: 24, // usable = viewW − marginX×2 = 912
  // The READABLE pitch floor (#154): 10px mono digits ≈ 6px/char, so a 3-digit
  // index ("106") ≈ 18px ink; at 24px pitch adjacent centred labels keep a ≥6px
  // ink gap — every machine gets a legible number, and the drawing PANS below
  // this floor rather than cramming (Michael's "moveable like the flow chart").
  // Supersedes the old 8px cram floor + the fit-to-width band mode (S12 P1).
  minPitch: 24,
  maxPitch: 48,
  machineH: 40,
  rulerH: 12, // P3: the build-view axis height — a two-mark ruler replaces the
  // 40px machine block (Michael's option-A pick, #135 c24913). The machines
  // view keeps the full machineH block via computeLayout's default.
  laneH: 56,
  busH: 28,
  marginY: 16,
} as const;

const USABLE = LAYOUT.viewW - LAYOUT.marginX * 2;

export interface SchematicLayout {
  width: number;
  height: number;
  pitch: number;
  scrolled: boolean;
  machineTop: number; // machine-row top y (consumed, never re-derived)
  machines: { index: number; x: number }[];
  /**
   * The machine indices that carry an individual boundary tick: feed entries,
   * output breakouts, segment boundaries, and any machine a finding references
   * (the complete textual reference set — nothing else references interior
   * indices). One set-union over existing solve data. The build view's ruler
   * draws MAJOR ticks at these belt-stretch boundaries. Never empty on a solved
   * lane.
   */
  significant: number[];
  feeds: LaneTrack[];
  outputs: LaneTrack[];
}

export interface LaneTrack {
  itemId: string;
  y: number;
  busY: number;
  belts: { index: number; x: number }[];
  segments: {
    fromMachine: number;
    toMachine: number;
    x1: number;
    x2: number;
    beltIndex: number;
    entryFlow: Fraction; // solver's entry/head flow, passed through for the title
    handoffResidue: Fraction; // trunk carry past the span (display data; never a
    // coordinate — same convention as entryFlow). Feeds the D1 ribbon's right
    // half-height + the D2/D3 hand-off number; ZERO on every output span.
  }[];
  seams: number[];
}

function clamp(lo: number, v: number, hi: number): number {
  return Math.max(lo, Math.min(v, hi));
}

/**
 * The significant machine indices — one set-union over EXISTING solve data (no
 * new solver math): feed entry points, output breakout points, each segment's
 * start/end machine, and every machine a finding references (the same
 * `starved-machines` / `segment-over-capacity` fields Schematic's segmentErrored
 * and format.ts's findingText already read). These are exactly the indices the
 * textual layer (findings, tooltips, override rows) can name, so with them
 * marked no referenced machine is unlocatable. The build view's ruler draws its
 * MAJOR ticks here. Returned sorted ascending.
 */
function significantMachines(
  result: StageSolveResult,
  machineCount: number,
): number[] {
  const marks = new Set<number>();
  const add = (m: number) => {
    if (m >= 1 && m <= machineCount) marks.add(m);
  };

  const noteFinding = (f: Finding) => {
    if (f.type === "segment-over-capacity") {
      add(f.fromMachine);
      add(f.toMachine);
    } else if (f.type === "starved-machines") {
      if (f.partial !== undefined) add(f.partial.machine);
      if (f.starvedFrom !== undefined) add(f.starvedFrom);
      if (f.starvedTo !== undefined) add(f.starvedTo);
    }
  };

  for (const lane of result.feeds) {
    // A belt entering after machine m starts machine m+1's supply; label that
    // machine (head belt, m=0, marks machine 1).
    for (const b of lane.belts) add(b.entersAfterMachine + 1);
    for (const s of lane.segments) {
      add(s.fromMachine);
      add(s.toMachine);
    }
    lane.findings.forEach(noteFinding);
  }
  for (const lane of result.outputs) {
    for (const b of lane.breakouts) add(b.startsAfterMachine + 1);
    for (const s of lane.segments) {
      add(s.fromMachine);
      add(s.toMachine);
    }
    lane.findings.forEach(noteFinding);
  }

  return [...marks].sort((a, b) => a - b);
}

/** Boundary x after machine m (m = 0..N): the shared entry/break-out/edge x. */
function boundaryX(m: number, pitch: number): number {
  return LAYOUT.marginX + m * pitch;
}

function feedTrack(
  lane: FeedLaneResult,
  bandY: number,
  pitch: number,
): LaneTrack {
  return {
    itemId: lane.itemId,
    y: bandY,
    busY: bandY + LAYOUT.laneH - 8,
    belts: lane.belts.map((b) => ({
      index: b.index,
      x: boundaryX(b.entersAfterMachine, pitch),
    })),
    segments: lane.segments.map((s) => ({
      fromMachine: s.fromMachine,
      toMachine: s.toMachine,
      x1: boundaryX(s.fromMachine - 1, pitch),
      x2: boundaryX(s.toMachine, pitch),
      beltIndex: s.beltIndex,
      entryFlow: s.entryFlow,
      handoffResidue: s.handoffResidue,
    })),
    // Interior seams: each segment start boundary except the head (machine 1).
    seams: lane.segments
      .filter((s) => s.fromMachine > 1)
      .map((s) => boundaryX(s.fromMachine - 1, pitch)),
  };
}

function outputTrack(
  lane: OutputLaneResult,
  bandY: number,
  pitch: number,
): LaneTrack {
  return {
    itemId: lane.itemId,
    y: bandY,
    busY: bandY + 8,
    belts: lane.breakouts.map((b) => ({
      index: b.index,
      x: boundaryX(b.startsAfterMachine, pitch),
    })),
    segments: lane.segments.map((s) => ({
      fromMachine: s.fromMachine,
      toMachine: s.toMachine,
      x1: boundaryX(s.fromMachine - 1, pitch),
      x2: boundaryX(s.toMachine, pitch),
      beltIndex: s.beltIndex,
      entryFlow: s.entryFlow,
      handoffResidue: s.handoffResidue,
    })),
    seams: lane.segments
      .filter((s) => s.fromMachine > 1)
      .map((s) => boundaryX(s.fromMachine - 1, pitch)),
  };
}

export function computeLayout(
  result: StageSolveResult,
  machineCount: number,
  machineRowH: number = LAYOUT.machineH,
): SchematicLayout {
  const N = machineCount;
  const pitch = clamp(
    LAYOUT.minPitch,
    Math.floor(USABLE / Math.max(N, 1)),
    LAYOUT.maxPitch,
  );
  // Scrolled whenever the drawn content exceeds the panel — at the readable
  // floor the drawing pans instead of cramming (#154). width unchanged.
  const scrolled = pitch * N > USABLE;
  const width = scrolled ? LAYOUT.marginX * 2 + pitch * N : LAYOUT.viewW;

  // significant is a pure set-union over existing solve data (entries,
  // breakouts, segment bounds, finding refs); the build-view ruler draws its
  // MAJOR ticks from it.
  const significant = significantMachines(result, N);

  const machines: SchematicLayout["machines"] = [];
  for (let i = 1; i <= N; i++) {
    machines.push({
      index: i,
      x: LAYOUT.marginX + (i - 1) * pitch,
    });
  }

  const feeds = result.feeds.map((lane, i) =>
    feedTrack(lane, LAYOUT.marginY + i * LAYOUT.laneH, pitch),
  );
  // machineTop carries NO machineRowH term — it registers with the feed lanes
  // and P2's endpoint rows above, pixel-identical across both row heights (the
  // structural register guarantee). Only outputTop + height shrink with the row.
  const machineTop =
    LAYOUT.marginY + result.feeds.length * LAYOUT.laneH + LAYOUT.busH;
  const outputTop = machineTop + machineRowH + LAYOUT.busH;
  const outputs = result.outputs.map((lane, j) =>
    outputTrack(lane, outputTop + j * LAYOUT.laneH, pitch),
  );

  const height =
    LAYOUT.marginY * 2 +
    result.feeds.length * LAYOUT.laneH +
    LAYOUT.busH * 2 +
    machineRowH +
    result.outputs.length * LAYOUT.laneH;

  return {
    width,
    height,
    pitch,
    scrolled,
    machineTop,
    machines,
    significant,
    feeds,
    outputs,
  };
}
