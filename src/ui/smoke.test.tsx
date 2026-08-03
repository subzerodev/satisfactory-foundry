import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Fraction } from "../core/fraction.ts";
import type { Finding, StageSolveResult } from "../core/manifold.ts";
import type { CatalogRecipe, CatalogMachine } from "../data/types.ts";
import type { Selection, SolveState } from "../state/store.ts";
import { solveStage } from "../core/manifold.ts";
import { TIER_TABLE } from "../data/tiers.ts";
import { FIXTURE_TIERS, WORKED_INPUT, workedResult } from "./fixtures.ts";
import { UploadScreen } from "./UploadScreen.tsx";
import { ControlsStrip } from "./ControlsStrip.tsx";
import { SummaryCards } from "./SummaryCards.tsx";
import { Schematic } from "./Schematic.tsx";
import { LaneOverrides } from "./LaneOverrides.tsx";
import { FindingsPanel } from "./FindingsPanel.tsx";
import { Legend } from "./Legend.tsx";

const noop = () => {};
const itemName = (id: string) =>
  id === "ore_iron" ? "Iron Ore" : id === "iron_ingot" ? "Iron Ingot" : id;

function defaultSelection(): Selection {
  return {
    recipeId: null,
    machineCount: 20,
    clockPercentText: "100",
    unlockedTiers: { belt: 4, pipe: 2 },
    overrides: { feeds: {}, outputs: {} },
  };
}

describe("UploadScreen", () => {
  it("renders the empty first-boot prompt", () => {
    const html = renderToStaticMarkup(
      <UploadScreen reason="empty" onUpload={noop} />,
    );
    expect(html).toContain('type="file"');
    expect(html).toContain("Docs.json");
  });

  it("renders the generic stale re-upload prompt", () => {
    const html = renderToStaticMarkup(
      <UploadScreen reason="stale" onUpload={noop} />,
    );
    // renderToStaticMarkup entity-escapes the apostrophe (&#x27;); assert the
    // copy around it so the pinned generic-stale wording still gates.
    expect(html).toContain("Your cached catalog couldn");
    expect(html).toContain("be loaded — please re-upload Docs.json.");
  });

  it("renders the upload-error message", () => {
    const html = renderToStaticMarkup(
      <UploadScreen
        reason="upload-error"
        message="Unexpected token in JSON at position 0"
        onUpload={noop}
      />,
    );
    expect(html).toContain("Unexpected token in JSON at position 0");
  });
});

describe("ControlsStrip", () => {
  const machines: Record<string, CatalogMachine> = {
    smelter: { id: "smelter", displayName: "Smelter" },
  };
  const recipes: CatalogRecipe[] = [
    {
      id: "alt_ingot",
      displayName: "Iron Ingot",
      machineId: "smelter",
      isAlternate: true,
      inputs: [],
      outputs: [],
      primaryOutputId: "iron_ingot",
    },
    {
      id: "ingot",
      displayName: "Basic Ingot",
      machineId: "smelter",
      isAlternate: false,
      inputs: [],
      outputs: [],
      primaryOutputId: "iron_ingot",
    },
  ];

  it("sorts options by displayName, suffixes alternates, marks active tiers", () => {
    const html = renderToStaticMarkup(
      <ControlsStrip
        recipes={recipes}
        machines={machines}
        selection={{
          ...defaultSelection(),
          unlockedTiers: { belt: 2, pipe: 1 },
        }}
        hasOverrides={false}
        onSelectRecipe={noop}
        onMachineCount={noop}
        onClockText={noop}
        onTiers={noop}
        onClearOverrides={noop}
      />,
    );
    // Sorted: "Basic Ingot" precedes "Iron Ingot (alt)".
    expect(html.indexOf("Basic Ingot")).toBeLessThan(
      html.indexOf("Iron Ingot (alt)"),
    );
    expect(html).toContain("Iron Ingot (alt)");
    expect(html).toContain("— pick a recipe —");
  });
});

describe("SummaryCards", () => {
  it("renders per-lane rates and counts as exact strings", () => {
    const html = renderToStaticMarkup(
      <SummaryCards result={workedResult()} itemName={itemName} />,
    );
    expect(html).toContain("600/min in");
    expect(html).toContain("600/min out");
    expect(html).toContain("2 × belt");
  });
});

