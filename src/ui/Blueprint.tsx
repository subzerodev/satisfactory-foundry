import { Fragment, useMemo } from "react";
import type { StageSolveResult, LaneKind } from "../core/manifold.ts";
import { layoutStage } from "../layout/layout.ts";
import type { LaneLayout, BeltMark } from "../layout/layout.ts";
import { FOOTPRINTS } from "../layout/footprints.ts";
import { formatRate } from "./format.ts";
import { ZoomToggle, useReadableScale } from "./blueprint-zoom.tsx";

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
  // empty-state line instead. The notice CAN still fire here (an unknown
  // machineId emits its finding even at count 0), so it renders above.
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

  // Explicit dm→px scale (Axis 2 + P3 Axis C2): the shared floor replaces
  // width="100%"+meet. At DETAIL the plan opens at natural 1 px/dm (readable);
  // at FIT the P1 fit/floor scale (its height term is min(h,cap)/h — so sub-cap
  // plans keep natural size). A wide 161-machine row exceeds 960 and scrolls in
  // .bp-scroll. The toggle mounts only for floored plans (fit < 1).
  const { scale, atDetail, showToggle, mode, setMode } = useReadableScale(
    w,
    h,
    MAX_SVG_HEIGHT,
  );

  // Gutter labels (P3 Axis C1) — one per named lane, positioned at the lane's
  // rendered y. viewBox minY is NEGATIVE for real stages (the smelter's is
  // −100), so a bare laneY×scale would misplace every label; the (laneY − minY)
  // term maps world-dm to gutter-px. Rendered ONLY at DETAIL — at FIT adjacent
  // lanes sit sub-pixel apart, so names are DETAIL's job and the gutter
  // collapses. Blueprint-ONLY (ChainBlueprint has no lanes to gutter).
  const gutterLabels = [
    ...layout.feedLanes.map((lane, i) => ({
      key: `fg-${lane.itemId}-${i}`,
      text: feedLabels[i] ?? lane.itemId,
      top: (lane.bus.from.y - minY) * scale,
    })),
    ...layout.outputLanes.map((lane, j) => ({
      key: `og-${lane.itemId}-${j}`,
      text: outputLabels[j] ?? lane.itemId,
      top: (lane.bus.from.y - minY) * scale,
    })),
  ];

  return (
    <div className="bp-view">
      {notice}
      {showToggle && <ZoomToggle mode={mode} setMode={setMode} />}
      {/* Flex row: an HTML gutter column LEFT of and OUTSIDE .bp-scroll, so
          vertical pan (page scroll) carries the in-flow gutter with the svg;
          only horizontal pan happens inside .bp-scroll. */}
      <div className="bp-row">
        {/* The gutter renders labels only at DETAIL; at FIT it is empty and
            collapses to zero width (max-content sizing, no padding/border). */}
        <div className="bp-gutter">
          {atDetail &&
            gutterLabels.map((g) => (
              <span
                key={g.key}
                className="bp-gutter-label"
                style={{ top: `${g.top}px` }}
              >
                {g.text}
              </span>
            ))}
        </div>
        <div className="bp-scroll">
          <svg
            className="bp-svg"
            viewBox={viewBox}
            width={w * scale}
            height={h * scale}
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
                kind={solve.feeds[i]!.kind}
              />
            ))}
            {layout.outputLanes.map((lane, j) => (
              <BusAndJunctions
                key={`ob-${lane.itemId}-${j}`}
                lane={lane}
                kind={solve.outputs[j]!.kind}
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
            in front of the machines, with their rate labels. The lane-NAME text
            left the SVG for the HTML gutter (P3 Axis C1); marks stay. */}
            {layout.feedLanes.map((lane, i) => (
              <Marks key={`fm-${lane.itemId}-${i}`} lane={lane} side="feed" />
            ))}
            {layout.outputLanes.map((lane, j) => (
              <Marks key={`om-${lane.itemId}-${j}`} lane={lane} side="output" />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}

/** The bus ribbon + its label + junction rects (z2/z3 — behind the machines).
 *  `kind` classes the bus ribbon so a pipe lane reads distinctly (Stage 5 item
 *  4, `.bp-bus-pipe`). This is a DELIBERATE, NARROW exception to the frozen S4P2
 *  pin "Blueprint … never re-reads kind (its only use of solve is as the
 *  layoutStage input)" (features/physical-layout/phase-2/brainstorm.md, Axis 2
 *  lane-labels bullet) — cited-and-superseded per features/polish/brainstorm.md
 *  item 4. The kind is read for the CLASS ONLY; label-string ownership stays
 *  with App. */
function BusAndJunctions({ lane, kind }: { lane: LaneLayout; kind: LaneKind }) {
  const busY = lane.bus.from.y;
  return (
    <g className="bp-lane">
      <rect
        className={kind === "pipe" ? "bp-bus bp-bus-pipe" : "bp-bus"}
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

/** Belt marks + rate labels (z5 — in front of the machines). The lane NAME now
 *  lives in the HTML gutter (P3 Axis C1), not in the SVG. */
function Marks({ lane, side }: { lane: LaneLayout; side: "feed" | "output" }) {
  return (
    <g className="bp-marks">
      {lane.marks.map((mk: BeltMark) => (
        <Fragment key={`mk-${mk.index}`}>
          <circle className="bp-mark-glyph" cx={mk.at.x} cy={mk.at.y} r={8} />
          <text className="bp-mark-label" x={mk.at.x + 12} y={mk.at.y + 4}>
            {side === "output" && mk.load !== undefined
              ? `${formatRate(mk.capacity)}/min (${formatRate(mk.load)}/min load)`
              : `${formatRate(mk.capacity)}/min`}
          </text>
        </Fragment>
      ))}
    </g>
  );
}
