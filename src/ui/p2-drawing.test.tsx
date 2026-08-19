/**
 * @vitest-environment jsdom
 *
 * P2 drawing pins (arc #140 / #152): the tapering ribbon geometry + terminal
 * rule (D1), the endpoint numbers + two-sided collision rules (D2), the pipe
 * connector (D4), the summary-card lines (D5), and the legend conventions (D6).
 * The site-plan junction kinds (D7) live in src/layout/layout.test.ts; the
 * segTooltip shapes (D3) live in format.test.ts.
 */

/// <reference types="node" />
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Fraction } from "../core/fraction.ts";
import { solveStage, type StageSolveResult } from "../core/manifold.ts";
import type { StageInput } from "../core/manifold.ts";
import type { TierTable } from "../data/types.ts";
import { Schematic } from "./Schematic.tsx";
import { SummaryCards } from "./SummaryCards.tsx";
import { Legend } from "./Legend.tsx";
import { pipeConnectorTooltip } from "./format.ts";

const F = (n: number) => Fraction.from(n);
const TIERS: TierTable = {
  belt: [60, 120, 270, 480, 780, 1200].map(F),
  pipe: [300, 600].map(F),
};
const UNLOCKED_MK5 = { belt: 5, pipe: 2 };
const itemName = (id: string) => id;

function schematicDoc(
  result: StageSolveResult,
  machineCount: number,
): Document {
  return new DOMParser().parseFromString(
    renderToStaticMarkup(
      <Schematic
        result={result}
        machineCount={machineCount}
        tiers={TIERS}
        unlocked={UNLOCKED_MK5}
        itemName={itemName}
      />,
    ),
    "text/html",
  );
}

/** The P1 N=13 two-stretch case: [1-6] entry 780 → hand-off 60; [7-13] entry
 *  840 → 0 (terminal). d=120, Mk5. */
function twoStretch(): StageSolveResult {
  return solveStage({
    machineCount: 13,
    clockPercent: F(100),
    capacities: { belt: TIERS.belt.slice(0, 5), pipe: TIERS.pipe },
    feeds: [{ itemId: "feed", kind: "belt", perMachineRate: F(120) }],
    outputs: [],
  });
}

/** Parse a polygon's four points into {x, y} pairs (the ribbon's TL, TR, BR,
 *  BL). Half-heights are the vertical distance from the shared busY centre. */
function polyPoints(el: Element): { x: number; y: number }[] {
  return (el.getAttribute("points") ?? "")
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return { x: x!, y: y! };
    });
}

describe("P2 D1 — tapering ribbon geometry (feed lanes)", () => {
  it("renders two bus-seg polygons that taper: left > right, terminal → RIBBON_MIN", () => {
    const doc = schematicDoc(twoStretch(), 13);
    const polys = [...doc.querySelectorAll("polygon.bus-seg")];
    expect(polys).toHaveLength(2);
    expect(doc.querySelector("line.bus-seg")).toBeNull(); // no feed line

    // Stretch 1 (entry 780 → hand-off 60): left half-height strictly greater
    // than the right — the points string carries [TL, TR, BR, BL].
    const p1 = polyPoints(polys[0]!);
    const busY1 = (p1[0]!.y + p1[3]!.y) / 2; // TL.y + BL.y averaged = centre
    const leftHalf1 = busY1 - p1[0]!.y; // centre − TL.y
    const rightHalf1 = busY1 - p1[1]!.y; // centre − TR.y
    expect(leftHalf1).toBeGreaterThan(rightHalf1);

    // Stretch 2 (terminal): right half-height is RIBBON_MIN (1), left is full.
    const p2 = polyPoints(polys[1]!);
    const busY2 = (p2[0]!.y + p2[3]!.y) / 2;
    const leftHalf2 = busY2 - p2[0]!.y;
    const rightHalf2 = busY2 - p2[1]!.y;
    expect(rightHalf2).toBeCloseTo(1, 5); // RIBBON_MIN
    expect(leftHalf2).toBeGreaterThan(rightHalf2);
  });
});

