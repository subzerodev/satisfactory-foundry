/**
 * Pure store→React-Flow projection (Stage 3 / Phase 2). `graphToFlow` maps the
 * store's graph slice to the { nodes, edges } React Flow renders; `pickLinkItem`
 * resolves the single item a connect gesture should carry. Both are PURE and
 * carry ZERO React Flow imports — the emitted objects are plain,
 * structurally-typed shapes RF happens to accept, so the whole mapping is
 * node-testable without a DOM (frozen brainstorm Axis 2 / Axis 5).
 *
 * The catalog is a REQUIRED argument (r1 fold): recipe/item display names are
 * `catalog.recipes[id].displayName` / `catalog.items[id].displayName` lookups,
 * underivable from the graph slice alone. Frozen spec:
 * features/chained-stages/phase-2/brainstorm.md.
 */

import { formatRate } from "./format.ts";
import { suggestSupply, stagePowerTextFor } from "./advice.ts";
import { computeLinkTransport } from "../core/transport-plan.ts";
import type { TransportPlan } from "../core/transport-plan.ts";
import { deriveLinkPlan } from "../core/link-plan.ts";
import type { ReadyLinkPlan } from "../core/link-plan.ts";
import {
  edgeChip,
  routeEdgeChip,
  unsustainableTrainRow,
  unsustainableTrainText,
} from "./transport-text.ts";
import { Fraction } from "../core/fraction.ts";
import type { Catalog } from "../data/types.ts";
import type { CatalogRecipe } from "../data/types.ts";
import type {
  StageNode,
  StageLink,
  SolveState,
  FlowDirection,
} from "../state/store.ts";
import type { LinkFinding } from "../core/reconcile.ts";

// ---------------------------------------------------------------------------
// Node / edge sizing (frozen Axis 2 — required by the runtime canvas, not SSR).
// ---------------------------------------------------------------------------

/** Card footprint. RF needs sized nodes for controlled layout + edge routing. */
export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 96;

/**
 * Raw-feed supply-card footprint (Stage 11 / Phase 1, ticket #57). Independent
 * of NODE_WIDTH/HEIGHT so a future stage-size change never silently misaligns
 * the feeds. BOTH are set as the RF node objects' width/height so fitView and
 * the direction-switch re-frame include feed nodes in the bounding box (a
 * zero-extent node would mis-frame the chart).
 */
export const RAW_NODE_WIDTH = 150;
export const RAW_NODE_HEIGHT = 44;

/**
 * The data a StageNode card renders. `recipeName` is null for a recipe-less
 * stage (the ＋stage default) → the card shows a "no recipe" placeholder;
 * `machineCount` is still carried (the card blanks it as a display choice, r3),
 * `findingCount` still counts incident link findings even when recipe-less — a
 * persisted link can outlive its endpoint's recipe and its dangling finding
 * must stay visible (r3).
 */
export interface StageNodeData {
  name: string;
  recipeName: string | null;
  /** The producing machine's display name, or its raw id when the recipe's
   *  machineId is off the catalog's machine table (the Blueprint's
   *  "footprint unknown" path proves that reachable). Null ONLY when the stage
   *  is recipe-less — same nullability as recipeName, so a non-null recipeName
   *  always carries a non-null machineName (the tile never renders "×N " bare).
   */
  machineName: string | null;
  machineCount: number;
  solveStatus: SolveState["status"];
  findingCount: number;
  /** The stage's power-draw line (Stage 6 / Phase 2), or null. Non-null ONLY
   *  for a SOLVED stage whose recipe's machine carries power data — recipe-less,
   *  idle, and invalid stages are null (uniform with SummaryCards + the Σ). */
  powerText: string | null;
}

/**
 * A node handle (node-side, so RF12 can route/SSR edges). `x`/`y` are
 * node-relative geometry: with them present, RF's parseHandles computes
 * handleBounds directly from the node object — no DOM measurement needed
 * (measurement never re-fires after a structure resync, so connections
 * depend on this).
 */
