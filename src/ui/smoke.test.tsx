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
import { RawFeedNode } from "./GraphCanvas.tsx";
import { solveStage } from "../core/manifold.ts";
import { TIER_TABLE } from "../data/tiers.ts";
import { FIXTURE_TIERS, WORKED_INPUT, workedResult } from "./fixtures.ts";
import type { PlanListEntry } from "../data/plan-store.ts";
import { BundledBanner, sanitizeFilename } from "./App.tsx";
import { UploadScreen } from "./UploadScreen.tsx";
import { PlansBar } from "./PlansBar.tsx";
import { ControlsStrip } from "./ControlsStrip.tsx";
import { SummaryCards } from "./SummaryCards.tsx";
import { Blueprint } from "./Blueprint.tsx";
import App from "./App.tsx";
import { LaneOverrides } from "./LaneOverrides.tsx";
import { FindingsPanel } from "./FindingsPanel.tsx";
import { Legend } from "./Legend.tsx";
import { TitleBlock } from "./TitleBlock.tsx";
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
    smelter: {
      id: "smelter",
      displayName: "Smelter",
      power: {
        mw: Fraction.from(4),
        variable: false,
        exponent: Fraction.of(1321929, 1000000),
      },
    },
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
      <SummaryCards
        result={workedResult()}
        itemName={itemName}
        powerText={null}
      />,
    );
    expect(html).toContain("600/min in");
    expect(html).toContain("600/min out");
    expect(html).toContain("2 × belt");
    // powerText null → no Power card.
    expect(html).not.toContain("summary-card-power");
  });

  it("renders the Power card when powerText is non-null (Stage 6 P2)", () => {
    const html = renderToStaticMarkup(
      <SummaryCards
        result={workedResult()}
        itemName={itemName}
        powerText="80 MW"
      />,
    );
    expect(html).toContain("summary-card-power");
    expect(html).toContain("Power");
    expect(html).toContain("80 MW");
  });

  it("omits the Power card when powerText is null", () => {
    const html = renderToStaticMarkup(
      <SummaryCards
        result={workedResult()}
        itemName={itemName}
        powerText={null}
      />,
    );
    expect(html).not.toContain("summary-card-power");
  });
});

