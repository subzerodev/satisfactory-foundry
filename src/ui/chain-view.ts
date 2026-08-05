/**
 * Pure derive helpers for the drawn-distance measure feed (Stage 17, ticket #89
 * — the two-site rewrite of the former Stage 7 chain surface). ZERO
 * React/DOM/store: the two-site foundation-bbox scaling + nearest-edge geometry
 * + the estimated-link measure-feed mapping are plain functions the
 * LinkInspector consumes (drawnDistanceDm → drawnMeters → applyDrawnDistance).
 * The multi-site chain composer retired with #89; only the pure pair measure and
 * the units-trap mapping remain.
 */

import {
  layoutStage,
  requiredScaleForPair,
  siteBox,
} from "../layout/layout.ts";
import type { Point, StageLayout } from "../layout/layout.ts";
import { FOOTPRINTS } from "../layout/footprints.ts";
import type { Catalog } from "../data/types.ts";
import type { StageNode, StageLink, LinkTransport } from "../state/store.ts";
import type { DroneFuel } from "../core/transport-facts.ts";

// ---------------------------------------------------------------------------
// The two-site drawn-distance measure (Stage 17, ticket #89) — a PURE pair
// measure: only the two endpoint stages' positions + footprints matter. The
// chain composer retired; moving any OTHER stage cannot change the readout.
// ---------------------------------------------------------------------------

/** One endpoint stage's per-stage layout at the recipe's machine footprint —
 *  the per-stage residue of the retired buildChainSites. */
function siteFor(catalog: Catalog, stage: StageNode): StageLayout {
  const machineId =
    stage.selection.recipeId !== null
      ? (catalog.recipes[stage.selection.recipeId]?.machineId ?? "")
      : "";
  return layoutStage(
    stage.solve.status === "solved"
      ? stage.solve.result
      : { feeds: [], outputs: [], findings: [] },
    machineId,
    stage.selection.machineCount,
    FOOTPRINTS,
  );
}

/**
 * The drawn straight-line distance (dm) for one link, or null when either
 * endpoint is unsolved — the nearest-edge geometry between the two endpoint
 * stages' foundation bboxes. A pure TWO-SITE measure (ticket #89): the pair's
 * canvas positions are scaled apart by the SAME `requiredScaleForPair` primitive
 * the old chain K maximized (here on just this pair, clamped to K_MIN
 * internally), so the boxes clear the gutter; no third stage enters. Coincident
 * endpoints fall out naturally — the primitive is total, returns K_MIN, both
 * boxes land at the same origin, and the nearest-edge read is 0 dm with no
 * special case. Near-coincident axis-aligned pairs read a gutter-enforced FLOOR
 * (edge distance = CHAIN_GUTTER), NOT a smooth approach to 0 — inherited from
 * the retired flow, pinned in the tests.
 *
 * `_stageOrder` is retained for caller stability (LinkInspector passes six args)
 * — the two-site body checks solvedness directly on the two endpoint stages and
 * no longer needs the order.
 */
export function drawnDistanceDm(
  linkId: string,
  catalog: Catalog,
  stages: Record<string, StageNode>,
  _stageOrder: string[],
  links: StageLink[],
  positions: Record<string, { x: number; y: number }>,
): number | null {
  const link = links.find((l) => l.id === linkId);
  if (link === undefined) return null;

  const from = stages[link.fromStageId];
  const to = stages[link.toStageId];
  // BOTH endpoints must be solved (checked directly on the two stages).
  if (from?.solve.status !== "solved" || to?.solve.status !== "solved") {
    return null;
  }

  const layoutA = siteFor(catalog, from);
  const layoutB = siteFor(catalog, to);
  const posA = positions[link.fromStageId] ?? { x: 0, y: 0 };
  const posB = positions[link.toStageId] ?? { x: 0, y: 0 };

  // Scale the pair apart so their foundation bboxes clear the gutter, then read
  // the nearest-edge distance. NO grid rounding (the chain-canvas aesthetic
  // retired); the k-scaled origins feed siteBox directly — its box x/y IS the
  // placement origin, no local-origin term.
  const k = requiredScaleForPair(posA, layoutA, posB, layoutB);
  const boxA = siteBox({ x: posA.x * k, y: posA.y * k }, layoutA);
  const boxB = siteBox({ x: posB.x * k, y: posB.y * k }, layoutB);
  return nearestEdgeConnector(boxA, boxB).distanceDm;
}

