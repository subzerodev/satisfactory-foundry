// @vitest-environment jsdom

// #157 A2/A3: the drawing-subject selector + the stacked packaging render,
// exercised through the connected App shell (the only file that owns this
// state). Absent with no packaging chains; present + switches the tabs to the
// stacked packager/unpackager manifolds when a chain is selected.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Fraction } from "../core/fraction.ts";
import { createJSONStorage, type StateStorage } from "zustand/middleware";
import type { Catalog, CatalogRecipe } from "../data/types.ts";
import {
  appStore,
  type StageLink,
  type StageNode,
  type SolveState,
} from "../state/store.ts";
import App from "./App.tsx";

const F = Fraction.from;

// jsdom lacks matchMedia + ResizeObserver; App's theme init reads the former,
// ReactFlow (inside GraphCanvas) observes with the latter. Stub both so the
// full shell mounts.
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  if (window.matchMedia === undefined) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  }
  if (globalThis.ResizeObserver === undefined) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  // ReactFlow (GraphCanvas) measures edge labels via getBBox, which jsdom's SVG
  // stub omits — provide a zero-box so the canvas mounts.
  if (
    typeof SVGElement !== "undefined" &&
    (SVGElement.prototype as unknown as { getBBox?: unknown }).getBBox ===
      undefined
  ) {
    (SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox =
      () => ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect;
  }
  if (window.localStorage === undefined) {
    const store = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, String(v)),
        removeItem: (k: string) => void store.delete(k),
        clear: () => store.clear(),
        key: () => null,
        length: 0,
      },
    });
  }
});

function recipe(
  id: string,
  inputs: [string, number][],
  outputs: [string, number][],
): CatalogRecipe {
  return {
    id,
    displayName: id.replaceAll("_", " "),
    machineId: "packager",
    isAlternate: false,
    inputs: inputs.map(([itemId, rate]) => ({ itemId, perMinute: F(rate) })),
    outputs: outputs.map(([itemId, rate]) => ({ itemId, perMinute: F(rate) })),
    primaryOutputId: outputs[0]![0],
  };
}