describe("segTooltip (bus-segment hover string, Stage 5 item 1)", () => {
  // The segTooltip helper survives the schematic removal (#68) — it is a pure
  // formatter for the bus-segment hover string, still fed real solves here so
  // the pinned strings gate against a live solver, not a hand-built fixture.
  it("carries the worked example's honest bus-segment string", () => {
    // The feed lane's head segment carries the full 480/min peak at N=20.
    const result = workedResult();
    const feedSeg = result.feeds[0]!.segments[0]!;
    const busCap = formatRate(FIXTURE_TIERS.belt[3]!); // Mk4 = 480
    expect(segTooltip(feedSeg, busCap)).toBe(
      "machines 1–16 · peak 480/min of 480/min",
    );
  });

  it("shows a segment's honest peakFlow, not the belt's capacity", () => {
    // N=17: the last output breakout carries 30/min on a Mk1 (60/min) belt —
    // the tooltip must say peak 30, not 60 (boundary review r1 catch).
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
    // Stage 12 P1 Axis 2: width="100%"+meet is REPLACED by explicit dm→px width
    // and height from the shared fitScale (this pin churns deliberately). The
    // smelter's 200×280 viewBox sits UNDER the 520 cap, so the height term is
    // min(280,520)/280 = 1 — the sub-cap plan keeps today's natural 1 px/dm
    // size (the boundary review caught cap/vbH silently enlarging it 1.86×).
    expect(html).toContain('width="200"');
    expect(html).toContain('height="280"');
    expect(html).not.toContain('width="100%"');
    expect(html).not.toContain("preserveAspectRatio");
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

  it("lifts mark labels OFF the lane band: feed y=−44, output y=152 (#69)", () => {
    // The rate labels moved off the drawing ink (#69). Marks sit ON the bus
    // (mk.at.y === busY): the smelter's feed bus is y=−20, output bus y=120. The
    // label baseline lifts by MARK_LABEL_DY — feed −24 → y=−44, output +32 →
    // y=152 — clear of the ±20 junction rects. x stays at.x+12 (head mark → 12).
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
    // The feed head mark's rate label sits at the lifted feed baseline.
    expect(html).toContain('class="bp-mark-label" x="12" y="-44"');
    // The output head breakout's rate label sits at the mirrored output baseline.
    expect(html).toContain('class="bp-mark-label" x="12" y="152"');
  });

  it("renders lane-name labels in the HTML gutter, not in the SVG (Axis C1)", () => {
    // The lane NAMES left the SVG for the screen-space HTML gutter (P3 Axis C1);
    // the in-SVG <text class="bp-lane-name"> elements are gone. The smelter is a
    // sub-cap fit = 1 plan, so it opens at DETAIL and the gutter is populated.
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
    // The names live in gutter spans now — the removed SVG class is absent.
    expect(html).not.toContain("bp-lane-name");
    expect(html).toContain("bp-gutter-label");
    expect(html).toContain("Iron Ore");
    expect(html).toContain("Iron Ingot");
    // The width mechanism: the absolute labels are out-of-flow and contribute
    // nothing to the gutter's max-content, so each label has an in-flow,
    // invisible sizer twin that reserves the column width. One per label —
    // the count guard keeps the twinning assertion from passing vacuously.
    const labelCount = html.match(/class="bp-gutter-label"/g)?.length ?? 0;
    expect(labelCount).toBeGreaterThan(0);
    expect(html.match(/class="bp-gutter-sizer"/g)?.length).toBe(labelCount);
  });

  it("positions each gutter label at (laneY − minY) × scale px (Axis C1)", () => {
    // The negative-origin term is load-bearing: the smelter's viewBox minY is
    // −100 (origin.y −80, minus PAD 20). At the sub-cap fit = 1 scale, the feed
    // bus (y −20) lands at (−20 − −100) × 1 = 80px and the output bus (y 120) at
    // (120 − −100) × 1 = 220px. A bare laneY×scale would misplace both.
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
    expect(html).toContain("top:80px");
    expect(html).toContain("top:220px");
  });

  it("shows NO zoom toggle for a sub-cap plan (fit ≥ 1) — opens as today", () => {
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
    expect(html).not.toContain("bp-zoom-toggle");
  });

  it("floored wide plan: mounts the toggle, opens at DETAIL with a populated gutter", () => {
    // A 60-machine smelter row → viewBox ≫ 960 (fit < 1), so the toggle mounts.
    // DEFAULT mode is DETAIL (1 px/dm), so the gutter labels render and the svg
    // width is the raw dm width (natural size), not the floored fit px.
    const result = solveStage({ ...smelterInput, machineCount: 60 });
    const html = renderToStaticMarkup(
      <Blueprint
        solve={result}
        machineId="smelter_mk1"
        machineCount={60}
        feedLabels={result.feeds.map((l) => itemName(l.itemId))}
        outputLabels={result.outputs.map((l) => itemName(l.itemId))}
      />,
    );
    // The toggle mounts (fit < 1) and defaults to DETAIL — gutter populated.
    expect(html).toContain("bp-zoom-toggle");
    expect(html).toContain("bp-gutter-label");
    // At DETAIL = 1 px/dm the svg width equals the dm viewBox width (3640),
    // which is > 960 — the floored FIT px would be ≤ 960.
    const m = html.match(/class="bp-svg"[^>]*width="(\d+)"/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(3640);
    // Both feed + output lane names sit at the DETAIL lane y positions.
    expect(html).toContain("top:80px");
    expect(html).toContain("top:220px");
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

describe("App view tabs (#68 — blueprint default)", () => {
  it("boots to the initializing surface — no plan leaf mounted eagerly", () => {
    // App SSR renders the store's default path (catalog initializing in node),
    // so the solved block + view tabs are not reachable headless — the tab
    // markup + its active-marking is a browser-walk gate. What IS pinned here:
    // App never eagerly mounts a plan leaf (bp-svg absent) because the whole
    // solved block is gated behind status "solved", which the unsolved SSR path
    // does not reach. The default view is component-local useState("blueprint")
    // — no schematic View member survives. A crash here would fail the wiring.
    const html = renderToStaticMarkup(<App />);
    expect(html).not.toContain("bp-svg");
    // The schematic surface is gone entirely (#68) — no schematic leaf, no
    // "schematic" View member, nothing schematic-shaped reachable from App.
    expect(html.toLowerCase()).not.toContain("schematic");
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
        itemName={itemName}
        onOverride={noop}
      />,
    );
    // Second feed belt's override cell value surfaces.
    expect(html).toContain('value="90"');
    // A row per belt of every lane (2 feed + 2 output).
    expect((html.match(/<input/g) ?? []).length).toBe(4);
  });

  it("renders the panel heading, sub-label, and per-lane item headings (Axis A)", () => {
    const html = renderToStaticMarkup(
      <LaneOverrides
        result={workedResult()}
        overrides={{ feeds: {}, outputs: {} }}
        itemName={itemName}
        onOverride={noop}
      />,
    );
    // The drafting-label panel heading + its one-line sub-label.
    expect(html).toContain("BELT LOAD OVERRIDES");
    expect(html).toContain("type a rate to override a belt");
    expect(html).toContain("empty = computed");
    // Each lane heads its rows with the catalog displayName (the worked example
    // is ore_iron feed + iron_ingot output).
    expect(html).toContain("lane-overrides-item");
    expect(html).toContain(">Iron Ore</div>");
    expect(html).toContain(">Iron Ingot</div>");
  });

  it("wraps ALL lane groups in one table; head + sub sit OUTSIDE it (#70)", () => {
    // Axis C hoists the grid to a single inner .lane-overrides-table so the input
    // column aligns across every lane. Structural pin: the head + sub render
    // BEFORE the table opens (outside the grid, by structure not span), and every
    // lane wrapper renders AFTER it (inside the grid). CSS alignment itself is
    // not SSR-assertable — the browser walk owns the visual column check.
    const html = renderToStaticMarkup(
      <LaneOverrides
        result={workedResult()}
        overrides={{ feeds: {}, outputs: {} }}
        itemName={itemName}
        onOverride={noop}
      />,
    );
    const tableAt = html.indexOf('class="lane-overrides-table"');
    const headAt = html.indexOf('class="lane-overrides-head"');
    const subAt = html.indexOf('class="lane-overrides-sub"');
    const firstLaneAt = html.indexOf('class="lane-overrides-lane"');
    expect(tableAt).toBeGreaterThan(-1);
    // Head + sub precede the table wrapper (they are NOT grid items).
    expect(headAt).toBeGreaterThan(-1);
    expect(subAt).toBeGreaterThan(-1);
    expect(headAt).toBeLessThan(tableAt);
    expect(subAt).toBeLessThan(tableAt);
    // Every lane wrapper sits inside the table (after its opening tag).
    expect(firstLaneAt).toBeGreaterThan(tableAt);
    // All lane wrappers (1 feed ore_iron + 1 output iron_ingot) live in it.
    expect((html.match(/class="lane-overrides-lane"/g) ?? []).length).toBe(2);
  });
});

describe("FindingsPanel", () => {
  // The FULL fixed table (6 belt + 2 pipe) + the unlock count pair drive the
  // fix hints; the app threads both from the FindingsPanel call site.
  const fullUnlocked = {
    belt: TIER_TABLE.belt.length,
    pipe: TIER_TABLE.pipe.length,
  };

  it("renders the invalid bad-clock detail", () => {
    const solve: SolveState = {
      status: "invalid",
      reason: "bad-clock",
      detail: "clock percent must be a positive number.",
    };
    const html = renderToStaticMarkup(
      <FindingsPanel
        solve={solve}
        findings={[]}
        itemName={itemName}
        tiers={TIER_TABLE}
        unlocked={fullUnlocked}
      />,
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
      <FindingsPanel
        solve={solve}
        findings={findings}
        itemName={itemName}
        tiers={TIER_TABLE}
        unlocked={fullUnlocked}
      />,
    );
    expect(html).toContain(
      "Iron Ore: bus over capacity between machines 9–16 — peak 540/min exceeds 480/min.",
    );
  });

  it("appends the UNLOCK hint when the fix tier is above best-unlocked", () => {
    // A segment-over-capacity finding placed on a lane (so laneKindOf resolves
    // its belt kind by identity). busCapacity = Mk2 (120), peak 200 → the
    // smallest tier ≥ 200 AND > 120 is Mk3 (270). With only Mk1+Mk2 unlocked,
    // Mk3 is above best-unlocked → the "unlocking" wording.
    const finding: Finding = {
      type: "segment-over-capacity",
      itemId: "ore_iron",
      fromMachine: 1,
      toMachine: 8,
      peakFlow: Fraction.from(200),
      busCapacity: Fraction.from(120),
    };
    const base = workedResult();
    const doctored: StageSolveResult = {
      ...base,
      feeds: base.feeds.map((lane, i) =>
        i === 0 ? { ...lane, findings: [finding] } : lane,
      ),
    };
    const solve: SolveState = { status: "solved", result: doctored };
    const html = renderToStaticMarkup(
      <FindingsPanel
        solve={solve}
        findings={[finding]}
        itemName={itemName}
        tiers={TIER_TABLE}
        unlocked={{ belt: 2, pipe: 2 }}
      />,
    );
    expect(html).toContain(
      "unlocking Mk3 (270/min) would raise the bus above this peak",
    );
  });

  it("appends the OVERRIDE-raise hint when the fix tier is already unlocked", () => {
    // The overridden-DOWN case: busCapacity = 90 (an override below any tier),
    // peak 100 → smallest tier ≥ 100 AND > 90 is Mk2 (120). With Mk1..Mk4
    // unlocked, Mk2 ≤ best-unlocked → the "raising this lane's override" wording.
    const finding: Finding = {
      type: "segment-over-capacity",
      itemId: "iron_ingot",
      fromMachine: 1,
      toMachine: 1,
      peakFlow: Fraction.from(100),
      busCapacity: Fraction.from(90),
    };
    const base = workedResult();
    const doctored: StageSolveResult = {
      ...base,
      outputs: base.outputs.map((lane, i) =>
        i === 0 ? { ...lane, findings: [finding] } : lane,
      ),
    };
    const solve: SolveState = { status: "solved", result: doctored };
    const html = renderToStaticMarkup(
      <FindingsPanel
        solve={solve}
        findings={[finding]}
        itemName={itemName}
        tiers={TIER_TABLE}
        unlocked={{ belt: 4, pipe: 2 }}
      />,
    );
    // renderToStaticMarkup entity-escapes the apostrophe (&#x27;); assert the
    // copy on either side so the pinned override-raise wording still gates.
    expect(html).toContain("raising this lane");
    expect(html).toContain(
      "s override to Mk2 (120/min) would put the bus above this peak",
    );
  });

  it("appends the demand hint for an infeasible-machine-demand finding", () => {
    // One machine needs 200/min on a Mk2 (120) top capacity → the smallest tier
    // ≥ 200 AND > 120 is Mk3 (270): "unlocking Mk3 … would cover this machine's
    // demand". Placed on a lane so laneKindOf resolves the belt kind.
    const finding: Finding = {
      type: "infeasible-machine-demand",
      itemId: "ore_iron",
      demand: Fraction.from(200),
      topCapacity: Fraction.from(120),
    };
    const base = workedResult();
    const doctored: StageSolveResult = {
      ...base,
      feeds: base.feeds.map((lane, i) =>
        i === 0 ? { ...lane, findings: [finding] } : lane,
      ),
    };
    const solve: SolveState = { status: "solved", result: doctored };
    const html = renderToStaticMarkup(
      <FindingsPanel
        solve={solve}
        findings={[finding]}
        itemName={itemName}
        tiers={TIER_TABLE}
        unlocked={{ belt: 2, pipe: 2 }}
      />,
    );
    // Apostrophe entity-escaped by renderToStaticMarkup; assert around it.
    expect(html).toContain("unlocking Mk3 (270/min) would cover this machine");
    expect(html).toContain("s demand");
  });

  it("renders the clean line when solved with no findings", () => {
    const solve: SolveState = { status: "solved", result: workedResult() };
    const html = renderToStaticMarkup(
      <FindingsPanel
        solve={solve}
        findings={[]}
        itemName={itemName}
        tiers={TIER_TABLE}
        unlocked={fullUnlocked}
      />,
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

describe("TitleBlock (Stage 9 / Phase 0)", () => {
  it("renders every cell from its props", () => {
    const html = renderToStaticMarkup(
      <TitleBlock
        title="Iron Ingot"
        sheet="S3 · L2"
        rev="2026-08-05"
        power="Σ ≈ 42.0 MW"
      />,
    );
    // Labels + the prop-fed values are all present.
    expect(html).toContain("Title");
    expect(html).toContain("Iron Ingot");
    expect(html).toContain("Sheet");
    expect(html).toContain("S3 · L2");
    expect(html).toContain("Rev");
    expect(html).toContain("2026-08-05");
    expect(html).toContain("Σ Power");
    expect(html).toContain("Σ ≈ 42.0 MW");
  });

  it("carries the static UNITS brag verbatim", () => {
    const html = renderToStaticMarkup(
      <TitleBlock title="x" sheet="S1 · L0" rev="2026-08-05" power="—" />,
    );
    // UNITS is not a prop — it is the honest, always-true unit statement.
    expect(html).toContain("Units");
    expect(html).toContain("/MIN · EXACT ℚ");
  });

  it('renders the ?? "—" power fallback string as given', () => {
    // App resolves chainPowerText(...) ?? "—"; TitleBlock renders whatever it
    // is handed, so the em-dash zero-state must survive to the markup.
    const html = renderToStaticMarkup(
      <TitleBlock title="x" sheet="S1 · L0" rev="2026-08-05" power="—" />,
    );
    expect(html).toContain('class="title-block-value">—</span>');
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
        onExport={noop}
        onImport={noop}
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
        onExport={noop}
        onImport={noop}
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
        onExport={noop}
        onImport={noop}
      />,
    );
    expect(html).toContain("Alpha (2026-08-03)");
    expect(html).toContain("Beta (2026-07-01)");
    expect(html).toContain("Load");
    expect(html).toContain("Rename");
    expect(html).toContain("Export");
    expect(html).toContain("Delete");
    expect(html).not.toContain("— no saved plans —");
  });

  it("always renders the Import file input, even with no saved plans", () => {
    const html = renderToStaticMarkup(
      <PlansBar
        plans={[]}
        planError={null}
        onSave={noop}
        onLoad={noop}
        onRename={noop}
        onDelete={noop}
        onExport={noop}
        onImport={noop}
      />,
    );
    expect(html).toContain("plans-import");
    expect(html).toContain('type="file"');
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
        onExport={noop}
        onImport={noop}
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
    // The flow-direction toggle is present too (Stage 10 P1), defaulting to the
    // LR label (the store boots "LR").
    expect(html).toContain("FLOW L→R");
    // The default Stage 1 is recipe-less/idle → no power line (uniform rule);
    // the powerText-non-null render is the browser-walk gate (StageNode's
    // <Handle> needs the RF provider, so it can't be rendered in isolation —
    // the data pin lives in graph-flow.test's node-powerText rows instead).
    expect(html).not.toContain("stage-node-power");
  });

  it("renders the dimension-tick marker def (Stage 9 P1 Axis 2)", async () => {
    // The dim-tick <marker> def is canvas chrome the edges' markerEnd references
    // (RF creates no auto-def for a string marker). It renders inside a hidden
    // <svg><defs> in GraphCanvas, so the opportunistic SSR reaches it — this
    // pins its presence; the tick's rendered look is a browser-walk gate.
    const { GraphCanvas } = await import("./GraphCanvas.tsx");
    const html = renderToStaticMarkup(<GraphCanvas colorMode="light" />);
    expect(html).toContain('id="dim-tick"');
  });

  it("renders the raw-feed supply card class through the canvas RF12 SSR path (Stage 11 P1)", async () => {
    // The raw-feed cards (ticket #57) ride at the same RF `nodes` prop the
    // canvas uses (concatenated outside the merge), rendered by the SAME custom
    // RawFeedNode the canvas registers under nodeTypes "rawFeed". RF's server
    // snapshot reads the store's INITIAL state (zustand's getInitialState), so
    // GraphCanvas SSR always shows the default Stage 1 and can't be seeded post-
    // boot — so this pins the card's SSR markup via the real component through
    // the real RF nodes-prop path, exactly as the canvas drives it. The rate/
    // suppression logic is covered at graph-flow.test's rawFeeds derive; the
    // card's rendered look is a browser-walk gate.
    const { ReactFlow } = await import("@xyflow/react");
    await import("@xyflow/react/dist/style.css");
    const html = renderToStaticMarkup(
      <ReactFlow
        nodes={[
          {
            id: "raw:s1:ore_iron",
            type: "rawFeed",
            position: { x: 0, y: 0 },
            draggable: false,
            selectable: false,
            deletable: false,
            data: { itemName: "Iron Ore", rateText: "600/min" },
          },
        ]}
        edges={[]}
        nodeTypes={{ rawFeed: RawFeedNode }}
      />,
    );
    expect(html).toContain("raw-feed-node");
    // The card carries the item name + the exact demand (formatRate idiom).
    expect(html).toContain("Iron Ore");
    expect(html).toContain("600/min");
  });
});

describe("sanitizeFilename (Stage 6 / Phase 1 — export filename table)", () => {
  // Each filesystem-unsafe char (/ \ : * ? " < > |) maps to "-"; safe chars pass.
  const cases: [string, string][] = [
    ["Iron Line", "Iron Line"], // spaces + letters untouched
    ["a/b", "a-b"],
    ["a\\b", "a-b"],
    ["a:b", "a-b"],
    ["a*b", "a-b"],
    ["a?b", "a-b"],
    ['a"b', "a-b"],
    ["a<b", "a-b"],
    ["a>b", "a-b"],
    ["a|b", "a-b"],
    ['all/\\:*?"<>|here', "all---------here"], // every unsafe char at once
    ["dash-and_underscore.1", "dash-and_underscore.1"], // these are all safe
  ];
  it.each(cases)("sanitizes %j → %j", (input, expected) => {
    expect(sanitizeFilename(input)).toBe(expected);
  });
});
