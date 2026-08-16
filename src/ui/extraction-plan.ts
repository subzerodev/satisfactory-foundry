import { Fraction } from "../core/fraction.ts";
import type { LaneKind } from "../core/manifold.ts";
import type { Catalog, CatalogExtractor } from "../data/types.ts";
import { stagePowerText, suggestSupply } from "./advice.ts";
import { parseClockText } from "./clock.ts";

export interface ExtractionSelection {
  machineId: string;
  clockPercentText: string;
  purityMix?: PurityMixText;
}

export interface PurityMixText {
  impure: string;
  normal: string;
  pure: string;
}

export type ExtractionTransportStatus =
  | {
      status: "available" | "requires-unlock";
      kind: LaneKind;
      capacity: Fraction;
    }
  | { status: "over-capacity"; kind: LaneKind };

export type ExtractionPurityResult =
  | null
  | {
      status: "invalid";
      detail: string;
      field: keyof PurityMixText | null;
    }
  | {
      status: "planned";
      nodeCount: number;
      totalSupply: Fraction;
      balance:
        | { status: "spare"; amount: Fraction }
        | { status: "shortfall"; amount: Fraction };
      powerText: string;
      transport: ExtractionTransportStatus | { status: "none" };
    };

export type ExtractionPlan =
  | { status: "pick-extractor" }
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
      purity: ExtractionPurityResult;
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
      : { status: "pick-extractor" };
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

  const parsedClock = parseClockText(selection.clockPercentText);
  if (!parsedClock.ok) {
    return { status: "invalid-clock", detail: parsedClock.error };
  }
  const clock = parsedClock.value;

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

  const transport = transportForOutput(
    catalog,
    itemId,
    perExtractor,
    unlockedTiers,
  );
  const purity = derivePurityResult(
    catalog,
    itemId,
    demand,
    selection.purityMix,
    perExtractor,
    machine.power,
    clock,
    unlockedTiers,
  );

  return {
    status: "planned",
    count: suggestion.machines,
    perExtractor,
    totalSupply: perExtractor.mul(Fraction.from(suggestion.machines)),
    surplus: suggestion.surplus,
    powerText: stagePowerText(machine.power, suggestion.machines, clock),
    transport,
    purity,
  };
}

const MAX_SAFE_NODE_COUNT = BigInt(Number.MAX_SAFE_INTEGER);

function derivePurityResult(
  catalog: Catalog,
  itemId: string,
  demand: Fraction,
  purityMix: PurityMixText | undefined,
  perExtractor: Fraction,
  power: Catalog["machines"][string]["power"],
  clock: Fraction,
  unlockedTiers: { belt: number; pipe: number },
): ExtractionPurityResult {
  if (purityMix === undefined || itemId === "water") return null;

  const parsed = parsePurityMix(purityMix);
  if ("detail" in parsed) return { status: "invalid", ...parsed };

  const nodeCountBig = parsed.impure + parsed.normal + parsed.pure;
  if (nodeCountBig > MAX_SAFE_NODE_COUNT) {
    return {
      status: "invalid",
      detail: "Total node count must not exceed Number.MAX_SAFE_INTEGER.",
      field: null,
    };
  }
  const nodeCount = Number(nodeCountBig);
  const weightedNodes = Fraction.from(parsed.impure)
    .mul(Fraction.of(1, 2))
    .add(Fraction.from(parsed.normal))
    .add(Fraction.from(parsed.pure).mul(Fraction.from(2)));
  const totalSupply = perExtractor.mul(weightedNodes);
  const difference = totalSupply.sub(demand);
  const balance = difference.gte(Fraction.from(0))
    ? { status: "spare" as const, amount: difference }
    : { status: "shortfall" as const, amount: demand.sub(totalSupply) };

  let transport: ExtractionTransportStatus | { status: "none" };
  if (parsed.pure > 0n) {
    transport = transportForOutput(
      catalog,
      itemId,
      perExtractor.mul(Fraction.from(2)),
      unlockedTiers,
    );
  } else if (parsed.normal > 0n) {
    transport = transportForOutput(
      catalog,
      itemId,
      perExtractor,
      unlockedTiers,
    );
  } else if (parsed.impure > 0n) {
    transport = transportForOutput(
      catalog,
      itemId,
      perExtractor.mul(Fraction.of(1, 2)),
      unlockedTiers,
    );
  } else {
    transport = { status: "none" };
  }

  return {
    status: "planned",
    nodeCount,
    totalSupply,
    balance,
    powerText: stagePowerText(power, nodeCount, clock),
    transport,
  };
}

function parsePurityMix(
  purityMix: PurityMixText,
):
  | { impure: bigint; normal: bigint; pure: bigint }
  | { detail: string; field: keyof PurityMixText } {
  const counts = {} as { impure: bigint; normal: bigint; pure: bigint };
  const fields = [
    ["impure", "Impure"],
    ["normal", "Normal"],
    ["pure", "Pure"],
  ] as const;
  for (const [field, label] of fields) {
    const raw = purityMix[field];
    if (!/^\d+$/.test(raw)) {
      return {
        detail: `${label} node count must be a base-10 nonnegative integer.`,
        field,
      };
    }
    const count = BigInt(raw);
    if (count > MAX_SAFE_NODE_COUNT) {
      return {
        detail: `${label} node count must not exceed Number.MAX_SAFE_INTEGER.`,
        field,
      };
    }
    counts[field] = count;
  }
  return counts;
}

function transportForOutput(
  catalog: Catalog,
  itemId: string,
  output: Fraction,
  unlockedTiers: { belt: number; pipe: number },
): ExtractionTransportStatus {
  const kind: LaneKind =
    catalog.items[itemId]?.isFluid === true ? "pipe" : "belt";
  const tiers = catalog.tiers[kind];
  const tierIndex = tiers.findIndex((capacity) => capacity.gte(output));
  return tierIndex < 0
    ? { status: "over-capacity", kind }
    : {
        status:
          tierIndex < unlockedTiers[kind] ? "available" : "requires-unlock",
        kind,
        capacity: tiers[tierIndex]!,
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
