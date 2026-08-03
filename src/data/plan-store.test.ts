import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import type { Selection } from "../state/store.ts";
import { resetDbCache } from "./db.ts";
import { savePlan, listPlans, loadPlan, deletePlan } from "./plan-store.ts";
import type { PlanFileV1 } from "./plan-store.ts";

// A canonical selection with a fractional clock text + override strings, to
// prove the exact user-input text round-trips (no float coercion anywhere).
function sampleSelection(): Selection {
  return {
    recipeId: "ingot_iron",
    machineCount: 20,
    clockPercentText: "37.5",
    unlockedTiers: { belt: 4, pipe: 2 },
    overrides: {
      feeds: { ore_iron: ["480", null] },
      outputs: {},
    },
  };
}

function samplePlan(overrides?: Partial<PlanFileV1>): PlanFileV1 {
  return {
    format_version: 1,
    name: "My Plan",
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
    stages: [{ selection: sampleSelection() }],
    links: [],
    ...overrides,
  };
}

beforeEach(async () => {
  resetDbCache();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new (
    await import("fake-indexeddb")
  ).IDBFactory();
});

// The first test to run: pins crypto.randomUUID availability in the node test
// env (a DIFFERENT crypto surface than catalog-store's crypto.subtle precedent).
describe("plan-store — environment", () => {
  it("crypto.randomUUID is available and yields a v4-shaped id", () => {
    const id = crypto.randomUUID();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe("plan-store — save/load/delete round-trip", () => {
  it("save → load returns the exact plan, fractional clock + override strings intact", async () => {
    const id = crypto.randomUUID();
    await savePlan(samplePlan(), id);
    const loaded = await loadPlan(id);
    expect(loaded).not.toBeNull();
    expect(loaded!.stages[0]!.selection.clockPercentText).toBe("37.5");
    expect(loaded!.stages[0]!.selection.overrides.feeds.ore_iron).toEqual([
      "480",
      null,
    ]);
    expect(loaded!.stages[0]!.selection.unlockedTiers).toEqual({
      belt: 4,
      pipe: 2,
    });
  });

  it("loadPlan on a missing id → null", async () => {
    expect(await loadPlan(crypto.randomUUID())).toBeNull();
  });

  it("deletePlan removes the row; a later load → null", async () => {
    const id = crypto.randomUUID();
    await savePlan(samplePlan(), id);
    await deletePlan(id);
    expect(await loadPlan(id)).toBeNull();
  });
});

describe("plan-store — listPlans", () => {
  it("sorts by updatedAt descending", async () => {
    await savePlan(
      samplePlan({ name: "old", updatedAt: "2026-01-01T00:00:00.000Z" }),
      "id-old",
    );
    await savePlan(
      samplePlan({ name: "new", updatedAt: "2026-12-31T00:00:00.000Z" }),
      "id-new",
    );
    await savePlan(
      samplePlan({ name: "mid", updatedAt: "2026-06-15T00:00:00.000Z" }),
      "id-mid",
    );
    const list = await listPlans();
    expect(list.map((e) => e.name)).toEqual(["new", "mid", "old"]);
    expect(list[0]).toMatchObject({ id: "id-new", name: "new" });
  });

  it("skips a corrupt row (never crashes) but keeps valid ones", async () => {
    await savePlan(samplePlan({ name: "good" }), "id-good");
    // A foreign / corrupt row written directly under the plans store.
    const db = await (await import("./db.ts")).openDb();
    await db.put("plans", { garbage: true }, "id-bad");
    const list = await listPlans();
    expect(list.map((e) => e.name)).toEqual(["good"]);
  });
});

describe("plan-store — shape check (accept/reject)", () => {
  it("accepts a well-formed v1 plan", async () => {
    await savePlan(samplePlan(), "id");
    expect(await loadPlan("id")).not.toBeNull();
  });

  it("rejects an unknowingly-newer format_version (corrupt-for-this-build)", async () => {
    const db = await (await import("./db.ts")).openDb();
    await db.put("plans", { ...samplePlan(), format_version: 2 }, "id");
    expect(await loadPlan("id")).toBeNull();
  });

  it("rejects a v1 file with a non-empty links array (reserved means reserved)", async () => {
    const db = await (await import("./db.ts")).openDb();
    await db.put(
      "plans",
      { ...samplePlan(), links: [{ from: "a", to: "b" }] },
      "id",
    );
    expect(await loadPlan("id")).toBeNull();
  });

  it("accepts machineCount === null (what JSON.stringify(NaN) produces)", async () => {
    const plan = samplePlan();
    // Simulate a saved NaN count: JSON round-trips it to null.
    (
      plan.stages[0]!.selection as { machineCount: number | null }
    ).machineCount = null;
    const db = await (await import("./db.ts")).openDb();
    await db.put("plans", plan, "id");
    const loaded = await loadPlan("id");
    expect(loaded).not.toBeNull();
    expect(loaded!.stages[0]!.selection.machineCount).toBeNull();
  });

  it("rejects a stage whose selection is missing required fields", async () => {
    const db = await (await import("./db.ts")).openDb();
    await db.put(
      "plans",
      { ...samplePlan(), stages: [{ selection: { recipeId: "x" } }] },
      "id",
    );
    expect(await loadPlan("id")).toBeNull();
  });
});
