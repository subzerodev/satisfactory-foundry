// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { solveStage } from "../core/manifold.ts";
import { Schematic } from "./Schematic.tsx";
import { WORKED_INPUT, FIXTURE_TIERS } from "./fixtures.ts";

/**
 * Grab-to-pan (#154). The handler adjusts scrollLeft by the drag delta and
 * suppresses the trailing click past a 4px threshold; a pointerdown on an
 * interactive child (a bus segment) never starts a drag. jsdom stores scrollLeft
 * as a plain property, so the handler's math is directly observable.
 */
const itemName = (id: string) => id;

let host: HTMLDivElement;
let root: Root;

function down(el: Element, clientX: number): void {
  el.dispatchEvent(
    new PointerEvent("pointerdown", { clientX, button: 0, bubbles: true }),
  );
}
function move(clientX: number): void {
  window.dispatchEvent(new PointerEvent("pointermove", { clientX }));
}
function up(): void {
  window.dispatchEvent(new PointerEvent("pointerup", {}));
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function renderSchematic(machineCount: number): Promise<HTMLDivElement> {
  const result = solveStage({ ...WORKED_INPUT, machineCount });
  await act(async () =>
    root.render(
      <Schematic
        result={result}
        machineCount={machineCount}
        tiers={FIXTURE_TIERS}
        unlocked={{ belt: 4, pipe: 2 }}
        itemName={itemName}
      />,
    ),
  );
  // The scroll container is the outer div (schematic-scroll when scrolled).
  return host.querySelector("div") as HTMLDivElement;
}

describe("useGrabScroll", () => {
  it("pans the container by the drag delta (scrollLeft = startScroll − dx)", async () => {
    // N=106 → scrolled (24px floor). Drag the background left by 40px → the
    // content scrolls right by 40 (scrollLeft rises from its start by −dx).
    const container = await renderSchematic(106);
    container.scrollLeft = 100;
    await act(async () => {
      down(container, 200);
      move(160); // dx = −40
    });
    expect(container.scrollLeft).toBe(140); // 100 − (160 − 200) = 140
    await act(async () => up());
  });

  it("keeps tracking across multiple moves from the same pointerdown", async () => {
    const container = await renderSchematic(106);
    container.scrollLeft = 0;
    await act(async () => {
      down(container, 500);
      move(480); // dx = −20 → scrollLeft 20
      move(450); // dx = −50 → scrollLeft 50 (absolute from start, not cumulative)
    });
    expect(container.scrollLeft).toBe(50);
    await act(async () => up());
  });

  it("suppresses the click after a drag past the 4px threshold", async () => {
    const container = await renderSchematic(106);
    let clicked = false;
    container.addEventListener("click", () => {
      clicked = true;
    });
    await act(async () => {
      down(container, 200);
      move(190); // dx = −10 > 4px threshold → moved
      up();
    });
    // The click-capture handler stops the trailing click.
    await act(async () => {
      container.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(clicked).toBe(false);
  });

  it("lets a click through when the drag stayed within the threshold", async () => {
    const container = await renderSchematic(106);
    let clicked = false;
    container.addEventListener("click", () => {
      clicked = true;
    });
    await act(async () => {
      down(container, 200);
      move(198); // dx = −2 ≤ 4px → not a drag
      up();
    });
    await act(async () => {
      container.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(clicked).toBe(true);
  });

  it("does NOT start a drag from a bus segment (interactive child)", async () => {
    const container = await renderSchematic(106);
    const segment = container.querySelector(".bus-seg");
    expect(segment).not.toBeNull();
    container.scrollLeft = 100;
    await act(async () => {
      down(segment!, 200);
      move(160); // dx = −40, but no drag was started
    });
    // scrollLeft is untouched — the pointerdown on the segment did not pan.
    expect(container.scrollLeft).toBe(100);
    await act(async () => up());
  });
});
