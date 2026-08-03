import { Fraction } from "./fraction.ts";

describe("Fraction normalization", () => {
  const cases: Array<{ num: bigint; den: bigint; expected: string }> = [
    { num: 2n, den: 4n, expected: "1/2" },
    { num: 6n, den: 3n, expected: "2" },
    { num: -2n, den: 4n, expected: "-1/2" },
    { num: 2n, den: -4n, expected: "-1/2" }, // sign moves to numerator
    { num: -2n, den: -4n, expected: "1/2" }, // double negative reduces
    { num: 0n, den: 5n, expected: "0" }, // canonical zero
    { num: 0n, den: -5n, expected: "0" },
    { num: 75n, den: 2n, expected: "75/2" },
  ];
  it.each(cases)("of($num, $den) -> $expected", ({ num, den, expected }) => {
    expect(Fraction.of(num, den).toString()).toBe(expected);
  });
});

describe("Fraction arithmetic", () => {
  const half = Fraction.of(1, 2);
  const third = Fraction.of(1, 3);

  it("adds", () => {
    expect(half.add(third).toString()).toBe("5/6");
  });
  it("subtracts", () => {
    expect(half.sub(third).toString()).toBe("1/6");
  });
  it("multiplies", () => {
    expect(half.mul(third).toString()).toBe("1/6");
  });
  it("divides", () => {
    expect(half.div(third).toString()).toBe("3/2");
  });

  it("mixed-sign arithmetic", () => {
    expect(Fraction.of(-1, 2).add(Fraction.of(1, 3)).toString()).toBe("-1/6");
    expect(Fraction.of(-1, 2).mul(Fraction.of(-1, 3)).toString()).toBe("1/6");
    expect(Fraction.of(1, 2).div(Fraction.of(-1, 3)).toString()).toBe("-3/2");
  });

  it("additive and multiplicative identities", () => {
    const f = Fraction.of(3, 7);
    expect(f.add(Fraction.from(0)).eq(f)).toBe(true);
    expect(f.mul(Fraction.from(1)).eq(f)).toBe(true);
    expect(f.sub(f).isZero()).toBe(true);
    expect(f.div(f).eq(Fraction.from(1))).toBe(true);
  });
});

describe("Fraction.parse", () => {
  const cases: Array<{ input: string; expected: string }> = [
    { input: "37.5", expected: "75/2" },
    { input: "0.25", expected: "1/4" },
    { input: "-0.25", expected: "-1/4" },
    { input: "42", expected: "42" },
    { input: "-42", expected: "-42" },
    { input: "+3.5", expected: "7/2" },
    { input: "0.0", expected: "0" },
    { input: ".5", expected: "1/2" },
    { input: "5.", expected: "5" },
    { input: "2.50", expected: "5/2" }, // trailing zeros reduce
    { input: "  12.5  ", expected: "25/2" }, // trimmed
  ];
  it.each(cases)("parse($input) -> $expected", ({ input, expected }) => {
    expect(Fraction.parse(input).toString()).toBe(expected);
  });

  it("round-trips a large fractional rate exactly", () => {
    // 780.375 is exact; a float round-trip would corrupt it.
    expect(Fraction.parse("780.375").toString()).toBe("6243/8");
  });

  const malformed = [
    "",
    "+",
    "-",
    ".",
    "+.",
    "abc",
    "1.2.3",
    "1,5",
    "1e3",
    "  ",
  ];
  it.each(malformed)("rejects malformed input %j", (input) => {
    expect(() => Fraction.parse(input)).toThrow();
  });
});

