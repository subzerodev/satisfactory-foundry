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
import {
  applyBlockFor,
  setPipeDerate,
  setSharedEnd,
  toEstimated,
  toMeasured,
  setEstimatedText,
  setMeasuredSeconds,
} from "./LinkInspector.tsx";
import type { LinkTransport } from "../state/store.ts";

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

// ---------------------------------------------------------------------------
// S8P2 config-builders — the pure round-trip through the inspector's controls
// (the LinkInspector COMPONENT is store-driven / Rules-of-Hooks, so the write
// contract carries here; the browser walk is the visual gate). Both enforce the
// optional-field stripping the design pins: empty / unchecked ⇒ the key is
// dropped, never persisted as "" or a `{}` — so an "off" config is byte-
// identical to today's (every existing plan unchanged).
// ---------------------------------------------------------------------------

describe("setPipeDerate — empty strips the key, else carries the raw text", () => {
  it("empty text ⇒ a bare pipe config (key stripped, never stored as '')", () => {
    expect(setPipeDerate("")).toEqual({ mode: "pipe" });
  });

  it("any non-empty text carries verbatim (validity is a derive-time concern)", () => {
    expect(setPipeDerate("80")).toEqual({
      mode: "pipe",
      deratePercentText: "80",
    });
    // Even not-yet-valid text is carried raw — the derive labels the error, the
    // clock-text precedent. The field must round-trip whatever the user typed.
    expect(setPipeDerate("12.")).toEqual({
      mode: "pipe",
      deratePercentText: "12.",
    });
  });
});

describe("setSharedEnd — absent-or-true checkbox stripping", () => {
  const train: Extract<LinkTransport, { mode: "train" }> = {
    mode: "train",
    trip: { kind: "estimated", distanceText: "1200" },
  };

  it("checking an end sets the key to `true`", () => {
    expect(setSharedEnd(train, "from", true)).toEqual({
      mode: "train",
      trip: { kind: "estimated", distanceText: "1200" },
      sharedEnds: { from: true },
    });
  });

  it("checking both ends carries both keys", () => {
    const one = setSharedEnd(train, "from", true) as Extract<
      LinkTransport,
      { mode: "train" }
    >;
    expect(setSharedEnd(one, "to", true)).toEqual({
      mode: "train",
      trip: { kind: "estimated", distanceText: "1200" },
      sharedEnds: { from: true, to: true },
    });
  });

  it("unchecking the LAST flagged end strips the whole sharedEnds field", () => {
    const flagged = setSharedEnd(train, "from", true) as Extract<
      LinkTransport,
      { mode: "train" }
    >;
    const cleared = setSharedEnd(flagged, "from", false);
    // Byte-identical to a train with no override (no `sharedEnds` key at all).
    expect(cleared).toEqual({
      mode: "train",
      trip: { kind: "estimated", distanceText: "1200" },
    });
    expect("sharedEnds" in cleared).toBe(false);
  });

  it("unchecking ONE of two flagged ends keeps the other (never a persisted {})", () => {
    const both: Extract<LinkTransport, { mode: "train" }> = {
      mode: "train",
      trip: { kind: "estimated", distanceText: "1200" },
      sharedEnds: { from: true, to: true },
    };
    expect(setSharedEnd(both, "from", false)).toEqual({
      mode: "train",
      trip: { kind: "estimated", distanceText: "1200" },
      sharedEnds: { to: true },
    });
  });

  it("preserves the trip (a shared-end toggle never disturbs trip fields)", () => {
    const measured: Extract<LinkTransport, { mode: "train" }> = {
      mode: "train",
      trip: { kind: "measured", roundTripSecondsText: "200" },
    };
    expect(setSharedEnd(measured, "to", true)).toEqual({
      mode: "train",
      trip: { kind: "measured", roundTripSecondsText: "200" },
      sharedEnds: { to: true },
    });
  });
});

describe("trip edits preserve a train link's sharedEnds (boundary fold)", () => {
  const flagged: Extract<LinkTransport, { mode: "train" }> = {
    mode: "train",
    trip: { kind: "estimated", distanceText: "1500" },
    sharedEnds: { from: true },
  };

  it("setEstimatedText carries sharedEnds through", () => {
    expect(setEstimatedText(flagged, "2000")).toEqual({
      mode: "train",
      trip: { kind: "estimated", distanceText: "2000" },
      sharedEnds: { from: true },
    });
  });

  it("toMeasured / toEstimated round-trip keeps the override", () => {
    const measured = toMeasured(flagged);
    expect(measured).toEqual({
      mode: "train",
      trip: { kind: "measured", roundTripSecondsText: "" },
      sharedEnds: { from: true },
    });
    expect(
      toEstimated(measured as Extract<LinkTransport, { mode: "train" }>),
    ).toEqual({
      mode: "train",
      trip: { kind: "estimated", distanceText: "" },
      sharedEnds: { from: true },
    });
  });

  it("setMeasuredSeconds carries sharedEnds through", () => {
    const measured: Extract<LinkTransport, { mode: "train" }> = {
      mode: "train",
      trip: { kind: "measured", roundTripSecondsText: "200" },
      sharedEnds: { from: true, to: true },
    };
    expect(setMeasuredSeconds(measured, "240")).toEqual({
      mode: "train",
      trip: { kind: "measured", roundTripSecondsText: "240" },
      sharedEnds: { from: true, to: true },
    });
  });

  it("absent sharedEnds stays absent (no key materialized by a trip edit)", () => {
    const bare: Extract<LinkTransport, { mode: "train" }> = {
      mode: "train",
      trip: { kind: "estimated", distanceText: "1500" },
    };
    expect(setEstimatedText(bare, "2000")).toEqual({
      mode: "train",
      trip: { kind: "estimated", distanceText: "2000" },
    });
    expect(toMeasured(bare)).toEqual({
      mode: "train",
      trip: { kind: "measured", roundTripSecondsText: "" },
    });
  });

  it("road modes are untouched by the fold (no sharedEnds ever)", () => {
    const truck: Extract<
      LinkTransport,
      { mode: "truck" | "tractor" | "explorer" | "fluid-truck" }
    > = {
      mode: "truck",
      trip: { kind: "estimated", distanceText: "800" },
    };
    expect(setEstimatedText(truck, "900")).toEqual({
      mode: "truck",
      trip: { kind: "estimated", distanceText: "900" },
    });
  });
});
