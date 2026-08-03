/**
 * Exact rational arithmetic for the solver.
 *
 * Immutable and always normalized: gcd-reduced, the sign carried on the
 * numerator, denominator strictly positive. BigInt-backed so solver magnitudes
 * (game-data rationals, minutes-denominated) never overflow. Floats never enter
 * this type — accepting one is exactly the leak the type exists to prevent.
 */

const ZERO = 0n;
const ONE = 1n;

function gcd(a: bigint, b: bigint): bigint {
  let x = a < ZERO ? -a : a;
  let y = b < ZERO ? -b : b;
  while (y !== ZERO) {
    [x, y] = [y, x % y];
  }
  return x;
}

/**
 * Coerce a construction argument to a bigint, rejecting any non-integral or
 * non-safe-integer `number`. A named domain error (not a bare RangeError) makes
 * the intent explicit and blocks Math.trunc-style silent truncation.
 */
function toIntegerBigInt(value: number | bigint): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (!Number.isInteger(value)) {
    throw new RangeError(
      `Fraction requires an integer; got non-integral number ${value}. ` +
        "Use Fraction.of(num, den) or Fraction.parse for fractional values.",
    );
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(
      `Fraction requires a safe integer; ${value} exceeds Number.MAX_SAFE_INTEGER. ` +
        "Pass a bigint for magnitudes beyond the safe-integer range.",
    );
  }
  return BigInt(value);
}

export class Fraction {
  /** Numerator; carries the sign of the value. */
  readonly num: bigint;
  /** Denominator; strictly positive by invariant. */
  readonly den: bigint;

  private constructor(num: bigint, den: bigint) {
    this.num = num;
    this.den = den;
  }

  /** Normalize a raw numerator/denominator into the canonical form. */
  private static normalize(num: bigint, den: bigint): Fraction {
    if (den === ZERO) {
      throw new RangeError("Fraction denominator must be non-zero.");
    }
    // Force the sign onto the numerator so the denominator stays positive.
    if (den < ZERO) {
      num = -num;
      den = -den;
    }
    if (num === ZERO) {
      // Canonical zero is 0/1.
      return new Fraction(ZERO, ONE);
    }
    const g = gcd(num, den);
    return new Fraction(num / g, den / g);
  }

  /** Construct from an integer (`number`) or `bigint`. */
  static from(int: number | bigint): Fraction {
    return Fraction.normalize(toIntegerBigInt(int), ONE);
  }

  /** Construct from an explicit numerator and denominator. */
  static of(num: number | bigint, den: number | bigint): Fraction {
    return Fraction.normalize(toIntegerBigInt(num), toIntegerBigInt(den));
  }

  /**
   * Parse an exact decimal string ("37.5", "-0.25", "42"). String-tokenized —
   * never parseFloat/Number round-tripping, which would lose exactness. Throws
   * on malformed input.
   */
  static parse(input: string): Fraction {
    const s = input.trim();
    // Optional sign, integer part, optional fractional part. At least one digit
    // must appear somewhere.
    const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(s);
    if (match === null) {
      throw new SyntaxError(
        `Fraction.parse: malformed decimal string ${JSON.stringify(input)}.`,
      );
    }
    const sign = match[1] === "-" ? -ONE : ONE;
    const intPart = match[2] ?? "";
    const fracPart = match[3] ?? "";
    if (intPart === "" && fracPart === "") {
      // Rejects "", "+", "-", ".", "+.", etc.
      throw new SyntaxError(
        `Fraction.parse: malformed decimal string ${JSON.stringify(input)}.`,
      );
    }
    const digits = intPart + fracPart;
    const num = sign * BigInt(digits);
    const den = 10n ** BigInt(fracPart.length);
    return Fraction.normalize(num, den);
  }

  add(other: Fraction): Fraction {
    return Fraction.normalize(
      this.num * other.den + other.num * this.den,
      this.den * other.den,
    );
  }

  sub(other: Fraction): Fraction {
    return Fraction.normalize(
      this.num * other.den - other.num * this.den,
      this.den * other.den,
    );
  }

