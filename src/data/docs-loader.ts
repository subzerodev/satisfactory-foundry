import { Fraction } from "../core/fraction.ts";
import type {
  Catalog,
  CatalogItem,
  CatalogMachine,
  CatalogRecipe,
  MachinePower,
  RecipeIO,
} from "./types.ts";
import { TIER_TABLE } from "./tiers.ts";

/**
 * A human-readable parse failure. The Phase 4 upload UI shows `.message`
 * verbatim; nothing reaches solve time. Every loud failure below (bad root,
 * missing/malformed/≤0 duration, un-parseable Amount) surfaces as one of these
 * so malformed uploads fail at parse time, not silently later.
 */
export class DocsParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocsParseError";
  }
}

// Native-class filters, ported unchanged from the planner's docs-loader.ts.
// Broad rule: buildings are the manufacturer/generator/extractor families;
// items are the descriptor allowlist (subtypes covered by prefix match);
// recipes are FGRecipe. Anything outside these (cosmetic/vehicle descriptors,
// building-placeholder descriptors) never enters the catalog.
const NATIVE_BUILDING_REGEX =
  /FGBuildable(Manufacturer|Generator|Extractor|ResourceExtractor)/;
const NATIVE_ITEM_REGEX =
  /FG(ItemDescriptor|ResourceDescriptor|ConsumableDescriptor|EquipmentDescriptor|PowerShardDescriptor|ChainsawFuelDescriptor|AmmoType)/;
const NATIVE_RECIPE = "FGRecipe";

/** Raw recipe fields carried through extraction; strings stay strings until
 *  the exact-Fraction post-processing step (no float ever). */
interface RawRecipe {
  className: string;
  displayName: string;
  ingredients: string;
  product: string;
  duration: string;
  producedIn: string;
}

export function parseDocsJson(raw: unknown): Catalog {
  if (!Array.isArray(raw)) {
    throw new DocsParseError("Docs.json root must be an array.");
  }

  const items: Record<string, CatalogItem> = {};
  const machines: Record<string, CatalogMachine> = {};
  const recipesRaw: RawRecipe[] = [];

  for (const group of raw) {
    if (typeof group !== "object" || group === null) continue;
    const g = group as { NativeClass?: string; Classes?: unknown[] };
    const nativeClass = g.NativeClass ?? "";
    const classes = Array.isArray(g.Classes) ? g.Classes : [];

    if (NATIVE_ITEM_REGEX.test(nativeClass)) {
      for (const cls of classes) {
        const c = cls as Record<string, unknown>;
        if (typeof c.ClassName !== "string") continue;
        const id = normalizeClassName(c.ClassName, "Desc_");
        const isFluid =
          typeof c.mForm === "string" &&
          (c.mForm === "RF_LIQUID" || c.mForm === "RF_GAS");
        items[id] = {
          id,
          displayName: (c.mDisplayName as string | undefined) ?? id,
          isFluid,
        };
      }
    } else if (NATIVE_BUILDING_REGEX.test(nativeClass)) {
      for (const cls of classes) {
        const c = cls as Record<string, unknown>;
        if (typeof c.ClassName !== "string") continue;
        const id = normalizeClassName(c.ClassName, "Build_");
        machines[id] = {
          id,
          displayName: (c.mDisplayName as string | undefined) ?? id,
          power: parseMachinePower(c),
        };
      }
    } else if (nativeClass.includes(NATIVE_RECIPE)) {
      for (const cls of classes) {
        const c = cls as Record<string, unknown>;
        if (typeof c.ClassName !== "string") continue;
        // Duration stays a raw string here; the loud-failure check and
        // Fraction.parse happen during post-processing so the message can
        // name the recipe.
        recipesRaw.push({
          className: c.ClassName,
          displayName: (c.mDisplayName as string | undefined) ?? c.ClassName,
          ingredients: (c.mIngredients as string | undefined) ?? "",
          product: (c.mProduct as string | undefined) ?? "",
          duration:
            typeof c.mManufactoringDuration === "string"
              ? c.mManufactoringDuration
              : "",
          producedIn: (c.mProducedIn as string | undefined) ?? "",
        });
      }
    }
  }

  const recipes: Record<string, CatalogRecipe> = {};
  for (const r of recipesRaw) {
    const id = normalizeClassName(r.className, "Recipe_");
    const machineId = extractMachineId(r.producedIn);
    // Ported filter: skip recipes whose producing building is unknown.
    if (!machineId || !machines[machineId]) continue;

    // Loud failure: the duration must parse to an exact positive Fraction.
    // Replaces the planner's `?? '1'` default and its `≤0 → per_min 0`
    // fallback — a malformed duration is genuine corruption, named here.
    const duration = parseDuration(r.duration, id);

    const inputs = parseIngredientList(r.ingredients, duration, items, id);
    const outputs = parseIngredientList(r.product, duration, items, id);
    // Ported filter: skip recipes with zero outputs.
    if (outputs.length === 0) continue;
    // Ported filter: skip recipes whose outputs reference no known item.
    if (!outputs.some((o) => items[o.itemId])) continue;

    const isAlternate =
      id.includes("alternate_") || r.displayName.startsWith("Alternate:");

    recipes[id] = {
      id,
      displayName: r.displayName.replace(/^Alternate:\s*/, ""),
      machineId,
      isAlternate,
      inputs,
      outputs,
      primaryOutputId: outputs[0]!.itemId,
    };
  }

  return { items, machines, recipes, tiers: TIER_TABLE };
}

/**
 * Parse a recipe duration string into an exact positive Fraction, throwing a
 * recipe-named `DocsParseError` on missing/malformed/≤0 input.
 */
