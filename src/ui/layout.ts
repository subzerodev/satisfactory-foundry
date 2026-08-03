/**
 * Pure schematic geometry: solve result + machine count → plain-number layout.
 * Coordinates derive ONLY from integer machine indices, counts, and array
 * positions — never from a Fraction (rates appear only as formatted strings,
 * elsewhere). Spans, belt indices, and item ids pass through untouched.
 */

import type {
  StageSolveResult,
  FeedLaneResult,
  OutputLaneResult,
} from "../core/manifold.ts";

export const LAYOUT = {
  viewW: 960,
  marginX: 24, // usable = viewW − marginX×2 = 912
  minPitch: 8,
  maxPitch: 48,
  labelPitch: 20,
  machineH: 40,
  laneH: 56,
  busH: 28,
  marginY: 16,
} as const;

const USABLE = LAYOUT.viewW - LAYOUT.marginX * 2;

export interface SchematicLayout {
  width: number;
  height: number;
  pitch: number;
  labelStep: number;
  scrolled: boolean;
  machines: { index: number; x: number; labeled: boolean }[];
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
  }[];
  seams: number[];
}

function clamp(lo: number, v: number, hi: number): number {
  return Math.max(lo, Math.min(v, hi));
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
    })),
    seams: lane.segments
      .filter((s) => s.fromMachine > 1)
      .map((s) => boundaryX(s.fromMachine - 1, pitch)),
  };
}

export function computeLayout(
  result: StageSolveResult,
  machineCount: number,
): SchematicLayout {
  const N = machineCount;
  const pitch = clamp(
    LAYOUT.minPitch,
    Math.floor(USABLE / Math.max(N, 1)),
    LAYOUT.maxPitch,
  );
  const scrolled = pitch === LAYOUT.minPitch && LAYOUT.minPitch * N > USABLE;
  const width = scrolled ? LAYOUT.marginX * 2 + pitch * N : LAYOUT.viewW;

  const labelStep =
    pitch >= LAYOUT.labelPitch
      ? 1
      : Math.ceil((N * LAYOUT.labelPitch) / USABLE);

  const machines: SchematicLayout["machines"] = [];
  for (let i = 1; i <= N; i++) {
    machines.push({
      index: i,
      x: LAYOUT.marginX + (i - 1) * pitch,
      labeled: i === 1 || i === N || i % labelStep === 0,
    });
  }

  const feeds = result.feeds.map((lane, i) =>
    feedTrack(lane, LAYOUT.marginY + i * LAYOUT.laneH, pitch),
  );
  const machineTop =
    LAYOUT.marginY + result.feeds.length * LAYOUT.laneH + LAYOUT.busH;
  const outputTop = machineTop + LAYOUT.machineH + LAYOUT.busH;
  const outputs = result.outputs.map((lane, j) =>
    outputTrack(lane, outputTop + j * LAYOUT.laneH, pitch),
  );

  const height =
    LAYOUT.marginY * 2 +
    result.feeds.length * LAYOUT.laneH +
    LAYOUT.busH * 2 +
    LAYOUT.machineH +
    result.outputs.length * LAYOUT.laneH;

  return {
    width,
    height,
    pitch,
    labelStep,
    scrolled,
    machines,
    feeds,
    outputs,
  };
}
