import { Fraction } from "../core/fraction.ts";
import type {
  Catalog,
  CatalogExtractor,
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
  /FGBuildable(Manufacturer|Generator|Extractor|ResourceExtractor|WaterPump|FrackingExtractor)/;
const NATIVE_ITEM_REGEX =
  /FG(ItemDescriptor|ResourceDescriptor|ConsumableDescriptor|EquipmentDescriptor|PowerShardDescriptor|ChainsawFuelDescriptor|AmmoType)/;
const NATIVE_RECIPE = "FGRecipe";
// Progression data (S20 P3, ticket #102). FGSchematic is its own native class:
// it matches none of the filters above (no "FGRecipe" substring, no descriptor
// or buildable prefix), so it gets its own branch below.
const NATIVE_SCHEMATIC = "FGSchematic";

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

/**
 * One schematic's recipe unlocks, held until the recipes map exists: the refs
 * are normalized to catalog ids and matched against that map, and Docs.json
 * does not guarantee FGSchematic comes after FGRecipe.
 */
interface RawSchematic {
  techTier: number;
  recipeClassNames: string[];
}

interface RawExtractor {
  machineId: string;
  topology: CatalogExtractor["topology"];
  normalRate: Fraction;
  forms: string[];
  restrictedItemIds: string[] | null;
}

export function parseDocsJson(raw: unknown): Catalog {
  if (!Array.isArray(raw)) {
    throw new DocsParseError("Docs.json root must be an array.");
  }

  // Null-prototype containers (#28): bracket access on these can never resolve
  // an Object.prototype member, so an id that collides with a prototype key
  // (e.g. a "constructor" descriptor) misses cleanly at every lookup site. The
  // Record<string, T> typing is unchanged.
  const items: Record<string, CatalogItem> = Object.create(null);
  const itemForms: Record<string, string> = Object.create(null);
  const machines: Record<string, CatalogMachine> = Object.create(null);
  const recipesRaw: RawRecipe[] = [];
  const schematicsRaw: RawSchematic[] = [];
  const extractorsRaw: RawExtractor[] = [];

  for (const group of raw) {
    if (typeof group !== "object" || group === null) continue;
    const g = group as { NativeClass?: string; Classes?: unknown[] };
    const nativeClass = g.NativeClass ?? "";
    const classes = Array.isArray(g.Classes) ? g.Classes : [];

    if (NATIVE_ITEM_REGEX.test(nativeClass)) {
      // Extraction-level items are the game's own FGResourceDescriptor group
      // (Stage 11 / Phase 1, ticket #57) — the raw-feed display derive reads
      // this flag. Set per GROUP: nativeClass is stable across the group's
      // Classes, so the class check is once, not per item. Absent (⇒ non-raw)
      // for every other descriptor class, matching the optional field default.
      const isRawGroup = /FGResourceDescriptor/.test(nativeClass);
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
          stackSize: parseStackSize(c.mStackSize),
          // Only stamped true — a false would bloat every item literal; the
          // consumer's `=== true` read treats absent as non-raw.
          ...(isRawGroup ? { isRawResource: true } : {}),
        };
        if (isRawGroup && typeof c.mForm === "string") itemForms[id] = c.mForm;
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
        if (isExtractorNativeClass(nativeClass)) {
          extractorsRaw.push(parseRawExtractor(c, id, nativeClass));
        }
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
    } else if (nativeClass.includes(NATIVE_SCHEMATIC)) {
      // Progression unlocks (S20 P3). EVERY mType is visited — the type is read
      // only to be counted during design, never stored: it was MEASURED that no
      // catalog production recipe takes a lower min-tier from a non-progression
      // type (their BP_UnlockRecipe_C refs are building/cosmetic recipes, which
      // the unmatched-ref skip below drops). Non-recipe unlocks (tapes, emotes,
      // inventory slots, …) are filtered by the BP_UnlockRecipe_C check.
      for (const cls of classes) {
        const c = cls as Record<string, unknown>;
        const unlocks = Array.isArray(c.mUnlocks) ? c.mUnlocks : [];
        const recipeClassNames: string[] = [];
        for (const unlock of unlocks) {
          if (typeof unlock !== "object" || unlock === null) continue;
          const u = unlock as { Class?: unknown; mRecipes?: unknown };
          if (u.Class !== UNLOCK_RECIPE_CLASS) continue;
          if (typeof u.mRecipes !== "string") continue;
          for (const m of u.mRecipes.matchAll(RECIPE_REF_REGEX)) {
            if (m[1] !== undefined) recipeClassNames.push(m[1]);
          }
        }
        // A schematic unlocking no recipe carries no tier information.
        if (recipeClassNames.length === 0) continue;
        schematicsRaw.push({
          techTier: parseTechTier(c.mTechTier),
          recipeClassNames,
        });
      }
    }
  }

  // Null-prototype container (#28) — see the items/machines seeds above.
  const recipes: Record<string, CatalogRecipe> = Object.create(null);
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

  // Min unlock tier per catalog recipe (S20 P3). Null-prototype container (#28)
  // — see the items/machines/recipes seeds above; this map is read by bracket
  // access at every gating site.
  const recipeUnlocks: Record<string, number> = Object.create(null);
  for (const s of schematicsRaw) {
    for (const className of s.recipeClassNames) {
      // The RAW trailing segment is NOT the catalog id: the same normalizer
      // that keys `recipes` above must key this map, or nothing ever matches.
      const id = normalizeClassName(className, "Recipe_");
      // Refs that normalize to no catalog recipe (building/cosmetic recipes)
      // are skipped silently — by design, not by oversight.
      if (recipes[id] === undefined) continue;
      const prev = recipeUnlocks[id];
      // A recipe unlocked by several schematics takes the MINIMUM tier: the
      // earliest availability, which is the honest gate.
      if (prev === undefined || s.techTier < prev)
        recipeUnlocks[id] = s.techTier;
    }
  }

  const extractors: Record<string, CatalogExtractor> = Object.create(null);
  for (const rawExtractor of extractorsRaw) {
    const itemIds =
      rawExtractor.restrictedItemIds ??
      Object.keys(itemForms).filter((itemId) =>
        rawExtractor.forms.includes(itemForms[itemId]!),
      );
    if (rawExtractor.restrictedItemIds !== null) {
      for (const itemId of itemIds) {
        if (items[itemId]?.isRawResource !== true) {
          throw new DocsParseError(
            `Extractor ${rawExtractor.machineId}: mAllowedResources references unknown or non-raw item ${itemId}.`,
          );
        }
        if (!rawExtractor.forms.includes(itemForms[itemId]!)) {
          throw new DocsParseError(
            `Extractor ${rawExtractor.machineId}: item ${itemId} does not match mAllowedResourceForms.`,
          );
        }
      }
    }
    extractors[rawExtractor.machineId] = {
      machineId: rawExtractor.machineId,
      topology: rawExtractor.topology,
      normalRate: rawExtractor.normalRate,
      itemIds,
    };
  }

  return {
    items,
    machines,
    recipes,
    tiers: TIER_TABLE,
    recipeUnlocks,
    extractors,
  };
}

