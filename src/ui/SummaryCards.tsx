import type {
  StageSolveResult,
  Cascade,
  FeedLaneResult,
  OutputLaneResult,
} from "../core/manifold.ts";
import { formatRate } from "./format.ts";

/** A cascade's "J junctions / T tiers" suffix (D5) — head-cascade on feed
 *  cards, collection-cascade on output cards. */
function cascadeText(cascade: Cascade): string {
  return `${cascade.junctions} junctions / ${cascade.tiers} tiers`;
}

/**
 * The belt-feed-lane hardware/buffer/spare lines (D5, null-guarded on the P1
 * fields). Returns the composed line strings, or [] on a pipe/degenerate lane
 * (hardware === null — the runs count already renders, honesty lives in the
 * finding + tooltip). The spare line reads the LAST segment's positive
 * handoffResidue — the terminal capacity surplus surfaced textually (caveat 1).
 */
function feedCardLines(lane: FeedLaneResult): string[] {
  const lines: string[] = [];
  if (lane.hardware !== null) {
    const { splitters, seamMergers, headCascade } = lane.hardware;
    let hardware = `${splitters} splitters · ${seamMergers} seam mergers`;
    if (headCascade !== null) {
      hardware += ` · head cascade: ${cascadeText(headCascade)}`;
    }
    lines.push(hardware);
  }
  if (lane.standingBufferItems > 0) {
    lines.push(`standing buffer: ${lane.standingBufferItems} items`);
  }
  const last = lane.segments[lane.segments.length - 1];
  if (last !== undefined && !last.handoffResidue.isZero()) {
    lines.push(`spare belt capacity: ${formatRate(last.handoffResidue)}/min`);
  }
  return lines;
}

/** The output-lane collection-cascade suffix (D5), or null when b ≤ 1. */
function outputCardLine(lane: OutputLaneResult): string | null {
  return lane.collectionCascade !== null
    ? `collection cascade: ${cascadeText(lane.collectionCascade)}`
    : null;
}

interface SummaryCardsProps {
  result: StageSolveResult;
  itemName(id: string): string;
  /** The active stage's power-draw line, prepared by App via stagePowerText —
   *  null when the stage is not solved or the machine has no power data (the
   *  card stays dumb; the "Power · …" card renders only when non-null). */
  powerText: string | null;
}

export function SummaryCards({
  result,
  itemName,
  powerText,
}: SummaryCardsProps) {
  return (
    <div className="summary-cards">
      {powerText !== null && (
        <div className="summary-card summary-card-power" key="power">
          <span className="card-item">Power</span>
          <span className="card-rate">{powerText}</span>
        </div>
      )}
      {result.feeds.map((lane) => (
        <div className="summary-card" key={`feed-${lane.itemId}`}>
          <span className="card-item">{itemName(lane.itemId)}</span>
          <span className="card-rate">
            {formatRate(lane.totalDemand)}/min in
          </span>
          <span className="card-count">
            {lane.belts.length} × {lane.kind}
          </span>
          {feedCardLines(lane).map((line, i) => (
            <span className="card-detail" key={`fd-${i}`}>
              {line}
            </span>
          ))}
        </div>
      ))}
      {result.outputs.map((lane) => {
        const detail = outputCardLine(lane);
        return (
          <div className="summary-card" key={`out-${lane.itemId}`}>
            <span className="card-item">{itemName(lane.itemId)}</span>
            <span className="card-rate">
              {formatRate(lane.totalOutput)}/min out
            </span>
            <span className="card-count">
              {lane.breakouts.length} × {lane.kind}
            </span>
            {detail !== null && <span className="card-detail">{detail}</span>}
          </div>
        );
      })}
    </div>
  );
}
