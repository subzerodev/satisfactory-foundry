// @vitest-environment jsdom

import { act, useState } from "react";
import type { ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { ReactFlowProvider } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Fraction } from "../core/fraction.ts";
import type { Catalog } from "../data/types.ts";
import type { StageNode } from "../state/store.ts";
import type { RawFlowNode } from "./graph-flow.ts";
import { ExtractionPanel, RawFeedNode } from "./GraphCanvas.tsx";

const F = Fraction.from;

function extractionCatalog(): Catalog {
  const power = (mw: number) => ({
    mw: F(mw),
    variable: false as const,
    exponent: Fraction.of(1321929, 1000000),
  });
  return {
    items: {
      stone: {
        id: "stone",
        displayName: "Limestone",
        isFluid: false,
        stackSize: F(100),
        isRawResource: true,
      },
      water: {
        id: "water",
        displayName: "Water",
        isFluid: true,
        stackSize: null,
        isRawResource: true,
      },
      liquid_oil: {
        id: "liquid_oil",
        displayName: "Crude Oil",
        isFluid: true,
        stackSize: null,
        isRawResource: true,
      },
      nitrogen_gas: {
        id: "nitrogen_gas",
        displayName: "Nitrogen Gas",
        isFluid: true,
        stackSize: null,
        isRawResource: true,
      },
    },
    machines: {
      miner_mk1: {
        id: "miner_mk1",
        displayName: "Miner Mk.1",
        power: power(5),
      },
      miner_mk3: {
        id: "miner_mk3",
        displayName: "Miner Mk.3",
        power: power(45),
      },
      water_pump: {
        id: "water_pump",
        displayName: "Water Extractor",
        power: power(20),
      },
      oil_pump: {
        id: "oil_pump",
        displayName: "Oil Extractor",
        power: power(40),
      },
      fracking_extractor: {
        id: "fracking_extractor",
        displayName: "Resource Well Extractor",
        power: power(0),
      },
    },
    recipes: {},
    tiers: {
      belt: [60, 120, 270, 480, 780, 1200].map(F),
      pipe: [300, 600].map(F),
    },
    recipeUnlocks: {},
    extractors: {
      miner_mk1: {
        machineId: "miner_mk1",
        topology: "standalone",
        normalRate: F(60),
        itemIds: ["stone"],
      },
      miner_mk3: {
        machineId: "miner_mk3",
        topology: "standalone",
        normalRate: F(240),
        itemIds: ["stone"],
      },
      water_pump: {
        machineId: "water_pump",
        topology: "standalone",
        normalRate: F(120),
        itemIds: ["water"],
      },
      oil_pump: {
        machineId: "oil_pump",
        topology: "standalone",
        normalRate: F(120),
        itemIds: ["liquid_oil"],
      },
      fracking_extractor: {
        machineId: "fracking_extractor",
        topology: "resource-well",
        normalRate: F(60),
        itemIds: ["water", "nitrogen_gas"],
      },
    },
  };
}

function rawNode(
  itemId: string,
  itemName: string,
  demand: number,
): RawFlowNode {
  return {
    id: `raw:s:${itemId}`,
    type: "rawFeed",
    position: { x: 0, y: 0 },
    width: 150,
    height: 44,
    handles: [],
    data: {
      stageId: "s",
      itemId,
      demand: F(demand),
      itemName,
      rateText: `${demand}/min`,
    },
  };
}

const stage: StageNode = {
  id: "s",
  name: "Concrete",
  selection: {
    recipeId: null,
    machineCount: 1,
    clockPercentText: "100",
    unlockedTiers: { belt: 4, pipe: 1 },
    overrides: { feeds: {}, outputs: {} },
  },
  solve: { status: "idle" },
};

async function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!.call(input, value);
  await act(async () =>
    input.dispatchEvent(new Event("input", { bubbles: true })),
  );
}

