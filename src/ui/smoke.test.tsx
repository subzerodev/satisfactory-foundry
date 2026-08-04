/**
 * Static-markup smoke suite (node env, no jsdom). Each pure/leaf UI piece is
 * rendered through react-dom/server and asserted on its output string.
 *
 * GraphCanvas EXCLUSION (Stage 3 / Phase 2, frozen Axis 5): the canvas
 * component is deliberately EXCLUDED from the smoke suite — graphToFlow (tested
 * in graph-flow.test.ts) carries the render-contract weight, and the team-lead
 * browser walk is the visual gate. The one opportunistic exception below (RF12
 * SSR happens to work in node) asserts only that the store→card path emits the
 * default stage's name + the recipe-less placeholder; it is a bonus, not the
 * canvas's coverage.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Fraction } from "../core/fraction.ts";
import type { Finding, StageSolveResult } from "../core/manifold.ts";
import type { CatalogRecipe, CatalogMachine } from "../data/types.ts";
import type { Selection, SolveState } from "../state/store.ts";
import { solveStage } from "../core/manifold.ts";
import { TIER_TABLE } from "../data/tiers.ts";
import { FIXTURE_TIERS, WORKED_INPUT, workedResult } from "./fixtures.ts";
import type { PlanListEntry } from "../data/plan-store.ts";
import { BundledBanner } from "./App.tsx";
import { UploadScreen } from "./UploadScreen.tsx";
import { PlansBar } from "./PlansBar.tsx";
import { ControlsStrip } from "./ControlsStrip.tsx";
import { SummaryCards } from "./SummaryCards.tsx";
import { Schematic } from "./Schematic.tsx";
import { Blueprint } from "./Blueprint.tsx";
import App from "./App.tsx";
import { LaneOverrides } from "./LaneOverrides.tsx";
import { FindingsPanel } from "./FindingsPanel.tsx";
import { Legend } from "./Legend.tsx";
import { formatRate, segTooltip } from "./format.ts";

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
  it("renders the worked example: enough rects, no native <title> tooltips", () => {
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
    // Stage 5 item 1: the native <title> tooltips are gone — the styled hover
    // div carries the text now, so no <title> element remains in the markup.
    // (The tooltip text itself is pinned at the segTooltip/beltLabel level: the
    // beltLabel "Feed 2 …" string at format.test.ts:54-56, and the segTooltip
    // strings in the two rows below.)
    expect(html).not.toContain("<title>");
  });

  it("segTooltip carries the worked example's honest bus-segment string", () => {
    // The former smoke:156 render assertion ("peak 480/min of 480/min"), now a
    // function-level assertion FED A REAL SOLVE (Stage 5 item 1 / r2 fold): the
    // string lived only in <title> markup, so its coverage moves to segTooltip.
    // The feed lane's head segment carries the full 480/min peak at N=20.
    const result = workedResult();
    const feedSeg = result.feeds[0]!.segments[0]!;
    const busCap = formatRate(FIXTURE_TIERS.belt[3]!); // Mk4 = 480
    expect(segTooltip(feedSeg, busCap)).toBe(
      "machines 1–16 · peak 480/min of 480/min",
    );
  });

  it("segTooltip shows a segment's honest peakFlow, not the belt's capacity", () => {
    // The former smoke:177, now a segTooltip function assertion (Stage 5 item
    // 1). N=17: the last output breakout carries 30/min on a Mk1 (60/min) belt
    // — the tooltip must say peak 30, not 60 (boundary review r1 catch). The
    // layout-level peakFlow pin (layout.test.ts:85-94) holds the data
    // invariant; feeding a real solve keeps the render-binding half meaningful.
    const result = solveStage({ ...WORKED_INPUT, machineCount: 17 });
    const outSegs = result.outputs[0]!.segments;
    const tailSeg = outSegs[outSegs.length - 1]!;
    expect(tailSeg.fromMachine).toBe(17);
    expect(tailSeg.toMachine).toBe(17);
    const busCap = formatRate(FIXTURE_TIERS.belt[3]!); // 480
    expect(segTooltip(tailSeg, busCap)).toBe(
      "machines 17–17 · peak 30/min of 480/min",
    );
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

  it("classes a pipe lane's bus segments with lane-pipe (Stage 5 item 4)", () => {
    // A fluid recipe fixture: one pipe feed at 150/min through the real solver,
    // so the pipe kind flows to the schematic lane. The distinct treatment is a
    // CSS class (.lane-pipe) — pin its presence in the markup.
    const result = solveStage({
      machineCount: 4,
      clockPercent: Fraction.from(100),
      capacities: FIXTURE_TIERS,
      feeds: [
        {
          itemId: "water",
          kind: "pipe" as const,
          perMachineRate: Fraction.from(150),
        },
      ],
      outputs: [
        {
          itemId: "iron_ingot",
          kind: "belt" as const,
          perMachineRate: Fraction.from(30),
        },
      ],
    });
    const html = renderToStaticMarkup(
      <Schematic
        result={result}
        machineCount={4}
        tiers={FIXTURE_TIERS}
        unlocked={{ belt: 4, pipe: 2 }}
        itemName={itemName}
      />,
    );
    expect(html).toContain("lane-pipe");
  });
});

describe("Blueprint", () => {
  // A small REAL solve (Smelter ×2, one belt feed + one belt output at 30/min)
  // through the actual solver, so the geometry Blueprint renders is the geometry
  // layoutStage emits. smelter_mk1 → 50×100 dm footprint, pitch 60. The exact
  // extents/counts below were computed from layoutStage (Axis 4).
  const smelterInput = {
    machineCount: 2,
    clockPercent: Fraction.from(100),
    capacities: FIXTURE_TIERS,
    feeds: [
      {
        itemId: "ore_iron",
        kind: "belt" as const,
        perMachineRate: Fraction.from(30),
      },
    ],
    outputs: [
      {
        itemId: "iron_ingot",
        kind: "belt" as const,
        perMachineRate: Fraction.from(30),
      },
    ],
  };
  const smelterSolve = () => solveStage(smelterInput);
  const smelterLabels = (result: StageSolveResult) => ({
    feedLabels: result.feeds.map((l) => itemName(l.itemId)),
    outputLabels: result.outputs.map((l) => itemName(l.itemId)),
  });

  it("renders the Smelter ×2 floor plan: dm-native viewBox, rects, marks", () => {
    const result = smelterSolve();
    const { feedLabels, outputLabels } = smelterLabels(result);
    const html = renderToStaticMarkup(
      <Blueprint
        solve={result}
        machineId="smelter_mk1"
        machineCount={2}
        feedLabels={feedLabels}
        outputLabels={outputLabels}
      />,
    );
    // dm-native viewBox = (origin.x−20 origin.y−20 cols×80+40 rows×80+40).
    // Smelter ×2 layout: origin {0,−80}, cols 2, rows 3.
    expect(html).toContain('viewBox="-20 -100 200 280"');
    // The dm-native SVG width is fluid; preserveAspectRatio keeps it undistorted.
    expect(html).toContain('width="100%"');
    expect(html).toContain('preserveAspectRatio="xMidYMid meet"');
    // 6 foundation tiles (2 cols × 3 rows).
    expect((html.match(/bp-foundation"/g) ?? []).length).toBe(6);
    // 2 machine rects.
    expect((html.match(/<g class="bp-machine">/g) ?? []).length).toBe(2);
    // 4 junctions (2 feed splitters + 2 output mergers, one per column each).
    expect((html.match(/bp-junction"/g) ?? []).length).toBe(4);
    // The feed drop-mark carries the exact formatRate string (60 → "60/min").
    expect(html).toContain(">60/min</text>");
    // The output breakout mark also carries its load.
    expect(html).toContain(">60/min (60/min load)</text>");
    // The composed lane labels render verbatim.
    expect(html).toContain("Iron Ore");
    expect(html).toContain("Iron Ingot");
    // A known footprint emits no unknown-footprint notice.
    expect(html).not.toContain("footprint unknown");
  });

  it("renders the unknown-footprint notice for an off-table machineId", () => {
    const result = smelterSolve();
    const { feedLabels, outputLabels } = smelterLabels(result);
    const html = renderToStaticMarkup(
      <Blueprint
        solve={result}
        machineId="mystery_mk9"
        machineCount={2}
        feedLabels={feedLabels}
        outputLabels={outputLabels}
      />,
    );
    expect(html).toContain(
      "footprint unknown for mystery_mk9 — drawn as 10×10 m",
    );
    // Still draws (the honest 100×100 approximation), so an SVG is present.
    expect(html).toContain("<svg");
  });

  it("renders the empty-state line (no SVG) for a zero-machine stage", () => {
    // machineCount 0 is the P1 pinned empty shape: layoutStage returns no
    // machines, so Blueprint shows the empty-state line and never an <svg>.
    const result = solveStage({ ...smelterInput, machineCount: 0 });
    const { feedLabels, outputLabels } = smelterLabels(result);
    const html = renderToStaticMarkup(
      <Blueprint
        solve={result}
        machineId="smelter_mk1"
        machineCount={0}
        feedLabels={feedLabels}
        outputLabels={outputLabels}
      />,
    );
    expect(html).toContain("empty-state");
    expect(html).not.toContain("<svg");
  });

  it("classes a pipe feed's bus ribbon with bp-bus-pipe (Stage 5 item 4)", () => {
    // A fluid recipe fixture: a pipe feed + a belt output. Blueprint re-reads
    // solve.feeds[f].kind for the CLASS only (the narrow S4P2 exception cited in
    // the component), so the pipe bus ribbon carries .bp-bus-pipe while the belt
    // output ribbon does not.
    const result = solveStage({
      machineCount: 2,
      clockPercent: Fraction.from(100),
      capacities: FIXTURE_TIERS,
      feeds: [
        {
          itemId: "water",
          kind: "pipe" as const,
          perMachineRate: Fraction.from(120),
        },
      ],
      outputs: [
        {
          itemId: "iron_ingot",
          kind: "belt" as const,
          perMachineRate: Fraction.from(30),
        },
      ],
    });
    const html = renderToStaticMarkup(
      <Blueprint
        solve={result}
        machineId="smelter_mk1"
        machineCount={2}
        feedLabels={result.feeds.map((l) => itemName(l.itemId))}
        outputLabels={result.outputs.map((l) => itemName(l.itemId))}
      />,
    );
    // Exactly the pipe feed's ribbon is classed; the belt output's is not.
    expect(html).toContain("bp-bus-pipe");
    expect((html.match(/bp-bus-pipe/g) ?? []).length).toBe(1);
  });
});

describe("App view toggle (Axis 1 default)", () => {
  it("boots to the schematic-default surface — no blueprint mounted eagerly", () => {
    // App SSR renders the store's default path (catalog initializing in node),
    // so the solved block + toggle are not reachable headless. What IS pinned:
    // the default view is component-local useState("schematic"), so App never
    // eagerly mounts the Blueprint leaf. A crash here would fail the wiring.
    const html = renderToStaticMarkup(<App />);
    expect(html).not.toContain("bp-svg");
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

describe("App provenance banner (ticket #9)", () => {
  it("renders the banner with the exact provenance string when source is bundled", () => {
    const html = renderToStaticMarkup(
      <BundledBanner
        source={{
          kind: "bundled",
          steamBuild: "23855724",
          extractedAt: "2026-04-30",
        }}
      />,
    );
    expect(html).toContain("bundled-banner");
    // The full pinned copy (renderToStaticMarkup leaves the · and — as-is).
    expect(html).toContain(
      "bundled game data · Steam build 23855724 (2026-04-30) — upload your own Docs.json if your game is newer",
    );
  });

  it("renders nothing when the source is user", () => {
    const html = renderToStaticMarkup(
      <BundledBanner source={{ kind: "user" }} />,
    );
    expect(html).toBe("");
  });

  it("renders nothing when the source is null (pre-ready)", () => {
    const html = renderToStaticMarkup(<BundledBanner source={null} />);
    expect(html).toBe("");
  });
});

describe("PlansBar", () => {
  const populated: PlanListEntry[] = [
    { id: "id-a", name: "Alpha", updatedAt: "2026-08-03T12:00:00.000Z" },
    { id: "id-b", name: "Beta", updatedAt: "2026-07-01T09:00:00.000Z" },
  ];

  it("renders the empty placeholder when plans is null (not-yet-listed)", () => {
    const html = renderToStaticMarkup(
      <PlansBar
        plans={null}
        planError={null}
        onSave={noop}
        onLoad={noop}
        onRename={noop}
        onDelete={noop}
      />,
    );
    expect(html).toContain("— no saved plans —");
    // The name input + Save are always present.
    expect(html).toContain('placeholder="plan name"');
    expect(html).toContain("Save");
  });

  it("renders the same placeholder when plans is [] (listed, none)", () => {
    const html = renderToStaticMarkup(
      <PlansBar
        plans={[]}
        planError={null}
        onSave={noop}
        onLoad={noop}
        onRename={noop}
        onDelete={noop}
      />,
    );
    expect(html).toContain("— no saved plans —");
  });

  it("renders a populated select with name + date, plus Load/Rename/Delete", () => {
    const html = renderToStaticMarkup(
      <PlansBar
        plans={populated}
        planError={null}
        onSave={noop}
        onLoad={noop}
        onRename={noop}
        onDelete={noop}
      />,
    );
    expect(html).toContain("Alpha (2026-08-03)");
    expect(html).toContain("Beta (2026-07-01)");
    expect(html).toContain("Load");
    expect(html).toContain("Rename");
    expect(html).toContain("Delete");
    expect(html).not.toContain("— no saved plans —");
  });

  it("renders the planError banner", () => {
    const html = renderToStaticMarkup(
      <PlansBar
        plans={[]}
        planError='a plan named "Alpha" already exists'
        onSave={noop}
        onLoad={noop}
        onRename={noop}
        onDelete={noop}
      />,
    );
    expect(html).toContain("plans-error");
    // renderToStaticMarkup entity-escapes the quotes; assert the surrounding copy.
    expect(html).toContain("already exists");
  });
});

describe("GraphCanvas SSR (opportunistic bonus — Stage 3 P2)", () => {
  it("renders the default stage card through RF12 SSR (name + recipe-less placeholder)", async () => {
    // The canvas is EXCLUDED from smoke (header note); this row exists only
    // because RF12 SSR happens to render the custom node card in node env. It
    // reads the app-wide singleton store, which boots with one recipe-less
    // "Stage 1" — so the store→graphToFlow→card path is exercised end-to-end.
    const { GraphCanvas } = await import("./GraphCanvas.tsx");
    const html = renderToStaticMarkup(<GraphCanvas colorMode="light" />);
    expect(html).toContain("stage-node");
    expect(html).toContain("Stage 1");
    // Recipe-less default → the "no recipe" placeholder renders.
    expect(html).toContain("no recipe");
    // The ＋stage control is present in the canvas corner.
    expect(html).toContain("graph-add-stage");
  });
});
