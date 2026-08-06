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
import { stagePowerTextFor, chainPowerText } from "./advice.ts";
import { computeTransportFindings } from "./graph-flow.ts";
import { fileToDocsText, fileFromDrop } from "./decode.ts";
import { resolveInitialTheme } from "./theme.ts";
import type { Theme } from "./theme.ts";
import { requestPersistence } from "./persistence.ts";
import { UploadScreen } from "./UploadScreen.tsx";
import { ControlsStrip } from "./ControlsStrip.tsx";
import { PlansBar } from "./PlansBar.tsx";
import { SummaryCards } from "./SummaryCards.tsx";
import { Blueprint } from "./Blueprint.tsx";
import { Schematic } from "./Schematic.tsx";
import { LaneOverrides } from "./LaneOverrides.tsx";
import { FindingsPanel } from "./FindingsPanel.tsx";
import { Legend } from "./Legend.tsx";
import { GraphCanvas } from "./GraphCanvas.tsx";
import { ChainBuilder } from "./ChainBuilder.tsx";
import { LinkInspector } from "./LinkInspector.tsx";
import { AltCompare } from "./AltCompare.tsx";
import { TitleBlock } from "./TitleBlock.tsx";
import { UpdateToast } from "./UpdateToast.tsx";
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

/** The two solve-facing views (#74 — the schematic is back and first; the
 *  Combined view was removed, #75). */
type View = "schematic" | "blueprint";

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
  // Delegates to the one test-pinned resolver (simplify fold).
  return stagePowerTextFor(catalog, { selection, solve });
}

