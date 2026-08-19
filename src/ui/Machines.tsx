import { useMemo } from "react";
import type { StageSolveResult } from "../core/manifold.ts";
import { computeLayout, LAYOUT } from "./layout.ts";
import type { SchematicLayout } from "./layout.ts";

interface MachinesProps {
  result: StageSolveResult;
  machineCount: number;
}

/**
 * The level-of-detail machine band (Stage 12 P1 Axis 1). Above N=114 the pitch
 * floors to 6px ticks that read as dash-noise, so a real drawing draws a break
 * convention + a count instead of 161 identical ticks: ONE continuous band rect
 * spanning the machine row, a centered `×N` in the display face, and individual
 * boundary ticks + index labels kept ONLY at the significant machines (feed
 * entries, output breakouts, segment bounds, finding-referenced machines — the
 * complete set the textual layer can name). Everything else is elided by the
 * break convention.
 *
 * Lifted verbatim from Schematic (P3 — the block became its own view when the
 * build view took the 12px ruler; #138 owns any content redesign, not this move).
 */
function MachineBand({
  machines,
  significant,
  labeledSignificant,
  pitch,
  top,
}: {
  machines: SchematicLayout["machines"];
  significant: number[];
  labeledSignificant: number[];
  pitch: number;
  top: number;
}) {
  const first = machines[0]!;
  const last = machines[machines.length - 1]!;
  const bandX = first.x;
  // The row spans every machine's footprint: last machine's left edge + its own
  // (pitch − 2) rect width, mirroring the per-tick rendering it replaces.
  const bandW = last.x + Math.max(pitch - 2, 1) - bandX;
  const marks = new Set(significant);
  // Every significant index keeps its tick; only the thinned subset carries a
  // label (labels crowd at the band's 8px pitch, ticks do not).
  const labeled = new Set(labeledSignificant);
  const xOf = (index: number) => machines[index - 1]!.x;
  return (
    <g className="machine-band">
      <rect x={bandX} y={top} width={bandW} height={40} />
      <text className="machine-band-count" x={bandX + bandW / 2} y={top + 24}>
        ×{machines.length}
      </text>
      {[...marks]
        .sort((a, b) => a - b)
        .map((index) => (
          <g key={`sig-${index}`} className="machine-band-mark">
            {/* A boundary tick at every significant machine's left edge; the
                index label only when it survives thinning, so referenced
                machines stay locatable without the labels colliding. */}
            <line x1={xOf(index)} x2={xOf(index)} y1={top} y2={top + 40} />
            {labeled.has(index) ? (
              // Center the label under the cell (#86), same as non-band mode; the
              // boundary tick above stays at xOf(index). A constant +pitch/2 shift
              // preserves every label-to-label distance, so the S15 thinning
              // spacing guarantee (≥3-index / 24px) is unaffected.
              <text
                className="machine-label"
                x={xOf(index) + pitch / 2}
                y={top + 52}
              >
                {index}
              </text>
            ) : null}
          </g>
        ))}
    </g>
  );
}

/**
 * The machines view (P3 / #135): the machine row lifted out of the build view.
 * Both density arms render verbatim — per-machine rects + thinned labels below
 * the band threshold, the `MachineBand` break convention above (N > 114). It
 * uses the STOCK layout (default machineRowH 40 — the machines view keeps the
 * full block the build view shed), and its own svg with no lanes, so none of the
 * layout's lane-relative fields are read. No new solve math; computeLayout is
 * memoized exactly as the Schematic does.
 */
export function Machines({ result, machineCount }: MachinesProps) {
  const layout = useMemo(
    () => computeLayout(result, machineCount),
    [result, machineCount],
  );

  // The view has no lanes: the row renders at the top margin, and the svg is
  // just the row + a label band below it (machineH 40 + 24px labels).
  const rowY = LAYOUT.marginY;
  const height = LAYOUT.marginY * 2 + LAYOUT.machineH + 24;

  return (
    <div className={layout.scrolled ? "schematic-scroll" : "schematic"}>
      <svg
        width={layout.width}
        height={height}
        viewBox={`0 0 ${layout.width} ${height}`}
      >
        {layout.band ? (
          <MachineBand
            machines={layout.machines}
            significant={layout.significant}
            labeledSignificant={layout.labeledSignificant}
            pitch={layout.pitch}
            top={rowY}
          />
        ) : (
          layout.machines.map((m) => (
            <g key={`m-${m.index}`} className="machine">
              <rect
                x={m.x}
                y={rowY}
                width={Math.max(layout.pitch - 2, 1)}
                height={40}
              />
              {m.labeled && (
                <text
                  className="machine-label"
                  x={m.x + layout.pitch / 2}
                  y={rowY + 52}
                >
                  {/* Center the number UNDER the machine cell (#86): the label
                      names the machine, not the boundary. m.x is the cell's left
                      edge; +pitch/2 puts it mid-cell. Ticks stay on boundaries. */}
                  {m.index}
                </text>
              )}
            </g>
          ))
        )}
      </svg>
    </div>
  );
}
