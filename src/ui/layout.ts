/**
 * Pure schematic geometry: solve result + machine count → plain-number layout.
 * Coordinates derive ONLY from integer machine indices, counts, and array
 * positions — never from a Fraction (rates appear only as formatted strings,
 * elsewhere). Spans, belt indices, item ids, and each segment's exact
 * `entryFlow` pass through untouched (entryFlow is display data, never a
 * coordinate).
 */

import type { Fraction } from "../core/fraction.ts";
import type {
  StageSolveResult,
  FeedLaneResult,
  OutputLaneResult,
  Finding,
} from "../core/manifold.ts";

export const LAYOUT = {
  viewW: 960,
  marginX: 24, // usable = viewW − marginX×2 = 912
  minPitch: 8,
  maxPitch: 48,
  labelPitch: 20,
  machineH: 40,
  rulerH: 12, // P3: the build-view axis height — a two-mark ruler replaces the
  // 40px machine block (Michael's option-A pick, #135 c24913). The machines
  // view keeps the full machineH block via computeLayout's default.
  laneH: 56,
  busH: 28,
  marginY: 16,
} as const;

const USABLE = LAYOUT.viewW - LAYOUT.marginX * 2;

export interface SchematicLayout {
  width: number;
  height: number;
  pitch: number;
  labelStep: number;
  scrolled: boolean;
  /**
   * Level-of-detail band mode (Stage 12 P1 Axis 1): true when the pitch clamp
   * FLOORS — the unfloored ideal pitch USABLE/N would fall below minPitch, i.e.
   * N > 114. At and below 114 the row keeps readable per-machine ticks; above,
   * 161 six-pixel ticks read as noise, so the row draws as ONE band + a count
   * with individual ticks kept only at `significant` indices. Pure function of
   * N (exposed testably), derived from the layout's own clamp — not an
   * arbitrary pixel threshold.
   */
  band: boolean;
  machineTop: number; // machine-row top y (consumed, never re-derived)
  machines: { index: number; x: number; labeled: boolean }[];
  /**
   * The machine indices that carry an individual boundary tick: feed entries,
   * output breakouts, segment boundaries, and any machine a finding references
   * (the complete textual reference set — nothing else references interior
   * indices). One set-union over existing solve data. Computed in BOTH density
   * modes (P3 — the build view's ruler draws MAJOR ticks at these belt-stretch
   * boundaries whether or not the row is banded; the machines view's band reads
   * it only when `band`). Never empty on a solved lane.
   */
  significant: number[];
  /**
   * The subset of `significant` that carries an index LABEL (ticks stay on every
   * significant index — only the text thins). Empty when `band` is false (label
   * thinning is a band-density concern — non-band modes label per the pitch). The
   * finding-referenced machines are always labeled (the S12P1 findability
   * invariant: the findings panel names exactly those indices); the remaining
   * significant indices are greedy-filled so no two kept labels sit closer than
   * `labelPitch` px — clearing the 10px-mono glyph crowding at the band's 8px
   * pitch. Returned sorted ascending.
   */
  labeledSignificant: number[];
  feeds: LaneTrack[];
  outputs: LaneTrack[];
}

export interface LaneTrack {
  itemId: string;
  y: number;
  busY: number;
  belts: { index: number; x: number }[];
  segments: {
    fromMachine: number;
    toMachine: number;
    x1: number;
    x2: number;
    beltIndex: number;
    entryFlow: Fraction; // solver's entry/head flow, passed through for the title
    handoffResidue: Fraction; // trunk carry past the span (display data; never a
    // coordinate — same convention as entryFlow). Feeds the D1 ribbon's right
    // half-height + the D2/D3 hand-off number; ZERO on every output span.
  }[];
  seams: number[];
}

function clamp(lo: number, v: number, hi: number): number {
  return Math.max(lo, Math.min(v, hi));
}

/**
 * Band mode engages exactly when the pitch clamp FLOORS: the unfloored ideal
 * pitch `USABLE/N` is below `minPitch`. That is the clamp's own floor condition,
 * so the threshold needs no separate constant — `floor(USABLE/N) < minPitch`
 * ⇔ `USABLE/N < minPitch` ⇔ `N > USABLE/minPitch` (912/8 = 114). Pure over N;
 * exposed on the layout so the decision is unit-testable in isolation.
 */
export function bandMode(machineCount: number): boolean {
  return USABLE / Math.max(machineCount, 1) < LAYOUT.minPitch;
}

