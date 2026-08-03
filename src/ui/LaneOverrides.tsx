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
  belts,
  labelSide,
  overrides,
  onOverride,
}: {
  side: "feeds" | "outputs";
  itemId: string;
  belts: (FeedBelt | BreakoutBelt)[];
  labelSide: "feed" | "output";
  overrides: Selection["overrides"];
  onOverride: LaneOverridesProps["onOverride"];
}) {
  const cells = overrides[side][itemId] ?? [];
  return (
    <div className="lane-overrides-lane" data-item={itemId}>
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
  onOverride,
}: LaneOverridesProps) {
  return (
    <div className="lane-overrides">
      {result.feeds.map((lane) => (
        <LaneRows
          key={`feed-${lane.itemId}`}
          side="feeds"
          itemId={lane.itemId}
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
          belts={lane.breakouts}
          labelSide="output"
          overrides={overrides}
          onOverride={onOverride}
        />
      ))}
    </div>
  );
}
