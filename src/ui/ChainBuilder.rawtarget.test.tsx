/**
 * @vitest-environment jsdom
 */

/**
 * ChainBuilder RAW-TARGET tests (S21 P0, ticket #104).
 *
 * Spec item 2 records a deliberately ACCEPTED visible UI change: once an
 * extraction resource classifies "natural", proposing it AS THE TARGET flips
 * the preview from a constrained line reading `RAW (no eligible producer):
 * Iron Ore 120/min` to the `Nothing to build — the target is a raw input.`
 * message — and the rate goes with it.
 *
 * WHERE THE RATE ACTUALLY LIVED (boundary r1 — the first draft of this header
 * blamed the metrics `<dl>`, which is wrong): the rate was emitted by the
 * CONSTRAINED LINE itself (`ChainBuilder.tsx:541`), so suppressing that line
 * removes it. The metrics `<dl>` is merely where a NATURAL raw's rate would
 * otherwise have gone, and it is gated on `!view.isEmpty` — but `isEmpty` is
 * `proposal.stages.length === 0`, already true for an all-raw proposal BEFORE
 * this change and untouched by it. So the `<dl>` was absent either way; it
 * does not "go with" anything.
 *
 * The flip is the honest answer to "propose me Iron Ore" and strictly better
 * than pointing the user at a machine the default excludes on purpose, but it
 * is a USER-VISIBLE change, so the design required it be tested rather than
 * discovered.
 *
 * WHY jsdom RATHER THAN THE REPO'S SSR-SMOKE POSTURE — the same reason
 * ChainBuilder.gating.test.tsx departs (see its header): the message lives
 * inside the `preview !== null && view !== null` block, and `preview` is
 * component-local state set only by the Propose click handler, so a static
 * render never reaches it. The pragma above scopes jsdom to this file; the
 * global environment and every other suite are untouched.
 *
 * Runs against the REAL bundled catalog: the whole claim is about which items
 * the game only lets you make in an excluded machine, which no synthetic
 * fixture can stand in for.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";

import { parseCatalogFromText } from "../data/catalog.ts";
import type { Catalog } from "../data/types.ts";
import { appStore } from "../state/store.ts";
import { ChainBuilder } from "./ChainBuilder.tsx";
import bundledDocsText from "../../public/bundled-docs/en-US.json?raw";

// React's act() otherwise warns that the environment is not configured for it.
(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * A minimal in-memory `localStorage`, installed BEFORE the store module loads
 * — zustand's `createJSONStorage` resolves storage ONCE, eagerly, at
 * `store.ts` import time and guards only against a THROW, not an undefined
 * result. Installed any later, every persisted write would fail on
 * `undefined.setItem`. (Verbatim rationale from ChainBuilder.gating.test.tsx;
 * vitest's jsdom environment exposes no localStorage.)
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

const catalog: Catalog = parseCatalogFromText(bundledDocsText);

let container: HTMLDivElement;
let root: Root;

function mount(): void {
  appStore.setState({
    catalog: { status: "ready", catalog },
    proposePrefs: {
      overrides: {},
      // The app's own defaults (store.ts defaultProposePrefs) — this scenario
      // IS the fresh session, and with the Converter live Iron Ore would build
      // a real chain and prove nothing.
      excludedMachineIds: ["converter", "packager"],
      unlockedTier: null,
    },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<ChainBuilder />);
  });
}

const $$ = <T extends Element>(sel: string): T[] =>
  Array.from(container.querySelectorAll<T>(sel));

/** Propose `itemId` at `rate` — the entry into the preview block. */
function propose(itemId: string, rate: string): void {
  const select = $$<HTMLSelectElement>(".chain-builder-controls select")[0]!;
  act(() => {
    select.value = itemId;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const input = $$<HTMLInputElement>(".chain-builder-controls input")[0]!;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  act(() => {
    setter.call(input, rate);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => {
    $$<HTMLButtonElement>(".chain-builder-controls button")
      .find((b) => b.textContent === "Propose")!
      .click();
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  storage.clear();
});

describe("S21 P0 — proposing a natural-ized raw item as the target", () => {
  it("renders 'Nothing to build' instead of a constrained raw line", () => {
    mount();
    propose("ore_iron", "120");

    // The ACCEPTED change: the empty-state message now fires, because
    // ChainBuilder gates it on every raw input being "natural" and Iron Ore
    // just became natural.
    expect(container.querySelector(".chain-builder-empty")?.textContent).toBe(
      "Nothing to build — the target is a raw input.",
    );

    // And the constrained line it replaced is gone — asserted on the wording
    // the user actually reads, not just on the absence of a container.
    expect(container.textContent).not.toContain("no eligible producer");
    expect($$(".chain-builder-constrained")).toHaveLength(0);
  });

  it("drops the rate line with it (the accepted cost of the change)", () => {
    mount();
    propose("ore_iron", "120");

    // The rate was rendered BY the constrained line (ChainBuilder.tsx:541,
    // `{r.itemName} {r.rate}/min`), so suppressing that line takes the number
    // with it. Accepted: it is the value the user just typed, not something
    // the app computed for them.
    //
    // A `.chain-builder-metrics` absence assertion used to sit here and was
    // removed at boundary r1 as decorative — it cannot fail from this change.
    // `view.isEmpty` is `proposal.stages.length === 0`, already true for an
    // all-raw ore_iron proposal before P0 (pinned unchanged at
    // chain-builder-adapter.test.ts "marks an all-raw proposal empty"), and
    // this diff alters `cause`, never `isEmpty`.
    expect(container.textContent).not.toContain("120/min");
    // Discriminating replacement: the rate is not merely absent from the
    // metrics block, it is nowhere in the preview at all — including the RAW
    // <dd> where a natural raw's rate would normally be listed.
    expect(container.textContent).not.toContain("120");
  });

  it("renders Iron Ore on the plain RAW line for an ordinary chain (the improvement, + control)", () => {
    // Doubles as the CONTROL for the rows above — a propose() that silently
    // no-opped would make every "not.toContain" assertion vacuously true.
    mount();
    propose("iron_plate", "60");
    expect(container.querySelector(".chain-builder-empty")).toBe(null);
    expect($$(".chain-builder-metrics")).toHaveLength(1);
    expect(container.textContent).toContain("Iron Plate — Constructor");

    // THE HEADLINE OUTCOME (boundary r1 NIT — previously unpinned at the UI
    // layer: the accepted regression was tested and the improvement it pays
    // for was not). This is the design's opening walk step: propose Iron Plate
    // and Iron Ore lands on the plain RAW line with NO "no eligible producer"
    // pointer at a machine the default excludes on purpose.
    //
    // Exercises the `naturalRaws` path (ChainBuilder.tsx:347-348 → the RAW
    // <dd> at :466), which no other test reaches for a NON-EMPTY chain.
    // 90/min, not 60: Iron Plate 60/min draws 90 Iron Ore/min.
    expect($$(".chain-builder-constrained")).toHaveLength(0);
    expect(container.textContent).not.toContain("no eligible producer");
    expect(container.textContent).toContain("Iron Ore 90/min");
  });
});
