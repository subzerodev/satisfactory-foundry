import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { Fraction } from "../core/fraction.ts";
import { parseDocsJson, DocsParseError } from "./docs-loader.ts";
import { parseCatalogFromText } from "./catalog.ts";
import { TIER_TABLE } from "./tiers.ts";

// Minimal Docs.json fragments mirroring the real Satisfactory schema (ported
// from the planner's docs-loader.test.ts, extended for the exact-Fraction
// deltas). Serialized ingredient/product strings use the real
// ItemClass=…Desc_X_C…,Amount=N shape the ported regex matches.
const DOCS_FRAGMENT = [
  {
    NativeClass:
      "/Script/CoreUObject.Class'/Script/FactoryGame.FGResourceDescriptor'",
    Classes: [
      {
        ClassName: "Desc_OreIron_C",
        mDisplayName: "Iron Ore",
        mForm: "RF_SOLID",
      },
      {
        ClassName: "Desc_Stone_C",
        mDisplayName: "Limestone",
        mForm: "RF_SOLID",
      },
      { ClassName: "Desc_Water_C", mDisplayName: "Water", mForm: "RF_LIQUID" },
    ],
  },
  {
    NativeClass:
      "/Script/CoreUObject.Class'/Script/FactoryGame.FGItemDescriptor'",
    Classes: [
      {
        ClassName: "Desc_IronIngot_C",
        mDisplayName: "Iron Ingot",
        mForm: "RF_SOLID",
      },
      {
        ClassName: "Desc_Concrete_C",
        mDisplayName: "Concrete",
        mForm: "RF_SOLID",
      },
    ],
  },
  {
    NativeClass:
      "/Script/CoreUObject.Class'/Script/FactoryGame.FGItemDescriptorBiomass'",
    Classes: [
      { ClassName: "Desc_Wood_C", mDisplayName: "Wood", mForm: "RF_SOLID" },
    ],
  },
  {
    NativeClass:
      "/Script/CoreUObject.Class'/Script/FactoryGame.FGBuildableManufacturer'",
    Classes: [
      { ClassName: "Build_SmelterMk1_C", mDisplayName: "Smelter" },
      { ClassName: "Build_OilRefinery_C", mDisplayName: "Refinery" },
    ],
  },
  {
    NativeClass: "/Script/CoreUObject.Class'/Script/FactoryGame.FGRecipe'",
    Classes: [
      {
        ClassName: "Recipe_IngotIron_C",
        mDisplayName: "Iron Ingot",
        mIngredients:
          "((ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_OreIron_C\"',Amount=1))",
        mProduct:
          "((ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_IronIngot_C\"',Amount=1))",
        mManufactoringDuration: "2",
        mProducedIn: "/Game/Path/Build_SmelterMk1_C",
      },
      {
        ClassName: "Recipe_Alternate_WetConcrete_C",
        mDisplayName: "Alternate: Wet Concrete",
        mIngredients:
          "((ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_Stone_C\"',Amount=12)," +
          "(ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_Water_C\"',Amount=10000))",
        mProduct:
          "((ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_Concrete_C\"',Amount=8))",
        mManufactoringDuration: "6",
        mProducedIn: "/Game/Path/Build_OilRefinery_C",
      },
    ],
  },
];

describe("parseDocsJson — items + machines + shape (spec row 1)", () => {
  it("extracts items across FGResourceDescriptor/FGItemDescriptor/Biomass with correct isFluid", () => {
    const cat = parseDocsJson(DOCS_FRAGMENT);
    for (const id of [
      "ore_iron",
      "stone",
      "water",
      "iron_ingot",
      "concrete",
      "wood",
    ]) {
      expect(cat.items[id], `item ${id} missing`).toBeDefined();
    }
    expect(cat.items["water"]!.isFluid).toBe(true);
    expect(cat.items["stone"]!.isFluid).toBe(false);
    // A resource-descriptor item (Water) carries the isRawResource flag on top
    // of the base fields (Stage 11 / Phase 1); an item-descriptor item does not.
    expect(Object.keys(cat.items["water"]!).sort()).toEqual([
      "displayName",
      "id",
      "isFluid",
      "isRawResource",
      "stackSize",
    ]);
    // An item-descriptor item omits the flag entirely (absent ⇒ non-raw).
    expect(Object.keys(cat.items["iron_ingot"]!).sort()).toEqual([
      "displayName",
      "id",
      "isFluid",
      "stackSize",
    ]);
  });

  it("flags isRawResource true for FGResourceDescriptor items, absent for every other descriptor class (spec row 1)", () => {
    const cat = parseDocsJson(DOCS_FRAGMENT);
    // Resource descriptors (extraction-level by the game's own declaration).
    expect(cat.items["ore_iron"]!.isRawResource).toBe(true);
    expect(cat.items["stone"]!.isRawResource).toBe(true);
    // Water — a RESOURCE descriptor AND a byproduct of the Wet Concrete recipe
    // in this very fragment — IS raw. This is the case that killed the
    // all-outputs recipe-set heuristic (r2 fold): the game says extraction, so
    // the byproduct role is irrelevant. Read directly from the ground truth.
    expect(cat.items["water"]!.isRawResource).toBe(true);
    // Item descriptors (craftable / intermediate) carry no flag → non-raw.
    // Concrete is the Wet Concrete recipe's product — a made item, not raw
    // (the item-descriptor analogue of Heavy Oil Residue, the case that killed
    // the primary-only recipe-set heuristic).
    expect(cat.items["iron_ingot"]!.isRawResource).toBeUndefined();
    expect(cat.items["concrete"]!.isRawResource).toBeUndefined();
    // Biomass (Wood) is its own descriptor class, not a resource → non-raw,
    // so no spurious feed cards for burnable inputs.
    expect(cat.items["wood"]!.isRawResource).toBeUndefined();
  });

  it("extracts machines with id + displayName + power (no power fields → zero-draw)", () => {
    const cat = parseDocsJson(DOCS_FRAGMENT);
    // The DOCS_FRAGMENT machines carry no power keys → branch 3 (mw 0, not
    // variable), with the default exponent. Named-value assertions on the real
    // three branches live in the "machine power" describe below.
    expect(cat.machines["smelter_mk1"]!.id).toBe("smelter_mk1");
    expect(cat.machines["smelter_mk1"]!.displayName).toBe("Smelter");
    expect(cat.machines["smelter_mk1"]!.power.mw.eq(Fraction.from(0))).toBe(
      true,
    );
    expect(cat.machines["smelter_mk1"]!.power.variable).toBe(false);
    expect(cat.machines["oil_refinery"]!.displayName).toBe("Refinery");
  });

  it("falls back to the curated TIER_TABLE per kind when a fragment carries no tier classes (#140 P0)", () => {
    // DOCS_FRAGMENT has no FGBuildableConveyorBelt / FGBuildablePipeline groups,
    // so BOTH kinds fall back to the curated table (value-equal, parse-else-
    // curated). The derivation itself is exercised by the fixtures below.
    const cat = parseDocsJson(DOCS_FRAGMENT);
    expect(cat.tiers.belt).toEqual(TIER_TABLE.belt);
    expect(cat.tiers.pipe).toEqual(TIER_TABLE.pipe);
  });

  it("items lacking mStackSize (DOCS_FRAGMENT) parse stackSize null", () => {
    // The DOCS_FRAGMENT items carry no mStackSize → honest null.
    const cat = parseDocsJson(DOCS_FRAGMENT);
    expect(cat.items["iron_ingot"]!.stackSize).toBeNull();
  });

  it("sets primaryOutputId = outputs[0].itemId and Alternate strip + flag", () => {
    const cat = parseDocsJson(DOCS_FRAGMENT);
    const iron = cat.recipes["ingot_iron"]!;
    expect(iron.primaryOutputId).toBe("iron_ingot");
    expect(iron.isAlternate).toBe(false);
    expect(iron.machineId).toBe("smelter_mk1");

    const wet = cat.recipes["alternate_wet_concrete"]!;
    expect(wet.displayName).toBe("Wet Concrete"); // Alternate: prefix stripped
    expect(wet.isAlternate).toBe(true);
    expect(wet.primaryOutputId).toBe("concrete");
  });

  it("fluid ×1000→m³ exactness: water perMinute is EXACTLY 100 (Amount=10000/dur 6)", () => {
    const cat = parseDocsJson(DOCS_FRAGMENT);
    const wet = cat.recipes["alternate_wet_concrete"]!;
    // 10000 L = 10 m³; 10 × 60 / 6 = 100 m³/min, exact via .div(1000).
    const water = wet.inputs.find((i) => i.itemId === "water")!;
    expect(water.perMinute.eq(Fraction.from(100))).toBe(true);
    // Stone: 12 × 60 / 6 = 120/min (solid, untouched).
    const stone = wet.inputs.find((i) => i.itemId === "stone")!;
    expect(stone.perMinute.eq(Fraction.from(120))).toBe(true);
    // Concrete out: 8 × 60 / 6 = 80/min.
    const concrete = wet.outputs.find((o) => o.itemId === "concrete")!;
    expect(concrete.perMinute.eq(Fraction.from(80))).toBe(true);
  });

  it("parseCatalogFromText round-trips JSON text to the same catalog", () => {
    const cat = parseCatalogFromText(JSON.stringify(DOCS_FRAGMENT));
    expect(cat.recipes["ingot_iron"]!.primaryOutputId).toBe("iron_ingot");
  });
});

