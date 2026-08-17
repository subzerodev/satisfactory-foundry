import type { Fraction } from "./fraction.ts";

export interface PackagingRecipeIO {
  itemId: string;
  perMinute: Fraction;
}

export interface PackagingRecipe {
  id: string;
  machineId: string;
  inputs: PackagingRecipeIO[];
  outputs: PackagingRecipeIO[];
}

export interface PackagingCatalog {
  items: Record<string, { isFluid: boolean } | undefined>;
  recipes: Record<string, PackagingRecipe | undefined>;
}

export interface PackagingPair {
  packageRecipe: PackagingRecipe;
  unpackageRecipe: PackagingRecipe;
  fluidItemId: string;
  packagedItemId: string;
  containerItemId: string;
  packageFluidRate: Fraction;
  packagePackagedRate: Fraction;
  packageContainerRate: Fraction;
  unpackagePackagedRate: Fraction;
  unpackageFluidRate: Fraction;
  unpackageContainerRate: Fraction;
}

function isPositiveRate(entry: PackagingRecipeIO): boolean {
  return entry.perMinute.num > 0n;
}

export function discoverPackagingPairs(
  catalog: PackagingCatalog,
  itemId: string,
): PackagingPair[] {
  return Object.values(catalog.recipes)
    .filter(
      (recipe): recipe is PackagingRecipe => recipe?.machineId === "packager",
    )
    .map((recipe) => resolvePackagingPair(catalog, recipe.id))
    .filter((pair): pair is PackagingPair => pair?.fluidItemId === itemId)
    .sort((a, b) => a.packageRecipe.id.localeCompare(b.packageRecipe.id));
}

export function resolvePackagingPair(
  catalog: PackagingCatalog,
  packageRecipeId: string,
): PackagingPair | null {
  const packageRecipe = catalog.recipes[packageRecipeId];
  if (packageRecipe?.machineId !== "packager") return null;
  if (packageRecipe.inputs.length !== 2 || packageRecipe.outputs.length !== 1) {
    return null;
  }

  const fluidInput = packageRecipe.inputs.find(
    (entry) => catalog.items[entry.itemId]?.isFluid === true,
  );
  const containerInput = packageRecipe.inputs.find(
    (entry) => catalog.items[entry.itemId]?.isFluid === false,
  );
  const packagedOutput = packageRecipe.outputs[0];
  if (
    !fluidInput ||
    !containerInput ||
    !packagedOutput ||
    catalog.items[packagedOutput.itemId]?.isFluid !== false ||
    packagedOutput.itemId === containerInput.itemId ||
    !isPositiveRate(fluidInput) ||
    !isPositiveRate(containerInput) ||
    !isPositiveRate(packagedOutput)
  ) {
    return null;
  }

  const reverses = Object.values(catalog.recipes).filter(
    (candidate): candidate is PackagingRecipe => {
      if (
        candidate?.machineId !== "packager" ||
        candidate.inputs.length !== 1 ||
        candidate.outputs.length !== 2 ||
        candidate.inputs[0]?.itemId !== packagedOutput.itemId
      ) {
        return false;
      }
      const reverseFluid = candidate.outputs.find(
        (entry) => entry.itemId === fluidInput.itemId,
      );
      const reverseContainer = candidate.outputs.find(
        (entry) => entry.itemId === containerInput.itemId,
      );
      if (!reverseFluid || !reverseContainer) return false;
      const reversePackaged = candidate.inputs[0]!;
      if (
        !isPositiveRate(reversePackaged) ||
        !isPositiveRate(reverseFluid) ||
        !isPositiveRate(reverseContainer)
      ) {
        return false;
      }
      return (
        fluidInput.perMinute
          .div(packagedOutput.perMinute)
          .eq(reverseFluid.perMinute.div(reversePackaged.perMinute)) &&
        containerInput.perMinute
          .div(packagedOutput.perMinute)
          .eq(reverseContainer.perMinute.div(reversePackaged.perMinute))
      );
    },
  );
  if (reverses.length !== 1) return null;

  const unpackageRecipe = reverses[0]!;
  const reverseFluid = unpackageRecipe.outputs.find(
    (entry) => entry.itemId === fluidInput.itemId,
  )!;
  const reverseContainer = unpackageRecipe.outputs.find(
    (entry) => entry.itemId === containerInput.itemId,
  )!;
  return {
    packageRecipe,
    unpackageRecipe,
    fluidItemId: fluidInput.itemId,
    packagedItemId: packagedOutput.itemId,
    containerItemId: containerInput.itemId,
    packageFluidRate: fluidInput.perMinute,
    packagePackagedRate: packagedOutput.perMinute,
    packageContainerRate: containerInput.perMinute,
    unpackagePackagedRate: unpackageRecipe.inputs[0]!.perMinute,
    unpackageFluidRate: reverseFluid.perMinute,
    unpackageContainerRate: reverseContainer.perMinute,
  };
}
