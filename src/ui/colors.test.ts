import { describe, it, expect } from "vitest";
import { Fraction } from "../core/fraction.ts";
import { TIER_TABLE } from "../data/tiers.ts";
import { TIER_COLORS, OVERRIDE_COLOR, colorForCapacity } from "./colors.ts";
import { FIXTURE_TIERS } from "./fixtures.ts";

describe("TIER_COLORS", () => {
  it("has one color per tier in the full TIER_TABLE", () => {
    expect(TIER_COLORS.belt.length).toBe(TIER_TABLE.belt.length);
    expect(TIER_COLORS.pipe.length).toBe(TIER_TABLE.pipe.length);
  });
});

describe("colorForCapacity", () => {
  it("resolves a belt tier to its positional color", () => {
    expect(colorForCapacity("belt", Fraction.from(60), FIXTURE_TIERS)).toBe(
      TIER_COLORS.belt[0],
    );
    expect(colorForCapacity("belt", Fraction.from(480), FIXTURE_TIERS)).toBe(
      TIER_COLORS.belt[3],
    );
  });

  it("resolves belt and pipe independently at the same position", () => {
    // 300 is pipe tier 0, not any belt tier — kinds must not cross-match.
    expect(colorForCapacity("pipe", Fraction.from(300), FIXTURE_TIERS)).toBe(
      TIER_COLORS.pipe[0],
    );
    expect(colorForCapacity("belt", Fraction.from(300), FIXTURE_TIERS)).toBe(
      OVERRIDE_COLOR,
    );
  });

  it("falls back to the override color for a non-tier capacity", () => {
    expect(colorForCapacity("belt", Fraction.from(90), FIXTURE_TIERS)).toBe(
      OVERRIDE_COLOR,
    );
  });
});
