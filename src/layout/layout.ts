/**
 * Pure layout engine: a solved production stage + its machine footprint →
 * concrete geometry for Phase 2 to render. ONE stage is laid out in the
 * canonical in-game manifold shape (Axis 4): a single machine row, feed bus
 * lanes in front, output collection lanes behind, splitters/mergers per column,
 * belt-drop / break-out marks at the solver's entry boundaries, all floored on
 * an 80 dm (8 m) foundation grid.
 *
 * All geometry is INTEGER decimeters (Axis 2) — `ceilTo10` snaps machine origins
 * to the 1 m build grid, exactly as in-game placement does, without falsifying a
 * building's true size. Fractions appear ONLY as pass-through mark labels
 * (capacity / load); they never enter a coordinate computation.
 *
 * No React, no DOM, no state/ui imports (own eslint purity block). Consumes the
 * solver contract (src/core/manifold.ts) and footprint table (./footprints.ts).
 */

import type { Fraction } from "../core/fraction.ts";
import type {
  StageSolveResult,
  FeedLaneResult,
  OutputLaneResult,
} from "../core/manifold.ts";
import {
  FOOTPRINTS,
  SPLITTER_FOOTPRINT,
  MERGER_FOOTPRINT,
  DEFAULT_FOOTPRINT,
  type Footprint,
} from "./footprints.ts";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A belt-drop (feed) / break-out (output) marker. `load` is output-only. */
export interface BeltMark {
  index: number;
  at: Point;
  capacity: Fraction;
  load?: Fraction;
}

/**
 * One bus lane. `kind` is deliberately omitted: P2 holds the solve and reads
 * feeds[f].kind / outputs[o].kind directly (Axis 5 r1 nit).
 */
export interface LaneLayout {
  itemId: string;
  bus: { from: Point; to: Point };
  junctions: Rect[]; // splitters (feed) / mergers (output), one per machine
  marks: BeltMark[]; // drops (feed) / breakouts (output)
}

export type LayoutFinding = { type: "unknown-footprint"; machineId: string };

export interface StageLayout {
  units: "dm";
  machines: Rect[];
  feedLanes: LaneLayout[];
  outputLanes: LaneLayout[];
  foundations: { origin: Point; cols: number; rows: number };
  findings: LayoutFinding[];
}

/** Belt visual lane width — a RENDER convention (belts have no game footprint). */
const BELT_LANE = 20;
/** Perpendicular spacing between successive bus lanes. */
const LANE_SPACING = 60;
/** Foundation tile edge (8 m). Bounding box inflates to a multiple of this. */
const FOUNDATION_TILE = 80;

/** Snap up to the next multiple of 10 (the 1 m build grid). */
function ceilTo10(n: number): number {
  return Math.ceil(n / 10) * 10;
}

/** Snap up to the next multiple of `m` (0 stays 0). */
function ceilToMultiple(n: number, m: number): number {
  return Math.ceil(n / m) * m;
}

/**
 * The x of the boundary AFTER machine `m` (m = 0..N, 0 = row head): the shared
 * belt entry / break-out point, at the start of column `m`'s pitch cell. Mirrors
 * the schematic ui/layout.ts `boundaryX`, with a zero margin.
 */
function boundaryX(m: number, pitch: number): number {
  return m * pitch;
}

/**
 * Lay out one stage. `machineId` selects the footprint (default + finding on a
 * table miss); `machineCount` and the solve drive every position. The solve's
 * feed/output order is preserved lane-for-lane.
 */
export function layoutStage(
  solve: StageSolveResult,
  machineId: string,
  machineCount: number,
  footprints: Record<string, Footprint> = FOOTPRINTS,
): StageLayout {
  const findings: LayoutFinding[] = [];
  const known = footprints[machineId];
  const footprint = known ?? DEFAULT_FOOTPRINT;
  if (known === undefined) {
    findings.push({ type: "unknown-footprint", machineId });
  }

  const pitch = ceilTo10(footprint.width) + 10;
  const machineDepth = footprint.length; // one machine type per stage → one depth
  const machineWidth = footprint.width;

  // Zero-machine stage: the pinned empty shape (Axis 4.5). Every lane is present
  // with a ZERO-LENGTH bus at the row origin (the degenerate solve has no belts,
  // so no junctions and no marks); foundations are the 0×0 bounding box of
  // nothing at the origin.
  if (machineCount === 0) {
    const emptyLane = (
      lane: FeedLaneResult | OutputLaneResult,
    ): LaneLayout => ({
      itemId: lane.itemId,
      bus: { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } },
      junctions: [],
      marks: [],
    });
    return {
      units: "dm",
      machines: [],
      feedLanes: solve.feeds.map(emptyLane),
      outputLanes: solve.outputs.map(emptyLane),
      foundations: { origin: { x: 0, y: 0 }, cols: 0, rows: 0 },
      findings,
    };
  }

  // Machine row: N true-size rects on the metre grid, one pitch apart.
  const machines: Rect[] = [];
  for (let i = 0; i < machineCount; i++) {
    machines.push({
      x: i * pitch,
      y: 0,
      w: footprint.width,
      h: footprint.length,
    });
  }
  const feedLanes = solve.feeds.map((lane, f) =>
    layoutFeedLane(lane, f, machineCount, pitch, machineWidth),
  );
  const outputLanes = solve.outputs.map((lane, o) =>
    layoutOutputLane(lane, o, machineCount, machineDepth, pitch, machineWidth),
  );

  const foundations = computeFoundations(machines, feedLanes, outputLanes);

  return {
    units: "dm",
    machines,
    feedLanes,
    outputLanes,
    foundations,
    findings,
  };
}

