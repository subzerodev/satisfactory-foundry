import { Fraction } from "../core/fraction.ts";
import type { LaneInput, LaneKind, StageInput } from "../core/manifold.ts";
import type { Catalog, CatalogRecipe, RecipeIO } from "./types.ts";
import { TIER_TABLE } from "./tiers.ts";

export interface StageOptions {
  machineCount: number;
  clockPercent: Fraction;
  /** Prefix count of unlocked tiers per kind (≥ 1). */
  unlockedTiers: { belt: number; pipe: number };
  overrides?: {
    /** Per-belt capacity overrides keyed by feed itemId (null = keep auto). */
    feeds?: Record<string, (Fraction | null)[]>;
    /** Per-belt capacity overrides keyed by output itemId. */
    outputs?: Record<string, (Fraction | null)[]>;
  };
}

/**
 * Map a catalog recipe onto a solver `StageInput`. Lane kind comes from each
 * item's `isFluid` (fluid → pipe, solid → belt); `perMachineRate` is the base
 * 100%-clock `RecipeIO.perMinute` (the solver scales by clock).
 *
 * Throw-vs-finding boundary: `toStageInput` throws on caller-bug SHAPE errors
 * the solver's `Finding` union cannot express (duplicate lanes on a side,
 * unknown override keys, `unlockedTiers` below 1 or beyond the table). VALUE
 * errors (over-capacity, starvation, non-ascending capacities, negative rate)
 * stay the solver's findings-out contract. One boundary, two error channels.
 */
export function toStageInput(
  recipe: CatalogRecipe,
  catalog: Catalog,
  opts: StageOptions,
): StageInput {
  const capacities = {
    belt: sliceTier("belt", opts.unlockedTiers.belt),
    pipe: sliceTier("pipe", opts.unlockedTiers.pipe),
  };

  const feeds = buildLanes(
    recipe.inputs,
    catalog,
    opts.overrides?.feeds,
    "feed",
  );
  const outputs = buildLanes(
    recipe.outputs,
    catalog,
    opts.overrides?.outputs,
    "output",
  );

  return {
    machineCount: opts.machineCount,
    clockPercent: opts.clockPercent,
    capacities,
    feeds,
    outputs,
  };
}

/**
 * Slice the first `count` unlocked tiers of a kind. `count` must be ≥ 1 and
 * within the table: an empty capacity list would pass the solver's ascending
 * check yet crash its top-tier assert, so it is a SHAPE error thrown here (not
 * a solver finding). Ascending order is inherited from TIER_TABLE.
 */
function sliceTier(kind: LaneKind, count: number): Fraction[] {
  const table = TIER_TABLE[kind];
  if (!Number.isInteger(count) || count < 1 || count > table.length) {
    throw new RangeError(
      `toStageInput: unlockedTiers.${kind} must be an integer in [1, ${table.length}]; got ${count}.`,
    );
  }
  return table.slice(0, count);
}

/**
 * Build the lanes for one side, mapping item kind and distributing overrides.
 * Throws on a duplicate (itemId, side) — real Docs.json never repeats an item
 * on one side, so a duplicate is a modded-data shape error the solver cannot
 * express — and on an override key that matches no lane.
 */
function buildLanes(
  ios: RecipeIO[],
  catalog: Catalog,
  overrides: Record<string, (Fraction | null)[]> | undefined,
  side: "feed" | "output",
): LaneInput[] {
  const lanes: LaneInput[] = [];
  const seen = new Set<string>();
  for (const io of ios) {
    if (seen.has(io.itemId)) {
      throw new Error(
        `toStageInput: duplicate ${side} lane for item ${io.itemId}.`,
      );
    }
    seen.add(io.itemId);

    const kind: LaneKind = catalog.items[io.itemId]?.isFluid ? "pipe" : "belt";
    const lane: LaneInput = {
      itemId: io.itemId,
      kind,
      perMachineRate: io.perMinute,
    };
    const override = overrides?.[io.itemId];
    if (override !== undefined) {
      lane.overrides = override;
    }
    lanes.push(lane);
  }

  // Every override key must address an existing lane; an unknown key is a
  // caller shape bug, not a solver value the findings union can carry.
  if (overrides) {
    for (const key of Object.keys(overrides)) {
      if (!seen.has(key)) {
        throw new Error(
          `toStageInput: override for unknown ${side} item ${key}.`,
        );
      }
    }
  }
  return lanes;
}

/**
 * Revive a `Fraction.toString()` string: "num/den" → `Fraction.of(BigInt(num),
 * BigInt(den))`; a plain integer → `Fraction.from(BigInt(s))`. Throws on any
 * other form.
 *
 * `Fraction.toString()` emits only `-?\d+` (with the sign on the numerator) and
 * `\d+` for a denominator. `BigInt` is looser than that — it coerces "",
 * "0x10", "+3", and surrounding whitespace — so each side is validated against
 * the strict digit pattern first, keeping this a faithful reviver that throws
 * on anything the type never produced.
 */
export function parseRational(s: string): Fraction {
  const slash = s.indexOf("/");
  if (slash === -1) {
    return Fraction.from(toSignedBigInt(s));
  }
  const num = s.slice(0, slash);
  const den = s.slice(slash + 1);
  return Fraction.of(toSignedBigInt(num), toUnsignedBigInt(den));
}

const SIGNED_INT = /^-?\d+$/;
const UNSIGNED_INT = /^\d+$/;

function toSignedBigInt(s: string): bigint {
  if (!SIGNED_INT.test(s)) {
    throw new SyntaxError(
      `parseRational: malformed rational component ${JSON.stringify(s)}.`,
    );
  }
  return BigInt(s);
}

function toUnsignedBigInt(s: string): bigint {
  if (!UNSIGNED_INT.test(s)) {
    throw new SyntaxError(
      `parseRational: malformed rational component ${JSON.stringify(s)}.`,
    );
  }
  return BigInt(s);
}
