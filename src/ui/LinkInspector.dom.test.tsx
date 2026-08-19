// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Fraction } from "../core/fraction.ts";
import { createJSONStorage, type StateStorage } from "zustand/middleware";
import type { Catalog, CatalogRecipe } from "../data/types.ts";
import { appStore, type StageLink, type StageNode } from "../state/store.ts";
import { LinkInspector } from "./LinkInspector.tsx";

const F = Fraction.from;

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
    outputs: outputs.map(([itemId, rate]) => ({
      itemId,
      perMinute: F(rate),
    })),
    primaryOutputId: outputs[0]![0],
  };
}

function catalog(includeSecondPair = false): Catalog {
  const recipes: Record<string, CatalogRecipe> = {
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
  };
  if (includeSecondPair) {
    recipes.package_water_alt = recipe(
      "package_water_alt",
      [
        ["water", 30],
        ["canister", 30],
      ],
      [["packaged_water_alt", 30]],
    );
    recipes.unpackage_water_alt = recipe(
      "unpackage_water_alt",
      [["packaged_water_alt", 30]],
      [
        ["water", 30],
        ["canister", 30],
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
      ...(includeSecondPair
        ? {
            packaged_water_alt: {
              id: "packaged_water_alt",
              displayName: "Alternate Packaged Water",
              isFluid: false,
              stackSize: F(100),
            },
          }
        : {}),
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
  rate: number,
): StageNode {
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
    solve: {
      status: "solved",
      result: {
        feeds:
          side === "feed"
            ? [
                {
                  itemId: "water",
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
                  itemId: "water",
                  kind: "pipe",
                  perMachineOutput: F(30),
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
    },
  } as StageNode;
}

const baseLink: StageLink = {
  id: "link",
  fromStageId: "from",
  itemId: "water",
  toStageId: "to",
  transport: { mode: "pipe" },
};

function mountState(link: StageLink, nextCatalog = catalog(), demand = 60) {
  const stages = {
    from: solvedStage("from", "Water Plant", "output", 30),
    to: solvedStage("to", "Factory", "feed", demand),
  };
  appStore.setState({
    catalog: { status: "ready", catalog: nextCatalog },
    stages,
    stageOrder: ["from", "to"],
    activeStageId: "from",
    links: [link],
    reconciliation: [
      {
        type: "under-supply",
        linkId: "link",
        supply: F(30),
        demand: F(demand),
        shortfall: F(demand - 30),
      },
    ],
    selectedLinkId: "link",
    positions: { from: { x: 0, y: 0 }, to: { x: 500, y: 0 } },
  });
}

function byLabel<T extends HTMLElement>(host: HTMLElement, text: string): T {
  const labels = [...host.querySelectorAll("label")];
  const label = labels.find((candidate) =>
    candidate.textContent?.includes(text),
  );
  const control = label?.querySelector("input, select");
  if (!(control instanceof HTMLElement))
    throw new Error(`missing label ${text}`);
  return control as T;
}

async function change(
  control: HTMLInputElement | HTMLSelectElement,
  value: string,
) {
  const prototype =
    control instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
    control,
    value,
  );
  await act(async () =>
    control.dispatchEvent(new Event("change", { bubbles: true })),
  );
}

describe("LinkInspector packaging intersteps", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
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
    await act(async () => root.render(<LinkInspector />));
  }

  it("enables the sole pair with belt defaults and renders exact plan math", async () => {
    mountState(baseLink);
    await render();
    const toggle = byLabel<HTMLInputElement>(host, "Package for transport");
    expect(toggle.checked).toBe(false);
    toggle.focus();
    expect(document.activeElement).toBe(toggle);
    await act(async () => toggle.click());

    expect(appStore.getState().links[0]).toMatchObject({
      transport: { mode: "belt" },
      interstep: {
        packageRecipeId: "package_water",
        clockPercentText: "100",
        returnTransport: { mode: "belt" },
      },
    });
    // The A3 figures line keeps the lowercase idiom + the packaging power.
    expect(host.textContent).toContain("1 package · 1 unpackage · 20 MW");
    // The strip's node boxes carry the per-group counts (#156 A2/A5).
    expect(host.textContent).toContain("1 ×");
    // The old flat "/min packaged" / "/min empty containers" prose is absorbed
    // into the strip's forward/return edge labels — same numbers, now named.
    expect(host.textContent).toContain("60/min Packaged Water · 1 belt");
    expect(host.textContent).toContain("60/min Empty Canister · 1 belt");
    // The endpoint labels are the from/to stage names (the strip's generalization).
    expect(host.textContent).toContain("Water Plant");
    expect(host.textContent).toContain("Factory");
    // The advisories block is OUTSIDE the restructured summary — untouched.
    expect(host.textContent).toContain("seed the loop with containers");
    expect(host.textContent).toContain("provide a separate return path");
    expect(host.textContent).toContain("apply ×2 to Water Plant");
  });

  it("edits pair, clock, and independent route modes without nested panels", async () => {
    mountState(
      {
        ...baseLink,
        transport: { mode: "belt" },
        interstep: {
          packageRecipeId: "package_water",
          clockPercentText: "100",
          returnTransport: { mode: "belt" },
        },
      },
      catalog(true),
    );
    await render();

    await change(
      byLabel<HTMLSelectElement>(host, "Packaging pair"),
      "package_water_alt",
    );
    await change(byLabel<HTMLInputElement>(host, "Packager clock %"), "50");
    await change(byLabel<HTMLSelectElement>(host, "Forward mode"), "truck");
    await change(
      byLabel<HTMLSelectElement>(host, "Empty return mode"),
      "train",
    );
    await change(
      byLabel<HTMLInputElement>(host, "Forward one-way distance (m)"),
      "900",
    );
    await change(
      byLabel<HTMLInputElement>(host, "Empty return one-way distance (m)"),
      "1200",
    );

    expect(appStore.getState().links[0]).toMatchObject({
      transport: {
        mode: "truck",
        trip: { kind: "estimated", distanceText: "900" },
      },
      interstep: {
        packageRecipeId: "package_water_alt",
        clockPercentText: "50",
        returnTransport: {
          mode: "train",
          trip: { kind: "estimated", distanceText: "1200" },
        },
      },
    });
    expect(
      host.querySelectorAll(".link-inspector-route .link-inspector-route"),
    ).toHaveLength(0);
    expect(host.querySelectorAll("select")).toHaveLength(3);
  });

  it("applies drawn distance to each train route without changing physical shared ends", async () => {
    mountState({
      ...baseLink,
      transport: {
        mode: "train",
        trip: { kind: "estimated", distanceText: "" },
        sharedEnds: { from: true },
      },
      interstep: {
        packageRecipeId: "package_water",
        clockPercentText: "100",
        returnTransport: {
          mode: "train",
          trip: { kind: "estimated", distanceText: "" },
          sharedEnds: { to: true },
        },
      },
    });
    await render();

    const buttons = [...host.querySelectorAll("button")];
    const forward = buttons.find((button) =>
      button.textContent?.includes("use drawn distance for Forward"),
    )!;
    const returned = buttons.find((button) =>
      button.textContent?.includes("use drawn distance for Empty return"),
    )!;
    await act(async () => forward.click());
    let saved = appStore.getState().links[0]!;
    expect(saved.transport).toMatchObject({
      mode: "train",
      trip: { kind: "estimated", distanceText: expect.any(String) },
      sharedEnds: { from: true },
    });
    expect(saved.interstep?.returnTransport).toEqual({
      mode: "train",
      trip: { kind: "estimated", distanceText: "" },
      sharedEnds: { to: true },
    });

    await act(async () => returned.click());
    saved = appStore.getState().links[0]!;
    expect(saved.transport).toMatchObject({ sharedEnds: { from: true } });
    expect(saved.interstep?.returnTransport).toMatchObject({
      mode: "train",
      trip: { kind: "estimated", distanceText: expect.any(String) },
      sharedEnds: { to: true },
    });
  });

  it("disables stale intent on a current fluid back to pipe", async () => {
    mountState({
      ...baseLink,
      transport: { mode: "belt" },
      interstep: {
        packageRecipeId: "removed_pair",
        clockPercentText: "100",
        returnTransport: { mode: "belt" },
      },
    });
    await render();
    expect(host.textContent).toContain("packaging pair is unavailable");
    await act(async () =>
      byLabel<HTMLInputElement>(host, "Package for transport").click(),
    );
    expect(appStore.getState().links[0]).toMatchObject({
      transport: { mode: "pipe" },
    });
    expect(appStore.getState().links[0]!.interstep).toBeUndefined();
  });

  it("disables stale intent even when the linked item disappeared", async () => {
    const missingItemCatalog = catalog();
    delete missingItemCatalog.items.water;
    mountState(
      {
        ...baseLink,
        interstep: {
          packageRecipeId: "removed_pair",
          clockPercentText: "bad",
          returnTransport: { mode: "belt" },
        },
      },
      missingItemCatalog,
    );
    await render();

    expect(host.textContent).toContain("water");
    expect(host.textContent).toContain("packaging pair is unavailable");
    expect(host.textContent).not.toContain("MW");
    const toggle = byLabel<HTMLInputElement>(host, "Package for transport");
    expect(toggle.checked).toBe(true);
    await act(async () => toggle.click());

    const recovered = appStore.getState().links[0]!;
    expect(recovered.interstep).toBeUndefined();
    expect(recovered.transport).toBeUndefined();
  });
});
