import { describe, it, expect } from "vitest";
import { Fraction } from "../core/fraction.ts";
import type { Finding, FeedBelt, BreakoutBelt } from "../core/manifold.ts";
import { FIXTURE_TIERS } from "./fixtures.ts";
import {
  formatRate,
  tierLabel,
  beltLabel,
  segTooltip,
  findingText,
} from "./format.ts";

describe("formatRate", () => {
  it("prints integers bare", () => {
    expect(formatRate(Fraction.from(600))).toBe("600");
  });

  it("prints terminating decimals at the smallest round-tripping dp", () => {
    expect(formatRate(Fraction.of(75, 2))).toBe("37.5");
    expect(formatRate(Fraction.of(1, 4))).toBe("0.25");
    expect(formatRate(Fraction.of(1, 2))).toBe("0.5");
    expect(formatRate(Fraction.of(1, 8))).toBe("0.125");
    expect(formatRate(Fraction.of(1, 16))).toBe("0.0625");
  });

  it("falls back to the exact fraction past 4dp", () => {
    expect(formatRate(Fraction.of(1, 3))).toBe("1/3");
    expect(formatRate(Fraction.of(1, 32))).toBe("1/32");
  });
});

describe("tierLabel", () => {
  it("returns the bare belt tier token", () => {
    expect(tierLabel("belt", Fraction.from(120), FIXTURE_TIERS)).toBe("Mk2");
    expect(tierLabel("belt", Fraction.from(480), FIXTURE_TIERS)).toBe("Mk4");
  });

  it("returns the bare pipe tier token", () => {
    expect(tierLabel("pipe", Fraction.from(300), FIXTURE_TIERS)).toBe(
      "Pipe Mk1",
    );
    expect(tierLabel("pipe", Fraction.from(600), FIXTURE_TIERS)).toBe(
      "Pipe Mk2",
    );
  });

  it("falls back to custom for a non-tier capacity", () => {
    expect(tierLabel("belt", Fraction.from(90), FIXTURE_TIERS)).toBe("custom");
  });
});

describe("beltLabel", () => {
  it("matches the mockup feed string exactly", () => {
    const belt: FeedBelt = {
      index: 1,
      capacity: Fraction.from(120),
      overridden: false,
      entersAfterMachine: 16,
    };
    expect(beltLabel("feed", 1, belt, "belt", FIXTURE_TIERS)).toBe(
      "Feed 2 — Mk2 · 120/min · enters after machine 16",
    );
  });

  it("prints the head form when a feed belt enters at the head", () => {
    const belt: FeedBelt = {
      index: 0,
      capacity: Fraction.from(480),
      overridden: false,
      entersAfterMachine: 0,
    };
    expect(beltLabel("feed", 0, belt, "belt", FIXTURE_TIERS)).toBe(
      "Feed 1 — Mk4 · 480/min · enters at head",
    );
  });

  it("prints a custom-override feed label", () => {
    const belt: FeedBelt = {
      index: 0,
      capacity: Fraction.from(90),
      overridden: true,
      entersAfterMachine: 0,
    };
    expect(beltLabel("feed", 0, belt, "belt", FIXTURE_TIERS)).toBe(
      "Feed 1 — custom · 90/min · enters at head",
    );
  });

  it("prints the output load form", () => {
    const belt: BreakoutBelt = {
      index: 1,
      capacity: Fraction.from(120),
      startsAfterMachine: 16,
      load: Fraction.from(120),
    };
    expect(beltLabel("output", 1, belt, "belt", FIXTURE_TIERS)).toBe(
      "Out 2 — Mk2 · 120/min load · breaks out after machine 16",
    );
  });

  it("prints the output from-head form", () => {
    const belt: BreakoutBelt = {
      index: 0,
      capacity: Fraction.from(480),
      startsAfterMachine: 0,
      load: Fraction.from(480),
    };
    expect(beltLabel("output", 0, belt, "belt", FIXTURE_TIERS)).toBe(
      "Out 1 — Mk4 · 480/min load · from machine 1",
    );
  });
});