// ---------------------------------------------------------------------------
// Connector geometry — the straight line between two sites' nearest bbox edge
// midpoints (Axis 2 / Axis 3).
// ---------------------------------------------------------------------------

type Box = { x: number; y: number; w: number; h: number };

/** The four edge midpoints (top, right, bottom, left) of a box. */
function edgeMidpoints(b: Box): Point[] {
  return [
    { x: b.x + b.w / 2, y: b.y }, // top
    { x: b.x + b.w, y: b.y + b.h / 2 }, // right
    { x: b.x + b.w / 2, y: b.y + b.h }, // bottom
    { x: b.x, y: b.y + b.h / 2 }, // left
  ];
}

/** The nearest pair of edge midpoints between two boxes + their dm distance.
 *  Deterministic: the first min-distance pair in (from-edge, to-edge) order. */
export function nearestEdgeConnector(
  from: Box,
  to: Box,
): { from: Point; to: Point; distanceDm: number } {
  const fromMids = edgeMidpoints(from);
  const toMids = edgeMidpoints(to);
  let best = {
    from: fromMids[0]!,
    to: toMids[0]!,
    distanceDm: Number.POSITIVE_INFINITY,
  };
  for (const a of fromMids) {
    for (const b of toMids) {
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d < best.distanceDm) {
        best = { from: a, to: b, distanceDm: d };
      }
    }
  }
  return best;
}

/** The drawn straight-line distance in whole meters (dm ÷ 10, rounded for the
 *  "· 412 m" token). The label is a lower bound on any real route — the
 *  inspector marks it "optimistic". */
export function drawnMeters(distanceDm: number): number {
  return Math.round(distanceDm / 10);
}

// ---------------------------------------------------------------------------
// Axis 3 — the measure feed: map a drawn distance to the P2 raw-text field per
// the mode's arm (the units trap in ONE mapping site).
// ---------------------------------------------------------------------------

/** The trip-carrying transport arms (road + train + drone) — belt/pipe excluded
 *  (matching the LinkInspector's TripTransport discriminant exactly). */
type TripTransport = Exclude<LinkTransport, { mode: "belt" | "pipe" }>;

/** Type guard: a transport config that carries a trip (road + train + drone) —
 *  the LinkInspector's isTripTransport, restated (belt/pipe carry no trip). */
function isTripTransport(t: LinkTransport | undefined): t is TripTransport {
  return t !== undefined && t.mode !== "belt" && t.mode !== "pipe";
}

/** A link's trip-carrying transport config, or null for belt/pipe/absent — the
 *  one narrowing gate the estimated-link + apply helpers share. */
function tripTransportOf(link: StageLink): TripTransport | null {
  return isTripTransport(link.transport) ? link.transport : null;
}

/**
 * Whether a link's trip is estimated-basis (the only basis that gets the "use
 * drawn distance" action — a measured time is better information, never
 * downgraded). Belt/pipe carry no trip → false.
 */
export function isEstimatedLink(link: StageLink): boolean {
  const t = tripTransportOf(link);
  return t !== null && t.trip.kind === "estimated";
}

/**
 * Build the next LinkTransport that writes the drawn distance into the mode's
 * estimated arm — THE single units-trap mapping site (frozen Axis 3): road/train
 * `distanceText` = the one-way drawn meters; drone `flightMetersText` =
 * 2 × drawn meters (round-trip). Returns null when the link is not an
 * estimated trip link (no action offered). `distanceDm` is the drawn dm; the
 * written text is exact meters (dm ÷ 10), never re-rounded to a whole meter, so
 * the fleet re-derives on the true drawn length.
 */
export function applyDrawnDistance(
  link: StageLink,
  distanceDm: number,
): LinkTransport | null {
  const t = tripTransportOf(link);
  if (t === null || t.trip.kind !== "estimated") return null;

  const oneWayMeters = distanceDm / 10;
  if (t.mode === "drone") {
    // Round-trip: 2 × the one-way drawn meters (the drone arm's units).
    const fuel: DroneFuel = t.fuel;
    return {
      mode: "drone",
      fuel,
      trip: { kind: "estimated", flightMetersText: String(oneWayMeters * 2) },
    };
  }
  // road four + train: one-way meters.
  return {
    mode: t.mode,
    trip: { kind: "estimated", distanceText: String(oneWayMeters) },
  };
}
