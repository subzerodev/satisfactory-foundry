/**
 * Pure-mapping tests for the store→React-Flow projection (Stage 3 / Phase 2).
 * Node env, zero React Flow: `graphToFlow` and `pickLinkItem` are plain
 * functions over structurally-typed objects, so the whole render contract is
 * exercised here without a DOM. The GraphCanvas COMPONENT is excluded from the
 * smoke suite (frozen Axis 5) — graphToFlow carries the render-contract weight
 * and the team-lead browser walk is the visual gate.
 */

import { describe, it, expect } from "vitest";
import { Fraction } from "../core/fraction.ts";
import type { Catalog, CatalogRecipe } from "../data/types.ts";
import type { StageNode, StageLink, SolveState } from "../state/store.ts";
import type { LinkFinding } from "../core/reconcile.ts";
import { reconcileLinks } from "../core/reconcile.ts";
import {
  graphToFlow,
  pickLinkItem,
  computeTransportFindings,
  planForLink,
  linkRequiredRate,
  supplySuggestionFor,
  globalUnlockedTiers,
  NODE_WIDTH,
  NODE_HEIGHT,
  RAW_NODE_WIDTH,
  RAW_NODE_HEIGHT,
} from "./graph-flow.ts";
import { computeLinkTransport } from "../core/transport-plan.ts";
import { applyBlockFor } from "./LinkInspector.tsx";
import type {
  LinkTransport,
  PackagingInterstep,
} from "../core/link-transport.ts";
import { TIER_TABLE } from "../data/tiers.ts";

// ---------------------------------------------------------------------------
// Fixtures — a minimal catalog + recipe/stage builders.
// ---------------------------------------------------------------------------

function io(itemId: string, perMinute: number) {
  return { itemId, perMinute: Fraction.from(perMinute) };
}

const recipes: Record<string, CatalogRecipe> = {
  ingot: {
    id: "ingot",
    displayName: "Iron Ingot",
    machineId: "smelter",
    isAlternate: false,
    inputs: [io("ore_iron", 30)],
    outputs: [io("iron_ingot", 30)],
    primaryOutputId: "iron_ingot",
  },
  plate: {
    id: "plate",
    displayName: "Iron Plate",
    machineId: "constructor",
    isAlternate: false,
    inputs: [io("iron_ingot", 30)],
    outputs: [io("iron_plate", 20)],
    primaryOutputId: "iron_plate",
  },
  // A recipe whose outputs intersect the plate recipe's inputs in >1 item.
  multi: {
    id: "multi",
    displayName: "Multi",
    machineId: "refinery",
    isAlternate: false,
    inputs: [],
    outputs: [io("iron_ingot", 10), io("copper_ingot", 10)],
    primaryOutputId: "iron_ingot",
  },
  twoIn: {
    id: "twoIn",
    displayName: "Two In",
    machineId: "assembler",
    isAlternate: false,
    inputs: [io("iron_ingot", 10), io("copper_ingot", 10)],
    outputs: [io("rotor", 5)],
    primaryOutputId: "rotor",
  },
};

const catalog: Catalog = {
  items: {
    ore_iron: {
      id: "ore_iron",
      displayName: "Iron Ore",
      isFluid: false,
      stackSize: Fraction.from(100),
      // Extraction-level (Stage 11 / Phase 1) — the raw-feed derive fixture.
      isRawResource: true,
    },
    iron_ingot: {
      id: "iron_ingot",
      displayName: "Iron Ingot",
      isFluid: false,
      stackSize: Fraction.from(100),
    },
    iron_plate: {
      id: "iron_plate",
      displayName: "Iron Plate",
      isFluid: false,
      stackSize: Fraction.from(200),
    },
    copper_ingot: {
      id: "copper_ingot",
      displayName: "Copper Ingot",
      isFluid: false,
      stackSize: Fraction.from(100),
    },
    rotor: {
      id: "rotor",
      displayName: "Rotor",
      isFluid: false,
      stackSize: Fraction.from(100),
    },
  },
  machines: {},
  recipes,
  tiers: { belt: [], pipe: [] },
  recipeUnlocks: {},
  extractors: {},
};

/** A solved SolveState carrying the given output/feed totals for one item. The
 *  optional `perMachineOutput` on an output lane feeds the fan-out suggestion
 *  (Stage 6 P2); it defaults to 0 for callers that only need totals. */
function solvedWith(opts: {
  outputs?: {
    itemId: string;
    totalOutput: Fraction;
    perMachineOutput?: Fraction;
  }[];
  feeds?: { itemId: string; totalDemand: Fraction }[];
}): SolveState {
  return {
    status: "solved",
    // Only the fields graphToFlow / mapLinkInputs read are populated; the full
    // StageSolveResult shape is not needed for the projection contract.
    result: {
      feeds: (opts.feeds ?? []).map((f) => ({
        itemId: f.itemId,
        kind: "belt" as const,
        perMachineDemand: Fraction.from(0),
        totalDemand: f.totalDemand,
        belts: [],
        segments: [],
        hardware: null,
        standingBufferItems: 0,
        findings: [],
      })),
      outputs: (opts.outputs ?? []).map((o) => ({
        itemId: o.itemId,
        kind: "belt" as const,
        perMachineOutput: o.perMachineOutput ?? Fraction.from(0),
        totalOutput: o.totalOutput,
        breakouts: [],
        segments: [],
        collectionCascade: null,
        findings: [],
      })),
      findings: [],
    },
  } as SolveState;
}

function stage(
  id: string,
  name: string,
  recipeId: string | null,
  machineCount: number,
  solve: SolveState,
): StageNode {
  return {
    id,
    name,
    selection: {
      recipeId,
      machineCount,
      clockPercentText: "100",
      unlockedTiers: { belt: 4, pipe: 2 },
      overrides: { feeds: {}, outputs: {} },
    },
    solve,
  };
}

// ---------------------------------------------------------------------------
// pickLinkItem — unique / zero / multi.
// ---------------------------------------------------------------------------

describe("pickLinkItem", () => {
  const cases: {
    name: string;
    producer: CatalogRecipe;
    consumer: CatalogRecipe;
    expected: string;
  }[] = [
    {
      name: "unique match → the itemId",
      producer: recipes.ingot!,
      consumer: recipes.plate!,
      expected: "iron_ingot",
    },
    {
      name: "zero match → 'none'",
      producer: recipes.plate!, // outputs iron_plate
      consumer: recipes.plate!, // inputs iron_ingot
      expected: "none",
    },
    {
      name: "multi match → 'ambiguous'",
      producer: recipes.multi!, // outputs iron_ingot + copper_ingot
      consumer: recipes.twoIn!, // inputs iron_ingot + copper_ingot
      expected: "ambiguous",
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(pickLinkItem(c.producer, c.consumer)).toBe(c.expected);
    });
  }
});