const RAW_RESOURCE_GROUP = {
  NativeClass:
    "/Script/CoreUObject.Class'/Script/FactoryGame.FGResourceDescriptor'",
  Classes: [
    { ClassName: "Desc_Stone_C", mDisplayName: "Limestone", mForm: "RF_SOLID" },
    { ClassName: "Desc_Water_C", mDisplayName: "Water", mForm: "RF_LIQUID" },
    {
      ClassName: "Desc_LiquidOil_C",
      mDisplayName: "Crude Oil",
      mForm: "RF_LIQUID",
    },
    {
      ClassName: "Desc_NitrogenGas_C",
      mDisplayName: "Nitrogen Gas",
      mForm: "RF_GAS",
    },
  ],
};

const MANUFACTURED_GROUP = {
  NativeClass:
    "/Script/CoreUObject.Class'/Script/FactoryGame.FGItemDescriptor'",
  Classes: [
    {
      ClassName: "Desc_IronPlate_C",
      mDisplayName: "Iron Plate",
      mForm: "RF_SOLID",
    },
  ],
};

const allowedResources = (...ids: string[]) =>
  `(${ids.map((id) => `"/Game/FactoryGame/Desc_${id}.Desc_${id}_C'"`).join(",")})`;

const extractorGroup = (
  native:
    | "FGBuildableResourceExtractor"
    | "FGBuildableWaterPump"
    | "FGBuildableFrackingExtractor",
  classes: Record<string, unknown>[],
) => ({
  NativeClass: `/Script/CoreUObject.Class'/Script/FactoryGame.${native}'`,
  Classes: classes,
});

const extractor = (
  className: string,
  displayName: string,
  items: string,
  cycle: string,
  forms: string,
  restricted: "True" | "False",
  allowed = "",
) => ({
  ClassName: className,
  mDisplayName: displayName,
  mItemsPerCycle: items,
  mExtractCycleTime: cycle,
  mAllowedResourceForms: forms,
  mOnlyAllowCertainResources: restricted,
  mAllowedResources: allowed,
});

