/**
 * Pure advisory helpers (Stage 6 / Phase 2). The "what would fix this?" surface:
 * a supply suggestion for an under-supplied link, a tier-unlock hint for a bus
 * finding, and the power-draw display strings.
 *
 * THE SECOND FLOAT BOUNDARY (frozen brainstorm assumption 3, r1 fold): format.ts
 * is the exact-only renderer; THIS module is the second, approximation-labeled
 * boundary. `stagePowerText`/`chainPowerText` convert exact Fractions to JS
 * numbers — but ONLY inside those two functions, and every approximated value
 * carries the "≈" prefix so the label itself is the honesty. The clock^exponent
 * factor is irrational for most clocks, so overclocked power CANNOT be rendered
 * exactly; the approximation is deliberate and labeled. `suggestSupply` and
 * `tierFixHint` stay fully exact (Fraction in, Fraction out) — no float leak.
 */

import { Fraction } from "../core/fraction.ts";
import type { LaneKind } from "../core/manifold.ts";
import type { MachinePower, TierTable } from "../data/types.ts";
import { formatRate } from "./format.ts";

/**
 * The whole-number machine count that covers `demand` at `perMachine` output,
 * plus the exact surplus the last machine leaves over. Exact throughout: the
 * count is `ceil(demand / perMachine)` via `Fraction.ceilDiv` (returns a
 * bigint, narrowed through the solver's guarded toIndex precedent), the surplus
 * is `machines × perMachine − demand`.
 *
 * Null when `perMachine` is zero or negative — no machine count is meaningful
 * for a lane that produces nothing (the no-invented-numbers invariant). The
 * live case: demand 140, perMachine 7.5 → { machines: 19, surplus: 5/2 }.
 */
export function suggestSupply(
  demand: Fraction,
  perMachine: Fraction,
): { machines: number; surplus: Fraction } | null {
  if (perMachine.lte(Fraction.from(0))) {
    return null;
  }
  const machinesBig = demand.ceilDiv(perMachine);
  const machines = narrowIndex(machinesBig);
  const surplus = Fraction.from(machinesBig).mul(perMachine).sub(demand);
  return { machines, surplus };
}

/**
 * The smallest FULL-table tier whose capacity would carry `peak` AND exceed the
 * finding's own `binding` capacity — the tier-unlock (or override-raise) that
 * arithmetically clears a bus finding. `binding` is the finding's own capacity
 * (busCapacity / topCapacity), NOT best-unlocked (r1 fold — an output-side
 * finding fires against an overridden-DOWN capacity that can sit below
 * best-unlocked, so best-unlocked would make the override branch unreachable).
 *
 * Both conditions are required: `capacity ≥ peak` (carries the load) AND
 * `capacity > binding` (is a genuine improvement over the current binding
 * capacity). Null when no tier satisfies both — a peak beyond the top tier
 * earns NO invented hint. The table is scanned ascending, so the first match is
 * the smallest; the returned `tierIndex` is the FULL-table index.
 */
export function tierFixHint(
  peak: Fraction,
  kind: LaneKind,
  binding: Fraction,
  table: TierTable,
): { capacity: Fraction; tierIndex: number } | null {
  const tiers = table[kind];
  for (let i = 0; i < tiers.length; i++) {
    const capacity = tiers[i]!;
    if (capacity.gte(peak) && capacity.gt(binding)) {
      return { capacity, tierIndex: i };
    }
  }
  return null;
}

/**
 * The stage's total power draw as a display string. THE approximation boundary:
 *
 * - 100% clock: exact. `count × mw` as a Fraction, rendered via formatRate's
 *   exact renderer → "80 MW". No float touches it.
 * - other clocks: `count × mw × (clock/100)^exponent`, computed in FLOATS
 *   (Number conversions confined to this function) since clock^exponent is
 *   irrational for most clocks → "≈ 61.7 MW" (one decimal, always the ≈ prefix
 *   — the label IS the honesty).
 * - variable-power machines: the exact `mw` midpoint drives the number, with a
 *   "(varies A–B MW)" suffix from the exact min/max bounds, count-scaled.
 */
export function stagePowerText(
  power: MachinePower,
  machineCount: number,
  clock: Fraction,
): string {
  const count = Fraction.from(machineCount);
  const suffix = power.variable ? variesSuffix(power, machineCount) : "";

  // 100% clock ⇒ no overclock factor, so the draw is exact — render it as such.
  if (clock.eq(Fraction.from(100))) {
    const total = count.mul(power.mw);
    return `${formatRate(total)} MW${suffix}`;
  }

  // Other clocks ⇒ the irrational (clock/100)^exponent factor forces floats.
  // Number conversions are confined here, and the ≈ prefix carries the honesty.
  const clockRatio = fractionToNumber(clock) / 100;
  const factor = clockRatio ** fractionToNumber(power.exponent);
  const total = machineCount * fractionToNumber(power.mw) * factor;
  return `≈ ${total.toFixed(1)} MW${suffix}`;
}

