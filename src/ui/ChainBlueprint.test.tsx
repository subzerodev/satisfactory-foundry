/**
 * Data-level smoke for the combined view (Stage 7 / Phase 3, Axis 2): the pure
 * `deriveChainView` derivation is pinned here (solved-only skip + notice count,
 * per-site chrome, connector set, footer assembly); the SVG COMPONENT internals
 * follow the S4 canvas-exclusion posture (render smoke minimal, data pinned).
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Fraction } from "../core/fraction.ts";
import type { Catalog } from "../data/types.ts";
import type { StageNode, StageLink, SolveState } from "../state/store.ts";
import { ChainBlueprint, deriveChainView } from "./ChainBlueprint.tsx";

const F = (n: number): Fraction => Fraction.from(n);

const catalog: Catalog = {
  items: {
    iron_ingot: {
      id: "iron_ingot",
      displayName: "Iron Ingot",
      isFluid: false,
      stackSize: F(100),
    },
  },
  machines: {
    smelter_mk1: {
      id: "smelter_mk1",
      displayName: "Smelter",
      power: { mw: F(4), variable: false, exponent: F(1) },
    } as Catalog["machines"][string],
  },
  recipes: {
    ingot: {
      id: "ingot",
      displayName: "Iron Ingot",
      machineId: "smelter_mk1",
      isAlternate: false,
      inputs: [{ itemId: "ore_iron", perMinute: F(30) }],
      outputs: [{ itemId: "iron_ingot", perMinute: F(30) }],
      primaryOutputId: "iron_ingot",
    },
  },
  tiers: { belt: [F(60), F(120), F(270), F(480)], pipe: [F(300), F(600)] },
};

function solved(feedItem?: string): SolveState {
  return {
    status: "solved",
    result: {
      feeds: feedItem
        ? [
            {
              itemId: feedItem,
              kind: "belt",
              perMachineDemand: F(0),
              totalDemand: F(30),
              belts: [],
              segments: [],
              findings: [],
            },
          ]
        : [],
      outputs: [],
      findings: [],
    },
  } as SolveState;
}

function stage(id: string, solve: SolveState): StageNode {
  return {
    id,
    name: id,
    selection: {
      recipeId: "ingot",
      machineCount: 1,
      clockPercentText: "100",
      unlockedTiers: { belt: 4, pipe: 2 },
      overrides: { feeds: {}, outputs: {} },
    },
    solve,
  };
}

describe("deriveChainView — solved-only skip + chrome + footer", () => {
  it("places only solved stages and counts the skipped ones", () => {
    const stages: Record<string, StageNode> = {
      a: stage("a", solved()),
      b: stage("b", solved("iron_ingot")),
      c: stage("c", { status: "idle" } as SolveState), // unsolved → skipped
    };
    const view = deriveChainView(catalog, stages, ["a", "b", "c"], [], {
      a: { x: 0, y: 0 },
      b: { x: 300, y: 0 },
      c: { x: 600, y: 0 },
    });
    expect(view.sites.map((s) => s.stageId)).toEqual(["a", "b"]);
    expect(view.skippedCount).toBe(1);
    // Chrome carries a name + a power line for each solved site (smelter has
    // power data at 100% clock → an exact "4 MW").
    expect(view.chrome.map((c) => c.stageId)).toEqual(["a", "b"]);
    expect(view.chrome[0]!.powerText).toBe("4 MW");
  });

  it("emits a connector for a link between two solved sites", () => {
    const stages: Record<string, StageNode> = {
      a: stage("a", solved()),
      b: stage("b", solved("iron_ingot")),
    };
    const links: StageLink[] = [
      { id: "l1", fromStageId: "a", toStageId: "b", itemId: "iron_ingot" },
    ];
    const view = deriveChainView(catalog, stages, ["a", "b"], links, {
      a: { x: 0, y: 0 },
      b: { x: 300, y: 0 },
    });
    expect(view.connectors).toHaveLength(1);
    expect(view.connectors[0]!.label).toContain("Iron Ingot");
    expect(view.connectors[0]!.label).toMatch(/· \d+ m$/);
  });

  it("builds the footer with the sites Σ + the transport term", () => {
    const stages: Record<string, StageNode> = {
      a: stage("a", solved()),
      b: stage("b", solved("iron_ingot")),
    };
    const links: StageLink[] = [
      {
        id: "l1",
        fromStageId: "a",
        toStageId: "b",
        itemId: "iron_ingot",
        transport: {
          mode: "truck",
          trip: { kind: "estimated", distanceText: "300" },
        },
      },
    ];
    const view = deriveChainView(catalog, stages, ["a", "b"], links, {
      a: { x: 0, y: 0 },
      b: { x: 300, y: 0 },
    });
    // Two smelters at 100% → the chain Σ is ALWAYS the ≈ float form
    // (chainPowerText's own contract); one truck → 40 MW exact transport.
    // Pin the literal to lock the provenance split.
    expect(view.footerText).toContain("Sites Σ ≈ 8 MW");
    expect(view.footerText).toContain("transport 40 MW");
  });

  it("appends the train note when a train link is present", () => {
    const stages: Record<string, StageNode> = {
      a: stage("a", solved()),
      b: stage("b", solved("iron_ingot")),
    };
    const links: StageLink[] = [
      {
        id: "l1",
        fromStageId: "a",
        toStageId: "b",
        itemId: "iron_ingot",
        transport: {
          mode: "train",
          trip: { kind: "estimated", distanceText: "300" },
        },
      },
    ];
    const view = deriveChainView(catalog, stages, ["a", "b"], links, {
      a: { x: 0, y: 0 },
      b: { x: 300, y: 0 },
    });
    expect(view.footerText).toContain("(+ trains — see per-link)");
    // The train link contributes 0 to the summed transport term.
    expect(view.footerText).toContain("transport 0 MW");
  });
});

// ---------------------------------------------------------------------------
// Site focus (Stage 8 / Phase 1, Axis 3). SSR render smoke: the active site's
// `.selected` outline + the `<g>` button semantics (role/tabIndex). The click
// DISPATCH itself is the team-lead browser-walk gate (SSR strips handlers, per
// the canvas-exclusion posture); its target — site.stageId — is pinned at the
// derivation level (deriveChainView's sites carry the exact ids the closure
// () => onSelectStage(site.stageId) passes).
// ---------------------------------------------------------------------------

describe("ChainBlueprint — site focus", () => {
  const stages: Record<string, StageNode> = {
    a: stage("a", solved()),
    b: stage("b", solved("iron_ingot")),
  };
  const positions = { a: { x: 0, y: 0 }, b: { x: 300, y: 0 } };

  function render(activeStageId: string) {
    return renderToStaticMarkup(
      <ChainBlueprint
        catalog={catalog}
        stages={stages}
        stageOrder={["a", "b"]}
        links={[]}
        positions={positions}
        activeStageId={activeStageId}
        onSelectStage={() => {}}
      />,
    );
  }

  it("each site `<g>` carries button semantics (role + tabindex)", () => {
    const html = render("a");
    // Two solved sites → two role="button" groups, each keyboard-focusable.
    expect((html.match(/role="button"/g) ?? []).length).toBe(2);
    expect((html.match(/tabindex="0"/g) ?? []).length).toBe(2);
  });

  it("the ACTIVE site renders the `.selected` outline modifier; others don't", () => {
    const html = render("a");
    // Exactly one selected site (the active one); the other is plain.
    expect((html.match(/chain-bp-site selected/g) ?? []).length).toBe(1);
    expect(html).toContain('class="chain-bp-site selected"');
    expect(html).toContain('class="chain-bp-site"'); // the non-active site
  });

  it("moving the active cursor moves the `.selected` outline to the new site", () => {
    // Active b now → exactly one selected site, and it is the one whose foundation
    // markup differs from the a-active render (the outline tracks activeStageId).
    const withA = render("a");
    const withB = render("b");
    expect((withB.match(/chain-bp-site selected/g) ?? []).length).toBe(1);
    // The two renders differ (the selected class sits on a different `<g>`).
    expect(withA).not.toBe(withB);
  });

  it("site click targets carry the exact stageId the focus closure passes", () => {
    // The onClick closure is () => onSelectStage(site.stageId). SSR can't fire
    // it, so pin the wiring's INPUT: deriveChainView's sites are the click
    // targets, one per solved stage, carrying the ids App threads to setActiveStage.
    const view = deriveChainView(catalog, stages, ["a", "b"], [], positions);
    expect(view.sites.map((s) => s.stageId)).toEqual(["a", "b"]);
  });
});

// ---------------------------------------------------------------------------
// Axis B (P3) — the recipe-less skip-note vocabulary. NEW pin: nothing pinned
// the prior "not shown — unsolved" text. Assert the two whitespace-safe halves
// so the JSX line-wrap between "—" and "no" can't break the pin.
// ---------------------------------------------------------------------------

describe("ChainBlueprint — skip-note vocabulary (Axis B)", () => {
  function renderWithSkipped(skipped: number) {
    // One solved site + `skipped` idle stages → the notice renders its count.
    const stages: Record<string, StageNode> = { a: stage("a", solved()) };
    const order = ["a"];
    const positions: Record<string, { x: number; y: number }> = {
      a: { x: 0, y: 0 },
    };
    for (let i = 0; i < skipped; i++) {
      const id = `skip${i}`;
      stages[id] = stage(id, { status: "idle" } as SolveState);
      order.push(id);
      positions[id] = { x: 0, y: 0 };
    }
    return renderToStaticMarkup(
      <ChainBlueprint
        catalog={catalog}
        stages={stages}
        stageOrder={order}
        links={[]}
        positions={positions}
        activeStageId="a"
        onSelectStage={() => {}}
      />,
    );
  }

  it("reads the recipe-less phrase (singular)", () => {
    const html = renderWithSkipped(1);
    expect(html).toContain("1 ");
    expect(html).toContain("stage not drawn");
    expect(html).toContain("no recipe or invalid settings");
    // The alarming old vocabulary is gone.
    expect(html).not.toContain("unsolved");
    expect(html).not.toContain("not shown");
  });

  it("reads the recipe-less phrase (plural)", () => {
    const html = renderWithSkipped(2);
    expect(html).toContain("2 ");
    expect(html).toContain("stages not drawn");
    expect(html).toContain("no recipe or invalid settings");
  });
});

// ---------------------------------------------------------------------------
// Axis C2 (P3) — the [FIT | DETAIL] toggle in the Combined view, WITHOUT a
// gutter (C1 scope: ChainBlueprint has no lanes to label). The toggle mounts
// only when the fit scale is floored (fit < 1); switching mode switches the svg
// width/height between the fit-scale px and the 1 px/dm DETAIL values.
// ---------------------------------------------------------------------------

describe("ChainBlueprint — zoom toggle (Axis C2), no gutter (C1 scope)", () => {
  // Two sites 3000 dm apart → viewBox width ≫ 960, so fit < 1 and the toggle
  // mounts. A 2-site chain close together (the fixtures above) stays fit ≥ 1.
  const stages: Record<string, StageNode> = {
    a: stage("a", solved()),
    b: stage("b", solved("iron_ingot")),
  };
  const wide = { a: { x: 0, y: 0 }, b: { x: 3000, y: 0 } };
  const near = { a: { x: 0, y: 0 }, b: { x: 300, y: 0 } };

  function render(positions: Record<string, { x: number; y: number }>) {
    return renderToStaticMarkup(
      <ChainBlueprint
        catalog={catalog}
        stages={stages}
        stageOrder={["a", "b"]}
        links={[]}
        positions={positions}
        activeStageId="a"
        onSelectStage={() => {}}
      />,
    );
  }

  it("mounts the toggle only when the chain is floored (fit < 1)", () => {
    expect(render(near)).not.toContain("bp-zoom-toggle");
    expect(render(wide)).toContain("bp-zoom-toggle");
  });

  it("Combined view has NO gutter even when the toggle mounts (C1 scope)", () => {
    const html = render(wide);
    expect(html).toContain("bp-zoom-toggle");
    expect(html).not.toContain("bp-gutter");
  });

  it("opens at DETAIL (1 px/dm) — svg width equals the raw viewBox width", () => {
    // DEFAULT mode when mounted is DETAIL = 1 px/dm, so width = w px. The chain's
    // dm width is the sites' bbox + 2×PAD(40); a 1 px/dm render makes svg
    // width numerically equal that dm width (an integer here).
    const html = render(wide);
    // The site bbox spans x∈[0, 3000+siteWidth]; the exact px equals the dm w.
    // Pull the svg width and assert it exceeds 960 (never the floored fit px,
    // which would be ≤ 960) — the DETAIL scale is active by default.
    const m = html.match(/width="(\d+)"/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThan(960);
  });
});
