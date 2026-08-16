/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { mountChainBuilder } from "./ChainBuilder.harness.tsx";

const renderState = vi.hoisted(() => ({ error: null as Error | null }));

vi.mock("./ChainBuilder.tsx", () => ({
  ChainBuilder: () => {
    if (renderState.error !== null) throw renderState.error;
    return null;
  },
}));

afterEach(() => {
  renderState.error = null;
  vi.restoreAllMocks();
});

describe("ChainBuilder harness cleanup contract", () => {
  it("rolls back a failed initial render and rethrows its original error", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("initial render failed");
    const childCount = document.body.childElementCount;
    renderState.error = error;

    let thrown: unknown;
    try {
      mountChainBuilder();
    } catch (caught) {
      thrown = caught;
    }

    expect(thrown).toBe(error);
    expect(document.body.childElementCount).toBe(childCount);
  });

  it("disconnects its container and permits repeated cleanup", () => {
    const harness = mountChainBuilder();

    harness.cleanup();

    expect(harness.container.isConnected).toBe(false);
    expect(() => harness.cleanup()).not.toThrow();
  });
});
