/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";

import { Fraction } from "../core/fraction.ts";
import type {
  Catalog,
  CatalogItem,
  CatalogMachine,
  CatalogRecipe,
} from "../data/types.ts";
import { appStore, createAppStore } from "../state/store.ts";
import { ChainBuilder } from "./ChainBuilder.tsx";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

let container: HTMLDivElement;
let root: Root;

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
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<ChainBuilder />);
  });
}

const $$ = <T extends Element>(sel: string): T[] =>
  Array.from(container.querySelectorAll<T>(sel));

function chooseTarget(itemId: string): void {
  const select = $$<HTMLSelectElement>(".chain-builder-controls select")[0]!;
  act(() => {
    select.value = itemId;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function chooseTier(value: string): void {
  const select = container.querySelector<HTMLSelectElement>(
    ".chain-builder-tier-select",
  )!;
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function typeInto(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function clickText(text: string): void {
  act(() => {
    $$<HTMLButtonElement>("button")
      .find((button) => button.textContent === text)!
      .click();
  });
}

function clickPropose(): void {
  clickText("Propose");
}

function toggleMachineExclusion(): void {
  const checkbox = container.querySelector<HTMLInputElement>(
    ".chain-builder-exclusions input[type='checkbox']",
  )!;
  act(() => {
    checkbox.click();
  });
}

function propose(): void {
  chooseTarget("pack");
  typeInto($$<HTMLInputElement>(".chain-builder-controls input")[0]!, "10");
  clickPropose();
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  storage.clear();
});

describe("ChainBuilder byproduct routing (#105)", () => {
  it("checks ROUTE and applies the selected byproduct StageLink", () => {
    mount();
    propose();

    const route = $$<HTMLInputElement>(
      'input[aria-label="route Resin from Fuel to Rubber"]',
    )[0]!;
    act(() => {
      route.click();
    });
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

    act(() => {
      $$<HTMLInputElement>(
        'input[aria-label="route Resin from Fuel to Rubber"]',
      )[0]!.click();
    });
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
    expect(container.querySelector(".chain-builder-error")).toBe(null);
  });

  it("drops a checked route when re-propose makes it non-routeable", () => {
    mount();
    propose();

    act(() => {
      $$<HTMLInputElement>(
        'input[aria-label="route Resin from Fuel to Rubber"]',
      )[0]!.click();
    });

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

    act(() => {
      $$<HTMLInputElement>(
        'input[aria-label="route Resin from Fuel to Rubber"]',
      )[0]!.click();
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
    const suggestion = container.querySelector<HTMLElement>(
      ".chain-builder-suggestion",
    )!;
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

    act(() => {
      $$<HTMLInputElement>(
        'input[aria-label="route Resin from Fuel to Rubber"]',
      )[0]!.click();
    });
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
      container.querySelector<HTMLElement>(".chain-builder-error")!.textContent,
    ).toBe("catalog changed; propose again");
    expect(container.querySelector(".chain-builder-preview")).toBe(null);
  });
});
