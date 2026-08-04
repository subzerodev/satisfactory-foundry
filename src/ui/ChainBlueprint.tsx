import { useMemo } from "react";
import type { ChainLayout, ChainSite } from "../layout/layout.ts";
import type { Catalog } from "../data/types.ts";
import type { StageNode, StageLink } from "../state/store.ts";
import { formatRate } from "./format.ts";
import { chainPowerText, stagePowerTextFor } from "./advice.ts";
import {
  buildChain,
  buildChainSites,
  chainConnectors,
  chainTransportPower,
  solvedStageIds,
} from "./chain-view.ts";
import type { ChainConnector } from "./chain-view.ts";

/**
 * The combined multi-stage blueprint (Stage 7 / Phase 3, frozen Axis 2) — the
 * third app view, Blueprint's whole-chain sibling. It lays every SOLVED stage
 * out as a site in one shared world-dm SVG (via the pure `layoutChain`
 * composer), draws each site's foundation/machine geometry, chromes it with a
 * name + power line, and draws the inter-site connectors with their transport +
 * drawn-distance labels. A footer sums site vs transport power (Axis 4).
 *
 * Store-free (App is the sole store importer): App hands the whole graph slice
 * as props; every derivation here is pure + memoized. The per-site rendering
 * RESTATES Blueprint's SVG conventions rather than extracting a shared helper —
 * Blueprint's drawing is coupled to per-lane solve/label detail this overview
 * does not show (foundations + the machine row carry the whole-chain read), so
 * extraction would not be mechanical (the S4P2 restatement posture; judgment
 * call, boundary-reviewed).
 */

/** SVG padding around the chain bounds (dm) — matches Blueprint's PAD idiom. */
const PAD = 40;
/** Height cap (px) so a tall chain scales inside the viewport (Blueprint's
 *  MAX_SVG_HEIGHT idiom). */
const MAX_SVG_HEIGHT = 640;
/** Foundation tile edge (8 m) — restated (matches layout.ts FOUNDATION_TILE). */
const FOUNDATION_TILE = 80;

interface ChainBlueprintProps {
  catalog: Catalog;
  stages: Record<string, StageNode>;
  stageOrder: string[];
  links: StageLink[];
  positions: Record<string, { x: number; y: number }>;
}

