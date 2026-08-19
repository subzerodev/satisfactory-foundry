import { useEffect, useMemo, useState } from "react";
import {
  useAppStore,
  setBundledDocsProvider,
  setBundledProvenanceProvider,
  activeSelection,
  activeSolve,
} from "../state/store.ts";
import type {
  Selection,
  SolveState,
  StageNode,
  StageLink,
} from "../state/store.ts";
import type { CatalogSource } from "../data/catalog-store.ts";
import type { Catalog } from "../data/types.ts";
import type { StageInput, StageSolveResult } from "../core/manifold.ts";
import type { Finding } from "../core/manifold.ts";
import { solveStage } from "../core/manifold.ts";
import { parseClockText } from "../core/clock.ts";
import { deriveLinkPlan } from "../core/link-plan.ts";
import type { ReadyLinkPlan } from "../core/link-plan.ts";
import { packagingStageInputs } from "../core/packaging-stage-input.ts";
import {
  deriveExtractionPlan,
  deriveExtractionPackagingPlan,
} from "./extraction-plan.ts";
import { stagePowerTextFor, stagePowerText, chainPowerText } from "./advice.ts";
import { computeTransportFindings, globalUnlockedTiers } from "./graph-flow.ts";
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
import { Machines } from "./Machines.tsx";
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

// #144: the lightweight staleness probe — provenance sidecar only (~200
// bytes), never the 5.3 MB catalog. Failure resolves null: the cached hit is
// kept (offline PWA boots serve the precached sidecar, which matches the
// precached docs within one SW generation).
setBundledProvenanceProvider(async () => {
  const base = import.meta.env.BASE_URL;
  try {
    const provRes = await fetch(`${base}bundled-docs/provenance.json`);
    if (!provRes.ok) return null;
    const prov = (await provRes.json()) as {
      steamBuild: string;
      extractedAt: string;
    };
    return { steamBuild: prov.steamBuild, extractedAt: prov.extractedAt };
  } catch {
    return null;
  }
});

/** The solve-facing views (#74 — the schematic is first; the Combined view was
 *  removed, #75). The machines view (#135 / P3) is the block the build view shed
 *  when it took the 12px ruler; it sits next to the drawing it left. */
type View = "schematic" | "machines" | "blueprint";

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

/**
 * A packaging chain the build view can draw as its own subject (#157 A2). `key`
 * is the App-local subject id (`extraction:<stageId>:<itemId>` or `link:<id>`);
 * `label` disambiguates in the selector; `plan` is the sized ReadyLinkPlan the
 * A1 adapter maps; `clockText` is the interstep's raw Packager clock (re-parsed
 * for the drawing scale — the plan does not surface its parsed value).
 */
interface PackagingChain {
  key: string;
  label: string;
  plan: ReadyLinkPlan;
  clockText: string;
}

/** The two solved machine groups for a packaging subject (A3 stacked render). */
interface PackagingSubjectSolve {
  chain: PackagingChain;
  packager: { input: StageInput; result: StageSolveResult };
  unpackager: { input: StageInput; result: StageSolveResult };
  unlocked: { belt: number; pipe: number };
}

/**
 * Enumerate every drawable packaging chain in the plan (#157 A2): each stored
 * extraction selection with `packaging` set, then each link with an `interstep`.
 * Both funnel through the SAME `derivePackagingPlan` the panels already size
 * with — the link case via `deriveLinkPlan`, the extraction case via
 * `deriveExtractionPackagingPlan` over the derived extractor plan + the raw
 * feed's demand (the value the graph's rawFeed node carries). Only chains whose
 * plan is `ready` (sizable — both stages solved) are returned; unresolved ones
 * are silently skipped (nothing to draw). Deterministic order: stages in
 * `stageOrder`, then links in array order.
 */