describe("P2 D1/D2 — terminal rule", () => {
  it("renders terminal onward '0', a RIBBON_MIN terminal ribbon, and the spare card line", () => {
    // A single-belt lane, Mk3 (270) over 4 machines at d=60 → 240 demand, terminal
    // handoffResidue 30 (capacity surplus, NOT onward flow).
    const input: StageInput = {
      machineCount: 4,
      clockPercent: F(100),
      capacities: { belt: TIERS.belt.slice(0, 5), pipe: TIERS.pipe },
      feeds: [
        {
          itemId: "feed",
          kind: "belt",
          perMachineRate: F(60),
          overrides: [F(270)],
        },
      ],
      outputs: [],
    };
    const result = solveStage(input);
    // The terminal endpoint reads "0", never "30".
    const doc = schematicDoc(result, 4);
    const endpoints = [...doc.querySelectorAll(".ribbon-endpoint")].map(
      (e) => e.textContent,
    );
    expect(endpoints).toContain("0");
    expect(endpoints).not.toContain("30");

    // The terminal ribbon's RIGHT half-height is RIBBON_MIN (1), not the surplus.
    const poly = doc.querySelector("polygon.bus-seg")!;
    const pts = polyPoints(poly);
    const busY = (pts[0]!.y + pts[3]!.y) / 2;
    expect(busY - pts[1]!.y).toBeCloseTo(1, 5);

    // The card surfaces the surplus textually.
    const cardHtml = renderToStaticMarkup(
      <SummaryCards result={result} itemName={itemName} powerText={null} />,
    );
    expect(cardHtml).toContain("spare belt capacity: 30/min");
  });

  it("a demand-exact terminal lane reads '0' with NO spare line", () => {
    const input: StageInput = {
      machineCount: 4,
      clockPercent: F(100),
      capacities: { belt: TIERS.belt.slice(0, 5), pipe: TIERS.pipe },
      feeds: [
        {
          itemId: "feed",
          kind: "belt",
          perMachineRate: F(60),
          overrides: [F(240)],
        },
      ],
      outputs: [],
    };
    const result = solveStage(input);
    const doc = schematicDoc(result, 4);
    const endpoints = [...doc.querySelectorAll(".ribbon-endpoint")].map(
      (e) => e.textContent,
    );
    expect(endpoints).toContain("0");
    const cardHtml = renderToStaticMarkup(
      <SummaryCards result={result} itemName={itemName} powerText={null} />,
    );
    expect(cardHtml).not.toContain("spare belt capacity");
  });
});

