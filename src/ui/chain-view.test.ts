/**
 * Pure-derive tests for the combined-view helpers (Stage 7 / Phase 3, Axes
 * 2–4): connector geometry + labels, the drawn-distance measure-feed mapping
 * (the drone 2× vs road one-way units trap), and the power footer sums + the
 * train-note branch. Node env, zero React — the ChainBlueprint COMPONENT is
 * render-smoke-only (frozen test plan: data pinned here, render minimal).
 */

import { describe, it, expect } from "vitest";
import { Fraction } from "../core/fraction.ts";
import type { Catalog } from "../data/types.ts";
import type { StageNode, StageLink, SolveState } from "../state/store.ts";
import type { ChainLayout, ChainSite } from "../layout/layout.ts";
import { layoutStage } from "../layout/layout.ts";
import {
  nearestEdgeConnector,
  drawnMeters,
  chainConnectors,
  isVehicleModeLink,
  isEstimatedLink,
  applyDrawnDistance,
  chainTransportPower,
} from "./chain-view.ts";
import { formatRate } from "./format.ts";

const F = (n: number): Fraction => Fraction.from(n);

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

const catalog: Catalog = {
  items: {
    iron_ingot: {
      id: "iron_ingot",
      displayName: "Iron Ingot",
      isFluid: false,
      stackSize: F(100),
    },
    water: {
      id: "water",
      displayName: "Water",
      isFluid: true,
      stackSize: null,
    },
  },
  machines: {},
  recipes: {},
  // Belt Mk1..Mk4, pipe Mk1..Mk2 — enough for the train belt-feed + continuous.
  tiers: { belt: [F(60), F(120), F(270), F(480)], pipe: [F(300), F(600)] },
};

/** A solved stage whose feed lane for `itemId` carries `demand` (so
 *  linkRequiredRate resolves — the transport rate the fleet sizes against). */
function solvedConsumer(itemId: string, demand: Fraction): SolveState {
  return {
    status: "solved",
    result: {
      feeds: [
        {
          itemId,
          kind: "belt",
          perMachineDemand: F(0),
          totalDemand: demand,
          belts: [],
          segments: [],
          findings: [],
        },
      ],
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
      recipeId: "r",
      machineCount: 1,
      clockPercentText: "100",
      unlockedTiers: { belt: 4, pipe: 2 },
      overrides: { feeds: {}, outputs: {} },
    },
    solve,
  };
}

function link(
  id: string,
  from: string,
  to: string,
  itemId: string,
  transport?: StageLink["transport"],
): StageLink {
  return {
    id,
    fromStageId: from,
    itemId,
    toStageId: to,
    ...(transport !== undefined ? { transport } : {}),
  };
}

/** A single-smelter site (foundation bbox is a whole number of 80 dm tiles). */
function site(stageId: string): ChainSite {
  return {
    stageId,
    layout: layoutStage(
      { feeds: [], outputs: [], findings: [] },
      "smelter_mk1",
      1,
    ),
  };
}

/** A ChainLayout placing two sites at the given origins (bypasses layoutChain
 *  so the connector geometry is tested against known coordinates). */
function chainAt(
  sites: ChainSite[],
  origins: Record<string, { x: number; y: number }>,
): ChainLayout {
  return {
    units: "dm",
    sites: sites.map((s) => ({
      stageId: s.stageId,
      origin: origins[s.stageId]!,
    })),
    bounds: { x: 0, y: 0, w: 0, h: 0 },
    scale: 1,
  };
}

// ---------------------------------------------------------------------------
// Connector geometry + distance (Axis 2 / Axis 3).
// ---------------------------------------------------------------------------

