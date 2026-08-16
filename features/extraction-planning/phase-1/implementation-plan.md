# Extraction Planning Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user open an unresolved raw feed, select a Normal-purity standalone extractor and clock, and see exact count, supply, spare, power, and per-extractor transport requirements with plan persistence.

**Architecture:** Extend the parsed catalog with structured extractor capabilities, then keep extraction calculation in a pure UI-domain module. Persist only user intent on the owning stage; raw demand remains derived from the solved lane and the React Flow panel resolves the open stage/item identity on every render.

**Tech Stack:** React 19, TypeScript, Zustand, XYFlow, exact `Fraction` arithmetic, Vitest/jsdom, IndexedDB catalog/plan stores, Vite.

---

## Pre-Implementation Drift Gate

- [ ] Read `features/extraction-planning/phase-1/brainstorm-spec.md` and verify every path and signature below against `HEAD` before editing.
- [ ] Confirm `Catalog`, `StageNode`, `PlanFileV5`, `RawFlowNode`, `graphToFlow`, `rebuildFromPlan`, `savePlan`, `loadPlan`, and the top-right `Panel` call sites have not drifted. Record any mechanical path/signature correction in the commit message; stop for design review only if behavior would change.
- [ ] Run the baseline focused suites:

```bash
npm test -- --run src/data/docs-loader.test.ts src/data/catalog-store.test.ts src/ui/advice.test.ts src/data/plan-store.test.ts src/state/store.test.ts src/ui/graph-flow.test.ts src/ui/GraphCanvas.test.ts
```

Expected: all selected baseline tests pass.

### Task 1: Parse and cache structured extractor capabilities

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/data/docs-loader.ts`
- Modify: `src/data/docs-loader.test.ts`
- Modify: `src/data/catalog-store.ts`
- Modify: `src/data/catalog-store.test.ts`
- Modify: catalog literals reported by `rg -n 'recipeUnlocks:' src --glob '*.ts'`

- [ ] Add failing parser tests with minimal Docs fragments for all supported native families. Assert exact rates 60/120/240 for miners, 120 for Oil/Water, 60 nominal for Resource Well; topology; and exact applicability. Add rejection rows for missing/non-positive cycle values, unknown forms, invalid textual booleans, and empty/malformed/unresolved restricted resources.
- [ ] Run the focused loader tests and confirm failures mention missing extractor support.
- [ ] Add the required contracts:

```ts
export interface CatalogExtractor {
  machineId: string;
  topology: "standalone" | "resource-well";
  normalRate: Fraction;
  itemIds: string[];
}