function isExtractorNativeClass(nativeClass: string): boolean {
  return /FGBuildable(ResourceExtractor|WaterPump|FrackingExtractor)'$/.test(
    nativeClass,
  );
}

const EXTRACTOR_FORMS = new Set(["RF_SOLID", "RF_LIQUID", "RF_GAS"]);
const ALLOWED_RESOURCE_REF = /\.Desc_([A-Za-z0-9_]+)_C'/g;

function parseRawExtractor(
  c: Record<string, unknown>,
  machineId: string,
  nativeClass: string,
): RawExtractor {
  const itemsPerCycle = parsePositiveExtractorField(
    c.mItemsPerCycle,
    machineId,
    "mItemsPerCycle",
  );
  const cycleTime = parsePositiveExtractorField(
    c.mExtractCycleTime,
    machineId,
    "mExtractCycleTime",
  );
  if (typeof c.mAllowedResourceForms !== "string") {
    throw new DocsParseError(
      `Extractor ${machineId}: missing mAllowedResourceForms.`,
    );
  }
  const formsMatch = /^\((RF_[A-Z]+(?:,RF_[A-Z]+)*)\)$/.exec(
    c.mAllowedResourceForms,
  );
  if (formsMatch?.[1] === undefined) {
    throw new DocsParseError(
      `Extractor ${machineId}: malformed mAllowedResourceForms.`,
    );
  }
  const forms = formsMatch[1].split(",");
  if (forms.some((form) => !EXTRACTOR_FORMS.has(form))) {
    throw new DocsParseError(
      `Extractor ${machineId}: unknown mAllowedResourceForms value.`,
    );
  }

  if (
    c.mOnlyAllowCertainResources !== "True" &&
    c.mOnlyAllowCertainResources !== "False"
  ) {
    throw new DocsParseError(
      `Extractor ${machineId}: mOnlyAllowCertainResources must be "True" or "False".`,
    );
  }
  let restrictedItemIds: string[] | null = null;
  if (c.mOnlyAllowCertainResources === "True") {
    if (typeof c.mAllowedResources !== "string" || c.mAllowedResources === "") {
      throw new DocsParseError(
        `Extractor ${machineId}: restricted mAllowedResources must be non-empty.`,
      );
    }
    restrictedItemIds = [];
    ALLOWED_RESOURCE_REF.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = ALLOWED_RESOURCE_REF.exec(c.mAllowedResources)) !== null) {
      if (match[1] !== undefined) {
        restrictedItemIds.push(
          normalizeClassName(`Desc_${match[1]}_C`, "Desc_"),
        );
      }
    }
    if (restrictedItemIds.length === 0) {
      throw new DocsParseError(
        `Extractor ${machineId}: malformed mAllowedResources.`,
      );
    }
  }

  let normalRate = itemsPerCycle.mul(Fraction.from(60)).div(cycleTime);
  if (!forms.includes("RF_SOLID")) {
    normalRate = normalRate.div(Fraction.from(1000));
  }
  return {
    machineId,
    topology: nativeClass.includes("FrackingExtractor")
      ? "resource-well"
      : "standalone",
    normalRate,
    forms,
    restrictedItemIds,
  };
}

