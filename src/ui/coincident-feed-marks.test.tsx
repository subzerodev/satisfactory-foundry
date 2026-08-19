/**
 * @vitest-environment jsdom
 */
/// <reference types="node" />

import { act } from "react";
import { readFileSync } from "node:fs";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { Fraction } from "../core/fraction.ts";
import { solveStage, type FeedBelt } from "../core/manifold.ts";
import type { TierTable } from "../data/types.ts";
import { FOOTPRINTS } from "../layout/footprints.ts";
import { layoutStage } from "../layout/layout.ts";
import { Blueprint } from "./Blueprint.tsx";
import {
  feedCountToken,
  groupCoincidentMarks,
  placeGroupTokens,
} from "./coincident-feed-marks.ts";
import { feedGroupLabel } from "./format.ts";
import { computeLayout } from "./layout.ts";
import { Schematic } from "./Schematic.tsx";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const F = (value: number) => Fraction.from(value);
const TIERS: TierTable = {
  belt: [60, 120, 270, 480, 780, 1200].map(F),
  pipe: [300, 600].map(F),
};
const UNLOCKED = { belt: 4, pipe: 2 };

function solveFeed(
  machineCount: number,
  perMachineRate: number,
  overrides?: (Fraction | null)[],
  kind: "belt" | "pipe" = "belt",
) {
  return solveStage({
    machineCount,
    clockPercent: F(100),
    capacities: {
      belt: TIERS.belt.slice(0, UNLOCKED.belt),
      pipe: TIERS.pipe,
    },
    feeds: [
      { itemId: "feed", kind, perMachineRate: F(perMachineRate), overrides },
    ],
    outputs: [],
  });
}

function schematicDocument(
  result: ReturnType<typeof solveStage>,
  machineCount: number,
) {
  return new DOMParser().parseFromString(
    renderToStaticMarkup(
      <Schematic
        result={result}
        machineCount={machineCount}
        tiers={TIERS}
        unlocked={UNLOCKED}
        itemName={(id) => id}
      />,
    ),
    "text/html",
  );
}

function blueprintDocument(
  result: ReturnType<typeof solveStage>,
  machineCount: number,
) {
  return new DOMParser().parseFromString(
    renderToStaticMarkup(
      <Blueprint
        solve={result}
        machineId="smelter_mk1"
        machineCount={machineCount}
        feedLabels={result.feeds.map((lane) => lane.itemId)}
        outputLabels={result.outputs.map((lane) => lane.itemId)}
      />,
    ),
    "text/html",
  );
}

describe("coincident feed mark helpers", () => {
  it("groups exact coordinates stably without mutating input", () => {
    const marks = [
      { id: "a", x: 4 },
      { id: "b", x: 2 },
      { id: "c", x: 4 },
      { id: "d", x: 2 },
      { id: "e", x: 7 },
    ];
    const before = structuredClone(marks);

    const groups = groupCoincidentMarks(marks, (mark) => mark.x);

    expect(groups.map((group) => group.coordinate)).toEqual([4, 2, 7]);
    expect(groups.map((group) => group.members.map((mark) => mark.id))).toEqual(
      [["a", "c"], ["b", "d"], ["e"]],
    );
    expect(marks).toEqual(before);
  });

  it("places right, falls back left, and suppresses blocked tokens", () => {
    const right = placeGroupTokens(
      [{ coordinate: 20, members: [1, 2] }],
      0,
      100,
    );
    const left = placeGroupTokens(
      [{ coordinate: 95, members: [1, 2] }],
      0,
      100,
    );
    const blocked = placeGroupTokens(
      [
        { coordinate: 20, members: [1, 2] },
        { coordinate: 28, members: [3] },
      ],
      0,
      100,
    );

    expect(right.get(20)).toBe(24);
    expect(left.get(95)).toBe(63);
    expect(blocked.has(20)).toBe(false);
  });

  it("reserves earlier token intervals against a facing group", () => {
    const placements = placeGroupTokens(
      [
        { coordinate: 904, members: [1, 2] },
        { coordinate: 944, members: [3, 4, 5, 6, 7] },
      ],
      24,
      944,
    );

    expect(placements.get(904)).toBe(908);
    expect(placements.has(944)).toBe(false);
  });

  it("uses a four-character maximum count token", () => {
    expect(feedCountToken(2)).toBe("x2");
    expect(feedCountToken(99)).toBe("x99");
    expect(feedCountToken(100)).toBe("x99+");
  });
});

