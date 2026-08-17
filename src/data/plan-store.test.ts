import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import type { Selection } from "../state/store.ts";
import { resetDbCache } from "./db.ts";
import {
  savePlan,
  listPlans,
  loadPlan,
  deletePlan,
  migrateV1,
  migrateV2,
  migrateV3,
  migrateV4,
  migrateV5,
  migrateV7,
  validatePlanFile,
} from "./plan-store.ts";
import type {
  PlanFileV1,
  PlanFileV2,
  PlanFileV3,
  PlanFileV4,
  PlanFileV5,
  PlanFileV6,
  PlanFileV7,
  PlanFileV8,
} from "./plan-store.ts";

describe("plan-store — v6 extraction and explicit placement (#112)", () => {
  it("migrates v5 userPlaced true/absent to required booleans", () => {
    const v6 = migrateV5(
      samplePlanV5({
        stages: [
          { name: "Pinned", selection: sampleSelection(), userPlaced: true },
          { name: "Auto", selection: sampleSelection() },
        ],
      }),
    );
    expect(v6.format_version).toBe(6);
    expect(v6.stages.map((stage) => stage.userPlaced)).toEqual([true, false]);
  });

  it("materializes legacy placement from original position presence", async () => {
    const db = await (await import("./db.ts")).openDb();
    await db.put(
      "plans",
      samplePlanV4({
        stages: [
          {
            name: "Pinned",
            selection: sampleSelection(),
            position: { x: 1, y: 2 },
          },
          { name: "Auto", selection: sampleSelection() },
        ],
      }),
      "legacy",
    );
    const loaded = await loadPlan("legacy");
    expect(loaded?.stages.map((stage) => stage.userPlaced)).toEqual([
      true,
      false,
    ]);
  });

  it("rejects malformed v6 placement and extraction shapes", async () => {
    const db = await (await import("./db.ts")).openDb();
    const good = samplePlanV6();
    for (const stage of [
      { ...good.stages[0], userPlaced: undefined },
      {
        ...good.stages[0],
        extraction: { stone: { machineId: "", clockPercentText: "100" } },
      },
      {
        ...good.stages[0],
        extraction: { stone: { machineId: "miner", clockPercentText: 100 } },
      },
      {
        ...good.stages[0],
        extraction: [{ machineId: "miner_mk3", clockPercentText: "100" }],
      },
    ]) {
      await db.put("plans", { ...good, stages: [stage] }, "bad");
      expect(await loadPlan("bad")).toBeNull();
    }
  });

  it("migrates extraction intent including raw clock text", async () => {
    const plan: PlanFileV6 = {
      ...migrateV5(samplePlanV5()),
      stages: [
        {
          name: "Stage 1",
          selection: sampleSelection(),
          userPlaced: false,
          extraction: {
            stone: { machineId: "miner_mk3", clockPercentText: "bad edit" },
          },
        },
      ],
    };
    const db = await (await import("./db.ts")).openDb();
    await db.put("plans", plan, "v6");
    const loaded = await loadPlan("v6");
    expect(loaded?.format_version).toBe(8);
    expect(loaded?.stages[0]!.extraction?.stone).toEqual({
      machineId: "miner_mk3",
      clockPercentText: "bad edit",
    });
  });
});

