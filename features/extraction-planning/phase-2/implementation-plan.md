# Purity Mix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted Impure/Normal/Pure node inventory to the extraction
panel while retaining the exact Normal baseline and honest Water/Resource Well
boundaries.

**Architecture:** Extend the pure extraction derivation with an optional
raw-text purity mix and exact `Fraction` results. Bump plan persistence from v6
to v7 with a frozen historical selection type and explicit migration. Reuse the
existing store action and panel, adding only strict cloning, controls, summaries,
and browser assertions.

**Tech Stack:** React 19, TypeScript 6, Zustand, Vitest/jsdom, exact `Fraction`,
Vite, Chromium CDP.

---

### Task 1: Exact Purity Derivation

**Files:**
- Modify: `src/state/store.ts`
- Modify: `src/ui/extraction-plan.ts`
- Test: `src/ui/extraction-plan.test.ts`

- [ ] **Step 1: Write failing exact-mix tests**

Add tests that pass `purityMix` through the existing `derive` helper and assert:

```ts
expect(mixed.purity).toMatchObject({
  status: "planned",
  nodeCount: 3,
  balance: { status: "shortfall" },
});
expect(mixed.purity.totalSupply.toString()).toBe("840");
expect(mixed.purity.balance.amount.toString()).toBe("160");
```

Use Miner Mk3 at 100%, demand 1000, and counts `1 Impure / 1 Normal / 1 Pure`:
`240 * (1/2 + 1 + 2) = 840`; assert its exact shortfall and exact three-machine
power. Add a second mix that supplies more than demand and assert exact spare
and power. Add a transport table with Pure-only (480/min), Normal-only
(240/min), Impure-only (120/min), and all-zero (`transport.status === "none"`)
cases so every highest-present-purity branch is pinned.

Add a table for `""`, `"1.5"`, `"-1"`, `"1e2"`, an individual value greater
than `Number.MAX_SAFE_INTEGER`, and three individually safe values whose sum is
unsafe. Assert `purity.status === "invalid"` and an exact field/aggregate error.

Run:

```bash
npm test -- --run src/ui/extraction-plan.test.ts
```

Expected: FAIL because `ExtractionSelection` and the derived purity result do
not yet exist.

- [ ] **Step 2: Implement the minimal exact model**

Tasks 1 and 2 are one atomic persistence unit: do not commit or run the app with
the widened live type until Task 2 has frozen v6 and activated the v7 writer.
In `src/state/store.ts`, add:

```ts
export interface PurityMixText {
  impure: string;
  normal: string;
  pure: string;
}

export interface ExtractionSelection {
  machineId: string;
  clockPercentText: string;
  purityMix?: PurityMixText;
}
```

In `src/ui/extraction-plan.ts`, extend its selection input with optional
`purityMix`, add `ExtractionPurityResult`, and calculate only when the mix is
present and `itemId !== "water"`. Parse with `/^\d+$/` then `BigInt`; bound every
value and the exact sum against `BigInt(Number.MAX_SAFE_INTEGER)` before number
conversion. Use exact multipliers `Fraction.of(1, 2)`, `Fraction.from(1)`, and
`Fraction.from(2)`.

Return the optional result under the existing planned result:

```ts
purity:
  | null
  | { status: "invalid"; detail: string }
  | {
      status: "planned";
      nodeCount: number;
      totalSupply: Fraction;
      balance:
        | { status: "spare"; amount: Fraction }
        | { status: "shortfall"; amount: Fraction };
      powerText: string;
      transport: ExtractionTransportStatus | { status: "none" };
    };
```

Factor the existing tier lookup into a small `transportForOutput` helper and use
it for both Normal baseline and the greatest nonzero purity output.

- [ ] **Step 3: Verify derivation green; keep the unit uncommitted**

```bash
npm test -- --run src/ui/extraction-plan.test.ts
npm run check
```

Expected: focused tests and checks pass. Proceed immediately to Task 2; there
must never be a commit where the live selection type is widened while the
writer still emits v6.

### Task 2: Plan v7 Persistence

