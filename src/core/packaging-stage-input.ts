/**
 * The packaging → manifold adapter (#157 A1). A packaging interstep is already
 * sized by `derivePackagingPlan` into a `ReadyLinkPlan` (machine counts, the
 * `PackagingPair` per-machine rates, the resolved item ids). This adapter maps
 * that plan into the two `StageInput`s the manifold solver already accepts — one
 * per machine group — so the packaging chain draws through the SAME `solveStage`
 * path as any production stage. No new sizing rule is invented here: every rate
 * is read straight off the pair, every count off the plan; the arithmetic is
 * exact `Fraction` (src/core purity — no floats, no DOM).
 *
 * The mapping mirrors the physical machine IO:
 *
 * - Packager: fluid (pipe) + container (belt) feed in, packaged (belt) out.
 * - Unpackager: packaged (belt) feed in, fluid (pipe) + container (belt) out —
 *   the exact reverse, read from the pair's `unpackage*` rate fields.
 *
 * `clockPercent` is the interstep's shared Packager clock — the SAME value
 * `derivePackagingPlan` sized the counts against — passed in as an already-parsed
 * `Fraction` (the caller owns the one parse) so the drawing scales identically.
 */

import type { Fraction } from "./fraction.ts";
import type { ReadyLinkPlan } from "./link-plan.ts";
import type { StageInput } from "./manifold.ts";

/**
 * The manifold `StageInput`s for a packaging chain's two machine groups, or
 * `null` when the plan carries no machine counts (its material demand is
 * unresolved — nothing to draw). Both groups solve as an ordinary stage.
 */
export function packagingStageInputs(
  plan: ReadyLinkPlan,
  clockPercent: Fraction,
  capacities: { belt: Fraction[]; pipe: Fraction[] },
): { packager: StageInput; unpackager: StageInput } | null {
  if (plan.packageMachines === null || plan.unpackageMachines === null) {
    return null;
  }

  const { pair } = plan;

  const packager: StageInput = {
    machineCount: plan.packageMachines,
    clockPercent,
    capacities,
    feeds: [
      {
        itemId: pair.fluidItemId,
        kind: "pipe",
        perMachineRate: pair.packageFluidRate,
      },
      {
        itemId: plan.containerItemId,
        kind: "belt",
        perMachineRate: pair.packageContainerRate,
      },
    ],
    outputs: [
      {
        itemId: plan.packagedItemId,
        kind: "belt",
        perMachineRate: pair.packagePackagedRate,
      },
    ],
  };

  const unpackager: StageInput = {
    machineCount: plan.unpackageMachines,
    clockPercent,
    capacities,
    feeds: [
      {
        itemId: plan.packagedItemId,
        kind: "belt",
        perMachineRate: pair.unpackagePackagedRate,
      },
    ],
    outputs: [
      {
        itemId: pair.fluidItemId,
        kind: "pipe",
        perMachineRate: pair.unpackageFluidRate,
      },
      {
        itemId: plan.containerItemId,
        kind: "belt",
        perMachineRate: pair.unpackageContainerRate,
      },
    ],
  };

  return { packager, unpackager };
}
