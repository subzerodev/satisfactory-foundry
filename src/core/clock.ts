import { Fraction } from "../core/fraction.ts";

// The [1, 250] range is a gameplay fact, deliberately hardcoded (ticket #143):
// Docs.json ships mMaxPotential = 1.000000 on every carrying class (the +150%
// from Power Shards is engine-default knowledge, not file data), so parsing it
// naively would yield a wrong 100% cap. The floor is mMinPotential = 0.01 = 1%.
export function parseClockText(
  text: string,
): { ok: true; value: Fraction } | { ok: false; error: string } {
  let value: Fraction;
  try {
    value = Fraction.parse(text);
  } catch {
    return { ok: false, error: "clock % must be a number in [1, 250]" };
  }
  if (value.lt(Fraction.from(1))) {
    return {
      ok: false,
      error: "clock % must be at least 1 (the game's minimum clock)",
    };
  }
  if (value.gt(Fraction.from(250))) {
    return { ok: false, error: "clock % must be at most 250" };
  }
  return { ok: true, value };
}
