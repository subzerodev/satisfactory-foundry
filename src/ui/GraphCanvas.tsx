/**
 * The stage-graph canvas (Stage 3 / Phase 2) — the ONLY module that imports
 * React Flow (including the global stylesheet). Everything the canvas renders is
 * DERIVED from the store via `graphToFlow`; RF owns nothing but the interim
 * drag position. Semi-controlled per the documented RF12 idiom (frozen Axis 2,
 * the applyNodeChanges pin): structure resyncs whenever the store's graph slice
 * changes; `onNodesChange` funnels through `applyNodeChanges` so RF keeps its
 * interim positions + `dragging` flag per frame; a position change arriving with
 * `dragging: false` (drag END) commits once to `setStagePosition`.
 *
 * Frozen spec: features/chained-stages/phase-2/brainstorm.md.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  Handle,
  Position,
  applyNodeChanges,
  useReactFlow,
} from "@xyflow/react";
import type {
  Node,
  Edge,
  NodeProps,
  NodeTypes,
  NodeChange,
  EdgeChange,
  Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useAppStore } from "../state/store.ts";
import { canLink } from "../state/store.ts";
import type {
  ExtractionSelection as StoredExtractionSelection,
  StageNode as StoredStageNode,
} from "../state/store.ts";
import type { Catalog } from "../data/types.ts";
import type { Fraction } from "../core/fraction.ts";
import {
  graphToFlow,
  pickLinkItem,
  NODE_WIDTH,
  NODE_HEIGHT,
  RAW_NODE_WIDTH,
  RAW_NODE_HEIGHT,
} from "./graph-flow.ts";
import type { StageNodeData, EdgeState, RawFlowNode } from "./graph-flow.ts";
import { chainPowerText } from "./advice.ts";
import {
  deriveExtractionPlan,
  standaloneExtractors,
} from "./extraction-plan.ts";
import { formatRate, tierLabel } from "./format.ts";

/**
 * The card's `data`: the pure StageNodeData plus the per-node callbacks the
 * canvas injects (RF passes `data` verbatim to the node component). Declared
 * with an index signature so it satisfies RF's `Node<Data extends
 * Record<string, unknown>>` constraint.
 */
interface StageCardData extends StageNodeData, Record<string, unknown> {
  removable: boolean;
  onRemove: () => void;
  onRename: (name: string) => void;
}

// A stage node carries StageCardData under RF's `data`; the custom card below
// renders it. The literal "stage" type binds it to the nodeTypes map.
type StageFlowNode = Node<StageCardData, "stage">;

// ---------------------------------------------------------------------------
// The custom StageNode card (frozen Axis 2 / Axis 3).
// ---------------------------------------------------------------------------

/**
 * One stage card. Renders name, the recipe (or a "no recipe" placeholder for a
 * recipe-less stage), the machine count (blanked when recipe-less — a display
 * choice), a solve-status tint, a finding badge, node-side handles, and a ✕
 * remove control (disabled at the last stage). Double-clicking the name enters
 * an inline rename. The remove/rename callbacks come through `data` extension
 * fields the canvas injects (RF passes `data` verbatim to the node component).
 */
