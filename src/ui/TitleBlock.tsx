/**
 * The sheet's title block (Stage 9 / Phase 0) — the drawing's footer strip of
 * labelled cells. Pure/presentational: every value is a prop, no store import,
 * so the smoke suite can render it in node. App does the selector reads and
 * hands the resolved strings down.
 */

interface TitleBlockProps {
  /** TITLE — the active stage's name (the store invariant; always resolves). */
  title: string;
  /** SHEET — "S<stageCount> · L<linkCount>". */
  sheet: string;
  /** REV — today's date, short ISO (the print date, client clock). */
  rev: string;
  /** Σ POWER — chainPowerText(...) ?? "—". */
  power: string;
}

/** UNITS is static — the honest brag, never data-driven. */
const UNITS = "/MIN · EXACT ℚ";

function Cell({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`title-block-cell${className ? ` ${className}` : ""}`}>
      <span className="title-block-label">{label}</span>
      <span className="title-block-value">{value}</span>
    </div>
  );
}

export function TitleBlock({ title, sheet, rev, power }: TitleBlockProps) {
  return (
    <div className="title-block">
      <Cell label="Title" value={title} className="title-block-title" />
      <Cell label="Sheet" value={sheet} />
      <Cell label="Rev" value={rev} />
      <Cell label="Units" value={UNITS} />
      <Cell label="Σ Power" value={power} className="title-block-power" />
    </div>
  );
}
