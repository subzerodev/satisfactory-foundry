/**
 * @vitest-environment jsdom
 */

/**
 * ChainBuilder tier-gating SEAM tests (S20 P3, ticket #102).
 *
 * WHY THIS FILE DEPARTS FROM THE REPO'S SSR-SMOKE POSTURE. Everywhere else the
 * UI suites render through `renderToStaticMarkup` in the global node
 * environment, and interactive propose→preview→apply is left to the browser
 * walk. That cannot work for these rows, for two compounding reasons:
 *
 *  1. The gate-sensitive call sites are reachable only through ChainBuilder's
 *     `preview !== null && view !== null` block, and `preview` is
 *     component-local state set only by the Propose click handler — so a
 *     static render never reaches them at all.
 *  2. The wiring they pin is NOT compile-forced: `gateCatalog` returns a plain
 *     `Catalog`, so passing the gated or the ungated world typechecks
 *     identically at every seam. A missed seam is a SILENT behavioural
 *     regression, and an adapter-level test cannot catch it — the adapter is
 *     handed whichever catalog the component chose, which is the very thing
 *     under test. (A branded `GatedCatalog` type is deferred to #106.)
 *
 * So this ONE file runs in jsdom (scoped by the pragma above; the global
 * environment and every other test file are untouched) and drives React with
 * `createRoot` + `act`. No testing-library — a plain value-set plus a bubbling
 * event fires `onChange` for a `<select>`, and text inputs go through the
 * native value setter so React's value tracker sees the change.
 *
 * Two ambient facts, MEASURED rather than assumed. Vitest's jsdom environment
 * exposes NO `localStorage` (the global exists but is undefined) while the
 * persisted store's write path calls `setItem` unguarded, so the file installs
 * a minimal in-memory stand-in below — which also means the mirror-back
 * assertions exercise the real persist path rather than a degraded one. There
 * is no `indexedDB` either, which is fine: nothing here touches the catalog
 * cache.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";

import { Fraction } from "../core/fraction.ts";
import type {
  Catalog,
  CatalogItem,
  CatalogMachine,
  CatalogRecipe,
} from "../data/types.ts";
import { appStore } from "../state/store.ts";
import { ChainBuilder } from "./ChainBuilder.tsx";

// React's act() otherwise warns that the environment is not configured for it.
// There are no setupFiles and no testing-library (which normally sets this).
(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * A minimal in-memory `localStorage`, installed BEFORE the store module loads.
 * `vi.hoisted` is required, not stylistic: zustand's `createJSONStorage`
 * resolves the storage ONCE, eagerly, when `store.ts` builds the `appStore`
 * singleton at import time — and it guards only against a THROW, not against
 * an undefined result. Installed any later, every persisted write would fail
 * on `undefined.setItem`.
 */
const storage = vi.hoisted(() => {
  const memory = new Map<string, string>();
  const stub: Storage = {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => void memory.set(k, v),
    removeItem: (k) => void memory.delete(k),
    clear: () => memory.clear(),
    key: (i) => [...memory.keys()][i] ?? null,
    get length() {
      return memory.size;
    },
  };
  (globalThis as unknown as { localStorage: Storage }).localStorage = stub;
  return stub;
});

const F = (n: number): Fraction => Fraction.from(n);