describe("segTooltip", () => {
  it("renders a non-terminal feed stretch's entry → hand-off vocabulary", () => {
    // The P2 D3 rewrite: an interior feed stretch reads its reset entry flow and
    // the onward hand-off, plus the bus capacity — no "peak" anywhere.
    expect(
      segTooltip(
        {
          fromMachine: 1,
          toMachine: 16,
          entryFlow: Fraction.from(480),
          handoffResidue: Fraction.from(60),
        },
        "480",
        "feed",
        false,
      ),
    ).toBe("machines 1–16 · entry 480/min → hand-off 60/min · bus 480/min");
  });

  it("renders a terminal feed stretch's surplus as spare capacity, not flow", () => {
    // Caveat 1: onward flow is 0; the positive handoffResidue is spare belt
    // capacity, surfaced textually — NEVER as departing flow.
    expect(
      segTooltip(
        {
          fromMachine: 17,
          toMachine: 20,
          entryFlow: Fraction.from(270),
          handoffResidue: Fraction.from(30),
        },
        "480",
        "feed",
        true,
      ),
    ).toBe(
      "machines 17–20 · entry 270/min → 0/min onward · 30/min spare belt capacity",
    );
  });

  it("omits the spare clause on a demand-exact terminal feed stretch", () => {
    expect(
      segTooltip(
        {
          fromMachine: 17,
          toMachine: 20,
          entryFlow: Fraction.from(270),
          handoffResidue: Fraction.from(0),
        },
        "480",
        "feed",
        true,
      ),
    ).toBe("machines 17–20 · entry 270/min → 0/min onward");
  });

  it("renders an output stretch as a flat collects-of-bus line", () => {
    // Output: entryFlow = the span's load, handoff always 0; a break-out belt's
    // load is flat, so no taper vocabulary — "collects N of B".
    expect(
      segTooltip(
        {
          fromMachine: 17,
          toMachine: 17,
          entryFlow: Fraction.of(75, 2),
          handoffResidue: Fraction.from(0),
        },
        "60",
        "output",
        false,
      ),
    ).toBe("machines 17–17 · collects 37.5/min of 60/min");
  });

  it("keeps the word peak out of every segTooltip shape (caveat 2 gate)", () => {
    const shapes = [
      segTooltip(
        {
          fromMachine: 1,
          toMachine: 16,
          entryFlow: Fraction.from(480),
          handoffResidue: Fraction.from(60),
        },
        "480",
        "feed",
        false,
      ),
      segTooltip(
        {
          fromMachine: 17,
          toMachine: 20,
          entryFlow: Fraction.from(270),
          handoffResidue: Fraction.from(30),
        },
        "480",
        "feed",
        true,
      ),
      segTooltip(
        {
          fromMachine: 17,
          toMachine: 17,
          entryFlow: Fraction.of(75, 2),
          handoffResidue: Fraction.from(0),
        },
        "60",
        "output",
        false,
      ),
    ];
    for (const s of shapes) expect(s).not.toContain("peak");
  });
});

describe("findingText", () => {
  const name = (id: string) => (id === "ore_iron" ? "Iron Ore" : id);

  it("phrases infeasible-machine-demand", () => {
    const f: Finding = {
      type: "infeasible-machine-demand",
      itemId: "ore_iron",
      demand: Fraction.from(500),
      topCapacity: Fraction.from(480),
    };
    expect(findingText(f, name)).toBe(
      "Iron Ore: one machine needs 500/min — more than the best unlocked tier carries (480/min). No manifold can serve it; unlock a higher tier or lower the clock.",
    );
  });

  it("phrases segment-over-capacity", () => {
    const f: Finding = {
      type: "segment-over-capacity",
      itemId: "ore_iron",
      fromMachine: 9,
      toMachine: 16,
      flow: Fraction.from(540),
      busCapacity: Fraction.from(480),
    };
    expect(findingText(f, name)).toBe(
      "Iron Ore: bus over capacity between machines 9–16 — peak 540/min exceeds 480/min.",
    );
  });

  it("phrases lane-undersupplied with the nominal-ceiling caveat", () => {
    const f: Finding = {
      type: "lane-undersupplied",
      itemId: "ore_iron",
      shortfall: Fraction.from(450),
      nominalCeiling: true,
    };
    expect(findingText(f, name)).toBe(
      "Iron Ore: lane under-supplied by 450/min (nominal pipe ceiling).",
    );
  });

  it("phrases starved-machines with neither range nor partial", () => {
    const f: Finding = { type: "starved-machines", itemId: "ore_iron" };
    expect(findingText(f, name)).toBe("Iron Ore: machines starve");
  });

  it("phrases starved-machines with a range", () => {
    const f: Finding = {
      type: "starved-machines",
      itemId: "ore_iron",
      starvedFrom: 12,
      starvedTo: 16,
    };
    expect(findingText(f, name)).toBe(
      "Iron Ore: machines starve from machine 12 to 16",
    );
  });

  it("phrases starved-machines with a partial", () => {
    const f: Finding = {
      type: "starved-machines",
      itemId: "ore_iron",
      partial: {
        machine: 11,
        received: Fraction.from(20),
        shortfall: Fraction.from(10),
      },
    };
    expect(findingText(f, name)).toBe(
      "Iron Ore: machines starve (machine 11 receives 20/min, short 10/min)",
    );
  });

  it("phrases starved-machines with both range and partial", () => {
    const f: Finding = {
      type: "starved-machines",
      itemId: "ore_iron",
      partial: {
        machine: 11,
        received: Fraction.from(20),
        shortfall: Fraction.from(10),
      },
      starvedFrom: 12,
      starvedTo: 16,
    };
    expect(findingText(f, name)).toBe(
      "Iron Ore: machines starve from machine 12 to 16 (machine 11 receives 20/min, short 10/min)",
    );
  });

  it("phrases invalid-input", () => {
    const f: Finding = {
      type: "invalid-input",
      reason: "negative-rate",
      detail: "lane ore_iron has -1.",
    };
    expect(findingText(f, name)).toBe("Invalid input: lane ore_iron has -1.");
  });
});