function parseDuration(raw: string, recipeId: string): Fraction {
  if (raw === "") {
    throw new DocsParseError(
      `Recipe ${recipeId}: missing mManufactoringDuration.`,
    );
  }
  let duration: Fraction;
  try {
    duration = Fraction.parse(raw);
  } catch {
    throw new DocsParseError(
      `Recipe ${recipeId}: malformed mManufactoringDuration ${JSON.stringify(raw)}.`,
    );
  }
  if (duration.lte(Fraction.from(0))) {
    throw new DocsParseError(
      `Recipe ${recipeId}: mManufactoringDuration must be > 0; got ${duration.toString()}.`,
    );
  }
  return duration;
}

// Default overclock exponent when a building omits mPowerConsumptionExponent.
// Every one of the 20 admitted buildings in the bundled snapshot DOES carry it
// (so this default is unexercised today), but the read stays lenient — a stray
// building missing the key must never become a new parse rejection. 1.321929 is
// the snapshot's majority value (15 of 20), the least-wrong fallback.
const DEFAULT_POWER_EXPONENT = Fraction.of(1321929, 1000000);

/**
 * Parse a building's power draw from its raw class fields (three branches, frozen
 * Axis 1). Values go through the same exact decimal→Fraction path as rates; a
 * field that isn't a decimal string is treated as absent (safe fallback, never a
 * new rejection reason). The verbatim game keys are used, including the game's
 * own "Mininum" typo in mEstimatedMininumPowerConsumption.
 */
function parseMachinePower(c: Record<string, unknown>): MachinePower {
  const exponent =
    parsePowerField(c.mPowerConsumptionExponent) ?? DEFAULT_POWER_EXPONENT;
  const consumption = parsePowerField(c.mPowerConsumption);
  // Branch 1: a positive constant draw (manufacturers + powered extractors —
  // miners 5/15/45 MW, Oil Extractor 40 MW).
  if (consumption !== null && consumption.gt(Fraction.from(0))) {
    return { mw: consumption, variable: false, exponent };
  }
  // Branch 2: both estimate bounds present ⇒ variable-power machine; mw is the
  // exact min/max midpoint (a min of 0 is legal — Quantum Encoder), bounds kept.
  const minMw = parsePowerField(c.mEstimatedMininumPowerConsumption);
  const maxMw = parsePowerField(c.mEstimatedMaximumPowerConsumption);
  if (minMw !== null && maxMw !== null) {
    const mw = minMw.add(maxMw).div(Fraction.from(2));
    return { mw, variable: true, minMw, maxMw, exponent };
  }
  // Branch 3: zero draw — the generators carry mPowerConsumption present-as-0
  // (falls through branch 1's > 0 check) and produce, not draw, power.
  // mPowerProduction is deliberately NOT parsed (no consumer this arc).
  return { mw: Fraction.from(0), variable: false, exponent };
}

/** A power field as an exact Fraction, or null if absent/non-decimal (never
 *  throws — a malformed power value degrades to "absent", not a parse failure). */
function parsePowerField(raw: unknown): Fraction | null {
  if (typeof raw !== "string") return null;
  try {
    return Fraction.parse(raw);
  } catch {
    return null;
  }
}

/** ClassName → snake-case id (ported normalization scheme). */
function normalizeClassName(cls: string, prefix: string): string {
  const bare = cls.split(/[./']/).pop() ?? cls;
  let name = bare;
  if (name.startsWith(prefix)) name = name.slice(prefix.length);
  if (name.endsWith("_C")) name = name.slice(0, -2);
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

// Ported unchanged (planner docs-loader.ts:185): the Amount capture is
// `[0-9.]+`. A non-match skips the entry silently (extractors/empty lists);
// a captured string Fraction.parse rejects (e.g. two dots) throws loudly.
const ENTRY_REGEX =
  /ItemClass=[^,]*?Desc_([A-Za-z0-9_]+)_C[^,]*?,Amount=([0-9.]+)/g;

function parseIngredientList(
  serialized: string,
  duration: Fraction,
  items: Record<string, CatalogItem>,
  recipeId: string,
): RecipeIO[] {
  if (!serialized) return [];
  const result: RecipeIO[] = [];
  // Fresh lastIndex per call: ENTRY_REGEX is a module-level /g regex.
  ENTRY_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ENTRY_REGEX.exec(serialized)) !== null) {
    const rawName = m[1];
    const rawAmount = m[2];
    if (rawName === undefined || rawAmount === undefined) continue;
    const itemId = normalizeClassName(`Desc_${rawName}_C`, "Desc_");

    // Loud failure: a captured Amount that isn't an exact decimal is genuine
    // corruption. Name recipe + item so the upload UI can point at it.
    let amount: Fraction;
    try {
      amount = Fraction.parse(rawAmount);
    } catch {
      throw new DocsParseError(
        `Recipe ${recipeId}, item ${itemId}: malformed Amount ${JSON.stringify(rawAmount)}.`,
      );
    }

    // Fluids are stored in liters (×1000 of the m³ display value); normalize
    // exactly so rates match the pipe tier table. Solids are untouched.
    if (items[itemId]?.isFluid) {
      amount = amount.div(Fraction.from(1000));
    }
    // Exact per-minute flow at 100% clock: amount × 60 / duration.
    const perMinute = amount.mul(Fraction.from(60)).div(duration);
    result.push({ itemId, perMinute });
  }
  return result;
}

function extractMachineId(producedIn: string): string | null {
  const m = /Build_([A-Za-z0-9_]+)_C/.exec(producedIn);
  if (!m || m[1] === undefined) return null;
  return normalizeClassName(`Build_${m[1]}_C`, "Build_");
}
