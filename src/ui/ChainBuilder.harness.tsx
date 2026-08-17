import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";

import { ChainBuilder } from "./ChainBuilder.tsx";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

export interface MountedChainBuilder {
  readonly container: HTMLDivElement;
  query<T extends Element>(selector: string): T;
  queryAll<T extends Element>(selector: string): T[];
  chooseOption(element: HTMLSelectElement, value: string): void;
  typeInto(element: HTMLInputElement, value: string): void;
  click(element: HTMLElement): void;
  propose(itemId: string, rate: string): void;
  cleanup(): void;
}

export function mountChainBuilder(): MountedChainBuilder {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | null = null;

  try {
    root = createRoot(container);
    act(() => {
      root!.render(<ChainBuilder />);
    });
  } catch (error) {
    if (root !== null) {
      try {
        act(() => {
          root!.unmount();
        });
      } catch {
        // Preserve the original mount error while still rolling back the DOM.
      }
    }
    container.remove();
    throw error;
  }

  const query = <T extends Element>(selector: string): T =>
    container.querySelector<T>(selector)!;
  const queryAll = <T extends Element>(selector: string): T[] =>
    Array.from(container.querySelectorAll<T>(selector));
  const chooseOption = (element: HTMLSelectElement, value: string): void => {
    act(() => {
      element.value = value;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
  };
  const typeInto = (element: HTMLInputElement, value: string): void => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    act(() => {
      setter.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const click = (element: HTMLElement): void => {
    act(() => {
      element.click();
    });
  };
  let cleaned = false;

  return {
    container,
    query,
    queryAll,
    chooseOption,
    typeInto,
    click,
    propose(itemId: string, rate: string): void {
      const controls = ".chain-builder-controls";
      chooseOption(
        queryAll<HTMLSelectElement>(`${controls} select`)[0]!,
        itemId,
      );
      typeInto(queryAll<HTMLInputElement>(`${controls} input`)[0]!, rate);
      click(
        queryAll<HTMLButtonElement>(`${controls} button`).find(
          (button) => button.textContent === "Propose",
        )!,
      );
    },
    cleanup(): void {
      if (cleaned) return;
      cleaned = true;
      try {
        act(() => {
          root!.unmount();
        });
      } finally {
        container.remove();
      }
    },
  };
}
