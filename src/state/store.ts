/**
 * The v1 app store: recipe selection + solver inputs, the catalog lifecycle,
 * and the eagerly-derived solve result. One Zustand vanilla store (headless-
 * testable) wrapped with a one-line React hook for Phase 4; unlocked tiers are
 * the only slice persisted (localStorage), via the persist middleware.
 *
 * Frozen design: features/manifold-visualizer/phase-3/{brainstorm,spec}.md.
 * The store adapts to the frozen data/core contracts (src/data/*,
 * src/core/manifold.ts) — never the reverse.
 */

import { createStore } from "zustand/vanilla";
import { useStore } from "zustand/react";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";

import { Fraction } from "../core/fraction.ts";
import { solveStage } from "../core/manifold.ts";
import type { StageSolveResult } from "../core/manifold.ts";
import type { Catalog } from "../data/types.ts";
import { TIER_TABLE } from "../data/tiers.ts";
import { parseCatalogFromText } from "../data/catalog.ts";
import { loadCatalog, saveCatalog } from "../data/catalog-store.ts";
import type { CatalogSource } from "../data/catalog-store.ts";
import { toStageInput } from "../data/stage-input.ts";
import type { StageOptions } from "../data/stage-input.ts";

// ---------------------------------------------------------------------------
// State shape (frozen brainstorm Axis 2)
// ---------------------------------------------------------------------------

export type CatalogState =
  | { status: "initializing" }
  | {
      status: "needs-upload";
      reason: "empty" | "stale" | "upload-error";
      message?: string;
    }
  | { status: "ready"; catalog: Catalog };

export interface Selection {
  recipeId: string | null;
  /** UI-facing integer, default 1. */
  machineCount: number;
  /** Raw user input; parsed at derive time. Default "100". */
  clockPercentText: string;
  /** Prefix count of unlocked tiers per kind; default the full table. */
  unlockedTiers: { belt: number; pipe: number };
  /** Per-belt capacity overrides as exact decimal strings; arrays ALWAYS dense
   *  (null-padded). Keyed by lane itemId. */
  overrides: {
    feeds: Record<string, (string | null)[]>;
    outputs: Record<string, (string | null)[]>;
  };
}

export type SolveState =
  | { status: "idle" }
  | { status: "solved"; result: StageSolveResult }
  | {
      status: "invalid";
      reason: "bad-clock" | "bad-machine-count" | "bad-override";
      detail: string;
    };

export interface AppState {
  catalog: CatalogState;
  selection: Selection;
  solve: SolveState;
  /**
   * Provenance of the current 'ready' catalog: null until it resolves, then
   * { kind: 'user' } for an upload or { kind: 'bundled', … } for the bundled
   * snapshot. A sibling field, orthogonal to the frozen CatalogState union —
   * it drives the ticket #9 provenance banner (bundled only).
   */
  catalogSource: CatalogSource | null;
  /**
   * Transient last upload/persist failure while a working catalog stayed
   * 'ready'; cleared on the next upload attempt. Fresh-boot upload failure
   * (no prior catalog) lands in needs-upload{'upload-error'} instead — the two
   * cases are DISJOINT by construction.
   */
  uploadError: string | null;
}

export interface Actions {
  init(): Promise<void>;
  uploadDocsText(text: string): Promise<void>;
  selectRecipe(recipeId: string | null): void;
  setMachineCount(n: number): void;
  setClockPercentText(text: string): void;
  setUnlockedTiers(t: { belt: number; pipe: number }): void;
  setOverride(
    side: "feeds" | "outputs",
    itemId: string,
    beltIndex: number,
    capacityText: string | null,
  ): void;
  clearOverrides(): void;
}

export type Store = AppState & Actions;

// ---------------------------------------------------------------------------
// Defaults (frozen spec §Defaults)
// ---------------------------------------------------------------------------

function defaultSelection(): Selection {
  return {
    recipeId: null,
    machineCount: 1,
    clockPercentText: "100",
    unlockedTiers: {
      belt: TIER_TABLE.belt.length,
      pipe: TIER_TABLE.pipe.length,
    },
    overrides: { feeds: {}, outputs: {} },
  };
}

// ---------------------------------------------------------------------------
// Derivation (frozen brainstorm Axis 3)
// ---------------------------------------------------------------------------

/**
 * Densify + parse one side's override strings into the solver's
 * `(Fraction | null)[]` shape. Arrays are already dense (null-padded) by
 * setOverride, but holes/null map to null defensively; a malformed capacity
 * string throws (routed to `invalid 'bad-override'` by the caller).
 */