describe("feed group formatting", () => {
  it("reports exact range, count, total, and head boundary", () => {
    const belts: FeedBelt[] = [
      { index: 0, capacity: F(0), overridden: true, entersAfterMachine: 0 },
      { index: 1, capacity: F(120), overridden: false, entersAfterMachine: 0 },
    ];

    expect(feedGroupLabel(belts)).toBe(
      "Feeds 1-2 - 2 slots - 120/min total capacity - enter at head",
    );
  });

  it("reports an exact clamped-tail aggregate", () => {
    const result = solveFeed(60, 30, [F(1800)]);
    const tail = result.feeds[0]!.belts.slice(1);

    expect(
      result.feeds[0]!.belts.map((belt) => belt.entersAfterMachine),
    ).toEqual([0, 60, 60, 60]);
    expect(feedGroupLabel(tail)).toBe(
      "Feeds 2-4 - 3 slots - 1440/min total capacity - enter after machine 60",
    );
    expect(feedGroupLabel(tail)).not.toContain("Feeds 4-4");
    expect(feedGroupLabel(tail)).not.toContain("480/min total capacity");
  });
});

describe("coincident feed rendering", () => {
  it("groups a zero-followed-by-auto head in both views without changing raw marks", () => {
    const result = solveFeed(20, 30, [F(0), null]);
    expect(
      result.feeds[0]!.belts.map((belt) => belt.capacity.toString()),
    ).toEqual(["0", "120"]);
    expect(
      result.feeds[0]!.belts.map((belt) => belt.entersAfterMachine),
    ).toEqual([0, 0]);

    const schematic = schematicDocument(result, 20);
    const schematicGroup = schematic.querySelector(".feed-mark-group");
    expect(schematic.querySelectorAll(".lane-feed .belt-arrow")).toHaveLength(
      0,
    );
    expect(schematic.querySelectorAll(".feed-mark-group")).toHaveLength(1);
    expect(schematicGroup?.getAttribute("aria-label")).toBe(
      "Feeds 1-2 - 2 slots - 120/min total capacity - enter at head",
    );
    expect(schematicGroup?.textContent).toBe("x2");
    expect(schematic.querySelector("title")).toBeNull();

    const rawBlueprint = layoutStage(result, "smelter_mk1", 20, FOOTPRINTS);
    expect(rawBlueprint.feedLanes[0]!.marks).toHaveLength(2);
    const blueprint = blueprintDocument(result, 20);
    expect(blueprint.querySelectorAll(".bp-feed-mark-group")).toHaveLength(1);
    expect(blueprint.querySelectorAll(".bp-marks .bp-mark-glyph")).toHaveLength(
      1,
    );
    const blueprintGroup = blueprint.querySelector(".bp-feed-mark-group");
    expect(blueprintGroup?.textContent).toBe("x2");
    expect(blueprintGroup?.getAttribute("aria-label")).toBe(
      schematicGroup?.getAttribute("aria-label"),
    );
    expect(result.feeds[0]!.belts).toHaveLength(2);
  });

  it("groups a clamped tail in both views while preserving all raw marks", () => {
    const result = solveFeed(60, 30, [F(1800)]);
    const expected =
      "Feeds 2-4 - 3 slots - 1440/min total capacity - enter after machine 60";
    const schematicLayout = computeLayout(result, 60);
    const blueprintLayout = layoutStage(result, "smelter_mk1", 60, FOOTPRINTS);

    expect(schematicLayout.feeds[0]!.belts).toHaveLength(4);
    expect(blueprintLayout.feedLanes[0]!.marks).toHaveLength(4);

    const schematic = schematicDocument(result, 60);
    const schematicGroup = schematic.querySelector(
      '.feed-mark-group[data-feed-indices="1,2,3"]',
    );
    expect(schematicGroup?.getAttribute("aria-label")).toBe(expected);
    expect(schematicGroup?.textContent).toBe("x3");
    expect(schematic.querySelectorAll(".lane-feed .belt-arrow")).toHaveLength(
      1,
    );

    const blueprint = blueprintDocument(result, 60);
    const blueprintGroup = blueprint.querySelector(
      '.bp-feed-mark-group[data-feed-indices="1,2,3"]',
    );
    expect(blueprintGroup?.getAttribute("aria-label")).toBe(expected);
    expect(blueprintGroup?.textContent).toBe("x3");
    expect(blueprint.querySelectorAll(".bp-marks .bp-mark-glyph")).toHaveLength(
      2,
    );
  });

  it("keeps a Blueprint head token clear of the next singleton label", () => {
    const result = solveFeed(5, 250, [F(0), null, null]);
    expect(
      result.feeds[0]!.belts.map((belt) => belt.entersAfterMachine),
    ).toEqual([0, 0, 1]);
    expect(
      result.feeds[0]!.belts.map((belt) => belt.capacity.toString()),
    ).toEqual(["0", "480", "480"]);

    const blueprint = blueprintDocument(result, 5);
    const group = blueprint.querySelector(".bp-feed-mark-group");
    const token = group?.querySelector(".bp-feed-group-count");
    const singletonLabel = blueprint.querySelector(
      ".bp-marks > .bp-mark-label",
    );
    expect(group?.getAttribute("aria-label")).toContain(
      "480/min total capacity",
    );
    expect(token?.getAttribute("x")).toBe("12");
    expect(singletonLabel?.getAttribute("x")).toBe("72");
    expect((token?.textContent ?? "").length).toBeLessThanOrEqual(4);
  });

  it("suppresses a dense Schematic token but keeps its glyph and exact semantics", () => {
    const result = solveFeed(115, 480, [F(0), null]);
    const schematic = schematicDocument(result, 115);
    const group = schematic.querySelector(
      '.feed-mark-group[data-feed-indices="0,1"]',
    );
    const adjacent = schematic.querySelector(
      '.belt-arrow[data-feed-index="2"]',
    );

    expect(group?.querySelectorAll(".feed-group-stem")).toHaveLength(2);
    expect(group?.querySelector(".feed-group-count")).toBeNull();
    expect(group?.getAttribute("aria-label")).toBe(
      "Feeds 1-2 - 2 slots - 480/min total capacity - enter at head",
    );
    // Belt 2 enters at machine 1 → boundaryX(1) = marginX + 1·pitch. Re-derived
    // for the #154 24px floor: 24 + 24 = 48 (was 32 at the old 8px pitch).
    expect(adjacent?.getAttribute("x1")).toBe("48");
  });

  it("prevents inward-facing Schematic group tokens from overlapping", () => {
    // Re-derived for the #154 24px floor: the old fixture put the two groups at
    // machines 110 and 115 — 40px apart at the retired 8px pitch, so their
    // inward-facing tokens collided. At 24px that gap widens to 120px and both
    // fit, dissolving the collision the test exists to pin. This fixture places
    // the groups at machines 113 and 115 (48px at pitch 24), so the inward
    // tokens overlap again and the near-edge group is suppressed — the same
    // behaviour, re-forced under the new pitch (not a blind literal swap).
    const result = solveFeed(115, 30, [
      F(3390),
      F(0),
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(
      result.feeds[0]!.belts.map((belt) => belt.entersAfterMachine),
    ).toEqual([0, 113, 113, 115, 115, 115, 115, 115]);

    const schematic = schematicDocument(result, 115);
    const groups = [...schematic.querySelectorAll(".feed-mark-group")];
    const visibleTokens = groups
      .map((group) => group.querySelector(".feed-group-count"))
      .filter((token): token is Element => token !== null);
    expect(groups).toHaveLength(2);
    expect(visibleTokens).toHaveLength(1);
    // The surviving token is group [1,2]'s, right-anchored at boundaryX(113)+4 =
    // 24 + 113·24 + 4 = 2740.
    expect(visibleTokens[0]?.getAttribute("x")).toBe("2740");
    expect(visibleTokens[0]?.textContent).toBe("x2");
    expect(groups[1]?.querySelector(".feed-group-count")).toBeNull();
  });

  it("keeps separated feed marks and output mark markup unchanged", () => {
    const result = solveStage({
      machineCount: 20,
      clockPercent: F(100),
      capacities: { belt: TIERS.belt.slice(0, 4), pipe: TIERS.pipe },
      feeds: [{ itemId: "ore", kind: "belt", perMachineRate: F(30) }],
      outputs: [{ itemId: "ingot", kind: "belt", perMachineRate: F(30) }],
    });
    const html = renderToStaticMarkup(
      <Schematic
        result={result}
        machineCount={20}
        tiers={TIERS}
        unlocked={UNLOCKED}
        itemName={(id) => id}
      />,
    );

    expect(html).not.toContain("feed-mark-group");
    expect((html.match(/class="belt-arrow"/g) ?? []).length).toBe(
      result.feeds[0]!.belts.length + result.outputs[0]!.breakouts.length,
    );
    expect(html).toContain('data-feed-index="0"');

    const blueprint = blueprintDocument(result, 20);
    expect(blueprint.querySelector(".bp-feed-mark-group")).toBeNull();
    const markLanes = blueprint.querySelectorAll(".bp-marks");
    expect(markLanes[0]?.querySelectorAll(".bp-mark-glyph")).toHaveLength(
      result.feeds[0]!.belts.length,
    );
    expect(markLanes[1]?.querySelectorAll(".bp-mark-glyph")).toHaveLength(
      result.outputs[0]!.breakouts.length,
    );
    expect(markLanes[1]?.textContent).toContain("/min load");
  });

  it("keeps a grouped pipe dashed and exposes the existing focus tooltip", () => {
    const result = solveFeed(4, 300, [F(0), null], "pipe");
    const host = document.createElement("div");
    document.body.append(host);
    const root: Root = createRoot(host);
    act(() => {
      root.render(
        <Schematic
          result={result}
          machineCount={4}
          tiers={TIERS}
          unlocked={UNLOCKED}
          itemName={(id) => id}
        />,
      );
    });

    const container = host.querySelector<HTMLElement>(".schematic")!;
    const group = host.querySelector<SVGGElement>(".feed-mark-group")!;
    Object.defineProperty(container, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        right: 500,
        bottom: 300,
        width: 500,
        height: 300,
      }),
    });
    Object.defineProperty(group, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 20,
        top: 20,
        right: 28,
        bottom: 60,
        width: 8,
        height: 40,
      }),
    });

    expect(group.querySelectorAll(".feed-group-stem.lane-pipe")).toHaveLength(
      2,
    );
    expect(group.getAttribute("tabindex")).toBe("0");
    act(() =>
      group.dispatchEvent(new FocusEvent("focusin", { bubbles: true })),
    );
    const tooltip = host.querySelector<HTMLElement>(".tooltip");
    expect(tooltip?.textContent).toBe(group.getAttribute("aria-label"));
    expect(tooltip?.style.left).toBe("40px");
    expect(tooltip?.style.top).toBe("32px");
    act(() =>
      group.dispatchEvent(new FocusEvent("focusout", { bubbles: true })),
    );
    expect(host.querySelector(".tooltip")).toBeNull();

    act(() => root.unmount());
    host.remove();
  });

  it("pins keyboard focus treatment for grouped marks in both views", () => {
    const appCss = readFileSync("src/ui/app.css", "utf8");
    expect(appCss).toMatch(
      /\.feed-mark-group:focus-visible\s+\.feed-group-stem/,
    );
    expect(appCss).toMatch(
      /\.bp-feed-mark-group:focus-visible\s+\.bp-mark-glyph/,
    );
  });
});

afterEach(() => {
  document.body.replaceChildren();
});
