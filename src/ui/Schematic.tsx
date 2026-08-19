import { useMemo, useRef, useState } from "react";
import { Fraction } from "../core/fraction.ts";
import type {
  StageSolveResult,
  LaneKind,
  Finding,
  FeedBelt,
  BreakoutBelt,
} from "../core/manifold.ts";
import type { TierTable } from "../data/types.ts";
import { computeLayout, LAYOUT } from "./layout.ts";
import type { LaneTrack, SchematicLayout } from "./layout.ts";
import {
  beltLabel,
  feedGroupLabel,
  formatRate,
  segTooltip,
  pipeConnectorTooltip,
} from "./format.ts";
import { colorForCapacity, ERROR_COLOR } from "./colors.ts";
import {
  feedCountToken,
  groupCoincidentMarks,
  placeGroupTokens,
} from "./coincident-feed-marks.ts";

interface SchematicProps {
  result: StageSolveResult;
  machineCount: number;
  tiers: TierTable;
  unlocked: { belt: number; pipe: number };
  itemName(id: string): string;
}

/** Live tooltip state: the hovered element's text + cursor-anchored position,
 *  or null when nothing is hovered. Component-local (Stage 5 item 1) — a pure
 *  presentation concern, meaningless headless, so no store field. */
interface TooltipState {
  text: string;
  x: number;
  y: number;
  maxWidth: number;
}

/** Tooltip offset from the cursor (px), and the clamp margin from the container
 *  edges so a tooltip near the right/bottom edge doesn't overflow. */
const TIP_OFFSET = 12;
const TIP_CLAMP = 8;
const TIP_MAX_WIDTH = 280;

/**
 * Feed-ribbon half-height bounds (P2 D1). The trapezoid is centred on busY;
 * each half-height ∝ the flow it represents, on a single per-lane scale
 * (busCapacity) so equal thickness = equal flow across stretches. RIBBON_MIN
 * keeps a zero-flow hand-off a hairline point, not a gap.
 */
const RIBBON_MAX = 9;
const RIBBON_MIN = 1;
/** Feed-lane seam-tick half-extent grows with the ribbon (RIBBON_MAX + 2);
 *  output seams stay ±6 — the #76 output name baseline is load-bearing on that
 *  extent (D1). */
const FEED_SEAM_HALF = RIBBON_MAX + 2;
const OUTPUT_SEAM_HALF = 6;
/** Endpoint-label baseline sits one row ABOVE the ribbon (D2); the two numbers
 *  share it, kept apart by opposite anchoring at a seam. */
const ENDPOINT_DY = RIBBON_MAX + 4;
/** Per-glyph width estimate for the 10px mono endpoint numbers (D2 thinning). A
 *  stretch drops its hand-off label when it cannot hold BOTH the (start-anchored)
 *  entry glyphs extending right and the (end-anchored) hand-off glyphs extending
 *  left, plus a small gap — estimated, since jsdom has no text metrics. The
 *  worst-case sum is ~60px (the spec's ceiling); at 8411's ~50px stretches the
 *  short "780"/"60" glyph pairs fit and nothing thins. */
const ENDPOINT_GLYPH_PX = 6;
const ENDPOINT_GAP_PX = 6;

/** True when a stretch is too narrow to hold both its entry and hand-off glyphs
 *  (the hand-off drops — entry wins, it carries the reset). */
function endpointsCollide(
  stretchWidth: number,
  entryText: string,
  handoffText: string,
): boolean {
  const entryPx = entryText.length * ENDPOINT_GLYPH_PX;
  const handoffPx = handoffText.length * ENDPOINT_GLYPH_PX;
  // Both anchors inset 3px from their edges; between them must fit both glyph
  // runs plus a gap, else they overlap.
  return stretchWidth - 6 < entryPx + handoffPx + ENDPOINT_GAP_PX;
}
/** When a rendered feed-group-count token sits on a boundary within this many px
 *  of an endpoint label's own anchor, they collide (D2 two-sided rule). */