describe("Fraction floorDiv / ceilDiv", () => {
  it("exact-multiple boundary ceils to itself, not itself+1", () => {
    // 6 / 3 = 2 exactly.
    const d = Fraction.from(6);
    const b = Fraction.from(3);
    expect(d.ceilDiv(b)).toBe(2n);
    expect(d.floorDiv(b)).toBe(2n);
  });

  it("non-integral positive quotient", () => {
    // 7 / 3 = 2.333...
    const d = Fraction.from(7);
    const b = Fraction.from(3);
    expect(d.floorDiv(b)).toBe(2n);
    expect(d.ceilDiv(b)).toBe(3n);
  });

  it("fractional operands (belt-style D/B math)", () => {
    // (37.5) / (7.5) = 5 exactly.
    expect(Fraction.parse("37.5").ceilDiv(Fraction.parse("7.5"))).toBe(5n);
    // (37.5) / (7) = 5.357... -> ceil 6, floor 5.
    expect(Fraction.parse("37.5").ceilDiv(Fraction.from(7))).toBe(6n);
    expect(Fraction.parse("37.5").floorDiv(Fraction.from(7))).toBe(5n);
  });

  it("negative operands: floor toward -inf, ceil toward +inf", () => {
    // -7 / 3 = -2.333...
    const d = Fraction.from(-7);
    const b = Fraction.from(3);
    expect(d.floorDiv(b)).toBe(-3n);
    expect(d.ceilDiv(b)).toBe(-2n);
    // -6 / 3 = -2 exactly (boundary, both are -2).
    expect(Fraction.from(-6).floorDiv(b)).toBe(-2n);
    expect(Fraction.from(-6).ceilDiv(b)).toBe(-2n);
  });

  it("floor() / ceil() directly, incl. negatives and boundaries", () => {
    expect(Fraction.of(7, 3).floor()).toBe(2n);
    expect(Fraction.of(7, 3).ceil()).toBe(3n);
    expect(Fraction.of(-7, 3).floor()).toBe(-3n);
    expect(Fraction.of(-7, 3).ceil()).toBe(-2n);
    expect(Fraction.from(4).floor()).toBe(4n);
    expect(Fraction.from(4).ceil()).toBe(4n);
    expect(Fraction.from(-4).floor()).toBe(-4n);
    expect(Fraction.from(-4).ceil()).toBe(-4n);
  });

  it("div by zero throws through ceilDiv/floorDiv", () => {
    expect(() => Fraction.from(1).ceilDiv(Fraction.from(0))).toThrow();
    expect(() => Fraction.from(1).floorDiv(Fraction.from(0))).toThrow();
  });
});

describe("Fraction BigInt magnitude", () => {
  it("handles values past Number.MAX_SAFE_INTEGER", () => {
    const big = 9007199254740993n; // MAX_SAFE_INTEGER + 2, not representable as a safe number
    const f = Fraction.of(big, 2n);
    // big is odd, so big/2 stays a fraction; multiply back by 2 to recover it.
    expect(f.mul(Fraction.from(2n)).toString()).toBe(big.toString());
    expect(f.floor()).toBe((big - 1n) / 2n);
    expect(f.ceil()).toBe((big + 1n) / 2n);
  });
});

describe("Fraction comparisons", () => {
  it("compare returns -1 | 0 | 1", () => {
    expect(Fraction.of(1, 3).compare(Fraction.of(1, 2))).toBe(-1);
    expect(Fraction.of(1, 2).compare(Fraction.of(1, 2))).toBe(0);
    expect(Fraction.of(1, 2).compare(Fraction.of(1, 3))).toBe(1);
    // cross-denominator and negative ordering
    expect(Fraction.of(-1, 2).compare(Fraction.of(-1, 3))).toBe(-1);
  });

  it("eq / lt / lte / gt / gte", () => {
    const a = Fraction.of(2, 4);
    const b = Fraction.of(1, 2);
    const c = Fraction.of(3, 4);
    expect(a.eq(b)).toBe(true);
    expect(a.lt(c)).toBe(true);
    expect(a.lte(b)).toBe(true);
    expect(c.gt(a)).toBe(true);
    expect(a.gte(b)).toBe(true);
    expect(a.lt(a)).toBe(false);
    expect(a.gt(a)).toBe(false);
  });

  it("isZero / isNegative", () => {
    expect(Fraction.from(0).isZero()).toBe(true);
    expect(Fraction.of(0, 5).isZero()).toBe(true);
    expect(Fraction.of(1, 2).isZero()).toBe(false);
    expect(Fraction.of(-1, 2).isNegative()).toBe(true);
    expect(Fraction.of(1, 2).isNegative()).toBe(false);
    expect(Fraction.from(0).isNegative()).toBe(false);
  });
});

