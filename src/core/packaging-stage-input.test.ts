import { Fraction } from "./fraction.ts";
import { derivePackagingPlan } from "./link-plan.ts";
import type { LinkPlanCatalog, ReadyLinkPlan } from "./link-plan.ts";
import { packagingStageInputs } from "./packaging-stage-input.ts";
import { solveStage } from "./manifold.ts";

// A DECORRELATED packaging pair: every one of the six per-machine rates is a
// distinct value, so a mis-mapped field (fluid↔container, package↔unpackage,
// feed↔output) is caught by the exact assertions below rather than hiding
// behind an accidental equality. Fluid = water (pipe), container = canister
// (belt), packaged = packaged water (belt).
//   package:   240 water + 30 canister → 60 packaged
//   unpackage: 60 packaged → 240 water + 30 canister   (physical reverse)
// The unpackage side deliberately mirrors the package rates so the pair is a
// legal reverse (resolvePackagingPair enforces the ratio), but the assertions
// still pin WHICH field feeds WHICH lane.
const catalog: LinkPlanCatalog = {
  items: {
    water: { isFluid: true, stackSize: null },
    packaged_water: { isFluid: false, stackSize: Fraction.from(100) },
    fluid_canister: { isFluid: false, stackSize: Fraction.from(100) },
  },
  recipes: {
    package_water: {
      id: "package_water",
      machineId: "packager",
      inputs: [
        { itemId: "water", perMinute: Fraction.from(240) },
        { itemId: "fluid_canister", perMinute: Fraction.from(30) },
      ],
      outputs: [{ itemId: "packaged_water", perMinute: Fraction.from(60) }],
    },
    unpackage_water: {
      id: "unpackage_water",
      machineId: "packager",
      inputs: [{ itemId: "packaged_water", perMinute: Fraction.from(60) }],
      outputs: [
        { itemId: "water", perMinute: Fraction.from(240) },
        { itemId: "fluid_canister", perMinute: Fraction.from(30) },
      ],
    },
  },
  machines: {
    packager: {
      power: {
        mw: Fraction.from(10),
        variable: false,
        exponent: Fraction.parse("1.321929"),
      },
    },
  },
  tiers: {
    belt: [60, 120, 270, 480, 780, 1200].map((n) => Fraction.from(n)),
    pipe: [300, 600].map((n) => Fraction.from(n)),
  },
};

const capacities = {
  belt: [Fraction.from(480), Fraction.from(780)],
  pipe: [Fraction.from(300), Fraction.from(600)],
};

/** A ready plan for the fixture pair at the given demand. */
function readyPlan(demand: number): ReadyLinkPlan {
  const plan = derivePackagingPlan(catalog, {
    itemId: "water",
    intent: {
      packageRecipeId: "package_water",
      clockPercentText: "100",
      returnTransport: { mode: "belt" },
    },
    forwardTransport: { mode: "belt" },
    materialSupply: Fraction.from(demand),
    materialDemand: Fraction.from(demand),
    unlockedTiers: { belt: 6, pipe: 2 },
  });
  if (plan.status !== "ready") throw new Error(plan.error);
  return plan;
}

