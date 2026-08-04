/**
 * Pure derive helpers for the combined multi-stage view (Stage 7 / Phase 3,
 * frozen Axes 2–4) — the testable core the ChainBlueprint component renders.
 * ZERO React/DOM/store: connector geometry, the drawn-distance measure feed
 * (Axis 3), and the combined-view power footer (Axis 4) are all plain functions
 * over the world-dm ChainLayout + the existing transport-plan/text pair, so the
 * whole render contract is node-testable (the S4 canvas-exclusion posture — data
 * pinned here, render smoke minimal).
 *
 * Wording that already exists is REUSED, never restated: link labels compose the
 * PUBLIC computeLinkTransport + edgeChip pair (transport-plan/transport-text) —
 * the same composition graph-flow's private transportChipFor performs — plus the
 * flowing item's display name and the new drawn-distance token. The footer's
 * transport term is an EXACT Fraction sum (station/port constants × integer
 * counts); train links are omitted with a note (frozen Axis 4).
 */

import { Fraction } from "../core/fraction.ts";
import type { Point, ChainLayout, ChainSite } from "../layout/layout.ts";
import type { Catalog } from "../data/types.ts";
import type { StageNode, StageLink, LinkTransport } from "../state/store.ts";
import type { DroneFuel } from "../core/transport-facts.ts";
import { linkRequiredRate, globalUnlockedTiers } from "./graph-flow.ts";
import { computeLinkTransport } from "./transport-plan.ts";
import type { TransportPlan } from "./transport-plan.ts";
import { edgeChip } from "./transport-text.ts";

// ---------------------------------------------------------------------------
// Site placement lookup — world-dm bbox per placed site.
// ---------------------------------------------------------------------------

/** A placed site's world-dm foundation bbox (origin + tile grid), or null when
 *  the site is not in the chain (skipped/unsolved). */
export function siteWorldBox(
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
// Inter-site link rendering data (Axis 2).
// ---------------------------------------------------------------------------

/** Whether a link's mode draws as a dashed (vehicle-class) or solid
 *  (belt/pipe continuous) connector — a mode-class visual only, no pathfinding. */
export function isVehicleModeLink(link: StageLink): boolean {
  const mode = link.transport?.mode ?? "belt";
  return mode !== "belt" && mode !== "pipe";
}

/** One inter-site connector's full render data: the two endpoints, the dashed
 *  flag, and the composed label (item name + the public chip + drawn distance).
 *  Returns null when either endpoint is skipped (unsolved/not-placed) — a
 *  skipped endpoint also skips its links (frozen Axis 1). */
export interface ChainConnector {
  linkId: string;
  from: Point;
  to: Point;
  dashed: boolean;
  label: string;
}

export function chainConnectors(
  chain: ChainLayout,
  sites: ChainSite[],
  links: StageLink[],
  catalog: Catalog,
  stages: Record<string, StageNode>,
): ChainConnector[] {
  const out: ChainConnector[] = [];
  for (const link of links) {
    const fromBox = siteWorldBox(chain, sites, link.fromStageId);
    const toBox = siteWorldBox(chain, sites, link.toStageId);
    if (fromBox === null || toBox === null) continue; // skipped endpoint
    const conn = nearestEdgeConnector(fromBox, toBox);
    out.push({
      linkId: link.id,
      from: conn.from,
      to: conn.to,
      dashed: isVehicleModeLink(link),
      label: connectorLabel(link, catalog, stages, conn.distanceDm),
    });
  }
  return out;
}

/**
 * The connector label: the flowing item's display name, the public transport
 * chip (computeLinkTransport + edgeChip — "" for belt/unsolved/errored), and the
 * drawn-distance token. No new wording vocabulary beyond the distance token.
 */
function connectorLabel(
  link: StageLink,
  catalog: Catalog,
  stages: Record<string, StageNode>,
  distanceDm: number,
): string {
  const itemName = catalog.items[link.itemId]?.displayName ?? link.itemId;
  const chip = linkChip(link, catalog, stages);
  return `${itemName}${chip} · ${drawnMeters(distanceDm)} m`;
}

/** The transport chip suffix (" · 3 trucks", "≈" on estimated) via the public
 *  pair, or "" for belt/unsolved/errored — the same composition graph-flow's
 *  private transportChipFor performs, done here at the public boundary. */
function linkChip(
  link: StageLink,
  catalog: Catalog,
  stages: Record<string, StageNode>,
): string {
  if (link.transport === undefined || link.transport.mode === "belt") return "";
  const item = catalog.items[link.itemId];
  if (item === undefined) return "";
  const plan = computeLinkTransport(
    linkRequiredRate(link, stages),
    link.transport,
    item,
    catalog.tiers,
    globalUnlockedTiers(catalog, stages),
  );
  const chip = edgeChip(plan);
  return chip === null ? "" : ` ${chip}`;
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

// ---------------------------------------------------------------------------
// Axis 4 — the combined-view power footer.
// ---------------------------------------------------------------------------

/**
 * The combined-view power footer parts (frozen Axis 4). `sitesText` is the
 * chain Σ over solved stages (exact at 100% clock, labeled-≈ when any stage is
 * overclocked — the advice.ts chainPowerText discipline; null when no stage
 * bills power). `transportMw` is the EXACT Fraction sum of DETERMINATE link
 * power: truck-likes 40 MW (both ends), drone portPowerMw × nDrones; belt/pipe
 * 0; train links OMITTED. `hasTrain` flags any configured+solved train link, so
 * the renderer appends "(+ trains — see per-link)".
 */
export interface ChainPowerFooter {
  transportMw: Fraction;
  hasTrain: boolean;
}

export function chainTransportPower(
  links: StageLink[],
  catalog: Catalog,
  stages: Record<string, StageNode>,
): ChainPowerFooter {
  let transportMw = Fraction.from(0);
  let hasTrain = false;
  const unlocked = globalUnlockedTiers(catalog, stages);
  for (const link of links) {
    const mode = link.transport?.mode ?? "belt";
    if (mode === "belt" || mode === "pipe") continue; // no stations → 0
    const item = catalog.items[link.itemId];
    if (item === undefined) continue;
    const plan = computeLinkTransport(
      linkRequiredRate(link, stages),
      link.transport,
      item,
      catalog.tiers,
      unlocked,
    );
    if (plan.kind === "train") hasTrain = true; // omitted from the sum, noted
    transportMw = transportMw.add(planPowerMw(plan));
  }
  return { transportMw, hasTrain };
}

/**
 * One plan's determinate transport power (MW), exact Fraction: a vehicle plan's
 * station power (40 MW, both ends), a drone plan's portPowerMw × nDrones.
 * Train / continuous / unsolved / errored plans contribute 0 (a train link is
 * counted via `hasTrain`, not summed — the omit-with-note discipline).
 */
function planPowerMw(plan: TransportPlan): Fraction {
  switch (plan.kind) {
    case "vehicle":
      return plan.stationPowerMw;
    case "drone":
      return plan.result.portPowerMw.mul(Fraction.from(plan.result.nDrones));
    default:
      return Fraction.from(0);
  }
}
