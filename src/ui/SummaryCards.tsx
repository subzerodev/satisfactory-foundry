import type { StageSolveResult } from "../core/manifold.ts";
import { formatRate } from "./format.ts";

interface SummaryCardsProps {
  result: StageSolveResult;
  itemName(id: string): string;
}

export function SummaryCards({ result, itemName }: SummaryCardsProps) {
  return (
    <div className="summary-cards">
      {result.feeds.map((lane) => (
        <div className="summary-card" key={`feed-${lane.itemId}`}>
          <span className="card-item">{itemName(lane.itemId)}</span>
          <span className="card-rate">
            {formatRate(lane.totalDemand)}/min in
          </span>
          <span className="card-count">
            {lane.belts.length} × {lane.kind}
          </span>
        </div>
      ))}
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
