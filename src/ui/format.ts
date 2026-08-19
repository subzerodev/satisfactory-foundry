/**
 * Pure formatting helpers: exact-rate strings, tier tokens, belt labels, and
 * finding sentences. Fractions become EXACT strings here — never converted to
 * JS numbers. The exact strings are UI contract, pinned by tests.
 *
 * The float boundary is deliberately split (Stage 6 / Phase 2 decision): this
 * module stays exact-only, and `src/ui/advice.ts` is THE SECOND, approximation-
 * labeled boundary — `stagePowerText`/`chainPowerText` there convert Fractions
 * to numbers for irrational overclock power, every approximated value carrying
 * the "≈" prefix. So "exact here and nowhere else" now reads: exact HERE;
 * labeled-approximation ONLY in advice.ts; nowhere else.
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

/** Bounded semantic summary for feed slots sharing one entry boundary. */
export function feedGroupLabel(belts: readonly FeedBelt[]): string {
  const first = belts[0]!;
  const last = belts[belts.length - 1]!;
  const total = belts.reduce(
    (sum, belt) => sum.add(belt.capacity),
    Fraction.from(0),
  );
  const at =
    first.entersAfterMachine === 0
      ? "at head"
      : `after machine ${first.entersAfterMachine}`;
  return `Feeds ${first.index + 1}-${last.index + 1} - ${belts.length} slots - ${formatRate(total)}/min total capacity - enter ${at}`;
}

/**
 * A bus segment's hover-tooltip text (P2 D3, rewriting the stale "peak" copy of
 * caveat 2 into the entry/hand-off vocabulary the ribbon draws). The exact
 * string is owned here (Stage 5 item 1) so any styled tooltip and the unit test
 * share one source of truth. `busCapString` is the already-formatted bus
 * capacity (formatRate) the caller passes; `entryFlow`/`handoffResidue` are the
 * segment's exact flows, formatted here. Three shapes, keyed by `side` + the
 * `terminal` flag:
 *
 *   - Non-terminal feed: `entry N → hand-off M · bus B` — the ribbon's reset
 *     thickness and its onward carry.
 *   - Terminal feed with surplus (caveat 1): `entry N → 0/min onward · S/min
 *     spare belt capacity` — the terminal `handoffResidue` is UNUSED CAPACITY,
 *     never onward flow, so onward reads 0 and the surplus surfaces textually.
 *   - Output: `collects N/min of B/min` — a break-out belt's flat span load;
 *     handoff is always 0 there, so no onward term.
 */
export function segTooltip(
  seg: {
    fromMachine: number;
    toMachine: number;
    entryFlow: Fraction;
    handoffResidue: Fraction;
  },
  busCapString: string,
  side: "feed" | "output",
  terminal: boolean,
): string {
  const span = `machines ${seg.fromMachine}–${seg.toMachine}`;
  if (side === "output") {
    return `${span} · collects ${formatRate(seg.entryFlow)}/min of ${busCapString}/min`;
  }
  const entry = `entry ${formatRate(seg.entryFlow)}/min`;
  if (terminal) {
    // Caveat 1: onward flow is always 0 on the terminal stretch; any positive
    // handoffResidue is spare belt capacity, surfaced separately, never as flow.
    const surplus = seg.handoffResidue.isZero()
      ? ""
      : ` · ${formatRate(seg.handoffResidue)}/min spare belt capacity`;
    return `${span} · ${entry} → 0/min onward${surplus}`;
  }
  return `${span} · ${entry} → hand-off ${formatRate(seg.handoffResidue)}/min · bus ${busCapString}/min`;
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
      return `${itemName(f.itemId)}: bus over capacity between machines ${f.fromMachine}–${f.toMachine} — peak ${formatRate(f.flow)}/min exceeds ${formatRate(f.busCapacity)}/min.`;
    case "lane-undersupplied":
      return `${itemName(f.itemId)}: lane under-supplied by ${formatRate(f.shortfall)}/min (nominal pipe ceiling).`;
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
