import { describe, expect, it } from "vitest";
import { Fraction } from "../core/fraction.ts";
import type {
  Catalog,
  CatalogExtractor,
  CatalogMachine,
} from "../data/types.ts";
import { TIER_TABLE } from "../data/tiers.ts";
import { deriveExtractionPlan } from "./extraction-plan.ts";

const F = Fraction.from;

function machine(id: string, mw: number): CatalogMachine {
  return {
    id,
    displayName: id,
    power: {
      mw: F(mw),
      variable: false,
      exponent: Fraction.of(1321929, 1000000),
    },
  };
}

function extractor(
  machineId: string,
  normalRate: number,
  itemIds: string[],
  topology: CatalogExtractor["topology"] = "standalone",
): CatalogExtractor {
  return { machineId, normalRate: F(normalRate), itemIds, topology };
}

function catalog(): Catalog {
  return {
    items: {
      stone: {
        id: "stone",
        displayName: "Limestone",
        isFluid: false,
        stackSize: F(100),
        isRawResource: true,
      },
      water: {
        id: "water",
        displayName: "Water",
        isFluid: true,
        stackSize: null,
        isRawResource: true,
      },
      liquid_oil: {
        id: "liquid_oil",
        displayName: "Crude Oil",
        isFluid: true,
        stackSize: null,
        isRawResource: true,
      },
      nitrogen_gas: {
        id: "nitrogen_gas",
        displayName: "Nitrogen Gas",
        isFluid: true,
        stackSize: null,
        isRawResource: true,
      },
    },
    machines: {
      miner_mk3: machine("miner_mk3", 45),
      water_pump: machine("water_pump", 20),
      oil_pump: machine("oil_pump", 40),
      fracking_extractor: machine("fracking_extractor", 0),
    },
    recipes: {},
    tiers: TIER_TABLE,
    recipeUnlocks: {},
    extractors: {
      miner_mk3: extractor("miner_mk3", 240, ["stone"]),
      water_pump: extractor("water_pump", 120, ["water"]),
      oil_pump: extractor("oil_pump", 120, ["liquid_oil"]),
      fracking_extractor: extractor(
        "fracking_extractor",
        60,
        ["water", "liquid_oil", "nitrogen_gas"],
        "resource-well",
      ),
    },
  };
}

function derive(
  itemId: string,
  demand: Fraction,
  machineId: string,
  clockPercentText = "100",
  unlockedTiers = { belt: 6, pipe: 2 },
  cat = catalog(),
) {
  return deriveExtractionPlan({
    catalog: cat,
    itemId,
    demand,
    selection: { machineId, clockPercentText },
    unlockedTiers,
  });
}

function derivePurity(
  purityMix: { impure: string; normal: string; pure: string },
  demand = F(1000),
  clockPercentText = "100",
  itemId = "stone",
) {
  return deriveExtractionPlan({
    catalog: catalog(),
    itemId,
    demand,
    selection: {
      machineId: itemId === "water" ? "water_pump" : "miner_mk3",
      clockPercentText,
      purityMix,
    },
    unlockedTiers: { belt: 6, pipe: 2 },
  });
}