describe("P2 D2 — endpoint numbers", () => {
  it("renders an entry label per stretch, start-anchored at x1+3", () => {
    const doc = schematicDoc(twoStretch(), 13);
    const entries = [...doc.querySelectorAll(".ribbon-endpoint")].filter(
      (e) => e.getAttribute("text-anchor") === "start",
    );
    // One entry label per stretch (2 stretches).
    expect(entries).toHaveLength(2);
    // The head stretch's entry sits at x1 + 3 (x1 = the lane start boundary).
    const polys = [...doc.querySelectorAll("polygon.bus-seg")];
    const headX1 = polyPoints(polys[0]!)[0]!.x;
    expect(Number(entries[0]!.getAttribute("x"))).toBe(headX1 + 3);
    expect(entries[0]!.textContent).toBe("780");
  });

  it("renders exactly one hand-off '60' end-anchored at x2−3 (non-terminal, residue>0)", () => {
    const doc = schematicDoc(twoStretch(), 13);
    const handoffs = [...doc.querySelectorAll(".ribbon-endpoint")].filter(
      (e) => e.getAttribute("text-anchor") === "end" && e.textContent === "60",
    );
    expect(handoffs).toHaveLength(1);
    // End-anchored at the head stretch's x2 − 3.
    const polys = [...doc.querySelectorAll("polygon.bus-seg")];
    const headX2 = polyPoints(polys[0]!)[1]!.x;
    expect(Number(handoffs[0]!.getAttribute("x"))).toBe(headX2 - 3);
  });

  it("places both endpoint rows on ONE baseline above the ribbon (no text below busY)", () => {
    // Two feed lanes: the below-ribbon row would collide with the next lane's
    // name; assert NO ribbon-endpoint renders below its lane's busY.
    const result = solveStage({
      machineCount: 13,
      clockPercent: F(100),
      capacities: { belt: TIERS.belt.slice(0, 5), pipe: TIERS.pipe },
      feeds: [
        { itemId: "a", kind: "belt", perMachineRate: F(120) },
        { itemId: "b", kind: "belt", perMachineRate: F(120) },
      ],
      outputs: [],
    });
    const doc = schematicDoc(result, 13);
    // Each lane group's polygons share a busY; every endpoint in that group must
    // sit strictly above it.
    const laneGroups = [...doc.querySelectorAll("g.lane-feed")];
    expect(laneGroups.length).toBe(2);
    for (const g of laneGroups) {
      const poly = g.querySelector("polygon.bus-seg")!;
      const pts = polyPoints(poly);
      const busY = (pts[0]!.y + pts[3]!.y) / 2;
      const endpointYs = [...g.querySelectorAll(".ribbon-endpoint")].map((e) =>
        Number(e.getAttribute("y")),
      );
      expect(endpointYs.length).toBeGreaterThan(0);
      for (const y of endpointYs) expect(y).toBeLessThan(busY);
    }
  });

  it("carries the halo class on every ribbon-endpoint", () => {
    const doc = schematicDoc(twoStretch(), 13);
    const endpoints = [...doc.querySelectorAll(".ribbon-endpoint")];
    expect(endpoints.length).toBeGreaterThan(0);
    for (const e of endpoints) {
      expect(e.classList.contains("ribbon-endpoint")).toBe(true);
    }
    // The halo idiom is the CSS the class carries (paint-order/--bg), pinned
    // alongside the sibling .lane-name/.feed-group-count rules.
  });

  it("carries the text-over-linework halo idiom in CSS", () => {
    // The one-baseline row overlays the entry arrows by construction, so the
    // class carries the paint-order:stroke + --bg halo (as .lane-name does).
    const css = readFileSync("src/ui/app.css", "utf8");
    const rule = css.slice(css.indexOf(".ribbon-endpoint"));
    const block = rule.slice(0, rule.indexOf("}"));
    expect(block).toContain("paint-order: stroke");
    expect(block).toContain("stroke: var(--bg)");
  });

  it("pushes the entry label right past a coincident group token (r2 collision)", () => {
    // Two belts at the head (a coincident group) put a left-anchored token at the
    // head boundary; the head stretch's entry label sits at the SAME boundary, so
    // it pushes right past the token (+20px) rather than overprint it.
    const result = solveStage({
      machineCount: 13,
      clockPercent: F(100),
      capacities: { belt: TIERS.belt.slice(0, 5), pipe: TIERS.pipe },
      feeds: [
        {
          itemId: "feed",
          kind: "belt",
          perMachineRate: F(120),
          overrides: [F(0), F(780)],
        },
      ],
      outputs: [],
    });
    const doc = schematicDoc(result, 13);
    // The head stretch's entry starts at x1 (=laneStart) + 3 + push. Without the
    // token it would be x1+3; the coincident group pushes it to x1+3+20.
    const poly = doc.querySelector("polygon.bus-seg")!;
    const x1 = polyPoints(poly)[0]!.x;
    const entry = [...doc.querySelectorAll(".ribbon-endpoint")].find(
      (e) => e.getAttribute("text-anchor") === "start",
    )!;
    expect(Number(entry.getAttribute("x"))).toBe(x1 + 3 + 20);
    // The token is present at the same boundary (left-anchored at coordinate+4).
    expect(doc.querySelector(".feed-group-count")).not.toBeNull();
  });

  it("suppresses a hand-off label when a group token takes the LEFT candidate at its x2 (r3)", () => {
    // The r3 left-fallback: a coincident group at a non-terminal stretch's END
    // boundary, near the scrolled lane edge, takes the LEFT token candidate
    // (coordinate−32) — the same end-anchored territory the hand-off occupies.
    // Dropping beats pushing (pushing detaches the label from its endpoint); the
    // segment tooltip keeps the hand-off findable. Synthetic so the geometry is
    // exact: the group's boundary EQUALS stretch [1-113]'s x2.
    const result: StageSolveResult = {
      feeds: [
        {
          itemId: "feed",
          kind: "belt",
          perMachineDemand: F(30),
          totalDemand: F(3450),
          belts: [
            {
              index: 0,
              capacity: F(780),
              overridden: false,
              entersAfterMachine: 0,
            },
            {
              index: 1,
              capacity: F(0),
              overridden: true,
              entersAfterMachine: 113,
            },
            {
              index: 2,
              capacity: F(780),
              overridden: false,
              entersAfterMachine: 113,
            },
            {
              index: 3,
              capacity: F(120),
              overridden: false,
              entersAfterMachine: 113,
            },
          ],
          segments: [
            {
              fromMachine: 1,
              toMachine: 113,
              entryFlow: F(780),
              handoffResidue: F(90),
              beltIndex: 0,
            },
            {
              fromMachine: 114,
              toMachine: 115,
              entryFlow: F(990),
              handoffResidue: F(0),
              beltIndex: 2,
            },
          ],
          hardware: { splitters: 115, seamMergers: 1, headCascade: null },
          standingBufferItems: 0,
          findings: [],
        },
      ],
      outputs: [],
      findings: [],
    };
    const doc = schematicDoc(result, 115);
    // The group token took the LEFT candidate (coordinate 928 − 32 = 896).
    const token = doc.querySelector(".feed-group-count")!;
    expect(Number(token.getAttribute("x"))).toBe(896);
    // Stretch [1-113]'s hand-off "90" is SUPPRESSED — only the terminal "0"
    // remains among the end-anchored endpoints.
    const endLabels = [...doc.querySelectorAll(".ribbon-endpoint")]
      .filter((e) => e.getAttribute("text-anchor") === "end")
      .map((e) => e.textContent);
    expect(endLabels).not.toContain("90");
    expect(endLabels).toContain("0");
  });

  it("drops a hand-off label on a stretch too narrow for both glyphs (thinning)", () => {
    // A dense synthetic lane: a 1-machine non-terminal stretch (8px at band
    // pitch) with a positive hand-off cannot hold both "780" and "660" glyphs,
    // so the hand-off drops (entry wins). The tooltip keeps it findable.
    const result: StageSolveResult = {
      feeds: [
        {
          itemId: "feed",
          kind: "belt",
          perMachineDemand: F(120),
          totalDemand: F(15600),
          belts: [
            {
              index: 0,
              capacity: F(780),
              overridden: false,
              entersAfterMachine: 0,
            },
            {
              index: 1,
              capacity: F(780),
              overridden: false,
              entersAfterMachine: 1,
            },
          ],
          segments: [
            {
              fromMachine: 1,
              toMachine: 1,
              entryFlow: F(780),
              handoffResidue: F(660),
              beltIndex: 0,
            },
            {
              fromMachine: 2,
              toMachine: 130,
              entryFlow: F(1440),
              handoffResidue: F(0),
              beltIndex: 1,
            },
          ],
          hardware: { splitters: 130, seamMergers: 1, headCascade: null },
          standingBufferItems: 0,
          findings: [],
        },
      ],
      outputs: [],
      findings: [],
    };
    const doc = schematicDoc(result, 130);
    const endLabels = [...doc.querySelectorAll(".ribbon-endpoint")]
      .filter((e) => e.getAttribute("text-anchor") === "end")
      .map((e) => e.textContent);
    expect(endLabels).not.toContain("660"); // thinned
    expect(endLabels).toContain("0"); // terminal survives
  });
});

