/**
 * Data-level smoke for the combined view (Stage 7 / Phase 3, Axis 2): the pure
 * `deriveChainView` derivation is pinned here (solved-only skip + notice count,
 * per-site chrome, connector set, footer assembly); the SVG COMPONENT internals
 * follow the S4 canvas-exclusion posture (render smoke minimal, data pinned).
 */

import { describe, it, expect } from "vitest";
import { Fraction } from "../core/fraction.ts";
import type { Catalog } from "../data/types.ts";
import type { StageNode, StageLink, SolveState } from "../state/store.ts";
import { deriveChainView } from "./ChainBlueprint.tsx";

const F = (n: number): Fraction => Fraction.from(n);

const catalog: Catalog = {
  items: {
    iron_ingot: {
      id: "iron_ingot",
      displayName: "Iron Ingot",
      isFluid: false,
      stackSize: F(100),
    },
  },
  machines: {
    smelter_mk1: {
      id: "smelter_mk1",
      displayName: "Smelter",
      power: { mw: F(4), variable: false, exponent: F(1) },
    } as Catalog["machines"][string],
  },
  recipes: {
    ingot: {
      id: "ingot",
      displayName: "Iron Ingot",
      machineId: "smelter_mk1",
      isAlternate: false,
      inputs: [{ itemId: "ore_iron", perMinute: F(30) }],
      outputs: [{ itemId: "iron_ingot", perMinute: F(30) }],
      primaryOutputId: "iron_ingot",
    },
  },
  tiers: { belt: [F(60), F(120), F(270), F(480)], pipe: [F(300), F(600)] },
};

function solved(feedItem?: string): SolveState {
  return {
    status: "solved",
    result: {
      feeds: feedItem
        ? [
            {
              itemId: feedItem,
              kind: "belt",
              perMachineDemand: F(0),
              totalDemand: F(30),
              belts: [],
              segments: [],
              findings: [],
            },
          ]
        : [],
      outputs: [],
      findings: [],
    },
  } as SolveState;
}

function stage(id: string, solve: SolveState): StageNode {
  return {
    id,
    name: id,
    selection: {
      recipeId: "ingot",
      machineCount: 1,
      clockPercentText: "100",
      unlockedTiers: { belt: 4, pipe: 2 },
      overrides: { feeds: {}, outputs: {} },
    },
    solve,
  };
}

describe("deriveChainView — solved-only skip + chrome + footer", () => {
  it("places only solved stages and counts the skipped ones", () => {
    const stages: Record<string, StageNode> = {
      a: stage("a", solved()),
      b: stage("b", solved("iron_ingot")),
      c: stage("c", { status: "idle" } as SolveState), // unsolved → skipped
    };
    const view = deriveChainView(catalog, stages, ["a", "b", "c"], [], {
      a: { x: 0, y: 0 },
      b: { x: 300, y: 0 },
      c: { x: 600, y: 0 },
    });
    expect(view.sites.map((s) => s.stageId)).toEqual(["a", "b"]);
    expect(view.skippedCount).toBe(1);
    // Chrome carries a name + a power line for each solved site (smelter has
    // power data at 100% clock → an exact "4 MW").
    expect(view.chrome.map((c) => c.stageId)).toEqual(["a", "b"]);
    expect(view.chrome[0]!.powerText).toBe("4 MW");
  });

  it("emits a connector for a link between two solved sites", () => {
    const stages: Record<string, StageNode> = {
      a: stage("a", solved()),
      b: stage("b", solved("iron_ingot")),
    };
    const links: StageLink[] = [
      { id: "l1", fromStageId: "a", toStageId: "b", itemId: "iron_ingot" },
    ];
    const view = deriveChainView(catalog, stages, ["a", "b"], links, {
      a: { x: 0, y: 0 },
      b: { x: 300, y: 0 },
    });
    expect(view.connectors).toHaveLength(1);
    expect(view.connectors[0]!.label).toContain("Iron Ingot");
    expect(view.connectors[0]!.label).toMatch(/· \d+ m$/);
  });

  it("builds the footer with the sites Σ + the transport term", () => {
    const stages: Record<string, StageNode> = {
      a: stage("a", solved()),
      b: stage("b", solved("iron_ingot")),
    };
    const links: StageLink[] = [
      {
        id: "l1",
        fromStageId: "a",
        toStageId: "b",
        itemId: "iron_ingot",
        transport: {
          mode: "truck",
          trip: { kind: "estimated", distanceText: "300" },
        },
      },
    ];
    const view = deriveChainView(catalog, stages, ["a", "b"], links, {
      a: { x: 0, y: 0 },
      b: { x: 300, y: 0 },
    });
    // Two smelters at 100% → the chain Σ is ALWAYS the ≈ float form
    // (chainPowerText's own contract); one truck → 40 MW exact transport.
    // Pin the literal to lock the provenance split.
    expect(view.footerText).toContain("Sites Σ ≈ 8 MW");
    expect(view.footerText).toContain("transport 40 MW");
  });

  it("appends the train note when a train link is present", () => {
    const stages: Record<string, StageNode> = {
      a: stage("a", solved()),
      b: stage("b", solved("iron_ingot")),
    };
    const links: StageLink[] = [
      {
        id: "l1",
        fromStageId: "a",
        toStageId: "b",
        itemId: "iron_ingot",
        transport: {
          mode: "train",
          trip: { kind: "estimated", distanceText: "300" },
        },
      },
    ];
    const view = deriveChainView(catalog, stages, ["a", "b"], links, {
      a: { x: 0, y: 0 },
      b: { x: 300, y: 0 },
    });
    expect(view.footerText).toContain("(+ trains — see per-link)");
    // The train link contributes 0 to the summed transport term.
    expect(view.footerText).toContain("transport 0 MW");
  });
});
