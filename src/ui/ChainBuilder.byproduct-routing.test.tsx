/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { act } from "react";

import { Fraction } from "../core/fraction.ts";
import type {
  Catalog,
  CatalogItem,
  CatalogMachine,
  CatalogRecipe,
} from "../data/types.ts";
import { appStore, createAppStore } from "../state/store.ts";
import {
  mountChainBuilder,
  type MountedChainBuilder,
} from "./ChainBuilder.harness.tsx";

const storage = vi.hoisted(() => {
  const memory = new Map<string, string>();
  const stub: Storage = {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => void memory.set(k, v),
    removeItem: (k) => void memory.delete(k),
    clear: () => memory.clear(),
    key: (i) => [...memory.keys()][i] ?? null,
    get length() {
      return memory.size;
    },
  };
  (globalThis as unknown as { localStorage: Storage }).localStorage = stub;
  return stub;
});

const F = (n: number): Fraction => Fraction.from(n);

function item(id: string, displayName: string): CatalogItem {
  return { id, displayName, isFluid: false, stackSize: F(100) };
}

function machine(id: string): CatalogMachine {
  return {
    id,
    displayName: id,
    power: { mw: F(4), variable: false, exponent: F(1) },
  };
}

function recipe(
  id: string,
  displayName: string,
  outputs: Array<[string, number]>,
  inputs: Array<[string, number]>,
): CatalogRecipe {
  const out = outputs.map(([itemId, perMinute]) => ({
    itemId,
    perMinute: F(perMinute),
  }));
  return {
    id,
    displayName,
    machineId: "refinery",
    isAlternate: false,
    primaryOutputId: out[0]!.itemId,
    outputs: out,
    inputs: inputs.map(([itemId, perMinute]) => ({
      itemId,
      perMinute: F(perMinute),
    })),
  };
}

function routeCatalog(): Catalog {
  const recipes = [
    recipe(
      "r_pack",
      "Pack",
      [["pack", 10]],
      [
        ["fuel", 20],
        ["rubber", 20],
      ],
    ),
    recipe(
      "r_fuel",
      "Fuel",
      [
        ["fuel", 20],
        ["resin", 10],
      ],
      [["oil", 30]],
    ),
    recipe("r_rubber", "Rubber", [["rubber", 20]], [["resin", 30]]),
    recipe("r_plastic", "Plastic", [["plastic", 20]], [["resin", 10]]),
  ];
  return {
    items: Object.fromEntries(
      [
        item("oil", "Oil"),
        item("fuel", "Fuel"),
        item("resin", "Resin"),
        item("rubber", "Rubber"),
        item("plastic", "Plastic"),
        item("pack", "Pack"),
      ].map((i) => [i.id, i]),
    ),
    machines: { refinery: machine("refinery") },
    recipes: Object.fromEntries(recipes.map((r) => [r.id, r])),
    tiers: { belt: [F(60)], pipe: [F(300)] },
    recipeUnlocks: { r_pack: 0 },
  };
}

function routeCatalogWithFanOut(): Catalog {
  const cat = routeCatalog();
  return {
    ...cat,
    recipes: {
      ...cat.recipes,
      r_pack: {
        ...cat.recipes["r_pack"]!,
        inputs: [
          ...cat.recipes["r_pack"]!.inputs,
          { itemId: "plastic", perMinute: F(20) },
        ],
      },
    },
  };
}

function routeCatalogWithPlasticSource(): Catalog {
  const cat = routeCatalog();
  return {
    ...cat,
    recipes: {
      ...cat.recipes,
      r_pack: recipe(
        "r_pack",
        "Pack",
        [["pack", 10]],
        [
          ["fuel", 20],
          ["rubber", 20],
          ["plastic", 20],
        ],
      ),
      r_fuel: recipe("r_fuel", "Fuel", [["fuel", 20]], [["oil", 30]]),
      r_plastic: recipe(
        "r_plastic",
        "Plastic",
        [
          ["plastic", 20],
          ["resin", 10],
        ],
        [["oil", 30]],
      ),
    },
  };
}

