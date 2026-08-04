import { useMemo } from "react";
import type { StageSolveResult } from "../core/manifold.ts";
import { layoutStage } from "../layout/layout.ts";
import type { LaneLayout, BeltMark } from "../layout/layout.ts";
import { FOOTPRINTS } from "../layout/footprints.ts";
import { formatRate } from "./format.ts";

/**
 * The blueprint view: a top-down, in-game-scale floor plan of one solved stage,
 * the Schematic's sibling leaf. It renders StageLayout geometry verbatim — no
 * geometry math beyond unit scaling at the SVG boundary (the thin-UI pin).
 *
 * ZERO store imports: App composes every value this needs (machineId,
 * machineCount, the two label arrays) and mounts <Blueprint> only for the
 * blueprint view, so the useMemo below is never a conditional hook — a hidden
 * blueprint is UNMOUNTED, not a skipped recompute.
 */
interface BlueprintProps {
  solve: StageSolveResult;
  machineId: string;
  machineCount: number;
  /** Complete label strings, index-aligned to solve.feeds (App bakes them). */
  feedLabels: string[];
  /** Complete label strings, index-aligned to solve.outputs (App bakes them). */
  outputLabels: string[];
}

/**
 * Render conventions the frozen P1/P2 spec pins (Axis 2). The layout module
 * owns these same integers privately; Blueprint restates them locally rather
 * than reach into src/layout (the module exports neither, and P2 must not widen
 * its contract). Comments cite the pin so drift is caught if either moves.
 */
/** Foundation tile edge — 8 m (matches layout.ts FOUNDATION_TILE). */
const FOUNDATION_TILE = 80;
/** Belt bus visual width — a stated RENDER convention (P1); belts have no
 *  gameplay footprint, so the bus is drawn as a 20 dm ribbon on its centre line. */
const BELT_LANE = 20;
/** SVG padding around the foundation bbox (Axis 2: origin − 20 dm, extent + 40 dm). */
const PAD = 20;

/** Height cap so a very deep stage (e.g. a Refinery row) never runs off-screen. */
const MAX_SVG_HEIGHT = 520;