describe("RawFeedNode", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it("renders one native button and opens the exact raw identity once", async () => {
    const onOpen = vi.fn();
    await act(async () => {
      root.render(
        <ReactFlowProvider>
          <RawFeedNode
            {...({
              id: "raw:s:ore_iron",
              type: "rawFeed",
              selected: false,
              data: {
                stageId: "s",
                itemId: "ore_iron",
                demand: Fraction.of(100, 3),
                itemName: "Iron Ore",
                rateText: "100/3/min",
                onOpen,
              },
            } as unknown as ComponentProps<typeof RawFeedNode>)}
          />
        </ReactFlowProvider>,
      );
    });
    const buttons = host.querySelectorAll("button");
    expect(buttons).toHaveLength(1);
    const button = buttons[0]!;
    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    expect(button.getAttribute("aria-label")).toContain("Iron Ore");
    button.focus();
    expect(document.activeElement).toBe(button);
    await act(async () => button.click());
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith({ stageId: "s", itemId: "ore_iron" });
  });

  it("renders the exact Normal-purity plan and persists control edits", async () => {
    const onSetSelection = vi.fn();
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <ExtractionPanel
          catalog={extractionCatalog()}
          rawNode={rawNode("stone", "Limestone", 12720)}
          stage={stage}
          selection={{ machineId: "miner_mk3", clockPercentText: "100" }}
          onSetSelection={onSetSelection}
          onClose={onClose}
        />,
      );
    });
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.getAttribute("aria-modal")).toBe("false");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    expect(dialog.textContent).toContain("Normal baseline");
    expect(dialog.textContent).toContain("53 × Miner Mk.3");
    expect(dialog.textContent).toContain("2385 MW");

    const select = host.querySelector("select")!;
    select.value = "miner_mk1";
    await act(async () =>
      select.dispatchEvent(new Event("change", { bubbles: true })),
    );
    expect(onSetSelection).toHaveBeenCalledWith({
      machineId: "miner_mk1",
      clockPercentText: "100",
    });
    const input = host.querySelector("input")!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "250");
    await act(async () =>
      input.dispatchEvent(new Event("input", { bubbles: true })),
    );
    expect(onSetSelection).toHaveBeenCalledWith({
      machineId: "miner_mk3",
      clockPercentText: "250",
    });
    await act(async () => {
      root.render(
        <ExtractionPanel
          catalog={extractionCatalog()}
          rawNode={rawNode("stone", "Limestone", 12720)}
          stage={stage}
          selection={{ machineId: "miner_mk3", clockPercentText: "250" }}
          onSetSelection={onSetSelection}
          onClose={onClose}
        />,
      );
    });
    expect(host.textContent).toContain("22 × Miner Mk.3");
    expect(host.textContent).toContain("Mk5 belt required (not unlocked)");
    expect(host.textContent).not.toContain("12720/min exceeds");
    const close = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Close extraction planning"]',
    )!;
    expect(close.title).toBe("close extraction planning");
    await act(async () => close.click());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("enables, edits, preserves, and disables a solid node mix", async () => {
    const onSelection = vi.fn();

    function Harness() {
      const [selection, setSelection] = useState<
        ComponentProps<typeof ExtractionPanel>["selection"]
      >({ machineId: "miner_mk3", clockPercentText: "100" });
      return (
        <ExtractionPanel
          catalog={extractionCatalog()}
          rawNode={rawNode("stone", "Limestone", 12720)}
          stage={stage}
          selection={selection}
          onSetSelection={(next) => {
            onSelection(next);
            setSelection(next);
          }}
          onClose={vi.fn()}
        />
      );
    }

    await act(async () => root.render(<Harness />));
    const checkbox = host.querySelector<HTMLInputElement>(
      'input[aria-label="Use node mix"]',
    )!;
    expect(checkbox).not.toBeNull();
    expect(host.querySelector('input[aria-label="Impure nodes"]')).toBeNull();

    await act(async () => checkbox.click());
    expect(onSelection).toHaveBeenLastCalledWith({
      machineId: "miner_mk3",
      clockPercentText: "100",
      purityMix: { impure: "0", normal: "53", pure: "0" },
    });
    const impure = host.querySelector<HTMLInputElement>(
      'input[aria-label="Impure nodes"]',
    )!;
    const normal = host.querySelector<HTMLInputElement>(
      'input[aria-label="Normal nodes"]',
    )!;
    const pure = host.querySelector<HTMLInputElement>(
      'input[aria-label="Pure nodes"]',
    )!;
    expect([impure.value, normal.value, pure.value]).toEqual(["0", "53", "0"]);
    for (const input of [impure, normal, pure]) {
      expect(input.type).toBe("number");
      expect(input.min).toBe("0");
      expect(input.step).toBe("1");
    }

    await setInputValue(impure, "1");
    await setInputValue(normal, "2");
    await setInputValue(pure, "3");
    const purityMix = { impure: "1", normal: "2", pure: "3" };
    expect(onSelection).toHaveBeenLastCalledWith({
      machineId: "miner_mk3",
      clockPercentText: "100",
      purityMix,
    });
    expect(host.textContent).toContain("6 nodes");
    expect(host.textContent).toContain("2040/min supplied");
    expect(host.textContent).toContain("10680/min shortfall");
    expect(host.textContent).toContain("Output: Mk4 belt or better");
    expect(host.textContent).toContain("Power: 270 MW");

    const select = host.querySelector("select")!;
    select.value = "miner_mk1";
    await act(async () =>
      select.dispatchEvent(new Event("change", { bubbles: true })),
    );
    expect(onSelection).toHaveBeenLastCalledWith({
      machineId: "miner_mk1",
      clockPercentText: "100",
      purityMix,
    });

    const clock = host.querySelector<HTMLInputElement>(
      '.extraction-fields input[type="text"]',
    )!;
    await setInputValue(clock, "150");
    expect(onSelection).toHaveBeenLastCalledWith({
      machineId: "miner_mk1",
      clockPercentText: "150",
      purityMix,
    });

    await act(async () =>
      host
        .querySelector<HTMLInputElement>('input[aria-label="Use node mix"]')!
        .click(),
    );
    expect(onSelection).toHaveBeenLastCalledWith({
      machineId: "miner_mk1",
      clockPercentText: "150",
    });
    expect(host.querySelector('input[aria-label="Impure nodes"]')).toBeNull();
  });

  it("preserves invalid node text and associates its dynamic error with every mix input", async () => {
    const onSelection = vi.fn();

    function Harness() {
      const [selection, setSelection] = useState<
        ComponentProps<typeof ExtractionPanel>["selection"]
      >({
        machineId: "miner_mk3",
        clockPercentText: "100",
        purityMix: { impure: "0", normal: "0", pure: "0" },
      });
      return (
        <ExtractionPanel
          catalog={extractionCatalog()}
          rawNode={rawNode("stone", "Limestone", 12720)}
          stage={stage}
          selection={selection}
          onSetSelection={(next) => {
            onSelection(next);
            setSelection(next);
          }}
          onClose={vi.fn()}
        />
      );
    }

    await act(async () => root.render(<Harness />));
    const inputs = ["Impure nodes", "Normal nodes", "Pure nodes"].map((label) =>
      host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!,
    );
    expect(host.textContent).toContain("0 nodes");
    expect(host.textContent).toContain("0/min supplied");
    expect(host.textContent).toContain("12720/min shortfall");
    expect(host.textContent).toContain("Output: no node output.");
    expect(host.textContent).toContain("Power: 0 MW");
    for (const input of inputs) {
      expect(input.getAttribute("aria-invalid")).toBeNull();
      expect(input.getAttribute("aria-describedby")).toBeNull();
    }

    await setInputValue(inputs[1]!, "");
    expect(onSelection).toHaveBeenLastCalledWith({
      machineId: "miner_mk3",
      clockPercentText: "100",
      purityMix: { impure: "0", normal: "", pure: "0" },
    });
    expect(
      host.querySelector<HTMLInputElement>('input[aria-label="Normal nodes"]')!
        .value,
    ).toBe("");

    const error = host.querySelector<HTMLElement>(
      "#extraction-s-stone-purity-error",
    )!;
    expect(error).not.toBeNull();
    expect(error.getAttribute("role")).toBe("alert");
    expect(host.textContent).toContain(
      "Normal node count must be a base-10 nonnegative integer.",
    );
    for (const input of inputs) {
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(input.getAttribute("aria-describedby")).toBe(error.id);
    }
    expect(host.querySelector(".extraction-purity-result")).toBeNull();
    expect(host.textContent).not.toContain("0 nodes");
    expect(host.textContent).not.toContain("Output: no node output.");
  });

  it("offers node mixes for Oil but not Water", async () => {
    const renderResource = async (
      itemId: string,
      itemName: string,
      machineId: string,
    ) => {
      await act(async () => {
        root.render(
          <ExtractionPanel
            catalog={extractionCatalog()}
            rawNode={rawNode(itemId, itemName, 1200)}
            stage={stage}
            selection={{ machineId, clockPercentText: "100" }}
            onSetSelection={vi.fn()}
            onClose={vi.fn()}
          />,
        );
      });
    };

    await renderResource("water", "Water", "water_pump");
    expect(host.querySelector('input[aria-label="Use node mix"]')).toBeNull();

    await renderResource("liquid_oil", "Crude Oil", "oil_pump");
    expect(
      host.querySelector('input[aria-label="Use node mix"]'),
    ).not.toBeNull();
  });

  it("leaves a single-candidate solid unselected until the user chooses it", async () => {
    const onSetSelection = vi.fn();
    const catalog = extractionCatalog();
    catalog.extractors = { miner_mk3: catalog.extractors["miner_mk3"]! };
    await act(async () => {
      root.render(
        <ExtractionPanel
          catalog={catalog}
          rawNode={rawNode("stone", "Limestone", 12720)}
          stage={stage}
          selection={null}
          onSetSelection={onSetSelection}
          onClose={vi.fn()}
        />,
      );
    });

    expect(onSetSelection).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Choose an extractor");
  });

  it("auto-seeds Water into persisted state and names the Resource Well alternative", async () => {
    const onSetSelection = vi.fn();
    await act(async () => {
      root.render(
        <ExtractionPanel
          catalog={extractionCatalog()}
          rawNode={rawNode("water", "Water", 10600)}
          stage={stage}
          selection={null}
          onSetSelection={onSetSelection}
          onClose={vi.fn()}
        />,
      );
    });
    expect(onSetSelection).toHaveBeenCalledWith({
      machineId: "water_pump",
      clockPercentText: "100",
    });
    expect(host.textContent).toContain("Resource Well alternative not counted");
  });

  it.each([
    ["water", "Water", 10600],
    ["liquid_oil", "Crude Oil", 1200],
  ])(
    "allows clearing the auto-seeded %s extractor",
    async (itemId, name, demand) => {
      function Harness() {
        const [selection, setSelection] =
          useState<ComponentProps<typeof ExtractionPanel>["selection"]>(null);
        return (
          <ExtractionPanel
            catalog={extractionCatalog()}
            rawNode={rawNode(itemId, name, demand)}
            stage={stage}
            selection={selection}
            onSetSelection={setSelection}
            onClose={vi.fn()}
          />
        );
      }

      await act(async () => root.render(<Harness />));
      const select = host.querySelector("select")!;
      expect(select.value).not.toBe("");
      expect(host.textContent).toContain("Output: Pipe Mk1 or better");
      expect(host.textContent).not.toContain("Pipe Mk1 pipe");

      select.value = "";
      await act(async () =>
        select.dispatchEvent(new Event("change", { bubbles: true })),
      );

      expect(host.querySelector("select")!.value).toBe("");
      expect(host.textContent).toContain("Choose an extractor");
    },
  );

  it("removes stale output for an invalid clock and gives Nitrogen no miner count", async () => {
    await act(async () => {
      root.render(
        <ExtractionPanel
          catalog={extractionCatalog()}
          rawNode={rawNode("stone", "Limestone", 12720)}
          stage={stage}
          selection={{ machineId: "miner_mk3", clockPercentText: "bad" }}
          onSetSelection={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });
    expect(host.textContent).toContain("clock % must be a number in (0, 250]");
    expect(host.textContent).not.toContain("53 ×");

    await act(async () => {
      root.render(
        <ExtractionPanel
          catalog={extractionCatalog()}
          rawNode={rawNode("nitrogen_gas", "Nitrogen Gas", 600)}
          stage={stage}
          selection={null}
          onSetSelection={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });
    expect(host.querySelector("select")).toBeNull();
    expect(host.textContent).toContain("Resource Well Pressurizer");
    expect(host.textContent).not.toContain("Miner");
  });
});
