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
import { computeLinkTransport } from "./transport-plan.ts";
import {
  edgeChip,
  unsustainableTrainRow,
  unsustainableTrainText,
} from "./transport-text.ts";
import { Fraction } from "../core/fraction.ts";
import type { Catalog } from "../data/types.ts";
import type { CatalogRecipe } from "../data/types.ts";
import type { StageNode, StageLink, SolveState } from "../state/store.ts";
import type { LinkFinding } from "../core/reconcile.ts";

// ---------------------------------------------------------------------------
// Node / edge sizing (frozen Axis 2 — required by the runtime canvas, not SSR).
// ---------------------------------------------------------------------------

/** Card footprint. RF needs sized nodes for controlled layout + edge routing. */
export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 96;

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
  position: "left" | "right";
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
export type EdgeState = "ok" | "under-supply" | "over-supply" | "dangling";

/** A React-Flow edge, structurally typed (no RF import). */
export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  data: { state: EdgeState };
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
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
 * centered on the card's left/right edges — geometry mirrors the rendered
 * Handle elements (6px squares straddling the border).
 */
const HANDLE_SIZE = 6;
function stageHandles(): FlowHandle[] {
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

/**
 * The match-demand suggestion for one under-supplied edge (Stage 6 / Phase 2):
 * the aggregate machine count that would cover the producer's WHOLE outgoing
 * load for the item, plus whether the producer fans out to more than one
 * consumer (which changes the wording). Null when the producer is unsolved /
 * lacks the output lane — then the edge shows its base under-supply label.
 */
interface SupplySuggestion {
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
  finding: LinkFinding | undefined,
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
function supplySuggestionFor(
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
function globalUnlockedTiers(
  catalog: Catalog,
  stages: Record<string, StageNode>,
): { belt: number; pipe: number } {
  const any = Object.values(stages)[0];
  if (any !== undefined) return any.selection.unlockedTiers;
  return { belt: catalog.tiers.belt.length, pipe: catalog.tiers.pipe.length };
}

/**
 * The transport chip suffix for one link's edge label ("· 3 trucks", "≈" when
 * estimated), or "" when the link is belt-mode / unsolved / errored — the belt
 * case renders exactly as today. Resolves the link's required rate + the
 * flowing item's stackSize + the plan tiers, then defers to the pure
 * computeLinkTransport / edgeChip helpers.
 */
function transportChipFor(
  link: StageLink,
  catalog: Catalog,
  stages: Record<string, StageNode>,
): string {
  // Belt default (absent transport) never chips — the today-unchanged path.
  if (link.transport === undefined || link.transport.mode === "belt") {
    return "";
  }
  const item = catalog.items[link.itemId];
  if (item === undefined) return "";
  const rate = linkRequiredRate(link, stages);
  const plan = computeLinkTransport(
    rate,
    link.transport,
    item,
    catalog.tiers,
    globalUnlockedTiers(catalog, stages),
  );
  const chip = edgeChip(plan);
  return chip === null ? "" : ` ${chip}`;
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
 * Project the store graph slice to React Flow's { nodes, edges }. Node ids are
 * stage ids in `stageOrder` (stable canvas ordering); edge ids are link ids.
 * `activeStageId` sets exactly one node's `selected`. Item/recipe display names
 * come from the catalog (required argument). Pure — no RF, no DOM, no store.
 */
export function graphToFlow(
  catalog: Catalog,
  stages: Record<string, StageNode>,
  stageOrder: string[],
  links: StageLink[],
  reconciliation: LinkFinding[],
  positions: Record<string, { x: number; y: number }>,
  activeStageId: string,
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
        handles: stageHandles(),
        selected: id === activeStageId,
        data: {
          name: stage.name,
          recipeName: recipeNameOf(catalog, stage),
          machineCount: stage.selection.machineCount,
          solveStatus: stage.solve.status,
          findingCount: findingCountFor(id, links, reconciliation),
          powerText: powerTextOf(catalog, stage),
        },
      };
    });

  const findingByLink = new Map<string, LinkFinding>();
  for (const f of reconciliation) {
    findingByLink.set(f.linkId, f);
  }

  const edges: FlowEdge[] = links.map((link) => {
    const itemName = catalog.items[link.itemId]?.displayName ?? link.itemId;
    const finding = findingByLink.get(link.id);
    // The fan-out suggestion is only meaningful for an under-supplied edge;
    // compute it lazily so a solved-clean or dangling edge costs nothing.
    const suggestion =
      finding?.type === "under-supply"
        ? supplySuggestionFor(link.fromStageId, link.itemId, stages, links)
        : null;
    const { label, state } = edgeLabelFor(itemName, finding, suggestion);
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

  return { nodes, edges };
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
  unlockedTiers: { belt: number; pipe: number },
): string[] {
  const findings: string[] = [];
  for (const link of links) {
    if (link.transport?.mode !== "train") continue;
    const rate = linkRequiredRate(link, stages);
    if (rate === null) continue; // unsolved → no fleet math (solved-only)
    const item = catalog.items[link.itemId];
    if (item === undefined) continue;
    const plan = computeLinkTransport(
      rate,
      link.transport,
      item,
      catalog.tiers,
      unlockedTiers,
    );
    if (plan.kind !== "train") continue; // an errored config is not a finding
    const row = unsustainableTrainRow(rate, plan.options);
    if (row === null) continue; // sustainable at some consist size
    findings.push(unsustainableTrainText(item.displayName, rate, row));
  }
  return findings;
}