export function Blueprint({
  solve,
  machineId,
  machineCount,
  feedLabels,
  outputLabels,
}: BlueprintProps) {
  const layout = useMemo(
    () => layoutStage(solve, machineId, machineCount, FOOTPRINTS),
    [solve, machineId, machineCount],
  );

  const unknown = layout.findings.find((f) => f.type === "unknown-footprint");
  const notice =
    unknown !== undefined ? (
      <p className="bp-notice">
        footprint unknown for {unknown.machineId} — drawn as 10×10 m
      </p>
    ) : null;

  // Zero-machine stage (P1 pinned empty shape): no foundations, no SVG — an
  // empty-state line instead. The notice can never fire here (still surfaced
  // above for symmetry, though an empty stage carries no findings).
  if (layout.machines.length === 0) {
    return (
      <div className="bp-view">
        {notice}
        <p className="empty-state">
          No machines to lay out — set a machine count.
        </p>
      </div>
    );
  }

  // viewBox IS decimeters (Axis 2): the SVG scales dm→px itself, so no unit
  // conversion anywhere. Extents come from the layout's own foundation bbox.
  const { origin, cols, rows } = layout.foundations;
  const minX = origin.x - PAD;
  const minY = origin.y - PAD;
  const w = cols * FOUNDATION_TILE + 2 * PAD;
  const h = rows * FOUNDATION_TILE + 2 * PAD;
  const viewBox = `${minX} ${minY} ${w} ${h}`;

  // Cap the on-screen height (dm→px) so tall floor plans stay in view; width is
  // fluid at 100% and preserveAspectRatio keeps the plan undistorted.
  const svgHeight = Math.min(h, MAX_SVG_HEIGHT);

  return (
    <div className="bp-view">
      {notice}
      <svg
        className="bp-svg"
        viewBox={viewBox}
        width="100%"
        height={svgHeight}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* z1 — foundation tiles: the cols×rows 8 m grid under everything. */}
        <g className="bp-foundations">
          {Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => (
              <rect
                key={`f-${r}-${c}`}
                className="bp-foundation"
                x={origin.x + c * FOUNDATION_TILE}
                y={origin.y + r * FOUNDATION_TILE}
                width={FOUNDATION_TILE}
                height={FOUNDATION_TILE}
              />
            )),
          )}
        </g>
        {/* z2/z3 — lane buses + junction rects, behind the machines. The spec's
            load-bearing pin is the z-ORDER (bus → junction → machine → mark), so
            a lane's bus/junctions and its marks are split into two passes: these
            draw under the machine row, the marks (below) draw over it. */}
        {layout.feedLanes.map((lane, i) => (
          <BusAndJunctions
            key={`fb-${lane.itemId}-${i}`}
            lane={lane}
            side="feed"
          />
        ))}
        {layout.outputLanes.map((lane, j) => (
          <BusAndJunctions
            key={`ob-${lane.itemId}-${j}`}
            lane={lane}
            side="output"
          />
        ))}
        {/* z4 — machine rects + index labels. */}
        <g className="bp-machines">
          {layout.machines.map((m, i) => (
            <g key={`m-${i}`} className="bp-machine">
              <rect x={m.x} y={m.y} width={m.w} height={m.h} />
              <text
                className="bp-machine-label"
                x={m.x + m.w / 2}
                y={m.y + m.h / 2}
              >
                {i}
              </text>
            </g>
          ))}
        </g>
        {/* z5 — belt marks (drop glyphs for feed, breakout glyphs for output),
            in front of the machines, with their rate labels. */}
        {layout.feedLanes.map((lane, i) => (
          <Marks
            key={`fm-${lane.itemId}-${i}`}
            lane={lane}
            label={feedLabels[i] ?? lane.itemId}
            side="feed"
          />
        ))}
        {layout.outputLanes.map((lane, j) => (
          <Marks
            key={`om-${lane.itemId}-${j}`}
            lane={lane}
            label={outputLabels[j] ?? lane.itemId}
            side="output"
          />
        ))}
      </svg>
    </div>
  );
}

/** The bus ribbon + its label + junction rects (z2/z3 — behind the machines). */
function BusAndJunctions({
  lane,
  side,
}: {
  lane: LaneLayout;
  side: "feed" | "output";
}) {
  const busY = lane.bus.from.y;
  return (
    <g className={`bp-lane bp-lane-${side}`} data-item={lane.itemId}>
      <rect
        className="bp-bus"
        x={lane.bus.from.x}
        y={busY - BELT_LANE / 2}
        width={lane.bus.to.x - lane.bus.from.x}
        height={BELT_LANE}
      />
      {lane.junctions.map((j, i) => (
        <rect
          key={`j-${i}`}
          className="bp-junction"
          x={j.x}
          y={j.y}
          width={j.w}
          height={j.h}
        />
      ))}
    </g>
  );
}

/** Belt marks + rate labels + the lane name (z5 — in front of the machines). */
function Marks({
  lane,
  label,
  side,
}: {
  lane: LaneLayout;
  label: string;
  side: "feed" | "output";
}) {
  const busY = lane.bus.from.y;
  return (
    <g className={`bp-marks bp-marks-${side}`} data-item={lane.itemId}>
      <text
        className="bp-lane-name"
        x={lane.bus.from.x + 4}
        y={side === "feed" ? busY - BELT_LANE : busY + BELT_LANE + 8}
      >
        {label}
      </text>
      {lane.marks.map((mk: BeltMark) => (
        <g key={`mk-${mk.index}`} className="bp-mark">
          <circle className="bp-mark-glyph" cx={mk.at.x} cy={mk.at.y} r={8} />
          <text className="bp-mark-label" x={mk.at.x + 12} y={mk.at.y + 4}>
            {side === "output" && mk.load !== undefined
              ? `${formatRate(mk.capacity)}/min (${formatRate(mk.load)}/min load)`
              : `${formatRate(mk.capacity)}/min`}
          </text>
        </g>
      ))}
    </g>
  );
}