  mul(other: Fraction): Fraction {
    return Fraction.normalize(this.num * other.num, this.den * other.den);
  }

  div(other: Fraction): Fraction {
    if (other.num === ZERO) {
      throw new RangeError("Fraction division by zero.");
    }
    return Fraction.normalize(this.num * other.den, this.den * other.num);
  }

  /** Three-way comparison: -1 if this < other, 0 if equal, 1 if this > other. */
  compare(other: Fraction): -1 | 0 | 1 {
    // Denominators are positive, so cross-multiplication preserves order.
    const lhs = this.num * other.den;
    const rhs = other.num * this.den;
    if (lhs < rhs) return -1;
    if (lhs > rhs) return 1;
    return 0;
  }

  eq(other: Fraction): boolean {
    return this.compare(other) === 0;
  }

  lt(other: Fraction): boolean {
    return this.compare(other) === -1;
  }

  lte(other: Fraction): boolean {
    return this.compare(other) !== 1;
  }

  gt(other: Fraction): boolean {
    return this.compare(other) === 1;
  }

  gte(other: Fraction): boolean {
    return this.compare(other) !== -1;
  }

  isZero(): boolean {
    return this.num === ZERO;
  }

  isNegative(): boolean {
    return this.num < ZERO;
  }

  /** Largest integer ≤ this value (toward −∞). */
  floor(): bigint {
    return bigintFloorDiv(this.num, this.den);
  }

  /** Smallest integer ≥ this value (toward +∞). */
  ceil(): bigint {
    return bigintCeilDiv(this.num, this.den);
  }

  /** floor(this / other) as an exact bigint. Toward −∞; div by zero throws. */
  floorDiv(other: Fraction): bigint {
    return this.div(other).floor();
  }

  /** ceil(this / other) as an exact bigint. Toward +∞; div by zero throws. */
  ceilDiv(other: Fraction): bigint {
    return this.div(other).ceil();
  }

  /** Exact string form: "75/2", integers without "/1", "-3/4". */
  toString(): string {
    if (this.den === ONE) {
      return this.num.toString();
    }
    return `${this.num.toString()}/${this.den.toString()}`;
  }

  /**
   * Decimal string rounded half-up to `dp` places. Display-only — never used in
   * solver math, which stays exact.
   */
  toDecimalString(dp: number): string {
    if (!Number.isInteger(dp) || dp < 0) {
      throw new RangeError(
        `toDecimalString: dp must be a non-negative integer; got ${dp}.`,
      );
    }
    const negative = this.num < ZERO;
    const absNum = negative ? -this.num : this.num;
    const scale = 10n ** BigInt(dp);
    // Round half-up on the absolute value: floor((n*scale)/d + 1/2).
    const scaled = absNum * scale;
    const rounded = (2n * scaled + this.den) / (2n * this.den);
    const intPart = rounded / scale;
    const fracPart = rounded % scale;
    let body: string;
    if (dp === 0) {
      body = intPart.toString();
    } else {
      const fracStr = fracPart.toString().padStart(dp, "0");
      body = `${intPart.toString()}.${fracStr}`;
    }
    // Preserve a negative sign only when the rounded magnitude is non-zero.
    return negative && rounded !== ZERO ? `-${body}` : body;
  }
}

/** floor(a / b) for bigints, correct toward −∞ (b assumed positive). */
function bigintFloorDiv(a: bigint, b: bigint): bigint {
  const q = a / b;
  const r = a % b;
  // Truncated division rounds toward zero; adjust down when the remainder has
  // the opposite sign of the (positive) divisor, i.e. when a is negative.
  return r !== ZERO && r < ZERO ? q - ONE : q;
}

/** ceil(a / b) for bigints, correct toward +∞ (b assumed positive). */
function bigintCeilDiv(a: bigint, b: bigint): bigint {
  const q = a / b;
  const r = a % b;
  return r !== ZERO && r > ZERO ? q + ONE : q;
}