function catalog(): Catalog {
  return {
    items: {
      water: {
        id: "water",
        displayName: "Water",
        isFluid: true,
        stackSize: null,
      },
      canister: {
        id: "canister",
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
    recipes: {
      package_water: recipe(
        "package_water",
        [
          ["water", 60],
          ["canister", 60],
        ],
        [["packaged_water", 60]],
      ),
      unpackage_water: recipe(
        "unpackage_water",
        [["packaged_water", 120]],
        [
          ["water", 120],
          ["canister", 120],
        ],
      ),
    },
    tiers: {
      belt: [60, 120, 270, 480, 780, 1200].map(F),
      pipe: [300, 600].map(F),
    },
    recipeUnlocks: {},
    extractors: {},
  };
}

/** A solved stage carrying an `itemId` lane on the given side at `rate`. */
function solvedStage(
  id: string,
  name: string,
  side: "output" | "feed",
  itemId: string,
  rate: number,
): StageNode {
  const solve: SolveState = {
    status: "solved",
    result: {
      feeds:
        side === "feed"
          ? [
              {
                itemId,
                kind: "pipe",
                perMachineDemand: F(rate),
                totalDemand: F(rate),
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
                itemId,
                kind: "pipe",
                perMachineOutput: F(rate),
                totalOutput: F(rate),
                breakouts: [],
                segments: [],
                collectionCascade: null,
                findings: [],
              },
            ]
          : [],
      findings: [],
    },
  };
  return {
    id,
    name,
    selection: {
      recipeId: "package_water",
      machineCount: 1,
      clockPercentText: "100",
      unlockedTiers: { belt: 6, pipe: 2 },
      overrides: { feeds: {}, outputs: {} },
    },
    solve,
  } as StageNode;
}

/** Two solved stages; when `withInterstep`, the link carries a packaging chain
 *  sized to 600/min water → 10 packagers + 5 unpackagers (non-degenerate). */
function seed(withInterstep: boolean) {
  const from = solvedStage("from", "Water Plant", "output", "water", 600);
  const to = solvedStage("to", "Bottling", "feed", "water", 600);
  const link: StageLink = {
    id: "L1",
    fromStageId: "from",
    itemId: "water",
    toStageId: "to",
    transport: { mode: "belt" },
    ...(withInterstep
      ? {
          interstep: {
            packageRecipeId: "package_water",
            clockPercentText: "100",
            returnTransport: { mode: "belt" },
          },
        }
      : {}),
  };
  appStore.setState({
    catalog: { status: "ready", catalog: catalog() },
    stages: { from, to },
    stageOrder: ["from", "to"],
    activeStageId: "from",
    selection: from.selection,
    solve: from.solve,
    links: [link],
    reconciliation: [],
    selectedLinkId: null,
    positions: { from: { x: 0, y: 0 }, to: { x: 500, y: 0 } },
  });
}

describe("App drawing-subject selector (#157 A2/A3)", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    const rows = new Map<string, string>();
    const storage: StateStorage = {
      getItem: (key) => rows.get(key) ?? null,
      setItem: (key, value) => void rows.set(key, value),
      removeItem: (key) => void rows.delete(key),
    };
    appStore.persist.setOptions({ storage: createJSONStorage(() => storage) });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    appStore.setState({ selectedLinkId: null, links: [], reconciliation: [] });
  });

  async function render() {
    await act(async () => root.render(<App />));
  }

  function subjectSelect(): HTMLSelectElement | null {
    return host.querySelector<HTMLSelectElement>(
      'select[aria-label="Drawing subject"]',
    );
  }

  it("is ABSENT when the plan has no packaging chains", async () => {
    seed(false);
    await render();
    expect(subjectSelect()).toBeNull();
  });

  it("appears with one option per chain and defaults to the stage subject", async () => {
    seed(true);
    await render();
    const select = subjectSelect();
    expect(select).not.toBeNull();
    // Default = the active stage; the empty value means "no packaging subject".
    expect(select!.value).toBe("");
    const options = [...select!.options].map((o) => o.textContent);
    expect(options[0]).toContain("Stage: Water Plant");
    expect(options.some((label) => label?.includes("Packaging: Water"))).toBe(
      true,
    );
  });

  it("switches the drawing to the STACKED packager + unpackager groups", async () => {
    seed(true);
    await render();
    const select = subjectSelect()!;
    const chainValue = [...select.options].find((o) =>
      o.value.startsWith("link:"),
    )!.value;

    Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )!.set!.call(select, chainValue);
    await act(async () =>
      select.dispatchEvent(new Event("change", { bubbles: true })),
    );

    // Both group headings render with their counts: 600/min water over 60/min
    // per packager → 10 packagers; over 120/min per unpackager → 5 unpackagers.
    const headings = [...host.querySelectorAll(".packaging-group-heading")].map(
      (h) => h.textContent,
    );
    expect(headings).toHaveLength(2);
    expect(headings[0]).toContain("10 × Packager");
    expect(headings[1]).toContain("5 × Unpackager");
    // The stacked groups each render a manifold (the default schematic view).
    expect(host.querySelectorAll(".packaging-group").length).toBe(2);
  });

  it("shows the #158 note (not a blueprint) for a packaging subject on the Blueprint tab", async () => {
    seed(true);
    await render();
    const select = subjectSelect()!;
    const chainValue = [...select.options].find((o) =>
      o.value.startsWith("link:"),
    )!.value;
    Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )!.set!.call(select, chainValue);
    await act(async () =>
      select.dispatchEvent(new Event("change", { bubbles: true })),
    );

    // Click the Blueprint tab.
    const blueprintTab = [...host.querySelectorAll("button.view-tab")].find(
      (b) => b.textContent === "BLUEPRINT",
    ) as HTMLButtonElement;
    await act(async () => blueprintTab.click());

    expect(host.textContent).toContain("#158");
    expect(host.querySelector(".bp-svg")).toBeNull();
    // The view state is NOT reset — switching back to the stage subject restores
    // the blueprint pane (the frozen non-interactive-disable clause).
    Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )!.set!.call(select, "");
    await act(async () =>
      select.dispatchEvent(new Event("change", { bubbles: true })),
    );
    expect(host.querySelector(".bp-svg")).not.toBeNull();
  });
});