// ---------------------------------------------------------------------------
// graphToFlow — node emission.
// ---------------------------------------------------------------------------

describe("graphToFlow — nodes", () => {
  it("emits one node per stage, in stageOrder, sized with node-side handles", () => {
    const a = stage("a", "Smelting", "ingot", 20, solvedWith({}));
    const b = stage("b", "Plating", "plate", 10, solvedWith({}));
    const { nodes } = graphToFlow(
      catalog,
      { a, b },
      ["a", "b"],
      [],
      [],
      { a: { x: 40, y: 40 }, b: { x: 300, y: 40 } },
      "a",
    );
    expect(nodes.map((n) => n.id)).toEqual(["a", "b"]);
    const [n0] = nodes;
    expect(n0!.type).toBe("stage");
    expect(n0!.width).toBe(NODE_WIDTH);
    expect(n0!.height).toBe(NODE_HEIGHT);
    expect(n0!.position).toEqual({ x: 40, y: 40 });
    // Node-side handles: one source (right), one target (left), with
    // node-relative geometry so RF computes handleBounds without measuring.
    expect(n0!.handles).toEqual([
      {
        id: "in",
        type: "target",
        position: "left",
        x: -3,
        y: 45,
        width: 6,
        height: 6,
      },
      {
        id: "out",
        type: "source",
        position: "right",
        x: 217,
        y: 45,
        width: 6,
        height: 6,
      },
    ]);
  });

  it("under TB, emits top/bottom handle geometry (transposed straddle) — Stage 10 P1", () => {
    const a = stage("a", "Smelting", "ingot", 20, solvedWith({}));
    const { nodes } = graphToFlow(
      catalog,
      { a },
      ["a"],
      [],
      [],
      { a: { x: 40, y: 40 } },
      "a",
      "TB",
    );
    // TB: target on the TOP edge, source on the BOTTOM edge, centered
    // horizontally (x = NODE_WIDTH/2 - 3 = 107), straddling the border (±3).
    expect(nodes[0]!.handles).toEqual([
      {
        id: "in",
        type: "target",
        position: "top",
        x: 107,
        y: -3,
        width: 6,
        height: 6,
      },
      {
        id: "out",
        type: "source",
        position: "bottom",
        x: 107,
        y: 93,
        width: 6,
        height: 6,
      },
    ]);
  });

  it("carries recipe display name + machineCount + solveStatus in data", () => {
    const a = stage("a", "Smelting", "ingot", 20, solvedWith({}));
    const { nodes } = graphToFlow(
      catalog,
      { a },
      ["a"],
      [],
      [],
      { a: { x: 0, y: 0 } },
      "a",
    );
    expect(nodes[0]!.data).toMatchObject({
      name: "Smelting",
      recipeName: "Iron Ingot",
      machineCount: 20,
      solveStatus: "solved",
      findingCount: 0,
    });
  });

  it("selects exactly the active stage", () => {
    const a = stage("a", "A", "ingot", 1, solvedWith({}));
    const b = stage("b", "B", "plate", 1, solvedWith({}));
    const { nodes } = graphToFlow(
      catalog,
      { a, b },
      ["a", "b"],
      [],
      [],
      { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } },
      "b",
    );
    expect(nodes.find((n) => n.id === "a")!.selected).toBe(false);
    expect(nodes.find((n) => n.id === "b")!.selected).toBe(true);
  });

  it("recipe-less stage: recipeName null, solveStatus idle, findingCount stays live", () => {
    // Stage b has no recipe (the ＋stage default) but a persisted link into it
    // that dangles — the finding must still count on the card (r3).
    const a = stage(
      "a",
      "A",
      "ingot",
      1,
      solvedWith({
        outputs: [{ itemId: "iron_ingot", totalOutput: Fraction.from(30) }],
      }),
    );
    const b = stage("b", "B", null, 1, { status: "idle" });
    const links: StageLink[] = [
      { id: "L1", fromStageId: "a", itemId: "iron_ingot", toStageId: "b" },
    ];
    const reconciliation: LinkFinding[] = [
      { type: "dangling-link", linkId: "L1", end: "to" },
    ];
    const { nodes } = graphToFlow(
      catalog,
      { a, b },
      ["a", "b"],
      links,
      reconciliation,
      { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } },
      "a",
    );
    const nb = nodes.find((n) => n.id === "b")!;
    expect(nb.data.recipeName).toBeNull();
    expect(nb.data.solveStatus).toBe("idle");
    // The dangling finding is incident to b and stays counted despite no recipe.
    expect(nb.data.findingCount).toBe(1);
  });

  it("dangling recipeId (id absent from catalog) → recipeName null", () => {
    const a = stage("a", "A", "gone", 1, { status: "idle" });
    const { nodes } = graphToFlow(
      catalog,
      { a },
      ["a"],
      [],
      [],
      { a: { x: 0, y: 0 } },
      "a",
    );
    expect(nodes[0]!.data.recipeName).toBeNull();
  });

  // --- machineName (#84): the tile names the building ------------------------

  it("machineName resolves the machine displayName (#84)", () => {
    // A catalog whose smelter carries a displayName → the tile reads that, not
    // the raw machineId. Mirrors the base fixture but populates machines.
    const withMachine: Catalog = {
      ...catalog,
      machines: {
        smelter: {
          id: "smelter",
          displayName: "Smelter",
          power: {
            mw: Fraction.from(4),
            variable: false,
            exponent: Fraction.from(1),
          },
        },
      },
    };
    const a = stage("a", "Smelting", "ingot", 20, solvedWith({}));
    const { nodes } = graphToFlow(
      withMachine,
      { a },
      ["a"],
      [],
      [],
      { a: { x: 0, y: 0 } },
      "a",
    );
    expect(nodes[0]!.data.machineName).toBe("Smelter");
  });

  it("machineName falls back to the raw machineId when off the machine table (#84)", () => {
    // The base `catalog` has machines: {} → the ingot recipe's machineId
    // ("smelter") is off-table. Per machineNameFor's precedent (the Blueprint's
    // "footprint unknown" path proves this reachable), the fallback is the raw
    // id string — never null under a non-null recipeName.
    const a = stage("a", "Smelting", "ingot", 20, solvedWith({}));
    const { nodes } = graphToFlow(
      catalog,
      { a },
      ["a"],
      [],
      [],
      { a: { x: 0, y: 0 } },
      "a",
    );
    expect(nodes[0]!.data.recipeName).toBe("Iron Ingot"); // recipe resolved
    expect(nodes[0]!.data.machineName).toBe("smelter"); // machineId, not null
  });

  it("machineName is null for a recipe-less stage (same nullability as recipeName) (#84)", () => {
    const a = stage("a", "A", null, 1, { status: "idle" });
    const { nodes } = graphToFlow(
      catalog,
      { a },
      ["a"],
      [],
      [],
      { a: { x: 0, y: 0 } },
      "a",
    );
    expect(nodes[0]!.data.recipeName).toBeNull();
    expect(nodes[0]!.data.machineName).toBeNull();
  });

  it("falls back to a stable origin when a stage has no position entry", () => {
    const a = stage("a", "A", "ingot", 1, solvedWith({}));
    const { nodes } = graphToFlow(catalog, { a }, ["a"], [], [], {}, "a");
    expect(nodes[0]!.position).toEqual({ x: 40, y: 40 });
  });
});

