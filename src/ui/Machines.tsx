import { useMemo, useRef } from "react";
import type { StageSolveResult } from "../core/manifold.ts";
import { computeLayout, LAYOUT } from "./layout.ts";
import { useGrabScroll } from "./useGrabScroll.ts";

interface MachinesProps {
  result: StageSolveResult;
  machineCount: number;
}

/**
 * The machines view (P3 / #135): the machine row lifted out of the build view.
 * Per-machine rects render at EVERY N — the band's break convention retired with
 * the readable pitch floor (#154): at the 24px floor per-machine rects are
 * legible and the view pans instead of collapsing to a grey band. The `×N`
 * caption (the band's one useful datum) survives as a static header, always
 * shown, answering "how many" without scrolling. #138 owns any further content
 * redesign; this is the neutral placeholder its baseline change leaves. It uses
 * the STOCK layout (default machineRowH 40) and its own svg with no lanes, so
 * none of the layout's lane-relative fields are read. No new solve math;
 * computeLayout is memoized exactly as the Schematic does.
 */
export function Machines({ result, machineCount }: MachinesProps) {
  const layout = useMemo(
    () => computeLayout(result, machineCount),
    [result, machineCount],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const grab = useGrabScroll(containerRef);

  // The view has no lanes: the row renders at the top margin, and the svg is
  // just the row + a label band below it (machineH 40 + 24px labels).
  const rowY = LAYOUT.marginY;
  const height = LAYOUT.marginY * 2 + LAYOUT.machineH + 24;

  return (
    <div
      ref={containerRef}
      className={`${layout.scrolled ? "schematic-scroll" : "schematic"}${
        grab.grabbing ? " grabbing" : ""
      }`}
      onPointerDown={grab.onPointerDown}
      onClickCapture={grab.onClickCapture}
    >
      <div className="machines-count">×{machineCount}</div>
      <svg
        width={layout.width}
        height={height}
        viewBox={`0 0 ${layout.width} ${height}`}
      >
        {layout.machines.map((m) => (
          <g key={`m-${m.index}`} className="machine">
            <rect
              x={m.x}
              y={rowY}
              width={Math.max(layout.pitch - 2, 1)}
              height={40}
            />
            <text
              className="machine-label"
              x={m.x + layout.pitch / 2}
              y={rowY + 52}
            >
              {/* Center the number UNDER the machine cell (#86): the label names
                  the machine, not the boundary. m.x is the cell's left edge;
                  +pitch/2 puts it mid-cell. Ticks stay on boundaries. Every
                  machine is labeled — the readable pitch floor (#154) keeps
                  labels legible, so no thinning. */}
              {m.index}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