describe("P2 AC1 — the 8411 (106-refinery) case", () => {
  it("draws 17 tapering stretches, eight hand-off '60', a terminal '0', no feed lines", () => {
    const result = solveStage({
      machineCount: 106,
      clockPercent: F(100),
      capacities: { belt: TIERS.belt.slice(0, 5), pipe: TIERS.pipe },
      feeds: [{ itemId: "limestone", kind: "belt", perMachineRate: F(120) }],
      outputs: [],
    });
    const doc = schematicDoc(result, 106);
    expect(doc.querySelectorAll("polygon.bus-seg")).toHaveLength(17);
    expect(doc.querySelector("line.bus-seg")).toBeNull(); // no constant-width feed lines
    const ends = [...doc.querySelectorAll(".ribbon-endpoint")].filter(
      (e) => e.getAttribute("text-anchor") === "end",
    );
    expect(ends.filter((e) => e.textContent === "60")).toHaveLength(8);
    expect(ends.filter((e) => e.textContent === "0")).toHaveLength(1);
  });
});

describe("P2 D4 — pipe feed connector", () => {
  function pipeResult(overrides?: (Fraction | null)[]): StageSolveResult {
    return solveStage({
      machineCount: 4,
      clockPercent: F(100),
      capacities: { belt: TIERS.belt.slice(0, 5), pipe: TIERS.pipe },
      feeds: [
        { itemId: "water", kind: "pipe", perMachineRate: F(100), overrides },
      ],
      outputs: [],
    });
  }

  it("draws a neutral connector, no polygon, no endpoint text, with the ceiling tooltip", () => {
    const doc = schematicDoc(pipeResult(), 4);
    const connector = doc.querySelector(".pipe-manifold");
    expect(connector).not.toBeNull();
    expect(doc.querySelector("polygon.bus-seg")).toBeNull();
    expect(doc.querySelector(".ribbon-endpoint")).toBeNull();
    // The connector composes the lane-pipe dashed treatment.
    expect(connector!.classList.contains("lane-pipe")).toBe(true);
  });

  it("carries the nominal-pipe-ceiling tooltip copy", () => {
    // The connector's tooltip is carried by the hover handler (the Stage-5
    // tooltip design — no <title> markup), so its exact string is owned by
    // pipeConnectorTooltip and pinned there. demand D = 4×100 = 400; supplied is
    // the summed run capacity.
    const result = pipeResult();
    const lane = result.feeds[0]!;
    const supplied = lane.belts.reduce(
      (sum, belt) => sum.add(belt.capacity),
      F(0),
    );
    expect(pipeConnectorTooltip(lane.totalDemand, supplied)).toBe(
      `total demand 400/min · supplied ${supplied.toString()}/min (nominal pipe ceiling)`,
    );
    expect(pipeConnectorTooltip(lane.totalDemand, supplied)).toContain(
      "nominal pipe ceiling",
    );
  });

  it("colours the connector via segmentErrored when the lane is under-supplied", () => {
    // Force a single 300 run for a 400 demand → lane-undersupplied.
    const result = pipeResult([F(300)]);
    expect(
      result.feeds[0]!.findings.some((f) => f.type === "lane-undersupplied"),
    ).toBe(true);
    const doc = schematicDoc(result, 4);
    const connector = doc.querySelector(".pipe-manifold")!;
    expect(connector.classList.contains("seg-error")).toBe(true);
  });
});

