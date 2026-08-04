import { Fraction } from "../core/fraction.ts";

/** A game item — solid or fluid. `isFluid` drives lane kind (belt vs pipe). */
export interface CatalogItem {
  id: string;
  displayName: string;
  isFluid: boolean;
  /**
   * Solid stack size (items per inventory slot), parsed from `mStackSize` via
   * the fact-table enum map (SS_ONE 1 / SS_SMALL 50 / SS_MEDIUM 100 / SS_BIG
   * 200 / SS_HUGE 500). `null` for fluids (SS_FLUID — cargo math uses tank
   * volumes, never stacks) AND for an unrecognized enum value (honest absent,
   * not a guessed number — solid-vehicle math is then unavailable rather than
   * wrong). The transport solver reads this as the `stackSize` input. */
  stackSize: Fraction | null;
}

/**
 * A producing machine (Smelter, Constructor, …). Carries its power draw as of
 * Stage 6 / Phase 1 (superseding the prior "id + name only — no power" note,
 * per features/chain-helpers/phase-1/brainstorm.md). The draw is parsed from
 * the Docs.json power fields; the exponent is stored verbatim but never applied
 * in this phase (overclock power is #26's display problem).
 */
export interface CatalogMachine {
  id: string;
  displayName: string;
  power: MachinePower;
}

/**
 * A machine's power draw. Values are exact Fractions parsed from the game data.
 *
 * Three-branch parse (docs-loader): a positive `mPowerConsumption` → constant;
 * both estimate bounds present → variable (draw ramps with clock); neither → a
 * zero-draw machine (the generators, which carry `mPowerConsumption` present-as-0
 * and PRODUCE power — production is deliberately unparsed this arc).
 */
export interface MachinePower {
  /** Constant draw at 100% clock — or, for variable-power machines, the
   *  min/max MIDPOINT (an estimate; the exact bounds live in minMw/maxMw). */
  mw: Fraction;
  /** true ⇒ `mw` is a cycle-average estimate, not a fixed draw. */
  variable: boolean;
  /** Exact lower/upper draw bounds for variable-power machines. Kept as PARSE
   *  OUTPUTS because the midpoint is lossy — the catalog retains both so no
   *  consumer has to re-derive them. Absent on constant/zero-draw machines. */
  minMw?: Fraction;
  maxMw?: Fraction;
  /** `mPowerConsumptionExponent` verbatim, PER MACHINE — the snapshot is
   *  NON-UNIFORM (observed in the bundled snapshot: 1.321929 on 15 of the 20
   *  admitted buildings, 1.6 on the other 5), so a module constant would be
   *  silently wrong for the minority. Stored, not applied here. */
  exponent: Fraction;
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
