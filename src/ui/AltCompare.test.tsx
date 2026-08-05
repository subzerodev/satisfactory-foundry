/**
 * AltCompare tests (Stage 8 / Phase 4, ticket #40). The logic lives in the pure
 * exported helpers (altCompareModel + swapPayloadFor), so the bulk of the pins
 * are function-level over a synthetic catalog; the component itself gets a
 * node-env SSR smoke (renderToStaticMarkup, no jsdom) — the browser walk is the
 * visual gate (the smoke.test.tsx discipline).
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Fraction } from "../core/fraction.ts";
import type {
  Catalog,
  CatalogItem,
  CatalogMachine,
  CatalogRecipe,
} from "../data/types.ts";
import type { Selection, SolveState } from "../state/store.ts";
import type { OutputLaneResult } from "../core/manifold.ts";
import { AltCompare, altCompareModel, swapPayloadFor } from "./AltCompare.tsx";
import { appStore } from "../state/store.ts";

const F = (n: number): Fraction => Fraction.from(n);

// --- Synthetic catalog: ingot has a standard + alternate producer -----------

function item(id: string, displayName: string): CatalogItem {
  return { id, displayName, isFluid: false, stackSize: F(100) };
}
function machine(id: string, mw: number): CatalogMachine {
  return {
    id,
    displayName: id,
    power: { mw: F(mw), variable: false, exponent: F(1) },
  };
}
function crecipe(
  id: string,
  displayName: string,
  machineId: string,
  outputs: Array<[string, number]>,
  inputs: Array<[string, number]>,
  isAlternate = false,
): CatalogRecipe {
  const out = outputs.map(([itemId, perMinute]) => ({
    itemId,
    perMinute: F(perMinute),
  }));
  return {
    id,
    displayName,
    machineId,
    isAlternate,
    primaryOutputId: out[0]!.itemId,
    outputs: out,
    inputs: inputs.map(([itemId, perMinute]) => ({
      itemId,
      perMinute: F(perMinute),
    })),
  };
}

const CAT: Catalog = {
  items: {
    ingot: item("ingot", "Ingot"),
    ore: item("ore", "Ore"),
  },
  machines: {
    smelter: machine("smelter", 4),
    foundry: machine("foundry", 16),
  },
  recipes: {
    r_std: crecipe(
      "r_std",
      "Standard",
      "smelter",
      [["ingot", 30]],
      [["ore", 30]],
    ),
    r_alt: crecipe(
      "r_alt",
      "Alternate",
      "foundry",
      [["ingot", 60]],
      [["ore", 45]],
      true,
    ),
  },
  tiers: { belt: [F(60)], pipe: [F(300)] },
};

function selection(recipeId: string | null): Selection {
  return {
    recipeId,
    machineCount: 4,
    clockPercentText: "100",
    unlockedTiers: { belt: 1, pipe: 1 },
    overrides: { feeds: {}, outputs: {} },
  };
}

/** A solved SolveState whose primary output lane emits `total` of `itemId`. */
function solvedWith(itemId: string, total: number): SolveState {
  const lane: OutputLaneResult = {
    itemId,
    kind: "belt",
    perMachineOutput: F(30),
    totalOutput: F(total),
    breakouts: [],
    segments: [],
    findings: [],
  };
  return {
    status: "solved",
    result: { feeds: [], outputs: [lane], findings: [] },
  };
}

// --- Presence gating --------------------------------------------------------

describe("altCompareModel — presence gate", () => {
  it("returns null when the stage is not solved", () => {
    expect(
      altCompareModel(CAT, "s1", selection("r_std"), { status: "idle" }),
    ).toBeNull();
  });

  it("returns null when the stage has no recipe", () => {
    expect(
      altCompareModel(CAT, "s1", selection(null), solvedWith("ingot", 120)),
    ).toBeNull();
  });

  it("returns null when the primary item has fewer than 2 candidates", () => {
    // A catalog with only the standard ingot recipe → <2 candidates.
    const oneRecipe: Catalog = {
      ...CAT,
      recipes: { r_std: CAT.recipes["r_std"]! },
    };
    expect(
      altCompareModel(
        oneRecipe,
        "s1",
        selection("r_std"),
        solvedWith("ingot", 120),
      ),
    ).toBeNull();
  });

  it("returns null when the solve has no output lane for the primary item", () => {
    // Solved, but the output lane is for a different item → no rate to compare.
    expect(
      altCompareModel(
        CAT,
        "s1",
        selection("r_std"),
        solvedWith("something_else", 120),
      ),
    ).toBeNull();
  });

  it("returns a model when solved with a ≥2-candidate primary item", () => {
    const model = altCompareModel(
      CAT,
      "s1",
      selection("r_std"),
      solvedWith("ingot", 120),
    );
    expect(model).not.toBeNull();
    expect(model!.itemName).toBe("Ingot");
    expect(model!.rows).toHaveLength(2);
  });
});

