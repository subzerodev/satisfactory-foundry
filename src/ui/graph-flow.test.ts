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
} from "./graph-flow.ts";
import { computeLinkTransport } from "./transport-plan.ts";
import type { LinkTransport } from "../state/store.ts";
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
        findings: [],
      })),
      outputs: (opts.outputs ?? []).map((o) => ({
        itemId: o.itemId,
        kind: "belt" as const,
        perMachineOutput: o.perMachineOutput ?? Fraction.from(0),
        totalOutput: o.totalOutput,
        breakouts: [],
        segments: [],
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
