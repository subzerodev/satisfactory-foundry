/**
 * Pure formatting helpers: exact-rate strings, tier tokens, belt labels, and
 * finding sentences. Fractions become strings here and nowhere else — never
 * converted to JS numbers. The exact strings are UI contract, pinned by tests.
 */

import { Fraction } from "../core/fraction.ts";
import type {
  LaneKind,
  FeedBelt,
  BreakoutBelt,
  Finding,
} from "../core/manifold.ts";
import type { TierTable } from "../data/types.ts";

/**
 * Exact rate as a display string. Integers print bare; terminating decimals
 * print at the smallest dp that round-trips exactly (so no rounding is ever
 * presented as truth); a non-terminating value falls back to the exact "n/d".
 */
export function formatRate(f: Fraction): string {
  const exact = f.toString();
  if (!exact.includes("/")) {
    return exact;
  }
  for (let dp = 1; dp <= 4; dp++) {
    const s = f.toDecimalString(dp);
    // At the smallest round-tripping dp the last digit is never 0 (else dp−1
    // would already round-trip), so no trailing-zero trim is reachable.
    if (Fraction.parse(s).eq(f)) {
      return s;
    }
  }
  return exact;
}

function tierIndex(
  kind: LaneKind,
  capacity: Fraction,
  tiers: TierTable,
): number {
  return tiers[kind].findIndex((t) => t.eq(capacity));
}

/** The bare tier token for a capacity, or `custom` when no tier matches. */
export function tierLabel(
  kind: LaneKind,
  capacity: Fraction,
  tiers: TierTable,
): string {
  const i = tierIndex(kind, capacity, tiers);
  if (i < 0) {
    return "custom";
  }
  return kind === "belt" ? `Mk${i + 1}` : `Pipe Mk${i + 1}`;
}

/**
 * A belt's human label. Feed prints its capacity + entry point; output prints
 * its carried load + break-out point (the two rates differ, so each template
 * has exactly one rate slot; the tier token never embeds a rate).
 */
export function beltLabel(
  side: "feed" | "output",
  index: number,
  belt: FeedBelt | BreakoutBelt,
  kind: LaneKind,
  tiers: TierTable,
): string {
  const tier = tierLabel(kind, belt.capacity, tiers);
  if (side === "feed") {
    const feed = belt as FeedBelt;
    const at =
      feed.entersAfterMachine === 0
        ? "at head"
        : `after machine ${feed.entersAfterMachine}`;
    return `Feed ${index + 1} — ${tier} · ${formatRate(feed.capacity)}/min · enters ${at}`;
  }
  const out = belt as BreakoutBelt;
  const from =
    out.startsAfterMachine === 0
      ? "from machine 1"
      : `breaks out after machine ${out.startsAfterMachine}`;
  return `Out ${index + 1} — ${tier} · ${formatRate(out.load)}/min load · ${from}`;
}

/**
 * A bus segment's hover-tooltip text. The exact string moved verbatim out of
 * the Schematic `<title>` markup (Stage 5 item 1) so the styled tooltip and the
 * unit test share one source of truth. `busCapString` is the already-formatted
 * bus capacity (formatRate) the caller passes; `peakFlow` is the segment's exact
 * span maximum, formatted here.
 */
export function segTooltip(
  seg: { fromMachine: number; toMachine: number; peakFlow: Fraction },
  busCapString: string,
): string {
  return `machines ${seg.fromMachine}–${seg.toMachine} · peak ${formatRate(
    seg.peakFlow,
  )}/min of ${busCapString}/min`;
}

/** One human sentence per finding variant. */
export function findingText(
  f: Finding,
  itemName: (id: string) => string,
): string {
  switch (f.type) {
    case "infeasible-machine-demand":
      return `${itemName(f.itemId)}: one machine needs ${formatRate(f.demand)}/min — more than the best unlocked tier carries (${formatRate(f.topCapacity)}/min). No manifold can serve it; unlock a higher tier or lower the clock.`;
    case "segment-over-capacity":
      return `${itemName(f.itemId)}: bus over capacity between machines ${f.fromMachine}–${f.toMachine} — peak ${formatRate(f.peakFlow)}/min exceeds ${formatRate(f.busCapacity)}/min.`;
    case "starved-machines": {
      let s = `${itemName(f.itemId)}: machines starve`;
      if (f.starvedFrom !== undefined && f.starvedTo !== undefined) {
        s += ` from machine ${f.starvedFrom} to ${f.starvedTo}`;
      }
      if (f.partial !== undefined) {
        s += ` (machine ${f.partial.machine} receives ${formatRate(f.partial.received)}/min, short ${formatRate(f.partial.shortfall)}/min)`;
      }
      return s;
    }
    case "invalid-input":
      return `Invalid input: ${f.detail}`;
  }
}