// --- Row building + apply payloads ------------------------------------------

describe("altCompareModel — rows + apply payloads", () => {
  it("marks the current row (no apply) and builds payloads for the rest", () => {
    // R = 120/min. Standard (30/min) is current; alternate (60/min) applies at
    // ceil(120/60) = 2 machines.
    const model = altCompareModel(
      CAT,
      "s1",
      selection("r_std"),
      solvedWith("ingot", 120),
    )!;
    const [std, alt] = model.rows;

    expect(std!.row.recipeId).toBe("r_std");
    expect(std!.row.isCurrent).toBe(true);
    expect(std!.apply).toBeNull(); // current row: no Apply

    expect(alt!.row.recipeId).toBe("r_alt");
    expect(alt!.row.isCurrent).toBe(false);
    expect(alt!.apply).toEqual({
      stageId: "s1",
      recipeId: "r_alt",
      machineCount: 2, // ceil(120 / 60)
    });
  });

  it("ceils the apply count at the compared rate (over-produce, never short)", () => {
    // R = 121/min via the 60/min alternate → ceil(121/60) = 3.
    const model = altCompareModel(
      CAT,
      "s1",
      selection("r_std"),
      solvedWith("ingot", 121),
    )!;
    const alt = model.rows.find((r) => r.row.recipeId === "r_alt")!;
    expect(alt.apply!.machineCount).toBe(3);
  });

  it("carries the stageId verbatim into every apply payload", () => {
    const model = altCompareModel(
      CAT,
      "stage-xyz",
      selection("r_std"),
      solvedWith("ingot", 60),
    )!;
    const alt = model.rows.find((r) => r.row.recipeId === "r_alt")!;
    expect(alt.apply!.stageId).toBe("stage-xyz");
  });
});

describe("swapPayloadFor", () => {
  it("builds the ceil'd swap payload for a candidate at a rate", () => {
    const candidate = CAT.recipes["r_alt"]!; // primary 60/min
    // 120/60 = 2 exactly.
    expect(swapPayloadFor("s1", candidate, F(120))).toEqual({
      stageId: "s1",
      recipeId: "r_alt",
      machineCount: 2,
    });
    // 130/60 = 2.16… → ceil 3 (ceil over-produces).
    expect(swapPayloadFor("s1", candidate, F(130)).machineCount).toBe(3);
  });
});

// --- SSR smoke (node env, no jsdom) -----------------------------------------

describe("AltCompare SSR smoke", () => {
  it("renders nothing headless (store catalog initializing in node)", () => {
    // The component reads the app-wide singleton store, which boots
    // catalog "initializing" in node → the catalog gate returns null. A crash here
    // would fail the wiring; the visual render is the browser-walk gate.
    const html = renderToStaticMarkup(<AltCompare />);
    expect(html).toBe("");
  });

  it("renders the OUTPUT header + per-row output cell (#83)", () => {
    // The component reads the singleton via zustand's useStore, whose SSR
    // snapshot is api.getInitialState() (NOT getState()) — so setState can't
    // drive a renderToStaticMarkup pass. Stub that one seam with a solved slice
    // (ready CAT — ingot has 2 candidates — on r_std at 120/min) so the presence
    // gate passes and the table renders. Assertions: the OUTPUT header sits
    // between MACHINES and POWER, and a row's cell shows the actual produced
    // rate (std 4×30 = 120/min at R=120).
    const sel = selection("r_std");
    const sol = solvedWith("ingot", 120);
    const store = appStore as unknown as {
      getInitialState: () => unknown;
      getState: () => unknown;
    };
    const realInitial = store.getInitialState;
    const seeded = {
      ...(store.getState() as object),
      catalog: { status: "ready" as const, catalog: CAT },
      activeStageId: "s1",
      selection: sel,
      solve: sol,
    };
    store.getInitialState = () => seeded;
    try {
      const html = renderToStaticMarkup(<AltCompare />);
      // The OUTPUT header sits between MACHINES and POWER (column order).
      expect(html).toContain("<th>machines</th><th>output</th><th>power</th>");
      // A row's OUTPUT cell shows the actual produced rate (120/min at R=120).
      expect(html).toContain("<td>120/min</td>");
    } finally {
      store.getInitialState = realInitial;
    }
  });
});
