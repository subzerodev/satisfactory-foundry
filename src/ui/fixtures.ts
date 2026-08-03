/**
 * Test-only fixtures: the Phase 1 20-smelter worked example, built through the
 * REAL solver so the shapes the UI renders are the shapes the solver emits.
 * No production module imports this — it lives here only for the sibling
 * `.test.ts`/`.test.tsx` files (kept out of a `*.test` name so it can be a
 * shared helper without vitest treating it as a suite).
 */

import { Fraction } from "../core/fraction.ts";
import { solveStage } from "../core/manifold.ts";
import type { StageInput, StageSolveResult } from "../core/manifold.ts";
import type { TierTable } from "../data/types.ts";

/** Belt tiers pinned to 4 (the #5 plan-review rule); pipe carries [300,600]. */
export const FIXTURE_TIERS: TierTable = {
  belt: [60, 120, 270, 480].map((n) => Fraction.from(n)),
  pipe: [300, 600].map((n) => Fraction.from(n)),
};

/**
 * d = 30/min feed and p = 30/min output over N = 20 machines at 100% clock.
 * Solved: feed belts [480, 120] (belt 2 enters after machine 16); one output
 * breakout after machine 16.
 */
export const WORKED_INPUT: StageInput = {
  machineCount: 20,
  clockPercent: Fraction.from(100),
  capacities: FIXTURE_TIERS,
  feeds: [
    { itemId: "ore_iron", kind: "belt", perMachineRate: Fraction.from(30) },
  ],
  outputs: [
    { itemId: "iron_ingot", kind: "belt", perMachineRate: Fraction.from(30) },
  ],
};

export function workedResult(): StageSolveResult {
  return solveStage(WORKED_INPUT);
}