export interface FlowHandle {
  id: string;
  type: "source" | "target";
  position: "left" | "right" | "top" | "bottom";
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A React-Flow node, structurally typed (no RF import). `width`/`height` +
 * node-side `handles` live on the object itself (r1 fold — the runtime canvas
 * needs sized nodes for controlled layout and node-side handles to route edges;
 * SSR is opportunistic upside only).
 */
export interface FlowNode {
  id: string;
  type: "stage";
  position: { x: number; y: number };
  width: number;
  height: number;
  handles: FlowHandle[];
  selected: boolean;
  data: StageNodeData;
}

/** The reconciliation flavor an edge carries — drives the edge's styling. */
export type EdgeState =
  "ok" | "under-supply" | "over-supply" | "dangling" | "problem";

/** A React-Flow edge, structurally typed (no RF import). */
export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  data: { state: EdgeState };
}

/**
 * A derived raw-feed supply node (Stage 11 / Phase 1, ticket #57) — display-only
 * chrome, never stored/placed/persisted. `width`/`height` carry the raw-card
 * footprint (RAW_NODE_*), so fitView frames feeds. One `source` handle mirrors
 * the stageHandles geometry at the raw dims (right in LR, bottom in TB). `data`
 * carries the pre-formatted card lines — the derive owns all formatting so the
 * card component stays a thin renderer.
 */
export interface RawFlowNode {
  id: string;
  type: "rawFeed";
  position: { x: number; y: number };
  width: number;
  height: number;
  handles: FlowHandle[];
  data: {
    stageId: string;
    itemId: string;
    demand: Fraction;
    itemName: string;
    rateText: string;
  };
}

/** A derived raw-feed edge (Stage 11 / Phase 1): the dashed hairline from a
 *  supply card to its consuming stage's `in` handle. `className` "edge-raw"
 *  drives the lighter-than-lane styling; no state (raw feeds never reconcile). */
export interface RawFlowEdge {
  id: string;
  source: string;
  target: string;
  className: string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /**
   * Raw-feed supply nodes + edges (Stage 11 / Phase 1) — a SEPARATE field, NOT
   * appended to `nodes`/`edges`, so every existing graph-flow/store pin (node
   * counts, edge sets) stays byte-stable. GraphCanvas concatenates these at the
   * `<ReactFlow nodes={...}>` prop OUTSIDE the useState/merge machinery.
   */
  rawFeeds: { nodes: RawFlowNode[]; edges: RawFlowEdge[] };
}

// ---------------------------------------------------------------------------
// pickLinkItem — the connect-time item resolver (pure over two recipes).
// ---------------------------------------------------------------------------

/**
 * The single item a producer→consumer link should carry: the item the producer
 * OUTPUTS that the consumer also INPUTS. Exactly one match → its itemId; zero
 * matches → "none"; more than one → "ambiguous" (the caller refuses with a
 * notice). Pure over the two RESOLVED CatalogRecipes (r1 fold — the caller
 * resolves both via the catalog first; a null-recipe endpoint never reaches
 * here, the gesture is refused upstream).
 */
export function pickLinkItem(
  producer: CatalogRecipe,
  consumer: CatalogRecipe,
): string | "none" | "ambiguous" {
  const consumerInputs = new Set(consumer.inputs.map((io) => io.itemId));
  const matches: string[] = [];
  for (const out of producer.outputs) {
    if (consumerInputs.has(out.itemId)) {
      matches.push(out.itemId);
    }
  }
  if (matches.length === 0) return "none";
  if (matches.length > 1) return "ambiguous";
  return matches[0]!;
}

// ---------------------------------------------------------------------------
// graphToFlow — the store→RF projection.
// ---------------------------------------------------------------------------

/**
 * Column-flow slot for an auto-placed node when the positions map has no entry
 * (belt-and-braces: the store auto-places on addStage, so every stage normally
 * has a position; a stage without one falls back to a stable origin). Positions
 * are the authoritative source; this only guards against a missing key.
 */
const FALLBACK_POSITION = { x: 40, y: 40 };

