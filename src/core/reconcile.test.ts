import { Fraction } from "./fraction.ts";
import { reconcileLinks } from "./reconcile.ts";
import type { LinkInput, LinkFinding } from "./reconcile.ts";

// reconcileLinks is per-link-local, exact-Fraction comparison of totals. These
// tables pin every branch: under/over/exact with integer AND fractional (75/2-
// class) rates, and every lane-absence combination (from / to / both).

describe("reconcileLinks — supply vs demand comparison", () => {
  const cases: Array<{
    name: string;
    supply: Fraction;
    demand: Fraction;
    expected: LinkFinding[];
  }> = [
    {
      name: "exact match → no finding",
      supply: Fraction.from(60),
      demand: Fraction.from(60),
      expected: [],
    },
    {
      name: "under-supply → shortfall = demand − supply",
      supply: Fraction.from(30),
      demand: Fraction.from(60),
      expected: [
        {
          type: "under-supply",
          linkId: "L",
          supply: Fraction.from(30),
          demand: Fraction.from(60),
          shortfall: Fraction.from(30),
        },
      ],
    },
    {
      name: "over-supply → surplus = supply − demand",
      supply: Fraction.from(90),
      demand: Fraction.from(60),
      expected: [
        {
          type: "over-supply",
          linkId: "L",
          supply: Fraction.from(90),
          demand: Fraction.from(60),
          surplus: Fraction.from(30),
        },
      ],
    },
    {
      name: "fractional exact match (75/2 = 75/2) → no finding",
      supply: Fraction.of(75, 2),
      demand: Fraction.of(75, 2),
      expected: [],
    },
    {
      name: "fractional under-supply → exact fractional shortfall",
      supply: Fraction.of(75, 2), // 37.5
      demand: Fraction.of(80, 1), // 80
      expected: [
        {
          type: "under-supply",
          linkId: "L",
          supply: Fraction.of(75, 2),
          demand: Fraction.from(80),
          shortfall: Fraction.of(85, 2), // 80 − 37.5 = 42.5
        },
      ],
    },
    {
      name: "fractional over-supply → exact fractional surplus",
      supply: Fraction.of(125, 2), // 62.5
      demand: Fraction.of(75, 2), // 37.5
      expected: [
        {
          type: "over-supply",
          linkId: "L",
          supply: Fraction.of(125, 2),
          demand: Fraction.of(75, 2),
          surplus: Fraction.from(25), // 62.5 − 37.5 = 25
        },
      ],
    },
  ];

  it.each(cases)("$name", ({ supply, demand, expected }) => {
    const input: LinkInput = { linkId: "L", supply, demand };
    expect(reconcileLinks([input])).toEqual(expected);
  });
});

describe("reconcileLinks — dangling lanes", () => {
  it("supply null (producer stopped making it) → dangling end:from", () => {
    const input: LinkInput = {
      linkId: "L",
      supply: null,
      demand: Fraction.from(60),
    };
    expect(reconcileLinks([input])).toEqual<LinkFinding[]>([
      { type: "dangling-link", linkId: "L", end: "from" },
    ]);
  });

  it("demand null (consumer stopped needing it) → dangling end:to", () => {
    const input: LinkInput = {
      linkId: "L",
      supply: Fraction.from(60),
      demand: null,
    };
    expect(reconcileLinks([input])).toEqual<LinkFinding[]>([
      { type: "dangling-link", linkId: "L", end: "to" },
    ]);
  });

  it("BOTH null → exactly ONE finding, end:from (deterministic tie-break)", () => {
    const input: LinkInput = { linkId: "L", supply: null, demand: null };
    expect(reconcileLinks([input])).toEqual<LinkFinding[]>([
      { type: "dangling-link", linkId: "L", end: "from" },
    ]);
  });
});

describe("reconcileLinks — batch behavior", () => {
  it("empty inputs → empty findings", () => {
    expect(reconcileLinks([])).toEqual([]);
  });

  it("maps each link independently, preserving input order", () => {
    const inputs: LinkInput[] = [
      { linkId: "a", supply: Fraction.from(30), demand: Fraction.from(60) }, // under
      { linkId: "b", supply: Fraction.from(60), demand: Fraction.from(60) }, // exact → skipped
      { linkId: "c", supply: null, demand: Fraction.from(10) }, // dangling
      { linkId: "d", supply: Fraction.from(90), demand: Fraction.from(60) }, // over
    ];
    const findings = reconcileLinks(inputs);
    expect(findings.map((f) => ({ type: f.type, linkId: f.linkId }))).toEqual([
      { type: "under-supply", linkId: "a" },
      { type: "dangling-link", linkId: "c" },
      { type: "over-supply", linkId: "d" },
    ]);
  });
});
