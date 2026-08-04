import { useEffect, useState } from "react";
import {
  useAppStore,
  setBundledDocsProvider,
  activeSelection,
  activeSolve,
} from "../state/store.ts";
import type { CatalogSource } from "../data/catalog-store.ts";
import type { Finding, StageSolveResult } from "../core/manifold.ts";
import { decodeBytes } from "./decode.ts";
import { UploadScreen } from "./UploadScreen.tsx";
import { ControlsStrip } from "./ControlsStrip.tsx";
import { PlansBar } from "./PlansBar.tsx";
import { SummaryCards } from "./SummaryCards.tsx";
import { Schematic } from "./Schematic.tsx";
import { Blueprint } from "./Blueprint.tsx";
import { LaneOverrides } from "./LaneOverrides.tsx";
import { FindingsPanel } from "./FindingsPanel.tsx";
import { Legend } from "./Legend.tsx";
import { GraphCanvas } from "./GraphCanvas.tsx";
import "./app.css";

// Wire the bundled default catalog once, at module load: fetch the static
// snapshot + its provenance sidecar (BASE_URL-relative so a subpath deploy
// still resolves). Any failure — asset missing, non-OK, unparseable — degrades
// to null as a UNIT, so init() falls back to the v1 needs-upload screen.
setBundledDocsProvider(async () => {
  const base = import.meta.env.BASE_URL;
  try {
    const [docsRes, provRes] = await Promise.all([
      fetch(`${base}bundled-docs/en-US.json`),
      fetch(`${base}bundled-docs/provenance.json`),
    ]);
    if (!docsRes.ok || !provRes.ok) return null;
    const text = await docsRes.text();
    const prov = (await provRes.json()) as {
      steamBuild: string;
      extractedAt: string;
    };
    return {
      text,
      provenance: {
        steamBuild: prov.steamBuild,
        extractedAt: prov.extractedAt,
      },
    };
  } catch {
    return null;
  }
});

/** Stage-global ⊕ per-lane findings, flattened for the panel. */
function allFindings(result: StageSolveResult): Finding[] {
  return [
    ...result.findings,
    ...result.feeds.flatMap((l) => l.findings),
    ...result.outputs.flatMap((l) => l.findings),
  ];
}

/** The provenance banner — rendered only for a bundled catalog. Extracted so
 *  the smoke test can assert it directly (the connected shell is not rendered
 *  in tests). Returns null for a user source, so the caller renders it
 *  unconditionally. */
export function BundledBanner({
  source,
}: {
  source: CatalogSource | null;
}): React.ReactElement | null {
  if (source?.kind !== "bundled") return null;
  return (
    <p className="bundled-banner">
      bundled game data · Steam build {source.steamBuild} ({source.extractedAt})
      — upload your own Docs.json if your game is newer
    </p>
  );
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
  // Read the active stage's selection/solve through the canonical selectors
  // (Stage 3 / Phase 1); every downstream component stays v1-unchanged.
  const selection = activeSelection(s);
  const solve = activeSolve(s);

  // View toggle for the schematic slot (Axis 1): component-local UI state (the
  // canvasNotice precedent — meaningless headless, so no store field). Default
  // Schematic keeps the familiar view primary this arc.
  const [view, setView] = useState<"schematic" | "blueprint">("schematic");

  // Refresh the saved-plan list once the catalog is ready (the ready layout's
  // first mount). `plans` starts null; this makes that null transient, so
  // PlansBar's null and [] states share one placeholder. refreshPlans enqueues
  // + catches internally, so this fire-and-forget call is safe.
  const ready = s.catalog.status === "ready";
  const refreshPlans = s.refreshPlans;
  useEffect(() => {
    if (ready) void refreshPlans();
  }, [ready, refreshPlans]);

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
        <BundledBanner source={s.catalogSource} />
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
      {/* Stage-graph canvas (Stage 3 / Phase 2): a fixed-height panel between the
          header and the v1 surface. Clicking a node switches the whole lower
          surface to that stage via the activeStageId mirror. */}
      <GraphCanvas />
      <ControlsStrip
        recipes={recipes}
        machines={catalog.machines}
        selection={selection}
        hasOverrides={anyOverride(selection.overrides)}
        onSelectRecipe={s.selectRecipe}
        onMachineCount={s.setMachineCount}
        onClockText={s.setClockPercentText}
        onTiers={s.setUnlockedTiers}
        onClearOverrides={s.clearOverrides}
      />
      <PlansBar
        plans={s.plans}
        planError={s.planError}
        onSave={s.savePlanAs}
        onLoad={s.loadPlan}
        onRename={s.renamePlan}
        onDelete={s.deletePlan}
      />
      {solve.status === "idle" && (
        <p className="empty-state">Pick a recipe to see its manifold.</p>
      )}
      {solve.status === "invalid" && (
        <FindingsPanel solve={solve} findings={[]} itemName={itemName} />
      )}
      {solve.status === "solved" && (
        <>
          <SummaryCards result={solve.result} itemName={itemName} />
          {/* The single view toggle (Axis 1), labelled with the TARGET view.
              It swaps only the schematic slot below; every other solve-facing
              panel stays. A null recipe can never reach "solved", so
              selection.recipeId is non-null here. */}
          <button
            type="button"
            className="view-toggle"
            onClick={() =>
              setView((v) => (v === "schematic" ? "blueprint" : "schematic"))
            }
          >
            {view === "schematic" ? "View: Blueprint" : "View: Schematic"}
          </button>
          {view === "blueprint" ? (
            <Blueprint
              solve={solve.result}
              machineId={catalog.recipes[selection.recipeId!]!.machineId}
              machineCount={selection.machineCount}
              feedLabels={solve.result.feeds.map(
                (lane) =>
                  `${itemName(lane.itemId)}${lane.kind === "pipe" ? " (pipe)" : ""}`,
              )}
              outputLabels={solve.result.outputs.map(
                (lane) =>
                  `${itemName(lane.itemId)}${lane.kind === "pipe" ? " (pipe)" : ""}`,
              )}
            />
          ) : (
            <Schematic
              result={solve.result}
              machineCount={selection.machineCount}
              tiers={catalog.tiers}
              unlocked={selection.unlockedTiers}
              itemName={itemName}
            />
          )}
          <LaneOverrides
            result={solve.result}
            overrides={selection.overrides}
            onOverride={s.setOverride}
          />
          <FindingsPanel
            solve={solve}
            findings={allFindings(solve.result)}
            itemName={itemName}
          />
        </>
      )}
    </div>
  );
}
