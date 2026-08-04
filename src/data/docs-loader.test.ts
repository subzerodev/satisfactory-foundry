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
    // Items carry id + displayName + isFluid + stackSize (no power).
    expect(Object.keys(cat.items["water"]!).sort()).toEqual([
      "displayName",
      "id",
      "isFluid",
      "stackSize",
    ]);
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

  it("attaches the shared TIER_TABLE to the catalog", () => {
    const cat = parseDocsJson(DOCS_FRAGMENT);
    expect(cat.tiers).toBe(TIER_TABLE);
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
