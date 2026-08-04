import { useEffect, useState } from "react";
import {
  useAppStore,
  setBundledDocsProvider,
  activeSelection,
  activeSolve,
} from "../state/store.ts";
import type { Selection, SolveState } from "../state/store.ts";
import type { CatalogSource } from "../data/catalog-store.ts";
import type { Catalog } from "../data/types.ts";
import type { Finding, StageSolveResult } from "../core/manifold.ts";
import { Fraction } from "../core/fraction.ts";
import { stagePowerText } from "./advice.ts";
import { fileToDocsText, fileFromDrop } from "./decode.ts";
import { resolveInitialTheme } from "./theme.ts";
import type { Theme } from "./theme.ts";
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

/** Filesystem-unsafe characters (/ \ : * ? " < > |) → "-", so a plan name is a
 *  legal filename across OSes. Frozen Axis 3 sanitization set. Exported for the
 *  sanitization-table test. */
export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "-");
}

/** Browser-only: trigger a download of `text` as `filename` via an object-URL
 *  anchor. Guarded for headless (no document) so importing App never throws. */
function downloadTextFile(text: string, filename: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * The active stage's power-draw line for SummaryCards (Stage 6 P2), or null.
 * Non-null ONLY when the stage is solved and its recipe's machine carries power
 * data — uniform with the canvas card + the chain Σ (recipe-less / idle /
 * invalid → null). Clock is parsed from clockPercentText; a malformed value is
 * unreachable at 'solved', but guarded to null defensively. Object.hasOwn (not
 * `=== undefined`) guards the machine lookup: a machineId like "constructor"
 * would otherwise resolve to an Object.prototype member.
 */
function activeStagePowerText(
  catalog: Catalog,
  selection: Selection,
  solve: SolveState,
): string | null {
  if (solve.status !== "solved") return null;
  const recipeId = selection.recipeId;
  if (recipeId === null) return null;
  const recipe = catalog.recipes[recipeId];
  if (recipe === undefined) return null;
  if (!Object.hasOwn(catalog.machines, recipe.machineId)) return null;
  const machine = catalog.machines[recipe.machineId]!;
  let clock: Fraction;
  try {
    clock = Fraction.parse(selection.clockPercentText);
  } catch {
    return null;
  }
  return stagePowerText(machine.power, selection.machineCount, clock);
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

  // Theme preference (Stage 5 item 3): a UI preference, initialized from the
  // stored choice ⊕ the OS media query, applied as data-theme on the document
  // element and persisted to localStorage directly (not store state — theme
  // never affects a solve). Lazy initializer so the media query is read once.
  // The `typeof window` guard keeps App SSR-safe (the smoke suite renders it in
  // node, where window/localStorage are absent) — headless falls back to light.
  const [theme, setTheme] = useState<Theme>(() =>
    typeof window === "undefined"
      ? "light"
      : resolveInitialTheme(
          window.localStorage.getItem("theme"),
          window.matchMedia("(prefers-color-scheme: dark)").matches,
        ),
  );
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  // Refresh the saved-plan list once the catalog is ready (the ready layout's
  // first mount). `plans` starts null; this makes that null transient, so
  // PlansBar's null and [] states share one placeholder. refreshPlans enqueues
  // + catches internally, so this fire-and-forget call is safe.
  const ready = s.catalog.status === "ready";
  const refreshPlans = s.refreshPlans;
  useEffect(() => {
    if (ready) void refreshPlans();
  }, [ready, refreshPlans]);

  // Drag-and-drop Docs.json upload (Stage 5 item 2). App is the sole store
  // importer, so it owns the window-level drag surface for BOTH the upload
  // screen and the ready surface. `dragDepth` is an enter/leave counter (the
  // flicker-free idiom — nested elements fire enter/leave as the pointer
  // crosses them); the overlay shows while depth > 0. The overlay is
  // affordance-only: drop functions without it.
  const [dragDepth, setDragDepth] = useState(0);
  const uploadDocsText = s.uploadDocsText;
  useEffect(() => {
    // dragover MUST preventDefault or the browser never fires `drop`.
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      setDragDepth((d) => d + 1);
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      setDragDepth((d) => Math.max(0, d - 1));
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragDepth(0);
      if (e.dataTransfer === null) return;
      const file = fileFromDrop(e.dataTransfer);
      if (file === null) return; // non-file drag: ignored
      void fileToDocsText(file).then((text) => uploadDocsText(text));
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [uploadDocsText]);

  const dropOverlay =
    dragDepth > 0 ? (
      <div className="drop-overlay">Drop Docs.json to load</div>
    ) : null;

  if (s.catalog.status === "initializing") {
    return <p className="boot">Loading…</p>;
  }

  if (s.catalog.status === "needs-upload") {
    return (
      <>
        {dropOverlay}
        <UploadScreen
          reason={s.catalog.reason}
          message={s.catalog.message}
          onUpload={s.uploadDocsText}
        />
      </>
    );
  }

  const catalog = s.catalog.catalog;
  const itemName = (id: string) => catalog.items[id]?.displayName ?? id;

  async function handleReupload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await s.uploadDocsText(await fileToDocsText(file));
  }

  // Export: the store hands back the plan's pretty JSON (or null if the row is
  // gone/corrupt); App does the browser-only Blob → anchor download. The
  // filename is the plan's list name, filesystem-sanitized.
  async function handleExport(id: string) {
    const json = await s.exportPlan(id);
    if (json === null) return; // missing/corrupt: nothing to download
    const name = (s.plans ?? []).find((p) => p.id === id)?.name ?? "plan";
    downloadTextFile(json, `${sanitizeFilename(name)}.foundry-plan.json`);
  }

  // Import: plan files are OUR OWN UTF-8 JSON exports, so file.text() is correct
  // here — the S5 UTF-16 decodeBytes lesson is Docs.json-specific (do NOT
  // "fix" this into fileToDocsText). The store validates + saves.
  async function handleImport(file: File) {
    await s.importPlan(await file.text());
  }

  const recipes = Object.values(catalog.recipes);

  // The active stage's power-draw line, prepared for SummaryCards (Stage 6 P2).
  // Non-null ONLY when the active stage is solved and its recipe's machine
  // carries power data — uniform with the canvas card + the chain Σ. The card
  // stays dumb; App owns the helper call + the null gate.
  const activePowerText = activeStagePowerText(catalog, selection, solve);

  return (
    <div className="app">
      {dropOverlay}
      <header className="app-header">
        <h1>satisfactory-foundry</h1>
        <BundledBanner source={s.catalogSource} />
        <Legend tiers={catalog.tiers} />
        <input
          type="file"
          accept="application/json,.json"
          onChange={handleReupload}
        />
        <button
          type="button"
          className="theme-toggle"
          title={theme === "dark" ? "switch to light" : "switch to dark"}
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
      </header>
      {s.uploadError !== null && (
        <p className="upload-banner">{s.uploadError}</p>
      )}
      {/* Stage-graph canvas (Stage 3 / Phase 2): a fixed-height panel between the
          header and the v1 surface. Clicking a node switches the whole lower
          surface to that stage via the activeStageId mirror. */}
      <GraphCanvas colorMode={theme} />
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
        onExport={(id) => void handleExport(id)}
        onImport={(file) => void handleImport(file)}
      />
      {solve.status === "idle" && (
        <p className="empty-state">Pick a recipe to see its manifold.</p>
      )}
      {solve.status === "invalid" && (
        <FindingsPanel
          solve={solve}
          findings={[]}
          itemName={itemName}
          tiers={catalog.tiers}
          unlocked={selection.unlockedTiers}
        />
      )}
      {solve.status === "solved" && (
        <>
          <SummaryCards
            result={solve.result}
            itemName={itemName}
            powerText={activePowerText}
          />
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
            tiers={catalog.tiers}
            unlocked={selection.unlockedTiers}
          />
        </>
      )}
    </div>
  );
}