describe("nearestEdgeConnector + drawnMeters", () => {
  it("connects the nearest edge midpoints of two horizontally separated boxes", () => {
    // A: origin (0,0) 80×80; B: origin (240,0) 80×80. Nearest edges are A's
    // right midpoint (80,40) and B's left midpoint (240,40) — a 160 dm gap.
    const a = { x: 0, y: 0, w: 80, h: 80 };
    const b = { x: 240, y: 0, w: 80, h: 80 };
    const c = nearestEdgeConnector(a, b);
    expect(c.from).toEqual({ x: 80, y: 40 });
    expect(c.to).toEqual({ x: 240, y: 40 });
    expect(c.distanceDm).toBeCloseTo(160);
    // 160 dm ÷ 10 = 16 m.
    expect(drawnMeters(c.distanceDm)).toBe(16);
  });

  it("measures the straight-line distance dm → whole meters", () => {
    // A 3-4-5 triangle in dm: from (0,0) to (30,40) → 50 dm → 5 m.
    const a = { x: 0, y: 0, w: 0, h: 0 };
    const b = { x: 30, y: 40, w: 0, h: 0 };
    const c = nearestEdgeConnector(a, b);
    expect(c.distanceDm).toBeCloseTo(50);
    expect(drawnMeters(c.distanceDm)).toBe(5);
  });
});

describe("chainConnectors — labels + mode class + skip", () => {
  const sites = [site("p"), site("c")];
  const chain = chainAt(sites, { p: { x: 0, y: 0 }, c: { x: 400, y: 0 } });

  it("labels a belt link with item name + drawn distance, solid connector", () => {
    const stages = {
      p: stage("p", { status: "solved" } as SolveState),
      c: stage("c", solvedConsumer("iron_ingot", F(30))),
    };
    const links = [link("l1", "p", "c", "iron_ingot")]; // belt default
    const conns = chainConnectors(chain, sites, links, catalog, stages);
    expect(conns).toHaveLength(1);
    // A→B right/left midpoints: (80,40)→(400,40) = 320 dm = 32 m.
    expect(conns[0]!.label).toBe("Iron Ingot · 32 m");
    expect(conns[0]!.dashed).toBe(false);
  });

  it("labels a truck link with the public chip + distance, dashed connector", () => {
    const stages = {
      p: stage("p", { status: "solved" } as SolveState),
      c: stage("c", solvedConsumer("iron_ingot", F(30))),
    };
    const links = [
      link("l1", "p", "c", "iron_ingot", {
        mode: "truck",
        trip: { kind: "estimated", distanceText: "300" },
      }),
    ];
    const conns = chainConnectors(chain, sites, links, catalog, stages);
    expect(conns[0]!.dashed).toBe(true);
    // The chip is the public computeLinkTransport + edgeChip composition.
    expect(conns[0]!.label).toContain("Iron Ingot");
    expect(conns[0]!.label).toContain("truck");
    expect(conns[0]!.label).toContain("· 32 m");
  });

  it("skips a link whose endpoint is not placed (skipped stage skips its links)", () => {
    const stages = {
      p: stage("p", { status: "solved" } as SolveState),
      c: stage("c", solvedConsumer("iron_ingot", F(30))),
    };
    // The chain omits site "c" (unsolved/skipped) → its link is dropped.
    const partialChain = chainAt([site("p")], { p: { x: 0, y: 0 } });
    const links = [link("l1", "p", "c", "iron_ingot")];
    const conns = chainConnectors(
      partialChain,
      [site("p")],
      links,
      catalog,
      stages,
    );
    expect(conns).toEqual([]);
  });
});