function enumeratePackagingChains(
  catalog: Catalog,
  stages: Record<string, StageNode>,
  stageOrder: string[],
  links: StageLink[],
): PackagingChain[] {
  const chains: PackagingChain[] = [];
  const itemName = (id: string) => catalog.items[id]?.displayName ?? id;
  const unlockedTiers = globalUnlockedTiers(catalog, stages);

  for (const stageId of stageOrder) {
    const stage = stages[stageId];
    if (stage?.extraction === undefined) continue;
    for (const [itemId, selection] of Object.entries(stage.extraction)) {
      if (selection.packaging === undefined) continue;
      // The raw feed's demand at this stage — the same figure the extraction
      // panel packages against (graph-flow's rawFeed node reads it identically).
      const demand =
        stage.solve.status === "solved"
          ? (stage.solve.result.feeds.find((lane) => lane.itemId === itemId)
              ?.totalDemand ?? null)
          : null;
      if (demand === null) continue;
      const extractionPlan = deriveExtractionPlan({
        catalog,
        itemId,
        demand,
        selection,
        unlockedTiers,
      });
      const plan = deriveExtractionPackagingPlan(
        catalog,
        extractionPlan,
        selection.packaging,
        demand,
        unlockedTiers,
        itemId,
      );
      if (plan?.status !== "ready") continue;
      chains.push({
        key: `extraction:${stageId}:${itemId}`,
        label: `Packaging: ${itemName(itemId)} — extraction @ ${stage.name}`,
        plan,
        clockText: selection.packaging.clockPercentText,
      });
    }
  }

  for (const link of links) {
    if (link.interstep === undefined) continue;
    const plan = deriveLinkPlan(catalog, link, stages);
    if (plan.status !== "ready") continue;
    const from = stages[link.fromStageId]?.name ?? "(removed)";
    const to = stages[link.toStageId]?.name ?? "(removed)";
    chains.push({
      key: `link:${link.id}`,
      label: `Packaging: ${itemName(link.itemId)} — ${from} → ${to}`,
      plan,
      clockText: link.interstep.clockPercentText,
    });
  }

  return chains;
}

/**
 * Solve the selected packaging chain's two machine groups through the manifold
 * (#157 A3). The A1 adapter maps the ReadyLinkPlan to the packager/unpackager
 * `StageInput`s (using the interstep's parsed clock + the plan-global unlocked
 * tier capacities); each group solves via the SAME `solveStage` as any stage.
 * Returns null when no packaging subject is selected, the key is stale, or the
 * plan carries no machine counts.
 */
function solvePackagingSubject(
  catalog: Catalog,
  stages: Record<string, StageNode>,
  chains: PackagingChain[],
  subjectKey: string | null,
): PackagingSubjectSolve | null {
  if (subjectKey === null) return null;
  const chain = chains.find((c) => c.key === subjectKey);
  if (chain === undefined) return null;
  const clock = parseClockText(chain.clockText);
  if (!clock.ok) return null;
  const unlocked = globalUnlockedTiers(catalog, stages);
  const capacities = {
    belt: catalog.tiers.belt.slice(0, unlocked.belt),
    pipe: catalog.tiers.pipe.slice(0, unlocked.pipe),
  };
  const inputs = packagingStageInputs(chain.plan, clock.value, capacities);
  if (inputs === null) return null;
  return {
    chain,
    packager: { input: inputs.packager, result: solveStage(inputs.packager) },
    unpackager: {
      input: inputs.unpackager,
      result: solveStage(inputs.unpackager),
    },
    unlocked,
  };
}

/**
 * One machine group of a packaging subject (#157 A3): a heading with the count
 * and per-group power (through the same `machinePowerProjection` path as any
 * stage, via `stagePowerText` — A5), then the group's manifold rendered in the
 * active view (Schematic or Machines; Blueprint is handled by the caller). The
 * group solves as an ordinary stage, so the existing components render it
 * unchanged.
 */
