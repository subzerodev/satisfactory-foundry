# Phase 4 spec — src/ui React SVG schematic (ticket #6, epic #2)

Date: 2026-08-03
Status: v2 — FROZEN (correctness converged r2: APPROVED_WITH_NITS + APPROVED;
simplify APPROVED_WITH_NITS, 1 NIT rejected with rationale)
Basis: frozen Phase 4 brainstorm v2 (same directory); v1 design spec §UI +
§Testing; store contract `src/state/store.ts` @ develop; solver types
`src/core/manifold.ts`.

Everything here renders from store state. The only UI-side computation is
presentational coordinate mapping from **integer** machine indices/counts
(brainstorm Axis 3 invariant) plus exact-string formatting of Fractions.

## 1. File inventory (all new unless noted)

| File | Exports | Role |
|---|---|---|
| `src/ui/App.tsx` | `App` (default) | THE connected shell — sole importer of `useAppStore`; catalog-state switch; action wiring |
| `src/ui/UploadScreen.tsx` | `UploadScreen` | first-boot / needs-upload / upload-error screen |
| `src/ui/ControlsStrip.tsx` | `ControlsStrip` | recipe select, machine count, clock %, tier toggles, clear-overrides |
| `src/ui/SummaryCards.tsx` | `SummaryCards` | per-lane rate + belt-count cards |
| `src/ui/Schematic.tsx` | `Schematic` | the SVG (machine row, lanes, arrows, segments, seams, ticks, titles) |
| `src/ui/LaneOverrides.tsx` | `LaneOverrides` | per-lane belt rows with override inputs |
| `src/ui/FindingsPanel.tsx` | `FindingsPanel` | findings + invalid/idle messaging |
| `src/ui/Legend.tsx` | `Legend` | tier + override color swatches |
| `src/ui/layout.ts` | `computeLayout`, layout types, `LAYOUT` consts | pure geometry |
| `src/ui/format.ts` | `formatRate`, `tierLabel`, `beltLabel`, `findingText` | pure formatting |
| `src/ui/colors.ts` | `TIER_COLORS`, `OVERRIDE_COLOR`, `ERROR_COLOR`, `colorForCapacity` | pure color map |
| `src/ui/decode.ts` | `decodeBytes` | pure BOM-sniffing text decode |
| `src/ui/app.css` | — | single stylesheet, kebab-case classes |
| `src/App.tsx` (existing) | replaced: `export { default } from "./ui/App.tsx"` | keeps the Stage 0 entry path |
| `src/main.tsx` (existing) | + `void appStore.getState().init();` before render | boot |

No new dependencies. No config changes (`vite.config.ts`, tsconfigs, eslint
untouched). `src/core` purity rules unaffected (nothing in `src/core` changes).

## 2. Pure modules

### 2.1 `decode.ts`

```ts
export function decodeBytes(buf: Uint8Array): string
```
Port of the planner's `decodeFile` (`DocsUpload.svelte:14-26`), bytes-in:
FF FE → UTF-16 LE (skip 2); FE FF → UTF-16 BE (skip 2); EF BB BF → UTF-8
(skip 3); else UTF-8. The `File` shell lives in `UploadScreen`
(`decodeBytes(new Uint8Array(await file.arrayBuffer()))`).

### 2.2 `format.ts`

```ts
export function formatRate(f: Fraction): string
```
1. If `f.toString()` contains no `/` (integer value, `den === 1`) → that string.
2. Else for `dp` in 1..4: `const s = f.toDecimalString(dp)`; if
   `Fraction.parse(s).eq(f)` → return `s` as-is. (No trailing-zero trim: at
   the *smallest* round-tripping `dp` the last digit is never `0` — if it
   were, `dp−1` would already round-trip and return first. Do not write a
   trim branch; it is unreachable.)
3. Else → `f.toString()` (exact `"n/d"`). Never a rounded decimal.