function routeCatalogWithLiveNames(): Catalog {
  const cat = routeCatalog();
  return {
    ...cat,
    items: {
      ...cat.items,
      fuel: item("fuel", "Live Fuel"),
      resin: item("resin", "Live Resin"),
      rubber: item("rubber", "Live Rubber"),
    },
  };
}

function routeCatalogWithoutRubberInput(): Catalog {
  const cat = routeCatalog();
  return {
    ...cat,
    recipes: {
      ...cat.recipes,
      r_rubber: recipe("r_rubber", "Rubber", [["rubber", 20]], []),
    },
  };
}

let harness: MountedChainBuilder | null = null;

function mount(): void {
  const fresh = createAppStore(storage).getState();
  appStore.setState({
    stages: fresh.stages,
    stageOrder: fresh.stageOrder,
    activeStageId: fresh.activeStageId,
    links: [],
    reconciliation: [],
    selectedLinkId: null,
    positions: fresh.positions,
    placementSeq: fresh.placementSeq,
    flowDirection: fresh.flowDirection,
    userPlaced: {},
    selection: fresh.selection,
    solve: fresh.solve,
    catalog: { status: "ready", catalog: routeCatalog() },
    proposePrefs: {
      overrides: {},
      excludedMachineIds: [],
      unlockedTier: null,
    },
  });
  harness = mountChainBuilder();
}

const $$ = <T extends Element>(sel: string): T[] => harness!.queryAll<T>(sel);

function chooseTier(value: string): void {
  const select = harness!.query<HTMLSelectElement>(
    ".chain-builder-tier-select",
  );
  harness!.chooseOption(select, value);
}

function typeInto(el: HTMLInputElement, value: string): void {
  harness!.typeInto(el, value);
}

function clickText(text: string): void {
  harness!.click(
    $$<HTMLButtonElement>("button").find(
      (button) => button.textContent === text,
    )!,
  );
}

function toggleMachineExclusion(): void {
  const checkbox = harness!.query<HTMLInputElement>(
    ".chain-builder-exclusions input[type='checkbox']",
  );
  harness!.click(checkbox);
}

function propose(): void {
  harness!.propose("pack", "10");
}

afterEach(() => {
  harness?.cleanup();
  harness = null;
  storage.clear();
});