describe("isVehicleModeLink", () => {
  it("is false for belt/pipe, true for vehicle modes", () => {
    expect(isVehicleModeLink(link("a", "p", "c", "iron_ingot"))).toBe(false);
    expect(
      isVehicleModeLink(link("a", "p", "c", "water", { mode: "pipe" })),
    ).toBe(false);
    expect(
      isVehicleModeLink(
        link("a", "p", "c", "iron_ingot", {
          mode: "drone",
          fuel: "battery",
          trip: { kind: "estimated", flightMetersText: "100" },
        }),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Axis 3 — the measure feed (the units trap in ONE mapping site).
// ---------------------------------------------------------------------------

describe("applyDrawnDistance — the units trap per arm", () => {
  it("writes road one-way meters into distanceText (drawn dm ÷ 10)", () => {
    const l = link("l", "p", "c", "iron_ingot", {
      mode: "truck",
      trip: { kind: "estimated", distanceText: "" },
    });
    // 4120 dm drawn → 412 one-way meters.
    const next = applyDrawnDistance(l, 4120);
    expect(next).toEqual({
      mode: "truck",
      trip: { kind: "estimated", distanceText: "412" },
    });
  });

  it("writes train one-way meters into distanceText", () => {
    const l = link("l", "p", "c", "iron_ingot", {
      mode: "train",
      trip: { kind: "estimated", distanceText: "" },
    });
    const next = applyDrawnDistance(l, 4120);
    expect(next).toEqual({
      mode: "train",
      trip: { kind: "estimated", distanceText: "412" },
    });
  });

  it("writes drone ROUND-TRIP meters (2×) into flightMetersText, keeping fuel", () => {
    const l = link("l", "p", "c", "iron_ingot", {
      mode: "drone",
      fuel: "packaged-fuel",
      trip: { kind: "estimated", flightMetersText: "" },
    });
    // 4120 dm drawn → 412 one-way → 824 round-trip.
    const next = applyDrawnDistance(l, 4120);
    expect(next).toEqual({
      mode: "drone",
      fuel: "packaged-fuel",
      trip: { kind: "estimated", flightMetersText: "824" },
    });
  });

  it("returns null for a measured link (never downgrade better information)", () => {
    const l = link("l", "p", "c", "iron_ingot", {
      mode: "truck",
      trip: { kind: "measured", roundTripSecondsText: "60" },
    });
    expect(applyDrawnDistance(l, 4120)).toBeNull();
    expect(isEstimatedLink(l)).toBe(false);
  });

  it("returns null for a belt link (no trip to fill)", () => {
    const l = link("l", "p", "c", "iron_ingot");
    expect(applyDrawnDistance(l, 4120)).toBeNull();
    expect(isEstimatedLink(l)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Axis 4 — the combined-view power footer.
// ---------------------------------------------------------------------------

describe("chainTransportPower — determinate sums + train note", () => {
  const stages = {
    p: stage("p", { status: "solved" } as SolveState),
    c: stage("c", solvedConsumer("iron_ingot", F(30))),
  };

  it("sums truck-like links at 40 MW each (both ends), no train note", () => {
    const links = [
      link("l1", "p", "c", "iron_ingot", {
        mode: "truck",
        trip: { kind: "estimated", distanceText: "300" },
      }),
      link("l2", "p", "c", "iron_ingot", {
        mode: "tractor",
        trip: { kind: "estimated", distanceText: "300" },
      }),
    ];
    const footer = chainTransportPower(links, catalog, stages);
    // 40 + 40 = 80 MW exact.
    expect(footer.transportMw.eq(F(80))).toBe(true);
    expect(footer.hasTrain).toBe(false);
    expect(formatRate(footer.transportMw)).toBe("80");
  });

  it("sums drone links at portPowerMw × nDrones", () => {
    const links = [
      link("l1", "p", "c", "iron_ingot", {
        mode: "drone",
        fuel: "battery",
        trip: { kind: "estimated", flightMetersText: "1000" },
      }),
    ];
    const footer = chainTransportPower(links, catalog, stages);
    // Exact multiple of 100 MW (one port per drone); at least one drone.
    expect(footer.transportMw.gt(F(0))).toBe(true);
    const asNumber =
      Number(footer.transportMw.num) / Number(footer.transportMw.den);
    expect(asNumber % 100).toBe(0);
    expect(footer.hasTrain).toBe(false);
  });

  it("omits train links from the sum but flags hasTrain (the '+ trains' note)", () => {
    const links = [
      link("l1", "p", "c", "iron_ingot", {
        mode: "truck",
        trip: { kind: "estimated", distanceText: "300" },
      }),
      link("l2", "p", "c", "iron_ingot", {
        mode: "train",
        trip: { kind: "estimated", distanceText: "300" },
      }),
    ];
    const footer = chainTransportPower(links, catalog, stages);
    // Only the truck's 40 MW is summed; the train contributes 0 but flips the flag.
    expect(footer.transportMw.eq(F(40))).toBe(true);
    expect(footer.hasTrain).toBe(true);
  });

  it("contributes 0 for belt/pipe links (no stations)", () => {
    const links = [
      link("l1", "p", "c", "iron_ingot"), // belt
      link("l2", "p", "c", "water", { mode: "pipe" }),
    ];
    const footer = chainTransportPower(links, catalog, stages);
    expect(footer.transportMw.eq(F(0))).toBe(true);
    expect(footer.hasTrain).toBe(false);
  });
});