describe("P2 D5 — summary card lines (null-guarded)", () => {
  it("renders the hardware, buffer, spare, and cascade lines for a belt feed lane", () => {
    // The michael 106 case: 106 splitters · 8 seam mergers · head cascade + a
    // standing buffer + a terminal spare (270 cap tail, 30 surplus).
    const result = solveStage({
      machineCount: 106,
      clockPercent: F(100),
      capacities: { belt: TIERS.belt.slice(0, 5), pipe: TIERS.pipe },
      feeds: [{ itemId: "limestone", kind: "belt", perMachineRate: F(120) }],
      outputs: [{ itemId: "cement", kind: "belt", perMachineRate: F(120) }],
    });
    const html = renderToStaticMarkup(
      <SummaryCards result={result} itemName={itemName} powerText={null} />,
    );
    expect(html).toContain("106 splitters · 8 seam mergers");
    expect(html).toContain("head cascade: 8 junctions / 3 tiers");
    expect(html).toContain("standing buffer:");
    expect(html).toContain("spare belt capacity: 30/min");
    // The output card gains a collection-cascade suffix (b > 1 break-outs).
    expect(html).toContain("collection cascade:");
  });

  it("adds nothing new to a pipe feed card", () => {
    const result = solveStage({
      machineCount: 4,
      clockPercent: F(100),
      capacities: { belt: TIERS.belt.slice(0, 5), pipe: TIERS.pipe },
      feeds: [{ itemId: "water", kind: "pipe", perMachineRate: F(100) }],
      outputs: [],
    });
    const html = renderToStaticMarkup(
      <SummaryCards result={result} itemName={itemName} powerText={null} />,
    );
    expect(html).not.toContain("splitters");
    expect(html).not.toContain("standing buffer");
    expect(html).not.toContain("spare belt capacity");
  });
});

describe("P2 D6 — legend conventions", () => {
  it("names the ribbon, seam, and pipe conventions", () => {
    const html = renderToStaticMarkup(<Legend tiers={TIERS} />);
    expect(html).toContain("trunk carry (thins as machines draw)");
    expect(html).toContain("belt seam (merger)");
    expect(html).toContain("pipe manifold (unordered)");
  });
});
