import type { TierTable } from "../data/types.ts";
import { TIER_COLORS, OVERRIDE_COLOR, ERROR_COLOR } from "./colors.ts";

interface LegendProps {
  tiers: TierTable;
}

// The swatch is a line-convention RULE sample (S9P0): a short horizontal line
// in the tier colour, solid for belts / dashed for pipes. The colour rides on
// `color` (not backgroundColor) so the CSS rule's currentColor border reads it.
function Swatch({
  color,
  label,
  dashed = false,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="legend-entry">
      <span
        className={`legend-swatch${dashed ? " legend-rule-dashed" : ""}`}
        style={{ color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

// The P2 D6 line-convention entries (taper / seam / pipe-manifold). Their sample
// marks deliberately DO NOT carry the "legend-swatch" substring — the smoke
// count pin matches /legend-swatch/g against the tier + override/problem
// swatches only, so a shared substring would inflate that count (same reason
// .legend-rule-dashed is a sibling class, not a modifier ON legend-swatch).
function ConventionEntry({
  sampleClass,
  label,
}: {
  sampleClass: string;
  label: string;
}) {
  return (
    <span className="legend-entry">
      <span className={sampleClass} aria-hidden="true" />
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
          dashed
        />
      ))}
      <Swatch color={OVERRIDE_COLOR} label="override" />
      <Swatch color={ERROR_COLOR} label="problem" />
      <ConventionEntry
        sampleClass="legend-taper"
        label="trunk carry (thins as machines draw)"
      />
      <ConventionEntry sampleClass="legend-seam" label="belt seam (merger)" />
      <ConventionEntry
        sampleClass="legend-pipe-manifold"
        label="pipe manifold (unordered)"
      />
      <ConventionEntry
        sampleClass="legend-ruler"
        label="machine ruler — tall tick: a belt stretch starts/ends · short tick: this number's machine"
      />
    </div>
  );
}