describe("parseDocsJson — extractor capabilities (#112)", () => {
  const miners = extractorGroup("FGBuildableResourceExtractor", [
    extractor(
      "Build_MinerMk1_C",
      "Miner Mk.1",
      "1",
      "1",
      "(RF_SOLID)",
      "False",
    ),
    extractor(
      "Build_MinerMk2_C",
      "Miner Mk.2",
      "1",
      "0.5",
      "(RF_SOLID)",
      "False",
    ),
    extractor(
      "Build_MinerMk3_C",
      "Miner Mk.3",
      "1",
      "0.25",
      "(RF_SOLID)",
      "False",
    ),
    extractor(
      "Build_OilPump_C",
      "Oil Extractor",
      "2000",
      "1",
      "(RF_LIQUID)",
      "True",
      allowedResources("LiquidOil"),
    ),
  ]);
  const water = extractorGroup("FGBuildableWaterPump", [
    extractor(
      "Build_WaterPump_C",
      "Water Extractor",
      "2000",
      "1",
      "(RF_LIQUID)",
      "True",
      allowedResources("Water"),
    ),
  ]);
  const well = extractorGroup("FGBuildableFrackingExtractor", [
    extractor(
      "Build_FrackingExtractor_C",
      "Resource Well Extractor",
      "1000",
      "1",
      "(RF_LIQUID,RF_GAS)",
      "True",
      allowedResources("LiquidOil", "Water", "NitrogenGas"),
    ),
  ]);

  it("parses extractor capabilities independent of group order", () => {
    const cat = parseDocsJson([miners, water, well, RAW_RESOURCE_GROUP]);
    expect(cat.extractors["miner_mk1"]!.normalRate.toString()).toBe("60");
    expect(cat.extractors["miner_mk2"]!.normalRate.toString()).toBe("120");
    expect(cat.extractors["miner_mk3"]!.normalRate.toString()).toBe("240");
    expect(cat.extractors["oil_pump"]!.normalRate.toString()).toBe("120");
    expect(cat.extractors["water_pump"]!.normalRate.toString()).toBe("120");
    expect(cat.extractors["fracking_extractor"]!.normalRate.toString()).toBe(
      "60",
    );
    expect(cat.extractors["miner_mk3"]!.itemIds).toEqual(["stone"]);
    expect(cat.extractors["oil_pump"]!.itemIds).toEqual(["liquid_oil"]);
    expect(cat.extractors["water_pump"]!.itemIds).toEqual(["water"]);
    expect(cat.extractors["fracking_extractor"]!.itemIds).toEqual([
      "liquid_oil",
      "water",
      "nitrogen_gas",
    ]);
    expect(cat.extractors["fracking_extractor"]!.topology).toBe(
      "resource-well",
    );
    expect(cat.extractors["water_pump"]!.topology).toBe("standalone");
    expect(Object.getPrototypeOf(cat.extractors)).toBeNull();
    expect(cat.extractors["constructor"]).toBeUndefined();
  });

  it("parses a reversed restricted extractor before its resources", () => {
    const cat = parseDocsJson([water, RAW_RESOURCE_GROUP]);
    expect(cat.extractors["water_pump"]!.itemIds).toEqual(["water"]);
  });

  it.each([undefined, "nope", "0", "-1"])(
    "rejects invalid mExtractCycleTime %s",
    (cycle) => {
      const row = extractor(
        "Build_MinerMk1_C",
        "Miner",
        "1",
        "1",
        "(RF_SOLID)",
        "False",
      ) as Record<string, unknown>;
      row.mExtractCycleTime = cycle;
      expect(() =>
        parseDocsJson([
          RAW_RESOURCE_GROUP,
          extractorGroup("FGBuildableResourceExtractor", [row]),
        ]),
      ).toThrow(DocsParseError);
    },
  );

  it.each([undefined, "nope", "0", "-1"])(
    "rejects invalid mItemsPerCycle %s",
    (items) => {
      const row = extractor(
        "Build_MinerMk1_C",
        "Miner",
        "1",
        "1",
        "(RF_SOLID)",
        "False",
      ) as Record<string, unknown>;
      row.mItemsPerCycle = items;
      expect(() =>
        parseDocsJson([
          RAW_RESOURCE_GROUP,
          extractorGroup("FGBuildableResourceExtractor", [row]),
        ]),
      ).toThrow(DocsParseError);
    },
  );

  it.each([undefined, "true", "FALSE", "yes"])(
    "rejects invalid textual restriction flag %s",
    (flag) => {
      const row = extractor(
        "Build_MinerMk1_C",
        "Miner",
        "1",
        "1",
        "(RF_SOLID)",
        "False",
      ) as Record<string, unknown>;
      row.mOnlyAllowCertainResources = flag;
      expect(() =>
        parseDocsJson([
          RAW_RESOURCE_GROUP,
          extractorGroup("FGBuildableResourceExtractor", [row]),
        ]),
      ).toThrow(DocsParseError);
    },
  );

  it.each(["", "garbage", allowedResources("Missing")])(
    "rejects invalid restricted resources %s",
    (allowed) => {
      const row = extractor(
        "Build_WaterPump_C",
        "Water",
        "2000",
        "1",
        "(RF_LIQUID)",
        "True",
        allowed,
      );
      expect(() =>
        parseDocsJson([
          RAW_RESOURCE_GROUP,
          extractorGroup("FGBuildableWaterPump", [row]),
        ]),
      ).toThrow(DocsParseError);
    },
  );

  it("rejects a restricted resource list with a malformed member", () => {
    const row = extractor(
      "Build_WaterPump_C",
      "Water",
      "2000",
      "1",
      "(RF_LIQUID)",
      "True",
      `${allowedResources("Water").slice(0, -1)},"malformed")`,
    );
    expect(() =>
      parseDocsJson([
        RAW_RESOURCE_GROUP,
        extractorGroup("FGBuildableWaterPump", [row]),
      ]),
    ).toThrow(DocsParseError);
  });

  it("rejects unknown forms and manufactured restricted descriptors", () => {
    const unknown = extractor(
      "Build_MinerMk1_C",
      "Miner",
      "1",
      "1",
      "(RF_PLASMA)",
      "False",
    );
    expect(() =>
      parseDocsJson([
        RAW_RESOURCE_GROUP,
        extractorGroup("FGBuildableResourceExtractor", [unknown]),
      ]),
    ).toThrow(DocsParseError);

    const manufactured = extractor(
      "Build_WaterPump_C",
      "Water",
      "2000",
      "1",
      "(RF_LIQUID)",
      "True",
      allowedResources("IronPlate"),
    );
    expect(() =>
      parseDocsJson([
        RAW_RESOURCE_GROUP,
        MANUFACTURED_GROUP,
        extractorGroup("FGBuildableWaterPump", [manufactured]),
      ]),
    ).toThrow(DocsParseError);
  });
});

describe("parseDocsJson — fractional exactness (spec row 2)", () => {
  it('duration "4" + Amount "2.5" → perMinute EXACTLY 75/2 (no float)', () => {
    const frag = [
      {
        NativeClass:
          "/Script/CoreUObject.Class'/Script/FactoryGame.FGItemDescriptor'",
        Classes: [
          {
            ClassName: "Desc_Thing_C",
            mDisplayName: "Thing",
            mForm: "RF_SOLID",
          },
        ],
      },
      {
        NativeClass:
          "/Script/CoreUObject.Class'/Script/FactoryGame.FGBuildableManufacturer'",
        Classes: [{ ClassName: "Build_Maker_C", mDisplayName: "Maker" }],
      },
      {
        NativeClass: "/Script/CoreUObject.Class'/Script/FactoryGame.FGRecipe'",
        Classes: [
          {
            ClassName: "Recipe_Thing_C",
            mDisplayName: "Thing",
            mIngredients:
              "((ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_Thing_C\"',Amount=2.5))",
            mProduct:
              "((ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_Thing_C\"',Amount=2.5))",
            mManufactoringDuration: "4",
            mProducedIn: "/Game/Path/Build_Maker_C",
          },
        ],
      },
    ];
    const cat = parseDocsJson(frag);
    // 2.5 × 60 / 4 = 150/4 = 75/2, exact.
    const io = cat.recipes["thing"]!.inputs[0]!;
    expect(io.perMinute.eq(Fraction.of(75, 2))).toBe(true);
  });
});

