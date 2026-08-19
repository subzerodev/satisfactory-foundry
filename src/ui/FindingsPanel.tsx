import type { Finding, LaneKind } from "../core/manifold.ts";
import type { SolveState } from "../state/store.ts";
import type { TierTable } from "../data/types.ts";
import { findingText, tierLabel, formatRate } from "./format.ts";
import { tierFixHint } from "./advice.ts";

interface FindingsPanelProps {
  solve: SolveState;
  findings: Finding[];
  itemName(id: string): string;
  /** The FULL fixed tier table (belt + pipe), for the fix-hint lookup. */
  tiers: TierTable;
  /** Prefix count of unlocked tiers per kind (App threads tiers + this count
   *  from the same call site). best-unlocked derives as
   *  tiers[kind][unlocked[kind] − 1]. */
  unlocked: { belt: number; pipe: number };
  /** Plan-wide transport findings (Stage 7 P2) — pre-worded sentences from
   *  computeTransportFindings. Rendered alongside the stage findings; these are
   *  route-level, not tied to the active stage's solve. Default empty. */
  transportFindings?: string[];
}

const INVALID_HEADING: Record<
  Extract<SolveState, { status: "invalid" }>["reason"],
  string
> = {
  "bad-clock": "Clock %",
  "bad-machine-count": "Machine count",
  "bad-override": "Belt override",
};

/**
 * The lane kind that owns a finding: the feed/output lane whose `findings`
 * array contains this exact finding object. Returns null when the finding is
 * stage-global (invalid-input) or the solve is not solved — those never get a
 * tier hint. Identity match is safe: the flattened `findings` array is built
 * from the same lane finding objects (App's allFindings), so the reference is
 * shared, not a copy.
 */
function laneKindOf(solve: SolveState, finding: Finding): LaneKind | null {
  if (solve.status !== "solved") return null;
  for (const lane of solve.result.feeds) {
    if (lane.findings.includes(finding)) return lane.kind;
  }
  for (const lane of solve.result.outputs) {
    if (lane.findings.includes(finding)) return lane.kind;
  }
  return null;
}

/**
 * The fix-hint suffix for a finding, or "" when none applies (frozen Axis 3).
 * Only two finding types get a hint; the wording claims ONLY the provable
 * arithmetic fact (never a "resolves"-style claim — a tier change re-solves the
 * whole manifold):
 *
 * - segment-over-capacity: the smallest tier ≥ the finding's flow AND > its own
 *   busCapacity. hint tier ≤ best-unlocked → "raising this lane's override to
 *   MkN (X/min) would put the bus above this peak" (the overridden-down case);
 *   hint tier > best-unlocked → "unlocking MkN (X/min) would raise the bus
 *   above this peak".
 * - infeasible-machine-demand: the smallest tier ≥ demand AND > topCapacity →
 *   "unlocking MkN (X/min) would cover this machine's demand".
 *
 * No hint when tierFixHint returns null (a peak/demand beyond the top tier).
 */
function fixHint(
  finding: Finding,
  solve: SolveState,
  tiers: TierTable,
  unlocked: { belt: number; pipe: number },
): string {
  if (
    finding.type !== "segment-over-capacity" &&
    finding.type !== "infeasible-machine-demand"
  ) {
    return "";
  }
  const kind = laneKindOf(solve, finding);
  if (kind === null) return "";

  // best-unlocked = the top currently-unlocked tier for this kind (the COUNT
  // pair): tiers[kind][unlocked[kind] − 1].
  const bestUnlocked = tiers[kind][unlocked[kind] - 1];

  if (finding.type === "segment-over-capacity") {
    const hint = tierFixHint(
      finding.flow,
      kind,
      finding.busCapacity,
      tiers,
    );
    if (hint === null) return "";
    const token = tierLabel(kind, hint.capacity, tiers);
    const rate = formatRate(hint.capacity);
    // ≤ best-unlocked ⇒ the tier is already unlocked, so the fix is an override
    // raise on this lane (the overridden-down case). Otherwise it needs a tier
    // unlock. bestUnlocked is defensively guarded (unlocked is clamped upstream).
    const alreadyUnlocked =
      bestUnlocked !== undefined && hint.capacity.lte(bestUnlocked);
    return alreadyUnlocked
      ? ` — raising this lane's override to ${token} (${rate}/min) would put the bus above this peak`
      : ` — unlocking ${token} (${rate}/min) would raise the bus above this peak`;
  }

  // infeasible-machine-demand: bind to topCapacity; the provable per-machine
  // claim, never a re-solve promise.
  const hint = tierFixHint(finding.demand, kind, finding.topCapacity, tiers);
  if (hint === null) return "";
  const token = tierLabel(kind, hint.capacity, tiers);
  const rate = formatRate(hint.capacity);
  return ` — unlocking ${token} (${rate}/min) would cover this machine's demand`;
}

export function FindingsPanel({
  solve,
  findings,
  itemName,
  tiers,
  unlocked,
  transportFindings = [],
}: FindingsPanelProps) {
  // Route-level transport findings render alongside every stage-solve state (they
  // are plan-wide, not tied to the active stage). Built once, appended below.
  const transportSection =
    transportFindings.length > 0 ? (
      <ul className="findings-list findings-transport">
        {transportFindings.map((text, i) => (
          <li className="finding-warning" key={`transport-${i}`}>
            {text}
          </li>
        ))}
      </ul>
    ) : null;

  if (solve.status === "invalid") {
    return (
      <div className="findings-panel">
        <div className="finding-error">
          <span className="finding-heading">
            {INVALID_HEADING[solve.reason]}
          </span>
          <span className="finding-detail">{solve.detail}</span>
        </div>
        {transportSection}
      </div>
    );
  }

  if (solve.status === "solved" && findings.length === 0) {
    return (
      <div className="findings-panel">
        {transportSection === null ? (
          <p className="findings-clean">No warnings — manifold is clean.</p>
        ) : (
          transportSection
        )}
      </div>
    );
  }

  return (
    <div className="findings-panel">
      <ul className="findings-list">
        {findings.map((f, i) => (
          <li className="finding-warning" key={i}>
            {findingText(f, itemName)}
            {fixHint(f, solve, tiers, unlocked)}
          </li>
        ))}
      </ul>
      {transportSection}
    </div>
  );
}
