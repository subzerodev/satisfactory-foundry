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
    // Items carry id + displayName + isFluid only — no power, no stack size.
    expect(Object.keys(cat.items["water"]!).sort()).toEqual([
      "displayName",
      "id",
      "isFluid",
    ]);
  });

  it("extracts machines with id + displayName only (no power)", () => {
    const cat = parseDocsJson(DOCS_FRAGMENT);
    expect(cat.machines["smelter_mk1"]).toEqual({
      id: "smelter_mk1",
      displayName: "Smelter",
    });
    expect(cat.machines["oil_refinery"]).toEqual({
      id: "oil_refinery",
      displayName: "Refinery",
    });
  });

  it("attaches the shared TIER_TABLE to the catalog", () => {
    const cat = parseDocsJson(DOCS_FRAGMENT);
    expect(cat.tiers).toBe(TIER_TABLE);
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
