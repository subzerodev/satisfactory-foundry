/**
 * Tier → color map, the single source for belts, bus segments, splitter ticks,
 * and the legend. Positions match `TIER_TABLE` (6 belt, 2 pipe); a capacity
 * matching no tier (a non-tier override) resolves to the neutral override color.
 */

import { Fraction } from "../core/fraction.ts";
import type { LaneKind } from "../core/manifold.ts";
import type { TierTable } from "../data/types.ts";

export const TIER_COLORS = {
  belt: ["#9e9e9e", "#e6a23c", "#4f9dde", "#7c5cd6", "#d6604f", "#3dbd7d"],
  pipe: ["#58b0c4", "#2d7dd2"],
} as const;

export const OVERRIDE_COLOR = "#5a5a5a";
export const ERROR_COLOR = "#d92b2b";

export function colorForCapacity(
  kind: LaneKind,
  capacity: Fraction,
  tiers: TierTable,
): string {
  const i = tiers[kind].findIndex((t) => t.eq(capacity));
  if (i < 0) {
    return OVERRIDE_COLOR;
  }
  return TIER_COLORS[kind][i] ?? OVERRIDE_COLOR;
}