/**
 * The node-side handles every stage card carries (one source, one target),
 * oriented by `direction` (Stage 10 / Phase 1) — geometry mirrors the rendered
 * Handle elements (6px squares straddling the border). LR centers them on the
 * card's left/right edges (target left / source right, today's geometry); TB
 * centers them on the top/bottom edges (target top / source bottom), the same
 * HANDLE_SIZE straddle math transposed. RF derives handleBounds from this
 * node-side geometry, so it MUST match the rendered <Handle> sides exactly.
 */
const HANDLE_SIZE = 6;
function stageHandles(direction: FlowDirection): FlowHandle[] {
  if (direction === "TB") {
    // Centered horizontally, straddling the top (target) and bottom (source).
    const x = NODE_WIDTH / 2 - HANDLE_SIZE / 2;
    return [
      {
        id: "in",
        type: "target",
        position: "top",
        x,
        y: -HANDLE_SIZE / 2,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
      },
      {
        id: "out",
        type: "source",
        position: "bottom",
        x,
        y: NODE_HEIGHT - HANDLE_SIZE / 2,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
      },
    ];
  }
  // LR (default): centered vertically, straddling the left (target) / right
  // (source) edges — today's geometry, unchanged.
  const y = NODE_HEIGHT / 2 - HANDLE_SIZE / 2;
  return [
    {
      id: "in",
      type: "target",
      position: "left",
      x: -HANDLE_SIZE / 2,
      y,
      width: HANDLE_SIZE,
      height: HANDLE_SIZE,
    },
    {
      id: "out",
      type: "source",
      position: "right",
      x: NODE_WIDTH - HANDLE_SIZE / 2,
      y,
      width: HANDLE_SIZE,
      height: HANDLE_SIZE,
    },
  ];
}

/**
 * Count the incident link findings for a stage: any reconciliation finding
 * whose link touches this stage as producer or consumer. Recipe-less stages
 * still count — a dangling link on a null-recipe endpoint must stay visible.
 */
function findingCountFor(
  stageId: string,
  links: StageLink[],
  reconciliation: LinkFinding[],
): number {
  const incidentLinkIds = new Set(
    links
      .filter((l) => l.fromStageId === stageId || l.toStageId === stageId)
      .map((l) => l.id),
  );
  return reconciliation.filter((f) => incidentLinkIds.has(f.linkId)).length;
}

/** Resolve a stage's recipe display name, or null when recipe-less/dangling. */
function recipeNameOf(catalog: Catalog, stage: StageNode): string | null {
  const id = stage.selection.recipeId;
  if (id === null) return null;
  return catalog.recipes[id]?.displayName ?? null;
}

/** The producing machine's display name for the tile, or null under the SAME
 *  conditions recipeNameOf returns null (no recipeId, or a dangling id) — so
 *  machineName and recipeName share nullability and the tile never shows a bare
 *  "×N ". For a resolved recipe whose machineId is off the catalog's machine
 *  table (reachable — the Blueprint's "footprint unknown" path), fall back to
 *  the raw machineId string per machineNameFor's precedent, never null. */
function machineNameOf(catalog: Catalog, stage: StageNode): string | null {
  const id = stage.selection.recipeId;
  if (id === null) return null;
  const recipe = catalog.recipes[id];
  if (recipe === undefined) return null;
  return catalog.machines[recipe.machineId]?.displayName ?? recipe.machineId;
}

/**
 * The match-demand suggestion for one under-supplied edge (Stage 6 / Phase 2):
 * the aggregate machine count that would cover the producer's WHOLE outgoing
 * load for the item, plus whether the producer fans out to more than one
 * consumer (which changes the wording). Null when the producer is unsolved /
 * lacks the output lane — then the edge shows its base under-supply label.
 */
export interface SupplySuggestion {
  machines: number;
  fanOut: boolean;
}