```ts
export function tierLabel(kind: LaneKind, capacity: Fraction, tiers: TierTable): string
```
Index `i` of the first `tiers[kind][i].eq(capacity)` → the **bare tier
token**: belt `Mk${i+1}` / pipe `Pipe Mk${i+1}`; no match → `custom`
(brainstorm fold #5 — never a faked MkN). `tierLabel` never embeds a rate —
rate slots belong to `beltLabel`'s templates (below), so no template can
double-print.

```ts
export function beltLabel(side: "feed" | "output", index: number,
                          belt: FeedBelt | BreakoutBelt, kind: LaneKind,
                          tiers: TierTable): string
```
Feed: `` `Feed ${index+1} — ${tierLabel(…)} · ${formatRate(capacity)}/min · enters ${at}` ``
where `at` = `"at head"` when `entersAfterMachine === 0` else
`` `after machine ${entersAfterMachine}` `` — matching the mockup string
exactly (`Feed 2 — Mk2 · 120/min · enters after machine 16`, design-spec:116;
pinned as an exact-string test row). Output:
`` `Out ${index+1} — ${tierLabel(…)} · ${formatRate(load)}/min load · ${from}` ``
where `from` = `"from machine 1"` when `startsAfterMachine === 0` else
`` `breaks out after machine ${startsAfterMachine}` `` (capacity is carried
by the tier token; the printed rate is the belt's *load* — the two differ, so
exactly one rate slot exists per template).

```ts
export function findingText(f: Finding, itemName: (id: string) => string): string
```
One human sentence per variant (exact strings pinned here so tests can assert
them):
- `infeasible-machine-demand` → `` `${item}: one machine needs ${rate(demand)}/min — more than the best unlocked tier carries (${rate(topCapacity)}/min). No manifold can serve it; unlock a higher tier or lower the clock.` ``
- `segment-over-capacity` → `` `${item}: bus over capacity between machines ${fromMachine}–${toMachine} — peak ${rate(peakFlow)}/min exceeds ${rate(busCapacity)}/min.` ``
- `starved-machines` → base `` `${item}: machines starve` ``; append
  `` ` from machine ${starvedFrom} to ${starvedTo}` `` when the range is
  present; append `` ` (machine ${partial.machine} receives ${rate(received)}/min, short ${rate(shortfall)}/min)` ``
  when `partial` is present. (Both fields optional per `manifold.ts:100-106`;
  compose from what exists.)
- `invalid-input` → `` `Invalid input: ${detail}` ``.

(`rate` = `formatRate` above.)

### 2.3 `colors.ts`

```ts
export const TIER_COLORS = {
  belt: ["#9e9e9e", "#e6a23c", "#4f9dde", "#7c5cd6", "#d6604f", "#3dbd7d"],
  pipe: ["#58b0c4", "#2d7dd2"],
} as const;                       // positions match TIER_TABLE (6 belt, 2 pipe)
export const OVERRIDE_COLOR = "#5a5a5a";
export const ERROR_COLOR = "#d92b2b";
export function colorForCapacity(kind: LaneKind, capacity: Fraction,
                                 tiers: TierTable): string
```
First `tiers[kind][i].eq(capacity)` → `TIER_COLORS[kind][i]`; none →
`OVERRIDE_COLOR`. (Single source for belts, segments, ticks, legend.)
A static assert-style test pins `TIER_COLORS` lengths to `TIER_TABLE` lengths.

### 2.4 `layout.ts`

Constants (`LAYOUT`): `viewW = 960`, `marginX = 24` (usable 912),
`minPitch = 8`, `maxPitch = 48`, `labelPitch = 20`, `machineH = 40`,
`laneH = 56`, `busH = 28`, `marginY = 16`.

```ts
export interface SchematicLayout {
  width: number; height: number;          // final SVG logical size
  pitch: number;                          // per-machine x step
  labelStep: number;                      // label every k-th (plus 1 and N)
  scrolled: boolean;                      // pitch bottomed out at minPitch
  machineTop: number;                     // AMENDED (boundary r1): machine-row
                                          // top y, exposed so the component
                                          // consumes rather than re-derives
  machines: { index: number; x: number; labeled: boolean }[]; // 1-based index
  feeds: LaneTrack[];                     // stacked top→down, feeds[0] outermost
  outputs: LaneTrack[];                   // stacked top→down below machines
}
export interface LaneTrack {
  itemId: string; y: number;              // track baseline y
  busY: number;                           // this lane's bus rail y
  belts: { index: number; x: number }[];  // arrow x per belt (entry/break-out)
  segments: { fromMachine: number; toMachine: number;
              x1: number; x2: number; beltIndex: number;
              peakFlow: Fraction }[];     // AMENDED (boundary r1): peakFlow
                                          // passes through — §3.4's title
                                          // contract renders it; its omission
                                          // here was an internal inconsistency
  seams: number[];                        // x of dashed boundaries (interior)
}
export function computeLayout(result: StageSolveResult, machineCount: number):
  SchematicLayout
```

Geometry rules (all integer-index-driven):
- `pitch = clamp(minPitch, floor(usable / max(N,1)), maxPitch)`;
  `scrolled = (pitch === minPitch && minPitch × N > usable)`; when scrolled,
  `width = marginX×2 + pitch×N` (else `viewW`).
- Machine `i` (1-based) box x = `marginX + (i−1)×pitch`; box width
  `pitch − 2`.
- `labelStep = pitch ≥ labelPitch ? 1 : ceil((N × labelPitch) / usable)`;
  machine labeled iff `i === 1 || i === N || i % labelStep === 0`.
- Boundary x after machine m (m = 0..N): `marginX + m×pitch` — the shared
  formula for entry arrows (`entersAfterMachine`), break-out arrows
  (`startsAfterMachine`), segment edges (`x1` at `fromMachine−1`, `x2` at
  `toMachine`), and seams (interior segment starts).
- Vertical stacking (each lane band contains its own bus rail; `busH` is the
  tick gap between the innermost rails and the machine row):
  - feed lane `i` (0-based, outermost first): band top
    `bandY = marginY + i×laneH`; labels/arrows render in the band;
    `y = bandY`; the lane's bus rail `busY = bandY + laneH − 8`.
  - `machineTop = marginY + feeds.length×laneH + busH`.
  - output lane `j` (0-based, innermost first): band top
    `bandY = machineTop + machineH + busH + j×laneH`; `y = bandY`;
    `busY = bandY + 8` (mirror of the feed rail).
  - `height = marginY×2 + feeds.length×laneH + busH×2 + machineH +
    outputs.length×laneH` — exactly the sum of the bands above.
  - Splitter ticks: per lane, a short tick per machine from that lane's
    `busY` toward the machine row (feed: downward; output: upward), colored
    by the containing segment.
- Pass-through: `beltIndex`, spans, itemIds — copied, never re-derived.
- N = 0 or empty lanes → machine row only (possibly empty), `feeds`/`outputs`
  tracks with empty `belts`/`segments`; no special-casing beyond emptiness.

## 3. Components (presentational contracts)

Props reference solver/store types directly. Only `App.tsx` touches the store.

### 3.1 `UploadScreen`
Props: `{ reason: "empty" | "stale" | "upload-error"; message?: string;
onUpload(text: string): void }`.
Heading + short path hint (as the planner's copy: docs live at
`<install>/CommunityResources/Docs/<locale>.json`; cached after upload);
`<input type="file" accept="application/json,.json">`; local `busy` state
while decoding; `reason === "stale"` renders the **generic** re-upload prompt
"Your cached catalog couldn't be loaded — please re-upload Docs.json." (the
data layer deliberately drops the stale cause — version mismatch, IDB
failure, and corrupt payload are indistinguishable by design,
`catalog-store.ts:75-80`; the copy must not assert one cause);
`upload-error` renders `message` in an error paragraph. Handler: read file →
`decodeBytes` → `onUpload(text)`.

### 3.2 `ControlsStrip`
Props: `{ recipes: CatalogRecipe[]; machines: Record<string, CatalogMachine>;
selection: Selection; hasOverrides: boolean; onSelectRecipe(id: string | null): void;
onMachineCount(n: number): void; onClockText(t: string): void;
onTiers(t: {belt: number; pipe: number}): void; onClearOverrides(): void }`.
- Recipe `<select>`: placeholder `— pick a recipe —` (value "" ↔ null);
  options sorted by `displayName` (`localeCompare`), alternates suffixed
  `" (alt)"`. Selected recipe's machine `displayName` shown beside.
- Machine count `<input type="number" min={0} step={1}>` →
  `onMachineCount(e.target.valueAsNumber)` (NaN passes through; the store
  verdicts it — no UI pre-validation).
- Clock `<input type="text" inputMode="decimal">` → raw `onClockText`.
- Tier toggles per kind: buttons `Mk1..Mk6` / `Mk1..Mk2`; button k active iff
  `k ≤ unlockedTiers[kind]`; click → `onTiers({...current, [kind]: k})`.
- `Clear overrides` button, disabled unless `hasOverrides`.

### 3.3 `SummaryCards`
Props: `{ result: StageSolveResult; itemName(id: string): string }`.
One card per feed lane: item name, `` `${formatRate(totalDemand)}/min in` ``,
`` `${belts.length} × ${kind}` ``; per output lane: name,
`` `${formatRate(totalOutput)}/min out` ``, `` `${breakouts.length} × ${kind}` ``.

### 3.4 `Schematic`
Props: `{ result: StageSolveResult; machineCount: number;
tiers: TierTable; unlocked: { belt: number; pipe: number };
itemName(id: string): string }`.
Computes `layout = computeLayout(result, machineCount)` (a pure call with
memoization via `useMemo` — allowed, presentational). Renders:
- machine row: rect per machine, number label when `labeled`;
- per feed lane (stacked above): belt labels (`beltLabel`) at each arrow x,
  entry arrows dropping to the lane's bus rail, bus segments as thick
  horizontal lines colored `colorForCapacity(kind, belts[beltIndex].capacity,
  tiers)`, per-machine splitter ticks in the containing segment's color,
  dashed seam lines at `seams`;
- output lanes mirrored below with break-out arrows rising;
- each segment carries `<title>`
  `` `machines ${fromMachine}–${toMachine} · peak ${formatRate(peakFlow)}/min of ${formatRate(busCap)}/min` ``
  where `busCap = tiers[kind][unlocked[kind] − 1]` — the lane's bus capacity
  (highest unlocked tier), a pure lookup restoring the frozen brainstorm's
  "peak … of …" tooltip form; each belt arrow carries `<title>` = its
  `beltLabel`;
- error highlight: a segment matched by a `segment-over-capacity` finding
  (span equality on the same lane) or containing a `starved-machines`
  machine/range (containment) gets class `seg-error` (stroke `ERROR_COLOR`);
- `scrolled` → the wrapping `<div class="schematic-scroll">` allows
  horizontal overflow; SVG `width`/`viewBox` use `layout.width`.

### 3.5 `LaneOverrides`
Props: `{ result: StageSolveResult; overrides: Selection["overrides"];
onOverride(side, itemId, beltIndex, text: string | null): void }`.
Per lane (feeds then outputs), one row per belt in the solve result: belt
label, and a text input whose value = the override cell
(`overrides[side][itemId]?.[index] ?? ""`); commit on change:
empty/whitespace → `null` (revert to auto), else the raw string. (The solve
re-derives on every commit; belt lists shrink/grow only via solver output —
misaddressing impossible, brainstorm refutation r1.)

### 3.6 `FindingsPanel`
Props: `{ solve: SolveState; findings: Finding[]; itemName(id): string }`
where `findings` = stage-global ⊕ per-lane concatenation (built in `App`).
- `solve.status === "invalid"` → single error card: reason-specific heading
  (`bad-clock` → "Clock %", `bad-machine-count` → "Machine count",
  `bad-override` → "Belt override") + the store's `detail` verbatim.
- `solved` + findings → warning list via `findingText`.
- `solved` + none → collapsed "No warnings — manifold is clean." line.

### 3.7 `Legend`
Props: `{ tiers: TierTable }`. Swatch + `Mk${i+1}` per belt tier, per pipe
tier, plus `override` (OVERRIDE_COLOR) and `problem` (ERROR_COLOR) entries.

### 3.8 `App` (connected)
`const s = useAppStore();` (whole-store subscription — one view, v1 scale).
Switch on `s.catalog.status`:
- `initializing` → `<p class="boot">Loading…</p>`;
- `needs-upload` → `UploadScreen` with `onUpload = s.uploadDocsText`;
- `ready` → header (title + `Legend`), `uploadError` banner when set (plus a
  compact re-upload `<input type="file">` in the header for catalog
  refresh — same decode path), `ControlsStrip`, then by `s.solve.status`:
  - `idle` → "Pick a recipe to see its manifold." empty state;
  - `invalid` → `FindingsPanel` only;
  - `solved` → `SummaryCards`, `Schematic` (passing
    `unlocked = s.selection.unlockedTiers` and
    `tiers = s.catalog.catalog.tiers`), `LaneOverrides`, `FindingsPanel`.
Helpers built here: `itemName(id)` = `catalog.items[id]?.displayName ?? id`;
`hasOverrides` = any override cell non-null; `findings` concatenation.
`src/main.tsx` adds `import "./ui/app.css"` (via App) and
`void appStore.getState().init();`.

## 4. Styling

One `app.css`, imported by `App.tsx`. Light neutral theme, system font
stack; kebab-case classes (`controls-strip`, `summary-cards`, `findings-panel`,
`seg-error`, …). No CSS framework, no CSS-in-JS. Layout: page max-width
1024px centered; controls strip = flex row with wrapping; cards = flex row.
Cosmetic values are implementer-discretion; class names above are contract
(tests assert them).

## 5. Test plan (node env, zero new deps)

New files under `src/ui/`; fixtures built with real `solveStage` over
hand-built `StageInput`s (core types; no catalog needed) — the Phase 1
20-smelter worked example: `d = 30`, `N = 20`, capacities
`belt: [60,120,270,480]`, `pipe: [300, 600]` (the pipe array is required even
belt-only — `capacitiesValid` checks both kinds unconditionally,
`manifold.ts:202-203`; belt tiers pinned to 4 — the #5 plan-review rule),
feeds → belts `[480, 120]`, belt 2 enters after machine 16; output `p = 30`,
breakout after machine 16.

| File | Cases |
|---|---|
| `decode.test.ts` | UTF-16 LE+BOM, UTF-16 BE+BOM, UTF-8+BOM, plain UTF-8 byte fixtures of the same JSON string all decode identically; BOM-less UTF-16 not required (matches planner behavior) |
| `format.test.ts` | `formatRate`: `600` → "600"; `75/2` → "37.5"; `1/4` → "0.25"; `1/2` → "0.5"; `1/3` → "1/3"; `1/8` → "0.125"; `1/16` → "0.0625"; `1/32` → "1/32" (fallback past 4dp). `tierLabel`: bare Mk token; bare `custom` fallback. `beltLabel` exact strings: `"Feed 2 — Mk2 · 120/min · enters after machine 16"` (the mockup string), a head form (`enters at head`), an output form with `load`, and a custom-override feed form (`Feed 1 — custom · 90/min · …`). `findingText`: all four variants incl. starved with/without `partial`/range |
| `colors.test.ts` | palette lengths === `TIER_TABLE` lengths; `colorForCapacity` per tier; override fallback; belt/pipe independence |
| `layout.test.ts` | worked example: machines.length 20, belt-2 arrow x at boundary 16, segments x1/x2 at machine edges, seam at boundary 16, labelStep 1; N=200: pitch clamped, labelStep = ceil(200×20/912) = 5, machines 1+200 always labeled; N=2000: `scrolled` true, width = 24×2 + 8×2000; N=0: empty machines, no throw; infeasible lane (empty belts/segments) → empty track |
| `smoke.test.tsx` | `renderToStaticMarkup`: `UploadScreen` (each reason; error message present); `ControlsStrip` (recipe options sorted, " (alt)" suffix, active tier buttons); `SummaryCards` (rates + counts as exact strings); `Schematic` (worked example with `unlocked: {belt: 4, pipe: 2}`: 20 rects, the full "Feed 2 — Mk2 · 120/min · enters after machine 16" label, `<title>` `"… peak 480/min of 480/min"` form, seg-error class when a doctored over-capacity finding is passed); `LaneOverrides` (row per belt; input values from overrides); `FindingsPanel` (invalid bad-clock detail; each finding sentence; clean line); `Legend` (swatch count = 6+2+2) |

Bidirectionality: per the R2 rule, `features/manifold-visualizer/r2-verification.log`
(appended for Phase 4) captures PASS → break (revert a representative
production behavior per module) → FAIL → restore → PASS.

What is deliberately NOT tested (pinned): event handlers (inert in static
markup; all eight store actions headless-tested in Phase 3), visual
appearance, drag/hover interactivity. Manual gate: `npm run dev` walk
(upload a real Docs.json → worked example on screen) before the boundary
review; `npm run build` green is an exit criterion.

## 6. Exit criteria

1. All §1 files landed; `src/App.tsx` re-export; `main.tsx` boot line.
2. `npm test` green: 155 existing + new UI tests, node env, no new deps.
3. `npm run check` + `npm run build` green; no config diffs.
4. Full flow works in the dev server (manual walk logged in the completion
   report): upload → pick recipe → controls → schematic + cards + findings +
   legend + overrides, matching the mockup's 20-smelter example.
5. Cumulative diff dual-reviewed at the phase boundary; merged `--no-ff`.

## Revision history

- **r1 correctness (2026-08-03):** code-reviewer NEEDS_REWORK (1 IMPORTANT +
  2 NIT); adversarial-reviewer NEEDS_REWORK (2 IMPORTANT + 3 NIT). All
  arithmetic/formula/fixture claims verified clean by both. Folded in v2:
  1. Label composition rebuilt (code-reviewer IMPORTANT): `tierLabel` returns
     the bare tier token; the Feed template carries the explicit
     `· ${capacity}/min` slot (mockup string now an exact-string test row);
     the Output template's single rate slot is `load` marked as such.
     *Deliberate residual deviation, recorded:* a custom-override **output**
     belt reads `custom · <load>/min load · …` — its capacity is not printed
     (no mockup slot; load is the operative number for a collection belt;
     the override input row shows the custom capacity). The brainstorm
     fold-#5 intent — never fake an MkN — is honored on both sides.
  2. Segment `<title>` restored to the brainstorm's `peak … of …` form via
     the `unlocked` prop + top-unlocked-tier lookup (adversarial IMPORTANT).
  3. `stale` copy made generic per `catalog-store.ts:77-79`'s deliberate
     cause-dropping (adversarial IMPORTANT).
  4. Vertical layout pinned with per-lane band/busY formulas; height formula
     now the literal sum of the bands (adversarial NIT).
  5. Fixture recipe completed with `pipe: [300,600]` (adversarial NIT).
  6. Trailing-zero trim removed as provably unreachable; noted so the
     implementer doesn't write the dead branch (both reviewers).
  7. Decode cite corrected to `DocsUpload.svelte:14-26` (code-reviewer NIT).
- **r2 correctness (2026-08-03):** code-reviewer APPROVED_WITH_NITS (2
  immaterial: the recorded output-custom deviation acknowledged; a cite range
  one line short — folded to `:75-80`); adversarial-reviewer APPROVED (0) —
  all seven folds attacked and survived (busCap provenance chain, 8-way label
  walk, head-segment peakFlow = 480 trace, band-sum overlap check).
  CONVERGED.
- **Simplify (one-shot, post-convergence):** APPROVED_WITH_NITS (1 NIT).
  NIT-1 (`hasOverrides` prop derivable from `selection` inside
  `ControlsStrip`) **rejected with rationale**: App-side derivation keeps the
  nested-record scan out of the presentational component and co-located with
  the sibling `itemName`/`findings` helpers (§3.8); the reviewer's own
  assessment rates the shapes near-equal ("either resolution is fine"), and
  the current shape is the one the frozen brainstorm's connected-shell
  discipline implies. No fold → no correctness re-run. Spec FROZEN.
- **Boundary-review amendment (2026-08-03, boundary r1 fold):** §2.4's
  `LaneTrack.segments` gains `peakFlow: Fraction` (pass-through) and
  `SchematicLayout` gains `machineTop`. As frozen, the type omitted the very
  field §3.4's title contract renders; the implementation's `belt.capacity`
  stand-in showed a wrong peak on any under-filled span (both boundary
  reviewers, independently). Divergent-case tests added (layout N=17 +
  smoke title pin); Legend smoke row now asserts the §5-pinned 6+2+2 via
  the full `TIER_TABLE`. Amendment enters the cumulative boundary re-review.

## Assumptions ledger

Inherited from the frozen brainstorm (all grounded there): store contract,
solver emissions, Fraction API, UTF-16 docs files, renderToStaticMarkup-in-node
feasibility, zero-new-deps. New in this spec: (a) `valueAsNumber` for the
machine-count input (DOM standard; NaN routes to the store's verdict);
(b) `useMemo` for layout is presentational caching, not logic; (c) exact
finding sentences are UI contract only — solver strings (`detail`) pass
through verbatim.
