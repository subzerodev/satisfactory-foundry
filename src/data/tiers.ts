import { Fraction } from "../core/fraction.ts";
import type { TierTable } from "./types.ts";

/**
 * Curated transport-tier throughputs (items/min for belts, m³/min for pipes),
 * ascending. Values are the planner's transport.ts constants (belts
 * 60/120/270/480/780/1200; pipes 300/600), matching the v1 design spec's
 * worked examples. Exact `Fraction`s so tier arithmetic never leaks a float.
 */
export const TIER_TABLE: TierTable = {
  belt: [60, 120, 270, 480, 780, 1200].map((n) => Fraction.from(n)),
  pipe: [300, 600].map((n) => Fraction.from(n)),
};