/**
 * Build one edge's label + state from the item's display name, the link's
 * reconciliation finding, and (for under-supply) the fan-out-aggregated supply
 * suggestion. Absence of a finding for the linkId IS "ok" (there is no "ok"
 * finding variant, r1 fold). The vocabulary maps the REAL reconcile union:
 * under-supply renders the exact shortfall + the suggestion; over-supply the
 * surplus (styled muted downstream, no suggestion — a surplus needs none);
 * dangling-link renders per its `end`.
 *
 * The under-supply suggestion suffix is "· ×N covers it" for a single consumer
 * and "· ×N total" when the producer fans the item out to more than one
 * consumer (the fan-out wording — "total" kills the per-edge misread). N is the
 * aggregate over ALL the producer's outgoing same-item links (frozen Axis 2 r1
 * BLOCKER fold). A null suggestion (unsolved producer) → the base label.
 */
function edgeLabelFor(
  itemName: string,
  finding: Exclude<LinkFinding, { type: "interstep-problem" }> | undefined,
  suggestion: SupplySuggestion | null,
): { label: string; state: EdgeState } {
  if (finding === undefined) {
    return { label: `${itemName} · ok`, state: "ok" };
  }
  switch (finding.type) {
    case "under-supply": {
      const base = `${itemName} · short ${formatRate(finding.shortfall)}/min`;
      if (suggestion === null) {
        return { label: base, state: "under-supply" };
      }
      const tail = suggestion.fanOut
        ? `· ×${suggestion.machines} total`
        : `· ×${suggestion.machines} covers it`;
      return { label: `${base} ${tail}`, state: "under-supply" };
    }
    case "over-supply":
      return {
        label: `${itemName} · +${formatRate(finding.surplus)}/min surplus`,
        state: "over-supply",
      };
    case "dangling-link":
      return {
        label: `${itemName} · dangling (${finding.end})`,
        state: "dangling",
      };
  }
}

/**
 * The fan-out-aggregated supply suggestion for a producer→item pair, or null
 * when the producer is unsolved / has no output lane for the item (frozen Axis
 * 2). N = ceilDiv( Σ totalDemand over ALL the producer's outgoing links for
 * this item on SOLVED consumers, producer lane's perMachineOutput ). An
 * unsolved/dangling sibling has no demand lane and is skipped from the Σ (the
 * no-invented-numbers invariant). fanOut is true when the producer has more
 * than one outgoing link for the item — the wording tell.
 *
 * The sibling demand is read UNIFORMLY from each consumer's totalDemand (the
 * same source mapLinkInputs reads), so all siblings agree by construction.
 */
export function supplySuggestionFor(
  producerId: string,
  itemId: string,
  stages: Record<string, StageNode>,
  links: StageLink[],
): SupplySuggestion | null {
  const producer = stages[producerId];
  if (producer === undefined || producer.solve.status !== "solved") {
    return null;
  }
  const outLane = producer.solve.result.outputs.find(
    (o) => o.itemId === itemId,
  );
  if (outLane === undefined) {
    return null;
  }
  // All the producer's outgoing links carrying this item — the fan-out set.
  const siblings = links.filter(
    (l) => l.fromStageId === producerId && l.itemId === itemId,
  );
  let totalDemand = Fraction.from(0);
  for (const sib of siblings) {
    const consumer = stages[sib.toStageId];
    if (consumer === undefined || consumer.solve.status !== "solved") {
      continue; // unsolved/dangling sibling has no lane → skipped from the Σ
    }
    const feed = consumer.solve.result.feeds.find((f) => f.itemId === itemId);
    if (feed === undefined) continue;
    totalDemand = totalDemand.add(feed.totalDemand);
  }
  const suggestion = suggestSupply(totalDemand, outLane.perMachineOutput);
  if (suggestion === null) {
    return null;
  }
  return { machines: suggestion.machines, fanOut: siblings.length > 1 };
}

/**
 * A link's required transport rate: the CONSUMER's totalDemand for the item
 * (what must arrive over the route — the same solved-only demand S6 power reads),
 * or null when the consumer is unsolved / lacks the feed lane. This is the rate
 * the transport fleet math sizes against (frozen Axis 3, solved-only).
 */
