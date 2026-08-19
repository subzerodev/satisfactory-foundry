import { useRef, useState } from "react";
import type { RefObject } from "react";

/**
 * Grab-to-pan for a horizontally-scrolling container (#154 — "moveable like the
 * flow chart"). A pointerdown on the container/svg BACKGROUND starts a drag that
 * adjusts `scrollLeft`; a drag past DRAG_THRESHOLD px suppresses the click so a
 * pan never fires an interactive child's handler. The drag starts ONLY when the
 * pointer lands on the scroll surface itself — a segment, label, or any
 * interactive child is the event target instead, so those keep working. Native
 * wheel/trackpad/scrollbar panning is untouched (this only adds drag).
 */
const DRAG_THRESHOLD = 4;

interface GrabScroll {
  grabbing: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onClickCapture: (e: React.MouseEvent<HTMLDivElement>) => void;
}

/** The background is the container div or its direct svg child — NOT a lane
 *  segment, label, or other interactive descendant (those are the drag's
 *  no-go). Restricting to the container/svg keeps interactive children live. */
function isBackground(target: EventTarget, container: HTMLDivElement): boolean {
  if (target === container) return true;
  return target instanceof SVGSVGElement && target.parentElement === container;
}

export function useGrabScroll(
  ref: RefObject<HTMLDivElement | null>,
): GrabScroll {
  const [grabbing, setGrabbing] = useState(false);
  // The drag origin + whether the pointer moved past the threshold. A ref (not
  // state) so the move handler reads current values without re-subscribing.
  const drag = useRef<{
    startX: number;
    startScroll: number;
    moved: boolean;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = ref.current;
    if (container === null) return;
    if (e.button !== 0) return; // primary button only
    if (!isBackground(e.target, container)) return; // interactive child — leave it
    drag.current = {
      startX: e.clientX,
      startScroll: container.scrollLeft,
      moved: false,
    };
    setGrabbing(true);

    const onMove = (ev: PointerEvent) => {
      const state = drag.current;
      if (state === null || container === null) return;
      const dx = ev.clientX - state.startX;
      if (Math.abs(dx) > DRAG_THRESHOLD) state.moved = true;
      container.scrollLeft = state.startScroll - dx;
    };
    const onUp = () => {
      setGrabbing(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      // Leave drag.current set until the click-capture reads `moved`, then clear.
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // A drag that crossed the threshold swallows the trailing click so a pan never
  // activates whatever sat under the pointer-up.
  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    const state = drag.current;
    drag.current = null;
    if (state !== null && state.moved) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return { grabbing, onPointerDown, onClickCapture };
}
