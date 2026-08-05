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

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  Handle,
  Position,
  applyNodeChanges,
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
import type { Catalog } from "../data/types.ts";
import {
  graphToFlow,
  pickLinkItem,
  NODE_WIDTH,
  NODE_HEIGHT,
} from "./graph-flow.ts";
import type { StageNodeData, EdgeState } from "./graph-flow.ts";
import { chainPowerText } from "./advice.ts";

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
      {/* Node-side handles enable RF's controlled layout + edge routing. */}
      <Handle type="target" position={Position.Left} id="in" />
      <Handle type="source" position={Position.Right} id="out" />

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
        {/* machineCount blanked when recipe-less (display choice, r3). */}
        {data.recipeName !== null && (
          <span className="stage-node-machines">×{data.machineCount}</span>
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

const NODE_TYPES: NodeTypes = { stage: StageNode };

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

  const addStage = useAppStore((s) => s.addStage);
  const removeStage = useAppStore((s) => s.removeStage);
  const renameStage = useAppStore((s) => s.renameStage);
  const setActiveStage = useAppStore((s) => s.setActiveStage);
  const addLink = useAppStore((s) => s.addLink);
  const removeLink = useAppStore((s) => s.removeLink);
  const selectLink = useAppStore((s) => s.selectLink);
  const selectedLinkId = useAppStore((s) => s.selectedLinkId);
  const setStagePosition = useAppStore((s) => s.setStagePosition);

  // Component-local gesture feedback — NOT store state (meaningless headless).
  // Cleared at the next canvas gesture (success or refusal), no timers.
  const [canvasNotice, setCanvasNotice] = useState<string | null>(null);

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
    };
    return graphToFlow(
      cat,
      stages,
      stageOrder,
      links,
      reconciliation,
      positions,
      activeStageId,
    );
  }, [
    catalog,
    stages,
    stageOrder,
    links,
    reconciliation,
    positions,
    activeStageId,
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

      // Commit a drag-END position once (dragging:false on a position change).
      for (const c of changes) {
        if (c.type === "position" && c.dragging === false && c.position) {
          setStagePosition(c.id, {
            x: c.position.x,
            y: c.position.y,
          });
        }
        // Selection change → move the active cursor (store-authoritative).
        if (c.type === "select" && c.selected) {
          setActiveStage(c.id);
        }
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
        nodes={nodes}
        edges={derivedEdges}
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
        </Panel>
        {chainPower !== null && (
          <Panel position="bottom-right">
            <p className="graph-chain-power">{chainPower}</p>
          </Panel>
        )}
        {canvasNotice !== null && (
          <Panel position="top-right">
            <p className="graph-canvas-notice">{canvasNotice}</p>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
