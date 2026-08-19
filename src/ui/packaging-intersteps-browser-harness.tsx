import { createRoot } from "react-dom/client";
import { Fraction } from "../core/fraction.ts";
import type { Catalog, CatalogRecipe } from "../data/types.ts";
import { appStore, useAppStore } from "../state/store.ts";
import type { StageLink, StageNode } from "../state/store.ts";
import { LinkInspector } from "./LinkInspector.tsx";
import "./app.css";

const F = Fraction.from;

function recipe(
  id: string,
  displayName: string,
  inputs: [string, number][],
  outputs: [string, number][],
): CatalogRecipe {
  return {
    id,
    displayName,
    machineId: "packager",
    isAlternate: false,
    inputs: inputs.map(([itemId, rate]) => ({
      itemId,
      perMinute: F(rate),
    })),
    outputs: outputs.map(([itemId, rate]) => ({
      itemId,
      perMinute: F(rate),
    })),
    primaryOutputId: outputs[0]![0],
  };
}

function catalog(includePackaging = true): Catalog {
  const recipes: Record<string, CatalogRecipe> = {};
  if (includePackaging) {
    recipes.package_water = recipe(
      "package_water",
      "Packaged Water",
      [
        ["water", 60],
        ["empty_canister", 60],
      ],
      [["packaged_water", 60]],
    );
    recipes.unpackage_water = recipe(
      "unpackage_water",
      "Unpackage Water",
      [["packaged_water", 120]],
      [
        ["water", 120],
        ["empty_canister", 120],
      ],
    );
  }
  return {
    items: {
      water: {
        id: "water",
        displayName: "Water",
        isFluid: true,
        stackSize: null,
      },
      empty_canister: {
        id: "empty_canister",
        displayName: "Empty Canister",
        isFluid: false,
        stackSize: F(100),
      },
      packaged_water: {
        id: "packaged_water",
        displayName: "Packaged Water",
        isFluid: false,
        stackSize: F(100),
      },
    },
    machines: {
      packager: {
        id: "packager",
        displayName: "Packager",
        power: {
          mw: F(10),
          variable: false,
          exponent: Fraction.of(1321929, 1000000),
        },
      },
    },
    recipes,
    tiers: {
      belt: [60, 120, 270, 480, 780, 1200].map(F),
      pipe: [300, 600].map(F),
    },
    recipeUnlocks: {},
    extractors: {},
  };
}

function solvedStage(
  id: string,
  name: string,
  side: "output" | "feed",
): StageNode {
  const rate = F(600);
  return {
    id,
    name,
    selection: {
      recipeId: null,
      machineCount: 1,
      clockPercentText: "100",
      unlockedTiers: { belt: 6, pipe: 2 },
      overrides: { feeds: {}, outputs: {} },
    },
    solve: {
      status: "solved",
      result: {
        feeds:
          side === "feed"
            ? [
                {
                  itemId: "water",
                  kind: "pipe",
                  perMachineDemand: rate,
                  totalDemand: rate,
                  belts: [],
                  segments: [],
                  hardware: null,
                  standingBufferItems: 0,
                  findings: [],
                },
              ]
            : [],
        outputs:
          side === "output"
            ? [
                {
                  itemId: "water",
                  kind: "pipe",
                  perMachineOutput: rate,
                  totalOutput: rate,
                  breakouts: [],
                  segments: [],
                  collectionCascade: null,
                  findings: [],
                },
              ]
            : [],
        findings: [],
      },
    },
  } as StageNode;
}

const baseLink: StageLink = {
  id: "water-link",
  fromStageId: "water-plant",
  itemId: "water",
  toStageId: "factory",
  transport: { mode: "pipe" },
};

function resetFactory() {
  appStore.setState({
    catalog: { status: "ready", catalog: catalog() },
    stages: {
      "water-plant": solvedStage("water-plant", "Water Plant", "output"),
      factory: solvedStage("factory", "Factory", "feed"),
    },
    stageOrder: ["water-plant", "factory"],
    activeStageId: "water-plant",
    links: [{ ...baseLink }],
    reconciliation: [],
    selectedLinkId: baseLink.id,
    positions: {
      "water-plant": { x: 0, y: 0 },
      factory: { x: 500, y: 0 },
    },
  });
}

function removePackagingCatalog() {
  appStore.setState({ catalog: { status: "ready", catalog: catalog(false) } });
}

function BrowserHarness() {
  const link = useAppStore((state) => state.links[0]);
  const catalogState = useAppStore((state) => state.catalog);
  const browserState = JSON.stringify({
    catalogHasPair:
      catalogState.status === "ready" &&
      catalogState.catalog.recipes.package_water !== undefined,
    transport: link?.transport ?? null,
    interstep: link?.interstep ?? null,
  });

  return (
    <main className="packaging-browser-shell" data-harness-ready="packaging">
      <div className="packaging-browser-actions">
        <button type="button" onClick={resetFactory}>
          Reset factory
        </button>
        <button type="button" onClick={removePackagingCatalog}>
          Remove packaging catalog
        </button>
      </div>
      <output className="packaging-browser-state" data-browser-state>
        {browserState}
      </output>
      <LinkInspector />
    </main>
  );
}

resetFactory();
createRoot(document.getElementById("root")!).render(<BrowserHarness />);