function item(id: string, displayName: string): CatalogItem {
  return { id, displayName, isFluid: false, stackSize: F(100) };
}
function machine(id: string, displayName: string): CatalogMachine {
  return {
    id,
    displayName,
    power: { mw: F(4), variable: false, exponent: F(1) },
  };
}
function recipe(
  id: string,
  displayName: string,
  machineId: string,
  outputs: [string, number][],
  inputs: [string, number][],
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
function catalogOf(
  recipes: CatalogRecipe[],
  recipeUnlocks: Record<string, number>,
): Catalog {
  return {
    items: Object.fromEntries(
      [item("plate", "Plate"), item("ingot", "Ingot"), item("ore", "Ore")].map(
        (i) => [i.id, i],
      ),
    ),
    machines: Object.fromEntries(
      [
        machine("constructor", "Constructor"),
        machine("smelter", "Smelter"),
        machine("foundry", "Foundry"),
        machine("refinery", "Refinery"),
      ].map((m) => [m.id, m]),
    ),
    recipes: Object.fromEntries(recipes.map((r) => [r.id, r])),
    tiers: { belt: [F(60)], pipe: [F(300)] },
    recipeUnlocks,
  };
}

const PLATE = recipe(
  "r_plate",
  "Plate",
  "constructor",
  [["plate", 20]],
  [["ingot", 30]],
);

/**
 * Ingot has FOUR producers spanning both levers of the gate:
 *   r_a_std — Smelter,  non-alternate, unlock 5  ← the UNGATED default D
 *   r_b_std — Foundry,  non-alternate, unlock 0  ← the GATED default D′ at 0
 *   r_c_alt — Refinery, alternate,     unlock 0  ← keeps the picker ≥2 at 0
 *   r_d_alt — Refinery, alternate,     unlock 5  ← must vanish at tier 0
 * Ids are ordered so the default policy (lowest id among non-alternates) picks
 * r_a_std ungated and r_b_std at tier 0 — which is what makes the `(default)`
 * tag and the two-step clear-rule rows discriminating.
 */
function splitCatalog(): Catalog {
  return catalogOf(
    [
      PLATE,
      recipe("r_a_std", "Alpha", "smelter", [["ingot", 30]], [["ore", 30]]),
      recipe("r_b_std", "Bravo", "foundry", [["ingot", 30]], [["ore", 35]]),
      recipe(
        "r_c_alt",
        "Charlie",
        "refinery",
        [["ingot", 30]],
        [["ore", 40]],
        true,
      ),
      recipe(
        "r_d_alt",
        "Delta",
        "refinery",
        [["ingot", 30]],
        [["ore", 45]],
        true,
      ),
    ],
    { r_plate: 0, r_a_std: 5, r_b_std: 0, r_c_alt: 0, r_d_alt: 5 },
  );
}

/** Every ingot producer sits at tier 5, so tier 0 gates the item out entirely. */
function allGatedCatalog(): Catalog {
  return catalogOf(
    [
      PLATE,
      recipe("r_only", "Only", "smelter", [["ingot", 30]], [["ore", 30]]),
      recipe(
        "r_alt",
        "Only Alt",
        "foundry",
        [["ingot", 30]],
        [["ore", 35]],
        true,
      ),
    ],
    { r_plate: 0, r_only: 5, r_alt: 5 },
  );
}

// --- harness ---------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

function mount(
  catalog: Catalog,
  prefs: Partial<{
    overrides: Record<string, string>;
    excludedMachineIds: string[];
    unlockedTier: number | null;
  }> = {},
): void {
  appStore.setState({
    catalog: { status: "ready", catalog },
    proposePrefs: {
      overrides: {},
      excludedMachineIds: [],
      unlockedTier: null,
      ...prefs,
    },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<ChainBuilder />);
  });
}

const $ = <T extends Element>(sel: string): T =>
  container.querySelector<T>(sel)!;
const $$ = <T extends Element>(sel: string): T[] =>
  Array.from(container.querySelectorAll<T>(sel));