describe("ChainBuilder byproduct routing (#105)", () => {
  it("checks ROUTE and applies the selected byproduct StageLink", () => {
    mount();
    propose();

    const route = $$<HTMLInputElement>(
      'input[aria-label="route Resin from Fuel to Rubber"]',
    )[0]!;
    harness!.click(route);
    clickText("Apply");

    const s = appStore.getState();
    const byRecipe = new Map(
      s.stageOrder.map((id) => [s.stages[id]!.selection.recipeId, id]),
    );
    expect(s.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromStageId: byRecipe.get("r_fuel"),
          itemId: "resin",
          toStageId: byRecipe.get("r_rubber"),
        }),
      ]),
    );
  });

  it("applies a tier-gated preview against its unchanged base catalog", () => {
    mount();
    propose();
    chooseTier("0");

    harness!.click(
      $$<HTMLInputElement>(
        'input[aria-label="route Resin from Fuel to Rubber"]',
      )[0]!,
    );
    clickText("Apply");

    const s = appStore.getState();
    const byRecipe = new Map(
      s.stageOrder.map((id) => [s.stages[id]!.selection.recipeId, id]),
    );
    expect(s.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromStageId: byRecipe.get("r_fuel"),
          itemId: "resin",
          toStageId: byRecipe.get("r_rubber"),
        }),
      ]),
    );
    expect(harness!.container.querySelector(".chain-builder-error")).toBe(null);
  });

  it("drops a checked route when re-propose makes it non-routeable", () => {
    mount();
    propose();

    harness!.click(
      $$<HTMLInputElement>(
        'input[aria-label="route Resin from Fuel to Rubber"]',
      )[0]!,
    );

    act(() => {
      appStore.setState({
        catalog: { status: "ready", catalog: routeCatalogWithFanOut() },
      });
    });
    toggleMachineExclusion();

    expect(
      $$<HTMLInputElement>(
        'input[aria-label="route Resin from Fuel to Rubber"]',
      ),
    ).toHaveLength(0);

    act(() => {
      appStore.setState({
        catalog: { status: "ready", catalog: routeCatalog() },
      });
    });
    toggleMachineExclusion();

    const restoredRoute = $$<HTMLInputElement>(
      'input[aria-label="route Resin from Fuel to Rubber"]',
    )[0]!;
    expect(restoredRoute.checked).toBe(false);
    clickText("Apply");

    expect(appStore.getState().links.some((l) => l.itemId === "resin")).toBe(
      false,
    );
  });

  it("drops a selected full route key when the same display row changes source", () => {
    mount();
    propose();

    harness!.click(
      $$<HTMLInputElement>(
        'input[aria-label="route Resin from Fuel to Rubber"]',
      )[0]!,
    );
    act(() => {
      appStore.setState({
        catalog: { status: "ready", catalog: routeCatalogWithPlasticSource() },
      });
    });
    chooseTier("0");

    expect(
      $$<HTMLInputElement>(
        'input[aria-label="route Resin from Fuel to Rubber"]',
      ),
    ).toHaveLength(0);
    expect(
      $$<HTMLInputElement>(
        'input[aria-label="route Resin from Plastic to Rubber"]',
      )[0]!.checked,
    ).toBe(false);

    act(() => {
      appStore.setState({
        catalog: { status: "ready", catalog: routeCatalog() },
      });
    });
    chooseTier("");

    expect(
      $$<HTMLInputElement>(
        'input[aria-label="route Resin from Fuel to Rubber"]',
      )[0]!.checked,
    ).toBe(false);
  });

  it("keeps route labels in preview.gated after a tier re-propose fails", () => {
    mount();
    propose();

    typeInto($$<HTMLInputElement>(".chain-builder-controls input")[0]!, "bad");
    act(() => {
      appStore.setState({
        catalog: { status: "ready", catalog: routeCatalogWithLiveNames() },
      });
    });
    chooseTier("0");

    expect(
      $$<HTMLInputElement>(
        'input[aria-label="route Resin from Fuel to Rubber"]',
      ),
    ).toHaveLength(1);
    const suggestion = harness!.query<HTMLElement>(".chain-builder-suggestion");
    expect(suggestion.textContent).toContain(
      "from Fuel: Resin could feed Rubber",
    );
    expect(suggestion.textContent).not.toContain("Live Resin");
  });

  it("keeps routeability in preview.gated after a tier re-propose fails", () => {
    mount();
    propose();

    typeInto($$<HTMLInputElement>(".chain-builder-controls input")[0]!, "bad");
    act(() => {
      appStore.setState({
        catalog: {
          status: "ready",
          catalog: routeCatalogWithoutRubberInput(),
        },
      });
    });
    chooseTier("");

    expect(
      $$<HTMLInputElement>(
        'input[aria-label="route Resin from Fuel to Rubber"]',
      ),
    ).toHaveLength(1);
  });

  it("refuses Apply after the base catalog replaces the preview snapshot", () => {
    mount();
    propose();

    harness!.click(
      $$<HTMLInputElement>(
        'input[aria-label="route Resin from Fuel to Rubber"]',
      )[0]!,
    );
    const beforeStageOrder = appStore.getState().stageOrder;
    const beforeLinks = appStore.getState().links;

    act(() => {
      appStore.setState({
        catalog: {
          status: "ready",
          catalog: routeCatalogWithoutRubberInput(),
        },
      });
    });
    clickText("Apply");

    expect(appStore.getState().stageOrder).toEqual(beforeStageOrder);
    expect(appStore.getState().links).toEqual(beforeLinks);
    expect(
      harness!.query<HTMLElement>(".chain-builder-error").textContent,
    ).toBe("catalog changed; propose again");
    expect(harness!.container.querySelector(".chain-builder-preview")).toBe(
      null,
    );
  });
});
