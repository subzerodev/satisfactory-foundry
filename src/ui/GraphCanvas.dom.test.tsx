// @vitest-environment jsdom

import { act } from "react";
import type { ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { ReactFlowProvider } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Fraction } from "../core/fraction.ts";
import { RawFeedNode } from "./GraphCanvas.tsx";

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
});