describe("packagingStageInputs", () => {
  it("maps the packager group: fluid pipe + container belt feed → packaged belt out", () => {
    const plan = readyPlan(2400);
    const clock = Fraction.from(100);
    const inputs = packagingStageInputs(plan, clock, capacities);
    expect(inputs).not.toBeNull();
    const { packager } = inputs!;

    // 2400 water / (240 × 1.00) = 10 packagers.
    expect(packager.machineCount).toBe(10);
    expect(packager.clockPercent.eq(clock)).toBe(true);
    expect(packager.capacities).toBe(capacities);

    // Two feed lanes, in order: fluid (pipe), then container (belt).
    expect(packager.feeds).toHaveLength(2);
    expect(packager.feeds[0]!.itemId).toBe("water");
    expect(packager.feeds[0]!.kind).toBe("pipe");
    expect(packager.feeds[0]!.perMachineRate.eq(Fraction.from(240))).toBe(true);
    expect(packager.feeds[1]!.itemId).toBe("fluid_canister");
    expect(packager.feeds[1]!.kind).toBe("belt");
    expect(packager.feeds[1]!.perMachineRate.eq(Fraction.from(30))).toBe(true);

    // One output lane: packaged, belt.
    expect(packager.outputs).toHaveLength(1);
    expect(packager.outputs[0]!.itemId).toBe("packaged_water");
    expect(packager.outputs[0]!.kind).toBe("belt");
    expect(packager.outputs[0]!.perMachineRate.eq(Fraction.from(60))).toBe(
      true,
    );
  });

  it("maps the unpackager group as the mirror: packaged belt feed → fluid pipe + container belt out", () => {
    const plan = readyPlan(2400);
    const { unpackager } = packagingStageInputs(
      plan,
      Fraction.from(100),
      capacities,
    )!;

    // 2400 water / (240 unpackageFluidRate × 1.00) = 10 unpackagers.
    expect(unpackager.machineCount).toBe(10);

    // One feed lane: packaged, belt (the unpackager's single input).
    expect(unpackager.feeds).toHaveLength(1);
    expect(unpackager.feeds[0]!.itemId).toBe("packaged_water");
    expect(unpackager.feeds[0]!.kind).toBe("belt");
    expect(unpackager.feeds[0]!.perMachineRate.eq(Fraction.from(60))).toBe(
      true,
    );

    // Two output lanes: fluid (pipe), then container (belt).
    expect(unpackager.outputs).toHaveLength(2);
    expect(unpackager.outputs[0]!.itemId).toBe("water");
    expect(unpackager.outputs[0]!.kind).toBe("pipe");
    expect(unpackager.outputs[0]!.perMachineRate.eq(Fraction.from(240))).toBe(
      true,
    );
    expect(unpackager.outputs[1]!.itemId).toBe("fluid_canister");
    expect(unpackager.outputs[1]!.kind).toBe("belt");
    expect(unpackager.outputs[1]!.perMachineRate.eq(Fraction.from(30))).toBe(
      true,
    );
  });

  it("passes the clock through verbatim (not the 100%-normalized value)", () => {
    const plan = readyPlan(2400);
    const clock = Fraction.of(250, 1); // 250% Packager overclock
    const inputs = packagingStageInputs(plan, clock, capacities)!;
    expect(inputs.packager.clockPercent.eq(clock)).toBe(true);
    expect(inputs.unpackager.clockPercent.eq(clock)).toBe(true);
  });

  it("solves both groups through the manifold with no stage-invalid findings", () => {
    const plan = readyPlan(2400);
    const { packager, unpackager } = packagingStageInputs(
      plan,
      Fraction.from(100),
      capacities,
    )!;

    const packagerSolve = solveStage(packager);
    expect(packagerSolve.findings).toEqual([]);
    // 10 packagers × 240 water/min = 2400/min total fluid demand.
    const fluidFeed = packagerSolve.feeds.find((l) => l.itemId === "water");
    expect(fluidFeed?.totalDemand.eq(Fraction.from(2400))).toBe(true);

    const unpackagerSolve = solveStage(unpackager);
    expect(unpackagerSolve.findings).toEqual([]);
    // 10 unpackagers × 60 packaged/min = 600/min packaged feed.
    const packagedFeed = unpackagerSolve.feeds.find(
      (l) => l.itemId === "packaged_water",
    );
    expect(packagedFeed?.totalDemand.eq(Fraction.from(600))).toBe(true);
  });

  it("returns null when the plan carries no machine counts (demand unresolved)", () => {
    const plan = derivePackagingPlan(catalog, {
      itemId: "water",
      intent: {
        packageRecipeId: "package_water",
        clockPercentText: "100",
        returnTransport: { mode: "belt" },
      },
      forwardTransport: { mode: "belt" },
      materialSupply: Fraction.from(2400),
      materialDemand: null, // no demand → packageMachines / unpackageMachines null
      unlockedTiers: { belt: 6, pipe: 2 },
    });
    if (plan.status !== "ready") throw new Error(plan.error);
    expect(plan.packageMachines).toBeNull();
    expect(
      packagingStageInputs(plan, Fraction.from(100), capacities),
    ).toBeNull();
  });
});