const TOKEN_COLLISION_PX = 1;
/** The entry label's start-x pushes this far right past a colliding group token
 *  (D2 right-candidate rule). */
const ENTRY_PUSH_PX = 20;

/**
 * Feed-ribbon half-height for a flow on a lane whose bus capacity is `busCap`
 * (P2 D1). The ratio is computed as a JS number (display-only; rendered
 * geometry, exactness stays in core — the layout header's convention). `min(1,
 * ·)` clamps an over-B overridden stretch at full thickness (its error state is
 * carried by seg-error + the finding). busCap is a tier capacity, never zero.
 */
function halfPx(flow: Fraction, busCap: Fraction): number {
  const ratio =
    Number(flow.toDecimalString(6)) / Number(busCap.toDecimalString(6));
  return RIBBON_MIN + (RIBBON_MAX - RIBBON_MIN) * Math.min(1, ratio);
}

const ZERO_HANDOFF = Fraction.from(0);

/**
 * A segment is in error when a finding implicates it: `segment-over-capacity`
 * by span equality, `starved-machines` by containment of the starved machine(s)
 * within the segment span, and (D4) `lane-undersupplied` LANE-SCOPED — a pipe
 * manifold's under-supply is unordered by design, so it errors the whole
 * connector, not one span. The panel lists the same findings textually — both
 * read findings, neither recomputes.
 */
function segmentErrored(
  findings: Finding[],
  from: number,
  to: number,
): boolean {
  return findings.some((f) => {
    if (f.type === "segment-over-capacity") {
      return f.fromMachine === from && f.toMachine === to;
    }
    if (f.type === "starved-machines") {
      const marks: number[] = [];
      if (f.partial !== undefined) marks.push(f.partial.machine);
      if (f.starvedFrom !== undefined) marks.push(f.starvedFrom);
      if (f.starvedTo !== undefined) marks.push(f.starvedTo);
      return marks.some((m) => m >= from && m <= to);
    }
    // Lane-scoped: any span (and the pipe connector, which passes the whole lane
    // span) reads errored when the lane is under-supplied.
    if (f.type === "lane-undersupplied") {
      return true;
    }
    return false;
  });
}

/** One lane's SVG group: bus segments, seams, entry/break-out arrows.
 *  `onTip`/`offTip` wire each hoverable line into the schematic-level tooltip;
 *  `<title>` markup is gone (Stage 5 item 1) — the tooltip text is carried by
 *  onMouseEnter/Move and cleared onMouseLeave. */
