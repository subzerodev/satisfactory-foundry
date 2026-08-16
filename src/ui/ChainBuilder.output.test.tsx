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

import { parseCatalogFromText } from "../data/catalog.ts";
import type { Catalog } from "../data/types.ts";
import { appStore } from "../state/store.ts";
import {
  mountChainBuilder,
  type MountedChainBuilder,
} from "./ChainBuilder.harness.tsx";
import bundledDocsText from "../../public/bundled-docs/en-US.json?raw";

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

let harness: MountedChainBuilder | null = null;

function mount(): void {
  appStore.setState({
    catalog: { status: "ready", catalog },
    proposePrefs: {
      overrides: {},
      excludedMachineIds: ["converter", "packager"],
      unlockedTier: null,
    },
  });
  harness = mountChainBuilder();
}

const $$ = <T extends Element>(sel: string): T[] => harness!.queryAll<T>(sel);

function propose(itemId: string, rate: string): void {
  harness!.propose(itemId, rate);
}

function metricValue(label: string): string {
  const row = $$<HTMLDivElement>(".chain-builder-metrics > div").find(
    (div) => div.querySelector("dt")?.textContent === label,
  );
  return row?.querySelector("dd")?.textContent ?? "";
}

afterEach(() => {
  harness?.cleanup();
  harness = null;
  storage.clear();
});

describe("ChainBuilder OUTPUT metric (#111)", () => {
  it("shows actual target output and keeps the requested-rate snapshot after Rate drifts", () => {
    mount();
    propose("iron_plate", "61");

    expect(metricValue("OUTPUT")).toBe("80/min (asked 61/min)");

    harness!.typeInto(
      $$<HTMLInputElement>(".chain-builder-controls input")[0]!,
      "999",
    );

    expect(metricValue("OUTPUT")).toBe("80/min (asked 61/min)");
  });
});
