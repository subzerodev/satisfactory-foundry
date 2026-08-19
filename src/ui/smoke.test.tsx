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
import { appStore } from "../state/store.ts";
import type { Catalog } from "../data/types.ts";
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
import { Schematic } from "./Schematic.tsx";
import { Machines } from "./Machines.tsx";
import { computeLayout } from "./layout.ts";
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
        tiers={TIER_TABLE}
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

  it("offers Mk1..MkN belt toggles from the CATALOG tier table, not the constant (#140 P0)", () => {
    // The selector-max reroute: a modded/parsed 7-belt table must offer 7 belt
    // toggles (the curated constant has 6). Drives the tiers prop cascade.
    const sevenBeltTiers = {
      belt: [60, 120, 180, 270, 480, 780, 1200].map((n) => Fraction.from(n)),
      pipe: [300, 600].map((n) => Fraction.from(n)),
    };
    const html = renderToStaticMarkup(
      <ControlsStrip
        recipes={recipes}
        machines={machines}
        selection={{
          ...defaultSelection(),
          unlockedTiers: { belt: 7, pipe: 2 },
        }}
        tiers={sevenBeltTiers}
        hasOverrides={false}
        onSelectRecipe={noop}
        onMachineCount={noop}
        onClockText={noop}
        onTiers={noop}
        onClearOverrides={noop}
      />,
    );
    // Mk7 belt toggle exists (the curated 6-tier constant would stop at Mk6).
    expect(html).toContain(">Mk7<");
    expect(html).not.toContain(">Mk8<");
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

describe("Schematic", () => {
  it("renders the build view: the ruler, no machine block, no native <title>", () => {
    // P3: the build view draws the 12px ruler, NOT the 40px machine block. So no
    // per-machine <rect class="machine">, no band rect — but the feed/output lane
    // <rect>s (seam/arrow geometry) and the ruler are present.
    const html = renderToStaticMarkup(
      <Schematic
        result={workedResult()}
        machineCount={20}
        tiers={FIXTURE_TIERS}
        unlocked={{ belt: 4, pipe: 2 }}
        itemName={itemName}
      />,
    );
    expect(html).toContain('class="machine-ruler"');
    expect(html).not.toContain('class="machine"'); // the block moved out
    // Stage 5 item 1: the native <title> tooltips are gone — the styled hover
    // div carries the text now, so no <title> element remains in the markup.
    expect(html).not.toContain("<title>");
  });

  it("registers the ruler at N=20: major ticks on boundaries, minor at cell centres (P3)", () => {
    // The build view passes LAYOUT.rulerH — so the layout the test asserts
    // against MUST too, or machineTop/pitch diverge from the render.
    const layout = computeLayout(workedResult(), 20, 12);
    const html = renderToStaticMarkup(
      <Schematic
        result={workedResult()}
        machineCount={20}
        tiers={FIXTURE_TIERS}
        unlocked={{ belt: 4, pipe: 2 }}
        itemName={itemName}
      />,
    );
    const top = layout.machineTop;
    const rulerH = 12;
    const baseline = top + rulerH;
    const xOf = (index: number) => layout.machines[index - 1]!.x;

    // MAJOR tick — every significant index draws a full-rulerH tick at xOf(index),
    // and that x EQUALS a real feed-segment boundary x (solver-derived, never a
    // pitch-thinning artifact).
    const boundaryXs = new Set(
      layout.feeds.flatMap((t) => t.segments.flatMap((s) => [s.x1, s.x2])),
    );
    for (const index of layout.significant) {
      const x = xOf(index);
      expect(html).toContain(
        `class="ruler-major" x1="${x}" x2="${x}" y1="${top}" y2="${baseline}"`,
      );
    }
    // At least one major tick lands on an interior segment boundary (index 17 →
    // the head feed stretch's x2), proving the tick registers with the solver.
    expect(boundaryXs.has(xOf(17))).toBe(true);
    expect(layout.significant).toContain(17);

    // MINOR tick — at the cell CENTRE (m.x + pitch/2), 4px up from the baseline,
    // for EVERY machine (the readable pitch floor labels them all); the label
    // sits directly under it (same x).
    for (const m of layout.machines) {
      const cx = m.x + layout.pitch / 2;
      expect(html).toContain(
        `x1="${cx}" x2="${cx}" y1="${baseline - 4}" y2="${baseline}"`,
      );
      // The label is centred under its minor tick (same x), one row below the
      // baseline (machineTop + rulerH + 12 = machineTop + 24).
      expect(html).toContain(
        `<text class="machine-label" x="${cx}" y="${baseline + 12}"`,
      );
      // Never a bare cell-start label (the whole row centres on the cell).
      expect(html).not.toContain(
        `<text class="machine-label" x="${m.x}" y="${baseline + 12}"`,
      );
    }
    expect(baseline + 12).toBe(top + 24);
  });

  it("pans the ruler at Michael's N=106: labels every machine, none within 24px, major ticks on boundaries (#154)", () => {
    // At the 24px floor the build view scrolls and every machine gets a legible
    // number — no label thinning, no band. The uncrushed right end is the AC1
    // fix. MAJOR ticks stay on the solver-derived significant boundaries.
    const result = solveStage({ ...WORKED_INPUT, machineCount: 106 });
    const layout = computeLayout(result, 106, 12);
    const html = renderToStaticMarkup(
      <Schematic
        result={result}
        machineCount={106}
        tiers={FIXTURE_TIERS}
        unlocked={{ belt: 4, pipe: 2 }}
        itemName={itemName}
      />,
    );
    expect(layout.pitch).toBe(24);
    expect(layout.scrolled).toBe(true);
    expect(html).toContain('class="machine-ruler"');

    const top = layout.machineTop;
    const baseline = top + 12;
    // MAJOR ticks from significant, on real feed-stretch boundaries.
    const boundaryXs = new Set(
      layout.feeds.flatMap((t) => t.segments.flatMap((s) => [s.x1, s.x2])),
    );
    for (const index of layout.significant) {
      const x = layout.machines[index - 1]!.x;
      expect(html).toContain(
        `class="ruler-major" x1="${x}" x2="${x}" y1="${top}" y2="${baseline}"`,
      );
    }
    expect(boundaryXs.has(layout.machines[16]!.x)).toBe(true); // machine 17

    // EVERY machine carries a label — one per machine, no thinning.
    const labelXs = [
      ...html.matchAll(/class="machine-label" x="([\d.]+)"/g),
    ].map((m) => Number(m[1]));
    expect(labelXs.length).toBe(106);
    // No two ruler labels sit within 24px (the AC1 no-overlap guarantee).
    const sorted = [...labelXs].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(24);
    }
  });

  it("anchors output belt-arrows at machineTop + rulerH, not the old + 40 (P3 register pin)", () => {
    // The r1 HIGH: the output break-out arrows' TOP endpoint is the machine
    // row's BOTTOM edge. Post-P3 that is machineTop + rulerH (12), NOT the old
    // + 40 literal — which, because the risen outputTop EQUALS machineTop + 40,
    // would leave the arrows floating inside the output lane, detached from the
    // row. This pin FAILS against that coincidence: it demands rulerH (12).
    const layout = computeLayout(workedResult(), 20, 12);
    const html = renderToStaticMarkup(
      <Schematic
        result={workedResult()}
        machineCount={20}
        tiers={FIXTURE_TIERS}
        unlocked={{ belt: 4, pipe: 2 }}
        itemName={itemName}
      />,
    );
    const expectedY1 = layout.machineTop + 12; // machineTop + rulerH
    // The output belt-arrow (class="belt-arrow", no lane-pipe) starts at y1.
    expect(html).toContain(`class="belt-arrow" x1=`);
    // Every output-side belt-arrow's y1 is the row's new bottom, not machineTop
    // + 40 (which would equal the output lane top — the coincidence trap).
    const outArrowY1s = [
      ...html.matchAll(
        /class="belt-arrow" x1="[\d.]+" x2="[\d.]+" y1="([\d.]+)"/g,
      ),
    ].map((m) => Number(m[1]));
    expect(outArrowY1s.length).toBeGreaterThan(0);
    for (const y1 of outArrowY1s) {
      expect(y1).toBe(expectedY1);
    }
    // Falsifiability: the old + 40 literal is a DIFFERENT y than rulerH.
    expect(layout.machineTop + 40).not.toBe(expectedY1);
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
                  flow: Fraction.from(480),
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

  // Output lane names sit BELOW their bus, feed names above theirs (#76). The
  // output name baseline lifts to busY + 18 so its bbox band clears the seam
  // band busY ± 6; feed names stay at track.y + 12. Pinned against the restored
  // layout's known track geometry so the ~1px seam clearance can't silently
  // regress (the geometry pin the contract mandates for Axis C).
  it("puts output lane names below the bus, clear of the seams (#76)", () => {
    // The worked example: feed lane ore_iron, output lane iron_ingot. The BUILD
    // VIEW renders with rulerH 12, so the layout the test asserts against MUST
    // too — the output row rose 28px when the machine block became the ruler.
    // feed track.y = marginY 16 → name y = 28; the output row now sits below the
    // feed lane + bus + RULER + bus (16 + 56 + 28 + 12 + 28) → track.y = 140,
    // busY = track.y + 8 = 148, so the lifted output name baseline is
    // busY + 18 = 166 (was 194 under the 40px block — the −28 shift this re-pins).
    const layout = computeLayout(workedResult(), 20, 12);
    const feedTrack = layout.feeds[0]!;
    const outTrack = layout.outputs[0]!;

    // The bus/name model this asserts against (mirrors Schematic.tsx):
    const feedNameY = feedTrack.y + 12;
    const outNameY = outTrack.busY + 18;

    // Literal layout pins — fail if the build-view track geometry ever shifts.
    expect(feedNameY).toBe(28);
    expect(outNameY).toBe(166);

    // Output name model — lifted to busY + 18 (= track.y + 26, busY = y + 8).
    expect(outTrack.busY).toBe(outTrack.y + 8);
    expect(outNameY).toBe(outTrack.y + 26);

    // The geometry gate: the output name's bbox band [baseline−11, baseline]
    // (11px ascender) must clear the seam band [busY−6, busY+6]. The name band
    // is [busY+7, busY+18]; its top (busY+7) sits 1px below the seam bottom
    // (busY+6) — the ~1px clearance the contract protects.
    const nameBandTop = outNameY - 11;
    const seamBandBottom = outTrack.busY + 6;
    expect(nameBandTop).toBeGreaterThan(seamBandBottom);

    // The lifted name renders at the pinned baseline in the actual SVG.
    const html = renderToStaticMarkup(
      <Schematic
        result={workedResult()}
        machineCount={20}
        tiers={FIXTURE_TIERS}
        unlocked={{ belt: 4, pipe: 2 }}
        itemName={itemName}
      />,
    );
    expect(html).toContain(`class="lane-name" x="4" y="${outNameY}"`);
    expect(html).toContain(`class="lane-name" x="4" y="${feedNameY}"`);
  });
});

describe("Machines view (P3 / #135 — the block the build view shed)", () => {
  it("renders one rect per machine at N=20 (the relocated ≥20-rect pin)", () => {
    const html = renderToStaticMarkup(
      <Machines result={workedResult()} machineCount={20} />,
    );
    // 20 per-machine rects (the block, verbatim); it has no lanes, so no
    // lane/seam rects inflate the count — exactly 20 <rect>s.
    expect((html.match(/<rect/g) ?? []).length).toBe(20);
    expect((html.match(/class="machine"/g) ?? []).length).toBe(20);
    // No lane geometry leaks into this view.
    expect(html).not.toContain("lane-name");
    expect(html).not.toContain("belt-arrow");
    expect(html).not.toContain("machine-ruler");
  });

  it("centers every machine label under the cell (m.x + pitch/2) (#86)", () => {
    // The label names the machine, so it centers under the cell, not on the
    // boundary line at the cell's left edge (the block's own layout, machineH 40).
    // Every machine is labeled at the readable pitch floor.
    const layout = computeLayout(workedResult(), 20);
    const html = renderToStaticMarkup(
      <Machines result={workedResult()} machineCount={20} />,
    );
    const labelXs = new Set(
      [...html.matchAll(/class="machine-label" x="([\d.]+)"/g)].map((m) =>
        Number(m[1]),
      ),
    );
    expect(labelXs.size).toBeGreaterThan(0);
    for (const m of layout.machines) {
      expect(labelXs.has(m.x + layout.pitch / 2)).toBe(true);
      expect(labelXs.has(m.x)).toBe(false); // never on the boundary
    }
  });

  it("draws a rect per machine + the ×161 caption at N=161, no band (#154)", () => {
    // Band mode retired: at the 24px floor the machines view pans and draws a
    // rect per machine, with the ×N caption always shown as a static header.
    const result = solveStage({ ...WORKED_INPUT, machineCount: 161 });
    const html = renderToStaticMarkup(
      <Machines result={result} machineCount={161} />,
    );
    // One rect per machine — 161 machine rects (no thinning, no band collapse).
    expect((html.match(/class="machine"/g) ?? []).length).toBe(161);
    // The ×N caption is the band's one useful datum, now always visible.
    expect(html).toContain("×161");
  });
});

describe("segTooltip (bus-segment hover string, Stage 5 item 1)", () => {
  // The segTooltip helper survives the schematic removal (#68) — it is a pure
  // formatter for the bus-segment hover string, still fed real solves here so
  // the pinned strings gate against a live solver, not a hand-built fixture.
  it("carries the worked example's honest feed entry → hand-off string", () => {
    // The feed lane's head segment (non-terminal) resets to the full 480/min
    // entry at N=20 and hands 0 onward (16×30 exactly drains it). P2 D3 copy.
    const result = workedResult();
    const feedSegs = result.feeds[0]!.segments;
    const feedSeg = feedSegs[0]!;
    const busCap = formatRate(FIXTURE_TIERS.belt[3]!); // Mk4 = 480
    const terminal = feedSegs.length === 1;
    expect(segTooltip(feedSeg, busCap, "feed", terminal)).toBe(
      "machines 1–16 · entry 480/min → hand-off 0/min · bus 480/min",
    );
  });

  it("shows an output segment's honest collected load, not the belt's capacity", () => {
    // N=17: the last output breakout collects 30/min on a Mk1 (60/min) belt —
    // the tooltip must say collects 30, not 60 (boundary review r1 catch). An
    // output segment is never terminal-feed; side="output" selects the copy.
    const result = solveStage({ ...WORKED_INPUT, machineCount: 17 });
    const outSegs = result.outputs[0]!.segments;
    const tailSeg = outSegs[outSegs.length - 1]!;
    expect(tailSeg.fromMachine).toBe(17);
    expect(tailSeg.toMachine).toBe(17);
    const busCap = formatRate(FIXTURE_TIERS.belt[3]!); // 480
    expect(segTooltip(tailSeg, busCap, "output", false)).toBe(
      "machines 17–17 · collects 30/min of 480/min",
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

  it("labels machine rects 1-based (1..N), not 0-based (#85)", () => {
    // The solver's machine vocabulary is 1..N and every belt mark ("after
    // machine m") sits at machine m's right edge. The rect labels must read
    // 1..N so the mark lands on the rect it names, not one rect early. N=2 here:
    // the first rect wears "1", the last wears "2" (never a "0").
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
    const labels = [
      ...html.matchAll(/class="bp-machine-label"[^>]*>(\d+)</g),
    ].map((m) => m[1]);
    expect(labels).toEqual(["1", "2"]);
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

describe("App view tabs (#74 — schematic default)", () => {
  it("boots to the initializing surface — no plan leaf mounted eagerly", () => {
    // App SSR renders the store's default path (catalog initializing in node),
    // so the solved block + view tabs are not reachable headless — the tab
    // markup + its active-marking is a browser-walk gate. What IS pinned here:
    // App never eagerly mounts a plan leaf (bp-svg absent) because the whole
    // solved block is gated behind status "solved", which the unsolved SSR path
    // does not reach. The default view is component-local useState("schematic")
    // — the schematic is back and first (#74). A crash here would fail the
    // wiring. bp-svg-absence is view-independent (the SSR gate), so it holds
    // regardless of which view defaults.
    const html = renderToStaticMarkup(<App />);
    expect(html).not.toContain("bp-svg");
    // The Combined view is gone (#75) — no ChainBlueprint leaf, no chain-bp
    // markup, no COMBINED tab reachable from App.
    expect(html).not.toContain("chain-bp");
    expect(html).not.toContain("COMBINED");
  });

  it("mounts/unmounts the Machines leaf (P3 third tab smoke)", () => {
    // The tab wiring itself sits behind the "solved" gate, unreachable via SSR
    // (the browser walk owns the click path). What IS pinnable headless: the
    // Machines leaf the MACHINES tab mounts renders its block when selected and
    // contributes nothing when it is not on the surface — the mount/unmount
    // contract. Mounted → the block's rects; "unmounted" (the tab not chosen) →
    // App's unsolved SSR path never emits the block.
    const mounted = renderToStaticMarkup(
      <Machines result={workedResult()} machineCount={20} />,
    );
    expect(mounted).toContain('class="machine"');
    const appHtml = renderToStaticMarkup(<App />);
    expect(appHtml).not.toContain('class="machine"');
    // The build view (schematic) and the machines view are distinct leaves — the
    // schematic never renders the block, the machines view never the ruler.
    const schematic = renderToStaticMarkup(
      <Schematic
        result={workedResult()}
        machineCount={20}
        tiers={FIXTURE_TIERS}
        unlocked={{ belt: 4, pipe: 2 }}
        itemName={itemName}
      />,
    );
    expect(schematic).not.toContain('class="machine"');
    expect(schematic).toContain('class="machine-ruler"');
    expect(mounted).not.toContain("machine-ruler");
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
      detail:
        'clock % must be at least 1 (the game\'s minimum clock); got "0.5".',
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
    expect(html).toContain("clock % must be at least 1");
  });

  it("renders each finding sentence", () => {
    const solve: SolveState = { status: "solved", result: workedResult() };
    const findings: Finding[] = [
      {
        type: "segment-over-capacity",
        itemId: "ore_iron",
        fromMachine: 9,
        toMachine: 16,
        flow: Fraction.from(540),
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
      flow: Fraction.from(200),
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
      flow: Fraction.from(100),
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

  it("names the ruler's two tick kinds (#154, AC3)", () => {
    // The ruler entry uses the ConventionEntry idiom (NOT a Swatch), so it does
    // not inflate the legend-swatch count above.
    const html = renderToStaticMarkup(<Legend tiers={TIER_TABLE} />);
    expect(html).toContain("legend-ruler");
    // The apostrophe in "number's" renders as the &#x27; entity in static markup
    // (node env, no DOM), so match the escaped form.
    expect(html).toContain(
      "machine ruler — tall tick: a belt stretch starts/ends · short tick: this number&#x27;s machine",
    );
    // Idiom guard: the ruler entry did not add a legend-swatch.
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
        onExportAll={noop}
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
        onExportAll={noop}
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
        onExportAll={noop}
        onImport={noop}
      />,
    );
    expect(html).toContain("Alpha (2026-08-03)");
    expect(html).toContain("Beta (2026-07-01)");
    expect(html).toContain("Load");
    expect(html).toContain("Rename");
    expect(html).toContain("Export");
    // Export-all (Stage 19 / #92) renders alongside the per-row buttons — a
    // plain button, present whenever ≥1 plan exists, selection-independent.
    expect(html).toContain("Export all");
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
        onExportAll={noop}
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
        onExportAll={noop}
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

  it("names the building on the tile: ×N MachineName (#84)", async () => {
    // GraphCanvas's RF12 server snapshot reads the store's INITIAL state
    // (zustand's getInitialState), so the tile can't be seeded via setState —
    // stub that one seam with a solved-shaped slice carrying a recipe-bearing
    // stage (20 Smelters on the Iron Ingot recipe, catalog machine displayName
    // "Smelter"). The machines span then composes "×20 Smelter" (#84) — the
    // recipe-less default renders no such span (the existing card SSR pin).
    const { GraphCanvas } = await import("./GraphCanvas.tsx");
    const store = appStore as unknown as {
      getInitialState: () => unknown;
      getState: () => Record<string, unknown>;
    };
    const realInitial = store.getInitialState;
    const base = store.getState();
    const F = (n: number) => Fraction.from(n);
    const CAT: Catalog = {
      items: {
        iron_ingot: {
          id: "iron_ingot",
          displayName: "Iron Ingot",
          isFluid: false,
          stackSize: F(100),
        },
        ore_iron: {
          id: "ore_iron",
          displayName: "Iron Ore",
          isFluid: false,
          stackSize: F(100),
        },
      },
      machines: {
        smelter: {
          id: "smelter",
          displayName: "Smelter",
          power: { mw: F(4), variable: false, exponent: F(1) },
        },
      },
      recipes: {
        ingot: {
          id: "ingot",
          displayName: "Iron Ingot",
          machineId: "smelter",
          isAlternate: false,
          inputs: [{ itemId: "ore_iron", perMinute: F(30) }],
          outputs: [{ itemId: "iron_ingot", perMinute: F(30) }],
          primaryOutputId: "iron_ingot",
        },
      },
      tiers: { belt: [], pipe: [] },
      recipeUnlocks: {},
      extractors: {},
    };
    const sel: Selection = {
      recipeId: "ingot",
      machineCount: 20,
      clockPercentText: "100",
      unlockedTiers: { belt: 4, pipe: 2 },
      overrides: { feeds: {}, outputs: {} },
    };
    const stageNode = {
      id: "s1",
      name: "Smelting",
      selection: sel,
      solve: { status: "idle" as const },
    };
    store.getInitialState = () => ({
      ...base,
      catalog: { status: "ready", catalog: CAT },
      stages: { s1: stageNode },
      stageOrder: ["s1"],
      activeStageId: "s1",
      links: [],
      reconciliation: [],
      positions: { s1: { x: 0, y: 0 } },
      selection: sel,
      solve: { status: "idle" },
    });
    try {
      const html = renderToStaticMarkup(<GraphCanvas colorMode="light" />);
      expect(html).toContain(
        '<span class="stage-node-machines">×20 Smelter</span>',
      );
    } finally {
      store.getInitialState = realInitial;
    }
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