**Files:**
- Modify: `src/data/plan-store.ts`
- Modify: `src/data/plan-store.test.ts`
- Modify: `src/state/store.ts`
- Test: `src/state/store.test.ts`

- [ ] **Step 1: Write failing v7 boundary tests**

Before production edits, add a `samplePlanV7` current writer fixture with one extraction mix. Assert
save/load and export/import preserve all three raw strings. Add malformed v7
cases for null/array mix, missing keys, and non-string values. Add a v6 row with
an unknown `purityMix` extra and assert migration returns a v7 selection with
only `machineId` and `clockPercentText`.

Update store save/export/bundle expectations from v6 to v7 and add a round-trip
assertion for a prototype-like raw item key carrying a mix.

Run:

```bash
npm test -- --run src/data/plan-store.test.ts src/state/store.test.ts
```

Expected: FAIL because `PlanFileV7`, migration, and writers do not exist.

- [ ] **Step 2: Freeze v6 and add v7**

As the same uncommitted production unit as Task 1, first define a historical
type and point only v6 at it:

```ts
interface ExtractionSelectionV6 {
  machineId: string;
  clockPercentText: string;
}

export interface PlanStageV6 extends PlanStageV2 {
  userPlaced: boolean;
  extraction?: Record<string, ExtractionSelectionV6>;
}

export interface PlanStageV7 extends PlanStageV2 {
  userPlaced: boolean;
  extraction?: Record<string, ExtractionSelection>;
}
```

Add `PlanFileV7`, `isPlanFileV7`, strict optional mix validation, and:

```ts
export function migrateV6(plan: PlanFileV6): PlanFileV7 {
  return {
    ...plan,
    format_version: 7,
    stages: plan.stages.map((stage) => ({
      ...stage,
      extraction: copyHistoricalExtraction(stage.extraction),
    })),
  };
}
```

`copyHistoricalExtraction` must build a null-prototype record and explicitly
copy only the two v6 fields. Validation tries v7 first, then v6 through
`migrateV6`; all older chains end at v6 then migrate. Save/list/load APIs and
state imports use `PlanFileV7`. Writers emit `format_version: 7`.

Do not consider the implementation green until every v6 writer constructor in
`src/state/store.ts` emits typed v7 and the shared live type can no longer flow
into a v6 file. This ordering is the no-silent-v6-extension invariant.

- [ ] **Step 3: Verify green and commit**

```bash
npm test -- --run src/data/plan-store.test.ts src/state/store.test.ts
npm run check
git add src/data/plan-store.ts src/data/plan-store.test.ts src/state/store.ts src/state/store.test.ts src/ui/extraction-plan.ts src/ui/extraction-plan.test.ts
git commit -m "feat(124): persist purity mixes in plan v7"
```

Expected: focused persistence matrix and checks pass.

### Task 3: Store Intent And Panel Controls

**Files:**
- Modify: `src/state/store.ts`
- Modify: `src/state/store.test.ts`
- Modify: `src/ui/GraphCanvas.tsx`
- Modify: `src/ui/GraphCanvas.dom.test.tsx`
- Modify: `src/ui/app.css`

- [ ] **Step 1: Write failing lifecycle and DOM tests**

Store tests must prove `setExtractionSelection` deep-copies `purityMix`, safely
handles item id `"__proto__"`, preserves the mix when clock/extractor changes,
and removes it when the editor is disabled.

DOM tests use the file's existing `createRoot` plus container-query harness and
render Limestone, Water, and Crude Oil. Assert:

```ts
expect(container.querySelector('input[aria-label="Use node mix"]')).not.toBeNull();
expect(container.querySelector('input[aria-label="Impure nodes"]')).toBeNull();
```

After enabling Limestone, assert seed values `0 / baseline count / 0`, edit all
three fields, and inspect the callback payload. Then change the extractor and
clock through the rendered controls and assert both callback payloads retain
the exact existing `purityMix`. Assert Water has no checkbox and Oil does. Feed
invalid text and assert the exact inline error is present while the mix supply
summary is absent.

Run:

```bash
npm test -- --run src/state/store.test.ts src/ui/GraphCanvas.dom.test.tsx
```

