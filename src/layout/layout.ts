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
 * belt entry / break-out point, at the start of column `m`'s pitch cell (a zero-
 * margin variant of the classic boundary-x formula).
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

// ---------------------------------------------------------------------------
// layoutChain (Stage 7 / Phase 3, frozen Axis 1) — compose the per-stage
// StageLayouts into ONE world-dm floor plan, scaling the canvas arrangement so
// no two sites' foundation bboxes overlap. Pure, deterministic, layout-internal:
// it consumes only StageLayout (this module's own contract) + a plain px
// arrangement, and emits dm origins. No state/ui imports (the layout purity
// block), no Fraction (geometry, not solver rates).
// ---------------------------------------------------------------------------

/** One stage's precomputed layout, tagged by its stable stage id. */
export interface ChainSite {
  stageId: string;
  layout: StageLayout;
}

/** A stage's canvas position (RELATIVE px — magnitudes are pixels, not meters;
 *  only the arrangement/intent is used, scaled to world dm by the composer). */
export interface ChainArrangement {
  stageId: string;
  x: number;
  y: number;
}

/** A placed site: its stage id + the world-dm origin its foundation bbox's
 *  top-left corner lands at. Add `origin` to each `layout.foundations` rect to
 *  read a site element's world coordinate. */
export interface ChainPlacement {
  stageId: string;
  origin: Point;
}

export interface ChainLayout {
  units: "dm";
  sites: ChainPlacement[];
  /** The world-dm bounding box enclosing every placed site's foundation bbox. */
  bounds: Rect;
  /** The uniform px→dm scale the composer chose (the minimal non-overlap K,
   *  grid-rounded origins aside). 0 sites → 1 (nothing to scale). */
  scale: number;
}

/**
 * The per-axis gutter (one foundation tile, 80 dm) that must separate two
 * sites' foundation bboxes: `layoutChain` scales the arrangement until every
 * pair clears this on at least one axis, and the < 10 dm grid-rounding drift
 * can never close it (the separating-axis argument keeps ≥ 70 dm — test-pinned).
 */
const CHAIN_GUTTER = FOUNDATION_TILE;

/** The scale floor: even a tightly-arranged single pair never scales BELOW this
 *  (keeps a degenerate/near-coincident arrangement from collapsing to nothing,
 *  and keeps the world plan legible). Chosen at 1 (px≈dm) — K only grows. */
const K_MIN = 1;

/** A site's world-dm foundation bbox at a given origin: the tile grid inflated
 *  to dm, translated by the origin. */
function siteBox(origin: Point, layout: StageLayout): Rect {
  const { cols, rows } = layout.foundations;
  return {
    x: origin.x,
    y: origin.y,
    w: cols * FOUNDATION_TILE,
    h: rows * FOUNDATION_TILE,
  };
}

/**
 * The world-dm floor plan for a solved chain (frozen Axis 1). `sites` are the
 * per-stage layouts to place; `arrangement` carries each site's canvas px
 * position (relative only — the user's mental map). The composer runs three
 * deterministic steps:
 *
 *   1. Coincidence tie-break — any cluster of sites sharing one canvas point
 *      (a reachable drag state) is fanned apart FIRST onto a globally
 *      collision-free slot sequence (the placementSlot mechanism), so every
 *      pair carries strictly positive separation before K is derived. Without
 *      this a coincident pair's required K is infinite. All positions equal (or
 *      a single site) degenerates to the horizontal auto-row.
 *   2. Minimal scale K — the max over pairs of (required dm separation / canvas
 *      separation) that keeps every pair's foundation bboxes + the 80 dm gutter
 *      from overlapping; clamped to K_MIN. Finite by step 1.
 *   3. Grid rounding — each scaled origin rounds UP to the 1 m grid (ceilTo10).
 *      Drift < 10 dm per axis < the 80 dm gutter, so rounding never
 *      re-introduces an overlap step 2 excluded (separating-axis argument).
 *
 * `arrangement` MUST carry an entry per site (the store auto-slots every stage —
 * Assumption #1); a site missing from `arrangement` falls back to the origin,
 * which the tie-break then fans like any coincidence.
 */
