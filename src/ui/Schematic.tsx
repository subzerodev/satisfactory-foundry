import { useMemo } from "react";
import type {
  StageSolveResult,
  LaneKind,
  Finding,
  FeedBelt,
  BreakoutBelt,
} from "../core/manifold.ts";
import type { TierTable } from "../data/types.ts";
import { computeLayout } from "./layout.ts";
import type { LaneTrack } from "./layout.ts";
import { beltLabel, formatRate } from "./format.ts";
import { colorForCapacity, ERROR_COLOR } from "./colors.ts";

interface SchematicProps {
  result: StageSolveResult;
  machineCount: number;
  tiers: TierTable;
  unlocked: { belt: number; pipe: number };
  itemName(id: string): string;
}

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

/** One lane's SVG group: bus segments, seams, entry/break-out arrows. */
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
}) {
  return (
    <g className={`lane lane-${side}`} data-item={track.itemId}>
      <text className="lane-name" x={4} y={track.y + 12}>
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
        return (
          <line
            key={`seg-${seg.beltIndex}`}
            className={errored ? "bus-seg seg-error" : "bus-seg"}
            x1={seg.x1}
            x2={seg.x2}
            y1={track.busY}
            y2={track.busY}
            stroke={errored ? ERROR_COLOR : color}
          >
            <title>
              {`machines ${seg.fromMachine}–${seg.toMachine} · peak ${formatRate(
                seg.peakFlow,
              )}/min of ${busCapString}/min`}
            </title>
          </line>
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
        return (
          <line
            key={`belt-${arrow.index}`}
            className="belt-arrow"
            x1={arrow.x}
            x2={arrow.x}
            y1={side === "feed" ? track.y + 16 : machineTopY}
            y2={track.busY}
            stroke={colorForCapacity(kind, belt.capacity, tiers)}
          >
            <title>{beltLabel(side, arrow.index, belt, kind, tiers)}</title>
          </line>
        );
      })}
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

  return (
    <div className={layout.scrolled ? "schematic-scroll" : "schematic"}>
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
            />
          );
        })}
        {layout.machines.map((m) => (
          <g key={`m-${m.index}`} className="machine">
            <rect
              x={m.x}
              y={machineTopY}
              width={Math.max(layout.pitch - 2, 1)}
              height={40}
            />
            {m.labeled && (
              <text className="machine-label" x={m.x} y={machineTopY + 52}>
                {m.index}
              </text>
            )}
          </g>
        ))}
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
            />
          );
        })}
      </svg>
    </div>
  );
}
