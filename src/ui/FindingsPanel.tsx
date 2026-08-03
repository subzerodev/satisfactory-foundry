import type { Finding } from "../core/manifold.ts";
import type { SolveState } from "../state/store.ts";
import { findingText } from "./format.ts";

interface FindingsPanelProps {
  solve: SolveState;
  findings: Finding[];
  itemName(id: string): string;
}

const INVALID_HEADING: Record<
  Extract<SolveState, { status: "invalid" }>["reason"],
  string
> = {
  "bad-clock": "Clock %",
  "bad-machine-count": "Machine count",
  "bad-override": "Belt override",
};

export function FindingsPanel({
  solve,
  findings,
  itemName,
}: FindingsPanelProps) {
  if (solve.status === "invalid") {
    return (
      <div className="findings-panel">
        <div className="finding-error">
          <span className="finding-heading">
            {INVALID_HEADING[solve.reason]}
          </span>
          <span className="finding-detail">{solve.detail}</span>
        </div>
      </div>
    );
  }

  if (solve.status === "solved" && findings.length === 0) {
    return (
      <div className="findings-panel">
        <p className="findings-clean">No warnings — manifold is clean.</p>
      </div>
    );
  }

  return (
    <div className="findings-panel">
      <ul className="findings-list">
        {findings.map((f, i) => (
          <li className="finding-warning" key={i}>
            {findingText(f, itemName)}
          </li>
        ))}
      </ul>
    </div>
  );
}