// ---------------------------------------------------------------------------
// graphToFlow — edge emission + label vocabulary.
// ---------------------------------------------------------------------------

describe("graphToFlow — edges", () => {
  const a = stage("a", "A", "ingot", 20, solvedWith({}));
  const b = stage("b", "B", "plate", 10, solvedWith({}));
  const base = { a, b };
  const order = ["a", "b"];
  const pos = { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } };
  const links: StageLink[] = [
    { id: "L1", fromStageId: "a", itemId: "iron_ingot", toStageId: "b" },
  ];

  const cases: {
    name: string;
    finding: LinkFinding[];
    label: string;
    state: string;
  }[] = [
    {
      name: "absence of a finding = ok",
      finding: [],
      label: "Iron Ingot · ok",
      state: "ok",
    },
    {
      name: "under-supply renders the exact shortfall",
      finding: [
        {
          type: "under-supply",
          linkId: "L1",
          supply: Fraction.from(600),
          demand: Fraction.from(750),
          shortfall: Fraction.from(150),
        },
      ],
      label: "Iron Ingot · short 150/min",
      state: "under-supply",
    },
    {
      name: "under-supply exact fractional shortfall (75/2 class)",
      finding: [
        {
          type: "under-supply",
          linkId: "L1",
          supply: Fraction.from(0),
          demand: Fraction.of(75, 2),
          shortfall: Fraction.of(75, 2),
        },
      ],
      label: "Iron Ingot · short 37.5/min",
      state: "under-supply",
    },
    {
      name: "over-supply renders the muted surplus",
      finding: [
        {
          type: "over-supply",
          linkId: "L1",
          supply: Fraction.from(900),
          demand: Fraction.from(750),
          surplus: Fraction.from(150),
        },
      ],
      label: "Iron Ingot · +150/min surplus",
      state: "over-supply",
    },
    {
      name: "dangling-link renders per its end (to)",
      finding: [{ type: "dangling-link", linkId: "L1", end: "to" }],
      label: "Iron Ingot · dangling (to)",
      state: "dangling",
    },
    {
      name: "dangling-link renders per its end (from)",
      finding: [{ type: "dangling-link", linkId: "L1", end: "from" }],
      label: "Iron Ingot · dangling (from)",
      state: "dangling",
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const { edges } = graphToFlow(
        catalog,
        base,
        order,
        links,
        c.finding,
        pos,
        "a",
      );
      expect(edges).toHaveLength(1);
      expect(edges[0]!.id).toBe("L1");
      expect(edges[0]!.source).toBe("a");
      expect(edges[0]!.target).toBe("b");
      expect(edges[0]!.label).toBe(c.label);
      expect(edges[0]!.data.state).toBe(c.state);
    });
  }

  it("falls back to the raw itemId when the catalog lacks the item", () => {
    const oddLinks: StageLink[] = [
      { id: "L2", fromStageId: "a", itemId: "unknown_item", toStageId: "b" },
    ];
    const { edges } = graphToFlow(catalog, base, order, oddLinks, [], pos, "a");
    expect(edges[0]!.label).toBe("unknown_item · ok");
  });
});

// ---------------------------------------------------------------------------
// graphToFlow — the match-demand suggestion on under-supplied edges (Stage 6
// P2). These pin the graph-flow WIRING (the fan-out aggregation + wording),
// NOT suggestSupply's arithmetic — that is advice.test.ts's job (the layering
// pin, simplify NIT 3: no fourth row re-asserting the ceilDiv).
// ---------------------------------------------------------------------------

