/**
 * @vitest-environment jsdom
 */

/**
 * ChainBuilder OUTPUT metric tests (#111).
 *
 * Like the gating/raw-target seam suites, this needs jsdom because the metric
 * lives behind component-local `preview` state set by the Propose click handler.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";

import { parseCatalogFromText } from "../data/catalog.ts";
import type { Catalog } from "../data/types.ts";
import { appStore } from "../state/store.ts";
import { ChainBuilder } from "./ChainBuilder.tsx";
import bundledDocsText from "../../public/bundled-docs/en-US.json?raw";

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

const catalog: Catalog = parseCatalogFromText(bundledDocsText);

let container: HTMLDivElement;
let root: Root;

function mount(): void {
  appStore.setState({
    catalog: { status: "ready", catalog },
    proposePrefs: {
      overrides: {},
      excludedMachineIds: ["converter", "packager"],
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

function chooseTarget(itemId: string): void {
  const select = $$<HTMLSelectElement>(".chain-builder-controls select")[0]!;
  act(() => {
    select.value = itemId;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function clickPropose(): void {
  act(() => {
    $$<HTMLButtonElement>(".chain-builder-controls button")
      .find((b) => b.textContent === "Propose")!
      .click();
  });
}

function propose(itemId: string, rate: string): void {
  chooseTarget(itemId);
  typeInto($$<HTMLInputElement>(".chain-builder-controls input")[0]!, rate);
  clickPropose();
}

function metricValue(label: string): string {
  const row = $$<HTMLDivElement>(".chain-builder-metrics > div").find(
    (div) => div.querySelector("dt")?.textContent === label,
  );
  return row?.querySelector("dd")?.textContent ?? "";
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  storage.clear();
});

describe("ChainBuilder OUTPUT metric (#111)", () => {
  it("shows actual target output and keeps the requested-rate snapshot after Rate drifts", () => {
    mount();
    propose("iron_plate", "61");

    expect(metricValue("OUTPUT")).toBe("80/min (asked 61/min)");

    typeInto($$<HTMLInputElement>(".chain-builder-controls input")[0]!, "999");

    expect(metricValue("OUTPUT")).toBe("80/min (asked 61/min)");
  });
});