export function ChainBlueprint({
  catalog,
  stages,
  stageOrder,
  links,
  positions,
}: ChainBlueprintProps) {
  const view = useMemo(
    () => deriveChainView(catalog, stages, stageOrder, links, positions),
    [catalog, stages, stageOrder, links, positions],
  );

  const { sites, chain, connectors, chrome, skippedCount, footerText } = view;

  if (sites.length === 0) {
    return (
      <div className="bp-view">
        <p className="empty-state">
          No solved stages to lay out — solve a stage to see the combined view.
        </p>
      </div>
    );
  }

  const minX = chain.bounds.x - PAD;
  const minY = chain.bounds.y - PAD;
  const w = chain.bounds.w + 2 * PAD;
  const h = chain.bounds.h + 2 * PAD;
  const viewBox = `${minX} ${minY} ${w} ${h}`;
  const svgHeight = Math.min(h, MAX_SVG_HEIGHT);

  const originOf = new Map(chain.sites.map((s) => [s.stageId, s.origin]));

  return (
    <div className="bp-view">
      {skippedCount > 0 && (
        <p className="bp-notice">
          {skippedCount} {skippedCount === 1 ? "stage" : "stages"} not shown —
          unsolved
        </p>
      )}
      <svg
        className="bp-svg chain-bp-svg"
        viewBox={viewBox}
        width="100%"
        height={svgHeight}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Per-site geometry: each site translated to its world-dm origin. */}
        {sites.map((site) => {
          const origin = originOf.get(site.stageId)!;
          const info = chrome.find((c) => c.stageId === site.stageId)!;
          return (
            <SiteGlyph
              key={site.stageId}
              site={site}
              originX={origin.x}
              originY={origin.y}
              name={info.name}
              powerText={info.powerText}
            />
          );
        })}
        {/* Inter-site connectors on top of the sites. */}
        {connectors.map((conn) => (
          <Connector key={conn.linkId} conn={conn} />
        ))}
      </svg>
      <p className="chain-bp-footer">{footerText}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-site glyph — foundation grid + the machine row + the chrome label.
// ---------------------------------------------------------------------------

function SiteGlyph({
  site,
  originX,
  originY,
  name,
  powerText,
}: {
  site: ChainSite;
  originX: number;
  originY: number;
  name: string;
  powerText: string | null;
}) {
  const { cols, rows } = site.layout.foundations;
  // The foundation grid's own local origin (layoutStage may floor it negative
  // for lanes above the row); translate so the site's bbox top-left lands at the
  // chain origin.
  const fx = site.layout.foundations.origin.x;
  const fy = site.layout.foundations.origin.y;
  return (
    <g
      className="chain-bp-site"
      transform={`translate(${originX - fx}, ${originY - fy})`}
    >
      {/* Foundation tiles. */}
      <g className="bp-foundations">
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => (
            <rect
              key={`f-${r}-${c}`}
              className="bp-foundation"
              x={fx + c * FOUNDATION_TILE}
              y={fy + r * FOUNDATION_TILE}
              width={FOUNDATION_TILE}
              height={FOUNDATION_TILE}
            />
          )),
        )}
      </g>
      {/* Machine row (true-size rects). */}
      <g className="bp-machines">
        {site.layout.machines.map((m, i) => (
          <rect key={`m-${i}`} x={m.x} y={m.y} width={m.w} height={m.h} />
        ))}
      </g>
      {/* Site chrome: name + the stage power line, above the foundation bbox. */}
      <text className="chain-bp-name" x={fx} y={fy - 20}>
        {name}
      </text>
      {powerText !== null && (
        <text className="chain-bp-power" x={fx} y={fy - 6}>
          {powerText}
        </text>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Inter-site connector — a straight line (dashed for vehicle modes) + label.
// ---------------------------------------------------------------------------

function Connector({ conn }: { conn: ChainConnector }) {
  const midX = (conn.from.x + conn.to.x) / 2;
  const midY = (conn.from.y + conn.to.y) / 2;
  return (
    <g className="chain-bp-connector">
      <line
        className={
          conn.dashed ? "chain-bp-link chain-bp-link-dashed" : "chain-bp-link"
        }
        x1={conn.from.x}
        y1={conn.from.y}
        x2={conn.to.x}
        y2={conn.to.y}
      />
      <text className="chain-bp-link-label" x={midX} y={midY - 4}>
        {conn.label}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Pure derivation — the whole combined view from the store slice (Axes 1–4).
// ---------------------------------------------------------------------------

interface SiteChrome {
  stageId: string;
  name: string;
  powerText: string | null;
}

interface ChainView {
  sites: ChainSite[];
  chain: ChainLayout;
  connectors: ChainConnector[];
  chrome: SiteChrome[];
  skippedCount: number;
  footerText: string;
}

/**
 * Derive the whole combined view (solved-only): one ChainSite per SOLVED stage
 * (unsolved/invalid stages skipped + counted), the world-dm layout, the
 * inter-site connectors, per-site chrome, and the power footer. Pure over the
 * passed slice — no store, no DOM.
 */
export function deriveChainView(
  catalog: Catalog,
  stages: Record<string, StageNode>,
  stageOrder: string[],
  links: StageLink[],
  positions: Record<string, { x: number; y: number }>,
): ChainView {
  const solvedIds = solvedStageIds(stages, stageOrder);
  const skippedCount = stageOrder.length - solvedIds.length;

  const sites = buildChainSites(catalog, stages, solvedIds);
  const chain = buildChain(sites, solvedIds, positions);
  const connectors = chainConnectors(chain, sites, links, catalog, stages);

  const chrome: SiteChrome[] = solvedIds.map((id) => {
    const stage = stages[id]!;
    return {
      stageId: id,
      name: stage.name,
      powerText: stagePowerTextFor(catalog, stage),
    };
  });

  const footerText = buildFooterText(catalog, stages, stageOrder, links);

  return { sites, chain, connectors, chrome, skippedCount, footerText };
}

/**
 * The footer line "Sites <Σ> · transport <Y> MW[ (+ trains — see per-link)]".
 * The sites term follows advice.ts's chainPowerText discipline (exact at 100%
 * clock, labeled-≈ when any stage overclocks; "—" when no stage bills power);
 * the transport term is the exact Fraction sum of determinate links, with the
 * train note appended when any train link is present.
 */
function buildFooterText(
  catalog: Catalog,
  stages: Record<string, StageNode>,
  stageOrder: string[],
  links: StageLink[],
): string {
  const stageList = stageOrder
    .map((id) => stages[id])
    .filter((s): s is StageNode => s !== undefined);
  const sitesText = chainPowerText(stageList, catalog) ?? "—";
  const { transportMw, hasTrain } = chainTransportPower(links, catalog, stages);
  const trainNote = hasTrain ? " (+ trains — see per-link)" : "";
  return `Sites ${sitesText} · transport ${formatRate(transportMw)} MW${trainNote}`;
}