function parsePositiveExtractorField(
  raw: unknown,
  machineId: string,
  field: string,
): Fraction {
  if (typeof raw !== "string") {
    throw new DocsParseError(`Extractor ${machineId}: missing ${field}.`);
  }
  let value: Fraction;
  try {
    value = Fraction.parse(raw);
  } catch {
    throw new DocsParseError(`Extractor ${machineId}: malformed ${field}.`);
  }
  if (!value.gt(Fraction.from(0))) {
    throw new DocsParseError(`Extractor ${machineId}: ${field} must be > 0.`);
  }
  return value;
}

/** The `mUnlocks` entry class that carries recipe unlocks. Every other unlock
 *  kind (tapes, emotes, inventory slots, scannables, …) is skipped. */
const UNLOCK_RECIPE_CLASS = "BP_UnlockRecipe_C";

/**
 * Recipe class names inside an `mRecipes` tuple string. Each ref reads
 * `…'/Game/…/Recipe_<X>.Recipe_<X>_C'` — note it ENDS in an apostrophe, so the
 * capture EXCLUDES the quote deliberately: `normalizeClassName` splits on
 * `[./']` and takes the last segment, so handing it a whole ref would yield the
 * EMPTY STRING, collapsing every id and making gating a silent no-op. The
 * capture takes the bare class name only; `matchAll` clones the regex, so the
 * module-level `/g` lastIndex is never shared across calls.
 */
const RECIPE_REF_REGEX = /\.(Recipe_[A-Za-z0-9_]+_C)'/g;

/**
 * A schematic's `mTechTier` as a NON-NEGATIVE INTEGER. The game exports it as a
 * STRING ("0".."9"); absence, a non-string/number, un-parseable garbage, and a
 * negative or fractional value all yield 0 — the tolerant-parse posture (a
 * schematic with an unreadable tier gates at the earliest tier rather than
 * becoming a new parse rejection).
 *
 * The integer/non-negative half mirrors the store-side `validTier` sibling, and
 * for the same reason: these values flow into the TIER option list, derived as
 * `Math.max(...) + 1`, where a fractional max truncates the list and a negative
 * max empties it. Not reachable from the shipped snapshot — the symmetry is the
 * point, so a future corrupt export cannot reach the UI.
 */
function parseTechTier(raw: unknown): number {
  if (typeof raw !== "string" && typeof raw !== "number") return 0;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

/**
 * `mStackSize` enum → items-per-slot, per the fact table (§Stack sizes). SS_FLUID
 * is deliberately absent (fluid cargo uses tank volumes, never stacks) — it maps
 * to `null` in {@link parseStackSize}, as does any UNRECOGNIZED enum value
 * (honest absent, not a guessed number).
 */
const STACK_SIZE_ENUM: Readonly<Record<string, Fraction>> = {
  SS_ONE: Fraction.from(1),
  SS_SMALL: Fraction.from(50),
  SS_MEDIUM: Fraction.from(100),
  SS_BIG: Fraction.from(200),
  SS_HUGE: Fraction.from(500),
};

/**
 * A solid item's stack size from its raw `mStackSize` enum string, or `null`
 * for SS_FLUID, an absent/non-string field, or any unrecognized enum value (the
 * honest-absent posture — solid-vehicle math for such an item is unavailable,
 * not wrong). Never throws: an unknown value degrades to null, matching the
 * power-field leniency, not a parse rejection.
 */
function parseStackSize(raw: unknown): Fraction | null {
  if (typeof raw !== "string") return null;
  return STACK_SIZE_ENUM[raw] ?? null;
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
