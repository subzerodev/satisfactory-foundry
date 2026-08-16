import { Fraction } from "./fraction.ts";
import { machinePowerProjection } from "./machine-power.ts";
import type { MachinePowerInput } from "./machine-power.ts";

const constant: MachinePowerInput = {
  mw: Fraction.from(10),
  variable: false,
  exponent: Fraction.parse("1.321929"),
};
const variable: MachinePowerInput = {
  mw: Fraction.from(875),
  variable: true,
  minMw: Fraction.from(250),
  maxMw: Fraction.from(1500),
  exponent: Fraction.parse("1.6"),
};

describe("machinePowerProjection", () => {
  it("keeps constant and variable power exact at 100%", () => {
    expect(machinePowerProjection(constant, 266, Fraction.from(100))).toEqual({
      kind: "exact",
      mw: Fraction.from(2660),
    });
    expect(machinePowerProjection(variable, 2, Fraction.from(100))).toEqual({
      kind: "exact",
      mw: Fraction.from(1750),
      variableBoundsMw: {
        min: Fraction.from(500),
        max: Fraction.from(3000),
      },
    });
  });

  it("labels non-100% constant and variable projections as estimated", () => {
    const constantResult = machinePowerProjection(
      constant,
      3,
      Fraction.from(50),
    );
    expect(constantResult.kind).toBe("estimated");
    if (constantResult.kind !== "estimated")
      throw new Error("expected estimate");
    expect(constantResult.mw).toBeCloseTo(30 * 0.5 ** 1.321929, 10);

    const variableResult = machinePowerProjection(
      variable,
      2,
      Fraction.from(150),
    );
    expect(variableResult.kind).toBe("estimated");
    if (variableResult.kind !== "estimated")
      throw new Error("expected estimate");
    const factor = 1.5 ** 1.6;
    expect(variableResult.mw).toBeCloseTo(1750 * factor, 10);
    expect(variableResult.variableBoundsMw?.min).toBeCloseTo(500 * factor, 10);
    expect(variableResult.variableBoundsMw?.max).toBeCloseTo(3000 * factor, 10);
  });
});
