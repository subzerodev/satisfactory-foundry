import { useMemo, useRef, useState } from "react";
import type {
  StageSolveResult,
  LaneKind,
  Finding,
  FeedBelt,
  BreakoutBelt,
} from "../core/manifold.ts";
import type { TierTable } from "../data/types.ts";
import { computeLayout } from "./layout.ts";
import type { LaneTrack, SchematicLayout } from "./layout.ts";
import { beltLabel, formatRate, segTooltip } from "./format.ts";
import { colorForCapacity, ERROR_COLOR } from "./colors.ts";

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
}

/** Tooltip offset from the cursor (px), and the clamp margin from the container
 *  edges so a tooltip near the right/bottom edge doesn't overflow. */
const TIP_OFFSET = 12;
const TIP_CLAMP = 8;

/**
 * A segment is in error when a finding implicates it: `segment-over-capacity`
 * by span equality, `starved-machines` by containment of the starved machine(s)
 * within the segment span. The panel lists the same findings textually — both
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
  busCapString,
  tiers,
  itemName,
  machineTopY,
  onTip,
  offTip,
}: {
  track: LaneTrack;
  kind: LaneKind;
  findings: Finding[];
  belts: (FeedBelt | BreakoutBelt)[];
  side: "feed" | "output";
  busCapString: string;
  tiers: TierTable;
  itemName: (id: string) => string;
  machineTopY: number;
  onTip: (text: string, e: React.MouseEvent) => void;
  offTip: () => void;
}) {
  // Pipe lanes read a distinct desaturated-blue dashed treatment (Stage 5 item
  // 4); belt lanes keep the plain track. Schematic already knows the lane kind.
  const pipeClass = kind === "pipe" ? " lane-pipe" : "";
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
      {track.segments.map((seg) => {
        const belt = belts[seg.beltIndex]!;
        const color = colorForCapacity(kind, belt.capacity, tiers);
        const errored = segmentErrored(
          findings,
          seg.fromMachine,
          seg.toMachine,
        );
        const tip = segTooltip(seg, busCapString);
        return (
          <line
            key={`seg-${seg.beltIndex}`}
            className={`bus-seg${errored ? " seg-error" : ""}${pipeClass}`}
            x1={seg.x1}
            x2={seg.x2}
            y1={track.busY}
            y2={track.busY}
            stroke={errored ? ERROR_COLOR : color}
            onMouseEnter={(e) => onTip(tip, e)}
            onMouseMove={(e) => onTip(tip, e)}
            onMouseLeave={offTip}
          />
        );
      })}
      {track.seams.map((x, i) => (
        <line
          key={`seam-${i}`}
          className="seam"
          x1={x}
          x2={x}
          y1={track.busY - 6}
          y2={track.busY + 6}
        />
      ))}
      {track.belts.map((arrow) => {
        const belt = belts[arrow.index]!;
        const tip = beltLabel(side, arrow.index, belt, kind, tiers);
        return (
          <line
            key={`belt-${arrow.index}`}
            className={`belt-arrow${pipeClass}`}
            x1={arrow.x}
            x2={arrow.x}
            y1={side === "feed" ? track.y + 16 : machineTopY}
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

  // Component-local hover tooltip (Stage 5 item 1): replaces the native SVG
  // <title> tooltips. The div is positioned from the mouse event, clamped to
  // the container box so an edge-hovered segment's tip stays visible.
  const containerRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TooltipState | null>(null);

  const showTip = (text: string, e: React.MouseEvent) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (box === undefined) return;
    const x = Math.min(
      e.clientX - box.left + TIP_OFFSET,
      box.width - TIP_CLAMP,
    );
    const y = Math.min(
      e.clientY - box.top + TIP_OFFSET,
      box.height - TIP_CLAMP,
    );
    setTip({ text, x, y });
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
              busCapString={formatRate(busCap)}
              tiers={tiers}
              itemName={itemName}
              machineTopY={machineTopY}
              onTip={showTip}
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
              busCapString={formatRate(busCap)}
              tiers={tiers}
              itemName={itemName}
              machineTopY={machineTopY + 40}
              onTip={showTip}
              offTip={hideTip}
            />
          );
        })}
      </svg>
      {tip !== null && (
        <div className="tooltip" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}
