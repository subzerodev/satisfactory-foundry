import type {
  StageSolveResult,
  FeedBelt,
  BreakoutBelt,
} from "../core/manifold.ts";
import type { Selection } from "../state/store.ts";
import { formatRate } from "./format.ts";

interface LaneOverridesProps {
  result: StageSolveResult;
  overrides: Selection["overrides"];
  /** id → displayName (App's catalog-access pattern, threaded like
   *  FindingsPanel) — the per-lane item heading that groups its belt rows. */
  itemName(id: string): string;
  onOverride(
    side: "feeds" | "outputs",
    itemId: string,
    beltIndex: number,
    text: string | null,
  ): void;
}

/**
 * A row label built from the belt's own fields only — no tier token, so the
 * component needs no `TierTable` prop (spec §3.5's exact signature). Feed shows
 * the assigned capacity + entry point; output shows the carried load + break-out.
 */
function rowLabel(
  side: "feed" | "output",
  index: number,
  belt: FeedBelt | BreakoutBelt,
): string {
  if (side === "feed") {
    const feed = belt as FeedBelt;
    const at =
      feed.entersAfterMachine === 0
        ? "at head"
        : `after machine ${feed.entersAfterMachine}`;
    return `Feed ${index + 1} · ${formatRate(feed.capacity)}/min · enters ${at}`;
  }
  const out = belt as BreakoutBelt;
  const from =
    out.startsAfterMachine === 0
      ? "from machine 1"
      : `breaks out after machine ${out.startsAfterMachine}`;
  return `Out ${index + 1} · ${formatRate(out.load)}/min load · ${from}`;
}

function LaneRows({
  side,
  itemId,
  itemName,
  belts,
  labelSide,
  overrides,
  onOverride,
}: {
  side: "feeds" | "outputs";
  itemId: string;
  itemName: string;
  belts: (FeedBelt | BreakoutBelt)[];
  labelSide: "feed" | "output";
  overrides: Selection["overrides"];
  onOverride: LaneOverridesProps["onOverride"];
}) {
  const cells = overrides[side][itemId] ?? [];
  return (
    <div className="lane-overrides-lane" data-item={itemId}>
      {/* The item heading (schedule-header idiom) groups this lane's belt rows;
          it spans the grid via grid-column: 1 / -1 (see app.css). */}
      <div className="lane-overrides-item">{itemName}</div>
      {belts.map((belt, index) => (
        <div className="override-row" key={index}>
          <span className="override-label">
            {rowLabel(labelSide, index, belt)}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={cells[index] ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              onOverride(side, itemId, index, raw.trim() === "" ? null : raw);
            }}
          />
        </div>
      ))}
    </div>
  );
}

export function LaneOverrides({
  result,
  overrides,
  itemName,
  onOverride,
}: LaneOverridesProps) {
  return (
    <div className="lane-overrides">
      {/* Panel heading (drafting-label idiom) + a one-line sub-label answering
          Michael's "what are these input boxes" field report. */}
      <div className="lane-overrides-head">BELT LOAD OVERRIDES</div>
      <p className="lane-overrides-sub">
        type a rate to override a belt&apos;s load · empty = computed
      </p>
      {result.feeds.map((lane) => (
        <LaneRows
          key={`feed-${lane.itemId}`}
          side="feeds"
          itemId={lane.itemId}
          itemName={itemName(lane.itemId)}
          belts={lane.belts}
          labelSide="feed"
          overrides={overrides}
          onOverride={onOverride}
        />
      ))}
      {result.outputs.map((lane) => (
        <LaneRows
          key={`out-${lane.itemId}`}
          side="outputs"
          itemId={lane.itemId}
          itemName={itemName(lane.itemId)}
          belts={lane.breakouts}
          labelSide="output"
          overrides={overrides}
          onOverride={onOverride}
        />
      ))}
    </div>
  );
}