/**
 * The chain-wide power total: "Σ ≈ X MW" over the SOLVED stages that have power
 * data, or null when no such stage exists (idle/invalid/recipe-less stages have
 * no running machines to bill; frozen Axis 4). Each term may be irrational
 * (overclock), so the Σ is a float and always carries the ≈ prefix.
 *
 * `stages` is the store's stage map + insertion order is irrelevant to a sum;
 * `catalog` resolves each stage's recipe → machine → power. A stage contributes
 * only when: solved, its recipe resolves, and its machine carries power.
 */
export function chainPowerText(
  stages: ChainStage[],
  catalog: ChainCatalog,
): string | null {
  let total = 0;
  let anyContributor = false;
  for (const stage of stages) {
    const power = stagePowerOf(stage, catalog);
    if (power === null) continue;
    const { mw, exponent } = power;
    const clock = parseClock(stage.selection.clockPercentText);
    if (clock === null) continue; // an invalid clock can't reach solved anyway
    const clockRatio = fractionToNumber(clock) / 100;
    const factor = clockRatio ** fractionToNumber(exponent);
    total += stage.selection.machineCount * fractionToNumber(mw) * factor;
    anyContributor = true;
  }
  if (!anyContributor) return null;
  return `Σ ≈ ${total.toFixed(0)} MW`;
}

// ---------------------------------------------------------------------------
// Structural shapes — the minimal slices the chain-Σ reads, so advice.ts stays
// decoupled from the full store/catalog types (only the fields it consumes).
// ---------------------------------------------------------------------------

/** The stage fields chainPowerText reads: the solve status, recipe, clock, and
 *  machine count. Structurally a subset of the store's StageNode. */
export interface ChainStage {
  selection: {
    recipeId: string | null;
    machineCount: number;
    clockPercentText: string;
  };
  solve: { status: "idle" | "solved" | "invalid" };
}

/** The catalog fields chainPowerText reads: recipe→machine→power resolution.
 *  Structurally a subset of the store's Catalog. */
export interface ChainCatalog {
  recipes: Record<string, { machineId: string } | undefined>;
  machines: Record<string, { power: MachinePower } | undefined>;
}

/** A solved stage's power, or null when it does not contribute (unsolved,
 *  recipe-less, dangling recipe, or a machine without power data). */
function stagePowerOf(
  stage: ChainStage,
  catalog: ChainCatalog,
): MachinePower | null {
  if (stage.solve.status !== "solved") return null;
  const recipeId = stage.selection.recipeId;
  if (recipeId === null) return null;
  if (!Object.hasOwn(catalog.recipes, recipeId)) return null;
  const recipe = catalog.recipes[recipeId];
  if (recipe === undefined) return null;
  // Object.hasOwn, not `=== undefined`: a machineId like "constructor" would
  // otherwise resolve to Object.prototype's method under bracket access.
  if (!Object.hasOwn(catalog.machines, recipe.machineId)) return null;
  const machine = catalog.machines[recipe.machineId];
  if (machine === undefined) return null;
  return machine.power;
}

// ---------------------------------------------------------------------------
// Internal helpers.
// ---------------------------------------------------------------------------

/** The "(varies A–B MW)" suffix for a variable-power machine, from the exact
 *  min/max bounds, count-scaled. Falls back to no suffix if bounds are absent
 *  (defensive: the variable branch always parses both, per docs-loader). */
function variesSuffix(power: MachinePower, machineCount: number): string {
  if (power.minMw === undefined || power.maxMw === undefined) return "";
  const count = Fraction.from(machineCount);
  const lo = formatRate(count.mul(power.minMw));
  const hi = formatRate(count.mul(power.maxMw));
  return ` (varies ${lo}–${hi} MW)`;
}

/** Parse a clock-percent string to a positive Fraction, or null if malformed /
 *  non-positive (mirrors the store's derive guard; a stage that fails this is
 *  never solved). */
function parseClock(text: string): Fraction | null {
  let clock: Fraction;
  try {
    clock = Fraction.parse(text);
  } catch {
    return null;
  }
  return clock.gt(Fraction.from(0)) ? clock : null;
}

/**
 * Exact Fraction → JS number, confined to this module's float boundary. Used
 * only for the DISPLAY approximation of irrational overclock power — never in
 * any count/rate decision (those stay exact).
 */
function fractionToNumber(f: Fraction): number {
  return Number(f.num) / Number(f.den);
}

/**
 * Narrow a bigint machine count to a JS number, throwing (never truncating)
 * past MAX_SAFE_INTEGER — the solver's guarded toIndex precedent
 * (manifold.ts:127) applied to the advisory suggestion.
 */
function narrowIndex(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(
      `advice: machine count ${value} exceeds Number.MAX_SAFE_INTEGER; ` +
        "demand is implausibly large.",
    );
  }
  return Number(value);
}