function parseOverrideSide(
  side: Record<string, (string | null)[]>,
): Record<string, (Fraction | null)[]> {
  const out: Record<string, (Fraction | null)[]> = {};
  for (const [itemId, arr] of Object.entries(side)) {
    const parsed: (Fraction | null)[] = [];
    for (let i = 0; i < arr.length; i++) {
      const cell = arr[i] ?? null;
      // A malformed string throws here — Fraction.parse rejects it — and the
      // derive() catch routes it to 'bad-override'.
      parsed[i] = cell === null ? null : Fraction.parse(cell);
    }
    out[itemId] = parsed;
  }
  return out;
}

/**
 * Compute `solve` from `catalog` + `selection`. Pure over the passed state:
 * every mutating action applies its change fully, then calls this once, so
 * derive never observes an intermediate state.
 */
function derive(catalog: CatalogState, selection: Selection): SolveState {
  // No catalog, no recipeId, or a dangling id (recipe absent from the current
  // catalog) → idle. The dangling-id guard is belt-and-braces: re-upload
  // re-validation already resets a dropped recipeId to null.
  if (catalog.status !== "ready" || selection.recipeId === null) {
    return { status: "idle" };
  }
  const recipe = catalog.catalog.recipes[selection.recipeId];
  if (recipe === undefined) {
    return { status: "idle" };
  }

  // Clock text → positive Fraction, or 'bad-clock'.
  let clockPercent: Fraction;
  try {
    clockPercent = Fraction.parse(selection.clockPercentText);
  } catch {
    return {
      status: "invalid",
      reason: "bad-clock",
      detail: `clock percent must be a positive number; got ${JSON.stringify(selection.clockPercentText)}.`,
    };
  }
  if (clockPercent.lte(Fraction.from(0))) {
    return {
      status: "invalid",
      reason: "bad-clock",
      detail: `clock percent must be > 0; got ${JSON.stringify(selection.clockPercentText)}.`,
    };
  }

  // machineCount: non-negative safe integer. 0 is VALID (solver-degenerate).
  if (
    !Number.isSafeInteger(selection.machineCount) ||
    selection.machineCount < 0
  ) {
    return {
      status: "invalid",
      reason: "bad-machine-count",
      detail: `machine count must be a non-negative integer; got ${selection.machineCount}.`,
    };
  }

  // Densify + parse overrides; a malformed capacity string → 'bad-override'.
  let overrides: StageOptions["overrides"];
  try {
    overrides = {
      feeds: parseOverrideSide(selection.overrides.feeds),
      outputs: parseOverrideSide(selection.overrides.outputs),
    };
  } catch (err) {
    return {
      status: "invalid",
      reason: "bad-override",
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  // Build opts → toStageInput. Its SHAPE throws (unknown override key,
  // duplicate lane; tier-range is unreachable — clamped at the setter) →
  // 'bad-override'. Then solveStage: count-excess overrides surface as a
  // solver VALUE finding INSIDE result, i.e. 'solved' — the routing split.
  try {
    const input = toStageInput(recipe, catalog.catalog, {
      machineCount: selection.machineCount,
      clockPercent,
      unlockedTiers: selection.unlockedTiers,
      overrides,
    });
    return { status: "solved", result: solveStage(input) };
  } catch (err) {
    return {
      status: "invalid",
      reason: "bad-override",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Persistence (frozen brainstorm Axis 5)
// ---------------------------------------------------------------------------

/** localStorage key for the persisted tiers slice (v1). */
const PERSIST_KEY = "satis_foundry:tiers";

/** The persisted projection: top-level `{ unlockedTiers }` only. */
interface PersistedShape {
  unlockedTiers: { belt: number; pipe: number };
}

/** Clamp a tier count to `[1, TIER_TABLE.<kind>.length]`, defaulting a corrupt
 *  or missing value to the full table length. */
function clampTier(kind: "belt" | "pipe", value: unknown): number {
  const max = TIER_TABLE[kind].length;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return max;
  }
  if (value < 1) return 1;
  if (value > max) return max;
  return value;
}

/**
 * The store's `storage` is injectable so tests supply a plain-object stub and
 * the app supplies localStorage. A module-level slot lets `createAppStore`
 * take the storage per-instance without threading it through persist's typed
 * options (which key storage by the whole store type).
 */
let storageProvider: () => StateStorage = () => localStorage;

// ---------------------------------------------------------------------------
// Bundled-catalog boot seam (frozen brainstorm Axis 2, ticket #9)
// ---------------------------------------------------------------------------

/** The bundled snapshot's provenance, carried alongside its raw Docs text. */
export interface Provenance {
  steamBuild: string;
  extractedAt: string;
}

/**
 * Injection seam for the bundled default catalog, mirroring `storageProvider`:
 * the app wires a fetch of the static asset + provenance sidecar; tests inject
 * fixture text or `null`. Resolves `{ text, provenance }` as a UNIT — a
 * provenance-fetch failure collapses the whole result to null (no half-loaded
 * banner state). A `null` result — or a REJECTED promise — is the same degrade
 * path: init falls back to the v1 needs-upload behavior. The default returns
 * null so a store built without wiring (all current tests) simply degrades.
 */
let bundledDocsProvider: () => Promise<{
  text: string;
  provenance: Provenance;
} | null> = async () => null;

/** Wire the bundled-docs provider (the app calls this once; tests inject
 *  fixtures or a rejecting/null provider to exercise the degrade paths). */
export function setBundledDocsProvider(
  provider: () => Promise<{ text: string; provenance: Provenance } | null>,
): void {
  bundledDocsProvider = provider;
}

// ---------------------------------------------------------------------------
// Store construction (frozen brainstorm Axis 1)
// ---------------------------------------------------------------------------

/**
 * Build a fresh store instance. Tests call this per-case (with an injected
 * storage stub) to get isolated state; the app uses the singleton below.
 * With a synchronous storage, persist hydrates DURING creation — before any
 * action runs — so the first derive (in init()) already sees hydrated tiers.
 */
export function createAppStore(storage?: StateStorage) {
  if (storage) {
    storageProvider = () => storage;
  }
  return createStore<Store>()(
    persist(
      (set, get) => ({
        catalog: { status: "initializing" },
        selection: defaultSelection(),
        solve: { status: "idle" },
        catalogSource: null,
        uploadError: null,

        async init() {
          const result = await loadCatalog();
          if (result.status === "hit") {
            // Cache wins: a user upload or a previously-cached bundled catalog
            // never regresses. The persisted row's source drives the banner.
            set({
              catalog: { status: "ready", catalog: result.catalog },
              catalogSource: result.source,
            });
          } else {
            // empty / stale → try the bundled default before giving up. The
            // provider call is try/caught: a REJECTED promise degrades exactly
            // like a resolved null (both → the v1 needs-upload behavior).
            let bundled: { text: string; provenance: Provenance } | null;
            try {
              bundled = await bundledDocsProvider();
            } catch {
              bundled = null;
            }

            let ready = false;
            if (bundled !== null) {
              try {
                const catalog = parseCatalogFromText(bundled.text);
                const source: CatalogSource = {
                  kind: "bundled",
                  steamBuild: bundled.provenance.steamBuild,
                  extractedAt: bundled.provenance.extractedAt,
                };
                set({
                  catalog: { status: "ready", catalog },
                  catalogSource: source,
                });
                ready = true;
                // Cache the bundled catalog so later boots hit the fast path
                // (and keep the banner). Never-block save: a failure leaves it
                // usable this session, merely uncached, with an uploadError note
                // — the same semantics as the upload path.
                try {
                  await saveCatalog(bundled.text, catalog, source);
                } catch (err) {
                  const message =
                    err instanceof Error ? err.message : String(err);
                  set({
                    uploadError: `bundled catalog loaded but could not be cached: ${message}`,
                  });
                }
              } catch {
                // A corrupt bundled asset degrades to v1 needs-upload below.
                ready = false;
              }
            }

            if (!ready) {
              set({
                catalog: { status: "needs-upload", reason: result.status },
              });
            }
          }
          // Single first derive, after hydration + the catalog resolves.
          const { catalog, selection } = get();
          set({ solve: derive(catalog, selection) });
        },

        async uploadDocsText(text: string) {
          // Clear any prior transient error at entry — both the success and
          // failure paths start clean (frozen Axis 4).
          set({ uploadError: null });
          const hadReadyCatalog = get().catalog.status === "ready";

          let catalog: Catalog;
          try {
            // parseCatalogFromText = JSON.parse + parseDocsJson: a non-JSON
            // file throws SyntaxError, a bad schema throws DocsParseError.
            catalog = parseCatalogFromText(text);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            // Parse FAILURE: the in-memory catalog is NOT replaced, so
            // overrides are kept. Route by whether a working catalog existed.
            if (hadReadyCatalog) {
              set({ uploadError: message });
            } else {
              set({
                catalog: {
                  status: "needs-upload",
                  reason: "upload-error",
                  message,
                },
              });
            }
            const state = get();
            set({ solve: derive(state.catalog, state.selection) });
            return;
          }

          // Parse SUCCESS: the in-memory catalog IS replaced this session,
          // regardless of the save outcome — so overrides clear and the
          // recipeId is re-validated against the new catalog.
          const survivingRecipeId =
            get().selection.recipeId !== null &&
            catalog.recipes[get().selection.recipeId!] !== undefined
              ? get().selection.recipeId
              : null;
          set((s) => ({
            catalog: { status: "ready", catalog },
            // An upload flips provenance to user, hiding the bundled banner.
            catalogSource: { kind: "user" },
            selection: {
              ...s.selection,
              recipeId: survivingRecipeId,
              overrides: { feeds: {}, outputs: {} },
            },
          }));

          // Persist to the cache. A save failure does NOT block 'ready' — the
          // catalog is usable this session, merely uncached — with uploadError
          // noting the cache miss (frozen Axis 4 wide catch).
          try {
            await saveCatalog(text, catalog, { kind: "user" });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            set({
              uploadError: `catalog loaded but could not be cached: ${message}`,
            });
          }

          const state = get();
          set({ solve: derive(state.catalog, state.selection) });
        },

        selectRecipe(recipeId: string | null) {
          // Overrides are lane-addressed per recipe; carrying them across
          // recipes would misaddress lanes, so a recipe change clears them.
          set((s) => ({
            selection: {
              ...s.selection,
              recipeId,
              overrides: { feeds: {}, outputs: {} },
            },
          }));
          const { catalog, selection } = get();
          set({ solve: derive(catalog, selection) });
        },

        setMachineCount(n: number) {
          set((s) => ({ selection: { ...s.selection, machineCount: n } }));
          const { catalog, selection } = get();
          set({ solve: derive(catalog, selection) });
        },

        setClockPercentText(text: string) {
          set((s) => ({
            selection: { ...s.selection, clockPercentText: text },
          }));
          const { catalog, selection } = get();
          set({ solve: derive(catalog, selection) });
        },

        setUnlockedTiers(t: { belt: number; pipe: number }) {
          // Clamp at the action boundary so toStageInput's tier-range throw is
          // unreachable from store-driven flows (derive still catches).
          set((s) => ({
            selection: {
              ...s.selection,
              unlockedTiers: {
                belt: clampTier("belt", t.belt),
                pipe: clampTier("pipe", t.pipe),
              },
            },
          }));
          const { catalog, selection } = get();
          set({ solve: derive(catalog, selection) });
        },

        setOverride(
          side: "feeds" | "outputs",
          itemId: string,
          beltIndex: number,
          capacityText: string | null,
        ) {
          set((s) => {
            const sideMap = s.selection.overrides[side];
            const existing = sideMap[itemId] ?? [];
            // Dense write: grow to beltIndex, padding intermediate slots with
            // null. Never sparse — a sparse array's .length counts holes and
            // would trip the solver's overrides-exceed-belt-count check.
            const next = existing.slice();
            while (next.length <= beltIndex) {
              next.push(null);
            }
            next[beltIndex] = capacityText;
            return {
              selection: {
                ...s.selection,
                overrides: {
                  ...s.selection.overrides,
                  [side]: { ...sideMap, [itemId]: next },
                },
              },
            };
          });
          const { catalog, selection } = get();
          set({ solve: derive(catalog, selection) });
        },

        clearOverrides() {
          set((s) => ({
            selection: {
              ...s.selection,
              overrides: { feeds: {}, outputs: {} },
            },
          }));
          const { catalog, selection } = get();
          set({ solve: derive(catalog, selection) });
        },
      }),
      {
        name: PERSIST_KEY,
        storage: createJSONStorage<PersistedShape>(() => storageProvider()),
        partialize: (s): PersistedShape => ({
          unlockedTiers: s.selection.unlockedTiers,
        }),
        // Validating merge: write the persisted tiers back into
        // selection.unlockedTiers, clamped, defaulting on corrupt/missing.
        merge: (persisted, current): Store => {
          const p = persisted as Partial<PersistedShape> | undefined;
          const tiers = p?.unlockedTiers;
          return {
            ...current,
            selection: {
              ...current.selection,
              unlockedTiers: {
                belt: clampTier("belt", tiers?.belt),
                pipe: clampTier("pipe", tiers?.pipe),
              },
            },
          };
        },
      },
    ),
  );
}

/** The app-wide singleton (localStorage-backed). */
export const appStore = createAppStore();

/** React hook (unconsumed until Phase 4). */
export function useAppStore(): Store;
export function useAppStore<U>(selector: (state: Store) => U): U;
export function useAppStore<U>(selector?: (state: Store) => U): Store | U {
  return selector ? useStore(appStore, selector) : useStore(appStore);
}
