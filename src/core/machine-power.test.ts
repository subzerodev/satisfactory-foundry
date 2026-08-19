import { Fraction } from "./fraction.ts";
import {
  machinePowerProjection,
  effectiveMachinePower,
} from "./machine-power.ts";
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

describe("effectiveMachinePower (#142)", () => {
  const recipeRange = {
    constantMw: Fraction.from(250),
    factorMw: Fraction.from(500),
  };

  it("variable machine + recipe fields → exact per-recipe range", () => {
    const got = effectiveMachinePower(variable, recipeRange);
    expect(got.variable).toBe(true);
    expect(got.mw.eq(Fraction.from(500))).toBe(true); // 250 + 500/2
    expect(got.minMw?.eq(Fraction.from(250))).toBe(true);
    expect(got.maxMw?.eq(Fraction.from(750))).toBe(true);
    expect(got.exponent.eq(variable.exponent)).toBe(true);
  });

  it("constant machine + recipe fields → UNCHANGED (the Ballistic Warp Drive pin)", () => {
    // The building class is the gate: a constant-power Manufacturer's inert
    // recipe fields must never fire (gating on the fields would report the
    // 55 MW Ballistic Warp Drive at 500–1500 MW).
    expect(effectiveMachinePower(constant, recipeRange)).toBe(constant);
  });

  it("variable machine without recipe fields → the envelope fallback", () => {
    expect(effectiveMachinePower(variable, undefined)).toBe(variable);
  });

  it("factor 0 is legal: a degenerate exact range", () => {
    const got = effectiveMachinePower(variable, {
      constantMw: Fraction.from(100),
      factorMw: Fraction.from(0),
    });
    expect(got.mw.eq(Fraction.from(100))).toBe(true);
    expect(got.minMw?.eq(Fraction.from(100))).toBe(true);
    expect(got.maxMw?.eq(Fraction.from(100))).toBe(true);
  });
});