describe("plan-store — v7 purity mix persistence (#124)", () => {
  it("validates and round-trips all raw purity strings", async () => {
    const plan = samplePlanV7({
      stages: [
        {
          name: "Stage 1",
          selection: sampleSelection(),
          userPlaced: false,
          extraction: {
            stone: {
              machineId: "miner_mk3",
              clockPercentText: "bad edit",
              purityMix: {
                impure: "0002",
                normal: "1.5",
                pure: "9007199254740992",
              },
            },
          },
        },
      ],
    });
    const db = await (await import("./db.ts")).openDb();
    await db.put("plans", plan, "v7");

    const loaded = await loadPlan("v7");
    expect(loaded?.format_version).toBe(8);
    expect(loaded?.stages[0]!.extraction?.stone).toEqual(
      plan.stages[0]!.extraction?.stone,
    );
    expect((await listPlans()).map((entry) => entry.id)).toContain("v7");
  });

  it.each([
    null,
    ["0", "1", "0"],
    { impure: "0", normal: "1" },
    { impure: "0", normal: 1, pure: "0" },
  ])("rejects malformed optional purity mix %j", async (purityMix) => {
    const db = await (await import("./db.ts")).openDb();
    const good = samplePlanV7();
    await db.put(
      "plans",
      {
        ...good,
        stages: [
          {
            ...good.stages[0],
            extraction: {
              stone: {
                machineId: "miner_mk3",
                clockPercentText: "100",
                purityMix,
              },
            },
          },
        ],
      },
      "bad-v7",
    );
    expect(await loadPlan("bad-v7")).toBeNull();
  });

  it("migrates v6 by copying only historical fields into a null-prototype record", async () => {
    const extraction = Object.create(null) as Record<string, unknown>;
    extraction.__proto__ = {
      machineId: "miner_mk1",
      clockPercentText: "bad edit",
      purityMix: { impure: "9", normal: "8", pure: "7" },
    };
    const v6 = samplePlanV6({
      stages: [
        {
          name: "Stage 1",
          selection: sampleSelection(),
          userPlaced: false,
          extraction,
        } as never,
      ],
    });
    const db = await (await import("./db.ts")).openDb();
    await db.put("plans", v6, "v6-extra");

    const loaded = await loadPlan("v6-extra");
    expect(loaded?.format_version).toBe(8);
    const migrated = loaded!.stages[0]!.extraction!;
    expect(Object.getPrototypeOf(migrated)).toBeNull();
    expect(Object.hasOwn(migrated, "__proto__")).toBe(true);
    expect(migrated.__proto__).toEqual({
      machineId: "miner_mk1",
      clockPercentText: "bad edit",
    });
    expect(migrated.__proto__?.purityMix).toBeUndefined();
  });
});

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

/** A well-formed historical v2 writer shape: named stages + index links. */
function samplePlan(overrides?: Partial<PlanFileV2>): PlanFileV2 {
  return {
    format_version: 2,
    name: "My Plan",
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
    stages: [
      {
        name: "Stage 1",
        selection: sampleSelection(),
        position: { x: 40, y: 40 },
      },
    ],
    links: [],
    ...overrides,
  };
}

/** A well-formed historical v3 writer shape: v2 + optional link transport. */
function samplePlanV3(overrides?: Partial<PlanFileV3>): PlanFileV3 {
  return {
    format_version: 3,
    name: "My Plan",
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
    stages: [
      {
        name: "Stage 1",
        selection: sampleSelection(),
        position: { x: 40, y: 40 },
      },
    ],
    links: [],
    ...overrides,
  };
}

/** A well-formed historical v4 file: v3 + the S8P2 transport
 *  extensions (pipe deratePercentText, train sharedEnds) legal in the config. */
function samplePlanV4(overrides?: Partial<PlanFileV4>): PlanFileV4 {
  return {
    format_version: 4,
    name: "My Plan",
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
    stages: [
      {
        name: "Stage 1",
        selection: sampleSelection(),
        position: { x: 40, y: 40 },
      },
    ],
    links: [],
    ...overrides,
  };
}

/** A well-formed historical v5 file: v4 + a top-level
 *  flowDirection and optional per-stage userPlaced. */
function samplePlanV5(overrides?: Partial<PlanFileV5>): PlanFileV5 {
  return {
    format_version: 5,
    name: "My Plan",
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
    flowDirection: "LR",
    stages: [
      {
        name: "Stage 1",
        selection: sampleSelection(),
        position: { x: 40, y: 40 },
      },
    ],
    links: [],
    ...overrides,
  };
}

function samplePlanV6(overrides?: Partial<PlanFileV6>): PlanFileV6 {
  return {
    ...migrateV5(samplePlanV5()),
    ...overrides,
  };
}

function samplePlanV7(overrides?: Partial<PlanFileV7>): PlanFileV7 {
  const v6 = samplePlanV6();
  return {
    ...v6,
    format_version: 7,
    stages: v6.stages.map((stage, index) =>
      index === 0
        ? {
            ...stage,
            extraction: {
              stone: {
                machineId: "miner_mk3",
                clockPercentText: "125",
                purityMix: { impure: "01", normal: "2", pure: "003" },
              },
            },
          }
        : stage,
    ),
    ...overrides,
  };
}