describe("Schematic", () => {
  it("renders the worked example: rects, mockup label, tooltip form", () => {
    const html = renderToStaticMarkup(
      <Schematic
        result={workedResult()}
        machineCount={20}
        tiers={FIXTURE_TIERS}
        unlocked={{ belt: 4, pipe: 2 }}
        itemName={itemName}
      />,
    );
    expect((html.match(/<rect/g) ?? []).length).toBeGreaterThanOrEqual(20);
    expect(html).toContain("Feed 2 — Mk2 · 120/min · enters after machine 16");
    expect(html).toContain("peak 480/min of 480/min");
  });

  it("titles a segment with its honest peakFlow, not the belt's capacity", () => {
    // N=17: the last output breakout carries 30/min on a Mk1 (60/min) belt —
    // the tooltip must say peak 30, not 60 (boundary review r1 catch).
    const result = solveStage({ ...WORKED_INPUT, machineCount: 17 });
    const html = renderToStaticMarkup(
      <Schematic
        result={result}
        machineCount={17}
        tiers={FIXTURE_TIERS}
        unlocked={{ belt: 4, pipe: 2 }}
        itemName={itemName}
      />,
    );
    // The output lane's span 17–17 must show its honest 30 (the broken
    // belt.capacity stand-in rendered 60 here). The feed lane's own 17–17
    // span legitimately reads peak 60 — its belt delivers capacity 60 —
    // so the pin is the positive assertion, scoped by the 30 value only
    // the output span carries.
    expect(html).toContain("machines 17–17 · peak 30/min of 480/min");
  });

  it("marks a segment implicated by an over-capacity finding", () => {
    const base = workedResult();
    const doctored: StageSolveResult = {
      ...base,
      feeds: base.feeds.map((lane, i) =>
        i === 0
          ? {
              ...lane,
              findings: [
                {
                  type: "segment-over-capacity",
                  itemId: lane.itemId,
                  fromMachine: 1,
                  toMachine: 16,
                  peakFlow: Fraction.from(480),
                  busCapacity: Fraction.from(480),
                },
              ],
            }
          : lane,
      ),
    };
    const html = renderToStaticMarkup(
      <Schematic
        result={doctored}
        machineCount={20}
        tiers={FIXTURE_TIERS}
        unlocked={{ belt: 4, pipe: 2 }}
        itemName={itemName}
      />,
    );
    expect(html).toContain("seg-error");
  });
});

describe("LaneOverrides", () => {
  it("renders one row per belt with values from overrides", () => {
    const overrides: Selection["overrides"] = {
      feeds: { ore_iron: [null, "90"] },
      outputs: {},
    };
    const html = renderToStaticMarkup(
      <LaneOverrides
        result={workedResult()}
        overrides={overrides}
        onOverride={noop}
      />,
    );
    // Second feed belt's override cell value surfaces.
    expect(html).toContain('value="90"');
    // A row per belt of every lane (2 feed + 2 output).
    expect((html.match(/<input/g) ?? []).length).toBe(4);
  });
});

describe("FindingsPanel", () => {
  it("renders the invalid bad-clock detail", () => {
    const solve: SolveState = {
      status: "invalid",
      reason: "bad-clock",
      detail: "clock percent must be a positive number.",
    };
    const html = renderToStaticMarkup(
      <FindingsPanel solve={solve} findings={[]} itemName={itemName} />,
    );
    expect(html).toContain("Clock %");
    expect(html).toContain("clock percent must be a positive number.");
  });

  it("renders each finding sentence", () => {
    const solve: SolveState = { status: "solved", result: workedResult() };
    const findings: Finding[] = [
      {
        type: "segment-over-capacity",
        itemId: "ore_iron",
        fromMachine: 9,
        toMachine: 16,
        peakFlow: Fraction.from(540),
        busCapacity: Fraction.from(480),
      },
    ];
    const html = renderToStaticMarkup(
      <FindingsPanel solve={solve} findings={findings} itemName={itemName} />,
    );
    expect(html).toContain(
      "Iron Ore: bus over capacity between machines 9–16 — peak 540/min exceeds 480/min.",
    );
  });

  it("renders the clean line when solved with no findings", () => {
    const solve: SolveState = { status: "solved", result: workedResult() };
    const html = renderToStaticMarkup(
      <FindingsPanel solve={solve} findings={[]} itemName={itemName} />,
    );
    expect(html).toContain("No warnings — manifold is clean.");
  });
});

describe("Legend", () => {
  it("renders 6 belt + 2 pipe + override + problem swatches (spec §5 pin)", () => {
    // The app passes the full catalog TIER_TABLE (6 belt + 2 pipe).
    const html = renderToStaticMarkup(<Legend tiers={TIER_TABLE} />);
    expect((html.match(/legend-swatch/g) ?? []).length).toBe(6 + 2 + 2);
  });
});
