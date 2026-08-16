import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Fraction } from "../core/fraction.ts";
import { parseCatalogFromText } from "./catalog.ts";
import type { Catalog, CatalogRecipe } from "./types.ts";
import {
  discoverPackagingPairs,
  resolvePackagingPair,
} from "../core/packaging-pair.ts";

const bundled = parseCatalogFromText(
  readFileSync("public/bundled-docs/en-US.json", "utf8"),
);

const expected = [
  [
    "packaged_alumina",
    "unpackage_alumina",
    "alumina_solution",
    "packaged_alumina",
    "fluid_canister",
    "120",
    "120",
    "120",
    "120",
    "120",
    "120",
  ],
  [
    "packaged_biofuel",
    "unpackage_bio_fuel",
    "liquid_biofuel",
    "packaged_biofuel",
    "fluid_canister",
    "40",
    "40",
    "40",
    "60",
    "60",
    "60",
  ],
  [
    "packaged_crude_oil",
    "unpackage_oil",
    "liquid_oil",
    "packaged_oil",
    "fluid_canister",
    "30",
    "30",
    "30",
    "60",
    "60",
    "60",
  ],
  [
    "fuel",
    "unpackage_fuel",
    "liquid_fuel",
    "fuel",
    "fluid_canister",
    "40",
    "40",
    "40",
    "60",
    "60",
    "60",
  ],
  [
    "packaged_ionized_fuel",
    "unpackage_ionized_fuel",
    "ionized_fuel",
    "packaged_ionized_fuel",
    "gas_tank",
    "80",
    "40",
    "40",
    "40",
    "80",
    "40",
  ],
  [
    "packaged_nitric_acid",
    "unpackage_nitric_acid",
    "nitric_acid",
    "packaged_nitric_acid",
    "gas_tank",
    "30",
    "30",
    "30",
    "20",
    "20",
    "20",
  ],
  [
    "packaged_nitrogen",
    "unpackage_nitrogen",
    "nitrogen_gas",
    "packaged_nitrogen_gas",
    "gas_tank",
    "240",
    "60",
    "60",
    "60",
    "240",
    "60",
  ],
  [
    "packaged_oil_residue",
    "unpackage_oil_residue",
    "heavy_oil_residue",
    "packaged_oil_residue",
    "fluid_canister",
    "30",
    "30",
    "30",
    "20",
    "20",
    "20",
  ],
  [
    "packaged_rocket_fuel",
    "unpackage_rocket_fuel",
    "rocket_fuel",
    "packaged_rocket_fuel",
    "gas_tank",
    "120",
    "60",
    "60",
    "60",
    "120",
    "60",
  ],
  [
    "packaged_sulfuric_acid",
    "unpackage_sulfuric_acid",
    "sulfuric_acid",
    "packaged_sulfuric_acid",
    "fluid_canister",
    "40",
    "40",
    "40",
    "60",
    "60",
    "60",
  ],
  [
    "packaged_turbo_fuel",
    "unpackage_turbo_fuel",
    "liquid_turbo_fuel",
    "turbo_fuel",
    "fluid_canister",
    "20",
    "20",
    "20",
    "20",
    "20",
    "20",
  ],
  [
    "packaged_water",
    "unpackage_water",
    "water",
    "packaged_water",
    "fluid_canister",
    "60",
    "60",
    "60",
    "120",
    "120",
    "120",
  ],
] as const;

