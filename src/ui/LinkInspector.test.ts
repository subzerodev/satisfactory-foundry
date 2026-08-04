/**
 * The apply affordance's presence rule + payload (Stage 8 / Phase 1, Axis 1).
 * `applyBlockFor` is the pure gate the LinkInspector renders the "apply ×N to
 * <producer>" block from — under-supplied + solved producer only, null for
 * matched/over/unsolved. The LinkInspector COMPONENT follows the store-driven
 * render-exclusion posture (its store reads + Rules-of-Hooks early returns make
 * SSR meaningless); the presence rule + payload carry the render-contract weight
 * here, and the team-lead browser walk is the visual gate.
 */

import { describe, it, expect } from "vitest";
import { Fraction } from "../core/fraction.ts";
import type { LinkFinding } from "../core/reconcile.ts";
import type { SolveState, StageLink, StageNode } from "../state/store.ts";
import { applyBlockFor } from "./LinkInspector.tsx";

// A solved SolveState carrying one output lane (with perMachineOutput for the
// suggestion) and/or one feed lane — the only fields supplySuggestionFor reads.
function solvedWith(opts: {
  outputs?: {
    itemId: string;
    totalOutput: Fraction;
    perMachineOutput: Fraction;
  }[];
  feeds?: { itemId: string; totalDemand: Fraction }[];
}): SolveState {
  return {
    status: "solved",
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
        perMachineOutput: o.perMachineOutput,
        totalOutput: o.totalOutput,
        breakouts: [],
        segments: [],
        findings: [],
      })),
      findings: [],
    },
  } as SolveState;
}

function stage(id: string, name: string, solve: SolveState): StageNode {
  return {
    id,
    name,
    selection: {
      recipeId: "r",
      machineCount: 1,
      clockPercentText: "100",
      unlockedTiers: { belt: 4, pipe: 2 },
      overrides: { feeds: {}, outputs: {} },
    },
    solve,
  };
}

// Producer P outputs iron_ingot at 7.5/machine; consumer C demands 140.
function producer(): StageNode {
  return stage(
    "p",
    "Smelters",
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
}

function consumer(id: string, demand: number): StageNode {
  return stage(
    id,
    "Plates",
    solvedWith({
      feeds: [{ itemId: "iron_ingot", totalDemand: Fraction.from(demand) }],
    }),
  );
}

const L1: StageLink = {
  id: "L1",
  fromStageId: "p",
  itemId: "iron_ingot",
  toStageId: "c",
};

function underSupply(shortfall: number): LinkFinding {
  return {
    type: "under-supply",
    linkId: "L1",
    supply: Fraction.from(30),
    demand: Fraction.from(30 + shortfall),
    shortfall: Fraction.from(shortfall),
  };
}

describe("applyBlockFor — presence rule", () => {
  it("under-supplied + solved producer: block with the shortfall + payload", () => {
    const stages = { p: producer(), c: consumer("c", 140) };
    const block = applyBlockFor(L1, [underSupply(110)], stages, [L1]);
    expect(block).toEqual({
      shortfall: "110", // formatRate(110)
      machines: 19, // ceilDiv(140, 7.5)
      total: false, // single consumer
      producerName: "Smelters",
    });
  });

  it("matched link (no finding): null — no block", () => {
    const stages = { p: producer(), c: consumer("c", 30) };
    expect(applyBlockFor(L1, [], stages, [L1])).toBeNull();
  });

  it("over-supplied link (over-supply finding, not under): null — no block", () => {
    const stages = { p: producer(), c: consumer("c", 15) };
    const over: LinkFinding = {
      type: "over-supply",
      linkId: "L1",
      supply: Fraction.from(30),
      demand: Fraction.from(15),
      surplus: Fraction.from(15),
    };
    expect(applyBlockFor(L1, [over], stages, [L1])).toBeNull();
  });

  it("unsolved producer (idle): null even with an under-supply finding", () => {
    const p = stage("p", "Smelters", { status: "idle" });
    const stages = { p, c: consumer("c", 140) };
    expect(applyBlockFor(L1, [underSupply(140)], stages, [L1])).toBeNull();
  });
});

describe("applyBlockFor — payload matches supplySuggestionFor", () => {
  it("fan-out: N aggregates ALL sibling demands, wording is 'total'", () => {
    // P fans iron_ingot to c (100) + c2 (140) = 240 → ceilDiv(240, 7.5) = 32.
    const stages = {
      p: producer(),
      c: consumer("c", 100),
      c2: consumer("c2", 140),
    };
    const L2: StageLink = {
      id: "L2",
      fromStageId: "p",
      itemId: "iron_ingot",
      toStageId: "c2",
    };
    const block = applyBlockFor(L1, [underSupply(70)], stages, [L1, L2]);
    expect(block).toEqual({
      shortfall: "70",
      machines: 32,
      total: true, // fan-out wording
      producerName: "Smelters",
    });
  });
});