/**
 * Feed lane f (front, −y). Bus at y = −(20 + f×60) spanning the row; a splitter
 * per machine column centred on the lane; a belt-drop mark per FeedBelt at its
 * `entersAfterMachine` boundary (0 = row head). Coincident marks are legal —
 * one per belt, distinct indices, same point (the solver's clamp-to-N / empty-
 * span case); P2 owns overlap rendering.
 */
function layoutFeedLane(
  lane: FeedLaneResult,
  f: number,
  machineCount: number,
  pitch: number,
  machineWidth: number,
): LaneLayout {
  const y = -(BELT_LANE + f * LANE_SPACING);
  return {
    itemId: lane.itemId,
    bus: { from: { x: 0, y }, to: { x: machineCount * pitch, y } },
    junctions: buildJunctions(
      machineCount,
      pitch,
      y,
      SPLITTER_FOOTPRINT,
      machineWidth,
    ),
    marks: lane.belts.map((belt) => ({
      index: belt.index,
      at: { x: boundaryX(belt.entersAfterMachine, pitch), y },
      capacity: belt.capacity,
    })),
  };
}

/**
 * Output lane o (back, +y), mirrored below the row. Bus at
 * y = machineDepth + 20 + o×60; a merger per column; a break-out mark per
 * BreakoutBelt at its `startsAfterMachine` boundary, carrying capacity + load.
 */
function layoutOutputLane(
  lane: OutputLaneResult,
  o: number,
  machineCount: number,
  machineDepth: number,
  pitch: number,
  machineWidth: number,
): LaneLayout {
  const y = machineDepth + BELT_LANE + o * LANE_SPACING;
  return {
    itemId: lane.itemId,
    bus: { from: { x: 0, y }, to: { x: machineCount * pitch, y } },
    junctions: buildJunctions(
      machineCount,
      pitch,
      y,
      MERGER_FOOTPRINT,
      machineWidth,
    ),
    marks: lane.breakouts.map((belt) => ({
      index: belt.index,
      at: { x: boundaryX(belt.startsAfterMachine, pitch), y },
      capacity: belt.capacity,
      load: belt.load,
    })),
  };
}

/**
 * One `size` junction per machine column, centred on that column's machine
 * footprint (x-centre = column origin + width/2) and on the lane's bus line
 * (y-centre = busY). `Math.floor` keeps the x-origin integer for odd widths
 * (e.g. the Constructor's 79 → centre 39) without off-grid drift beyond a
 * rendering sub-metre; the 40×40 box's half-width is exact.
 */
function buildJunctions(
  machineCount: number,
  pitch: number,
  busY: number,
  size: Footprint,
  machineWidth: number,
): Rect[] {
  const junctions: Rect[] = [];
  for (let col = 0; col < machineCount; col++) {
    const centreX = col * pitch + Math.floor(machineWidth / 2);
    junctions.push({
      x: centreX - size.width / 2,
      y: busY - size.length / 2,
      w: size.width,
      h: size.length,
    });
  }
  return junctions;
}

/**
 * Foundations = the true bounding box of every emitted rect / bus / junction /
 * mark, inflated to the next 80 dm multiple in both axes, expressed as an 8 m-
 * tile grid `{origin, cols, rows}`. Origin floors to the tile grid; extent ceils.
 * Only actually-drawn geometry seeds the box — the trailing pitch gap past the
 * last machine is counted only when a bus reaches it (it always does here, since
 * each lane's bus spans 0 → N×pitch), never as a phantom seed.
 */
function computeFoundations(
  machines: Rect[],
  feedLanes: LaneLayout[],
  outputLanes: LaneLayout[],
): { origin: Point; cols: number; rows: number } {
  // Seed the box with the row origin so a machine at (0,0) anchors it even with
  // no lanes; every real rect/bus/junction/mark then widens it.
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;

  const swallow = (x: number, y: number, w = 0, h = 0): void => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x + w);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y + h);
  };

  for (const m of machines) swallow(m.x, m.y, m.w, m.h);
  for (const lane of [...feedLanes, ...outputLanes]) {
    swallow(lane.bus.from.x, lane.bus.from.y);
    swallow(lane.bus.to.x, lane.bus.to.y);
    for (const j of lane.junctions) swallow(j.x, j.y, j.w, j.h);
    for (const mk of lane.marks) swallow(mk.at.x, mk.at.y);
  }

  // Floor the origin onto the tile grid, ceil the far edges — the true bbox is
  // always covered, and the grid starts on a tile boundary.
  const originX = Math.floor(minX / FOUNDATION_TILE) * FOUNDATION_TILE;
  const originY = Math.floor(minY / FOUNDATION_TILE) * FOUNDATION_TILE;
  const farX = ceilToMultiple(maxX - originX, FOUNDATION_TILE);
  const farY = ceilToMultiple(maxY - originY, FOUNDATION_TILE);

  return {
    origin: { x: originX, y: originY },
    cols: farX / FOUNDATION_TILE,
    rows: farY / FOUNDATION_TILE,
  };
}
