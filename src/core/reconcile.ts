/**
 * Pure link reconciliation (Stage 3 / Phase 1). Given one link's producer output
 * total and consumer demand total for the flowing item, decide whether the feed
 * is short, surplus, or exactly matched — or dangling because a recipe change on
 * either end dropped the lane. All comparison is exact rational (`Fraction`); no
 * store/DOM knowledge, no graph topology.
 *
 * Reconciliation is PER-LINK LOCAL by construction: each finding reads exactly
 * one link's two endpoint totals and nothing else. Cycles therefore cost nothing
 * and are neither detected nor flagged here (Phase 1 decision; a canvas cycle
 * indicator is deferred to Phase 2). See
 * features/chained-stages/phase-1/brainstorm.md Axis 3.
 */

import { Fraction } from "./fraction.ts";

export interface LinkInput {
  linkId: string;
  /** Producer's totalOutput for the item, or null if the producer no longer has
   *  that output lane (recipe changed). */
  supply: Fraction | null;
  /** Consumer's totalDemand for the item, or null if the consumer no longer has
   *  that feed lane (recipe changed). */
  demand: Fraction | null;
  /** One canonical link-plan derivation error, independent of material flow. */
  interstepProblem?: string | null;
}

export type LinkFinding =
  | {
      type: "under-supply";
      linkId: string;
      supply: Fraction;
      demand: Fraction;
      shortfall: Fraction;
    }
  | {
      type: "over-supply";
      linkId: string;
      supply: Fraction;
      demand: Fraction;
      surplus: Fraction;
    }
  | { type: "dangling-link"; linkId: string; end: "from" | "to" }
  | { type: "interstep-problem"; linkId: string; error: string };

/**
 * Reconcile a batch of links in input order. Each link emits at most one
 * material finding followed by at most one independent interstep problem.
 * Exact material flow emits no material finding. A missing lane on either end
 * is a `dangling-link`; when BOTH ends are absent, the producer end wins.
 */
export function reconcileLinks(inputs: LinkInput[]): LinkFinding[] {
  const findings: LinkFinding[] = [];
  for (const { linkId, supply, demand, interstepProblem } of inputs) {
    // Either lane absent → dangling. Producer end wins the both-null tie-break.
    if (supply === null || demand === null) {
      const end = supply === null ? "from" : "to";
      findings.push({ type: "dangling-link", linkId, end });
    } else if (supply.lt(demand)) {
      findings.push({
        type: "under-supply",
        linkId,
        supply,
        demand,
        shortfall: demand.sub(supply),
      });
    } else if (supply.gt(demand)) {
      findings.push({
        type: "over-supply",
        linkId,
        supply,
        demand,
        surplus: supply.sub(demand),
      });
    }
    // Exact match: no material finding.
    if (interstepProblem) {
      findings.push({
        type: "interstep-problem",
        linkId,
        error: interstepProblem,
      });
    }
  }
  return findings;
}
