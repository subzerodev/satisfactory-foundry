import { Fraction } from "../core/fraction.ts";

export function parseClockText(
  text: string,
): { ok: true; value: Fraction } | { ok: false; error: string } {
  let value: Fraction;
  try {
    value = Fraction.parse(text);
  } catch {
    return { ok: false, error: "clock % must be a number in (0, 250]" };
  }
  if (value.lte(Fraction.from(0))) {
    return { ok: false, error: "clock % must be greater than 0" };
  }
  if (value.gt(Fraction.from(250))) {
    return { ok: false, error: "clock % must be at most 250" };
  }
  return { ok: true, value };
}
