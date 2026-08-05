/**
 * Pure derive helpers for the chain drawn-distance measure feed (Stage 7 /
 * Phase 3, Axis 3), the surviving surface after the Combined view was removed
 * (#75). ZERO React/DOM/store: the world-dm chain assembly + nearest-edge
 * geometry + the estimated-link measure-feed mapping are plain functions the
 * LinkInspector consumes (drawnDistanceDm → drawnMeters → applyDrawnDistance).
 * The connector-rendering + power-footer derivations went with the Combined
 * component (only its casualties, per the corrected consumer split).
 */

import { layoutChain, layoutStage } from "../layout/layout.ts";
import type {
  Point,
  ChainLayout,
  ChainSite,
  ChainArrangement,
} from "../layout/layout.ts";
import { FOOTPRINTS } from "../layout/footprints.ts";
import type { Catalog } from "../data/types.ts";
import type { StageNode, StageLink, LinkTransport } from "../state/store.ts";
import type { DroneFuel } from "../core/transport-facts.ts";

// ---------------------------------------------------------------------------
// Site placement lookup — world-dm bbox per placed site.
// ---------------------------------------------------------------------------

/** A placed site's world-dm foundation bbox (origin + tile grid), or null when
 *  the site is not in the chain (skipped/unsolved). */
function siteWorldBox(
  chain: ChainLayout,
  sites: ChainSite[],
  stageId: string,
): { x: number; y: number; w: number; h: number } | null {
  const placement = chain.sites.find((s) => s.stageId === stageId);
  const site = sites.find((s) => s.stageId === stageId);
  if (placement === undefined || site === undefined) return null;
  const { cols, rows } = site.layout.foundations;
  return {
    x: placement.origin.x,
    y: placement.origin.y,
    w: cols * FOUNDATION_TILE,
    h: rows * FOUNDATION_TILE,
  };
}

/** Foundation tile edge (8 m) — restated locally (matches layout.ts
 *  FOUNDATION_TILE, the same S4P2 restatement posture Blueprint uses). */
const FOUNDATION_TILE = 80;

// ---------------------------------------------------------------------------
// Chain assembly — build the solved-only ChainSites + the world-dm layout from
// the store slice (the LinkInspector measure feed's geometry basis).
// ---------------------------------------------------------------------------

/** The solved stage ids in stageOrder — the sites the chain layout places
 *  (unsolved/invalid stages are skipped; frozen Axis 1 solved-only). */
export function solvedStageIds(
  stages: Record<string, StageNode>,
  stageOrder: string[],
): string[] {
  return stageOrder.filter((id) => stages[id]?.solve.status === "solved");
}

/** One ChainSite per solved stage: its per-stage layout at the recipe's machine
 *  footprint. Order follows stageOrder for determinism. */
export function buildChainSites(
  catalog: Catalog,
  stages: Record<string, StageNode>,
  solvedIds: string[],
): ChainSite[] {
  return solvedIds.map((id) => {
    const stage = stages[id]!;
    const machineId =
      stage.selection.recipeId !== null
        ? (catalog.recipes[stage.selection.recipeId]?.machineId ?? "")
        : "";
    return {
      stageId: id,
      layout: layoutStage(
        stage.solve.status === "solved"
          ? stage.solve.result
          : { feeds: [], outputs: [], findings: [] },
        machineId,
        stage.selection.machineCount,
        FOOTPRINTS,
      ),
    };
  });
}

/** The world-dm chain layout for the solved sites, from their canvas positions
 *  (the arrangement — Assumption #1: every stage has a position). */
export function buildChain(
  sites: ChainSite[],
  solvedIds: string[],
  positions: Record<string, { x: number; y: number }>,
): ChainLayout {
  const arrangement: ChainArrangement[] = solvedIds.map((id) => ({
    stageId: id,
    x: positions[id]?.x ?? 0,
    y: positions[id]?.y ?? 0,
  }));
  return layoutChain(sites, arrangement);
}

/**
 * The drawn straight-line distance (dm) for one link, or null when either
 * endpoint is skipped (unsolved) — the nearest-edge geometry between the two
 * sites' foundation bboxes, exposed so the LinkInspector can offer the measure
 * feed without re-deriving any connector labels.
 */
export function drawnDistanceDm(
  linkId: string,
  catalog: Catalog,
  stages: Record<string, StageNode>,
  stageOrder: string[],
  links: StageLink[],
  positions: Record<string, { x: number; y: number }>,
): number | null {
  const link = links.find((l) => l.id === linkId);
  if (link === undefined) return null;
  const solvedIds = solvedStageIds(stages, stageOrder);
  const sites = buildChainSites(catalog, stages, solvedIds);
  const chain = buildChain(sites, solvedIds, positions);
  const fromBox = siteWorldBox(chain, sites, link.fromStageId);
  const toBox = siteWorldBox(chain, sites, link.toStageId);
  if (fromBox === null || toBox === null) return null;
  return nearestEdgeConnector(fromBox, toBox).distanceDm;
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