function LaneG({
  track,
  kind,
  findings,
  belts,
  side,
  busCapacity,
  laneDemand,
  tiers,
  itemName,
  machineTopY,
  laneStart,
  laneEnd,
  onTip,
  onFocusTip,
  offTip,
}: {
  track: LaneTrack;
  kind: LaneKind;
  findings: Finding[];
  belts: (FeedBelt | BreakoutBelt)[];
  side: "feed" | "output";
  busCapacity: FeedBelt["capacity"];
  /** The lane's total demand D (D4 pipe-connector tooltip; feed lanes only). */
  laneDemand: Fraction;
  tiers: TierTable;
  itemName: (id: string) => string;
  machineTopY: number;
  laneStart: number;
  laneEnd: number;
  onTip: (text: string, e: React.MouseEvent) => void;
  onFocusTip: (text: string, e: React.FocusEvent<SVGGElement>) => void;
  offTip: () => void;
}) {
  // Pipe lanes read a distinct desaturated-blue dashed treatment (Stage 5 item
  // 4); belt lanes keep the plain track. Schematic already knows the lane kind.
  const pipeClass = kind === "pipe" ? " lane-pipe" : "";
  const busCapString = formatRate(busCapacity);
  const feedGroups =
    side === "feed"
      ? groupCoincidentMarks(track.belts, (arrow) => arrow.x)
      : [];
  const tokenPlacements = placeGroupTokens(feedGroups, laneStart, laneEnd);
  // Which boundary each rendered group token sits on, split by the candidate it
  // took (D2 two-sided collision). A token at `coordinate + TOKEN_GAP` is on the
  // RIGHT of its boundary (glyphs extend right — it collides with a start-
  // anchored ENTRY label at that boundary); a token at `coordinate − TOKEN_GAP −
  // TOKEN_WIDTH` is on the LEFT (glyphs extend left — it collides with an end-
  // anchored HAND-OFF label at that boundary). The placement map keys by the
  // group coordinate, so the side is recovered by which candidate the value is.
  const rightTokenBoundaries: number[] = [];
  const leftTokenBoundaries: number[] = [];
  for (const [coordinate, placement] of tokenPlacements) {
    if (placement > coordinate) rightTokenBoundaries.push(coordinate);
    else leftTokenBoundaries.push(coordinate);
  }
  const feedLast = track.segments.length - 1;
  return (
    <g className={`lane lane-${side}`} data-item={track.itemId}>
      {/* Output lane names sit BELOW their bus (#76): the output bus is at
          track.y + 8, so the old track.y + 12 baseline put the name's bbox
          across the purple lane stroke (Michael's "Cable on the lane" garble).
          The lifted busY + 18 baseline (= track.y + 26) clears the bus + its
          seams (busY ± 6) while staying inside the 56px row. Feed lanes keep
          track.y + 12 — their bus is far below (track.y + 48), 36px clear. */}
      <text
        className="lane-name"
        x={4}
        y={side === "output" ? track.busY + 18 : track.y + 12}
      >
        {itemName(track.itemId)}
      </text>
      {track.segments.map((seg, i) => {
        const belt = belts[seg.beltIndex]!;
        const errored = segmentErrored(
          findings,
          seg.fromMachine,
          seg.toMachine,
        );
        const stroke = errored
          ? ERROR_COLOR
          : colorForCapacity(kind, belt.capacity, tiers);
        const terminal = side === "feed" && i === feedLast;
        const tip = segTooltip(seg, busCapString, side, terminal);
        if (side === "feed") {
          // D1: the trapezoid ribbon. Left half-height ∝ entryFlow (the reset);
          // right half-height ∝ the flow CARRIED ONWARD — handoffResidue for an
          // interior stretch, ZERO on the terminal one (caveat 1: terminal
          // surplus is NOT onward flow, so the ribbon tapers to RIBBON_MIN and
          // the surplus surfaces only in the tooltip / spare card).
          const leftHalf = halfPx(seg.entryFlow, busCapacity);
          const rightFlow = terminal ? undefined : seg.handoffResidue;
          const rightHalf =
            rightFlow === undefined
              ? RIBBON_MIN
              : halfPx(rightFlow, busCapacity);
          const points = [
            `${seg.x1},${track.busY - leftHalf}`,
            `${seg.x2},${track.busY - rightHalf}`,
            `${seg.x2},${track.busY + rightHalf}`,
            `${seg.x1},${track.busY + leftHalf}`,
          ].join(" ");
          return (
            <polygon
              key={`seg-${seg.beltIndex}`}
              className={`bus-seg${errored ? " seg-error" : ""}${pipeClass}`}
              points={points}
              fill={stroke}
              stroke={stroke}
              onMouseEnter={(e) => onTip(tip, e)}
              onMouseMove={(e) => onTip(tip, e)}
              onMouseLeave={offTip}
            />
          );
        }
        // Output stretches keep the constant-width line: a break-out belt's load
        // is flat along its span, so a taper would be false there (D1).
        return (
          <line
            key={`seg-${seg.beltIndex}`}
            className={`bus-seg${errored ? " seg-error" : ""}${pipeClass}`}
            x1={seg.x1}
            x2={seg.x2}
            y1={track.busY}
            y2={track.busY}
            stroke={stroke}
            onMouseEnter={(e) => onTip(tip, e)}
            onMouseMove={(e) => onTip(tip, e)}
            onMouseLeave={offTip}
          />
        );
      })}
      {track.seams.map((x, i) => {
        // Feed seam ticks grow with the ribbon (±11); output seams stay ±6 (the
        // #76 output name baseline is load-bearing on that extent, D1).
        const half = side === "feed" ? FEED_SEAM_HALF : OUTPUT_SEAM_HALF;
        return (
          <line
            key={`seam-${i}`}
            className="seam"
            x1={x}
            x2={x}
            y1={track.busY - half}
            y2={track.busY + half}
          />
        );
      })}
      {/* D2: endpoint numbers — one baseline ABOVE the ribbon per feed stretch.
          Entry (start-anchored at x1+3, glyphs extend right into its own
          stretch); hand-off (end-anchored at x2−3, glyphs extend left) only when
          residue > 0 AND the stretch is not terminal; the terminal stretch
          always renders onward "0" end-anchored at its end. */}
      {side === "feed" &&
        track.segments.map((seg, i) => {
          const terminal = i === feedLast;
          const baselineY = track.busY - ENDPOINT_DY;
          // Entry: a rendered token on the RIGHT of this stretch's entry
          // boundary pushes the start-x right past it (its glyphs would collide).
          const entryCollision = rightTokenBoundaries.some(
            (b) => Math.abs(b - seg.x1) <= TOKEN_COLLISION_PX,
          );
          const entryX = seg.x1 + 3 + (entryCollision ? ENTRY_PUSH_PX : 0);
          const entry = (
            <text
              key={`endpoint-entry-${seg.beltIndex}`}
              className="ribbon-endpoint"
              x={entryX}
              y={baselineY}
              textAnchor="start"
            >
              {formatRate(seg.entryFlow)}
            </text>
          );
          if (terminal) {
            // The terminal stretch always renders onward "0" end-anchored at the
            // lane end (caveat 1 — flow-conserving, never the surplus).
            return (
              <g key={`endpoint-${seg.beltIndex}`}>
                {entry}
                <text
                  className="ribbon-endpoint"
                  x={seg.x2 - 3}
                  y={baselineY}
                  textAnchor="end"
                >
                  0
                </text>
              </g>
            );
          }
          // Hand-off: only when residue > 0. Dropped when the stretch is too
          // narrow for both glyphs (entry wins — it carries the reset), or when a
          // rendered group token takes the LEFT candidate at this stretch's end
          // boundary (pushing an end-anchored label left would detach it from its
          // endpoint; the segment tooltip keeps the hand-off findable).
          const handoffText = formatRate(seg.handoffResidue);
          const narrow = endpointsCollide(
            seg.x2 - seg.x1,
            formatRate(seg.entryFlow),
            handoffText,
          );
          const leftTokenBlocks = leftTokenBoundaries.some(
            (b) => Math.abs(b - seg.x2) <= TOKEN_COLLISION_PX,
          );
          const showHandoff =
            seg.handoffResidue.gt(ZERO_HANDOFF) && !narrow && !leftTokenBlocks;
          return (
            <g key={`endpoint-${seg.beltIndex}`}>
              {entry}
              {showHandoff && (
                <text
                  className="ribbon-endpoint"
                  x={seg.x2 - 3}
                  y={baselineY}
                  textAnchor="end"
                >
                  {handoffText}
                </text>
              )}
            </g>
          );
        })}
      {/* D4: pipe feed lanes draw a single neutral dashed connector spanning the
          runs — no taper, no endpoint numbers, no per-machine claims (pipe
          honesty is Level 1). It errors as a whole when the lane is
          under-supplied (segmentErrored's lane-scoped variant). */}
      {side === "feed" && kind === "pipe" && track.belts.length > 0 && (
        <PipeConnector
          track={track}
          laneStart={laneStart}
          laneEnd={laneEnd}
          errored={findings.some((f) => f.type === "lane-undersupplied")}
          demand={laneDemand}
          supplied={belts.reduce(
            (sum, belt) => sum.add(belt.capacity),
            ZERO_HANDOFF,
          )}
          onTip={onTip}
          offTip={offTip}
        />
      )}
      {side === "feed"
        ? feedGroups.map((group) => {
            if (group.members.length === 1) {
              const arrow = group.members[0]!;
              const belt = belts[arrow.index]!;
              const tip = beltLabel(side, arrow.index, belt, kind, tiers);
              return (
                <line
                  key={`belt-${arrow.index}`}
                  className={`belt-arrow${pipeClass}`}
                  data-feed-index={arrow.index}
                  x1={arrow.x}
                  x2={arrow.x}
                  y1={track.y + 16}
                  y2={track.busY}
                  stroke={colorForCapacity(kind, belt.capacity, tiers)}
                  onMouseEnter={(e) => onTip(tip, e)}
                  onMouseMove={(e) => onTip(tip, e)}
                  onMouseLeave={offTip}
                />
              );
            }
            const feedBelts = group.members.map(
              (arrow) => belts[arrow.index] as FeedBelt,
            );
            const tip = feedGroupLabel(feedBelts);
            const placement = tokenPlacements.get(group.coordinate);
            return (
              <g
                key={`feed-group-${feedBelts[0]!.index}`}
                className="feed-mark-group"
                data-feed-indices={feedBelts
                  .map((belt) => belt.index)
                  .join(",")}
                role="img"
                tabIndex={0}
                aria-label={tip}
                onMouseEnter={(e) => onTip(tip, e)}
                onMouseMove={(e) => onTip(tip, e)}
                onMouseLeave={offTip}
                onFocus={(e) => onFocusTip(tip, e)}
                onBlur={offTip}
              >
                <line
                  className={`feed-group-stem${pipeClass}`}
                  x1={group.coordinate - 2}
                  x2={group.coordinate - 2}
                  y1={track.y + 16}
                  y2={track.busY}
                />
                <line
                  className={`feed-group-stem${pipeClass}`}
                  x1={group.coordinate + 2}
                  x2={group.coordinate + 2}
                  y1={track.y + 16}
                  y2={track.busY}
                />
                {placement !== undefined && (
                  <text
                    className="feed-group-count"
                    x={placement}
                    y={track.y + 29}
                  >
                    {feedCountToken(feedBelts.length)}
                  </text>
                )}
              </g>
            );
          })
        : track.belts.map((arrow) => {
            const belt = belts[arrow.index]!;
            const tip = beltLabel(side, arrow.index, belt, kind, tiers);
            return (
              <line
                key={`belt-${arrow.index}`}
                className={`belt-arrow${pipeClass}`}
                x1={arrow.x}
                x2={arrow.x}
                y1={machineTopY}
                y2={track.busY}
                stroke={colorForCapacity(kind, belt.capacity, tiers)}
                onMouseEnter={(e) => onTip(tip, e)}
                onMouseMove={(e) => onTip(tip, e)}
                onMouseLeave={offTip}
              />
            );
          })}
    </g>
  );
}

