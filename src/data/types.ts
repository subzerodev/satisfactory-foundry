import { Fraction } from "../core/fraction.ts";

/** A game item — solid or fluid. `isFluid` drives lane kind (belt vs pipe). */
export interface CatalogItem {
  id: string;
  displayName: string;
  isFluid: boolean;
}

/** A producing machine (Smelter, Constructor, …). Id + name only — no power. */
export interface CatalogMachine {
  id: string;
  displayName: string;
}

/** One recipe input/output at 100% clock, exact per-minute flow. */
export interface RecipeIO {
  itemId: string;
  perMinute: Fraction;
}

export interface CatalogRecipe {
  id: string;
  displayName: string;
  machineId: string;
  isAlternate: boolean;
  inputs: RecipeIO[];
  outputs: RecipeIO[];
  /** = outputs[0].itemId (the port's primary-output rule, renamed field). */
  primaryOutputId: string;
}

/** Unlocked transport-tier throughputs per kind, ascending. */
export interface TierTable {
  belt: Fraction[];
  pipe: Fraction[];
}

export interface Catalog {
  items: Record<string, CatalogItem>;
  machines: Record<string, CatalogMachine>;
  recipes: Record<string, CatalogRecipe>;
  tiers: TierTable;
}
