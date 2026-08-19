import { Fraction } from "./fraction.ts";

export interface MachinePowerInput {
  mw: Fraction;
  variable: boolean;
  minMw?: Fraction;
  maxMw?: Fraction;
  exponent: Fraction;
}

export type MachinePowerProjection =
  | {
      kind: "exact";
      mw: Fraction;
      variableBoundsMw?: { min: Fraction; max: Fraction };
    }
  | {
      kind: "estimated";
      mw: number;
      variableBoundsMw?: { min: number; max: number };
    };

/** A recipe's variable-power range: draw spans [constantMw, constantMw +
 *  factorMw]. Mirrors CatalogRecipe.variablePower structurally (#142). */
export interface RecipeVariablePower {
  constantMw: Fraction;
  factorMw: Fraction;
}

/**
 * The recipe-level power correction (#142), single owner of the gating rule:
 * the building class is the gate — `power.variable` is set exclusively for
 * the three FGBuildableManufacturerVariablePower classes — so a
 * constant-power machine's inert recipe fields (the Ballistic Warp Drive
 * trap) can never fire. A variable machine with a field-carrying recipe gets
 * the exact per-recipe range in place of the all-recipes envelope; without
 * fields it keeps the envelope (honest fallback).
 */
export function effectiveMachinePower(
  power: MachinePowerInput,
  recipeVariable?: RecipeVariablePower,
): MachinePowerInput {
  if (!power.variable || recipeVariable === undefined) return power;
  const min = recipeVariable.constantMw;
  const max = recipeVariable.constantMw.add(recipeVariable.factorMw);
  return {
    variable: true,
    mw: min.add(max).div(Fraction.from(2)),
    minMw: min,
    maxMw: max,
    exponent: power.exponent,
  };
}

export function machinePowerProjection(
  power: MachinePowerInput,
  machineCount: number,
  clock: Fraction,
): MachinePowerProjection {
  const count = Fraction.from(machineCount);
  if (clock.eq(Fraction.from(100))) {
    return {
      kind: "exact",
      mw: count.mul(power.mw),
      ...(power.variable && power.minMw && power.maxMw
        ? {
            variableBoundsMw: {
              min: count.mul(power.minMw),
              max: count.mul(power.maxMw),
            },
          }
        : {}),
    };
  }

  const factor =
    (fractionToNumber(clock) / 100) ** fractionToNumber(power.exponent);
  return {
    kind: "estimated",
    mw: machineCount * fractionToNumber(power.mw) * factor,
    ...(power.variable && power.minMw && power.maxMw
      ? {
          variableBoundsMw: {
            min: machineCount * fractionToNumber(power.minMw) * factor,
            max: machineCount * fractionToNumber(power.maxMw) * factor,
          },
        }
      : {}),
  };
}

function fractionToNumber(value: Fraction): number {
  return Number(value.num) / Number(value.den);
}
