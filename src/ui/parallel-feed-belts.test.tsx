/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { Fraction } from "../core/fraction.ts";
import { solveStage, type StageSolveResult } from "../core/manifold.ts";
import type { TierTable } from "../data/types.ts";
import { TIER_COLORS } from "./colors.ts";
import { Blueprint } from "./Blueprint.tsx";
import { LaneOverrides } from "./LaneOverrides.tsx";
import { Schematic } from "./Schematic.tsx";
import { SummaryCards } from "./SummaryCards.tsx";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const F = (n: number) => Fraction.from(n);
const TIERS: TierTable = {
  belt: [60, 120, 270, 480, 780, 1200].map(F),
  pipe: [300, 600].map(F),
};
const UNLOCKED_MK5 = { belt: 5, pipe: 2 };
const itemName = (id: string) => id;

function michaelResult(): StageSolveResult {
  return solveStage({
    machineCount: 106,
    clockPercent: F(100),
    capacities: { belt: TIERS.belt.slice(0, 5), pipe: TIERS.pipe },
    feeds: [
      {
        itemId: "limestone",
        kind: "belt",
        perMachineRate: F(120),
      },
    ],
    outputs: [],
  });
}

function minimalParallelResult(machineCount: number): StageSolveResult {
  return {
    feeds: [
      {
        itemId: "test-feed",
        kind: "belt",
        perMachineDemand: F(1),
        totalDemand: F(machineCount),
        belts: [
          {
            index: 0,
            capacity: F(780),
            overridden: false,
            entersAfterMachine: 0,
          },
        ],
        segments: [
          {
            fromMachine: 1,
            toMachine: 1,
            peakFlow: F(781),
            beltIndex: 0,
            parallelCount: 2,
          },
        ],
        findings: [],
      },
    ],
    outputs: [],
    findings: [],
  };
}

describe("parallel feed-bus summary", () => {
  it("keeps physical inlet count and presents Mk6 as an optional one-line alternative", () => {
    const html = renderToStaticMarkup(
      <SummaryCards
        result={michaelResult()}
        itemName={itemName}
        powerText={null}
        tiers={TIERS}
        unlocked={UNLOCKED_MK5}
      />,
    );

    expect(html).toContain(
      "17 × belt · bus up to 2 parallel · Mk6 supports one bus line",
    );
    expect(html).not.toContain("unlocking Mk6");
  });

  it("keeps the existing terse count for an all-single-line lane", () => {
    const result = solveStage({
      machineCount: 2,
      clockPercent: F(100),
      capacities: { belt: TIERS.belt.slice(0, 5), pipe: TIERS.pipe },
      feeds: [{ itemId: "ore", kind: "belt", perMachineRate: F(30) }],
      outputs: [],
    });
    const html = renderToStaticMarkup(
      <SummaryCards
        result={result}
        itemName={itemName}
        powerText={null}
        tiers={TIERS}
        unlocked={UNLOCKED_MK5}
      />,
    );

    expect(html).toContain("1 × belt");
    expect(html).not.toContain("bus up to");
  });
});

