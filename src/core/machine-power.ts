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