describe("graphToFlow — match-demand suggestion", () => {
  const pos2 = {
    p: { x: 0, y: 0 },
    c: { x: 0, y: 0 },
    c2: { x: 0, y: 0 },
  };

  it("single consumer: under-supply label gains '×N covers it'", () => {
    // Producer p outputs iron_ingot at 7.5/machine; the sole consumer c demands
    // 140/min. ceilDiv(140, 7.5) = 19 → "×19 covers it" (single consumer).
    const p = stage(
      "p",
      "P",
      "ingot",
      1,
      solvedWith({
        outputs: [
          {
            itemId: "iron_ingot",
            totalOutput: Fraction.from(30),
            perMachineOutput: Fraction.of(15, 2),
          },
        ],
      }),
    );
    const c = stage(
      "c",
      "C",
      "plate",
      1,
      solvedWith({
        feeds: [{ itemId: "iron_ingot", totalDemand: Fraction.from(140) }],
      }),
    );
    const links: StageLink[] = [
      { id: "L1", fromStageId: "p", itemId: "iron_ingot", toStageId: "c" },
    ];
    const reconciliation: LinkFinding[] = [
      {
        type: "under-supply",
        linkId: "L1",
        supply: Fraction.from(30),
        demand: Fraction.from(140),
        shortfall: Fraction.from(110),
      },
    ];
    const { edges } = graphToFlow(
      catalog,
      { p, c },
      ["p", "c"],
      links,
      reconciliation,
      pos2,
      "p",
    );
    expect(edges[0]!.label).toBe("Iron Ingot · short 110/min · ×19 covers it");
    expect(edges[0]!.data.state).toBe("under-supply");
  });

  it("fan-out: N aggregates ALL sibling demands, wording is '×N total'", () => {
    // Producer p fans iron_ingot to TWO consumers (100 + 140 = 240 total). At
    // 7.5/machine, ceilDiv(240, 7.5) = 32. BOTH under-supplied edges show the
    // same aggregate "×32 total" — never the per-link ceil (the fan-out fold).
    const p = stage(
      "p",
      "P",
      "ingot",
      1,
      solvedWith({
        outputs: [
          {
            itemId: "iron_ingot",
            totalOutput: Fraction.from(30),
            perMachineOutput: Fraction.of(15, 2),
          },
        ],
      }),
    );
    const c = stage(
      "c",
      "C",
      "plate",
      1,
      solvedWith({
        feeds: [{ itemId: "iron_ingot", totalDemand: Fraction.from(100) }],
      }),
    );
    const c2 = stage(
      "c2",
      "C2",
      "plate",
      1,
      solvedWith({
        feeds: [{ itemId: "iron_ingot", totalDemand: Fraction.from(140) }],
      }),
    );
    const links: StageLink[] = [
      { id: "L1", fromStageId: "p", itemId: "iron_ingot", toStageId: "c" },
      { id: "L2", fromStageId: "p", itemId: "iron_ingot", toStageId: "c2" },
    ];
    const reconciliation: LinkFinding[] = [
      {
        type: "under-supply",
        linkId: "L1",
        supply: Fraction.from(30),
        demand: Fraction.from(100),
        shortfall: Fraction.from(70),
      },
      {
        type: "under-supply",
        linkId: "L2",
        supply: Fraction.from(30),
        demand: Fraction.from(140),
        shortfall: Fraction.from(110),
      },
    ];
    const { edges } = graphToFlow(
      catalog,
      { p, c, c2 },
      ["p", "c", "c2"],
      links,
      reconciliation,
      pos2,
      "p",
    );
    // ceilDiv(240, 7.5) = 32 — the SAME aggregate on both fan-out edges.
    expect(edges[0]!.label).toBe("Iron Ingot · short 70/min · ×32 total");
    expect(edges[1]!.label).toBe("Iron Ingot · short 110/min · ×32 total");
  });

  it("unsolved producer → the base under-supply label, no suggestion", () => {
    // Producer p is recipe-less/idle: no output lane, so the suggestion is null
    // and the edge shows only its base shortfall (the finding still fires
    // because the consumer alone can't be the supply source — but the
    // suggestion needs the producer's lane, which is absent).
    const p = stage("p", "P", null, 1, { status: "idle" });
    const c = stage(
      "c",
      "C",
      "plate",
      1,
      solvedWith({
        feeds: [{ itemId: "iron_ingot", totalDemand: Fraction.from(140) }],
      }),
    );
    const links: StageLink[] = [
      { id: "L1", fromStageId: "p", itemId: "iron_ingot", toStageId: "c" },
    ];
    const reconciliation: LinkFinding[] = [
      {
        type: "under-supply",
        linkId: "L1",
        supply: Fraction.from(0),
        demand: Fraction.from(140),
        shortfall: Fraction.from(140),
      },
    ];
    const { edges } = graphToFlow(
      catalog,
      { p, c },
      ["p", "c"],
      links,
      reconciliation,
      pos2,
      "p",
    );
    expect(edges[0]!.label).toBe("Iron Ingot · short 140/min");
  });
});

// ---------------------------------------------------------------------------
// supplySuggestionFor — the apply affordance's payload (Stage 8 P1, Axis 1).
// The LinkInspector calls this directly for the "apply ×N to <producer>" button;
// these pin the payload the button dispatches (producer id is the caller's, N +
// fanOut come from here) for single-consumer, fan-out, unsolved, and idempotence.
// ---------------------------------------------------------------------------

describe("supplySuggestionFor — apply payload", () => {
  // A producer at 7.5/machine, one consumer demanding 140 → ceilDiv(140,7.5)=19.
  function singleConsumer(producerMachines: number, demand: number) {
    const p = stage(
      "p",
      "P",
      "ingot",
      producerMachines,
      solvedWith({
        outputs: [
          {
            itemId: "iron_ingot",
            totalOutput: Fraction.from(30),
            perMachineOutput: Fraction.of(15, 2),
          },
        ],
      }),
    );
    const c = stage(
      "c",
      "C",
      "plate",
      1,
      solvedWith({
        feeds: [{ itemId: "iron_ingot", totalDemand: Fraction.from(demand) }],
      }),
    );
    const links: StageLink[] = [
      { id: "L1", fromStageId: "p", itemId: "iron_ingot", toStageId: "c" },
    ];
    return { stages: { p, c }, links };
  }

  it("single consumer: N = ceilDiv(demand, perMachine), fanOut false", () => {
    const { stages, links } = singleConsumer(1, 140);
    expect(supplySuggestionFor("p", "iron_ingot", stages, links)).toEqual({
      machines: 19, // ceilDiv(140, 7.5)
      fanOut: false,
    });
  });

  it("fan-out: N aggregates ALL sibling demands, fanOut true", () => {
    // 100 + 140 = 240 total demand → ceilDiv(240, 7.5) = 32.
    const p = stage(
      "p",
      "P",
      "ingot",
      1,
      solvedWith({
        outputs: [
          {
            itemId: "iron_ingot",
            totalOutput: Fraction.from(30),
            perMachineOutput: Fraction.of(15, 2),
          },
        ],
      }),
    );
    const c = stage(
      "c",
      "C",
      "plate",
      1,
      solvedWith({
        feeds: [{ itemId: "iron_ingot", totalDemand: Fraction.from(100) }],
      }),
    );
    const c2 = stage(
      "c2",
      "C2",
      "plate",
      1,
      solvedWith({
        feeds: [{ itemId: "iron_ingot", totalDemand: Fraction.from(140) }],
      }),
    );
    const links: StageLink[] = [
      { id: "L1", fromStageId: "p", itemId: "iron_ingot", toStageId: "c" },
      { id: "L2", fromStageId: "p", itemId: "iron_ingot", toStageId: "c2" },
    ];
    expect(supplySuggestionFor("p", "iron_ingot", { p, c, c2 }, links)).toEqual(
      { machines: 32, fanOut: true },
    );
  });

  it("unsolved producer → null (no output lane to size against)", () => {
    const p = stage("p", "P", null, 1, { status: "idle" });
    const c = stage(
      "c",
      "C",
      "plate",
      1,
      solvedWith({
        feeds: [{ itemId: "iron_ingot", totalDemand: Fraction.from(140) }],
      }),
    );
    const links: StageLink[] = [
      { id: "L1", fromStageId: "p", itemId: "iron_ingot", toStageId: "c" },
    ];
    expect(supplySuggestionFor("p", "iron_ingot", { p, c }, links)).toBeNull();
  });

  it("idempotent via the finding gate: once supply covers demand, NO under-supply finding fires", () => {
    // The block gates on BOTH an under-supply finding AND a non-null suggestion.
    // supplySuggestionFor sizes from TOTAL demand (not the shortfall), so it
    // still returns 19 at the covering count — the idempotence guarantee is the
    // FINDING gate, not the payload. Post-apply the producer's totalOutput
    // (19 × 7.5 = 142.5) ≥ demand (140), so reconcileLinks emits nothing for the
    // link → shortfall === undefined in the inspector → the block disappears.
    const supply = Fraction.of(285, 2); // 142.5, the ×19 covering output
    const demand = Fraction.from(140);
    const findings = reconcileLinks([{ linkId: "L1", supply, demand }]);
    expect(findings.some((f) => f.type === "under-supply")).toBe(false);
    // And the finding that WOULD fire below the covering count is under-supply,
    // proving the gate is real (supply one machine short: 18 × 7.5 = 135 < 140).
    const short = reconcileLinks([
      { linkId: "L1", supply: Fraction.from(135), demand },
    ]);
    expect(short[0]!.type).toBe("under-supply");
  });
});

