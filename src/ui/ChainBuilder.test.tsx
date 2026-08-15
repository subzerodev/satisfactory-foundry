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
import {
  parseRateText,
  parseClockText,
  totalOutputText,
  ChainBuilder,
} from "./ChainBuilder.tsx";

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

describe("parseClockText (S20 P2, (0, 250])", () => {
  it("accepts the 100 default → exact Fraction", () => {
    const r = parseClockText("100");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.eq(Fraction.from(100))).toBe(true);
  });

  it("accepts a fractional clock in range → exact Fraction", () => {
    const r = parseClockText("133.5");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.eq(Fraction.of(267, 2))).toBe(true);
  });

  it("accepts the upper bound 250", () => {
    const r = parseClockText("250");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.eq(Fraction.from(250))).toBe(true);
  });

  it("rejects garbage with the labeled error", () => {
    expect(parseClockText("nope")).toEqual({
      ok: false,
      error: "clock % must be a number in (0, 250]",
    });
  });

  it("rejects zero (non-positive)", () => {
    expect(parseClockText("0")).toEqual({
      ok: false,
      error: "clock % must be greater than 0",
    });
  });

  it("rejects a negative clock", () => {
    expect(parseClockText("-10")).toEqual({
      ok: false,
      error: "clock % must be greater than 0",
    });
  });

  it("rejects above 250 (past the shard-boosted max)", () => {
    expect(parseClockText("250.5")).toEqual({
      ok: false,
      error: "clock % must be at most 250",
    });
    expect(parseClockText("300")).toEqual({
      ok: false,
      error: "clock % must be at most 250",
    });
  });
});

describe("totalOutputText", () => {
  it("renders actual output only when it matches the requested rate", () => {
    expect(totalOutputText([{ depth: 0, outputRate: "60" }], "60")).toBe(
      "60/min",
    );
  });

  it("renders the requested rate when integer machine counts overshoot", () => {
    expect(totalOutputText([{ depth: 0, outputRate: "80" }], "61")).toBe(
      "80/min (asked 61/min)",
    );
  });

  it("returns a total fallback when there is no target row", () => {
    expect(totalOutputText([{ depth: 1, outputRate: "90" }], "60")).toBe("—");
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