export function linkRequiredRate(
  link: StageLink,
  stages: Record<string, StageNode>,
): Fraction | null {
  const consumer = stages[link.toStageId];
  if (consumer === undefined || consumer.solve.status !== "solved") {
    return null;
  }
  const feed = consumer.solve.result.feeds.find(
    (f) => f.itemId === link.itemId,
  );
  return feed?.totalDemand ?? null;
}

/**
 * The plan-global unlocked tier counts (belt/pipe). unlockedTiers is a plan-
 * global invariant (the store stamps identical tiers over every stage), so any
 * stage's copy is canonical; fall back to the full table when no stage exists.
 */
export function globalUnlockedTiers(
  catalog: Catalog,
  stages: Record<
    string,
    { selection: { unlockedTiers: { belt: number; pipe: number } } }
  >,
): { belt: number; pipe: number } {
  const any = Object.values(stages)[0];
  if (any !== undefined) return any.selection.unlockedTiers;
  return { belt: catalog.tiers.belt.length, pipe: catalog.tiers.pipe.length };
}

/**
 * The fleet plan for one link (#34): the shared resolve preamble the five
 * transport surfaces each hand-rolled, folded to one home beside
 * linkRequiredRate + globalUnlockedTiers. Resolves the link's required rate,
 * the flowing item, and the plan-global tiers, then defers to the five-arg
 * computeLinkTransport.
 *
 * Ordinary links return null only when the item is missing from the catalog.
 * Interstep links return null when their canonical derivation is unavailable.
 * An unsolved rate flows THROUGH as computeLinkTransport's
 * `{ kind: "unsolved" }` plan (null-on-unsolved would erase the inspector's
 * "solve both stages to size the fleet" line), and a belt / absent-transport
 * link resolves via computeLinkTransport's belt default (null-on-belt would
 * erase the inspector's belt fleet lines). The five call sites keep their OWN
 * pre-filters (chip belt-skip, findings train-only, power belt/pipe-skip,
 * LinkInspector's early returns) — this folds the RESOLUTION, not the
 * per-surface filtering.
 */
export function planForLink(
  link: StageLink,
  catalog: Catalog,
  stages: Record<string, StageNode>,
): TransportPlan | null {
  if (link.interstep !== undefined) {
    const plan = deriveLinkPlan(catalog, link, stages);
    return plan.status === "ready" ? plan.forwardTransport : null;
  }
  const item = catalog.items[link.itemId];
  if (item === undefined) return null;
  return computeLinkTransport(
    linkRequiredRate(link, stages),
    link.transport,
    item,
    catalog.tiers,
    globalUnlockedTiers(catalog, stages),
  );
}

/**
 * The transport chip suffix for one link's edge label ("· 3 trucks", "≈" when
 * estimated), or "" when the link is belt-mode / unsolved / errored — the belt
 * case renders exactly as today. Belt-skips per-surface, then defers to the
 * shared planForLink resolver + the pure edgeChip helper.
 */
function transportChipFor(
  link: StageLink,
  catalog: Catalog,
  stages: Record<string, StageNode>,
): string {
  if (link.interstep !== undefined) {
    const plan = readyInterstepPlan(link, catalog, stages);
    if (plan === null) return "";
    return [
      routeEdgeChip("forward", plan.forwardTransport),
      routeEdgeChip("empty return", plan.returnTransport),
    ]
      .filter((chip): chip is string => chip !== null)
      .map((chip) => ` ${chip}`)
      .join("");
  }
  // Belt default (absent transport) never chips — the today-unchanged path.
  if (link.transport === undefined || link.transport.mode === "belt") {
    return "";
  }
  const plan = planForLink(link, catalog, stages);
  if (plan === null) return ""; // item missing from the catalog
  const chip = edgeChip(plan);
  return chip === null ? "" : ` ${chip}`;
}

function readyInterstepPlan(
  link: StageLink,
  catalog: Catalog,
  stages: Record<string, StageNode>,
): ReadyLinkPlan | null {
  const plan = deriveLinkPlan(catalog, link, stages);
  return plan.status === "ready" ? plan : null;
}