function samplePlanV8(overrides?: Partial<PlanFileV8>): PlanFileV8 {
  return {
    ...migrateV7(samplePlanV7()),
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

describe("plan-store — v8 packaging interstep persistence (#113)", () => {
  const stages = [
    { name: "A", selection: sampleSelection(), userPlaced: false },
    { name: "B", selection: sampleSelection(), userPlaced: false },
    { name: "C", selection: sampleSelection(), userPlaced: false },
  ];

  function packagedLink(
    overrides: Record<string, unknown> = {},
  ): PlanFileV8["links"][number] {
    return {
      from: 0,
      to: 1,
      itemId: "water",
      transport: { mode: "belt" },
      interstep: {
        packageRecipeId: "packaged_water",
        clockPercentText: "100",
        returnTransport: { mode: "belt" },
      },
      ...overrides,
    } as PlanFileV8["links"][number];
  }

  it("saves and loads current v8 intent including stale package IDs", async () => {
    const plan = samplePlanV8({
      stages,
      links: [
        packagedLink({
          interstep: {
            packageRecipeId: "stale-package-id",
            clockPercentText: "bad edit",
            returnTransport: {
              mode: "train",
              trip: { kind: "estimated", distanceText: "" },
              sharedEnds: { from: true },
            },
          },
        }),
      ],
    });
    await savePlan(plan, "v8");
    expect(await loadPlan("v8")).toEqual(plan);
  });

  it("preserves raw invalid numeric text for derive-time errors", () => {
    for (const deratePercentText of ["", "bad", "0", "101"]) {
      const plan = samplePlanV8({
        stages,
        links: [
          {
            from: 0,
            to: 1,
            itemId: "water",
            transport: { mode: "pipe", deratePercentText },
          },
          packagedLink({
            to: 2,
            interstep: {
              packageRecipeId: "packaged_water",
              clockPercentText: "-1",
              returnTransport: {
                mode: "truck",
                trip: { kind: "measured", roundTripSecondsText: "bad" },
              },
            },
          }),
        ],
      });
      expect(validatePlanFile(plan)).toEqual(plan);
    }
  });

  it.each([
    ["unknown transport field", { mode: "belt", fuel: "battery" }],
    [
      "misplaced trip field",
      {
        mode: "truck",
        trip: { kind: "estimated", distanceText: "1", flightMetersText: "2" },
      },
    ],
    [
      "unknown shared end",
      {
        mode: "train",
        trip: { kind: "estimated", distanceText: "1" },
        sharedEnds: { from: true, middle: true },
      },
    ],
  ])("rejects closed-world %s", (_name, transport) => {
    const plan = samplePlanV8({
      stages,
      links: [{ from: 0, to: 1, itemId: "iron", transport } as never],
    });
    expect(validatePlanFile(plan)).toBeNull();
  });

  it("rejects malformed interstep fields and illegal packaged routes", () => {
    for (const interstep of [
      {
        packageRecipeId: "packaged_water",
        clockPercentText: "100",
        returnTransport: { mode: "belt" },
        extra: true,
      },
      {
        packageRecipeId: 1,
        clockPercentText: "100",
        returnTransport: { mode: "belt" },
      },
      {
        packageRecipeId: "packaged_water",
        clockPercentText: "100",
        returnTransport: { mode: "pipe" },
      },
    ]) {
      expect(
        validatePlanFile(
          samplePlanV8({
            stages,
            links: [packagedLink({ interstep }) as never],
          }),
        ),
      ).toBeNull();
    }
    expect(
      validatePlanFile(
        samplePlanV8({
          stages,
          links: [
            packagedLink({
              transport: {
                mode: "fluid-truck",
                trip: { kind: "estimated", distanceText: "1" },
              },
            }) as never,
          ],
        }),
      ),
    ).toBeNull();
  });

  it("canonicalizes fields historically tolerated by v7", async () => {
    const legacy = samplePlanV7({
      stages,
      links: [
        {
          from: 0,
          to: 1,
          itemId: "iron",
          transport: {
            mode: "train",
            trip: {
              kind: "estimated",
              distanceText: "1200",
              roundTripSecondsText: "ignored",
            },
            sharedEnds: { from: true, ignored: true },
            fuel: "battery",
          },
        } as never,
      ],
    });
    const db = await (await import("./db.ts")).openDb();
    await db.put("plans", legacy, "legacy-v7");
    const migrated = await loadPlan("legacy-v7");
    expect(migrated?.format_version).toBe(8);
    expect(migrated?.links[0]?.transport).toEqual({
      mode: "train",
      trip: { kind: "estimated", distanceText: "1200" },
      sharedEnds: { from: true },
    });
    await savePlan(migrated!, "canonical-v8");
    expect(await loadPlan("canonical-v8")).toEqual(migrated);
  });

  it("migrates v7-valid array transports and trips to exact v8 objects", () => {
    const outerBelt = Object.assign([], {
      mode: "belt",
      ignored: true,
    });
    const vehicleTrip = Object.assign([], {
      kind: "estimated",
      distanceText: "500",
      ignored: true,
    });
    const droneTrip = Object.assign([], {
      kind: "measured",
      roundTripSecondsText: "300",
      flightMetersText: "1200",
      ignored: true,
    });
    const legacy = samplePlanV7({
      stages,
      links: [
        {
          from: 0,
          to: 1,
          itemId: "iron",
          transport: outerBelt,
        } as never,
        {
          from: 0,
          to: 1,
          itemId: "coal",
          transport: { mode: "truck", trip: vehicleTrip },
        } as never,
        {
          from: 0,
          to: 1,
          itemId: "nitrogen",
          transport: {
            mode: "drone",
            fuel: "battery",
            trip: droneTrip,
          },
        } as never,
      ],
    });

    expect(
      validatePlanFile(legacy)?.links.map((link) => link.transport),
    ).toStrictEqual([
      { mode: "belt" },
      {
        mode: "truck",
        trip: { kind: "estimated", distanceText: "500" },
      },
      {
        mode: "drone",
        fuel: "battery",
        trip: {
          kind: "measured",
          roundTripSecondsText: "300",
          flightMetersText: "1200",
        },
      },
    ]);
  });

  it("rejects future v9 while migrating v7 to canonical v8", () => {
    expect(
      validatePlanFile({ ...samplePlanV8(), format_version: 9 }),
    ).toBeNull();
    expect(validatePlanFile(samplePlanV7())?.format_version).toBe(8);
  });
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

describe("plan-store — save/load/delete round-trip (v8)", () => {
  it("save → load returns the exact plan, fractional clock + override strings intact", async () => {
    const id = crypto.randomUUID();
    await savePlan(samplePlanV8(), id);
    const loaded = await loadPlan(id);
    expect(loaded).not.toBeNull();
    expect(loaded!.format_version).toBe(8);
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
    expect(loaded!.stages[0]!.extraction?.stone?.purityMix).toEqual({
      impure: "01",
      normal: "2",
      pure: "003",
    });
  });

  it("round-trips a multi-stage graph with index-encoded links", async () => {
    const id = crypto.randomUUID();
    const plan = samplePlanV8({
      stages: [
        {
          name: "A",
          selection: sampleSelection(),
          position: { x: 0, y: 0 },
          userPlaced: false,
        },
        {
          name: "B",
          selection: sampleSelection(),
          position: { x: 260, y: 0 },
          userPlaced: false,
        },
        { name: "C", selection: sampleSelection(), userPlaced: false },
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

  it("round-trips per-link transport verbatim (raw user text intact)", async () => {
    const id = crypto.randomUUID();
    const plan = samplePlanV8({
      stages: [
        { name: "A", selection: sampleSelection(), userPlaced: false },
        { name: "B", selection: sampleSelection(), userPlaced: false },
        { name: "C", selection: sampleSelection(), userPlaced: false },
        { name: "D", selection: sampleSelection(), userPlaced: false },
      ],
      links: [
        {
          from: 0,
          to: 1,
          itemId: "iron_ingot",
          transport: {
            mode: "train",
            trip: { kind: "estimated", distanceText: "1200" },
          },
        },
        {
          from: 0,
          to: 2,
          itemId: "iron_ore",
          transport: {
            mode: "drone",
            fuel: "battery",
            trip: {
              kind: "measured",
              roundTripSecondsText: "180",
              flightMetersText: "2000",
            },
          },
        },
        // A belt link carries no transport key — the default.
        { from: 0, to: 3, itemId: "copper_ingot" },
      ],
    });
    await savePlan(plan, id);
    const loaded = await loadPlan(id);
    expect(loaded!.links[0]!.transport).toEqual({
      mode: "train",
      trip: { kind: "estimated", distanceText: "1200" },
    });
    expect(loaded!.links[1]!.transport).toEqual({
      mode: "drone",
      fuel: "battery",
      trip: {
        kind: "measured",
        roundTripSecondsText: "180",
        flightMetersText: "2000",
      },
    });
    expect(loaded!.links[2]!.transport).toBeUndefined();
  });

  it("loadPlan on a missing id → null", async () => {
    expect(await loadPlan(crypto.randomUUID())).toBeNull();
  });

  it("deletePlan removes the row; a later load → null", async () => {
    const id = crypto.randomUUID();
    await savePlan(samplePlanV8(), id);
    await deletePlan(id);
    expect(await loadPlan(id)).toBeNull();
  });
});

describe("plan-store — listPlans", () => {
  it("sorts by updatedAt descending", async () => {
    await savePlan(
      samplePlanV8({ name: "old", updatedAt: "2026-01-01T00:00:00.000Z" }),
      "id-old",
    );
    await savePlan(
      samplePlanV8({ name: "new", updatedAt: "2026-12-31T00:00:00.000Z" }),
      "id-new",
    );
    await savePlan(
      samplePlanV8({ name: "mid", updatedAt: "2026-06-15T00:00:00.000Z" }),
      "id-mid",
    );
    const list = await listPlans();
    expect(list.map((e) => e.name)).toEqual(["new", "mid", "old"]);
    expect(list[0]).toMatchObject({ id: "id-new", name: "new" });
  });

  it("lists a legacy v1 row alongside v8 rows (both loadable)", async () => {
    await savePlan(
      samplePlanV8({ name: "v8", updatedAt: "2026-06-15T00:00:00.000Z" }),
      "id-v8",
    );
    const db = await (await import("./db.ts")).openDb();
    await db.put(
      "plans",
      samplePlanV1({ name: "v1", updatedAt: "2026-12-31T00:00:00.000Z" }),
      "id-v1",
    );
    const list = await listPlans();
    expect(list.map((e) => e.name)).toEqual(["v1", "v8"]);
  });

  it("skips a corrupt row (never crashes) but keeps valid ones", async () => {
    await savePlan(samplePlanV8({ name: "good" }), "id-good");
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

  it("rejects future format_version 9 on an otherwise valid v8 payload", async () => {
    await putRaw({ ...samplePlanV8(), format_version: 9 });
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

  it("loadPlan migrates a stored v1 row transparently (returns v8)", async () => {
    const db = await (await import("./db.ts")).openDb();
    await db.put("plans", samplePlanV1(), "id");
    const loaded = await loadPlan("id");
    expect(loaded).not.toBeNull();
    expect(loaded!.format_version).toBe(8);
    expect(loaded!.flowDirection).toBe("LR");
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

describe("plan-store — migrateV2 (v2 → v3)", () => {
  it("maps every link to itself with transport absent; stages + timestamps verbatim", () => {
    const v2 = samplePlan({
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2021-02-03T04:05:06.000Z",
      stages: [
        { name: "A", selection: sampleSelection() },
        { name: "B", selection: sampleSelection() },
      ],
      links: [{ from: 0, to: 1, itemId: "iron_ingot" }],
    });
    const v3 = migrateV2(v2);
    expect(v3.format_version).toBe(3);
    expect(v3.createdAt).toBe("2020-01-01T00:00:00.000Z");
    expect(v3.updatedAt).toBe("2021-02-03T04:05:06.000Z");
    expect(v3.stages).toBe(v2.stages);
    expect(v3.links).toEqual([{ from: 0, to: 1, itemId: "iron_ingot" }]);
    expect(v3.links[0]!.transport).toBeUndefined();
  });
});

describe("plan-store — migrateV3 (v3 → v4, identity on links)", () => {
  it("flips only the header; stages + links + timestamps carry verbatim", () => {
    const v3 = samplePlanV3({
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2021-02-03T04:05:06.000Z",
      stages: [
        { name: "A", selection: sampleSelection() },
        { name: "B", selection: sampleSelection() },
      ],
      links: [
        {
          from: 0,
          to: 1,
          itemId: "iron_ingot",
          transport: {
            mode: "train",
            trip: { kind: "estimated", distanceText: "1200" },
          },
        },
      ],
    });
    const v4 = migrateV3(v3);
    expect(v4.format_version).toBe(4);
    expect(v4.createdAt).toBe("2020-01-01T00:00:00.000Z");
    expect(v4.updatedAt).toBe("2021-02-03T04:05:06.000Z");
    expect(v4.stages).toBe(v3.stages);
    // The new S8P2 fields are absent by construction (a v3 link never had them).
    expect(v4.links).toEqual(v3.links);
    expect(v4.links[0]!.transport).toEqual({
      mode: "train",
      trip: { kind: "estimated", distanceText: "1200" },
    });
  });

  it("a stored v3 row still loads (migrated to v8) through loadPlan", async () => {
    const db = await (await import("./db.ts")).openDb();
    await db.put("plans", samplePlanV3({ name: "legacy-v3" }), "id");
    const loaded = await loadPlan("id");
    expect(loaded).not.toBeNull();
    expect(loaded!.format_version).toBe(8);
    expect(loaded!.name).toBe("legacy-v3");
  });
});

describe("plan-store — migrateV4 (v4 → v5, direction defaults LR)", () => {
  it("flips the header, defaults flowDirection 'LR'; stages/links/timestamps verbatim", () => {
    const v4 = samplePlanV4({
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2021-02-03T04:05:06.000Z",
      stages: [
        { name: "A", selection: sampleSelection(), position: { x: 5, y: 6 } },
        { name: "B", selection: sampleSelection() },
      ],
      links: [{ from: 0, to: 1, itemId: "iron_ingot" }],
    });
    const v5 = migrateV4(v4);
    expect(v5.format_version).toBe(5);
    // A v4 file never carried a direction → "LR" (its implicit orientation).
    expect(v5.flowDirection).toBe("LR");
    expect(v5.createdAt).toBe("2020-01-01T00:00:00.000Z");
    expect(v5.updatedAt).toBe("2021-02-03T04:05:06.000Z");
    expect(v5.stages).toBe(v4.stages);
    expect(v5.links).toEqual(v4.links);
    // No userPlaced flag is synthesized — pre-v5 seeding falls back to
    // position-presence at load, not to a written flag.
    expect(v5.stages[0]!.userPlaced).toBeUndefined();
  });

  it("a stored v4 row still loads (migrated to v8) through loadPlan", async () => {
    const db = await (await import("./db.ts")).openDb();
    await db.put("plans", samplePlanV4({ name: "legacy-v4" }), "id");
    const loaded = await loadPlan("id");
    expect(loaded).not.toBeNull();
    expect(loaded!.format_version).toBe(8);
    expect(loaded!.flowDirection).toBe("LR");
    expect(loaded!.name).toBe("legacy-v4");
  });
});

describe("plan-store — v5 round-trip (flowDirection + userPlaced)", () => {
  it("round-trips a TB direction and a per-stage userPlaced flag", async () => {
    const id = crypto.randomUUID();
    const plan = samplePlanV5({
      flowDirection: "TB",
      stages: [
        {
          name: "A",
          selection: sampleSelection(),
          position: { x: 40, y: 40 },
          userPlaced: true,
        },
        // An auto-placed stage carries a position but NO userPlaced flag.
        {
          name: "B",
          selection: sampleSelection(),
          position: { x: 40, y: 180 },
        },
      ],
    });
    const db = await (await import("./db.ts")).openDb();
    await db.put("plans", plan, id);
    const loaded = await loadPlan(id);
    expect(loaded!.format_version).toBe(8);
    expect(loaded!.flowDirection).toBe("TB");
    expect(loaded!.stages[0]!.userPlaced).toBe(true);
    expect(loaded!.stages[1]!.userPlaced).toBe(false);
  });
});

describe("plan-store — isPlanFileV5 accept/reject", () => {
  async function putRaw(value: unknown): Promise<void> {
    const db = await (await import("./db.ts")).openDb();
    await db.put("plans", value, "id");
  }

  it("accepts a well-formed v5 plan (LR, no userPlaced)", async () => {
    await putRaw(samplePlanV5());
    expect(await loadPlan("id")).not.toBeNull();
  });

  it("accepts a v5 stage flagged userPlaced: true", async () => {
    await putRaw(
      samplePlanV5({
        stages: [
          {
            name: "S",
            selection: sampleSelection(),
            position: { x: 0, y: 0 },
            userPlaced: true,
          },
        ],
      }),
    );
    expect(await loadPlan("id")).not.toBeNull();
  });

  it("rejects a malformed flowDirection (not 'LR'|'TB')", async () => {
    await putRaw(samplePlanV5({ flowDirection: "diagonal" as never }));
    expect(await loadPlan("id")).toBeNull();
  });

  it("rejects a missing flowDirection (v5 requires it)", async () => {
    const plan = samplePlanV5();
    delete (plan as { flowDirection?: unknown }).flowDirection;
    await putRaw(plan);
    expect(await loadPlan("id")).toBeNull();
  });

  it("rejects a non-`true` userPlaced (false, 1, 'true' are all corrupt)", async () => {
    for (const bad of [false, 1, "true"]) {
      await putRaw(
        samplePlanV5({
          stages: [
            {
              name: "S",
              selection: sampleSelection(),
              position: { x: 0, y: 0 },
              userPlaced: bad as never,
            },
          ],
        }),
      );
      expect(await loadPlan("id")).toBeNull();
    }
  });
});

describe("plan-store — isPlanFileV4 transport accept/reject (S8P2 extensions)", () => {
  async function putRaw(value: unknown): Promise<void> {
    const db = await (await import("./db.ts")).openDb();
    await db.put("plans", value, "id");
  }

  // A v4 file (format_version 4) carrying ONE link with the given transport —
  // the ONLY path that exercises the strict v4 field validation (a v3 file would
  // route through the lenient v3 validator + migrateV3 instead).
  function v4WithTransport(transport: unknown): unknown {
    return samplePlanV4({
      stages: [
        { name: "A", selection: sampleSelection() },
        { name: "B", selection: sampleSelection() },
      ],
      links: [{ from: 0, to: 1, itemId: "iron_ingot", transport } as never],
    });
  }

  it("accepts a pipe with a valid (0,100] deratePercentText", async () => {
    await putRaw(v4WithTransport({ mode: "pipe", deratePercentText: "80" }));
    expect(await loadPlan("id")).not.toBeNull();
  });

  it("accepts a bare pipe (no derate) and a bare belt", async () => {
    await putRaw(v4WithTransport({ mode: "pipe" }));
    expect(await loadPlan("id")).not.toBeNull();
    await putRaw(v4WithTransport({ mode: "belt" }));
    expect(await loadPlan("id")).not.toBeNull();
  });

  it("accepts a train with a valid absent-or-true sharedEnds", async () => {
    await putRaw(
      v4WithTransport({
        mode: "train",
        trip: { kind: "estimated", distanceText: "1200" },
        sharedEnds: { from: true },
      }),
    );
    expect(await loadPlan("id")).not.toBeNull();
    await putRaw(
      v4WithTransport({
        mode: "train",
        trip: { kind: "estimated", distanceText: "1200" },
        sharedEnds: { from: true, to: true },
      }),
    );
    expect(await loadPlan("id")).not.toBeNull();
  });

  it("accepts a train with BOTH fields absent (identical to today)", async () => {
    await putRaw(
      v4WithTransport({
        mode: "train",
        trip: { kind: "estimated", distanceText: "1200" },
      }),
    );
    expect(await loadPlan("id")).not.toBeNull();
  });

  it.each([
    ["0", "0 out of (0,100]"],
    ["-1", "negative"],
    ["100.1", ">100 boost"],
    ["150", ">100 boost"],
    ["abc", "unparseable"],
  ])("rejects a pipe derate %j (%s)", async (derate) => {
    await putRaw(v4WithTransport({ mode: "pipe", deratePercentText: derate }));
    expect(await loadPlan("id")).toBeNull();
  });

  it("rejects a deratePercentText on a NON-pipe arm (belt / train / road)", async () => {
    await putRaw(v4WithTransport({ mode: "belt", deratePercentText: "80" }));
    expect(await loadPlan("id")).toBeNull();
    await putRaw(
      v4WithTransport({
        mode: "train",
        trip: { kind: "estimated", distanceText: "1200" },
        deratePercentText: "80",
      }),
    );
    expect(await loadPlan("id")).toBeNull();
    await putRaw(
      v4WithTransport({
        mode: "truck",
        trip: { kind: "estimated", distanceText: "500" },
        deratePercentText: "80",
      }),
    );
    expect(await loadPlan("id")).toBeNull();
  });

  it.each([
    [{ from: false }, "false is not the absent-or-true idiom"],
    [{ to: "yes" }, "a non-true value"],
    [{ from: 1 }, "a truthy non-true value"],
  ])("rejects a sharedEnds with %o (%s)", async (sharedEnds, _why) => {
    void _why;
    await putRaw(
      v4WithTransport({
        mode: "train",
        trip: { kind: "estimated", distanceText: "1200" },
        sharedEnds,
      }),
    );
    expect(await loadPlan("id")).toBeNull();
  });

  it("rejects a sharedEnds on a NON-train arm (pipe / road)", async () => {
    await putRaw(v4WithTransport({ mode: "pipe", sharedEnds: { from: true } }));
    expect(await loadPlan("id")).toBeNull();
    await putRaw(
      v4WithTransport({
        mode: "truck",
        trip: { kind: "estimated", distanceText: "500" },
        sharedEnds: { from: true },
      }),
    );
    expect(await loadPlan("id")).toBeNull();
  });
});

describe("plan-store — isPlanFileV3 transport accept/reject", () => {
  async function putRaw(value: unknown): Promise<void> {
    const db = await (await import("./db.ts")).openDb();
    await db.put("plans", value, "id");
  }

  function planWithTransport(transport: unknown): unknown {
    return samplePlanV3({
      stages: [
        { name: "A", selection: sampleSelection() },
        { name: "B", selection: sampleSelection() },
      ],
      links: [{ from: 0, to: 1, itemId: "iron_ingot", transport } as never],
    });
  }

  it("accepts a belt-arm transport (no trip)", async () => {
    await putRaw(planWithTransport({ mode: "belt" }));
    expect(await loadPlan("id")).not.toBeNull();
  });

  it("accepts a vehicle estimated trip with a positive distance", async () => {
    await putRaw(
      planWithTransport({
        mode: "truck",
        trip: { kind: "estimated", distanceText: "500" },
      }),
    );
    expect(await loadPlan("id")).not.toBeNull();
  });

  it("accepts a drone measured trip with an optional flight distance", async () => {
    await putRaw(
      planWithTransport({
        mode: "drone",
        fuel: "battery",
        trip: {
          kind: "measured",
          roundTripSecondsText: "120",
          flightMetersText: "3000",
        },
      }),
    );
    expect(await loadPlan("id")).not.toBeNull();
  });

  it("rejects an unknown mode", async () => {
    await putRaw(planWithTransport({ mode: "teleporter" }));
    expect(await loadPlan("id")).toBeNull();
  });

  it("rejects an unparseable trip Fraction string", async () => {
    await putRaw(
      planWithTransport({
        mode: "truck",
        trip: { kind: "estimated", distanceText: "not-a-number" },
      }),
    );
    expect(await loadPlan("id")).toBeNull();
  });

  it("rejects a zero (non-positive) trip value", async () => {
    await putRaw(
      planWithTransport({
        mode: "train",
        trip: { kind: "measured", roundTripSecondsText: "0" },
      }),
    );
    expect(await loadPlan("id")).toBeNull();
  });

  it("rejects a drone arm with an unknown fuel", async () => {
    await putRaw(
      planWithTransport({
        mode: "drone",
        fuel: "coal",
        trip: { kind: "estimated", flightMetersText: "1000" },
      }),
    );
    expect(await loadPlan("id")).toBeNull();
  });
});