function StageNode({ data, selected }: NodeProps<StageFlowNode>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.name);
  // Read the direction straight from the store (no per-node data churn, frozen
  // Axis 3): LR puts the target/source handles on the left/right edges, TB on the
  // top/bottom. These sides MUST match graphToFlow's node-side handle geometry
  // (RF's handleBounds source) — both are keyed off the same store field.
  const flowDirection = useAppStore((s) => s.flowDirection);
  const targetPos = flowDirection === "TB" ? Position.Top : Position.Left;
  const sourcePos = flowDirection === "TB" ? Position.Bottom : Position.Right;

  const commitRename = () => {
    setEditing(false);
    const next = draft.trim();
    if (next !== "" && next !== data.name) data.onRename(next);
    else setDraft(data.name);
  };

  return (
    <div
      className={`stage-node solve-${data.solveStatus}${selected ? " selected" : ""}`}
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
    >
      {/* Node-side handles enable RF's controlled layout + edge routing. Their
          sides follow the store's flowDirection (Stage 10 P1). */}
      <Handle type="target" position={targetPos} id="in" />
      <Handle type="source" position={sourcePos} id="out" />

      <header className="stage-node-head">
        {editing ? (
          <input
            className="stage-node-rename"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraft(data.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <span
            className="stage-node-name"
            onDoubleClick={() => {
              setDraft(data.name);
              setEditing(true);
            }}
          >
            {data.name}
          </span>
        )}
        <button
          className="stage-node-remove"
          title={
            data.removable ? "remove stage" : "the last stage can't be removed"
          }
          disabled={!data.removable}
          onClick={data.onRemove}
        >
          ✕
        </button>
      </header>

      <p className="stage-node-recipe">
        {data.recipeName ?? (
          <span className="stage-node-no-recipe">no recipe</span>
        )}
      </p>

      <footer className="stage-node-foot">
        {/* machineCount blanked when recipe-less (display choice, r3). The
            building name (#84) rides the same line — machineName is non-null
            whenever recipeName is, so no bare "×N " renders. */}
        {data.recipeName !== null && (
          <span className="stage-node-machines">
            ×{data.machineCount} {data.machineName}
            {/* the single interior space is load-bearing for the ×N Name pin */}
          </span>
        )}
        {data.findingCount > 0 && (
          <span className="stage-node-findings" title="link findings">
            {data.findingCount}
          </span>
        )}
      </footer>

      {/* The power-draw line (Stage 6 P2): rendered only for a solved+powered
          stage (powerText non-null), a small line under the count/findings. */}
      {data.powerText !== null && (
        <p className="stage-node-power">{data.powerText}</p>
      )}
    </div>
  );
}

/**
 * A raw-feed supply card's `data` (Stage 11 / Phase 1, ticket #57): the item
 * name over its exact demand rate, both pre-formatted by the graphToFlow derive.
 * Index signature satisfies RF's Node data constraint.
 */
interface RawFeedCardData extends Record<string, unknown> {
  stageId: string;
  itemId: string;
  demand: Fraction;
  itemName: string;
  rateText: string;
  onOpen: (identity: RawFeedIdentity) => void;
}

type RawFeedFlowNode = Node<RawFeedCardData, "rawFeed">;

export interface RawFeedIdentity {
  stageId: string;
  itemId: string;
}

export function projectRawFeedNode(
  node: RawFlowNode,
  onOpen: (identity: RawFeedIdentity) => void,
): RawFeedFlowNode {
  return {
    id: node.id,
    type: "rawFeed",
    position: node.position,
    width: node.width,
    height: node.height,
    handles: node.handles.map((handle) => ({
      ...handle,
      position: handle.position as Position,
    })),
    draggable: false,
    selectable: false,
    deletable: false,
    focusable: false,
    style: { pointerEvents: "all" },
    data: { ...node.data, onOpen },
  };
}

/**
 * One raw-feed supply card — the drafting "supply callout" for an extraction
 * input (Stage 11 / Phase 1). Item name (mono) over the demand rate line, no
 * controls: the card is non-interactive (draggable/selectable/deletable false
 * on the RF node). One SOURCE handle, its side following the store's
 * flowDirection (right in LR, bottom in TB) to mirror the stage card. The
 * handle takes no connections (isConnectable false — feeds emit, never link).
 */
export function RawFeedNode({ data }: NodeProps<RawFeedFlowNode>) {
  const flowDirection = useAppStore((s) => s.flowDirection);
  const sourcePos = flowDirection === "TB" ? Position.Bottom : Position.Right;
  return (
    <div
      className="raw-feed-node"
      style={{ width: RAW_NODE_WIDTH, height: RAW_NODE_HEIGHT }}
    >
      <Handle
        type="source"
        position={sourcePos}
        id="out"
        isConnectable={false}
      />
      <button
        type="button"
        className="raw-feed-node-button nodrag nopan"
        aria-haspopup="dialog"
        aria-label={`Plan extraction for ${data.itemName}, ${data.rateText.replace("/min", " per minute")} required`}
        data-raw-stage={data.stageId}
        data-raw-item={data.itemId}
        onClick={() =>
          data.onOpen({ stageId: data.stageId, itemId: data.itemId })
        }
      >
        <span className="raw-feed-node-item">{data.itemName}</span>
        <span className="raw-feed-node-rate">{data.rateText}</span>
      </button>
    </div>
  );
}

const NODE_TYPES: NodeTypes = { stage: StageNode, rawFeed: RawFeedNode };

export function GraphTopRightStack({
  notice,
  extraction,
}: {
  notice: string | null;
  extraction: ReactNode;
}) {
  return (
    <div className="graph-top-right-stack">
      {notice !== null && <p className="graph-canvas-notice">{notice}</p>}
      {extraction}
    </div>
  );
}