export interface Catalog {
  // existing fields
  extractors: Record<string, CatalogExtractor>;
}
```

- [ ] Widen only the building-family boundary needed for `FGBuildableWaterPump` and `FGBuildableFrackingExtractor`. Parse cycle fields and exact `"True"`/`"False"` restriction text into source-order-independent temporary extractor records; materialize unrestricted forms only after raw resources are known. Do not admit the Pressurizer as a machine for Phase 1.
- [ ] Bump `CATALOG_PARSER_VERSION` from 5 to 6. Add `StoredCatalogExtractor`, serialize `normalRate.toString()`, revive with `parseRational`, and require `extractors` in all catalog literals/round-trip tests.
- [ ] Run:

```bash
npm test -- --run src/data/docs-loader.test.ts src/data/catalog-store.test.ts
```

Expected: parser, strict-rejection, stale-v5, and cache round-trip tests pass.
- [ ] Commit:

```bash
git add src/data/types.ts src/data/docs-loader.ts src/data/docs-loader.test.ts src/data/catalog-store.ts src/data/catalog-store.test.ts src
git commit -m "feat(112): parse extractor capabilities"
```

### Task 2: Derive exact Normal-purity extraction requirements

**Files:**
- Create: `src/ui/extraction-plan.ts`
- Create: `src/ui/extraction-plan.test.ts`
- Reuse: `src/ui/advice.ts`
- Reuse: `src/data/tiers.ts`

- [ ] Write failing table tests for the frozen worked examples and error arms: Limestone 12,720/min with Miner Mk.3 at 100% gives 53 at 240/min and 2385 MW; Water 10,600/min gives 89 at 120/min and 1780 MW; 250% rows preserve exact count/supply/spare and approximate power; invalid clocks and safe-integer overflow return explicit statuses.
- [ ] Add adversarial selection tests: Resource Well persisted for Water, Oil Extractor persisted for Water, a removed machine, and Nitrogen with no standalone candidate must produce no count/transport/power.
- [ ] Run the new test and confirm it fails because `deriveExtractionPlan` does not exist.
- [ ] Implement one pure discriminated result API. Validate the selected extractor with both conditions before arithmetic:

```ts
extractor.topology === "standalone" && extractor.itemIds.includes(itemId)
```

Parse clock exactly in `(0, 250]`, calculate `normalRate * clock / 100`, reuse `suggestSupply` and `stagePowerText`, and find the smallest full belt/pipe tier carrying one extractor output. Compare that tier with the target stage's unlocked prefix, never total demand with one line.
- [ ] Run:

```bash
npm test -- --run src/ui/extraction-plan.test.ts src/ui/advice.test.ts
```

Expected: every exact, invalid, saturation, topology, and cross-item test passes.
- [ ] Commit:

```bash
git add src/ui/extraction-plan.ts src/ui/extraction-plan.test.ts
git commit -m "feat(112): derive extraction requirements"
```

### Task 3: Persist extraction intent and explicit placement origin in plan v6

**Files:**
- Modify: `src/state/store.ts`
- Modify: `src/state/store.test.ts`
- Modify: `src/data/plan-store.ts`
- Modify: `src/data/plan-store.test.ts`

- [ ] Write failing store tests for setting/clearing `{machineId, clockPercentText}` by stage and raw item, stage isolation, removal cleanup, and recipe-swap retention.
- [ ] Add `ExtractionSelection`, optional `StageNode.extraction`, and one atomic store action. Keep catalog semantics out of the write path.
- [ ] Write failing v6 tests before migration code. Cover valid/invalid extraction shapes; malformed clock text round-trip; v5 with explicit `userPlaced`; v1-v4 with and without original positions; save/load; single import; bundle import; legacy-row rename/save-over; export/reimport; and `listPlans` recognizing versions 1-6.
- [ ] Define `PlanStageV6` with required `userPlaced: boolean` and optional extraction map, and `PlanFileV6` with `format_version: 6`. Every validator/migration returns explicit v6. For v1-v4, calculate original position presence before any migration synthesizes positions; for v5 use `entry.userPlaced === true`.
- [ ] Remove `loadPlanWithOrigin` and the `wasV5`/`v5Native` branch. Make `rebuildFromPlan` consume only `entry.userPlaced`. Save every stage as v6 with explicit boolean and extraction intent.
- [ ] Run:

```bash
npm test -- --run src/data/plan-store.test.ts src/state/store.test.ts
```

Expected: all v1-v6 migration/rewrite and extraction-state tests pass.
- [ ] Commit:

```bash
git add src/state/store.ts src/state/store.test.ts src/data/plan-store.ts src/data/plan-store.test.ts
git commit -m "feat(112): persist extraction selections"
```

### Task 4: Carry exact live raw identity and demand to the canvas

**Files:**
- Modify: `src/ui/graph-flow.ts`
- Modify: `src/ui/graph-flow.test.ts`
- Modify: `src/ui/GraphCanvas.tsx`
- Modify: `src/ui/GraphCanvas.test.ts`

- [ ] Write failing graph tests requiring each derived raw node to carry `stageId`, `itemId`, and the exact `Fraction` demand in addition to display text. Assert linked-input suppression and raw layout positions remain unchanged.
- [ ] Extend `RawFlowNode.data` and copy `feed.totalDemand` directly. Never parse `rateText` back into a number.
- [ ] Add component-local open identity `{stageId, itemId}`. On each render resolve it against current derived raw nodes; close when absent. Inject only the open callback at the React Flow boundary so `graphToFlow` stays pure.
- [ ] Make the raw wrapper `focusable: false` and `pointerEvents: "all"`; render one inner `button.nodrag.nopan` with `aria-haspopup="dialog"` and item/rate accessible name. Preserve non-draggable/non-selectable/non-deletable flags and the `raw:` commit guard.
- [ ] Test mouse, Enter, and Space activation; wrapper not in tab order; button sole tab stop; exact demand updates while open after an upstream solve change; and linked-input disappearance closes the panel.
- [ ] Run:

```bash
npm test -- --run src/ui/graph-flow.test.ts src/ui/GraphCanvas.test.ts
```

Expected: exact live-demand and interaction tests pass without changing existing raw graph behavior.
- [ ] Commit:

```bash
git add src/ui/graph-flow.ts src/ui/graph-flow.test.ts src/ui/GraphCanvas.tsx src/ui/GraphCanvas.test.ts
git commit -m "feat(112): open extraction planning from raw feeds"
```

### Task 5: Render the extraction panel and bounded top-right stack

**Files:**
- Modify: `src/ui/GraphCanvas.tsx`
- Modify: `src/ui/GraphCanvas.test.ts`
- Modify: `src/ui/app.css`
- Modify: `src/ui/smoke.test.tsx` if app-level wiring needs coverage

- [ ] Write failing UI tests for solid explicit selection, Water/Oil first-open auto-seeding, invalid clock removing stale output, visible `Purity Normal`, exact worked results, per-output Mk5 warning at Miner Mk.3 250%, unavailable persisted selection, explicit Resource Well alternative text, and Nitrogen's no-miner/no-count message.
- [ ] Replace overlapping top-right Panels with one Panel containing an unframed notice/extraction stack. Render extractor select, clock text input, requirement, count, each/supplied/spare, transport, power, and icon close control. Move focus to the first control on open and restore it to the surviving opener on close.
- [ ] Add CSS caps of 260px desktop and 220px at `<=720px`, internal vertical scroll, mobile side gutters/top clearance, and no nested card styling.
- [ ] Add browser assertions/screenshots at 360px and 720px width with 340px canvas height and chain power present for notice-only, extraction-only, and combined states. Verify no overlap with top-left, bottom-left, or bottom-right controls and no text overflow.
- [ ] Run:

```bash
npm test -- --run src/ui/GraphCanvas.test.ts src/ui/smoke.test.tsx
```

Expected: all panel, focus, responsive-contract, and explicit-unavailable tests pass.
- [ ] Commit:

```bash
git add src/ui/GraphCanvas.tsx src/ui/GraphCanvas.test.ts src/ui/app.css src/ui/smoke.test.tsx
git commit -m "feat(112): add extraction planning panel"
```

### Task 6: Bidirectional evidence and phase verification

**Files:**
- Create: `features/extraction-planning/phase-1/r2-verification.log`
- Create: `features/extraction-planning/phase-1/completion-report.md`
- Modify: `features/extraction-planning/FEATURE.md`

- [ ] Run the complete suite with production code present and record the exact passing file/test counts.
- [ ] For each distinct production boundary, temporarily break or stash the implementation and capture a genuine Vitest `FAIL` line naming the corresponding new test: extractor parsing/cache, exact derivation, v6 migration/persistence, live raw demand, and panel rendering. Restore after each mutation and record the green rerun in `r2-verification.log`.
- [ ] Run final verification:

```bash
npm test
npm run check
npm run build
git diff --check develop...HEAD
```

Expected: all commands exit 0; only the existing Vite chunk-size advisory may remain.
- [ ] Browser-walk desktop plus 360/720 mobile widths using Limestone, Water, Crude Oil, and Nitrogen. Verify focus restoration, live updates, responsive stack scrolling, Normal-purity label, and no false total-demand transport warning. Record exact observations in the completion report.
- [ ] Update `FEATURE.md` to implementation complete/pending cumulative review and commit:

```bash
git add features/extraction-planning
git commit -m "docs(112): record phase 1 verification"
```

## Plan Self-Review

- [ ] Spec coverage: map every frozen acceptance criterion to Tasks 1-6; no Phase 2 purity editor or Resource Well count enters this plan.
- [ ] Placeholder scan: `rg -n 'T[B]D|T[O]DO|implement l[a]ter|similar t[o]' features/extraction-planning/phase-1/implementation-plan.md` returns no unresolved instruction.
- [ ] Type consistency: confirm `CatalogExtractor`, `ExtractionSelection`, `PlanStageV6`, raw-node data, and `deriveExtractionPlan` names are consistent across tasks.
