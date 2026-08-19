import type { LinkTransport, PackagingInterstep } from "./link-transport.ts";
import { Fraction } from "./fraction.ts";
import { deriveLinkPlan, derivePackagingPlan } from "./link-plan.ts";
import type {
  LinkPlanCatalog,
  LinkPlanLink,
  LinkPlanStage,
  PackagingPlanInput,
} from "./link-plan.ts";

const bundled = fixtureCatalog();

describe("deriveLinkPlan", () => {
  it("derives the exact Water 10,600/min worked example", () => {
    const result = deriveLinkPlan(
      bundled,
      link("water", "packaged_water"),
      stages("water", 10600, 10600),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error(result.error);
    expect(result.packageMachines).toBe(177);
    expect(result.unpackageMachines).toBe(89);
    expect(result.materialSupply?.eq(Fraction.from(10600))).toBe(true);
    expect(result.materialDemand?.eq(Fraction.from(10600))).toBe(true);
    expect(result.cargoSupply?.eq(Fraction.from(10600))).toBe(true);
    expect(result.cargoDemand?.eq(Fraction.from(10600))).toBe(true);
    expect(result.containerReturnRate?.eq(Fraction.from(10600))).toBe(true);
    expect(result.power).toEqual({ kind: "exact", mw: Fraction.from(2660) });
    expect(result.forwardTransport.kind).toBe("continuous");
    expect(result.returnTransport.kind).toBe("continuous");
    if (
      result.forwardTransport.kind !== "continuous" ||
      result.returnTransport.kind !== "continuous"
    ) {
      throw new Error("expected belts");
    }
    expect(result.forwardTransport.result.runs).toBe(9n);
    expect(result.returnTransport.result.runs).toBe(9n);
  });

  it("keeps Nitrogen material units while projecting supply and demand by 1/4", () => {
    const result = deriveLinkPlan(
      bundled,
      link("nitrogen_gas", "packaged_nitrogen"),
      stages("nitrogen_gas", 800, 400),
    );
    if (result.status !== "ready") throw new Error(result.error);
    expect(result.materialSupply?.toString()).toBe("800");
    expect(result.materialDemand?.toString()).toBe("400");
    expect(result.cargoSupply?.toString()).toBe("200");
    expect(result.cargoDemand?.toString()).toBe("100");
    expect(result.containerReturnRate?.toString()).toBe("100");
    expect(result.packagedItemId).toBe("packaged_nitrogen_gas");
    expect(result.containerItemId).toBe("gas_tank");
  });

  it.each([
    ["packaged_nitric_acid", "nitric_acid"],
    ["packaged_oil_residue", "heavy_oil_residue"],
  ])("accounts for slower unpackaging in %s", (packageRecipeId, itemId) => {
    const result = deriveLinkPlan(
      bundled,
      link(itemId, packageRecipeId),
      stages(itemId, 100, 100),
    );
    if (result.status !== "ready") throw new Error(result.error);
    expect(result.packageMachines).toBe(4);
    expect(result.unpackageMachines).toBe(5);
  });

  it("scales machine throughput and power by the shared clock", () => {
    const result = deriveLinkPlan(
      bundled,
      link("water", "packaged_water", { clockPercentText: "50" }),
      stages("water", 60, 60),
    );
    if (result.status !== "ready") throw new Error(result.error);
    expect(result.packageMachines).toBe(2);
    expect(result.unpackageMachines).toBe(1);
    expect(result.power?.kind).toBe("estimated");
  });

  it.each([
    ["stale package recipe", "missing", "packaging pair is unavailable"],
    ["invalid clock", "packaged_water", "clock % must be a number"],
  ])("returns unavailable for %s", (_name, recipeId, message) => {
    const result = deriveLinkPlan(
      bundled,
      link("water", recipeId, {
        clockPercentText: recipeId === "missing" ? "100" : "bad",
      }),
      stages("water", 60, 60),
    );
    expect(result).toMatchObject({ status: "unavailable" });
    if (result.status !== "unavailable") throw new Error("expected error");
    expect(result.error).toContain(message);
  });

  it("rejects a pair whose reciprocal recipe no longer closes", () => {
    const catalog: LinkPlanCatalog = {
      ...bundled,
      recipes: {
        ...bundled.recipes,
        unpackage_water: {
          ...bundled.recipes.unpackage_water!,
          outputs: bundled.recipes.unpackage_water!.outputs.map((entry) =>
            entry.itemId === "water"
              ? { ...entry, perMinute: Fraction.from(119) }
              : entry,
          ),
        },
      },
    };
    const result = deriveLinkPlan(
      catalog,
      link("water", "packaged_water"),
      stages("water", 60, 60),
    );
    expect(result).toMatchObject({
      status: "unavailable",
      error: expect.stringContaining("packaging pair is unavailable"),
    });
  });

  it("returns an explicit safe-integer overflow instead of narrowing", () => {
    const demand = Fraction.from(BigInt(Number.MAX_SAFE_INTEGER) * 60n + 1n);
    const result = deriveLinkPlan(
      bundled,
      link("water", "packaged_water"),
      stages("water", demand, demand),
    );
    expect(result).toMatchObject({
      status: "unavailable",
      error: expect.stringContaining("safe integer"),
    });
  });

  it("keeps trip parse errors isolated to their route", () => {
    const result = deriveLinkPlan(
      bundled,
      link("water", "packaged_water", {
        transport: {
          mode: "truck",
          trip: { kind: "estimated", distanceText: "bad" },
        },
      }),
      stages("water", 60, 60),
    );
    if (result.status !== "ready") throw new Error(result.error);
    expect(result.forwardTransport.kind).toBe("error");
    expect(result.returnTransport.kind).toBe("continuous");
    expect(result.packageMachines).toBe(1);
  });

  it.each(["pipe", "fluid-truck"] as const)(
    "rejects illegal packaged %s routes defensively",
    (mode) => {
      const illegal =
        mode === "pipe"
          ? ({ mode } as const)
          : ({
              mode,
              trip: { kind: "estimated", distanceText: "1" },
            } as const);
      const result = deriveLinkPlan(
        bundled,
        link("water", "packaged_water", { returnTransport: illegal }),
        stages("water", 60, 60),
      );
      expect(result).toMatchObject({
        status: "unavailable",
        error: expect.stringContaining("solid cargo"),
      });
    },
  );

  it("reads unlockedTiers from stages, not the catalog fallback", () => {
    // The bundled catalog exposes 6 belt tiers; the stage's own unlockedTiers is
    // {belt: 2, pipe: 1} (decorrelated from the 6-tier fallback the empty-stages
    // path returns). The forward route must size against the tier-2 belt (120/min
    // lane → tierIndex 2), NOT the tier-6 fallback (1200/min → tierIndex 6): an
    // adapter that ignored `stages` would report 6 here and 1 run instead of 7.
    const result = deriveLinkPlan(
      bundled,
      link("water", "packaged_water"),
      stagesWithTiers("water", 780, 780, { belt: 2, pipe: 1 }),
    );
    if (result.status !== "ready") throw new Error(result.error);
    if (result.forwardTransport.kind !== "continuous") {
      throw new Error("expected a continuous forward route");
    }
    expect(result.forwardTransport.tierIndex).toBe(2);
    expect(result.forwardTransport.result.runs).toBe(7n);
  });

  it("resolves the null-demand branch for an unsolved consumer endpoint", () => {
    // The `to` stage is idle, so linkMaterialDemand returns null: the adapter
    // must produce a "ready" plan with null machines/power (the branch every
    // existing test skips by solving both endpoints).
    const result = deriveLinkPlan(bundled, link("water", "packaged_water"), {
      from: stageSolved({
        outputs: [
          {
            itemId: "water",
            totalOutput: Fraction.from(600),
            perMachineOutput: Fraction.from(1),
          },
        ],
        feeds: [],
      }),
      to: {
        selection: { unlockedTiers: idleTiers },
        solve: { status: "idle" },
      },
    });
    if (result.status !== "ready") throw new Error(result.error);
    expect(result.materialSupply?.eq(Fraction.from(600))).toBe(true);
    expect(result.materialDemand).toBeNull();
    expect(result.packageMachines).toBeNull();
    expect(result.unpackageMachines).toBeNull();
    expect(result.power).toBeNull();
  });

  it("pins the packaging-not-enabled early return for an interstep-less link", () => {
    const result = deriveLinkPlan(
      bundled,
      { fromStageId: "from", toStageId: "to", itemId: "water" },
      stages("water", 60, 60),
    );
    expect(result).toEqual({
      status: "unavailable",
      error: "packaging interstep is not enabled",
    });
  });
});

describe("derivePackagingPlan", () => {
  it("matches the adapter on identical resolved inputs (direct/adapter parity)", () => {
    const linkResult = deriveLinkPlan(
      bundled,
      link("water", "packaged_water"),
      stages("water", 10600, 10600),
    );
    const directInput: PackagingPlanInput = {
      itemId: "water",
      intent: {
        packageRecipeId: "packaged_water",
        clockPercentText: "100",
        returnTransport: { mode: "belt" },
      },
      forwardTransport: { mode: "belt" },
      materialSupply: Fraction.from(10600),
      materialDemand: Fraction.from(10600),
      unlockedTiers: {
        belt: bundled.tiers.belt.length,
        pipe: bundled.tiers.pipe.length,
      },
    };
    const directResult = derivePackagingPlan(bundled, directInput);
    expect(directResult).toEqual(linkResult);
  });

  it("carries an undefined forwardTransport as the belt-by-tier default", () => {
    // The extraction path passes forwardTransport: undefined — computeLinkTransport
    // must fall to belt, matching the link path's absent-transport behaviour.
    const result = derivePackagingPlan(bundled, {
      itemId: "water",
      intent: {
        packageRecipeId: "packaged_water",
        clockPercentText: "100",
        returnTransport: { mode: "belt" },
      },
      forwardTransport: undefined,
      materialSupply: Fraction.from(60),
      materialDemand: Fraction.from(60),
      unlockedTiers: { belt: 6, pipe: 2 },
    });
    if (result.status !== "ready") throw new Error(result.error);
    expect(result.forwardTransport.kind).toBe("continuous");
  });
});

function link(
  itemId: string,
  packageRecipeId: string,
  overrides: Partial<PackagingInterstep> & { transport?: LinkTransport } = {},
): LinkPlanLink {
  const { transport, ...interstepOverrides } = overrides;
  return {
    fromStageId: "from",
    toStageId: "to",
    itemId,
    transport: { mode: "belt" },
    interstep: {
      packageRecipeId,
      clockPercentText: "100",
      returnTransport: { mode: "belt" },
      ...interstepOverrides,
    },
    ...(transport ? { transport } : {}),
  };
}

function stages(
  itemId: string,
  supply: number | Fraction,
  demand: number | Fraction,
): Record<string, LinkPlanStage> {
  return {
    from: stage({
      outputs: [
        {
          itemId,
          totalOutput: asFraction(supply),
          perMachineOutput: Fraction.from(1),
        },
      ],
      feeds: [],
    }),
    to: stage({
      outputs: [],
      feeds: [
        {
          itemId,
          totalDemand: asFraction(demand),
          perMachineDemand: Fraction.from(1),
        },
      ],
    }),
  };
}

function asFraction(value: number | Fraction): Fraction {
  return value instanceof Fraction ? value : Fraction.from(value);
}

/** The full-fallback tier stamp the empty-stages path also returns — the value a
 *  tiers-ignoring adapter would degenerately match. */
const idleTiers = {
  belt: bundled.tiers.belt.length,
  pipe: bundled.tiers.pipe.length,
};

function stage(result: {
  outputs: unknown[];
  feeds: unknown[];
}): LinkPlanStage {
  return stageSolved(result, idleTiers);
}

/** A solved stage carrying an explicit unlockedTiers (decorrelated fixtures). */
function stageSolved(
  result: { outputs: unknown[]; feeds: unknown[] },
  unlockedTiers: { belt: number; pipe: number } = idleTiers,
): LinkPlanStage {
  return {
    selection: { unlockedTiers },
    solve: {
      status: "solved",
      result: result as never,
    },
  };
}

/** Like {@link stages} but stamps both stages' selection.unlockedTiers with the
 *  given value, so the adapter's stages-read is observable (not the fallback). */
function stagesWithTiers(
  itemId: string,
  supply: number | Fraction,
  demand: number | Fraction,
  unlockedTiers: { belt: number; pipe: number },
): Record<string, LinkPlanStage> {
  return {
    from: stageSolved(
      {
        outputs: [
          {
            itemId,
            totalOutput: asFraction(supply),
            perMachineOutput: Fraction.from(1),
          },
        ],
        feeds: [],
      },
      unlockedTiers,
    ),
    to: stageSolved(
      {
        outputs: [],
        feeds: [
          {
            itemId,
            totalDemand: asFraction(demand),
            perMachineDemand: Fraction.from(1),
          },
        ],
      },
      unlockedTiers,
    ),
  };
}

function fixtureCatalog(): LinkPlanCatalog {
  const f = (value: number) => Fraction.from(value);
  const items = Object.fromEntries(
    [
      ["water", true, null],
      ["nitrogen_gas", true, null],
      ["nitric_acid", true, null],
      ["heavy_oil_residue", true, null],
      ["packaged_water", false, f(100)],
      ["packaged_nitrogen_gas", false, f(100)],
      ["packaged_nitric_acid", false, f(100)],
      ["packaged_oil_residue", false, f(100)],
      ["fluid_canister", false, f(100)],
      ["gas_tank", false, f(100)],
    ].map(([id, isFluid, stackSize]) => [id, { isFluid, stackSize }]),
  );
  const recipes = Object.fromEntries(
    [
      pair(
        "packaged_water",
        "unpackage_water",
        "water",
        "packaged_water",
        "fluid_canister",
        60,
        60,
        60,
        120,
        120,
        120,
      ),
      pair(
        "packaged_nitrogen",
        "unpackage_nitrogen",
        "nitrogen_gas",
        "packaged_nitrogen_gas",
        "gas_tank",
        240,
        60,
        60,
        60,
        240,
        60,
      ),
      pair(
        "packaged_nitric_acid",
        "unpackage_nitric_acid",
        "nitric_acid",
        "packaged_nitric_acid",
        "gas_tank",
        30,
        30,
        30,
        20,
        20,
        20,
      ),
      pair(
        "packaged_oil_residue",
        "unpackage_oil_residue",
        "heavy_oil_residue",
        "packaged_oil_residue",
        "fluid_canister",
        30,
        30,
        30,
        20,
        20,
        20,
      ),
    ]
      .flat()
      .map((recipe) => [recipe.id, recipe]),
  );
  return {
    items,
    recipes,
    machines: {
      packager: {
        power: {
          mw: f(10),
          variable: false,
          exponent: Fraction.parse("1.321929"),
        },
      },
    },
    tiers: {
      belt: [60, 120, 270, 480, 780, 1200].map(f),
      pipe: [300, 600].map(f),
    },
  };
}

function pair(
  packageId: string,
  unpackageId: string,
  fluid: string,
  packaged: string,
  container: string,
  packageFluid: number,
  packagePackaged: number,
  packageContainer: number,
  unpackagePackaged: number,
  unpackageFluid: number,
  unpackageContainer: number,
) {
  return [
    {
      id: packageId,
      machineId: "packager",
      inputs: [
        { itemId: fluid, perMinute: Fraction.from(packageFluid) },
        { itemId: container, perMinute: Fraction.from(packageContainer) },
      ],
      outputs: [
        { itemId: packaged, perMinute: Fraction.from(packagePackaged) },
      ],
    },
    {
      id: unpackageId,
      machineId: "packager",
      inputs: [
        { itemId: packaged, perMinute: Fraction.from(unpackagePackaged) },
      ],
      outputs: [
        { itemId: fluid, perMinute: Fraction.from(unpackageFluid) },
        { itemId: container, perMinute: Fraction.from(unpackageContainer) },
      ],
    },
  ];
}
