/**
 * @vitest-environment jsdom
 *
 * Successor to the deleted parallel-feed-belts.test.tsx (#151): the merged-bus
 * "x2" model retired, so its whole feature file went with it. What remains to
 * pin is the NEGATIVE: rendering the very case that used to bundle — Michael's
 * 106-refinery Mk5 plan (the eight old x2 spans, now eight seam mergers) — must
 * draw single lanes and carry NONE of the retired parallel-line vocabulary.
 * P2 owns the ribbon that replaces the visual; P1 only silences the old surface.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Fraction } from "../core/fraction.ts";
import { solveStage, type StageSolveResult } from "../core/manifold.ts";
import type { TierTable } from "../data/types.ts";
import { Blueprint } from "./Blueprint.tsx";
import { Schematic } from "./Schematic.tsx";
import { SummaryCards } from "./SummaryCards.tsx";

const F = (n: number) => Fraction.from(n);
const TIERS: TierTable = {
  belt: [60, 120, 270, 480, 780, 1200].map(F),
  pipe: [300, 600].map(F),
};
const UNLOCKED_MK5 = { belt: 5, pipe: 2 };
const itemName = (id: string) => id;

/** The live 106-refinery case: 17 belts, formerly eight x2 spans. */
function michaelResult(): StageSolveResult {
  return solveStage({
    machineCount: 106,
    clockPercent: F(100),
    capacities: { belt: TIERS.belt.slice(0, 5), pipe: TIERS.pipe },
    feeds: [{ itemId: "limestone", kind: "belt", perMachineRate: F(120) }],
    outputs: [],
  });
}

// The complete retired-vocabulary blacklist (the final sweep gate, at the DOM
// level): none of these strings may appear in any rendered surface.
const RETIRED = [
  "parallel lines",
  "bus up to 2 parallel",
  "one bus line",
  "x2 max",
  "parallel-segment",
  "parallel-rail",
  "parallel-run-label",
  "bp-parallel-max",
];

describe("single-lane feed rendering (post-#151, no x2 model)", () => {
  it("Schematic draws single bus segments with no parallel-line surface", () => {
    const html = renderToStaticMarkup(
      <Schematic
        result={michaelResult()}
        machineCount={106}
        tiers={TIERS}
        unlocked={UNLOCKED_MK5}
        itemName={itemName}
      />,
    );
    // Every stretch renders as a single bus-seg element (P2 D1 turned the feed
    // bus-seg into a tapering polygon; the class-based count survives).
    expect((html.match(/class="bus-seg/g) ?? []).length).toBe(17);
    for (const s of RETIRED) expect(html).not.toContain(s);
    // The seam-merger seams still draw (interior stretch starts).
    expect(html).toContain('class="seam"');
  });

  it("SummaryCards shows a terse count with no bundle copy", () => {
    const html = renderToStaticMarkup(
      <SummaryCards
        result={michaelResult()}
        itemName={itemName}
        powerText={null}
      />,
    );
    expect(html).toContain("17 × belt");
    for (const s of RETIRED) expect(html).not.toContain(s);
  });

  it("Blueprint renders Michael's inlet marks with no x2-max marker", () => {
    const html = renderToStaticMarkup(
      <Blueprint
        solve={michaelResult()}
        machineId="oil_refinery"
        machineCount={106}
        feedLabels={["Limestone"]}
        outputLabels={[]}
      />,
    );
    for (const s of RETIRED) expect(html).not.toContain(s);
  });
});