function PackagingGroup({
  view,
  groupName,
  machineId,
  input,
  result,
  unlocked,
  catalog,
  itemName,
}: {
  view: View;
  groupName: string;
  machineId: string;
  input: StageInput;
  result: StageSolveResult;
  unlocked: { belt: number; pipe: number };
  catalog: Catalog;
  itemName: (id: string) => string;
}) {
  const machine = Object.hasOwn(catalog.machines, machineId)
    ? catalog.machines[machineId]
    : undefined;
  const powerText =
    machine !== undefined
      ? stagePowerText(machine.power, input.machineCount, input.clockPercent)
      : null;
  return (
    <section className="packaging-group">
      <h3 className="packaging-group-heading">
        {input.machineCount} × {groupName}
        {powerText !== null && (
          <span className="packaging-group-power"> · {powerText}</span>
        )}
      </h3>
      {view === "machines" ? (
        <Machines result={result} machineCount={input.machineCount} />
      ) : (
        <Schematic
          result={result}
          machineCount={input.machineCount}
          tiers={catalog.tiers}
          unlocked={unlocked}
          itemName={itemName}
        />
      )}
    </section>
  );
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

  // Drawing-subject selection (#157 A2): null = the active stage (today's
  // behaviour); a chain key = draw that packaging chain instead. App-local
  // alongside `view` (the same "meaningless headless, no store field" precedent).
  const [subjectKey, setSubjectKey] = useState<string | null>(null);

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

  // Drawable packaging chains (#157 A2) + the selected subject's two-group solve
  // (A3). The enumeration re-derives each chain's ReadyLinkPlan; the solve maps
  // the selected one through the A1 adapter + solveStage. Both memoize over the
  // store slices they read so a drag/theme toggle does not re-solve.
  const packagingChains = useMemo(
    () => enumeratePackagingChains(catalog, s.stages, s.stageOrder, s.links),
    [catalog, s.stages, s.stageOrder, s.links],
  );
  const packagingSubject = useMemo(
    () => solvePackagingSubject(catalog, s.stages, packagingChains, subjectKey),
    [catalog, s.stages, packagingChains, subjectKey],
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
        tiers={catalog.tiers}
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
          {/* Drawing-subject selector (#157 A2). Absent when the plan has no
              packaging chains — the default option is today's active stage, and
              each chain re-points the tabs below at that packaging manifold.
              The label floor is disambiguation-only (item name + provenance);
              refinable under #156. */}
          {packagingChains.length > 0 && (
            <label className="drawing-subject">
              <span className="drawing-subject-label">DRAWING</span>
              <select
                aria-label="Drawing subject"
                value={subjectKey ?? ""}
                onChange={(e) =>
                  setSubjectKey(e.target.value === "" ? null : e.target.value)
                }
              >
                <option value="">Stage: {titleName}</option>
                {packagingChains.map((chain) => (
                  <option key={chain.key} value={chain.key}>
                    {chain.label}
                  </option>
                ))}
              </select>
            </label>
          )}
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
              className={view === "machines" ? "view-tab active" : "view-tab"}
              aria-pressed={view === "machines"}
              onClick={() => setView("machines")}
            >
              MACHINES
            </button>
            <button
              type="button"
              className={view === "blueprint" ? "view-tab active" : "view-tab"}
              aria-pressed={view === "blueprint"}
              // Blueprint is stage-only for a packaging subject (#157 A3): the
              // tab is genuinely non-interactive while a chain is drawn, not
              // just a pane note. A blueprint that was already active stays
              // selected (view is not reset) and shows the #158 note in the
              // pane — switching back to a stage subject restores it.
              disabled={packagingSubject !== null}
              aria-disabled={packagingSubject !== null}
              onClick={() => setView("blueprint")}
            >
              BLUEPRINT
            </button>
          </div>
          {packagingSubject !== null ? (
            // Packaging subject (#157 A3): both machine groups stacked —
            // packager above, unpackager below. Schematic + Machines render the
            // stacked groups; Blueprint is stage-only for packaging subjects
            // this ticket (a chain is two machine kinds, but Blueprint takes a
            // single machineId — per-group Blueprint is #158).
            view === "blueprint" ? (
              <p className="empty-state">
                Blueprint is per-machine; a packaging chain has two machine
                kinds. Select a stage subject for its blueprint — per-group
                packaging blueprints are tracked in #158.
              </p>
            ) : (
              <>
                <PackagingGroup
                  view={view}
                  groupName="Packager"
                  machineId={
                    packagingSubject.chain.plan.pair.packageRecipe.machineId
                  }
                  input={packagingSubject.packager.input}
                  result={packagingSubject.packager.result}
                  unlocked={packagingSubject.unlocked}
                  catalog={catalog}
                  itemName={itemName}
                />
                <PackagingGroup
                  view={view}
                  groupName="Unpackager"
                  machineId={
                    packagingSubject.chain.plan.pair.unpackageRecipe.machineId
                  }
                  input={packagingSubject.unpackager.input}
                  result={packagingSubject.unpackager.result}
                  unlocked={packagingSubject.unlocked}
                  catalog={catalog}
                  itemName={itemName}
                />
              </>
            )
          ) : view === "schematic" ? (
            <Schematic
              result={solve.result}
              machineCount={selection.machineCount}
              tiers={catalog.tiers}
              unlocked={selection.unlockedTiers}
              itemName={itemName}
            />
          ) : view === "machines" ? (
            <Machines
              result={solve.result}
              machineCount={selection.machineCount}
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
          {/* LaneOverrides + FindingsPanel read the active STAGE's
              solve/selection, so they are meaningless (and misleading) under a
              packaging subject — hide them until a stage subject is active
              again (#157 diff-r1). */}
          {packagingSubject === null && (
            <>
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
