import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import type { Selection } from "../state/store.ts";
import { resetDbCache } from "./db.ts";
import { savePlan, listPlans, loadPlan, deletePlan, migrateV1 } from "./plan-store.ts";
import type { PlanFileV1, PlanFileV2 } from "./plan-store.ts";

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

/** A well-formed v2 file (the current save shape): named stages + index links. */
function samplePlan(overrides?: Partial<PlanFileV2>): PlanFileV2 {
  return {
    format_version: 2,
    name: "My Plan",
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
    stages: [
      { name: "Stage 1", selection: sampleSelection(), position: { x: 40, y: 40 } },
    ],
    links: [],
    ...overrides,
  };
}

/** A well-formed v1 file (the legacy shape, written via raw db.put). */
function samplePlanV1(overrides?: Partial<PlanFileV1>): PlanFileV1 {
  return {
    format_version: 1,
    name: "Legacy Plan",
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

describe("plan-store — save/load/delete round-trip (v2)", () => {
  it("save → load returns the exact plan, fractional clock + override strings intact", async () => {
    const id = crypto.randomUUID();
    await savePlan(samplePlan(), id);
    const loaded = await loadPlan(id);
    expect(loaded).not.toBeNull();
    expect(loaded!.format_version).toBe(2);
    expect(loaded!.stages[0]!.selection.clockPercentText).toBe("37.5");
    expect(loaded!.stages[0]!.selection.overrides.feeds.ore_iron).toEqual([
      "480",
      null,
    ]);
    expect(loaded!.stages[0]!.selection.unlockedTiers).toEqual({
      belt: 4,
      pipe: 2,
    });
    expect(loaded!.stages[0]!.name).toBe("Stage 1");
    expect(loaded!.stages[0]!.position).toEqual({ x: 40, y: 40 });
  });

  it("round-trips a multi-stage graph with index-encoded links", async () => {
    const id = crypto.randomUUID();
    const plan = samplePlan({
      stages: [
        { name: "A", selection: sampleSelection(), position: { x: 0, y: 0 } },
        { name: "B", selection: sampleSelection(), position: { x: 260, y: 0 } },
        { name: "C", selection: sampleSelection() },
      ],
      links: [
        { from: 0, to: 1, itemId: "iron_ingot" },
        { from: 1, to: 2, itemId: "iron_ingot" },
      ],
    });
    await savePlan(plan, id);
    const loaded = await loadPlan(id);
    expect(loaded!.stages.map((s) => s.name)).toEqual(["A", "B", "C"]);
    expect(loaded!.stages[2]!.position).toBeUndefined();
    expect(loaded!.links).toEqual([
      { from: 0, to: 1, itemId: "iron_ingot" },
      { from: 1, to: 2, itemId: "iron_ingot" },
    ]);
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

  it("lists a legacy v1 row alongside v2 rows (both loadable)", async () => {
    await savePlan(samplePlan({ name: "v2", updatedAt: "2026-06-15T00:00:00.000Z" }), "id-v2");
    const db = await (await import("./db.ts")).openDb();
    await db.put(
      "plans",
      samplePlanV1({ name: "v1", updatedAt: "2026-12-31T00:00:00.000Z" }),
      "id-v1",
    );
    const list = await listPlans();
    expect(list.map((e) => e.name)).toEqual(["v1", "v2"]);
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

describe("plan-store — isPlanFileV2 accept/reject", () => {
  // The validator has no direct export; exercise it through loadPlan (a v2 row
  // that fails validation loads as null, exactly the v1-validator test style).
  async function putRaw(value: unknown): Promise<void> {
    const db = await (await import("./db.ts")).openDb();
    await db.put("plans", value, "id");
  }

  it("accepts a well-formed v2 plan", async () => {
    await putRaw(samplePlan());
    expect(await loadPlan("id")).not.toBeNull();
  });

  it("accepts a stage with NO position (v1-migrated saves omit it)", async () => {
    await putRaw(
      samplePlan({ stages: [{ name: "S", selection: sampleSelection() }] }),
    );
    expect(await loadPlan("id")).not.toBeNull();
  });

  it("accepts machineCount === null (what JSON.stringify(NaN) produces)", async () => {
    const plan = samplePlan();
    (
      plan.stages[0]!.selection as { machineCount: number | null }
    ).machineCount = null;
    await putRaw(plan);
    const loaded = await loadPlan("id");
    expect(loaded).not.toBeNull();
    expect(loaded!.stages[0]!.selection.machineCount).toBeNull();
  });

  it("rejects a wrong format_version (neither 1 nor 2 → corrupt)", async () => {
    await putRaw({ ...samplePlan(), format_version: 3 });
    expect(await loadPlan("id")).toBeNull();
  });

  it("rejects an empty stages array", async () => {
    await putRaw(samplePlan({ stages: [] }));
    expect(await loadPlan("id")).toBeNull();
  });

  it("rejects a stage missing its name", async () => {
    await putRaw(
      samplePlan({
        stages: [{ selection: sampleSelection() } as never],
      }),
    );
    expect(await loadPlan("id")).toBeNull();
  });

  it("rejects a stage whose selection is malformed", async () => {
    await putRaw(
      samplePlan({
        stages: [{ name: "S", selection: { recipeId: "x" } as never }],
      }),
    );
    expect(await loadPlan("id")).toBeNull();
  });

  it("rejects a malformed position (non-number coords)", async () => {
    await putRaw(
      samplePlan({
        stages: [
          {
            name: "S",
            selection: sampleSelection(),
            position: { x: "40", y: 40 } as never,
          },
        ],
      }),
    );
    expect(await loadPlan("id")).toBeNull();
  });

  it("rejects a link index out of range", async () => {
    await putRaw(
      samplePlan({
        stages: [{ name: "A", selection: sampleSelection() }],
        links: [{ from: 0, to: 1, itemId: "x" }],
      }),
    );
    expect(await loadPlan("id")).toBeNull();
  });

  it("rejects a negative link index", async () => {
    await putRaw(
      samplePlan({
        stages: [
          { name: "A", selection: sampleSelection() },
          { name: "B", selection: sampleSelection() },
        ],
        links: [{ from: -1, to: 1, itemId: "x" }],
      }),
    );
    expect(await loadPlan("id")).toBeNull();
  });

  it("rejects a non-integer link index", async () => {
    await putRaw(
      samplePlan({
        stages: [
          { name: "A", selection: sampleSelection() },
          { name: "B", selection: sampleSelection() },
        ],
        links: [{ from: 0.5, to: 1, itemId: "x" }],
      }),
    );
    expect(await loadPlan("id")).toBeNull();
  });

  it("rejects a self-link (from === to)", async () => {
    await putRaw(
      samplePlan({
        stages: [
          { name: "A", selection: sampleSelection() },
          { name: "B", selection: sampleSelection() },
        ],
        links: [{ from: 1, to: 1, itemId: "x" }],
      }),
    );
    expect(await loadPlan("id")).toBeNull();
  });

  it("rejects a duplicate (to, itemId) feed lane", async () => {
    await putRaw(
      samplePlan({
        stages: [
          { name: "A", selection: sampleSelection() },
          { name: "B", selection: sampleSelection() },
          { name: "C", selection: sampleSelection() },
        ],
        links: [
          { from: 0, to: 2, itemId: "iron_ingot" },
          { from: 1, to: 2, itemId: "iron_ingot" },
        ],
      }),
    );
    expect(await loadPlan("id")).toBeNull();
  });

  it("accepts distinct (to, itemId) lanes into the same consumer", async () => {
    await putRaw(
      samplePlan({
        stages: [
          { name: "A", selection: sampleSelection() },
          { name: "B", selection: sampleSelection() },
          { name: "C", selection: sampleSelection() },
        ],
        links: [
          { from: 0, to: 2, itemId: "iron_ingot" },
          { from: 1, to: 2, itemId: "copper_ingot" },
        ],
      }),
    );
    expect(await loadPlan("id")).not.toBeNull();
  });
});

describe("plan-store — migrateV1", () => {
  it("migrates a v1 file → one-stage v2 named 'Stage 1', no position, empty links", () => {
    const v1 = samplePlanV1();
    const v2 = migrateV1(v1);
    expect(v2.format_version).toBe(2);
    expect(v2.stages).toHaveLength(1);
    expect(v2.stages[0]!.name).toBe("Stage 1");
    expect(v2.stages[0]!.position).toBeUndefined();
    expect(v2.stages[0]!.selection).toBe(v1.stages[0]!.selection);
    expect(v2.links).toEqual([]);
  });

  it("carries createdAt / updatedAt VERBATIM (save-over reads prior createdAt)", () => {
    const v1 = samplePlanV1({
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2021-02-03T04:05:06.000Z",
    });
    const v2 = migrateV1(v1);
    expect(v2.createdAt).toBe("2020-01-01T00:00:00.000Z");
    expect(v2.updatedAt).toBe("2021-02-03T04:05:06.000Z");
    expect(v2.name).toBe("Legacy Plan");
  });

  it("loadPlan migrates a stored v1 row transparently (returns v2)", async () => {
    const db = await (await import("./db.ts")).openDb();
    await db.put("plans", samplePlanV1(), "id");
    const loaded = await loadPlan("id");
    expect(loaded).not.toBeNull();
    expect(loaded!.format_version).toBe(2);
    expect(loaded!.stages[0]!.name).toBe("Stage 1");
    expect(loaded!.stages[0]!.selection.clockPercentText).toBe("37.5");
  });

  it("rejects a v1 row with a non-empty links array (reserved means reserved)", async () => {
    const db = await (await import("./db.ts")).openDb();
    await db.put(
      "plans",
      { ...samplePlanV1(), links: [{ from: "a", to: "b" }] },
      "id",
    );
    expect(await loadPlan("id")).toBeNull();
  });

  it("rejects an empty-stages v1 row (loadPlan's stages[0] must be sound)", async () => {
    const db = await (await import("./db.ts")).openDb();
    await db.put("plans", { ...samplePlanV1(), stages: [] }, "id");
    expect(await loadPlan("id")).toBeNull();
  });

  it("rejects a v1 row whose selection is missing required fields", async () => {
    const db = await (await import("./db.ts")).openDb();
    await db.put(
      "plans",
      { ...samplePlanV1(), stages: [{ selection: { recipeId: "x" } }] },
      "id",
    );
    expect(await loadPlan("id")).toBeNull();
  });
});