describe("Fraction.toString exactness", () => {
  const cases: Array<{ frac: Fraction; expected: string }> = [
    { frac: Fraction.from(5), expected: "5" }, // integer, no /1
    { frac: Fraction.from(-5), expected: "-5" },
    { frac: Fraction.from(0), expected: "0" },
    { frac: Fraction.of(75, 2), expected: "75/2" },
    { frac: Fraction.of(-3, 4), expected: "-3/4" },
    { frac: Fraction.of(3, -4), expected: "-3/4" },
  ];
  it.each(cases)("$expected", ({ frac, expected }) => {
    expect(frac.toString()).toBe(expected);
  });
});

describe("Fraction.toDecimalString", () => {
  const cases: Array<{ frac: Fraction; dp: number; expected: string }> = [
    { frac: Fraction.of(75, 2), dp: 1, expected: "37.5" }, // exact
    { frac: Fraction.of(1, 2), dp: 0, expected: "1" }, // 0.5 half-up -> 1
    { frac: Fraction.of(1, 4), dp: 2, expected: "0.25" }, // exact
    { frac: Fraction.of(1, 3), dp: 2, expected: "0.33" }, // rounds down
    { frac: Fraction.of(2, 3), dp: 2, expected: "0.67" }, // rounds up
    { frac: Fraction.of(1, 8), dp: 2, expected: "0.13" }, // 0.125 half-up
    { frac: Fraction.of(5, 1), dp: 2, expected: "5.00" }, // dp padding
    { frac: Fraction.from(0), dp: 2, expected: "0.00" },
    { frac: Fraction.of(-1, 3), dp: 2, expected: "-0.33" }, // negative
    { frac: Fraction.of(-1, 2), dp: 0, expected: "-1" }, // negative half-up
    { frac: Fraction.of(-1, 100), dp: 1, expected: "0.0" }, // rounds to zero, no -0
    { frac: Fraction.of(120, 1), dp: 0, expected: "120" }, // "120/min"-style
  ];
  it.each(cases)("$expected", ({ frac, dp, expected }) => {
    expect(frac.toDecimalString(dp)).toBe(expected);
  });

  it("rejects negative or non-integer dp", () => {
    expect(() => Fraction.of(1, 2).toDecimalString(-1)).toThrow();
    expect(() => Fraction.of(1, 2).toDecimalString(1.5)).toThrow();
  });
});

describe("Fraction construction guards", () => {
  it("from/of reject non-integral numbers", () => {
    expect(() => Fraction.from(1.5)).toThrow(RangeError);
    expect(() => Fraction.of(1.5, 2)).toThrow(RangeError);
    expect(() => Fraction.of(1, 2.5)).toThrow(RangeError);
  });

  it("from/of reject non-safe-integer numbers", () => {
    expect(() => Fraction.from(Number.MAX_SAFE_INTEGER + 1)).toThrow(
      RangeError,
    );
  });

  it("of rejects a zero denominator", () => {
    expect(() => Fraction.of(1, 0)).toThrow(RangeError);
    expect(() => Fraction.of(1, 0n)).toThrow(RangeError);
  });

  it("div by zero throws", () => {
    expect(() => Fraction.from(1).div(Fraction.from(0))).toThrow(RangeError);
  });

  it("accepts bigint magnitudes beyond safe-integer range", () => {
    expect(() => Fraction.from(9007199254740993n)).not.toThrow();
  });
});