/** Set a <select> and fire React's onChange (no value-tracker short-circuit). */
function chooseOption(el: HTMLSelectElement, value: string): void {
  act(() => {
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/** Set a text <input> through the NATIVE setter, so React's value tracker sees
 *  the change and does not swallow the event. */
function typeInto(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function click(el: HTMLElement): void {
  act(() => {
    el.click();
  });
}

/** Propose `plate` at 60/min — the entry into the preview block every seam
 *  below lives inside. */
function propose(): void {
  const selects = $$<HTMLSelectElement>(".chain-builder-controls select");
  chooseOption(selects[0]!, "plate");
  typeInto($$<HTMLInputElement>(".chain-builder-controls input")[0]!, "60");
  click(
    $$<HTMLButtonElement>(".chain-builder-controls button").find(
      (b) => b.textContent === "Propose",
    )!,
  );
}

const tierSelect = (): HTMLSelectElement =>
  $<HTMLSelectElement>("select.chain-builder-tier-select");

/** The TIER select's SELECTED option label — what the user actually sees. */
function selectedTierLabel(): string | null {
  const el = tierSelect();
  return el.selectedIndex < 0
    ? null
    : (el.options[el.selectedIndex]?.textContent ?? null);
}

/** The stage row for `Item …` in the rendered preview. Matched on the row
 *  sentence's "<item> — " lead, not the start of textContent: the first row of
 *  each depth is prefixed by a `T<depth>` tier marker. */
const stageRow = (itemName: string): HTMLLIElement =>
  $$<HTMLLIElement>(".chain-builder-rows li").find((li) =>
    li.textContent!.includes(`${itemName} — `),
  )!;

/** Open the stage picker (the chip is a TOGGLE, so only click it when closed —
 *  a second unconditional click would collapse it again) and return its option
 *  labels. The chip is the row's first button; the RAW toggle follows it. */
function openPickerOptions(itemName: string): string[] {
  const chip = stageRow(itemName).querySelector<HTMLButtonElement>("button")!;
  if (chip.getAttribute("aria-expanded") !== "true") click(chip);
  return $$<HTMLOptionElement>(
    'select[aria-label="pick a recipe for this stage"] option',
  ).map((o) => o.textContent!);
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  storage.clear();
});

// --- the seam rows ---------------------------------------------------------

describe("S20 P3 seams — the gated world reaches the render (jsdom)", () => {
  it("RecipePicker prop: a tier-gated recipe is ABSENT from the rendered picker options", () => {
    mount(splitCatalog(), { unlockedTier: 0 });
    propose();
    const labels = openPickerOptions("Ingot");
    // Available at tier 0 (unlock 0).
    expect(labels.some((l) => l.startsWith("Bravo"))).toBe(true);
    expect(labels.some((l) => l.startsWith("Charlie"))).toBe(true);
    // Gated out at tier 0 (unlock 5) — this is the whole "gated-out recipes
    // vanish from pickers and chips" claim. An ungated prop would list them.
    expect(labels.some((l) => l.startsWith("Alpha"))).toBe(false);
    expect(labels.some((l) => l.startsWith("Delta"))).toBe(false);
  });

  it("RecipePicker prop: the same recipes ARE offered at tier 'all'", () => {
    // The control for the row above: absence must be caused by the tier, not
    // by the fixture.
    mount(splitCatalog(), { unlockedTier: null });
    propose();
    const labels = openPickerOptions("Ingot");
    expect(labels.some((l) => l.startsWith("Alpha"))).toBe(true);
    expect(labels.some((l) => l.startsWith("Delta"))).toBe(true);
  });

  it("recipeLabel via the picker prop: the GATED default carries the (default) tag", () => {
    // At tier 0 the ungated default (Alpha) is gated out, so the gated default
    // is Bravo. Under a missed seam `recipeLabel` would resolve the default
    // against the UNGATED catalog — yielding Alpha, which is absent from these
    // options, so NO option would carry the tag at all.
    mount(splitCatalog(), { unlockedTier: 0 });
    propose();
    const labels = openPickerOptions("Ingot");
    expect(labels.find((l) => l.includes("(default)"))).toBe("Bravo (default)");
  });

  it("constrained recovery: at a tier where every producer is gated, the TIER hint renders and there is NO recovery select", () => {
    mount(allGatedCatalog(), { unlockedTier: 0 });
    propose();
    const row = $<HTMLParagraphElement>("p.chain-builder-constrained");
    expect(row.textContent).toContain("RAW (no eligible producer): Ingot");
    expect(row.textContent).toContain(
      "locked behind the TIER gate; raise TIER to recover.",
    );
    // An ungated option list here would render a dead <select> offering
    // recipes the gated solve then validate-and-ignores — a control that
    // contradicts the hint's own "raise TIER" advice.
    expect(row.querySelector("select")).toBe(null);
  });

  it("constrained recovery: at tier null the wording is P1's exact string (regression)", () => {
    // The tier lever cannot fire at "all", so the four-cell matrix reduces to
    // exactly one reachable cell. This pins the reduction against drift.
    mount(allGatedCatalog(), {
      unlockedTier: null,
      excludedMachineIds: ["smelter", "foundry"],
    });
    propose();
    expect($<HTMLElement>(".chain-builder-constrained-hint").textContent).toBe(
      " — every producer's machine is excluded; edit MACHINE EXCLUSIONS to recover.",
    );
  });

  it("clear rule: choosing the GATED default sets no override — observable only after raising the tier back", () => {
    // Step one cannot discriminate: under correct wiring choosing Bravo (the
    // gated default) CLEARS, and under the missed seam it SETS
    // ingot → r_b_std; both re-propose to Bravo with identical output.
    mount(splitCatalog(), { unlockedTier: 0 });
    propose();
    openPickerOptions("Ingot");
    chooseOption(
      $<HTMLSelectElement>('select[aria-label="pick a recipe for this stage"]'),
      "r_b_std",
    );
    expect(stageRow("Ingot").textContent).toContain("Ingot — Foundry");

    // Step two makes it observable: with no override the default policy picks
    // Alpha again; a spurious override would pin the stage to Bravo (and it is
    // a VALID ungated id, so validate-and-ignore does not rescue it).
    chooseOption(tierSelect(), "");
    expect(stageRow("Ingot").textContent).toContain("Ingot — Smelter");
    expect(appStore.getState().proposePrefs.overrides).toEqual({});
  });

  it("the render seams follow a TIER change too, not just the propose", () => {
    // The body derivation is memoized on [catalog, unlockedTier]. Were the tier
    // dropped from those deps, `gated` would freeze at the tier of the first
    // render — the propose would still be correct (it derives its own world
    // from the patch), so ONLY a render-seam assertion catches it: the picker
    // would keep offering the old tier's recipes indefinitely.
    mount(splitCatalog(), { unlockedTier: null });
    propose();
    expect(openPickerOptions("Ingot").some((l) => l.startsWith("Delta"))).toBe(
      true,
    );

    chooseOption(tierSelect(), "0");
    const afterLabels = openPickerOptions("Ingot");
    expect(afterLabels.some((l) => l.startsWith("Delta"))).toBe(false);
    expect(afterLabels.some((l) => l.startsWith("Bravo"))).toBe(true);
  });

  it("staleness: a TIER change re-proposes in the NEW tier's world on that same propose", () => {
    // The r4 pin. `unlockedTier` is stale within the tick, so a `gated` derived
    // from the state binding would gate at the OLD tier on the very propose the
    // change triggers — leaving Alpha (gated out at 0) as the stage recipe.
    mount(splitCatalog(), { unlockedTier: null });
    propose();
    expect(stageRow("Ingot").textContent).toContain("Ingot — Smelter");

    chooseOption(tierSelect(), "0");
    expect(stageRow("Ingot").textContent).toContain("Ingot — Foundry");
  });
});

describe("S20 P3 — TIER select rendering + persistence mirror (jsdom)", () => {
  it("derives its options from recipeUnlocks (all + 0..max), never hardcoded", () => {
    mount(splitCatalog(), { unlockedTier: null });
    expect(
      $$<HTMLOptionElement>("select.chain-builder-tier-select option").map(
        (o) => o.textContent,
      ),
    ).toEqual(["all", "0", "1", "2", "3", "4", "5"]);
  });

  it("renders 'all' when the persisted tier has no matching option", () => {
    // Render-level normalization: an above-range tier gates nothing, so it
    // already BEHAVES as "all" and is shown that way. No clamp, no write-back.
    //
    // This locks the user-visible outcome, NOT the binding expression that
    // produces it. Measured: `value={""}` and `value={"999"}` yield a
    // byte-identical DOM here — value, selectedIndex, per-option selected flags
    // and innerHTML all match — because the DOM's own "ask for a reset"
    // algorithm selects the first option when none matches. The explicit
    // binding in ChainBuilder is therefore defensive (it keeps a server-
    // rendered string honest); on this client path it is a no-op, so no
    // assertion here can discriminate it, and none pretends to.
    mount(splitCatalog(), { unlockedTier: 999 });
    expect(selectedTierLabel()).toBe("all");
    // Nothing was written back — the stored value is left exactly as found.
    expect(appStore.getState().proposePrefs.unlockedTier).toBe(999);
  });

  it("renders 'all' when the catalog carries no unlock data at all", () => {
    mount(catalogOf([PLATE], {}), { unlockedTier: 3 });
    expect(selectedTierLabel()).toBe("all");
    expect(
      $$<HTMLOptionElement>("select.chain-builder-tier-select option").map(
        (o) => o.textContent,
      ),
    ).toEqual(["all"]);
  });

  it("renders the persisted tier when it IS among the options", () => {
    mount(splitCatalog(), { unlockedTier: 2 });
    expect(selectedTierLabel()).toBe("2");
  });

  it("mirrors a tier change back to the persisted prefs", () => {
    mount(splitCatalog(), { unlockedTier: null });
    chooseOption(tierSelect(), "3");
    expect(appStore.getState().proposePrefs.unlockedTier).toBe(3);
    chooseOption(tierSelect(), "");
    expect(appStore.getState().proposePrefs.unlockedTier).toBe(null);
  });

  it("seeds its controls from the persisted prefs", () => {
    mount(splitCatalog(), {
      unlockedTier: 2,
      excludedMachineIds: ["refinery"],
    });
    expect(tierSelect().value).toBe("2");
    // The exclusions panel reflects the seeded set, and its list stays UNGATED
    // so a high-tier machine's checkbox is never deleted out from under a
    // persisted exclusion.
    expect(
      $<HTMLElement>(".chain-builder-exclusions summary").textContent,
    ).toBe("MACHINE EXCLUSIONS (1)");
    const checked = $$<HTMLInputElement>(
      ".chain-builder-exclusions input[type=checkbox]",
    ).filter((c) => c.checked);
    expect(checked).toHaveLength(1);
  });
});
