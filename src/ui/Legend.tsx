import type { TierTable } from "../data/types.ts";
import { TIER_COLORS, OVERRIDE_COLOR, ERROR_COLOR } from "./colors.ts";

interface LegendProps {
  tiers: TierTable;
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="legend-entry">
      <span
        className="legend-swatch"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

export function Legend({ tiers }: LegendProps) {
  return (
    <div className="legend">
      {tiers.belt.map((_, i) => (
        <Swatch
          key={`belt-${i}`}
          color={TIER_COLORS.belt[i] ?? OVERRIDE_COLOR}
          label={`Mk${i + 1}`}
        />
      ))}
      {tiers.pipe.map((_, i) => (
        <Swatch
          key={`pipe-${i}`}
          color={TIER_COLORS.pipe[i] ?? OVERRIDE_COLOR}
          label={`Pipe Mk${i + 1}`}
        />
      ))}
      <Swatch color={OVERRIDE_COLOR} label="override" />
      <Swatch color={ERROR_COLOR} label="problem" />
    </div>
  );
}