Expected: FAIL because mix controls and deep cloning are absent.

- [ ] **Step 2: Implement store cloning and UI**

Deep-copy the optional nested object in every extraction-selection copy path:

```ts
const copyExtractionSelection = (selection: ExtractionSelection) => ({
  ...selection,
  ...(selection.purityMix
    ? { purityMix: { ...selection.purityMix } }
    : {}),
});
```

Use the helper in the action, plan rebuild, and plan writer projections.

In `ExtractionPanel`, show `Normal baseline`, then a labeled checkbox only when
the result is planned and `itemId !== "water"`. Enabling writes:

```ts
purityMix: { impure: "0", normal: String(result.count), pure: "0" }
```

Render three labeled number inputs (`min="0"`, `step="1"`) and update one raw
string at a time. Render exact mix supply, spare/shortfall, transport, and power;
an invalid mix renders only its error. Keep the existing baseline result and
focus lifecycle intact.

The extractor handler must preserve inventory explicitly:

```ts
onSetSelection({
  machineId,
  clockPercentText: selection?.clockPercentText ?? "100",
  ...(selection?.purityMix
    ? { purityMix: { ...selection.purityMix } }
    : {}),
});
```

The clock handler already spreads `selection`, but its DOM test must still pin
that behavior so a later payload reconstruction cannot drop the mix.

Add a compact `.extraction-purity-fields` three-column grid that collapses only
if required to keep every label/input within the panel; do not change the
established panel height caps.

- [ ] **Step 3: Verify green and commit**

```bash
npm test -- --run src/state/store.test.ts src/ui/GraphCanvas.dom.test.tsx
npm run check
git add src/state/store.ts src/state/store.test.ts src/ui/GraphCanvas.tsx src/ui/GraphCanvas.dom.test.tsx src/ui/app.css
git commit -m "feat(124): add purity mix controls"
```

Expected: lifecycle, DOM, and checks pass.

### Task 4: Browser Gate And Phase Evidence

**Files:**
- Modify: `src/ui/extraction-panel-browser-harness.tsx`
- Modify: `scripts/extraction-panel-browser-check.mjs`
- Modify: `features/extraction-planning/FEATURE.md`
- Create: `features/extraction-planning/phase-2/completion-report.md`

- [ ] **Step 1: Extend the checked-in browser gate**

At 360, 720, and 1280 widths, enable Limestone's mix, assert the seeded Normal
count, edit to `1/1/1`, and verify exact supply/shortfall text. Close/reopen and
assert persistence. Scroll the 360px panel body to the Pure input and assert its
rectangle lies within the visible panel after scrolling. Assert Water has no
mix checkbox and Oil does. Retain all Phase 1 pointer/Enter/Space, replacement,
live-update, disappearance, focus, and geometry rows.

Run:

```bash
node scripts/extraction-panel-browser-check.mjs
```

Expected: all prior rows plus the new purity interactions pass.

- [ ] **Step 2: Run complete verification**

```bash
npm test
npm run check
npm run build
node scripts/extraction-panel-browser-check.mjs
git diff --check develop...HEAD
```

Expected: all tests/checks/build/browser rows pass; build may retain only the
existing chunk-size advisory.

- [ ] **Step 3: Write evidence and commit**

Update `FEATURE.md` to mark Phase 2 implementation complete and record exact
counts. Write `completion-report.md` with delivered behavior, commands, browser
rows, and remaining Resource Well refusal.

```bash
git add src/ui/extraction-panel-browser-harness.tsx scripts/extraction-panel-browser-check.mjs features/extraction-planning
git commit -m "test(124): complete purity mix browser gate"
```

Expected: clean feature worktree ready for cumulative `develop...HEAD` review.

## Plan Review Disposition

- **r1:** folded all findings. Tasks 1 and 2 are one atomic type/persistence
  unit with no intermediate v6 writer commit; the UI extractor and clock
  handlers have explicit mix-preservation DOM coverage; and derivation tests
  cover Pure/Normal/Impure/zero transport plus exact spare, shortfall, and power.