/**
 * The band's significant machine indices — one set-union over EXISTING solve
 * data (no new solver math): feed entry points, output breakout points, each
 * segment's start/end machine, and every machine a finding references (the same
 * `starved-machines` / `segment-over-capacity` fields Schematic's segmentErrored
 * and format.ts's findingText already read). These are exactly the indices the
 * textual layer (findings, tooltips, override rows) can name, so with them
 * marked no referenced machine is unlocatable; unreferenced interior machines
 * are what a drawing's break convention elides. Returned sorted ascending.
 */
function significantMachines(
  result: StageSolveResult,
  machineCount: number,
): { significant: number[]; findingReferenced: number[] } {
  // The finding-referenced tier is collected separately so the label-thinning
  // rule can PRIORITIZE it (findings name exactly these indices — they must stay
  // labeled). `marks` is the full union; `findings` is the priority subset. The
  // merged `significant` result is IDENTICAL to before the split (both derive
  // from the same adds), so ticks are unchanged.
  const marks = new Set<number>();
  const findings = new Set<number>();
  const add = (m: number) => {
    if (m >= 1 && m <= machineCount) marks.add(m);
  };
  const addFinding = (m: number) => {
    if (m >= 1 && m <= machineCount) {
      marks.add(m);
      findings.add(m);
    }
  };

  const noteFinding = (f: Finding) => {
    if (f.type === "segment-over-capacity") {
      addFinding(f.fromMachine);
      addFinding(f.toMachine);
    } else if (f.type === "starved-machines") {
      if (f.partial !== undefined) addFinding(f.partial.machine);
      if (f.starvedFrom !== undefined) addFinding(f.starvedFrom);
      if (f.starvedTo !== undefined) addFinding(f.starvedTo);
    }
  };

  for (const lane of result.feeds) {
    // A belt entering after machine m starts machine m+1's supply; label that
    // machine (head belt, m=0, marks machine 1).
    for (const b of lane.belts) add(b.entersAfterMachine + 1);
    for (const s of lane.segments) {
      add(s.fromMachine);
      add(s.toMachine);
    }
    lane.findings.forEach(noteFinding);
  }
  for (const lane of result.outputs) {
    for (const b of lane.breakouts) add(b.startsAfterMachine + 1);
    for (const s of lane.segments) {
      add(s.fromMachine);
      add(s.toMachine);
    }
    lane.findings.forEach(noteFinding);
  }

  return {
    significant: [...marks].sort((a, b) => a - b),
    findingReferenced: [...findings].sort((a, b) => a - b),
  };
}

/**
 * The subset of `significant` that carries an index label (Stage 15 / #78). At
 * the band's clamped 8px pitch, consecutive significant machines put two-/three-
 * digit labels ~12–18px apart — they overlap. This thins the TEXT (ticks stay on
 * every significant index):
 *
 *   1. PRIORITY — every finding-referenced machine is labeled (the findings
 *      panel names exactly these; naming correctness beats aesthetics, so two
 *      close findings may still crowd — an accepted, rare residual).
 *   2. GREEDY FILL — the kept set is PRE-SEEDED with the whole priority tier,
 *      then the remaining significant indices are walked ascending; index m is
 *      kept iff its px distance ((m − k) × pitch) to the NEAREST already-kept
 *      label on either side — priority or greedy — is ≥ labelPitch. Pre-seeding
 *      is load-bearing: without it a greedy label can land < labelPitch from a
 *      priority one. At band pitch 8 the rule keeps non-priority labels ≥ 3
 *      indices (24px) apart.
 *
 * The band's ×N count communicates the total, so no last-index anchor is needed.
 */
function labeledSignificantOf(
  significant: number[],
  findingReferenced: number[],
  pitch: number,
): number[] {
  const kept = new Set<number>(findingReferenced);
  const findingSet = new Set<number>(findingReferenced);

  // Greedy fill over the non-priority significant indices, ascending. Keep m
  // only when the nearest already-kept label (priority OR greedy, either side)
  // is ≥ labelPitch px away.
  for (const m of significant) {
    if (findingSet.has(m)) continue; // priority tier already seeded
    let nearest = Infinity;
    for (const k of kept) {
      nearest = Math.min(nearest, Math.abs(m - k) * pitch);
    }
    if (nearest >= LAYOUT.labelPitch) kept.add(m);
  }

  return [...kept].sort((a, b) => a - b);
}

/** Boundary x after machine m (m = 0..N): the shared entry/break-out/edge x. */
function boundaryX(m: number, pitch: number): number {
  return LAYOUT.marginX + m * pitch;
}

