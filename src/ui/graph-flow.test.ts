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
import {
  graphToFlow,
  pickLinkItem,
  NODE_WIDTH,
  NODE_HEIGHT,
} from "./graph-flow.ts";

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
    ore_iron: { id: "ore_iron", displayName: "Iron Ore", isFluid: false },
    iron_ingot: { id: "iron_ingot", displayName: "Iron Ingot", isFluid: false },
    iron_plate: { id: "iron_plate", displayName: "Iron Plate", isFluid: false },
    copper_ingot: {
      id: "copper_ingot",
      displayName: "Copper Ingot",
      isFluid: false,
    },
    rotor: { id: "rotor", displayName: "Rotor", isFluid: false },
  },
  machines: {},
  recipes,
  tiers: { belt: [], pipe: [] },
};

/** A solved SolveState carrying the given output/feed totals for one item. */
function solvedWith(opts: {
  outputs?: { itemId: string; totalOutput: Fraction }[];
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
        perMachineOutput: Fraction.from(0),
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
