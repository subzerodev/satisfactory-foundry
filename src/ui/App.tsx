import { useAppStore } from "../state/store.ts";
import type { Finding, StageSolveResult } from "../core/manifold.ts";
import { decodeBytes } from "./decode.ts";
import { UploadScreen } from "./UploadScreen.tsx";
import { ControlsStrip } from "./ControlsStrip.tsx";
import { SummaryCards } from "./SummaryCards.tsx";
import { Schematic } from "./Schematic.tsx";
import { LaneOverrides } from "./LaneOverrides.tsx";
import { FindingsPanel } from "./FindingsPanel.tsx";
import { Legend } from "./Legend.tsx";
import "./app.css";

/** Stage-global ⊕ per-lane findings, flattened for the panel. */
function allFindings(result: StageSolveResult): Finding[] {
  return [
    ...result.findings,
    ...result.feeds.flatMap((l) => l.findings),
    ...result.outputs.flatMap((l) => l.findings),
  ];
}

/** True when any override cell (either side) is non-null. */
function anyOverride(overrides: {
  feeds: Record<string, (string | null)[]>;
  outputs: Record<string, (string | null)[]>;
}): boolean {
  const sides = [overrides.feeds, overrides.outputs];
  return sides.some((side) =>
    Object.values(side).some((arr) => arr.some((c) => c !== null)),
  );
}

/** THE connected shell — the only file that touches the store. */
export default function App() {
  const s = useAppStore();

  if (s.catalog.status === "initializing") {
    return <p className="boot">Loading…</p>;
  }

  if (s.catalog.status === "needs-upload") {
    return (
      <UploadScreen
        reason={s.catalog.reason}
        message={s.catalog.message}
        onUpload={s.uploadDocsText}
      />
    );
  }

  const catalog = s.catalog.catalog;
  const itemName = (id: string) => catalog.items[id]?.displayName ?? id;

  async function handleReupload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = decodeBytes(new Uint8Array(await file.arrayBuffer()));
    await s.uploadDocsText(text);
  }

  const recipes = Object.values(catalog.recipes);

  return (
    <div className="app">
      <header className="app-header">
        <h1>satisfactory-foundry</h1>
        <Legend tiers={catalog.tiers} />
        <input
          type="file"
          accept="application/json,.json"
          onChange={handleReupload}
        />
      </header>
      {s.uploadError !== null && (
        <p className="upload-banner">{s.uploadError}</p>
      )}
      <ControlsStrip
        recipes={recipes}
        machines={catalog.machines}
        selection={s.selection}
        hasOverrides={anyOverride(s.selection.overrides)}
        onSelectRecipe={s.selectRecipe}
        onMachineCount={s.setMachineCount}
        onClockText={s.setClockPercentText}
        onTiers={s.setUnlockedTiers}
        onClearOverrides={s.clearOverrides}
      />
      {s.solve.status === "idle" && (
        <p className="empty-state">Pick a recipe to see its manifold.</p>
      )}
      {s.solve.status === "invalid" && (
        <FindingsPanel solve={s.solve} findings={[]} itemName={itemName} />
      )}
      {s.solve.status === "solved" && (
        <>
          <SummaryCards result={s.solve.result} itemName={itemName} />
          <Schematic
            result={s.solve.result}
            machineCount={s.selection.machineCount}
            tiers={catalog.tiers}
            unlocked={s.selection.unlockedTiers}
            itemName={itemName}
          />
          <LaneOverrides
            result={s.solve.result}
            overrides={s.selection.overrides}
            onOverride={s.setOverride}
          />
          <FindingsPanel
            solve={s.solve}
            findings={allFindings(s.solve.result)}
            itemName={itemName}
          />
        </>
      )}
    </div>
  );
}