function feedTrack(
  lane: FeedLaneResult,
  bandY: number,
  pitch: number,
): LaneTrack {
  return {
    itemId: lane.itemId,
    y: bandY,
    busY: bandY + LAYOUT.laneH - 8,
    belts: lane.belts.map((b) => ({
      index: b.index,
      x: boundaryX(b.entersAfterMachine, pitch),
    })),
    segments: lane.segments.map((s) => ({
      fromMachine: s.fromMachine,
      toMachine: s.toMachine,
      x1: boundaryX(s.fromMachine - 1, pitch),
      x2: boundaryX(s.toMachine, pitch),
      beltIndex: s.beltIndex,
      entryFlow: s.entryFlow,
      handoffResidue: s.handoffResidue,
    })),
    // Interior seams: each segment start boundary except the head (machine 1).
    seams: lane.segments
      .filter((s) => s.fromMachine > 1)
      .map((s) => boundaryX(s.fromMachine - 1, pitch)),
  };
}

function outputTrack(
  lane: OutputLaneResult,
  bandY: number,
  pitch: number,
): LaneTrack {
  return {
    itemId: lane.itemId,
    y: bandY,
    busY: bandY + 8,
    belts: lane.breakouts.map((b) => ({
      index: b.index,
      x: boundaryX(b.startsAfterMachine, pitch),
    })),
    segments: lane.segments.map((s) => ({
      fromMachine: s.fromMachine,
      toMachine: s.toMachine,
      x1: boundaryX(s.fromMachine - 1, pitch),
      x2: boundaryX(s.toMachine, pitch),
      beltIndex: s.beltIndex,
      entryFlow: s.entryFlow,
      handoffResidue: s.handoffResidue,
    })),
    seams: lane.segments
      .filter((s) => s.fromMachine > 1)
      .map((s) => boundaryX(s.fromMachine - 1, pitch)),
  };
}

export function computeLayout(
  result: StageSolveResult,
  machineCount: number,
  machineRowH: number = LAYOUT.machineH,
): SchematicLayout {
  const N = machineCount;
  const pitch = clamp(
    LAYOUT.minPitch,
    Math.floor(USABLE / Math.max(N, 1)),
    LAYOUT.maxPitch,
  );
  const scrolled = pitch === LAYOUT.minPitch && LAYOUT.minPitch * N > USABLE;
  const width = scrolled ? LAYOUT.marginX * 2 + pitch * N : LAYOUT.viewW;

  const band = bandMode(N);
  // P3 (the r2 registration fix): significant computes in BOTH modes — it is a
  // pure set-union over existing solve data (entries, breakouts, segment bounds,
  // finding refs), and the build-view ruler draws its MAJOR ticks from it
  // regardless of density. labeledSignificant stays band-gated (label thinning
  // is a band-density concern).
  const sig = significantMachines(result, N);
  const significant = sig.significant;
  const labeledSignificant = band
    ? labeledSignificantOf(significant, sig.findingReferenced, pitch)
    : [];

  const labelStep =
    pitch >= LAYOUT.labelPitch
      ? 1
      : Math.ceil((N * LAYOUT.labelPitch) / USABLE);

  const machines: SchematicLayout["machines"] = [];
  for (let i = 1; i <= N; i++) {
    machines.push({
      index: i,
      x: LAYOUT.marginX + (i - 1) * pitch,
      labeled: i === 1 || i === N || i % labelStep === 0,
    });
  }

  const feeds = result.feeds.map((lane, i) =>
    feedTrack(lane, LAYOUT.marginY + i * LAYOUT.laneH, pitch),
  );
  // machineTop carries NO machineRowH term — it registers with the feed lanes
  // and P2's endpoint rows above, pixel-identical across both row heights (the
  // structural register guarantee). Only outputTop + height shrink with the row.
  const machineTop =
    LAYOUT.marginY + result.feeds.length * LAYOUT.laneH + LAYOUT.busH;
  const outputTop = machineTop + machineRowH + LAYOUT.busH;
  const outputs = result.outputs.map((lane, j) =>
    outputTrack(lane, outputTop + j * LAYOUT.laneH, pitch),
  );

  const height =
    LAYOUT.marginY * 2 +
    result.feeds.length * LAYOUT.laneH +
    LAYOUT.busH * 2 +
    machineRowH +
    result.outputs.length * LAYOUT.laneH;

  return {
    width,
    height,
    pitch,
    labelStep,
    scrolled,
    band,
    machineTop,
    machines,
    significant,
    labeledSignificant,
    feeds,
    outputs,
  };
}