/**
 * The power-draw line for a stage's card (Stage 6 / Phase 2), or null. Non-null
 * ONLY for a SOLVED stage whose recipe resolves to a machine carrying power
 * data. The clock Fraction is parsed from the stage's clockPercentText at this
 * site (a re-parse; the store already validated it to reach 'solved', so a
 * malformed value is unreachable here — guarded to null defensively). Uniform
 * with SummaryCards + the chain Σ: recipe-less / idle / invalid → null.
 */
function powerTextOf(catalog: Catalog, stage: StageNode): string | null {
  // Delegates to the one test-pinned resolver (simplify fold): the solved
  // gate, prototype-safe lookups, and clock parse live in advice.ts.
  return stagePowerTextFor(catalog, stage);
}

/**
 * The single `source` handle a raw-feed supply card carries (Stage 11 / Phase
 * 1) — the stageHandles source-side geometry transposed to the raw dims. LR
 * puts it on the right edge (feeding the stage to its right), TB on the bottom
 * (feeding the stage below). Only a source handle: feed cards emit, never
 * receive (their handles accept no connections — isConnectable false at render).
 */
function rawFeedHandle(direction: FlowDirection): FlowHandle {
  if (direction === "TB") {
    return {
      id: "out",
      type: "source",
      position: "bottom",
      x: RAW_NODE_WIDTH / 2 - HANDLE_SIZE / 2,
      y: RAW_NODE_HEIGHT - HANDLE_SIZE / 2,
      width: HANDLE_SIZE,
      height: HANDLE_SIZE,
    };
  }
  return {
    id: "out",
    type: "source",
    position: "right",
    x: RAW_NODE_WIDTH - HANDLE_SIZE / 2,
    y: RAW_NODE_HEIGHT / 2 - HANDLE_SIZE / 2,
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
  };
}

/**
 * Derive the display-only raw-feed supply nodes + edges for the whole graph
 * (Stage 11 / Phase 1, ticket #57). For each SOLVED stage, each recipe input
 * item that (1) the game declares extraction-level (`isRawResource === true`)
 * and (2) has NO incoming StageLink for that item emits one supply card + one
 * dashed edge to the stage's `in` handle. The rate is the solve's own number —
 * `feeds.find(...).totalDemand` (the store's :547-551 lookup) — no re-derivation.
 * Unsolved / recipe-less / invalid stages emit nothing (manifold data only
 * exists on a solved stage). Positions are DERIVED from the consuming stage's
 * live position each render, so feeds follow drags + direction switches for free.
 */