// ---------------------------------------------------------------------------
// graphToFlow — the node powerText line (Stage 6 P2). Solved+powered only.
// ---------------------------------------------------------------------------

describe("graphToFlow — node powerText", () => {
  // A catalog whose smelter machine carries power data (4 MW constant).
  const poweredCatalog: Catalog = {
    ...catalog,
    machines: {
      smelter: {
        id: "smelter",
        displayName: "Smelter",
        power: {
          mw: Fraction.from(4),
          variable: false,
          exponent: Fraction.of(1321929, 1000000),
        },
      },
    },
  };

  it("solved stage on a powered machine → the exact power line", () => {
    // recipe ingot → machineId "smelter" → 4 MW; ×20 at 100% clock = 80 MW.
    const a = stage("a", "Smelting", "ingot", 20, solvedWith({}));
    const { nodes } = graphToFlow(
      poweredCatalog,
      { a },
      ["a"],
      [],
      [],
      { a: { x: 0, y: 0 } },
      "a",
    );
    expect(nodes[0]!.data.powerText).toBe("80 MW");
  });

  it("invalid (and idle/recipe-less) stage → powerText null", () => {
    // An invalid solve never bills power (uniform with SummaryCards + Σ). The
    // recipe-less idle stage is null too — no recipe, no machine, no power.
    const bad = stage("bad", "Bad", "ingot", 20, {
      status: "invalid",
      reason: "bad-clock",
      detail: "x",
    });
    const idle = stage("idle", "Idle", null, 1, { status: "idle" });
    const { nodes } = graphToFlow(
      poweredCatalog,
      { bad, idle },
      ["bad", "idle"],
      [],
      [],
      { bad: { x: 0, y: 0 }, idle: { x: 0, y: 0 } },
      "bad",
    );
    expect(nodes.find((n) => n.id === "bad")!.data.powerText).toBeNull();
    expect(nodes.find((n) => n.id === "idle")!.data.powerText).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// graphToFlow — the transport chip on configured non-belt edges (Stage 7 P2).
// ---------------------------------------------------------------------------

// The edge catalog with REAL tiers (the base fixture uses empty tiers; the
// transport math needs an unlocked belt/pipe tier to size against).
const transportCatalog: Catalog = { ...catalog, tiers: TIER_TABLE };

const nitrogenCatalog: Catalog = {
  ...transportCatalog,
  items: {
    ...transportCatalog.items,
    nitrogen_gas: {
      id: "nitrogen_gas",
      displayName: "Nitrogen Gas",
      isFluid: true,
      stackSize: null,
    },
    packaged_nitrogen: {
      id: "packaged_nitrogen",
      displayName: "Packaged Nitrogen Gas",
      isFluid: false,
      stackSize: Fraction.from(100),
    },
    empty_tank: {
      id: "empty_tank",
      displayName: "Empty Fluid Tank",
      isFluid: false,
      stackSize: Fraction.from(100),
    },
  },
  machines: {
    packager: {
      id: "packager",
      displayName: "Packager",
      power: {
        mw: Fraction.from(10),
        variable: false,
        exponent: Fraction.parse("1.321929"),
      },
    },
  },
  recipes: {
    ...transportCatalog.recipes,
    package_nitrogen: {
      id: "package_nitrogen",
      displayName: "Package Nitrogen Gas",
      machineId: "packager",
      isAlternate: false,
      inputs: [io("nitrogen_gas", 240), io("empty_tank", 60)],
      outputs: [io("packaged_nitrogen", 60)],
      primaryOutputId: "packaged_nitrogen",
    },
    unpackage_nitrogen: {
      id: "unpackage_nitrogen",
      displayName: "Unpackage Nitrogen Gas",
      machineId: "packager",
      isAlternate: false,
      inputs: [io("packaged_nitrogen", 60)],
      outputs: [io("nitrogen_gas", 240), io("empty_tank", 60)],
      primaryOutputId: "nitrogen_gas",
    },
  },
};

const nitrogenIntent: PackagingInterstep = {
  packageRecipeId: "package_nitrogen",
  clockPercentText: "100",
  returnTransport: {
    mode: "truck",
    trip: { kind: "measured", roundTripSecondsText: "120" },
  },
};

describe("graphToFlow — transport edge chip", () => {
  // A solved consumer with a feed lane so linkRequiredRate resolves (600/min).
  const producer = stage("a", "A", "ingot", 20, solvedWith({}));
  const consumer = stage(
    "b",
    "B",
    "plate",
    10,
    solvedWith({
      feeds: [{ itemId: "iron_ingot", totalDemand: Fraction.from(600) }],
    }),
  );
  const base = { a: producer, b: consumer };
  const order = ["a", "b"];
  const pos = { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } };

  function linkWith(transport?: LinkTransport): StageLink[] {
    return [
      {
        id: "L1",
        fromStageId: "a",
        itemId: "iron_ingot",
        toStageId: "b",
        ...(transport ? { transport } : {}),
      },
    ];
  }

  it("belt (absent transport) appends NO chip — renders as today", () => {
    const { edges } = graphToFlow(
      transportCatalog,
      base,
      order,
      linkWith(),
      [],
      pos,
      "a",
    );
    expect(edges[0]!.label).toBe("Iron Ingot · ok");
  });

  it("a CONFIGURED belt link appends the lane-count chip (#157)", () => {
    // 600/min demand over the unlocked belt tier 4 (480/min) → ceil(600/480) = 2
    // lanes. Post-A4-lift the mode-half skip is gone, so a configured belt link
    // reaches edgeChip like any other configured mode.
    const { edges } = graphToFlow(
      transportCatalog,
      base,
      order,
      linkWith({ mode: "belt" }),
      [],
      pos,
      "a",
    );
    expect(edges[0]!.label).toBe("Iron Ingot · ok · 2 belts");
  });

  it("a measured truck link appends a count chip (no ≈)", () => {
    const { edges } = graphToFlow(
      transportCatalog,
      base,
      order,
      linkWith({
        mode: "truck",
        trip: { kind: "measured", roundTripSecondsText: "120" },
      }),
      [],
      pos,
      "a",
    );
    // 600/min, cargo 48×100=4800, T=136 → 1 truck.
    expect(edges[0]!.label).toContain("· 1 truck");
    expect(edges[0]!.label).not.toContain("≈");
  });

  it("an estimated link prefixes the chip with ≈", () => {
    const { edges } = graphToFlow(
      transportCatalog,
      base,
      order,
      linkWith({
        mode: "truck",
        trip: { kind: "estimated", distanceText: "500" },
      }),
      [],
      pos,
      "a",
    );
    expect(edges[0]!.label).toContain("≈");
  });

  it("an unsolved consumer → no chip (solved-only)", () => {
    const unsolvedConsumer = stage("b", "B", "plate", 10, solvedWith({}));
    const { edges } = graphToFlow(
      transportCatalog,
      { a: producer, b: unsolvedConsumer },
      order,
      linkWith({
        mode: "truck",
        trip: { kind: "estimated", distanceText: "500" },
      }),
      [],
      pos,
      "a",
    );
    // No feed lane → rate null → unsolved plan → edgeChip null → no chip.
    expect(edges[0]!.label).toBe("Iron Ingot · ok");
  });
});

describe("graphToFlow — packaged transport projection", () => {
  const producer = stage(
    "a",
    "Nitrogen source",
    null,
    1,
    solvedWith({
      outputs: [
        {
          itemId: "nitrogen_gas",
          totalOutput: Fraction.from(90000),
          perMachineOutput: Fraction.from(10000),
        },
      ],
    }),
  );
  const consumer = stage(
    "b",
    "Nitrogen sink",
    null,
    1,
    solvedWith({
      feeds: [{ itemId: "nitrogen_gas", totalDemand: Fraction.from(100000) }],
    }),
  );
  const stages = { a: producer, b: consumer };
  const link: StageLink = {
    id: "N",
    fromStageId: "a",
    toStageId: "b",
    itemId: "nitrogen_gas",
    transport: {
      mode: "truck",
      trip: { kind: "measured", roundTripSecondsText: "120" },
    },
    interstep: nitrogenIntent,
  };

  it("sizes the forward plan from Nitrogen's quarter-rate packaged cargo", () => {
    const plan = planForLink(link, nitrogenCatalog, stages);
    const expected = computeLinkTransport(
      Fraction.from(25000),
      link.transport,
      nitrogenCatalog.items.packaged_nitrogen!,
      nitrogenCatalog.tiers,
      globalUnlockedTiers(nitrogenCatalog, stages),
    );
    expect(plan).toEqual(expected);
  });

  it("labels independent forward and empty-return chips", () => {
    const { edges } = graphToFlow(
      nitrogenCatalog,
      stages,
      ["a", "b"],
      [link],
      [],
      { a: { x: 0, y: 0 }, b: { x: 300, y: 0 } },
      "a",
    );
    expect(edges[0]!.label).toContain("forward");
    expect(edges[0]!.label).toContain("empty return");
  });

  it.each([
    {
      material: "under-supply",
      supply: 90000,
      demand: 100000,
      materialText: "short 10000/min",
    },
    {
      material: "over-supply",
      supply: 110000,
      demand: 100000,
      materialText: "+10000/min surplus",
    },
    {
      material: "dangling-link",
      supply: null,
      demand: 100000,
      materialText: "dangling (from)",
    },
  ] as const)(
    "keeps $material text beside an interstep problem with problem precedence",
    ({ material, supply, demand, materialText }) => {
      const materialFinding = reconcileLinks([
        {
          linkId: "N",
          supply: supply === null ? null : Fraction.from(supply),
          demand: Fraction.from(demand),
        },
      ])[0]!;
      const reconciliation: LinkFinding[] = [
        materialFinding,
        {
          type: "interstep-problem",
          linkId: "N",
          error: "packaging pair is unavailable",
        },
      ];
      const rowStages = {
        a:
          supply === null
            ? stage("a", "Nitrogen source", null, 1, solvedWith({}))
            : stage(
                "a",
                "Nitrogen source",
                null,
                1,
                solvedWith({
                  outputs: [
                    {
                      itemId: "nitrogen_gas",
                      totalOutput: Fraction.from(supply),
                      perMachineOutput: Fraction.from(10000),
                    },
                  ],
                }),
              ),
        b: consumer,
      };
      const staleLink: StageLink = {
        ...link,
        interstep: { ...nitrogenIntent, packageRecipeId: "stale" },
      };
      const { nodes, edges } = graphToFlow(
        nitrogenCatalog,
        rowStages,
        ["a", "b"],
        [staleLink],
        reconciliation,
        { a: { x: 0, y: 0 }, b: { x: 300, y: 0 } },
        "a",
      );
      expect(edges[0]!.data.state).toBe("problem");
      expect(edges[0]!.label).toContain("Nitrogen Gas");
      expect(edges[0]!.label).toContain(materialText);
      expect(edges[0]!.label).toContain("packaging pair is unavailable");
      expect(nodes[0]!.data.findingCount).toBe(2);
      expect(nodes[1]!.data.findingCount).toBe(2);

      const apply = applyBlockFor(staleLink, reconciliation, rowStages, [
        staleLink,
      ]);
      expect(apply === null).toBe(material !== "under-supply");
      if (material === "under-supply") expect(apply!.shortfall).toBe("10000");
    },
  );
});

// ---------------------------------------------------------------------------
// computeTransportFindings — the unsustainable-train case (Stage 7 P2, Axis 4).
// ---------------------------------------------------------------------------

describe("computeTransportFindings", () => {
  const producer = stage("a", "A", "ingot", 20, solvedWith({}));

  // A helper to build a one-link graph with a train config at a given demand.
  function graphAt(demand: number, transport?: LinkTransport) {
    const consumerAt = stage(
      "b",
      "B",
      "plate",
      10,
      solvedWith({
        feeds: [{ itemId: "iron_ingot", totalDemand: Fraction.from(demand) }],
      }),
    );
    const links: StageLink[] = [
      {
        id: "L1",
        fromStageId: "a",
        itemId: "iron_ingot",
        toStageId: "b",
        ...(transport ? { transport } : {}),
      },
    ];
    return { stages: { a: producer, b: consumerAt }, links };
  }

  it("flags a train link whose rate exceeds every consist's pair ceiling", () => {
    // Absurd demand for a short measured trip → no consist sustains it.
    const { stages, links } = graphAt(1000000, {
      mode: "train",
      trip: { kind: "measured", roundTripSecondsText: "60" },
    });
    const findings = computeTransportFindings(transportCatalog, stages, links);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain("Iron Ingot:");
  });

  it("a sustainable train link yields no finding", () => {
    const { stages, links } = graphAt(100, {
      mode: "train",
      trip: { kind: "measured", roundTripSecondsText: "200" },
    });
    expect(computeTransportFindings(transportCatalog, stages, links)).toEqual(
      [],
    );
  });

  it("a non-train link never contributes a finding", () => {
    const { stages, links } = graphAt(1000000, {
      mode: "truck",
      trip: { kind: "measured", roundTripSecondsText: "60" },
    });
    expect(computeTransportFindings(transportCatalog, stages, links)).toEqual(
      [],
    );
  });

  it("belt (absent transport) never contributes a finding", () => {
    const { stages, links } = graphAt(1000000);
    expect(computeTransportFindings(transportCatalog, stages, links)).toEqual(
      [],
    );
  });

  it.each([{ from: true as const }, { to: true as const }])(
    "checks both packaged train routes and preserves physical return sharedEnds %o",
    (sharedEnds) => {
      const producerAt = stage(
        "a",
        "Nitrogen source",
        null,
        1,
        solvedWith({
          outputs: [
            {
              itemId: "nitrogen_gas",
              totalOutput: Fraction.from(1000000),
            },
          ],
        }),
      );
      const consumerAt = stage(
        "b",
        "Nitrogen sink",
        null,
        1,
        solvedWith({
          feeds: [
            {
              itemId: "nitrogen_gas",
              totalDemand: Fraction.from(1000000),
            },
          ],
        }),
      );
      const packagedLink: StageLink = {
        id: "N",
        fromStageId: "a",
        toStageId: "b",
        itemId: "nitrogen_gas",
        transport: {
          mode: "train",
          trip: { kind: "measured", roundTripSecondsText: "60" },
        },
        interstep: {
          ...nitrogenIntent,
          returnTransport: {
            mode: "train",
            trip: { kind: "measured", roundTripSecondsText: "60" },
            sharedEnds,
          },
        },
      };
      const findings = computeTransportFindings(
        nitrogenCatalog,
        { a: producerAt, b: consumerAt },
        [packagedLink],
      );
      expect(findings).toHaveLength(2);
      expect(findings[0]).toContain(
        "Forward Packaged Nitrogen Gas: 250000/min",
      );
      expect(findings[1]).toContain(
        "Empty return Empty Fluid Tank: 250000/min",
      );
    },
  );
});

// ---------------------------------------------------------------------------
// planForLink — the shared resolve preamble (#34). Its ONLY null is a missing
// item; an unsolved rate flows THROUGH as { kind: "unsolved" }, belt resolves,
// and a configured mode resolves identically to the hand-built preamble the
// five surfaces previously inlined.
// ---------------------------------------------------------------------------

describe("planForLink (#34)", () => {
  const producer = stage("a", "A", "ingot", 20, solvedWith({}));
  // A solved consumer with a feed lane so linkRequiredRate resolves.
  const solvedConsumer = stage(
    "b",
    "B",
    "plate",
    10,
    solvedWith({
      feeds: [{ itemId: "iron_ingot", totalDemand: Fraction.from(600) }],
    }),
  );
  // An unsolved consumer (no feed lane) → linkRequiredRate null.
  const unsolvedConsumer = stage("b", "B", "plate", 10, solvedWith({}));

  function linkFor(
    transport?: LinkTransport,
    itemId = "iron_ingot",
  ): StageLink {
    return {
      id: "L1",
      fromStageId: "a",
      itemId,
      toStageId: "b",
      ...(transport ? { transport } : {}),
    };
  }

  it("returns null EXACTLY when the item is missing from the catalog", () => {
    const stages = { a: producer, b: solvedConsumer };
    const link = linkFor(
      { mode: "truck", trip: { kind: "estimated", distanceText: "500" } },
      "no_such_item",
    );
    expect(planForLink(link, transportCatalog, stages)).toBeNull();
  });

  it("passes an unsolved rate THROUGH as { kind: 'unsolved' }, never null", () => {
    const stages = { a: producer, b: unsolvedConsumer };
    const link = linkFor({
      mode: "truck",
      trip: { kind: "estimated", distanceText: "500" },
    });
    const plan = planForLink(link, transportCatalog, stages);
    expect(plan).not.toBeNull();
    expect(plan!.kind).toBe("unsolved");
  });

  it("resolves the belt default for an absent-transport link (not null)", () => {
    const stages = { a: producer, b: solvedConsumer };
    const plan = planForLink(linkFor(), transportCatalog, stages);
    expect(plan).not.toBeNull();
    // belt default with a resolved rate → the continuous plan, not unsolved.
    expect(plan!.kind).toBe("continuous");
  });

  it("resolves a vehicle mode identically to the hand-built preamble", () => {
    const stages = { a: producer, b: solvedConsumer };
    const link = linkFor({
      mode: "truck",
      trip: { kind: "estimated", distanceText: "500" },
    });
    // The exact preamble the five surfaces previously inlined.
    const item = transportCatalog.items[link.itemId]!;
    const expected = computeLinkTransport(
      linkRequiredRate(link, stages),
      link.transport,
      item,
      transportCatalog.tiers,
      globalUnlockedTiers(transportCatalog, stages),
    );
    expect(planForLink(link, transportCatalog, stages)).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// graphToFlow — raw-feed derive (Stage 11 / Phase 1, ticket #57).
// ---------------------------------------------------------------------------

describe("graphToFlow — rawFeeds", () => {
  // The ingot recipe inputs ore_iron (raw) and outputs iron_ingot; a solved
  // ingot stage carrying an ore_iron feed lane is the canonical raw-feed case.
  const solvedIngot = (totalDemand: number) =>
    stage(
      "s",
      "Smelting",
      "ingot",
      20,
      solvedWith({
        feeds: [
          { itemId: "ore_iron", totalDemand: Fraction.from(totalDemand) },
        ],
      }),
    );

  it("emits a supply card + edge for an unlinked extraction-level input with the exact totalDemand", () => {
    const s = solvedIngot(600);
    const { rawFeeds } = graphToFlow(
      catalog,
      { s },
      ["s"],
      [],
      [],
      { s: { x: 200, y: 100 } },
      "s",
    );
    expect(rawFeeds.nodes).toHaveLength(1);
    const n = rawFeeds.nodes[0]!;
    expect(n.id).toBe("raw:s:ore_iron");
    expect(n.type).toBe("rawFeed");
    expect(n.data.itemName).toBe("Iron Ore");
    // The rate is the solve's own totalDemand, formatRate'd — no re-derivation.
    expect(n.data.rateText).toBe("600/min");
    expect(n.data.stageId).toBe("s");
    expect(n.data.itemId).toBe("ore_iron");
    expect(n.data.demand).toBe(
      s.solve.status === "solved" ? s.solve.result.feeds[0]!.totalDemand : null,
    );
    expect(n.width).toBe(RAW_NODE_WIDTH);
    expect(n.height).toBe(RAW_NODE_HEIGHT);
    // One source handle mirroring stageHandles at the raw dims (LR → right).
    expect(n.handles).toEqual([
      {
        id: "out",
        type: "source",
        position: "right",
        x: RAW_NODE_WIDTH - 3,
        y: RAW_NODE_HEIGHT / 2 - 3,
        width: 6,
        height: 6,
      },
    ]);
    // The edge feeds the stage's `in` handle (target = the stage id).
    expect(rawFeeds.edges).toHaveLength(1);
    expect(rawFeeds.edges[0]).toEqual({
      id: "rawedge:s:ore_iron",
      source: "raw:s:ore_iron",
      target: "s",
      className: "edge-raw",
    });
  });

  it("carries the exact non-terminating rate through formatRate", () => {
    // 100/3 /min — a non-terminating value the derive must NOT float.
    const s = stage(
      "s",
      "Smelting",
      "ingot",
      20,
      solvedWith({
        feeds: [{ itemId: "ore_iron", totalDemand: Fraction.of(100, 3) }],
      }),
    );
    const { rawFeeds } = graphToFlow(
      catalog,
      { s },
      ["s"],
      [],
      [],
      { s: { x: 0, y: 0 } },
      "s",
    );
    // formatRate falls back to the exact n/d for a non-terminating rate.
    expect(rawFeeds.nodes[0]!.data.rateText).toBe("100/3/min");
  });

  it("suppresses the feed when the raw input already has an incoming lane", () => {
    // A StageLink into s for ore_iron makes the raw input the LANE's story — no
    // duplicate feed card beside it.
    const s = solvedIngot(600);
    const p = stage("p", "Miner", "multi", 1, solvedWith({}));
    const links: StageLink[] = [
      { id: "L1", fromStageId: "p", itemId: "ore_iron", toStageId: "s" },
    ];
    const { rawFeeds } = graphToFlow(
      catalog,
      { s, p },
      ["p", "s"],
      links,
      [],
      { s: { x: 0, y: 0 }, p: { x: 0, y: 0 } },
      "s",
    );
    expect(rawFeeds.nodes).toHaveLength(0);
    expect(rawFeeds.edges).toHaveLength(0);
  });

  it("emits nothing for an unlinked NON-raw (craftable) input", () => {
    // The plate recipe inputs iron_ingot — a craftable item with no
    // isRawResource flag → no feed card, even solved + unlinked.
    const s = stage(
      "s",
      "Plating",
      "plate",
      10,
      solvedWith({
        feeds: [{ itemId: "iron_ingot", totalDemand: Fraction.from(300) }],
      }),
    );
    const { rawFeeds } = graphToFlow(
      catalog,
      { s },
      ["s"],
      [],
      [],
      { s: { x: 0, y: 0 } },
      "s",
    );
    expect(rawFeeds.nodes).toHaveLength(0);
    expect(rawFeeds.edges).toHaveLength(0);
  });

  it("emits nothing for a recipe-less or unsolved/invalid stage", () => {
    const recipeLess = stage("a", "A", null, 1, { status: "idle" });
    const invalid = stage("b", "B", "ingot", 1, {
      status: "invalid",
      reason: "bad-clock",
      detail: "bad",
    });
    const { rawFeeds } = graphToFlow(
      catalog,
      { a: recipeLess, b: invalid },
      ["a", "b"],
      [],
      [],
      { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } },
      "a",
    );
    expect(rawFeeds.nodes).toHaveLength(0);
    expect(rawFeeds.edges).toHaveLength(0);
  });

  it("positions the feed LEFT of the stage in LR, ABOVE it in TB, at the fan-out pitch", () => {
    // twoIn inputs iron_ingot + copper_ingot; neither is raw, so add a fixture
    // with two raw inputs to exercise the i×54 pitch. Use ore_iron + a second
    // raw item via a bespoke catalog extension.
    const twoRaw: CatalogRecipe = {
      id: "twoRaw",
      displayName: "Two Raw",
      machineId: "smelter",
      isAlternate: false,
      inputs: [io("ore_iron", 30), io("ore_copper", 30)],
      outputs: [io("iron_ingot", 30)],
      primaryOutputId: "iron_ingot",
    };
    const cat: Catalog = {
      ...catalog,
      items: {
        ...catalog.items,
        ore_copper: {
          id: "ore_copper",
          displayName: "Copper Ore",
          isFluid: false,
          stackSize: Fraction.from(100),
          isRawResource: true,
        },
      },
      recipes: { ...catalog.recipes, twoRaw },
    };
    const s = stage(
      "s",
      "Smelting",
      "twoRaw",
      1,
      solvedWith({
        feeds: [
          { itemId: "ore_iron", totalDemand: Fraction.from(30) },
          { itemId: "ore_copper", totalDemand: Fraction.from(30) },
        ],
      }),
    );

    const lr = graphToFlow(
      cat,
      { s },
      ["s"],
      [],
      [],
      { s: { x: 200, y: 100 } },
      "s",
      "LR",
    ).rawFeeds;
    // LR: x = stage.x − 190; y = stage.y + i×54.
    expect(lr.nodes[0]!.position).toEqual({ x: 10, y: 100 });
    expect(lr.nodes[1]!.position).toEqual({ x: 10, y: 154 });
    expect(lr.nodes[0]!.handles[0]!.position).toBe("right");

    const tb = graphToFlow(
      cat,
      { s },
      ["s"],
      [],
      [],
      { s: { x: 200, y: 100 } },
      "s",
      "TB",
    ).rawFeeds;
    // TB: x = stage.x; y = stage.y − (90 + i×54).
    expect(tb.nodes[0]!.position).toEqual({ x: 200, y: 10 });
    expect(tb.nodes[1]!.position).toEqual({ x: 200, y: -44 });
    expect(tb.nodes[0]!.handles[0]!.position).toBe("bottom");
  });

  it("leaves the existing nodes/edges pins untouched (separate-field shape)", () => {
    // Zero pin churn is a hard requirement: the raw feeds ride in rawFeeds, so
    // the main nodes/edges arrays are byte-identical to a pre-P1 derive. A
    // solved ingot stage WOULD emit a raw feed, yet nodes/edges stay 1/0.
    const s = solvedIngot(600);
    const { nodes, edges, rawFeeds } = graphToFlow(
      catalog,
      { s },
      ["s"],
      [],
      [],
      { s: { x: 0, y: 0 } },
      "s",
    );
    expect(nodes).toHaveLength(1);
    expect(edges).toHaveLength(0);
    // The feed exists — proving the pin-stability is real, not vacuous.
    expect(rawFeeds.nodes).toHaveLength(1);
  });
});