describe("deriveExtractionPlan", () => {
  it("derives the exact Limestone and Water worked examples", () => {
    const limestone = derive("stone", F(12720), "miner_mk3");
    expect(limestone).toMatchObject({
      status: "planned",
      count: 53,
      powerText: "2385 MW",
    });
    if (limestone.status !== "planned") return;
    expect(limestone.perExtractor.toString()).toBe("240");
    expect(limestone.totalSupply.toString()).toBe("12720");
    expect(limestone.surplus.toString()).toBe("0");
    expect(limestone.transport).toMatchObject({
      status: "available",
      kind: "belt",
    });

    const water = derive("water", F(10600), "water_pump");
    expect(water).toMatchObject({
      status: "planned",
      count: 89,
      powerText: "1780 MW",
    });
    if (water.status !== "planned") return;
    expect(water.totalSupply.toString()).toBe("10680");
    expect(water.surplus.toString()).toBe("80");
    expect(water.transport).toMatchObject({
      status: "available",
      kind: "pipe",
    });
  });

  it("keeps exact counts and per-output transport at 250 percent", () => {
    const locked = derive("stone", F(12720), "miner_mk3", "250", {
      belt: 4,
      pipe: 2,
    });
    expect(locked).toMatchObject({ status: "planned", count: 22 });
    if (locked.status !== "planned") return;
    expect(locked.perExtractor.toString()).toBe("600");
    expect(locked.totalSupply.toString()).toBe("13200");
    expect(locked.surplus.toString()).toBe("480");
    expect(locked.powerText).toMatch(/^≈ /);
    expect(locked.transport).toMatchObject({
      status: "requires-unlock",
      kind: "belt",
    });

    const unlocked = derive("stone", F(12720), "miner_mk3", "250", {
      belt: 5,
      pipe: 2,
    });
    expect(unlocked.status).toBe("planned");
    if (unlocked.status === "planned")
      expect(unlocked.transport.status).toBe("available");

    const water = derive("water", F(10600), "water_pump", "250");
    expect(water).toMatchObject({ status: "planned", count: 36 });
    if (water.status !== "planned") return;
    expect(water.perExtractor.toString()).toBe("300");
    expect(water.totalSupply.toString()).toBe("10800");
    expect(water.surplus.toString()).toBe("200");
    expect(water.transport).toMatchObject({
      status: "available",
      kind: "pipe",
    });
  });

  it("uses the catalog tier table for extractor transport", () => {
    const cat = catalog();
    cat.tiers = { belt: [F(100), F(250)], pipe: [F(200), F(400)] };

    const result = derive(
      "stone",
      F(240),
      "miner_mk3",
      "100",
      {
        belt: 2,
        pipe: 2,
      },
      cat,
    );

    expect(result.status).toBe("planned");
    if (result.status !== "planned") return;
    expect(result.transport).toMatchObject({
      status: "available",
      kind: "belt",
      capacity: F(250),
    });
  });

  it("derives exact mixed-purity supply, balance, and machine power", () => {
    const mixed = derivePurity({ impure: "1", normal: "1", pure: "1" });
    expect(mixed).toMatchObject({
      status: "planned",
      purity: {
        status: "planned",
        nodeCount: 3,
        powerText: "135 MW",
        balance: { status: "shortfall" },
      },
    });
    if (mixed.status !== "planned" || mixed.purity?.status !== "planned") {
      return;
    }
    expect(mixed.purity.totalSupply.toString()).toBe("840");
    expect(mixed.purity.balance.amount.toString()).toBe("160");

    const spare = derivePurity({ impure: "0", normal: "0", pure: "3" });
    expect(spare).toMatchObject({
      status: "planned",
      purity: {
        status: "planned",
        nodeCount: 3,
        powerText: "135 MW",
        balance: { status: "spare" },
      },
    });
    if (spare.status !== "planned" || spare.purity?.status !== "planned") {
      return;
    }
    expect(spare.purity.totalSupply.toString()).toBe("1440");
    expect(spare.purity.balance.amount.toString()).toBe("440");

    const exact = derivePurity({ impure: "1", normal: "1", pure: "1" }, F(840));
    expect(exact).toMatchObject({
      status: "planned",
      purity: { status: "planned", balance: { status: "spare" } },
    });
    if (exact.status !== "planned" || exact.purity?.status !== "planned") {
      return;
    }
    expect(exact.purity.balance.amount.toString()).toBe("0");
  });

  it.each([
    [{ impure: "0", normal: "0", pure: "1" }, "480"],
    [{ impure: "0", normal: "1", pure: "0" }, "270"],
    [{ impure: "1", normal: "0", pure: "0" }, "120"],
  ])(
    "uses the highest nonzero purity output for transport: %o",
    (purityMix, capacity) => {
      const result = derivePurity(purityMix);
      expect(result.status).toBe("planned");
      if (result.status !== "planned")
        throw new Error("expected planned result");
      expect(result.purity?.status).toBe("planned");
      if (result.purity?.status !== "planned") {
        throw new Error("expected planned purity result");
      }
      expect(result.purity.transport).toMatchObject({ status: "available" });
      if (result.purity.transport.status === "available") {
        expect(result.purity.transport.capacity.toString()).toBe(capacity);
      }
    },
  );

  it("reports no purity transport for an all-zero mix", () => {
    const result = derivePurity({ impure: "0", normal: "0", pure: "0" });
    expect(result).toMatchObject({
      status: "planned",
      purity: {
        status: "planned",
        nodeCount: 0,
        transport: { status: "none" },
      },
    });
  });

  it("uses clock-scaled per-extractor output for every mix calculation", () => {
    const result = derivePurity(
      { impure: "1", normal: "1", pure: "1" },
      F(1000),
      "250",
    );
    expect(result).toMatchObject({
      status: "planned",
      purity: {
        status: "planned",
        nodeCount: 3,
        balance: { status: "spare" },
        transport: { status: "available" },
      },
    });
    if (result.status !== "planned" || result.purity?.status !== "planned") {
      return;
    }
    expect(result.transport).toMatchObject({
      status: "available",
      capacity: F(780),
    });
    expect(result.purity.totalSupply.toString()).toBe("2100");
    expect(result.purity.balance.amount.toString()).toBe("1100");
    if (result.purity.transport.status === "available") {
      expect(result.purity.transport.capacity.toString()).toBe("1200");
    }
  });

  it("returns no purity result when the mix is absent or the item is water", () => {
    const withoutMix = derive("stone", F(1000), "miner_mk3");
    expect(withoutMix).toMatchObject({ status: "planned", purity: null });

    const water = derivePurity(
      { impure: "1", normal: "1", pure: "1" },
      F(1000),
      "100",
      "water",
    );
    expect(water).toMatchObject({ status: "planned", purity: null });
  });

  it.each(["", "1.5", "-1", "1e2"])(
    "rejects malformed Impure node count %j with exact detail",
    (impure) => {
      const result = derivePurity({ impure, normal: "0", pure: "0" });
      expect(result).toMatchObject({
        status: "planned",
        purity: {
          status: "invalid",
          detail: "Impure node count must be a base-10 nonnegative integer.",
        },
      });
    },
  );

  it.each([
    [
      { impure: "0", normal: "", pure: "0" },
      "Normal node count must be a base-10 nonnegative integer.",
      "normal",
    ],
    [
      { impure: "0", normal: "0", pure: "-1" },
      "Pure node count must be a base-10 nonnegative integer.",
      "pure",
    ],
  ])(
    "identifies the malformed purity field in %o",
    (purityMix, detail, field) => {
      const result = derivePurity(purityMix);
      expect(result).toMatchObject({
        status: "planned",
        purity: { status: "invalid", detail, field },
      });
    },
  );

  it("rejects individual and aggregate safe-integer overflow exactly", () => {
    const individual = derivePurity({
      impure: "0",
      normal: "0",
      pure: (BigInt(Number.MAX_SAFE_INTEGER) + 1n).toString(),
    });
    expect(individual).toMatchObject({
      status: "planned",
      purity: {
        status: "invalid",
        detail: "Pure node count must not exceed Number.MAX_SAFE_INTEGER.",
        field: "pure",
      },
    });

    const max = String(Number.MAX_SAFE_INTEGER);
    const aggregate = derivePurity({ impure: max, normal: max, pure: max });
    expect(aggregate).toMatchObject({
      status: "planned",
      purity: {
        status: "invalid",
        detail: "Total node count must not exceed Number.MAX_SAFE_INTEGER.",
        field: null,
      },
    });
  });

  it.each([
    ["", "clock % must be a number in (0, 250]"],
    ["nope", "clock % must be a number in (0, 250]"],
    ["0", "clock % must be greater than 0"],
    ["-1", "clock % must be greater than 0"],
    ["251", "clock % must be at most 250"],
  ])("uses the shared clock error for %s", (clock, detail) => {
    expect(derive("stone", F(1), "miner_mk3", clock)).toEqual({
      status: "invalid-clock",
      detail,
    });
  });

  it("reports safe-integer count overflow instead of throwing", () => {
    const huge = Fraction.from(BigInt(Number.MAX_SAFE_INTEGER) + 1n).mul(
      F(240),
    );
    expect(derive("stone", huge, "miner_mk3").status).toBe("unavailable");
  });

  it("rejects resource-well, cross-item, removed, and no-standalone selections", () => {
    expect(derive("water", F(100), "fracking_extractor").status).toBe(
      "unavailable",
    );
    expect(derive("water", F(100), "oil_pump").status).toBe("unavailable");
    expect(derive("water", F(100), "removed").status).toBe("unavailable");
    expect(derive("nitrogen_gas", F(100), "fracking_extractor").status).toBe(
      "unavailable",
    );
  });

  it("asks for a standalone extractor when candidates exist", () => {
    const result = deriveExtractionPlan({
      catalog: catalog(),
      itemId: "stone",
      demand: F(100),
      selection: null,
      unlockedTiers: { belt: 6, pipe: 2 },
    });
    expect(result).toEqual({ status: "pick-extractor" });
  });

  it("retains the plan with a hard warning when no full tier carries one output", () => {
    const cat = catalog();
    cat.machines.synthetic = machine("synthetic", 1);
    cat.extractors.synthetic = extractor("synthetic", 1300, ["stone"]);
    const result = derive(
      "stone",
      F(2600),
      "synthetic",
      "100",
      { belt: 6, pipe: 2 },
      cat,
    );
    expect(result).toMatchObject({ status: "planned", count: 2 });
    if (result.status === "planned") {
      expect(result.transport).toMatchObject({
        status: "over-capacity",
        kind: "belt",
      });
    }
  });
});