function deriveRawFeeds(
  catalog: Catalog,
  stages: Record<string, StageNode>,
  stageOrder: string[],
  links: StageLink[],
  positions: Record<string, { x: number; y: number }>,
  flowDirection: FlowDirection,
): { nodes: RawFlowNode[]; edges: RawFlowEdge[] } {
  const nodes: RawFlowNode[] = [];
  const edges: RawFlowEdge[] = [];

  for (const stageId of stageOrder) {
    const stage = stages[stageId];
    // Only SOLVED stages carry the feeds the rate is read from; a recipe-less /
    // unsolved / invalid stage has no manifold data → no feed cards.
    if (stage === undefined || stage.solve.status !== "solved") continue;
    const recipeId = stage.selection.recipeId;
    if (recipeId === null) continue;
    const recipe = catalog.recipes[recipeId];
    if (recipe === undefined) continue;

    const feeds = stage.solve.result.feeds;
    const pos = positions[stageId] ?? { ...FALLBACK_POSITION };

    // The stage's i-th qualifying raw input — i drives the fan-out pitch.
    let i = 0;
    for (const input of recipe.inputs) {
      const itemId = input.itemId;
      // Condition 1: the game's own extraction-level declaration.
      if (catalog.items[itemId]?.isRawResource !== true) continue;
      // Condition 2: no incoming lane for this item (a linked-but-under-supplied
      // lane is the LANE's story — a feed card beside it would conflict).
      const linked = links.some(
        (l) => l.toStageId === stageId && l.itemId === itemId,
      );
      if (linked) continue;

      // The rate: the solve's own totalDemand (the store's feeds lookup). A
      // qualifying input with no matching feed lane is skipped (no rate to show).
      const feed = feeds.find((f) => f.itemId === itemId);
      if (feed === undefined) continue;

      const itemName = catalog.items[itemId]?.displayName ?? itemId;
      const rateText = `${formatRate(feed.totalDemand)}/min`;

      // Position derived from the consuming stage: LR to the left, TB above.
      // 54px pitch clears the 44px card; −190 in LR clears the 220-wide stage.
      const position =
        flowDirection === "TB"
          ? { x: pos.x, y: pos.y - (90 + i * 54) }
          : { x: pos.x - 190, y: pos.y + i * 54 };

      nodes.push({
        id: `raw:${stageId}:${itemId}`,
        type: "rawFeed",
        position,
        width: RAW_NODE_WIDTH,
        height: RAW_NODE_HEIGHT,
        handles: [rawFeedHandle(flowDirection)],
        data: {
          stageId,
          itemId,
          demand: feed.totalDemand,
          itemName,
          rateText,
        },
      });
      edges.push({
        id: `rawedge:${stageId}:${itemId}`,
        source: `raw:${stageId}:${itemId}`,
        target: stageId,
        className: "edge-raw",
      });
      i++;
    }
  }

  return { nodes, edges };
}

/**
 * Project the store graph slice to React Flow's { nodes, edges }. Node ids are
 * stage ids in `stageOrder` (stable canvas ordering); edge ids are link ids.
 * `activeStageId` sets exactly one node's `selected`. `flowDirection` (Stage 10 /
 * Phase 1, default "LR") orients each node's handle geometry — RF's handleBounds
 * source — so it must match the rendered <Handle> sides. Item/recipe display
 * names come from the catalog (required argument). Pure — no RF, no DOM, no store.
 */
export function graphToFlow(
  catalog: Catalog,
  stages: Record<string, StageNode>,
  stageOrder: string[],
  links: StageLink[],
  reconciliation: LinkFinding[],
  positions: Record<string, { x: number; y: number }>,
  activeStageId: string,
  flowDirection: FlowDirection = "LR",
): FlowGraph {
  const nodes: FlowNode[] = stageOrder
    .filter((id) => stages[id] !== undefined)
    .map((id) => {
      const stage = stages[id]!;
      return {
        id,
        type: "stage",
        position: positions[id] ?? { ...FALLBACK_POSITION },
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        handles: stageHandles(flowDirection),
        selected: id === activeStageId,
        data: {
          name: stage.name,
          recipeName: recipeNameOf(catalog, stage),
          machineName: machineNameOf(catalog, stage),
          machineCount: stage.selection.machineCount,
          solveStatus: stage.solve.status,
          findingCount: findingCountFor(id, links, reconciliation),
          powerText: powerTextOf(catalog, stage),
        },
      };
    });

  const findingsByLink = new Map<string, LinkFinding[]>();
  for (const f of reconciliation) {
    const current = findingsByLink.get(f.linkId) ?? [];
    current.push(f);
    findingsByLink.set(f.linkId, current);
  }

  const edges: FlowEdge[] = links.map((link) => {
    const itemName = catalog.items[link.itemId]?.displayName ?? link.itemId;
    const linkFindings = findingsByLink.get(link.id) ?? [];
    const finding = linkFindings.find(
      (
        candidate,
      ): candidate is Exclude<LinkFinding, { type: "interstep-problem" }> =>
        candidate.type !== "interstep-problem",
    );
    const problem = linkFindings.find(
      (
        candidate,
      ): candidate is Extract<LinkFinding, { type: "interstep-problem" }> =>
        candidate.type === "interstep-problem",
    );
    // The fan-out suggestion is only meaningful for an under-supplied edge;
    // compute it lazily so a solved-clean or dangling edge costs nothing.
    const suggestion =
      finding?.type === "under-supply"
        ? supplySuggestionFor(link.fromStageId, link.itemId, stages, links)
        : null;
    const material = edgeLabelFor(itemName, finding, suggestion);
    const label =
      problem === undefined
        ? material.label
        : `${material.label} · packaging problem: ${problem.error}`;
    const state: EdgeState = problem === undefined ? material.state : "problem";
    // Append the transport chip for a configured non-belt link (Stage 7 P2);
    // belt links append nothing, so they render exactly as today.
    const chip = transportChipFor(link, catalog, stages);
    return {
      id: link.id,
      source: link.fromStageId,
      target: link.toStageId,
      label: label + chip,
      data: { state },
    };
  });

  // Raw-feed supply cards (Stage 11 / Phase 1) — why a separate field: see
  // FlowGraph.rawFeeds.
  const rawFeeds = deriveRawFeeds(
    catalog,
    stages,
    stageOrder,
    links,
    positions,
    flowDirection,
  );

  return { nodes, edges, rawFeeds };
}

