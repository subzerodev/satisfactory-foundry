import { Fraction } from "../core/fraction.ts";
import type { LaneKind } from "../core/manifold.ts";
import { TIER_TABLE } from "../data/tiers.ts";
import type { Catalog, CatalogExtractor } from "../data/types.ts";
import { stagePowerText, suggestSupply } from "./advice.ts";

export interface ExtractionSelection {
  machineId: string;
  clockPercentText: string;
}

export type ExtractionTransportStatus =
  | {
      status: "available" | "requires-unlock";
      kind: LaneKind;
      tierIndex: number;
      capacity: Fraction;
    }
  | { status: "over-capacity"; kind: LaneKind };

export type ExtractionPlan =
  | { status: "pick-extractor"; candidates: CatalogExtractor[] }
  | { status: "invalid-clock"; detail: string }
  | { status: "unavailable"; detail: string }
  | {
      status: "planned";
      count: number;
      perExtractor: Fraction;
      totalSupply: Fraction;
      surplus: Fraction;
      powerText: string;
      transport: ExtractionTransportStatus;
    };

interface DeriveExtractionPlanInput {
  catalog: Catalog;
  itemId: string;
  demand: Fraction;
  selection: ExtractionSelection | null;
  unlockedTiers: { belt: number; pipe: number };
}

export function standaloneExtractors(
  catalog: Catalog,
  itemId: string,
): CatalogExtractor[] {
  return Object.values(catalog.extractors).filter(
    (extractor) =>
      extractor.topology === "standalone" && extractor.itemIds.includes(itemId),
  );
}

export function deriveExtractionPlan({
  catalog,
  itemId,
  demand,
  selection,
  unlockedTiers,
}: DeriveExtractionPlanInput): ExtractionPlan {
  const candidates = standaloneExtractors(catalog, itemId);
  if (selection === null) {
    return candidates.length === 0
      ? { status: "unavailable", detail: resourceWellDetail(catalog, itemId) }
      : { status: "pick-extractor", candidates };
  }

  const extractor = Object.hasOwn(catalog.extractors, selection.machineId)
    ? catalog.extractors[selection.machineId]
    : undefined;
  if (
    extractor === undefined ||
    extractor.topology !== "standalone" ||
    !extractor.itemIds.includes(itemId)
  ) {
    return {
      status: "unavailable",
      detail:
        candidates.length === 0
          ? resourceWellDetail(catalog, itemId)
          : "The selected extractor is unavailable for this resource.",
    };
  }
  const machine = Object.hasOwn(catalog.machines, extractor.machineId)
    ? catalog.machines[extractor.machineId]
    : undefined;
  if (machine === undefined) {
    return {
      status: "unavailable",
      detail: "The selected extractor is missing from the machine catalog.",
    };
  }

  let clock: Fraction;
  try {
    clock = Fraction.parse(selection.clockPercentText);
  } catch {
    return {
      status: "invalid-clock",
      detail: "Clock must be a number from 0 to 250.",
    };
  }
  if (!clock.gt(Fraction.from(0)) || clock.gt(Fraction.from(250))) {
    return {
      status: "invalid-clock",
      detail: "Clock must be greater than 0 and at most 250.",
    };
  }

  const perExtractor = extractor.normalRate.mul(clock).div(Fraction.from(100));
  let suggestion: ReturnType<typeof suggestSupply>;
  try {
    suggestion = suggestSupply(demand, perExtractor);
  } catch (error) {
    if (error instanceof RangeError) {
      return { status: "unavailable", detail: error.message };
    }
    throw error;
  }
  if (suggestion === null) {
    return {
      status: "unavailable",
      detail: "The selected extractor has no usable output.",
    };
  }

  const kind: LaneKind =
    catalog.items[itemId]?.isFluid === true ? "pipe" : "belt";
  const tierIndex = TIER_TABLE[kind].findIndex((capacity) =>
    capacity.gte(perExtractor),
  );
  const transport: ExtractionTransportStatus =
    tierIndex < 0
      ? { status: "over-capacity", kind }
      : {
          status:
            tierIndex < unlockedTiers[kind] ? "available" : "requires-unlock",
          kind,
          tierIndex,
          capacity: TIER_TABLE[kind][tierIndex]!,
        };

  return {
    status: "planned",
    count: suggestion.machines,
    perExtractor,
    totalSupply: perExtractor.mul(Fraction.from(suggestion.machines)),
    surplus: suggestion.surplus,
    powerText: stagePowerText(machine.power, suggestion.machines, clock),
    transport,
  };
}

function resourceWellDetail(catalog: Catalog, itemId: string): string {
  const hasWell = Object.values(catalog.extractors).some(
    (extractor) =>
      extractor.topology === "resource-well" &&
      extractor.itemIds.includes(itemId),
  );
  return hasWell
    ? "This resource requires a Resource Well Pressurizer and satellite Resource Well Extractors; Phase 1 cannot derive a buildable count without a specific well."
    : "No standalone extractor is available for this resource.";
}