// Fragment builder for the loud-failure + filter rows: one item, one machine,
// one recipe whose fields the test overrides.
function oneRecipe(over: Record<string, string>) {
  return [
    {
      NativeClass:
        "/Script/CoreUObject.Class'/Script/FactoryGame.FGItemDescriptor'",
      Classes: [
        { ClassName: "Desc_Thing_C", mDisplayName: "Thing", mForm: "RF_SOLID" },
      ],
    },
    {
      NativeClass:
        "/Script/CoreUObject.Class'/Script/FactoryGame.FGBuildableManufacturer'",
      Classes: [{ ClassName: "Build_Maker_C", mDisplayName: "Maker" }],
    },
    {
      NativeClass: "/Script/CoreUObject.Class'/Script/FactoryGame.FGRecipe'",
      Classes: [
        {
          ClassName: "Recipe_Thing_C",
          mDisplayName: "Thing",
          mIngredients:
            "((ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_Thing_C\"',Amount=1))",
          mProduct:
            "((ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_Thing_C\"',Amount=1))",
          mManufactoringDuration: "2",
          mProducedIn: "/Game/Path/Build_Maker_C",
          ...over,
        },
      ],
    },
  ];
}

describe("parseDocsJson — loud failures (spec row 3)", () => {
  it("non-array root throws DocsParseError", () => {
    expect(() => parseDocsJson({ not: "an array" })).toThrow(DocsParseError);
  });

  it("missing duration throws DocsParseError naming the recipe", () => {
    const frag = oneRecipe({});
    // Remove mManufactoringDuration from the recipe class.
    const recipeClass = (frag[2] as { Classes: Record<string, unknown>[] })
      .Classes[0]!;
    delete recipeClass.mManufactoringDuration;
    expect(() => parseDocsJson(frag)).toThrow(/ingot|thing/i);
    expect(() => parseDocsJson(frag)).toThrow(DocsParseError);
  });

  it("zero duration throws DocsParseError (no ≤0 → 0 fallback)", () => {
    expect(() =>
      parseDocsJson(oneRecipe({ mManufactoringDuration: "0" })),
    ).toThrow(DocsParseError);
  });

  it('malformed duration ("1.2.3") throws DocsParseError naming the recipe', () => {
    let err: unknown;
    try {
      parseDocsJson(oneRecipe({ mManufactoringDuration: "1.2.3" }));
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(DocsParseError);
    expect((err as Error).message).toMatch(/thing/i);
  });

  it("captured Amount that Fraction.parse rejects (two dots) throws DocsParseError", () => {
    // The [0-9.]+ capture matches "1.2.3", but Fraction.parse rejects it →
    // genuine corruption, throws (not a silent skip).
    const frag = oneRecipe({
      mIngredients:
        "((ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_Thing_C\"',Amount=1.2.3))",
    });
    let err: unknown;
    try {
      parseDocsJson(frag);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(DocsParseError);
    expect((err as Error).message).toMatch(/amount/i);
  });
});

describe("parseDocsJson — ported filters (spec row 4)", () => {
  it("skips a recipe whose producing building is unknown", () => {
    const cat = parseDocsJson(
      oneRecipe({ mProducedIn: "/Game/Path/Build_Nonexistent_C" }),
    );
    expect(cat.recipes["thing"]).toBeUndefined();
  });

  it("skips a recipe with zero outputs (empty product)", () => {
    const cat = parseDocsJson(oneRecipe({ mProduct: "" }));
    expect(cat.recipes["thing"]).toBeUndefined();
  });

  it("skips a recipe whose outputs reference no known item", () => {
    const cat = parseDocsJson(
      oneRecipe({
        mProduct:
          "((ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_Unknown_C\"',Amount=1))",
      }),
    );
    expect(cat.recipes["thing"]).toBeUndefined();
  });

  it("ignores cosmetic/vehicle Descriptor classes (never enter items)", () => {
    const polluted = [
      ...DOCS_FRAGMENT,
      {
        NativeClass:
          "/Script/CoreUObject.Class'/Script/FactoryGame.FGFactoryCustomizationDescriptor'",
        Classes: [
          {
            ClassName: "Desc_PatternRemover_C",
            mDisplayName: "Pattern Remover",
          },
        ],
      },
      {
        NativeClass:
          "/Script/CoreUObject.Class'/Script/FactoryGame.FGBuildingDescriptor'",
        Classes: [{ ClassName: "Desc_Wall_C", mDisplayName: "Wall" }],
      },
      {
        NativeClass:
          "/Script/CoreUObject.Class'/Script/FactoryGame.FGVehicleDescriptor'",
        Classes: [{ ClassName: "Desc_Truck_C", mDisplayName: "Truck" }],
      },
    ];
    const cat = parseDocsJson(polluted);
    expect(cat.items["pattern_remover"]).toBeUndefined();
    expect(cat.items["wall"]).toBeUndefined();
    expect(cat.items["truck"]).toBeUndefined();
  });
});

// The three power-parse branches (frozen Axis 1 + Axis 5). Field names and
// values are the VERBATIM game keys/values read from public/bundled-docs/
// en-US.json at implementation (Steam build 23855724, extracted 2026-08-03):
//   Build_ConstructorMk1_C  mPowerConsumption "4.000000", exp "1.321929"
//   Build_MinerMk1_C        mPowerConsumption "5.000000", exp "1.321929"
//   Build_HadronCollider_C  mPowerConsumption "0.000000", exp "1.321929",
//                           min "250.000000", max "1500.000000"
//   Build_GeneratorCoal_C   mPowerConsumption "0.000000" (present-as-0),
//                           exp "1.600000"
const POWER_FRAGMENT = [
  {
    NativeClass:
      "/Script/CoreUObject.Class'/Script/FactoryGame.FGBuildableManufacturer'",
    Classes: [
      {
        ClassName: "Build_ConstructorMk1_C",
        mDisplayName: "Constructor",
        mPowerConsumption: "4.000000",
        mPowerConsumptionExponent: "1.321929",
      },
    ],
  },
  {
    NativeClass:
      "/Script/CoreUObject.Class'/Script/FactoryGame.FGBuildableResourceExtractor'",
    Classes: [
      {
        ClassName: "Build_MinerMk1_C",
        mDisplayName: "Miner Mk.1",
        mItemsPerCycle: "1",
        mExtractCycleTime: "1.000000",
        mAllowedResourceForms: "(RF_SOLID)",
        mOnlyAllowCertainResources: "False",
        mAllowedResources: "",
        mPowerConsumption: "5.000000",
        mPowerConsumptionExponent: "1.321929",
      },
    ],
  },
  {
    NativeClass:
      "/Script/CoreUObject.Class'/Script/FactoryGame.FGBuildableManufacturerVariablePower'",
    Classes: [
      {
        ClassName: "Build_HadronCollider_C",
        mDisplayName: "Particle Accelerator",
        mPowerConsumption: "0.000000",
        mPowerConsumptionExponent: "1.321929",
        mEstimatedMininumPowerConsumption: "250.000000", // game's own "Mininum" typo
        mEstimatedMaximumPowerConsumption: "1500.000000",
      },
    ],
  },
  {
    NativeClass:
      "/Script/CoreUObject.Class'/Script/FactoryGame.FGBuildableGeneratorFuel'",
    Classes: [
      {
        ClassName: "Build_GeneratorCoal_C",
        mDisplayName: "Coal-Powered Generator",
        mPowerConsumption: "0.000000", // present-as-0: generators PRODUCE power
        mPowerConsumptionExponent: "1.600000",
      },
    ],
  },
];

describe("parseDocsJson — machine power (spec Axis 5)", () => {
  it("branch 1: constant manufacturer — Constructor draws EXACTLY 4 MW, exp 1321929/1000000", () => {
    const cat = parseDocsJson(POWER_FRAGMENT);
    const p = cat.machines["constructor_mk1"]!.power;
    expect(p.mw.eq(Fraction.from(4))).toBe(true);
    expect(p.variable).toBe(false);
    expect(p.minMw).toBeUndefined();
    expect(p.maxMw).toBeUndefined();
    // Exponent verbatim, per machine — 1.321929 = 1321929/1000000 exact.
    expect(p.exponent.eq(Fraction.of(1321929, 1000000))).toBe(true);
  });

  it("branch 1: constant EXTRACTOR — Miner Mk1 draws EXACTLY 5 MW (a miner regression to 0 must fail)", () => {
    const cat = parseDocsJson(POWER_FRAGMENT);
    const p = cat.machines["miner_mk1"]!.power;
    expect(p.mw.eq(Fraction.from(5))).toBe(true);
    expect(p.variable).toBe(false);
  });

  it("branch 2: variable — Particle Accelerator mw is the EXACT midpoint 875, bounds kept", () => {
    const cat = parseDocsJson(POWER_FRAGMENT);
    const p = cat.machines["hadron_collider"]!.power;
    // (250 + 1500) / 2 = 875, exact.
    expect(p.mw.eq(Fraction.from(875))).toBe(true);
    expect(p.variable).toBe(true);
    expect(p.minMw!.eq(Fraction.from(250))).toBe(true);
    expect(p.maxMw!.eq(Fraction.from(1500))).toBe(true);
    expect(p.exponent.eq(Fraction.of(1321929, 1000000))).toBe(true);
  });

  it("branch 3: generator — present-as-0 mPowerConsumption → mw 0, not variable, exp 1.6", () => {
    const cat = parseDocsJson(POWER_FRAGMENT);
    const p = cat.machines["generator_coal"]!.power;
    expect(p.mw.eq(Fraction.from(0))).toBe(true);
    expect(p.variable).toBe(false);
    expect(p.minMw).toBeUndefined();
    // Exponent non-uniformity: generators carry 1.6, not the majority 1.321929.
    expect(p.exponent.eq(Fraction.of(16, 10))).toBe(true);
  });

  it("missing exponent key → the documented 1321929/1000000 default (never a rejection)", () => {
    const frag = [
      {
        NativeClass:
          "/Script/CoreUObject.Class'/Script/FactoryGame.FGBuildableManufacturer'",
        Classes: [
          {
            ClassName: "Build_NoExp_C",
            mDisplayName: "No Exponent",
            mPowerConsumption: "10.000000",
            // mPowerConsumptionExponent deliberately absent
          },
        ],
      },
    ];
    const cat = parseDocsJson(frag);
    const p = cat.machines["no_exp"]!.power;
    expect(p.mw.eq(Fraction.from(10))).toBe(true);
    expect(p.exponent.eq(Fraction.of(1321929, 1000000))).toBe(true);
  });
});

describe("parseDocsJson — mStackSize enum → stackSize (Stage 7 / Phase 2)", () => {
  // One item per enum value + a fluid + an unrecognized value, in a single
  // FGItemDescriptor group. Each item's expected stackSize is asserted below.
  const STACK_FRAGMENT = [
    {
      NativeClass:
        "/Script/CoreUObject.Class'/Script/FactoryGame.FGItemDescriptor'",
      Classes: [
        { ClassName: "Desc_One_C", mDisplayName: "One", mStackSize: "SS_ONE" },
        {
          ClassName: "Desc_Small_C",
          mDisplayName: "Small",
          mStackSize: "SS_SMALL",
        },
        {
          ClassName: "Desc_Medium_C",
          mDisplayName: "Medium",
          mStackSize: "SS_MEDIUM",
        },
        { ClassName: "Desc_Big_C", mDisplayName: "Big", mStackSize: "SS_BIG" },
        {
          ClassName: "Desc_Huge_C",
          mDisplayName: "Huge",
          mStackSize: "SS_HUGE",
        },
        {
          ClassName: "Desc_Fluidy_C",
          mDisplayName: "Fluidy",
          mForm: "RF_LIQUID",
          mStackSize: "SS_FLUID",
        },
        {
          ClassName: "Desc_Weird_C",
          mDisplayName: "Weird",
          mStackSize: "SS_MYSTERY",
        },
      ],
    },
  ];

  it("maps each recognized enum value to its items-per-slot Fraction", () => {
    const cat = parseDocsJson(STACK_FRAGMENT);
    expect(cat.items["one"]!.stackSize!.eq(Fraction.from(1))).toBe(true);
    expect(cat.items["small"]!.stackSize!.eq(Fraction.from(50))).toBe(true);
    expect(cat.items["medium"]!.stackSize!.eq(Fraction.from(100))).toBe(true);
    expect(cat.items["big"]!.stackSize!.eq(Fraction.from(200))).toBe(true);
    expect(cat.items["huge"]!.stackSize!.eq(Fraction.from(500))).toBe(true);
  });

  it("SS_FLUID and an unrecognized enum value both parse null", () => {
    const cat = parseDocsJson(STACK_FRAGMENT);
    expect(cat.items["fluidy"]!.stackSize).toBeNull();
    expect(cat.items["weird"]!.stackSize).toBeNull();
  });
});

// #28 — the catalog's three Record maps are built null-prototype at the parse
// boundary, so an id that normalizes to an Object.prototype member name cannot
// resolve a prototype value under bracket access. normalizeClassName lowercases,
// so Desc_Constructor_C / Build_Constructor_C / Recipe_Constructor_C all
// normalize to the key "constructor" — the canonical collision. This pins the
// boundary through the REAL parse path (a hand-built map would be tautological).
describe("parseDocsJson — null-prototype maps resist prototype-key collision (#28)", () => {
  const COLLISION_FRAGMENT = [
    {
      NativeClass:
        "/Script/CoreUObject.Class'/Script/FactoryGame.FGResourceDescriptor'",
      Classes: [
        {
          ClassName: "Desc_Constructor_C",
          mDisplayName: "Constructor Widget",
          mForm: "RF_SOLID",
        },
      ],
    },
    {
      NativeClass:
        "/Script/CoreUObject.Class'/Script/FactoryGame.FGBuildableManufacturer'",
      Classes: [
        { ClassName: "Build_Constructor_C", mDisplayName: "Constructor" },
      ],
    },
    {
      NativeClass: "/Script/CoreUObject.Class'/Script/FactoryGame.FGRecipe'",
      Classes: [
        {
          ClassName: "Recipe_Constructor_C",
          mDisplayName: "Constructor Widget",
          mIngredients: "",
          mProduct:
            "((ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_Constructor_C\"',Amount=1))",
          mManufactoringDuration: "1",
          mProducedIn: "/Game/Path/Build_Constructor_C",
        },
      ],
    },
  ];

  it("normalizes the colliding ClassNames to the key 'constructor' in each map", () => {
    const cat = parseDocsJson(COLLISION_FRAGMENT);
    expect(cat.items["constructor"]).toBeDefined();
    expect(cat.machines["constructor"]).toBeDefined();
    expect(cat.recipes["constructor"]).toBeDefined();
  });

  it("misses cleanly on an absent id — no lookup resolves an Object.prototype member", () => {
    const cat = parseDocsJson(COLLISION_FRAGMENT);
    // With a plain-proto {} seed these bracket reads would resolve the
    // Object.prototype `constructor` function; on a null-proto map they miss.
    const emptyItem = cat.items["nonexistent"];
    const emptyMachine = cat.machines["nonexistent"];
    const emptyRecipe = cat.recipes["nonexistent"];
    expect(emptyItem).toBeUndefined();
    expect(emptyMachine).toBeUndefined();
    expect(emptyRecipe).toBeUndefined();
    // Belt-and-braces: none of the three prototype-member names resolve either.
    // The colliding "constructor" own-entry is asserted above; here the
    // prototype-only names must miss cleanly on all three maps.
    for (const key of ["hasOwnProperty", "toString"]) {
      expect(cat.items[key]).toBeUndefined();
      expect(cat.machines[key]).toBeUndefined();
      expect(cat.recipes[key]).toBeUndefined();
    }
  });

  it("builds all three maps with a null prototype", () => {
    const cat = parseDocsJson(COLLISION_FRAGMENT);
    expect(Object.getPrototypeOf(cat.items)).toBeNull();
    expect(Object.getPrototypeOf(cat.machines)).toBeNull();
    expect(Object.getPrototypeOf(cat.recipes)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// FGSchematic unlock tiers (S20 P3, ticket #102)
// ---------------------------------------------------------------------------

/**
 * A REAL-shape `mRecipes` tuple string for the given recipe class names — the
 * game's own serialization, path prefix and TRAILING APOSTROPHE included. The
 * apostrophe is the whole point: it is what makes a whole-ref normalize return
 * the empty string, so every fixture here must carry it.
 */
function mRecipesRefs(...classNames: string[]): string {
  return `(${classNames
    .map(
      (cn) =>
        `"/Script/Engine.BlueprintGeneratedClass'/Game/FactoryGame/Recipes/${cn.replace(
          /_C$/,
          "",
        )}.${cn}'"`,
    )
    .join(",")})`;
}

/** One FGSchematic class entry unlocking `classNames` at `mTechTier`. */
function schematic(
  mTechTier: unknown,
  classNames: string[],
  mType = "EST_Milestone",
): Record<string, unknown> {
  return {
    ClassName: `Schematic_${mType}_C`,
    mType,
    mTechTier,
    mUnlocks: [
      { Class: "BP_UnlockRecipe_C", mRecipes: mRecipesRefs(...classNames) },
    ],
  };
}

/** DOCS_FRAGMENT plus an FGSchematic group carrying `schematics`. */
function withSchematics(schematics: Record<string, unknown>[]): unknown[] {
  return [
    ...DOCS_FRAGMENT,
    {
      NativeClass: "/Script/CoreUObject.Class'/Script/FactoryGame.FGSchematic'",
      Classes: schematics,
    },
  ];
}

describe("parseDocsJson — FGSchematic unlock tiers (S20 P3, spec row 8)", () => {
  it("maps a real mRecipes ref (trailing apostrophe and all) to a real catalog id — NEVER the empty string", () => {
    const cat = parseDocsJson(
      withSchematics([schematic("3", ["Recipe_IngotIron_C"])]),
    );
    // The r4 silent-total-failure guard. normalizeClassName splits on [./'] and
    // takes the LAST segment, so handing it a whole ref (they end in ') returns
    // "": every id would collapse to one empty key and gating would no-op
    // invisibly, disguised by the "empty map ⇒ the select collapses to all"
    // tolerance. A real ref must yield a real catalog id.
    expect(cat.recipeUnlocks[""]).toBeUndefined();
    expect(cat.recipeUnlocks["ingot_iron"]).toBe(3);
    expect(cat.recipes["ingot_iron"]).toBeDefined();
    // …and the RAW class name is not the catalog id, so it never matches: a
    // literal-key parse would gate nothing, since no lookup would ever hit.
    expect(cat.recipeUnlocks["Recipe_IngotIron_C"]).toBeUndefined();
  });

  it("takes the MINIMUM tier when several schematic types unlock one recipe", () => {
    const cat = parseDocsJson(
      withSchematics([
        // Higher tier FIRST, so last-wins would give 5 and first-wins 5 too —
        // only a real min-merge yields 1.
        schematic("5", ["Recipe_IngotIron_C"], "EST_Milestone"),
        schematic("1", ["Recipe_IngotIron_C"], "EST_MAM"),
        schematic("7", ["Recipe_IngotIron_C"], "EST_Alternate"),
      ]),
    );
    expect(cat.recipeUnlocks["ingot_iron"]).toBe(1);
  });

  it("matches refs regardless of GROUP ORDER — the schematic group may come first", () => {
    // The parse is two-pass precisely because Docs.json does not guarantee
    // FGSchematic follows FGRecipe: refs are collected during the group walk
    // and resolved against the recipes map only once that map is complete.
    // Every other fixture here appends the schematic group last, so this is the
    // one that exercises the ordering the design claims to tolerate.
    const cat = parseDocsJson([
      {
        NativeClass:
          "/Script/CoreUObject.Class'/Script/FactoryGame.FGSchematic'",
        Classes: [schematic("4", ["Recipe_IngotIron_C"])],
      },
      ...DOCS_FRAGMENT,
    ]);
    expect(cat.recipeUnlocks["ingot_iron"]).toBe(4);
  });

  it.each([
    ["a negative tier", "-3"],
    ["a fractional tier", "2.5"],
    ["a non-finite tier", "Infinity"],
    ["un-parseable garbage", "banana"],
    ["an absent mTechTier", undefined],
  ])("normalizes %s to 0", (_label, raw) => {
    // One fallback branch, one row per input class. Non-negative INTEGER is the
    // contract (mirroring the store-side validTier): a fractional tier would
    // truncate the derived TIER option list and a negative one would empty it.
    const cat = parseDocsJson(
      withSchematics([schematic(raw, ["Recipe_IngotIron_C"])]),
    );
    expect(cat.recipeUnlocks["ingot_iron"]).toBe(0);
  });

  it("yields an EMPTY map when no schematic group is present", () => {
    // The tolerant-parse posture: absent progression data gates nothing.
    const cat = parseDocsJson(DOCS_FRAGMENT);
    expect(Object.keys(cat.recipeUnlocks)).toEqual([]);
  });

  it("skips refs that normalize to no catalog recipe", () => {
    const cat = parseDocsJson(
      withSchematics([
        schematic("4", ["Recipe_IngotIron_C", "Recipe_ConveyorBeltMk1_C"]),
      ]),
    );
    // Building/cosmetic recipes are unmatched and dropped silently by design —
    // and the matched sibling in the SAME schematic still lands.
    expect(cat.recipeUnlocks["conveyor_belt_mk1"]).toBeUndefined();
    expect(cat.recipeUnlocks["ingot_iron"]).toBe(4);
  });

  it("reads only BP_UnlockRecipe_C entries — other unlock kinds are ignored", () => {
    const cat = parseDocsJson(
      withSchematics([
        {
          ClassName: "Schematic_Tape_C",
          mType: "EST_Milestone",
          mTechTier: "6",
          mUnlocks: [
            // A non-recipe unlock carrying a recipe-shaped payload must not
            // register a tier (tape/info unlocks are not progression gates).
            {
              Class: "FGUnlockTape",
              mRecipes: mRecipesRefs("Recipe_IngotIron_C"),
            },
          ],
        },
      ]),
    );
    expect(cat.recipeUnlocks["ingot_iron"]).toBeUndefined();
  });

  it("builds recipeUnlocks with a null prototype", () => {
    const cat = parseDocsJson(
      withSchematics([schematic("1", ["Recipe_IngotIron_C"])]),
    );
    expect(Object.getPrototypeOf(cat.recipeUnlocks)).toBeNull();
    // A prototype-member id misses cleanly (#28).
    expect(cat.recipeUnlocks["constructor"]).toBeUndefined();
  });
});

describe("recipe variable-power parse (#142)", () => {
  const docsWith = (extra: Record<string, string>) => [
    {
      NativeClass:
        "/Script/CoreUObject.Class'/Script/FactoryGame.FGItemDescriptor'",
      Classes: [
        { ClassName: "Desc_A_C", mDisplayName: "A", mForm: "RF_SOLID" },
        { ClassName: "Desc_B_C", mDisplayName: "B", mForm: "RF_SOLID" },
      ],
    },
    {
      NativeClass:
        "/Script/CoreUObject.Class'/Script/FactoryGame.FGBuildableManufacturer'",
      Classes: [{ ClassName: "Build_M_C", mDisplayName: "M" }],
    },
    {
      NativeClass: "/Script/CoreUObject.Class'/Script/FactoryGame.FGRecipe'",
      Classes: [
        {
          ClassName: "Recipe_X_C",
          mDisplayName: "X",
          mIngredients:
            "((ItemClass=BlueprintGeneratedClass'\"/Game/P/Desc_A_C\"',Amount=1))",
          mProduct:
            "((ItemClass=BlueprintGeneratedClass'\"/Game/P/Desc_B_C\"',Amount=1))",
          mManufactoringDuration: "1",
          mProducedIn: "/Game/P/Build_M_C",
          ...extra,
        },
      ],
    },
  ];

  it("both fields present → attached exactly", () => {
    const cat = parseDocsJson(
      docsWith({
        mVariablePowerConsumptionConstant: "250.000000",
        mVariablePowerConsumptionFactor: "500.000000",
      }),
    );
    const vp = cat.recipes["x"]!.variablePower;
    expect(vp).toBeDefined();
    expect(vp!.constantMw.eq(Fraction.from(250))).toBe(true);
    expect(vp!.factorMw.eq(Fraction.from(500))).toBe(true);
  });

  it("one field missing → absent", () => {
    const cat = parseDocsJson(
      docsWith({ mVariablePowerConsumptionConstant: "250.000000" }),
    );
    expect(cat.recipes["x"]!.variablePower).toBeUndefined();
  });

  it("malformed field → absent (lenient, never a rejection)", () => {
    const cat = parseDocsJson(
      docsWith({
        mVariablePowerConsumptionConstant: "nope",
        mVariablePowerConsumptionFactor: "500.000000",
      }),
    );
    expect(cat.recipes["x"]!.variablePower).toBeUndefined();
  });

  it("factor 0 → attached", () => {
    const cat = parseDocsJson(
      docsWith({
        mVariablePowerConsumptionConstant: "100.000000",
        mVariablePowerConsumptionFactor: "0.000000",
      }),
    );
    const vp = cat.recipes["x"]!.variablePower;
    expect(vp).toBeDefined();
    expect(vp!.factorMw.eq(Fraction.from(0))).toBe(true);
  });
});

describe("parseDocsJson — parsed tier table (#140 P0)", () => {
  // Build a Docs.json fragment carrying belt (mSpeed) and pipe (mFlowLimit)
  // classes, plus the minimal item/recipe/machine spine so parseDocsJson runs.
  function docsWithTiers(
    belts: { className: string; mSpeed?: string }[],
    pipes: { className: string; mFlowLimit?: string }[],
  ): unknown[] {
    return [
      ...DOCS_FRAGMENT,
      {
        NativeClass:
          "/Script/CoreUObject.Class'/Script/FactoryGame.FGBuildableConveyorBelt'",
        Classes: belts.map((b) => ({
          ClassName: b.className,
          ...(b.mSpeed !== undefined ? { mSpeed: b.mSpeed } : {}),
        })),
      },
      {
        NativeClass:
          "/Script/CoreUObject.Class'/Script/FactoryGame.FGBuildablePipeline'",
        Classes: pipes.map((p) => ({
          ClassName: p.className,
          ...(p.mFlowLimit !== undefined ? { mFlowLimit: p.mFlowLimit } : {}),
        })),
      },
    ];
  }

  const nums = (fs: Fraction[]) => fs.map((f) => f.toString());

  it("derives belt = mSpeed × 1/2, pipe = mFlowLimit × 60, sorted ascending from a scrambled fragment", () => {
    // Deliberately scrambled (the real Classes array is Mk1,Mk5,Mk6,Mk4,Mk3,Mk2).
    const cat = parseDocsJson(
      docsWithTiers(
        [
          { className: "Build_ConveyorBeltMk1_C", mSpeed: "120.000000" }, // 60
          { className: "Build_ConveyorBeltMk5_C", mSpeed: "1560.000000" }, // 780
          { className: "Build_ConveyorBeltMk3_C", mSpeed: "540.000000" }, // 270
          { className: "Build_ConveyorBeltMk2_C", mSpeed: "240.000000" }, // 120
        ],
        [
          { className: "Build_PipelineMK2_C", mFlowLimit: "10.000000" }, // 600
          { className: "Build_Pipeline_C", mFlowLimit: "5.000000" }, // 300
        ],
      ),
    );
    expect(nums(cat.tiers.belt)).toEqual(["60", "120", "270", "780"]);
    expect(nums(cat.tiers.pipe)).toEqual(["300", "600"]);
  });

  it("dedupes by value — the cosmetic _NoIndicator_ pipe variants collapse", () => {
    const cat = parseDocsJson(
      docsWithTiers(
        [{ className: "Build_ConveyorBeltMk1_C", mSpeed: "120.000000" }],
        [
          { className: "Build_Pipeline_C", mFlowLimit: "5.000000" }, // 300
          { className: "Build_PipelineMK2_C", mFlowLimit: "10.000000" }, // 600
          { className: "Build_PipelineMK2_NoIndicator_C", mFlowLimit: "10.000000" },
          { className: "Build_Pipeline_NoIndicator_C", mFlowLimit: "5.000000" },
        ],
      ),
    );
    // Four pipe classes, two distinct flow limits → two tiers.
    expect(nums(cat.tiers.pipe)).toEqual(["300", "600"]);
  });

  it("per-kind fallback: a belts-only file keeps the curated pipe table (and vice versa)", () => {
    const beltsOnly = parseDocsJson(
      docsWithTiers(
        [{ className: "Build_ConveyorBeltMk1_C", mSpeed: "120.000000" }],
        [],
      ),
    );
    expect(nums(beltsOnly.tiers.belt)).toEqual(["60"]);
    expect(beltsOnly.tiers.pipe).toEqual(TIER_TABLE.pipe);

    const pipesOnly = parseDocsJson(
      docsWithTiers(
        [],
        [{ className: "Build_Pipeline_C", mFlowLimit: "5.000000" }],
      ),
    );
    expect(pipesOnly.tiers.belt).toEqual(TIER_TABLE.belt);
    expect(nums(pipesOnly.tiers.pipe)).toEqual(["300"]);
  });

  it("skips a malformed individual entry leniently — the rest of the kind still parses", () => {
    const cat = parseDocsJson(
      docsWithTiers(
        [
          { className: "Build_ConveyorBeltMk1_C", mSpeed: "120.000000" }, // 60
          { className: "Build_ConveyorBeltBad_C", mSpeed: "not-a-number" }, // skipped
          { className: "Build_ConveyorBeltMk2_C" }, // mSpeed absent → skipped
          { className: "Build_ConveyorBeltMk3_C", mSpeed: "540.000000" }, // 270
        ],
        [{ className: "Build_Pipeline_C", mFlowLimit: "5.000000" }],
      ),
    );
    expect(nums(cat.tiers.belt)).toEqual(["60", "270"]);
    expect(nums(cat.tiers.pipe)).toEqual(["300"]);
  });

  it("ignores the sibling FGBuildablePipelinePump / Junction families (no mFlowLimit tiers)", () => {
    const cat = parseDocsJson([
      ...DOCS_FRAGMENT,
      {
        NativeClass:
          "/Script/CoreUObject.Class'/Script/FactoryGame.FGBuildablePipelinePump'",
        Classes: [{ ClassName: "Build_PipelinePump_C" }],
      },
      {
        NativeClass:
          "/Script/CoreUObject.Class'/Script/FactoryGame.FGBuildablePipeline'",
        Classes: [{ ClassName: "Build_Pipeline_C", mFlowLimit: "5.000000" }],
      },
    ]);
    // Only the real FGBuildablePipeline group contributes a tier; the Pump group
    // is not admitted (it would otherwise have to be skipped for absent flow).
    expect(nums(cat.tiers.pipe)).toEqual(["300"]);
  });
});

describe("parseDocsJson — real bundled file tier guard (#140 P0, spec D3)", () => {
  it("the derived table EQUALS the curated TIER_TABLE value-for-value", () => {
    // The audit-demanded drift detector: parse the real shipped Docs.json (a
    // unit-scope read is precedented — packaging.test.ts:12, store.test.ts:140)
    // and prove the derived tiers reproduce the curated table exactly. A future
    // game patch changing a belt speed / pipe flow limit fails HERE, loudly,
    // instead of silently desyncing the curated fallback from live data.
    const text = readFileSync("public/bundled-docs/en-US.json", "utf8");
    const cat = parseDocsJson(JSON.parse(text));
    expect(cat.tiers.belt.length).toBe(TIER_TABLE.belt.length);
    expect(cat.tiers.pipe.length).toBe(TIER_TABLE.pipe.length);
    for (let i = 0; i < TIER_TABLE.belt.length; i++) {
      expect(cat.tiers.belt[i]!.eq(TIER_TABLE.belt[i]!)).toBe(true);
    }
    for (let i = 0; i < TIER_TABLE.pipe.length; i++) {
      expect(cat.tiers.pipe[i]!.eq(TIER_TABLE.pipe[i]!)).toBe(true);
    }
  });
});