export function layoutChain(
  sites: ChainSite[],
  arrangement: ChainArrangement[],
): ChainLayout {
  if (sites.length === 0) {
    return {
      units: "dm",
      sites: [],
      bounds: { x: 0, y: 0, w: 0, h: 0 },
      scale: 1,
    };
  }

  const posOf = new Map(
    arrangement.map((a) => [a.stageId, { x: a.x, y: a.y }]),
  );
  // Canvas px positions in stageOrder (== sites order), origin fallback.
  const raw = sites.map((s) => posOf.get(s.stageId) ?? { x: 0, y: 0 });

  // --- Step 1: coincidence tie-break -------------------------------------
  // Fan every zero-separation cluster onto a GLOBALLY collision-free slot
  // sequence, checked against ALL occupied points (including other clusters'
  // fanned members), so no fanned site can land on any occupied point. The
  // single-site / all-equal case degenerates to the horizontal auto-row here.
  const points = fanCoincident(raw);

  // --- Step 2: minimal scale K -------------------------------------------
  // K = max over pairs of (required dm separation / canvas separation). The
  // required separation is the smallest s such that scaling both sites' bboxes
  // apart by s×(their canvas delta) clears the gutter on one axis. Because the
  // bbox extents are FIXED (scale moves origins, not sizes), we solve per pair
  // for the K that first clears, and take the max. Finite: every pair now has a
  // strictly positive canvas delta (step 1).
  let k = K_MIN;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      k = Math.max(
        k,
        requiredScaleForPair(
          points[i]!,
          sites[i]!.layout,
          points[j]!,
          sites[j]!.layout,
        ),
      );
    }
  }

  // --- Step 3: grid rounding ---------------------------------------------
  // Scale each canvas point by K (relative to the min corner so origins stay
  // non-negative), then snap up to the 1 m grid.
  const minPx = points.reduce(
    (acc, p) => ({ x: Math.min(acc.x, p.x), y: Math.min(acc.y, p.y) }),
    { x: Infinity, y: Infinity },
  );
  const placements: ChainPlacement[] = sites.map((s, idx) => {
    const p = points[idx]!;
    return {
      stageId: s.stageId,
      origin: {
        x: ceilTo10((p.x - minPx.x) * k),
        y: ceilTo10((p.y - minPx.y) * k),
      },
    };
  });

  // Bounds enclose every placed site's foundation bbox.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  placements.forEach((pl, idx) => {
    const box = siteBox(pl.origin, sites[idx]!.layout);
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.w);
    maxY = Math.max(maxY, box.y + box.h);
  });

  return {
    units: "dm",
    sites: placements,
    bounds: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    scale: k,
  };
}

/**
 * Fan every coincident cluster onto a globally collision-free slot sequence.
 * A site that shares its canvas point with ANY other site is a cluster member;
 * ALL members of every cluster (including the first-seen) are relocated onto a
 * single monotonic horizontal auto-row sequence, checked against every point
 * that stays put AND every slot already handed out, so no fanned member can
 * land on another site or another cluster's member — totality closes by
 * construction (r2 fold). Sites on a genuinely unique point keep it. The
 * all-equal case is one big cluster → every site lands on the row (the
 * degenerate horizontal auto-row); a single site is trivially unique. The
 * auto-row pitch is one canvas "column" (the store's placementSlot 260 px step).
 * Order follows `raw` (== stageOrder) for determinism.
 */
function fanCoincident(raw: Point[]): Point[] {
  const key = (p: Point): string => `${p.x},${p.y}`;
  // Multiplicity of each original point: a point shared by ≥2 sites is a
  // cluster and ALL its members fan out; a unique point stays.
  const count = new Map<string, number>();
  for (const p of raw) count.set(key(p), (count.get(key(p)) ?? 0) + 1);

  const AUTO_ROW_PITCH = 260;
  // Points that stay put (unique originals) seed the occupied set so no fanned
  // slot can collide with them.
  const occupied = new Set<string>();
  for (const p of raw) {
    if ((count.get(key(p)) ?? 0) === 1) occupied.add(key(p));
  }

  let nextSlot = 0;
  const nextFreeSlot = (): Point => {
    let slot: Point;
    do {
      slot = { x: nextSlot * AUTO_ROW_PITCH, y: 0 };
      nextSlot += 1;
    } while (occupied.has(key(slot)));
    occupied.add(key(slot));
    return slot;
  };

  return raw.map((p) => {
    if ((count.get(key(p)) ?? 0) === 1) return { x: p.x, y: p.y };
    // A cluster member (including the first-seen) fans onto the next free slot.
    return nextFreeSlot();
  });
}

/**
 * The minimal scale K such that scaling canvas points `pa`/`pb` apart by K (and
 * placing each site's fixed-size foundation bbox at the scaled origin) clears
 * the gutter on at least one axis. Only the origin DELTA scales — the bbox
 * extents are fixed — so along x the two boxes' near faces separate by the gutter
 * when `K × dx − w(left box) = gutter`, i.e. `K = (w(left) + gutter) / dx`. The
 * left box on x is the one with the smaller scaled origin, which (scaling
 * preserves order) is the one with the smaller canvas x; likewise for y. We take
 * the SMALLER of the two per-axis K thresholds (clearing EITHER axis suffices),
 * then the caller maxes across pairs. Infinity on an axis with zero canvas delta
 * (can't separate along it by scaling — step 1 guarantees at least one axis has
 * a positive delta, so kPair is finite).
 */
function requiredScaleForPair(
  pa: Point,
  la: StageLayout,
  pb: Point,
  lb: StageLayout,
): number {
  const boxA = siteBox({ x: 0, y: 0 }, la);
  const boxB = siteBox({ x: 0, y: 0 }, lb);
  const dx = Math.abs(pb.x - pa.x);
  const dy = Math.abs(pb.y - pa.y);
  // The LEFT box on each axis is the smaller-canvas-coordinate site (scaling
  // preserves order); its extent is what the origin gap must clear + the gutter.
  const leftWidth = pa.x <= pb.x ? boxA.w : boxB.w;
  const topHeight = pa.y <= pb.y ? boxA.h : boxB.h;
  const kx = dx > 0 ? (leftWidth + CHAIN_GUTTER) / dx : Infinity;
  const ky = dy > 0 ? (topHeight + CHAIN_GUTTER) / dy : Infinity;
  // Clearing EITHER axis suffices for THIS pair → the smaller threshold.
  const kPair = Math.min(kx, ky);
  return Number.isFinite(kPair) ? Math.max(kPair, K_MIN) : K_MIN;
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