/**
 * The plan-wide transport findings (Stage 7 / Phase 2, frozen Axis 4): the sole
 * `transport-rate-unsustainable` case — a SOLVED train link whose required rate
 * exceeds what one station pair sustains at any consist size. Each returns a
 * pre-worded sentence (via `unsustainableTrainText`, whose belt-feed hint is
 * gated on the binding row's `ceilingBound`). Non-train / unsolved / sustainable
 * links contribute nothing (the single-finding discipline — no invented caps).
 * Wording lives here so FindingsPanel stays a thin renderer of the sentences.
 */
export function computeTransportFindings(
  catalog: Catalog,
  stages: Record<string, StageNode>,
  links: StageLink[],
): string[] {
  const findings: string[] = [];
  for (const link of links) {
    if (link.interstep !== undefined) {
      const derived = readyInterstepPlan(link, catalog, stages);
      if (derived === null) continue;
      addTrainFinding(
        findings,
        "Forward ",
        catalog.items[derived.packagedItemId]?.displayName ??
          derived.packagedItemId,
        derived.cargoDemand,
        derived.forwardTransport,
      );
      addTrainFinding(
        findings,
        "Empty return ",
        catalog.items[derived.containerItemId]?.displayName ??
          derived.containerItemId,
        derived.containerReturnRate,
        derived.returnTransport,
      );
      continue;
    }
    // Pre-filters stay per-surface: the cheap train-only skip before the call
    // (a non-train link is never a finding), and the rate-null skip below
    // (solved-only fleet math). rate is also a downstream input to the
    // sustainability row/text, so it is resolved here rather than folded away.
    if (link.transport?.mode !== "train") continue;
    const rate = linkRequiredRate(link, stages);
    if (rate === null) continue; // unsolved → no fleet math (solved-only)
    // #34: the resolve preamble folds to the shared planForLink. Its internal
    // globalUnlockedTiers equals the plan-global tiers this surface previously
    // threaded (stamped identically over every stage; the tiers value is never
    // consulted with zero stages, where no links exist to reach here). null
    // (missing item) is not a finding; the post-call kind check drops an
    // errored config (the rate-null skip already excluded the unsolved plan).
    const plan = planForLink(link, catalog, stages);
    if (plan === null || plan.kind !== "train") continue;
    const item = catalog.items[link.itemId]!; // non-null: planForLink resolved
    const row = unsustainableTrainRow(rate, plan.options);
    if (row === null) continue; // sustainable at some consist size
    findings.push(unsustainableTrainText(item.displayName, rate, row));
  }
  return findings;
}

function addTrainFinding(
  findings: string[],
  route: string,
  itemName: string,
  rate: Fraction | null,
  plan: TransportPlan,
): void {
  if (rate === null || plan.kind !== "train") return;
  const row = unsustainableTrainRow(rate, plan.options);
  if (row !== null) {
    findings.push(unsustainableTrainText(route + itemName, rate, row));
  }
}
