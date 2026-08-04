/**
 * ChainBuilder tests (Stage 8 / Phase 3, ticket #39). Node env, no jsdom — the
 * component's behavior lives in exported pure helpers (parseRateText) + the
 * adapter's preview helpers (pinned in chain-builder-adapter.test); the render
 * is SSR-string smoke only (the GraphCanvas-exclusion posture: the browser walk
 * is the visual gate). Interactive propose→preview→apply is the browser walk.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { Fraction } from "../core/fraction.ts";
import { parseRateText, ChainBuilder } from "./ChainBuilder.tsx";

describe("parseRateText", () => {
  it("accepts a positive decimal → exact Fraction", () => {
    const r = parseRateText("37.5");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.eq(Fraction.of(75, 2))).toBe(true);
  });

  it("rejects garbage with the labeled error", () => {
    const r = parseRateText("not-a-number");
    expect(r).toEqual({ ok: false, error: "rate must be a positive number" });
  });

  it("rejects the empty string", () => {
    expect(parseRateText("")).toEqual({
      ok: false,
      error: "rate must be a positive number",
    });
  });

  it("rejects zero (non-positive)", () => {
    expect(parseRateText("0")).toEqual({
      ok: false,
      error: "rate must be greater than 0",
    });
  });

  it("rejects a negative rate", () => {
    expect(parseRateText("-5")).toEqual({
      ok: false,
      error: "rate must be greater than 0",
    });
  });
});

describe("ChainBuilder render smoke", () => {
  it("renders nothing (null) when the singleton store's catalog isn't ready", () => {
    // In node the app-wide store boots to `initializing`, so the component
    // self-gates to null — an empty string, no crash. The populated preview
    // flow is the browser-walk gate.
    const html = renderToStaticMarkup(<ChainBuilder />);
    expect(html).toBe("");
  });
});
