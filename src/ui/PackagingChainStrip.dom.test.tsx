// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Fraction } from "../core/fraction.ts";
import type { ReadyLinkPlan } from "../core/link-plan.ts";
import { PackagingChainStrip } from "./PackagingChainStrip.tsx";

const F = Fraction.from;

/** A ready plan carrying only the fields the strip reads; the unread fields
 *  (pair / power / transports) are stubbed — the strip is presentational and
 *  never touches them. `overrides` decouples the sized vs unsized cases. */
function readyPlan(overrides: Partial<ReadyLinkPlan> = {}): ReadyLinkPlan {
  const belt = { kind: "unsolved", mode: "belt" } as const;
  return {
    status: "ready",
    pair: {} as ReadyLinkPlan["pair"],
    packagedItemId: "packaged_water",
    containerItemId: "empty_canister",
    materialSupply: F(600),
    materialDemand: F(600),
    cargoSupply: F(600),
    cargoDemand: F(600),
    containerReturnRate: F(600),
    packageMachines: 10,
    unpackageMachines: 5,
    power: null,
    forwardTransport: belt,
    returnTransport: belt,
    ...overrides,
  };
}

const baseProps = {
  leftLabel: "Water Extractor ×5",
  rightLabel: "Delivery",
  feedName: "Water",
  packagedName: "Packaged Water",
  deliveredName: "Water",
  containerName: "Empty Canister",
  forwardRouteText: "9 belts",
  returnRouteText: "9 belts",
};

describe("PackagingChainStrip", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("renders both node boxes with their machine counts", async () => {
    await act(async () =>
      root.render(<PackagingChainStrip plan={readyPlan()} {...baseProps} />),
    );
    // Two node rects, one per group.
    expect(host.querySelectorAll("rect.pcs-node")).toHaveLength(2);
    expect(host.textContent).toContain("10 ×");
    expect(host.textContent).toContain("Packager");
    expect(host.textContent).toContain("5 ×");
    expect(host.textContent).toContain("Unpackager");
  });

  it("names both packaged and container items", async () => {
    await act(async () =>
      root.render(<PackagingChainStrip plan={readyPlan()} {...baseProps} />),
    );
    expect(host.textContent).toContain("Packaged Water");
    expect(host.textContent).toContain("Empty Canister");
  });

  it("shows the feed, forward, and return rates with their route texts", async () => {
    await act(async () =>
      root.render(<PackagingChainStrip plan={readyPlan()} {...baseProps} />),
    );
    // Feed label: demand-rate fluid entering the packager.
    expect(host.textContent).toContain("600/min Water");
    // Forward edge: cargo rate · packaged name · route.
    expect(host.textContent).toContain("600/min Packaged Water · 9 belts");
    // Return loop: container-return rate · empty container · route.
    expect(host.textContent).toContain("600/min Empty Canister · 9 belts");
  });

  it("carries the endpoint labels", async () => {
    await act(async () =>
      root.render(<PackagingChainStrip plan={readyPlan()} {...baseProps} />),
    );
    expect(host.textContent).toContain("Water Extractor ×5");
    expect(host.textContent).toContain("Delivery");
  });

  it("draws the dashed return-loop under-path", async () => {
    await act(async () =>
      root.render(<PackagingChainStrip plan={readyPlan()} {...baseProps} />),
    );
    const returnPath = host.querySelector("path.pcs-return");
    expect(returnPath).not.toBeNull();
    // The path runs right → left (from the unpackager x back toward the packager x).
    expect(returnPath!.getAttribute("d")).toContain("L64 108");
  });

  it("renders '—' for every figure when the plan is unsized", async () => {
    await act(async () =>
      root.render(
        <PackagingChainStrip
          plan={readyPlan({
            packageMachines: null,
            unpackageMachines: null,
            materialDemand: null,
            cargoDemand: null,
            containerReturnRate: null,
          })}
          {...baseProps}
        />,
      ),
    );
    // Every count and rate collapses to "—"; no invented number leaks.
    expect(host.textContent).toContain("— ×");
    expect(host.textContent).toContain("— Packaged Water · 9 belts");
    expect(host.textContent).toContain("— Empty Canister · 9 belts");
    expect(host.textContent).not.toMatch(/\d+\/min/);
  });
});