describe("packaging pair discovery", () => {
  it("discovers the 12 bundled reversible Packager pairs with exact IO", () => {
    const got = Object.keys(bundled.items)
      .flatMap((itemId) => discoverPackagingPairs(bundled, itemId))
      .map((pair) => [
        pair.packageRecipe.id,
        pair.unpackageRecipe.id,
        pair.fluidItemId,
        pair.packagedItemId,
        pair.containerItemId,
        pair.packageFluidRate.toString(),
        pair.packagePackagedRate.toString(),
        pair.packageContainerRate.toString(),
        pair.unpackagePackagedRate.toString(),
        pair.unpackageFluidRate.toString(),
        pair.unpackageContainerRate.toString(),
      ])
      .sort((a, b) => a[0]!.localeCompare(b[0]!));

    expect(got).toEqual([...expected].sort((a, b) => a[0].localeCompare(b[0])));
  });

  it("uses the package recipe ID as the sole stable key", () => {
    const pair = resolvePackagingPair(bundled, "packaged_nitrogen");
    expect(pair?.unpackageRecipe.id).toBe("unpackage_nitrogen");
    expect(pair?.packageFluidRate.eq(Fraction.from(240))).toBe(true);
    expect(pair?.packagePackagedRate.eq(Fraction.from(60))).toBe(true);
    expect(resolvePackagingPair(bundled, "unpackage_nitrogen")).toBeNull();
    expect(resolvePackagingPair(bundled, "stale-id")).toBeNull();
  });

  it.each([
    [
      "incomplete",
      [recipe("package", [io("fluid", 60)], [io("packaged", 60)])],
    ],
    [
      "mismatched identities",
      [
        recipe(
          "package",
          [io("fluid", 60), io("can", 60)],
          [io("packaged", 60)],
        ),
        recipe(
          "unpackage",
          [io("packaged", 60)],
          [io("other-fluid", 60), io("can", 60)],
        ),
      ],
    ],
    [
      "mismatched reciprocal ratios",
      [
        recipe(
          "package",
          [io("fluid", 120), io("can", 60)],
          [io("packaged", 60)],
        ),
        recipe(
          "unpackage",
          [io("packaged", 60)],
          [io("fluid", 60), io("can", 60)],
        ),
      ],
    ],
    [
      "non-Packager lookalikes",
      [
        recipe(
          "package",
          [io("fluid", 60), io("can", 60)],
          [io("packaged", 60)],
          "refinery",
        ),
        recipe(
          "unpackage",
          [io("packaged", 60)],
          [io("fluid", 60), io("can", 60)],
          "refinery",
        ),
      ],
    ],
  ])("rejects %s", (_name, recipes) => {
    const catalog = fixture(recipes);
    expect(discoverPackagingPairs(catalog, "fluid")).toEqual([]);
    expect(resolvePackagingPair(catalog, "package")).toBeNull();
  });

  it("rejects an ambiguous package recipe with two reciprocal reverses", () => {
    const catalog = fixture([
      recipe("package", [io("fluid", 60), io("can", 60)], [io("packaged", 60)]),
      recipe(
        "reverse-a",
        [io("packaged", 60)],
        [io("fluid", 60), io("can", 60)],
      ),
      recipe(
        "reverse-b",
        [io("packaged", 120)],
        [io("fluid", 120), io("can", 120)],
      ),
    ]);
    expect(discoverPackagingPairs(catalog, "fluid")).toEqual([]);
    expect(resolvePackagingPair(catalog, "package")).toBeNull();
  });

  it.each([
    ["package fluid", "packageFluid"],
    ["package container", "packageContainer"],
    ["package output", "packageOutput"],
    ["reverse input", "reverseInput"],
    ["reverse fluid", "reverseFluid"],
    ["reverse container", "reverseContainer"],
  ] as const)(
    "rejects non-positive %s rates without throwing",
    (_name, key) => {
      for (const invalidRate of [0, -1]) {
        const rates = {
          packageFluid: 60,
          packageContainer: 60,
          packageOutput: 60,
          reverseInput: 60,
          reverseFluid: 60,
          reverseContainer: 60,
        };
        rates[key] = invalidRate;
        const catalog = fixture([
          recipe(
            "package",
            [
              io("fluid", rates.packageFluid),
              io("can", rates.packageContainer),
            ],
            [io("packaged", rates.packageOutput)],
          ),
          recipe(
            "unpackage",
            [io("packaged", rates.reverseInput)],
            [
              io("fluid", rates.reverseFluid),
              io("can", rates.reverseContainer),
            ],
          ),
        ]);

        expect(() => discoverPackagingPairs(catalog, "fluid")).not.toThrow();
        expect(discoverPackagingPairs(catalog, "fluid")).toEqual([]);
        expect(() => resolvePackagingPair(catalog, "package")).not.toThrow();
        expect(resolvePackagingPair(catalog, "package")).toBeNull();
      }
    },
  );
});

function io(itemId: string, perMinute: number) {
  return { itemId, perMinute: Fraction.from(perMinute) };
}

function recipe(
  id: string,
  inputs: CatalogRecipe["inputs"],
  outputs: CatalogRecipe["outputs"],
  machineId = "packager",
): CatalogRecipe {
  return {
    id,
    displayName: id,
    machineId,
    isAlternate: false,
    inputs,
    outputs,
    primaryOutputId: outputs[0]?.itemId ?? "",
  };
}

function fixture(recipes: CatalogRecipe[]): Catalog {
  return {
    items: Object.fromEntries(
      ["fluid", "other-fluid", "can", "packaged"].map((id) => [
        id,
        { id, displayName: id, isFluid: id.includes("fluid"), stackSize: null },
      ]),
    ),
    machines: {},
    recipes: Object.fromEntries(recipes.map((entry) => [entry.id, entry])),
    tiers: { belt: [], pipe: [] },
    recipeUnlocks: {},
    extractors: {},
  };
}