export interface ExtractionPanelProps {
  catalog: Catalog;
  rawNode: RawFlowNode;
  stage: StoredStageNode;
  selection: StoredExtractionSelection | null;
  onSetSelection: (selection: StoredExtractionSelection | null) => void;
  onClose: () => void;
}

export function ExtractionPanel({
  catalog,
  rawNode,
  stage,
  selection,
  onSetSelection,
  onClose,
}: ExtractionPanelProps) {
  const candidates = useMemo(
    () => standaloneExtractors(catalog, rawNode.data.itemId),
    [catalog, rawNode.data.itemId],
  );
  const primaryControlRef = useRef<HTMLSelectElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const headingId = `extraction-${rawNode.data.stageId}-${rawNode.data.itemId}`;
  const rawIdentity = `${rawNode.data.stageId}:${rawNode.data.itemId}`;
  const autoSeedAttemptedFor = useRef<string | null>(null);
  const autoSeedsStandalone =
    rawNode.data.itemId === "water" || rawNode.data.itemId === "liquid_oil";

  useEffect(() => {
    const target = primaryControlRef.current ?? closeRef.current;
    target?.focus();
  }, [rawNode.data.stageId, rawNode.data.itemId]);

  useEffect(() => {
    if (autoSeedAttemptedFor.current === rawIdentity) return;
    autoSeedAttemptedFor.current = rawIdentity;
    if (autoSeedsStandalone && selection === null && candidates.length === 1) {
      onSetSelection({
        machineId: candidates[0]!.machineId,
        clockPercentText: "100",
      });
    }
  }, [autoSeedsStandalone, candidates, onSetSelection, rawIdentity, selection]);

  const result = deriveExtractionPlan({
    catalog,
    itemId: rawNode.data.itemId,
    demand: rawNode.data.demand,
    selection,
    unlockedTiers: stage.selection.unlockedTiers,
  });
  const selectedAvailable =
    selection !== null &&
    candidates.some((candidate) => candidate.machineId === selection.machineId);
  const hasResourceWell = Object.values(catalog.extractors).some(
    (extractor) =>
      extractor.topology === "resource-well" &&
      extractor.itemIds.includes(rawNode.data.itemId),
  );

  const setMachine = (machineId: string) => {
    if (machineId === "") onSetSelection(null);
    else
      onSetSelection({
        machineId,
        clockPercentText: selection?.clockPercentText ?? "100",
        ...(selection?.purityMix
          ? { purityMix: { ...selection.purityMix } }
          : {}),
      });
  };

  const setPurityEnabled = (enabled: boolean) => {
    if (selection === null || result.status !== "planned") return;
    if (enabled) {
      onSetSelection({
        ...selection,
        purityMix: { impure: "0", normal: String(result.count), pure: "0" },
      });
      return;
    }
    const next = { ...selection };
    delete next.purityMix;
    onSetSelection(next);
  };

  const setPurityCount = (
    field: keyof NonNullable<StoredExtractionSelection["purityMix"]>,
    value: string,
  ) => {
    if (selection?.purityMix === undefined) return;
    onSetSelection({
      ...selection,
      purityMix: { ...selection.purityMix, [field]: value },
    });
  };

  return (
    <section
      className="extraction-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby={headingId}
    >
      <header className="extraction-panel-head">
        <h3 id={headingId}>EXTRACTION - {rawNode.data.itemName}</h3>
        <button
          ref={closeRef}
          type="button"
          className="extraction-panel-close"
          aria-label="Close extraction planning"
          title="close extraction planning"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <p className="extraction-required">
        {formatRate(rawNode.data.demand)}/min required
      </p>

      {candidates.length > 0 && (
        <div className="extraction-fields">
          <label>
            <span>Extractor</span>
            <select
              ref={primaryControlRef}
              value={selection?.machineId ?? ""}
              onChange={(event) => setMachine(event.target.value)}
            >
              <option value="">Select extractor</option>
              {!selectedAvailable && selection !== null && (
                <option value={selection.machineId} disabled>
                  Unavailable ({selection.machineId})
                </option>
              )}
              {candidates.map((candidate) => (
                <option key={candidate.machineId} value={candidate.machineId}>
                  {catalog.machines[candidate.machineId]?.displayName ??
                    candidate.machineId}
                </option>
              ))}
            </select>
          </label>
          {selection !== null && (
            <label>
              <span>Clock %</span>
              <input
                type="text"
                inputMode="decimal"
                value={selection.clockPercentText}
                onChange={(event) =>
                  onSetSelection({
                    ...selection,
                    clockPercentText: event.target.value,
                  })
                }
              />
            </label>
          )}
        </div>
      )}

      {result.status === "invalid-clock" && (
        <p className="extraction-error">{result.detail}</p>
      )}
      {result.status === "unavailable" && (
        <p className="extraction-error">{result.detail}</p>
      )}
      {result.status === "pick-extractor" && (
        <p className="extraction-muted">
          Choose an extractor to calculate the plan.
        </p>
      )}
      {result.status === "planned" && (
        <div className="extraction-result">
          <p>
            <strong>Normal baseline</strong>
          </p>
          <p>
            <strong>
              {result.count} ×{" "}
              {catalog.machines[selection!.machineId]?.displayName ??
                selection!.machineId}
            </strong>
          </p>
          <p>
            {formatRate(result.perExtractor)}/min each ·{" "}
            {formatRate(result.totalSupply)}/min supplied ·{" "}
            {formatRate(result.surplus)}/min spare
          </p>
          <p
            className={
              result.transport.status === "available"
                ? undefined
                : "extraction-warning"
            }
          >
            {transportText(result.transport, catalog)}
          </p>
          <p>Power: {result.powerText}</p>
          {rawNode.data.itemId !== "water" && (
            <>
              <label className="extraction-purity-toggle">
                <input
                  type="checkbox"
                  aria-label="Use node mix"
                  checked={selection!.purityMix !== undefined}
                  onChange={(event) => setPurityEnabled(event.target.checked)}
                />
                <span>Use node mix</span>
              </label>
              {selection!.purityMix !== undefined && (
                <>
                  <div className="extraction-purity-fields">
                    <label>
                      <span>Impure</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        aria-label="Impure nodes"
                        value={selection!.purityMix.impure}
                        onChange={(event) =>
                          setPurityCount("impure", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>Normal</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        aria-label="Normal nodes"
                        value={selection!.purityMix.normal}
                        onChange={(event) =>
                          setPurityCount("normal", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>Pure</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        aria-label="Pure nodes"
                        value={selection!.purityMix.pure}
                        onChange={(event) =>
                          setPurityCount("pure", event.target.value)
                        }
                      />
                    </label>
                  </div>
                  {result.purity?.status === "invalid" && (
                    <p className="extraction-error">{result.purity.detail}</p>
                  )}
                  {result.purity?.status === "planned" && (
                    <div className="extraction-purity-result">
                      <p>
                        <strong>{result.purity.nodeCount} nodes</strong>
                      </p>
                      <p>
                        {formatRate(result.purity.totalSupply)}/min supplied ·{" "}
                        {formatRate(result.purity.balance.amount)}/min{" "}
                        {result.purity.balance.status}
                      </p>
                      <p
                        className={
                          result.purity.transport.status !== "none" &&
                          result.purity.transport.status !== "available"
                            ? "extraction-warning"
                            : undefined
                        }
                      >
                        {result.purity.transport.status === "none"
                          ? "Output: no node output."
                          : transportText(result.purity.transport, catalog)}
                      </p>
                      <p>Power: {result.purity.powerText}</p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
      {hasResourceWell && rawNode.data.itemId !== "nitrogen_gas" && (
        <p className="extraction-muted">
          Resource Well alternative not counted in Phase 1; it needs a
          pressurizer and a map-specific satellite set.
        </p>
      )}
    </section>
  );
}

function transportText(
  transport: Extract<
    ReturnType<typeof deriveExtractionPlan>,
    { status: "planned" }
  >["transport"],
  catalog: Catalog,
): string {
  if (transport.status === "over-capacity") {
    return `Output: one extractor exceeds the highest ${transport.kind} tier.`;
  }
  const label = tierLabel(transport.kind, transport.capacity, catalog.tiers);
  const line = transport.kind === "belt" ? `${label} belt` : label;
  return transport.status === "available"
    ? `Output: ${line} or better`
    : `Output: ${line} required (not unlocked)`;
}

/**
 * The per-change commit decision from onNodesChange, extracted as a pure helper
 * so the raw-feed invariant is testable in the node-env suite (RF's real
 * onNodesChange can't fire without a DOM). A drag-END position commits to
 * `setStagePosition`; a selection commits to `setActiveStage`.
 *
 * The raw: id skip (Stage 11 P1, ticket #57) is the APP-LEVEL guard: raw-feed
 * cards are display-only chrome that must never reach either setter. RF's node
 * flags (draggable/selectable/deletable false) stop change GENERATION at
 * runtime, but the onNodesChange loop iterates the RAW `changes` array — the
 * flags never gate this path, so the skip is the only boundary guard (the r6
 * correctness re-check reversed the earlier F2 removal, source-decided against
 * the outside-the-state layer being sufficient here).
 */
export function commitNodeChange(
  c: NodeChange,
  setters: {
    setStagePosition: (id: string, pos: { x: number; y: number }) => void;
    setActiveStage: (id: string) => void;
  },
): void {
  if ("id" in c && c.id.startsWith("raw:")) return;
  if (c.type === "position" && c.dragging === false && c.position) {
    setters.setStagePosition(c.id, { x: c.position.x, y: c.position.y });
  }
  // Selection change → move the active cursor (store-authoritative).
  if (c.type === "select" && c.selected) {
    setters.setActiveStage(c.id);
  }
}

/**
 * The flow-direction toggle (Stage 10 / Phase 1). Lives INSIDE the ReactFlow
 * tree so it can call `useReactFlow().fitView()`: the static `fitView` prop only
 * seeds the INITIAL fit (fired once), so after a direction switch transposes the
 * layout 90° the viewport would stay on the old coordinates with nodes scrolled
 * out of frame. The effect keyed on `flowDirection` re-frames the chart after the
 * commit that rendered the re-slotted positions — skipping the initial mount so
 * it only fires on an ACTUAL change (the initial fit is the prop's job).
 */
function DirectionToggle() {
  const flowDirection = useAppStore((s) => s.flowDirection);
  const setFlowDirection = useAppStore((s) => s.setFlowDirection);
  const { fitView } = useReactFlow();

  // Skip the initial mount: fire fitView only when flowDirection actually
  // changes (the static fitView prop already handles the first frame).
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    void fitView();
  }, [flowDirection, fitView]);

  const next = flowDirection === "LR" ? "TB" : "LR";
  return (
    <button
      className="graph-add-stage"
      title={
        flowDirection === "LR"
          ? "flow left to right — click for top to bottom"
          : "flow top to bottom — click for left to right"
      }
      onClick={() => setFlowDirection(next)}
    >
      {flowDirection === "LR" ? "FLOW L→R" : "FLOW T↓B"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Edge styling — map the reconciliation state to a class.
// ---------------------------------------------------------------------------

const EDGE_CLASS: Record<EdgeState, string> = {
  ok: "edge-ok",
  "under-supply": "edge-under",
  "over-supply": "edge-over",
  dangling: "edge-dangling",
};

// ---------------------------------------------------------------------------
// The canvas component.
// ---------------------------------------------------------------------------

/** GraphCanvas' first prop (Stage 5 item 3): the theme, forwarded to ReactFlow's
 *  `colorMode` so the canvas surface tracks the app-level light/dark choice. */
interface GraphCanvasProps {
  colorMode: "light" | "dark";
}

export function GraphCanvas({ colorMode }: GraphCanvasProps) {
  const catalog = useAppStore((s) =>
    s.catalog.status === "ready" ? s.catalog.catalog : null,
  );
  const stages = useAppStore((s) => s.stages);
  const stageOrder = useAppStore((s) => s.stageOrder);
  const links = useAppStore((s) => s.links);
  const reconciliation = useAppStore((s) => s.reconciliation);
  const positions = useAppStore((s) => s.positions);
  const activeStageId = useAppStore((s) => s.activeStageId);
  const flowDirection = useAppStore((s) => s.flowDirection);

  const addStage = useAppStore((s) => s.addStage);
  const removeStage = useAppStore((s) => s.removeStage);
  const renameStage = useAppStore((s) => s.renameStage);
  const setActiveStage = useAppStore((s) => s.setActiveStage);
  const addLink = useAppStore((s) => s.addLink);
  const removeLink = useAppStore((s) => s.removeLink);
  const selectLink = useAppStore((s) => s.selectLink);
  const selectedLinkId = useAppStore((s) => s.selectedLinkId);
  const setStagePosition = useAppStore((s) => s.setStagePosition);
  const setExtractionSelection = useAppStore((s) => s.setExtractionSelection);

  // Component-local gesture feedback — NOT store state (meaningless headless).
  // Cleared at the next canvas gesture (success or refusal), no timers.
  const [canvasNotice, setCanvasNotice] = useState<string | null>(null);
  const [openRawFeed, setOpenRawFeed] = useState<RawFeedIdentity | null>(null);

  // The chain-wide power total (Stage 6 P2): "Σ ≈ X MW" over the solved+powered
  // stages, or null when none. Store-wired — GraphCanvas holds stages+catalog.
  const chainPower = useMemo(
    () =>
      catalog === null ? null : chainPowerText(Object.values(stages), catalog),
    [catalog, stages],
  );

  // The derived structure (nodes/edges) from the store graph slice. Recomputed
  // whenever any graph-slice input changes. This is the "structure" half of the
  // semi-controlled model; RF's interim drag position is merged in below.
  const derived = useMemo(() => {
    // An empty catalog can't resolve names; treat as an empty catalog shell so
    // graphToFlow still emits nodes (names fall back to raw ids for edges).
    const cat: Catalog = catalog ?? {
      items: {},
      machines: {},
      recipes: {},
      tiers: { belt: [], pipe: [] },
      recipeUnlocks: {},
      extractors: {},
    };
    return graphToFlow(
      cat,
      stages,
      stageOrder,
      links,
      reconciliation,
      positions,
      activeStageId,
      flowDirection,
    );
  }, [
    catalog,
    stages,
    stageOrder,
    links,
    reconciliation,
    positions,
    activeStageId,
    // flowDirection is load-bearing (frozen Axis 3): a fully-dragged plan (or a
    // pinned v1–v4 load) toggles with ZERO position change, so without this dep
    // the memo never recomputes and the node-side handle geometry — RF's
    // handleBounds source — stays on the old sides while the rendered <Handle>
    // elements flip. The dep is the whole fix.
    flowDirection,
  ]);

  // Inject the per-node card callbacks (remove/rename) + build RF nodes from the
  // pure FlowNodes. The last remaining stage is not removable (≥1 invariant).
  const removable = stageOrder.length > 1;
  const derivedNodes: StageFlowNode[] = useMemo(
    () =>
      derived.nodes.map((n) => ({
        id: n.id,
        type: "stage",
        position: n.position,
        width: n.width,
        height: n.height,
        // Node-side handle geometry: RF derives handleBounds from these (no
        // DOM measurement), which keeps connections alive across resyncs.
        handles: n.handles.map((h) => ({
          ...h,
          position: h.position as Position,
        })),
        selected: n.selected,
        data: {
          ...n.data,
          removable,
          onRemove: () => removeStage(n.id),
          onRename: (name: string) => renameStage(n.id, name),
        } as StageCardData,
      })),
    [derived.nodes, removable, removeStage, renameStage],
  );

  const derivedEdges: Edge[] = useMemo(
    () =>
      derived.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        className: EDGE_CLASS[e.data.state],
        // The store's selectedLinkId is authoritative for edge selection (opens
        // the LinkInspector). RF renders the selected style off this flag.
        selected: e.id === selectedLinkId,
      })),
    [derived.edges, selectedLinkId],
  );

  // Raw-feed supply cards (Stage 11 / Phase 1, ticket #57) — DISPLAY-ONLY chrome
  // built OUTSIDE the nodes useState/merge (concatenated at the RF `nodes` prop
  // below). Non-interactive via RF's OWN flags: draggable/selectable/deletable
  // false stop RF generating position/select changes for them, and because they
  // sit outside the `nodes` state, applyNodeChanges drops any stray raw: change
  // as unknown-id. The commit-loop raw: skip is the app-level belt-and-braces.
  const rawFeedNodes: RawFeedFlowNode[] = useMemo(
    () =>
      derived.rawFeeds.nodes.map((node) =>
        projectRawFeedNode(node, setOpenRawFeed),
      ),
    [derived.rawFeeds.nodes],
  );

  const openRawNode = useMemo(
    () =>
      openRawFeed === null
        ? undefined
        : derived.rawFeeds.nodes.find(
            (node) =>
              node.data.stageId === openRawFeed.stageId &&
              node.data.itemId === openRawFeed.itemId,
          ),
    [derived.rawFeeds.nodes, openRawFeed],
  );
  useEffect(() => {
    if (openRawFeed !== null && openRawNode === undefined) setOpenRawFeed(null);
  }, [openRawFeed, openRawNode]);

  const closeExtraction = useCallback(() => {
    const closing = openRawFeed;
    setOpenRawFeed(null);
    if (closing === null) return;
    queueMicrotask(() => {
      const opener = Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          ".raw-feed-node-button[data-raw-stage][data-raw-item]",
        ),
      ).find(
        (button) =>
          button.dataset.rawStage === closing.stageId &&
          button.dataset.rawItem === closing.itemId,
      );
      opener?.focus();
    });
  }, [openRawFeed]);

  const rawFeedEdges: Edge[] = useMemo(
    () =>
      derived.rawFeeds.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        className: e.className,
      })),
    [derived.rawFeeds.edges],
  );

  // The rendered node list: RF's interim drag frames are held here, merged over
  // the derived structure. `nodesRef` lets onNodesChange read the current list
  // without a stale closure. `structureKey` detects a genuine structure change
  // (ids/data/position from the store) so we resync WITHOUT clobbering a node
  // currently being dragged (the naive setNodes(graphToFlow(...)) is forbidden).
  const [nodes, setNodes] = useState<StageFlowNode[]>(derivedNodes);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  // Resync derived structure into the rendered nodes, preserving any node that
  // RF is currently dragging (its interim position + dragging flag). In a
  // single-user session mid-drag resync is unreachable — setStagePosition
  // triggers no derive — but the merge is written correctly per the r2 pin.
  const lastDerivedRef = useRef(derivedNodes);
  if (lastDerivedRef.current !== derivedNodes) {
    lastDerivedRef.current = derivedNodes;
    const current = nodesRef.current;
    const byId = new Map(current.map((n) => [n.id, n]));
    const merged = derivedNodes.map((d) => {
      const live = byId.get(d.id);
      if (live === undefined) return d;
      // Preserve RF-owned measurement state: a fresh derived node without
      // `measured` makes adoptUserNodes reset handleBounds, and since the DOM
      // element never resizes RF won't re-measure — connections would die.
      const base = { ...d, measured: live.measured };
      // Preserve an in-flight drag: keep the live interim position + flag, take
      // the rest of the structure (data, selection) from the derived node.
      if (live.dragging) {
        return { ...base, position: live.position, dragging: true };
      }
      return base;
    });
    setNodes(merged);
    nodesRef.current = merged;
  }

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Funnel through applyNodeChanges so RF's drag machinery sees the exact
      // change stream it expects (interim positions + dragging flag per frame).
      // Removals from the canvas are DISABLED — deletion goes through the
      // per-node ✕ (last-stage rule surfaced as a disabled control), so RF's
      // batch-delete never collides with the cascade rules.
      const allowed = changes.filter((c) => c.type !== "remove");
      const next = applyNodeChanges(allowed, nodesRef.current);
      setNodes(next as StageFlowNode[]);

      // Commits per change — see commitNodeChange's doc for the raw: guard.
      for (const c of changes) {
        commitNodeChange(c, { setStagePosition, setActiveStage });
      }
    },
    [setStagePosition, setActiveStage],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // Removals route to removeLink; SELECTION opens/closes the LinkInspector
      // via the store (Stage 7 P2 — mirrors the node select arm). Other edge
      // changes are ignored (the store re-derives the edge set).
      for (const c of changes) {
        if (c.type === "remove") removeLink(c.id);
        if (c.type === "select") selectLink(c.selected ? c.id : null);
      }
    },
    [removeLink, selectLink],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      const { source, target } = conn;
      if (!source || !target) return;
      const producer = stages[source];
      const consumer = stages[target];
      if (producer === undefined || consumer === undefined) return;

      // Every branch below sets a fresh notice (success clears it too), giving
      // the cleared-at-next-gesture posture. There are FIVE refusal classes:
      // no-recipe, zero-match, multi-match, self, duplicate — real branches,
      // no modeled enum (frozen Axis 2 simplify).
      const producerRecipe =
        producer.selection.recipeId !== null && catalog !== null
          ? catalog.recipes[producer.selection.recipeId]
          : undefined;
      const consumerRecipe =
        consumer.selection.recipeId !== null && catalog !== null
          ? catalog.recipes[consumer.selection.recipeId]
          : undefined;

      if (producerRecipe === undefined || consumerRecipe === undefined) {
        setCanvasNotice("that stage has no recipe yet");
        return;
      }

      const item = pickLinkItem(producerRecipe, consumerRecipe);
      if (item === "none") {
        setCanvasNotice(
          "those stages share no item — the producer makes nothing the consumer needs",
        );
        return;
      }
      if (item === "ambiguous") {
        setCanvasNotice(
          "those stages share more than one item — ambiguous, no link drawn",
        );
        return;
      }

      // Consult canLink (pure read) BEFORE addLink; addLink stays the sole
      // enforcer. The two refusal sets are kept in lockstep.
      const verdict = canLink(links, source, target, item);
      if (verdict === "self") {
        setCanvasNotice("a stage can't feed itself");
        return;
      }
      if (verdict === "duplicate") {
        setCanvasNotice("that feed lane already has an upstream source");
        return;
      }

      addLink({ fromStageId: source, itemId: item, toStageId: target });
      setCanvasNotice(null);
    },
    [stages, catalog, links, addLink],
  );

  const onAddStage = useCallback(() => {
    setCanvasNotice(null);
    addStage();
  }, [addStage]);

  return (
    <div className="graph-canvas">
      {/* Dimension-tick marker def (Stage 9 P1 Axis 2). A short 45° drafting
          tick at the consumer (target) end of every edge. RF wraps a STRING
          markerEnd in url('#…') itself (getMarkerId passes strings verbatim;
          index.mjs:2956) and creates NO auto-def for string markers, so the
          def must be supplied here as canvas chrome. markerUnits="strokeWidth"
          scales the tick with the (thin) dimension line; orient="auto" aligns
          it to the flow direction. Ink for all states — the LINE carries the
          state colour; the tick is the dimension convention (per-state marker
          colour is impossible through one shared def). */}
      <svg
        width="0"
        height="0"
        style={{ position: "absolute" }}
        aria-hidden="true"
      >
        <defs>
          <marker
            id="dim-tick"
            markerWidth="8"
            markerHeight="8"
            refX="4"
            refY="4"
            markerUnits="strokeWidth"
            orient="auto"
          >
            {/* A 45° stroke through the ref point — the drafting dimension tick. */}
            <path
              d="M 1 7 L 7 1"
              stroke="var(--fg)"
              strokeWidth="1"
              fill="none"
            />
          </marker>
        </defs>
      </svg>
      <ReactFlow
        // Raw-feed cards ride at the prop OUTSIDE the useState/merge (Stage 11
        // P1): nodesRef.current never holds a raw node, so applyNodeChanges
        // drops any raw:-targeted change as unknown-id, and the resync/merge
        // machinery stays keyed on derivedNodes only. Edges span both node
        // populations — RF resolves the raw edge's source/target across them.
        nodes={[...nodes, ...rawFeedNodes]}
        edges={[...derivedEdges, ...rawFeedEdges]}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        colorMode={colorMode}
        // The dimension tick at the consumer end of every edge (Axis 2). BARE
        // id — RF url()-wraps it; a pre-wrapped url would double-wrap dead.
        // Merges UNDER each controlled edge ({ ...defaultEdgeOptions, ...edge },
        // index.mjs:2911), so it never overrides per-edge data.
        defaultEdgeOptions={{ markerEnd: "dim-tick" }}
        fitView
      >
        {/* Graph-paper grid (Axis 4): lined variant, ~24px gap. Pattern colour
            comes from the --xy-background-pattern-color token per medium. */}
        <Background variant={BackgroundVariant.Lines} gap={24} />
        <Controls />
        <Panel position="top-left">
          <button className="graph-add-stage" onClick={onAddStage}>
            ＋ stage
          </button>
          {/* Flow-direction toggle (Stage 10 P1) — its own component so its
              fitView effect lives inside the RF tree (needs useReactFlow). */}
          <DirectionToggle />
        </Panel>
        {chainPower !== null && (
          <Panel position="bottom-right">
            <p className="graph-chain-power">{chainPower}</p>
          </Panel>
        )}
        {(canvasNotice !== null ||
          (catalog !== null && openRawNode !== undefined)) && (
          <Panel position="top-right">
            <GraphTopRightStack
              notice={canvasNotice}
              extraction={
                catalog !== null && openRawNode !== undefined ? (
                  <ExtractionPanel
                    catalog={catalog}
                    rawNode={openRawNode}
                    stage={stages[openRawNode.data.stageId]!}
                    selection={
                      stages[openRawNode.data.stageId]!.extraction?.[
                        openRawNode.data.itemId
                      ] ?? null
                    }
                    onSetSelection={(selection) =>
                      setExtractionSelection(
                        openRawNode.data.stageId,
                        openRawNode.data.itemId,
                        selection,
                      )
                    }
                    onClose={closeExtraction}
                  />
                ) : null
              }
            />
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