/**
 * The pipe feed lane's connector (P2 D4): ONE uniform 2px dashed line spanning
 * the lane's runs, carrying the nominal-ceiling honesty tooltip and NO ordered-
 * flow geometry (no taper, no endpoint numbers). It errors as a whole when the
 * lane is under-supplied — the finding is lane-scoped, unordered by design. The
 * span is from the first run's x to the lane end (the runs' extent); the class
 * composes `pipe-manifold` with the existing `lane-pipe` dashed treatment.
 */
function PipeConnector({
  track,
  laneStart,
  laneEnd,
  errored,
  demand,
  supplied,
  onTip,
  offTip,
}: {
  track: LaneTrack;
  laneStart: number;
  laneEnd: number;
  errored: boolean;
  demand: Fraction;
  supplied: Fraction;
  onTip: (text: string, e: React.MouseEvent) => void;
  offTip: () => void;
}) {
  // Span the machine row's extent (a manifold pressures the whole row) — from
  // the leftmost run entry to the lane end. Runs commonly enter at the head, so
  // the run xs alone would collapse; the row span reads as the unordered group.
  const x1 = Math.min(laneStart, ...track.belts.map((b) => b.x));
  const x2 = laneEnd;
  const tip = pipeConnectorTooltip(demand, supplied);
  return (
    <line
      className={`pipe-manifold lane-pipe${errored ? " seg-error" : ""}`}
      x1={x1}
      x2={x2}
      y1={track.busY}
      y2={track.busY}
      stroke={errored ? ERROR_COLOR : undefined}
      onMouseEnter={(e) => onTip(tip, e)}
      onMouseMove={(e) => onTip(tip, e)}
      onMouseLeave={offTip}
    />
  );
}

