import type { StageSolveResult } from "../core/manifold.ts";
import type { TierTable } from "../data/types.ts";
import { firstLockedTierForOneLine, formatRate } from "./format.ts";

interface SummaryCardsProps {
  result: StageSolveResult;
  itemName(id: string): string;
  /** The active stage's power-draw line, prepared by App via stagePowerText —
   *  null when the stage is not solved or the machine has no power data (the
   *  card stays dumb; the "Power · …" card renders only when non-null). */
  powerText: string | null;
  tiers: TierTable;
  unlocked: { belt: number; pipe: number };
}

export function SummaryCards({
  result,
  itemName,
  powerText,
  tiers,
  unlocked,
}: SummaryCardsProps) {
  return (
    <div className="summary-cards">
      {powerText !== null && (
        <div className="summary-card summary-card-power" key="power">
          <span className="card-item">Power</span>
          <span className="card-rate">{powerText}</span>
        </div>
      )}
      {result.feeds.map((lane) => {
        const bundled = lane.segments.filter(
          (segment) => segment.parallelCount > 1,
        );
        const highestPeak = bundled.reduce(
          (highest, segment) =>
            highest === null || segment.peakFlow.gt(highest)
              ? segment.peakFlow
              : highest,
          null as (typeof lane.segments)[number]["peakFlow"] | null,
        );
        const oneLineTier =
          highestPeak === null
            ? null
            : firstLockedTierForOneLine(
                lane.kind,
                highestPeak,
                tiers,
                unlocked[lane.kind],
              );
        return (
          <div className="summary-card" key={`feed-${lane.itemId}`}>
            <span className="card-item">{itemName(lane.itemId)}</span>
            <span className="card-rate">
              {formatRate(lane.totalDemand)}/min in
            </span>
            <span className="card-count">
              {lane.belts.length} × {lane.kind}
              {bundled.length > 0 && " · bus up to 2 parallel"}
              {oneLineTier !== null &&
                ` · ${oneLineTier} supports one bus line`}
            </span>
          </div>
        );
      })}
      {result.outputs.map((lane) => (
        <div className="summary-card" key={`out-${lane.itemId}`}>
          <span className="card-item">{itemName(lane.itemId)}</span>
          <span className="card-rate">
            {formatRate(lane.totalOutput)}/min out
          </span>
          <span className="card-count">
            {lane.breakouts.length} × {lane.kind}
          </span>
        </div>
      ))}
    </div>
  );
}
