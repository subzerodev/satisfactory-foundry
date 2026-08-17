import { Fraction } from "./fraction.ts";
import {
  resolvePackagingPair,
  type PackagingCatalog,
  type PackagingPair,
} from "./packaging-pair.ts";
import { parseClockText } from "./clock.ts";
import {
  computeLinkTransport,
  type CatalogItem,
  type TierTable,
  type TransportPlan,
} from "./transport-plan.ts";
import {
  machinePowerProjection,
  type MachinePowerInput,
  type MachinePowerProjection,
} from "./machine-power.ts";
import type { LinkTransport, PackagingInterstep } from "./link-transport.ts";

export interface LinkPlanCatalog extends PackagingCatalog {
  items: Record<string, (CatalogItem & { isFluid: boolean }) | undefined>;
  machines: Record<string, { power: MachinePowerInput } | undefined>;
  tiers: TierTable;
}

export interface LinkPlanStage {
  selection: { unlockedTiers: { belt: number; pipe: number } };
  solve:
    | { status: "idle" | "invalid" }
    | {
        status: "solved";
        result: {
          outputs: { itemId: string; totalOutput: Fraction }[];
          feeds: { itemId: string; totalDemand: Fraction }[];
        };
      };
}

export interface LinkPlanLink {
  fromStageId: string;
  toStageId: string;
  itemId: string;
  transport?: LinkTransport;
  interstep?: PackagingInterstep;
}

export interface EffectiveLinkCargo {
  packagedItemId: string;
  containerItemId: string;
  materialSupply: Fraction | null;
  materialDemand: Fraction | null;
  cargoSupply: Fraction | null;
  cargoDemand: Fraction | null;
  containerReturnRate: Fraction | null;
}

export interface ReadyLinkPlan extends EffectiveLinkCargo {
  status: "ready";
  pair: PackagingPair;
  packageMachines: number | null;
  unpackageMachines: number | null;
  power: MachinePowerProjection | null;
  forwardTransport: TransportPlan;
  returnTransport: TransportPlan;
}

export interface UnavailableLinkPlan {
  status: "unavailable";
  error: string;
}

export type DerivedLinkPlan = ReadyLinkPlan | UnavailableLinkPlan;

export function effectiveLinkCargo(
  pair: PackagingPair,
  materialSupply: Fraction | null,
  materialDemand: Fraction | null,
): EffectiveLinkCargo {
  const packagedPerFluid = pair.packagePackagedRate.div(pair.packageFluidRate);
  const containersPerFluid = pair.packageContainerRate.div(
    pair.packageFluidRate,
  );
  return {
    packagedItemId: pair.packagedItemId,
    containerItemId: pair.containerItemId,
    materialSupply,
    materialDemand,
    cargoSupply: materialSupply?.mul(packagedPerFluid) ?? null,
    cargoDemand: materialDemand?.mul(packagedPerFluid) ?? null,
    containerReturnRate: materialDemand?.mul(containersPerFluid) ?? null,
  };
}

export function deriveLinkPlan(
  catalog: LinkPlanCatalog,
  link: LinkPlanLink,
  stages: Record<string, LinkPlanStage>,
): DerivedLinkPlan {
  const intent = link.interstep;
  if (intent === undefined) {
    return {
      status: "unavailable",
      error: "packaging interstep is not enabled",
    };
  }
  const pair = resolvePackagingPair(catalog, intent.packageRecipeId);
  if (pair === null || pair.fluidItemId !== link.itemId) {
    return {
      status: "unavailable",
      error: `packaging pair is unavailable for ${JSON.stringify(link.itemId)}`,
    };
  }
  const clockResult = parseClockText(intent.clockPercentText);
  if (!clockResult.ok) {
    return { status: "unavailable", error: clockResult.error };
  }
  if (
    isIllegalPackagedTransport(link.transport) ||
    isIllegalPackagedTransport(intent.returnTransport)
  ) {
    return {
      status: "unavailable",
      error: "packaged solid cargo cannot use pipe or fluid-truck transport",
    };
  }

  const packagedItem = catalog.items[pair.packagedItemId];
  const containerItem = catalog.items[pair.containerItemId];
  const packager = catalog.machines[pair.packageRecipe.machineId];
  if (!packagedItem || !containerItem || !packager) {
    return {
      status: "unavailable",
      error:
        "packaging pair is unavailable because its catalog data is incomplete",
    };
  }

  const materialSupply = linkMaterialSupply(link, stages);
  const materialDemand = linkMaterialDemand(link, stages);
  const cargo = effectiveLinkCargo(pair, materialSupply, materialDemand);
  let packageMachines: number | null = null;
  let unpackageMachines: number | null = null;
  let power: MachinePowerProjection | null = null;
  if (materialDemand !== null) {
    const clockScale = clockResult.value.div(Fraction.from(100));
    const packageCount = materialDemand.ceilDiv(
      pair.packageFluidRate.mul(clockScale),
    );
    const unpackageCount = materialDemand.ceilDiv(
      pair.unpackageFluidRate.mul(clockScale),
    );
    if (
      packageCount > BigInt(Number.MAX_SAFE_INTEGER) ||
      unpackageCount > BigInt(Number.MAX_SAFE_INTEGER) ||
      packageCount + unpackageCount > BigInt(Number.MAX_SAFE_INTEGER)
    ) {
      return {
        status: "unavailable",
        error: "packaging machine count exceeds the safe integer limit",
      };
    }
    packageMachines = Number(packageCount);
    unpackageMachines = Number(unpackageCount);
    power = machinePowerProjection(
      packager.power,
      packageMachines + unpackageMachines,
      clockResult.value,
    );
  }

  const unlockedTiers = globalUnlockedTiers(catalog, stages);
  return {
    status: "ready",
    pair,
    ...cargo,
    packageMachines,
    unpackageMachines,
    power,
    forwardTransport: computeLinkTransport(
      cargo.cargoDemand,
      link.transport,
      packagedItem,
      catalog.tiers,
      unlockedTiers,
    ),
    returnTransport: computeLinkTransport(
      cargo.containerReturnRate,
      intent.returnTransport,
      containerItem,
      catalog.tiers,
      unlockedTiers,
    ),
  };
}

function isIllegalPackagedTransport(
  transport: LinkTransport | undefined,
): boolean {
  return transport?.mode === "pipe" || transport?.mode === "fluid-truck";
}

function linkMaterialSupply(
  link: LinkPlanLink,
  stages: Record<string, LinkPlanStage>,
): Fraction | null {
  const stage = stages[link.fromStageId];
  if (stage?.solve.status !== "solved") return null;
  return (
    stage.solve.result.outputs.find((lane) => lane.itemId === link.itemId)
      ?.totalOutput ?? null
  );
}

function linkMaterialDemand(
  link: LinkPlanLink,
  stages: Record<string, LinkPlanStage>,
): Fraction | null {
  const stage = stages[link.toStageId];
  if (stage?.solve.status !== "solved") return null;
  return (
    stage.solve.result.feeds.find((lane) => lane.itemId === link.itemId)
      ?.totalDemand ?? null
  );
}

function globalUnlockedTiers(
  catalog: LinkPlanCatalog,
  stages: Record<string, LinkPlanStage>,
): { belt: number; pipe: number } {
  const stage = Object.values(stages)[0];
  return (
    stage?.selection.unlockedTiers ?? {
      belt: catalog.tiers.belt.length,
      pipe: catalog.tiers.pipe.length,
    }
  );
}