/**
 * The level-of-detail machine band (Stage 12 P1 Axis 1). Above N=114 the pitch
 * floors to 6px ticks that read as dash-noise, so a real drawing draws a break
 * convention + a count instead of 161 identical ticks: ONE continuous band rect
 * spanning the machine row, a centered `×N` in the display face, and individual
 * boundary ticks + index labels kept ONLY at the significant machines (feed
 * entries, output breakouts, segment bounds, finding-referenced machines — the
 * complete set the textual layer can name). Everything else is elided by the
 * break convention.
 */
function MachineBand({
  machines,
  significant,
  labeledSignificant,
  pitch,
  top,
}: {
  machines: SchematicLayout["machines"];
  significant: number[];
  labeledSignificant: number[];
  pitch: number;
  top: number;
}) {
  const first = machines[0]!;
  const last = machines[machines.length - 1]!;
  const bandX = first.x;
  // The row spans every machine's footprint: last machine's left edge + its own
  // (pitch − 2) rect width, mirroring the per-tick rendering it replaces.
  const bandW = last.x + Math.max(pitch - 2, 1) - bandX;
  const marks = new Set(significant);
  // Every significant index keeps its tick; only the thinned subset carries a
  // label (labels crowd at the band's 8px pitch, ticks do not).
  const labeled = new Set(labeledSignificant);
  const xOf = (index: number) => machines[index - 1]!.x;
  return (
    <g className="machine-band">
      <rect x={bandX} y={top} width={bandW} height={40} />
      <text className="machine-band-count" x={bandX + bandW / 2} y={top + 24}>
        ×{machines.length}
      </text>
      {[...marks]
        .sort((a, b) => a - b)
        .map((index) => (
          <g key={`sig-${index}`} className="machine-band-mark">
            {/* A boundary tick at every significant machine's left edge; the
                index label only when it survives thinning, so referenced
                machines stay locatable without the labels colliding. */}
            <line x1={xOf(index)} x2={xOf(index)} y1={top} y2={top + 40} />
            {labeled.has(index) ? (
              // Center the label under the cell (#86), same as non-band mode; the
              // boundary tick above stays at xOf(index). A constant +pitch/2 shift
              // preserves every label-to-label distance, so the S15 thinning
              // spacing guarantee (≥3-index / 24px) is unaffected.
              <text
                className="machine-label"
                x={xOf(index) + pitch / 2}
                y={top + 52}
              >
                {index}
              </text>
            ) : null}
          </g>
        ))}
    </g>
  );
}