/** THE connected shell — the only file that touches the store. */
export default function App() {
  const s = useAppStore();
  // Read the active stage's selection/solve through the canonical selectors
  // (Stage 3 / Phase 1); every downstream component stays v1-unchanged.
  const selection = activeSelection(s);
  const solve = activeSolve(s);

  // View selection for the plan slot (#74): component-local UI state (the
  // canvasNotice precedent — meaningless headless, so no store field). The
  // schematic is the default + first tab again (Michael's correction) — the
  // familiar manifold view he liked; Blueprint stays as the second tab.
  const [view, setView] = useState<View>("schematic");

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

  // Stage 19 (#92): ask the browser for persistent storage on boot so the
  // plans store is never auto-evicted (fire-and-forget — a denial changes
  // nothing the user can act on; the helper feature-detects, logs, never
  // throws). One-shot at mount; grant is environment-dependent.
  useEffect(() => {
    void requestPersistence();
  }, []);

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
        <UpdateToast />
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

  // Export-all (Stage 19 / #92): the store hands back the whole-plans bundle
  // JSON (or null when there are no plans); App does the browser-only download.
  // Filename dates from the export moment; the `.foundry-plans.json` double
  // extension is the machine/import signal, the prefix the human Downloads-sort
  // signal (frozen Axis 4).
  async function handleExportAll() {
    const json = await s.exportAllPlans();
    if (json === null) return; // no plans: nothing to download
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    downloadTextFile(json, `foundry-plans-${date}.foundry-plans.json`);
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

  // Plan-wide transport findings (Stage 7 P2): the unsustainable-train case
  // across all links, pre-worded. The plan-global unlocked tiers are resolved
  // inside planForLink (any stage's copy is canonical) — no longer threaded.
  const transportFindings = computeTransportFindings(
    catalog,
    s.stages,
    s.links,
  );

  // Title-block data (Stage 9 / Phase 0) — ordinary selector reads, props down
  // to the pure TitleBlock. TITLE is the active stage's name (the store
  // invariant guarantees activeStageId resolves). SHEET counts stages + links.
  // REV is the client-clock print date (short ISO). Σ POWER reuses advice.ts's
  // chainPowerText over all stages (the labelled-≈ discipline, ?? "—" when no
  // stage bills power). No new state — App reads, TitleBlock renders.
  const activeStage = s.stages[s.activeStageId];
  const titleName = activeStage?.name ?? "—";
  const sheetText = `S${s.stageOrder.length} · L${s.links.length}`;
  const revText = new Date().toISOString().slice(0, 10);
  const chainPower = chainPowerText(Object.values(s.stages), catalog) ?? "—";

  return (
    <div className="app">
      <UpdateToast />
      {dropOverlay}
      <header className="app-header">
        {/* The wordmark stays one <h1>; the "/ FICSIT DWG" suffix carries the
            accent (S9P0). */}
        <h1 className="wordmark">
          SATISFACTORY FOUNDRY{" "}
          <span className="wordmark-suffix">/ FICSIT DWG</span>
        </h1>
        <BundledBanner source={s.catalogSource} />
        <Legend tiers={catalog.tiers} />
        <input
          type="file"
          accept="application/json,.json"
          onChange={handleReupload}
        />
        {/* The toggle NAMES its destination medium (write-the-destination):
            "CYANOTYPE" while on vellum, "VELLUM" while on cyanotype. The words
            ARE the feature; aria-label/title match. */}
        <button
          type="button"
          className="theme-toggle"
          aria-label={
            theme === "dark" ? "switch to VELLUM" : "switch to CYANOTYPE"
          }
          title={theme === "dark" ? "switch to VELLUM" : "switch to CYANOTYPE"}
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        >
          {theme === "dark" ? "VELLUM" : "CYANOTYPE"}
        </button>
      </header>
      {s.uploadError !== null && (
        <p className="upload-banner">{s.uploadError}</p>
      )}
      {/* Stage-graph canvas (Stage 3 / Phase 2): a fixed-height panel between the
          header and the v1 surface. Clicking a node switches the whole lower
          surface to that stage via the activeStageId mirror. */}
      <GraphCanvas colorMode={theme} />
      {/* Build-chain panel (Stage 8 / Phase 3): target + rate → preview → apply,
          appending proposed stages/links into the graph above. Self-gates on a
          ready catalog (renders nothing otherwise). */}
      <ChainBuilder />
      {/* The LinkInspector self-gates on selectedLinkId (null → renders nothing),
          so it sits unconditionally below the canvas (Stage 7 P2). */}
      <LinkInspector />
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
      {/* Alternate-recipe comparison (Stage 8 / Phase 4): the compare block for
          the active stage's recipe, next to the Recipe select. Self-gates on a
          solved stage whose primary item has ≥2 candidate producers (renders
          nothing otherwise). */}
      <AltCompare />
      <PlansBar
        plans={s.plans}
        planError={s.planError}
        onSave={s.savePlanAs}
        onLoad={s.loadPlan}
        onRename={s.renamePlan}
        onDelete={s.deletePlan}
        onExport={(id) => void handleExport(id)}
        onExportAll={() => void handleExportAll()}
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
          transportFindings={transportFindings}
        />
      )}
      {solve.status === "solved" && (
        <>
          <SummaryCards
            result={solve.result}
            itemName={itemName}
            powerText={activePowerText}
          />
          {/* Two tabs naming the CURRENT view (#74) — honest, unlike the old
              cycle button that named its NEXT destination (the grounded mislabel
              confusion, #67). The active tab carries the accent; clicking sets
              the view directly. Same quiet-mono idiom as the FIT|DETAIL toggle.
              It swaps only the plan slot below; every other solve-facing panel
              stays. A null recipe can never reach "solved", so selection.recipeId
              is non-null. The schematic is the first/default tab. */}
          <div className="view-tabs">
            <button
              type="button"
              className={view === "schematic" ? "view-tab active" : "view-tab"}
              aria-pressed={view === "schematic"}
              onClick={() => setView("schematic")}
            >
              SCHEMATIC
            </button>
            <button
              type="button"
              className={view === "blueprint" ? "view-tab active" : "view-tab"}
              aria-pressed={view === "blueprint"}
              onClick={() => setView("blueprint")}
            >
              BLUEPRINT
            </button>
          </div>
          {view === "schematic" ? (
            <Schematic
              result={solve.result}
              machineCount={selection.machineCount}
              tiers={catalog.tiers}
              unlocked={selection.unlockedTiers}
              itemName={itemName}
            />
          ) : (
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
          )}
          <LaneOverrides
            result={solve.result}
            overrides={selection.overrides}
            itemName={itemName}
            onOverride={s.setOverride}
          />
          <FindingsPanel
            solve={solve}
            findings={allFindings(solve.result)}
            itemName={itemName}
            tiers={catalog.tiers}
            unlocked={selection.unlockedTiers}
            transportFindings={transportFindings}
          />
        </>
      )}
      {/* The sheet footer (S9P0) — always rendered on the ready surface, below
          every view. Pure presentational cells fed by the reads above. */}
      <TitleBlock
        title={titleName}
        sheet={sheetText}
        rev={revText}
        power={chainPower}
      />
    </div>
  );
}