describe("parallel feed-bus schematic", () => {
  it("renders Michael's eight Mk5 x2 spans as two rails with optional Mk6 detail", () => {
    const html = renderToStaticMarkup(
      <Schematic
        result={michaelResult()}
        machineCount={106}
        tiers={TIERS}
        unlocked={UNLOCKED_MK5}
        itemName={itemName}
      />,
    );

    expect((html.match(/class="parallel-segment/g) ?? []).length).toBe(8);
    expect((html.match(/class="parallel-rail/g) ?? []).length).toBe(16);
    expect((html.match(/class="parallel-run-label"/g) ?? []).length).toBe(8);
    expect(html).toContain("2 parallel lines × 780/min · Mk6: 1 line");
    expect(html).not.toContain("<title>");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const rails = doc.querySelectorAll(
      "[data-parallel-segment] .parallel-rail",
    );
    expect(
      Number(rails[1]!.getAttribute("y1")) -
        Number(rails[0]!.getAttribute("y1")),
    ).toBe(8);
  });

  it("uses Mk5 bus rails for the N=87 remainder span while keeping its Mk3 inlet arrow", () => {
    const result = solveStage({
      machineCount: 87,
      clockPercent: F(100),
      capacities: { belt: TIERS.belt.slice(0, 5), pipe: TIERS.pipe },
      feeds: [{ itemId: "dense", kind: "belt", perMachineRate: F(638) }],
      outputs: [],
    });
    const html = renderToStaticMarkup(
      <Schematic
        result={result}
        machineCount={87}
        tiers={TIERS}
        unlocked={UNLOCKED_MK5}
        itemName={itemName}
      />,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const final = doc.querySelector('[data-parallel-segment="87-87"]');
    expect(final).not.toBeNull();
    expect(final!.getAttribute("aria-label")).toContain("peak 782/min");
    expect(
      [...final!.querySelectorAll(".parallel-rail")].every(
        (rail) => rail.getAttribute("stroke") === TIER_COLORS.belt[4],
      ),
    ).toBe(true);
    const remainderArrow = doc.querySelector('[data-feed-index="71"]');
    expect(remainderArrow?.getAttribute("stroke")).toBe(TIER_COLORS.belt[2]);
  });

  it("renders an over-tier pipe as a single errored dashed line - pipes never bundle (#145)", () => {
    const starvingPipe = solveStage({
      machineCount: 3,
      clockPercent: F(100),
      capacities: { belt: TIERS.belt.slice(0, 5), pipe: TIERS.pipe },
      feeds: [
        {
          itemId: "water",
          kind: "pipe",
          perMachineRate: F(350),
          overrides: [F(1), F(600)],
        },
      ],
      outputs: [],
    });
    const pipeHtml = renderToStaticMarkup(
      <Schematic
        result={starvingPipe}
        machineCount={3}
        tiers={TIERS}
        unlocked={UNLOCKED_MK5}
        itemName={itemName}
      />,
    );
    expect(pipeHtml).toContain("bus-seg seg-error lane-pipe");
    expect(pipeHtml).not.toContain("parallel-rail");

    const shortHtml = renderToStaticMarkup(
      <Schematic
        result={minimalParallelResult(115)}
        machineCount={115}
        tiers={TIERS}
        unlocked={UNLOCKED_MK5}
        itemName={itemName}
      />,
    );
    expect(shortHtml).toContain('data-parallel-segment="1-1"');
    expect(shortHtml).not.toContain("parallel-run-label");
  });

  it("keeps an oversized override as one errored slot, arrow, and table row", () => {
    const result = solveStage({
      machineCount: 8,
      clockPercent: F(100),
      capacities: { belt: TIERS.belt.slice(0, 3), pipe: TIERS.pipe },
      feeds: [
        {
          itemId: "ore",
          kind: "belt",
          perMachineRate: F(30),
          overrides: [F(480)],
        },
      ],
      outputs: [],
    });
    const schematic = renderToStaticMarkup(
      <Schematic
        result={result}
        machineCount={8}
        tiers={TIERS}
        unlocked={{ belt: 3, pipe: 2 }}
        itemName={itemName}
      />,
    );
    expect(schematic).not.toContain("parallel-segment");
    expect(schematic).toContain('class="bus-seg seg-error"');
    expect(schematic).toContain(
      `data-feed-index="0" x1="24" x2="24" y1="32" y2="64" stroke="${TIER_COLORS.belt[3]}"`,
    );

    const table = renderToStaticMarkup(
      <LaneOverrides
        result={result}
        overrides={{ feeds: { ore: ["480"] }, outputs: {} }}
        itemName={itemName}
        onOverride={() => {}}
      />,
    );
    expect(table).toContain("Feed 1 · 480/min · enters at head");
    expect(table).toContain('value="480"');
  });

  it("skips a locked tier that still needs two lines", () => {
    const tiers: TierTable = {
      belt: [60, 120, 270, 480, 600, 800].map(F),
      pipe: TIERS.pipe,
    };
    const result = solveStage({
      machineCount: 20,
      clockPercent: F(100),
      capacities: { belt: tiers.belt.slice(0, 4), pipe: tiers.pipe },
      feeds: [{ itemId: "ore", kind: "belt", perMachineRate: F(250) }],
      outputs: [],
    });
    const html = renderToStaticMarkup(
      <Schematic
        result={result}
        machineCount={20}
        tiers={tiers}
        unlocked={{ belt: 4, pipe: 2 }}
        itemName={itemName}
      />,
    );

    const doc = new DOMParser().parseFromString(html, "text/html");
    const highPeak = doc.querySelector('[data-parallel-segment="2-3"]');
    expect(highPeak?.getAttribute("aria-label")).toContain("Mk6: 1 line");
    expect(highPeak?.getAttribute("aria-label")).not.toContain("Mk5: 1 line");
    expect(doc.querySelectorAll(".parallel-run-label")).toHaveLength(1);
  });

  it("shows the one custom tooltip on focus beside the glyph and hides it on blur", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root: Root = createRoot(host);
    act(() => {
      root.render(
        <Schematic
          result={michaelResult()}
          machineCount={106}
          tiers={TIERS}
          unlocked={UNLOCKED_MK5}
          itemName={itemName}
        />,
      );
    });
    const container = host.querySelector(".schematic")!;
    const glyph = host.querySelector<SVGGElement>("[data-parallel-segment]")!;
    Object.defineProperty(container, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 10,
        top: 5,
        right: 510,
        bottom: 305,
        width: 500,
        height: 300,
        x: 10,
        y: 5,
        toJSON: () => {},
      }),
    });
    Object.defineProperty(glyph, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 60,
        top: 20,
        right: 120,
        bottom: 28,
        width: 60,
        height: 8,
        x: 60,
        y: 20,
        toJSON: () => {},
      }),
    });

    expect(glyph.getAttribute("role")).toBe("img");
    expect(glyph.getAttribute("tabindex")).toBe("0");
    expect(glyph.getAttribute("aria-label")).toContain(
      "2 parallel lines × 780/min",
    );
    act(() =>
      glyph.dispatchEvent(new FocusEvent("focusin", { bubbles: true })),
    );
    const tooltip = host.querySelector<HTMLElement>(".tooltip")!;
    expect(tooltip.textContent).toBe(glyph.getAttribute("aria-label"));
    expect(tooltip.style.left).toBe("122px");
    expect(tooltip.style.top).toBe("27px");
    expect(tooltip.style.maxWidth).toBe("280px");
    act(() =>
      glyph.dispatchEvent(new FocusEvent("focusout", { bubbles: true })),
    );
    expect(host.querySelector(".tooltip")).toBeNull();

    container.scrollLeft = 400;
    Object.defineProperty(glyph, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 440,
        top: 20,
        right: 500,
        bottom: 28,
        width: 60,
        height: 8,
        x: 440,
        y: 20,
        toJSON: () => {},
      }),
    });
    act(() =>
      glyph.dispatchEvent(new FocusEvent("focusin", { bubbles: true })),
    );
    const scrolledTooltip = host.querySelector<HTMLElement>(".tooltip")!;
    expect(scrolledTooltip.style.left).toBe("612px");
    expect(scrolledTooltip.style.maxWidth).toBe("280px");
    expect(scrolledTooltip.textContent).toBe(glyph.getAttribute("aria-label"));

    act(() => root.unmount());
    host.remove();
  });
});

describe("parallel feed-bus blueprint", () => {
  it("shows x2 max without changing Michael's 17 inlet marks", () => {
    const html = renderToStaticMarkup(
      <Blueprint
        solve={michaelResult()}
        machineId="oil_refinery"
        machineCount={106}
        feedLabels={["Limestone"]}
        outputLabels={[]}
      />,
    );

    expect(html).toContain(">x2 max</text>");
    expect((html.match(/bp-mark-glyph/g) ?? []).length).toBe(17);
    expect(html.indexOf('class="bp-parallel-max"')).toBeGreaterThan(
      html.lastIndexOf('class="bp-junction"'),
    );
  });

  it("suppresses x2 max when its fixed label does not fit the bus extent", () => {
    const html = renderToStaticMarkup(
      <Blueprint
        solve={minimalParallelResult(1)}
        machineId="smelter_mk1"
        machineCount={1}
        feedLabels={["Test"]}
        outputLabels={[]}
      />,
    );

    expect(html).not.toContain("x2 max");
  });
});

afterEach(() => {
  document.body.replaceChildren();
});