export function Schematic({
  result,
  machineCount,
  tiers,
  unlocked,
  itemName,
}: SchematicProps) {
  const layout = useMemo(
    () => computeLayout(result, machineCount),
    [result, machineCount],
  );

  const machineTopY = layout.machineTop;

  // Component-local hover/focus tooltip (Stage 5 item 1): replaces native SVG
  // <title> tooltips. The div is positioned from the mouse event, clamped to
  // the container box so an edge-hovered segment's tip stays visible.
  const containerRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TooltipState | null>(null);

  const horizontalTipPlacement = (
    container: HTMLDivElement,
    anchorClientX: number,
  ): { x: number; maxWidth: number } => {
    const box = container.getBoundingClientRect();
    const maxWidth = Math.min(
      TIP_MAX_WIDTH,
      Math.max(0, box.width - 2 * TIP_CLAMP),
    );
    const minX = container.scrollLeft + TIP_CLAMP;
    const maxX = container.scrollLeft + box.width - TIP_CLAMP - maxWidth;
    const anchoredX =
      anchorClientX - box.left + container.scrollLeft + TIP_OFFSET;
    return { x: Math.max(minX, Math.min(anchoredX, maxX)), maxWidth };
  };

  const showTip = (text: string, e: React.MouseEvent) => {
    const container = containerRef.current;
    if (container === null) return;
    const box = container.getBoundingClientRect();
    const { x, maxWidth } = horizontalTipPlacement(container, e.clientX);
    const y = Math.min(
      e.clientY - box.top + TIP_OFFSET,
      box.height - TIP_CLAMP,
    );
    setTip({ text, x, y, maxWidth });
  };
  const showFocusTip = (text: string, e: React.FocusEvent<SVGGElement>) => {
    const container = containerRef.current;
    if (container === null) return;
    const containerBox = container.getBoundingClientRect();
    const glyphBox = e.currentTarget.getBoundingClientRect();
    const { x, maxWidth } = horizontalTipPlacement(container, glyphBox.right);
    const y = Math.min(
      glyphBox.top - containerBox.top + TIP_OFFSET,
      containerBox.height - TIP_CLAMP,
    );
    setTip({ text, x, y, maxWidth });
  };
  const hideTip = () => setTip(null);

  return (
    <div
      ref={containerRef}
      className={layout.scrolled ? "schematic-scroll" : "schematic"}
    >
      <svg
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
      >
        {result.feeds.map((lane, i) => {
          const busCap = tiers[lane.kind][unlocked[lane.kind] - 1]!;
          return (
            <LaneG
              key={`feed-${lane.itemId}-${i}`}
              track={layout.feeds[i]!}
              kind={lane.kind}
              findings={lane.findings}
              belts={lane.belts}
              side="feed"
              busCapacity={busCap}
              laneDemand={lane.totalDemand}
              tiers={tiers}
              itemName={itemName}
              machineTopY={machineTopY}
              laneStart={LAYOUT.marginX}
              laneEnd={layout.width - LAYOUT.marginX}
              onTip={showTip}
              onFocusTip={showFocusTip}
              offTip={hideTip}
            />
          );
        })}
        {layout.band ? (
          <MachineBand
            machines={layout.machines}
            significant={layout.significant}
            labeledSignificant={layout.labeledSignificant}
            pitch={layout.pitch}
            top={machineTopY}
          />
        ) : (
          layout.machines.map((m) => (
            <g key={`m-${m.index}`} className="machine">
              <rect
                x={m.x}
                y={machineTopY}
                width={Math.max(layout.pitch - 2, 1)}
                height={40}
              />
              {m.labeled && (
                <text
                  className="machine-label"
                  x={m.x + layout.pitch / 2}
                  y={machineTopY + 52}
                >
                  {/* Center the number UNDER the machine cell (#86): the label
                      names the machine, not the boundary. m.x is the cell's left
                      edge; +pitch/2 puts it mid-cell. Ticks stay on boundaries. */}
                  {m.index}
                </text>
              )}
            </g>
          ))
        )}
        {result.outputs.map((lane, j) => {
          const busCap = tiers[lane.kind][unlocked[lane.kind] - 1]!;
          return (
            <LaneG
              key={`out-${lane.itemId}-${j}`}
              track={layout.outputs[j]!}
              kind={lane.kind}
              findings={lane.findings}
              belts={lane.breakouts}
              side="output"
              busCapacity={busCap}
              laneDemand={lane.totalOutput}
              tiers={tiers}
              itemName={itemName}
              machineTopY={machineTopY + 40}
              laneStart={LAYOUT.marginX}
              laneEnd={layout.width - LAYOUT.marginX}
              onTip={showTip}
              onFocusTip={showFocusTip}
              offTip={hideTip}
            />
          );
        })}
      </svg>
      {tip !== null && (
        <div
          className="tooltip"
          style={{ left: tip.x, top: tip.y, maxWidth: tip.maxWidth }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}
