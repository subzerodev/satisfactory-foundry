# Phase 4 brainstorm — src/ui React SVG schematic (ticket #6, epic #2)

Date: 2026-08-03
Status: v2 — FROZEN (correctness pair converged r1; simplify APPROVED 0 findings)
Inputs: v1 design spec §UI + §Testing (frozen), `src/state/store.ts` @ develop
8daffc6 (the Phase 3 contract), `src/core/manifold.ts` result types,
`src/data/types.ts` + `tiers.ts` catalog shapes.

## Already settled — do NOT re-litigate

From the epic #2 Decisions block, the #3/#4/#5 audit trails, and the frozen v1
design spec:

1. **All-Claude review roster** (code-reviewer + adversarial-reviewer +
   claude-simplify-reviewer) — user directive, arc-wide.
2. **Everything renders from store state; no UI-side math** — the solver's
   result is display-ready (`peakFlow` spans, walk-authoritative break-outs,
   findings). The UI adds *presentational coordinate mapping only*.
3. **SVG in v1** (React Flow reserved for the future graph editor).
4. **Belt-tier → color mapping consistent app-wide, with a legend** (v1 spec §UI).
5. **UI stays thin; solver tests carry the correctness weight; no browser
   automation in v1** (v1 spec §Testing). The testing posture below must fit
   inside this envelope.
6. **Store contract is frozen** (Phase 3): `useAppStore` + eight actions;
   `CatalogState` / `SolveState` unions; overrides as dense capacity-text
   arrays; `uploadError` transient; tiers as *prefix counts* `{belt, pipe}`.
   The UI adapts to the store — never the reverse.
7. Override clear rules, IDB identity, Fraction-exactness boundary — upstream;
   the UI merely consumes.

## What Phase 4 delivers

The v1 component layer: upload screen (first boot), recipe picker + stage
controls, summary cards, the SVG manifold schematic (approved mockup), findings
panel, tier legend. After this phase the full user flow works in the browser
and the arc closes.

## Axis 1 — Component architecture: connected tree vs presentational core

**Options**

- (a) Every component calls `useAppStore` directly.
- (b) **Presentational components take plain props; one thin connected layer
  (`App.tsx`) subscribes to the store and passes data down.** ← pick
- (c) Context-provided store instance.

**Pick (b).** Rationale: (i) testability without a DOM — presentational
components render from fixture data via `renderToStaticMarkup` in the existing
node test env (Axis 7); (ii) the future graph editor re-hosts the same
presentational schematic; (iii) the connected layer is ~one screen of glue.
(c) is machinery v1 doesn't need — there is exactly one store singleton.
Depth rule: `App.tsx` is the *only* file that imports `useAppStore`; action
wiring passes down as callbacks.

## Axis 2 — File layout & component tree

```
src/ui/
  App.tsx            connected shell: catalog-state switch + action wiring
  UploadScreen.tsx   file input + decode + uploadDocsText; error display
  ControlsStrip.tsx  recipe select, machine count, clock %, tier toggles,
                     clear-overrides
  SummaryCards.tsx   per-lane: item name, total rate, belt/pipe count
  Schematic.tsx      the SVG: machine row, feed/output lanes, arrows,
                     segments, seam lines, hover titles
  LaneOverrides.tsx  per-lane belt list with capacity-override inputs
  FindingsPanel.tsx  human-readable findings + invalid/idle states
  Legend.tsx         tier → color swatches (belts + pipes + override)
  layout.ts          PURE: solve result → plain-number geometry
  format.ts          PURE: Fraction/label formatting helpers
  colors.ts          PURE: tier → color map (single source for schematic+legend)
  app.css            single plain stylesheet (class-based, no CSS-in-JS)
```

`src/App.tsx` (Stage 0 placeholder) is replaced by a re-export of
`src/ui/App.tsx`; `src/main.tsx` gains the one boot line
`void appStore.getState().init()` before render (the `initializing` state
renders meanwhile — init is already headless-tested).

Top-level `App` switch on `catalog.status`:
`initializing` → centered "Loading…"; `needs-upload` → `UploadScreen`
(shows `reason`/`message`); `ready` → main layout (ControlsStrip, then
SummaryCards + Schematic + LaneOverrides + FindingsPanel + Legend), plus a
dismissible-by-next-upload banner when `uploadError` is set.

## Axis 3 — The layout math boundary ("no UI-side math", made precise)

`layout.ts` is a pure module: `(StageSolveResult, machineCount) →
SchematicLayout` of plain numbers. The invariant that keeps it presentational:

- **Coordinates derive only from integer machine indices, counts, and array
  positions** — `entersAfterMachine`, `startsAfterMachine`, `fromMachine`,
  `toMachine`, `belts.length`, lane index. All are JS integers already.
- **Fractions are never converted to numbers.** No `peakFlow`-proportional
  bar heights, no rate-scaled anything in v1 (the mockup has none). Fractions
  appear in the UI exclusively as formatted *strings* (Axis 4).
- Solver semantics pass through untouched: `entersAfterMachine: 0` = head;
  segment spans are 1-based inclusive; the UI draws them, never re-derives
  them.

Geometry model (numbers pinned in the spec): fixed logical viewBox width; the
machine row centered; one feed track per feed lane stacked above (entry arrows
drop to the bus), one output track per output lane below (break-out arrows
rise from the bus); bus segments are horizontal runs between seam lines at
span boundaries; per-machine splitter ticks inherit the segment color.

### Row compression (mockup: "thinner boxes, label every Nth machine")

- `machineWidth = clamp(minW, usableWidth / N, maxW)`.
- Labels: machine numbers render only when `machineWidth ≥ labelW`; otherwise
  label every `k`-th machine, `k = ceil((N × labelW) / usableWidth)`, plus
  always machines 1 and N.
- If `machineWidth` bottoms out at `minW` (N beyond ~usableWidth/minW), the
  SVG grows wider than the viewport and the schematic container scrolls
  horizontally — the spec's "unless compression bottoms out" escape hatch.

## Axis 4 — Exact-rate display

`format.ts` provides `formatRate(f: Fraction): string`:

- Integer values (`den === 1`) → plain integer string.
- Else try `f.toDecimalString(dp)` for dp = 1..4 and return the first whose
  `Fraction.parse` round-trips to exactly `f` (trailing zeros trimmed) —
  covers every real Docs.json rate class (37.5, 0.25, …).
- A non-terminating value (possible via user clock/override input, e.g. clock
  = 1/3) falls back to `f.toString()` (`"n/d"`), suffixed as-is. **Never a
  rounded decimal presented as truth** — exactness is the product's one
  non-negotiable.

Labels compose in components: `` `${formatRate(rate)}/min` ``, tier names
(`Mk1`…) from tier index, item/machine display names from the catalog. A belt
whose (overridden) capacity matches no tier gets the label fallback
`custom · <capacity>/min` — no `MkN` is ever faked for a non-tier value.

## Axis 5 — Tier colors, belt identity, and hover

- `colors.ts` exports `TIER_COLORS: { belt: string[]; pipe: string[] }`
  (positional, matched to `TIER_TABLE` lengths: 6 + 2) plus
  `OVERRIDE_COLOR`. A belt's color: the tier whose capacity equals
  (`Fraction.eq`) the belt's capacity; no tier matches (user override to a
  non-tier value) → `OVERRIDE_COLOR`. Same lookup drives belts, bus
  segments (via the segment's attributed `beltIndex`), splitter ticks, and
  the `Legend` — one function, consistent by construction.
- **Hover flows via native SVG `<title>`** on each segment (and belt):
  `"machines 9–16 · peak 420/min of 480/min"`. Zero state, zero listeners,
  accessible; matches "UI stays thin". A custom tooltip layer is v2 polish.
- Findings highlights: an implicated segment renders with the error stroke
  class. The two finding shapes need *different* match predicates —
  `segment-over-capacity` carries `{fromMachine, toMachine}` and matches a
  segment by **span equality**; `starved-machines` carries a machine (or
  `starvedFrom`/`starvedTo` range) and matches by **containment** (the
  segment whose span contains the starved machine(s)). `FindingsPanel` lists
  the same findings textually. The panel and the highlight both *read*
  findings — neither re-computes anything.

## Axis 6 — Controls mapping (store contract, verbatim)

- **Recipe picker**: one flat `<select>` (placeholder option ↔ `recipeId:
  null`), options = catalog recipes sorted by displayName, alternates suffixed
  " (alt)", `onChange → selectRecipe(id | null)`. Machine displayName of the
  selected recipe renders beside it. No search/grouping in v1 (hundreds of
  options are fine in a native select).
- **Machine count**: `<input type="number" min=0 step=1>` →
  `setMachineCount(Number(value))`; non-integer/negative input surfaces as the
  store's `invalid 'bad-machine-count'` — the UI does not pre-validate, it
  renders the store's verdict (single source of validation truth).
- **Clock %**: text input → `setClockPercentText(raw)` verbatim; `bad-clock`
  renders from `SolveState`. No numeric coercion UI-side (would break
  exactness).
- **Unlocked tiers**: the store models a *prefix count*; the UI renders a
  toggle-row per kind (buttons Mk1…Mk6 / Mk1…Mk2) where tiers ≤ count show
  active and clicking tier k calls `setUnlockedTiers({...,[kind]: k})` —
  visually the mockup's "toggles", semantically the contract's prefix. (A
  per-tier independent checkbox set would contradict the frozen store shape —
  not re-litigated, just presented honestly.)
- **Overrides** (`LaneOverrides`): per lane, one row per belt from the solve
  result: index, auto/override capacity, entry/break-out point; a text input
  per belt commits `setOverride(side, itemId, beltIndex, textOrNull)` on
  change (empty → null = revert to auto). Plus the global "clear overrides"
  button → `clearOverrides()`. Belt count comes from the *solve result* (the
  authoritative belt list), so override rows always address real belts;
  `overrides-exceed-belt-count` findings (stale longer arrays after a
  tier/count change) surface via FindingsPanel as designed in Phase 1/3.

## Axis 7 — Testing posture (pinned, per the ticket's explicit ask)

**No new dependencies. No jsdom, no @testing-library, no browser automation.**
Three layers:

1. **Pure-module unit tests (bulk of the weight):** `layout.ts`, `format.ts`,
   `colors.ts` are pure TS over solver-result fixtures produced by the *real*
   `solveStage` (the 20-smelter worked example from Phase 1, tiers pinned
   `belt: 4` per the #5 plan-review catch). Compression thresholds, label
   stepping, seam positions, color resolution, exact-rate round-trip — all
   table-driven in the existing node env.
2. **Static-render smoke tests:** `react-dom/server`'s `renderToStaticMarkup`
   renders the presentational components (props = real-solve fixtures) in the
   node env — asserts each catalog/solve state produces its screen, entry
   labels/finding texts/legend swatches present, no render throw. This is
   exactly what SSR rendering supports without any DOM emulation (react.dev:
   renderToStaticMarkup; vitest node env default). Event handlers are inert
   in static markup — and deliberately untested: every handler is a one-line
   store-action call, and all eight actions are already headless-tested in
   Phase 3.
3. **Manual gate check:** `npm run dev` walked by the team lead before the
   boundary review and by Michael at the USER GATE (upload a real Docs.json →
   worked example on screen). `npm run build` green is an exit criterion.

Rationale: the v1 spec's testing clause says the UI is thin and correctness
lives in the solver. Adding a DOM-emulation dependency to interaction-test
one-line glue would invert that. The risk this posture accepts: wiring
mistakes in `App.tsx` glue (wrong callback on the wrong control) surface at
the manual gate walk, not in CI — bounded by the glue being a single screen.

## Axis 8 — Upload screen & the UTF-16 trap (reuse-first find)

Satisfactory ships `Docs/<locale>.json` as **UTF-16 LE with BOM**.
`File.text()` decodes UTF-8 and would garble every real file into a parse
error. The planner's proven BOM-sniffing decoder
(`satisfactory-planner/src/ui/screens/DocsUpload.svelte` → `decodeFile`:
UTF-16 LE/BE + UTF-8 BOM + plain UTF-8) is ported as `src/ui/decode.ts`,
**split at the bytes seam**: a pure `decodeBytes(buf: Uint8Array): string`
core (unit-testable with byte fixtures in node) plus the thin
`File.arrayBuffer()` shell in the component — the one piece of
planner UI worth carrying over (the rest is Svelte; no SVG schematic exists
there to port). Upload flow: `<input type="file" accept=".json">` → decode →
`uploadDocsText(text)`; busy flag while parsing; errors render from
`CatalogState`/`uploadError` (store-owned), not component state.

## Degenerate & invalid states (render honestly, per lane result)

- `solve.status: 'idle'` + ready → "pick a recipe" empty state (no schematic).
- `invalid` → FindingsPanel-style message with the store's `detail`; no
  schematic (nothing misleading).
- `solved` with an infeasible lane: the solver already returns **empty belts +
  segments** with the `infeasible-machine-demand` finding
  (`manifold.ts:327-335` "Render nothing") — the UI draws exactly what it's
  given (an empty lane) and the finding renders in the panel. No UI-side
  suppression logic needed.
- Degenerate (0 machines, no-input recipes): empty lanes render as empty
  tracks; schematic shows the machine row only. No crashes — the store
  guarantees a `SolveState` in every case.

## Idiom grounding (community-idiom gate)

- **SVG-in-JSX, declaratively from data** — React renders SVG elements
  directly in JSX; no d3-style imperative DOM manipulation; the virtual DOM
  diffs updates (Scott Logic, "Building D3-inspired charts with React";
  LogRocket, "A guide to using SVGs in React"). Our schematic is a pure
  function of layout data — the canonical shape.
- **Static-markup smoke testing in node** — `renderToStaticMarkup` produces
  HTML from components without a DOM (react.dev reference); vitest's default
  node env is the documented fast path when tests don't need jsdom
  (vitest.dev/guide/environment). No new deps.
- **File upload via `<input type=file>` + explicit TextDecoder** — ported
  planner pattern (in-repo precedent), which exists precisely because naive
  `File.text()` fails on the game's UTF-16 files.

## Assumptions ledger

1. **Store contract as read from `src/state/store.ts` @ 8daffc6** (eight
   actions, unions, dense overrides) — grounded: read this session; Phase 3
   frozen.
2. **Solver emits empty geometry for infeasible lanes** — grounded:
   `manifold.ts:327-335` and `:465-473` read this session.
3. **`Fraction.toDecimalString(dp)` rounds half-up; `toString()` is `"n/d"`** —
   grounded: `fraction.ts:199-234` read this session; the round-trip check in
   `formatRate` is what makes rounding safe to use.
4. **Docs.json is UTF-16 LE + BOM** — grounded: planner's `decodeFile`
   comment + implementation (proven in production use).
5. **`renderToStaticMarkup` works in vitest's node env with zero config** —
   grounded: react.dev + vitest docs (cited above); verified in-plan by the
   first smoke test before any component work builds on it.
6. **Native `<title>` tooltips suffice for hover flows in v1** — v1-spec-fit
   judgment ("UI stays thin"), explicitly traded: no styled tooltip, none
   mocked up.
7. **No new runtime or dev dependencies are needed for any of the above** —
   react, react-dom (incl. `react-dom/server`), zustand already installed
   (package.json read this session).

## Revision history

- **r1 correctness (2026-08-03, all-Claude roster):** code-reviewer
  APPROVED_WITH_NITS (2), adversarial-reviewer APPROVED_WITH_NITS (3 LOW) —
  converged first round. All five findings folded in v2:
  1. `formatRate` predicate reworded to "integer values (`den === 1`)"
     (code-reviewer NIT).
  2. Infeasible-emission citations tightened to `manifold.ts:327-335` /
     `:465-473` (both reviewers).
  3. Findings→highlight matching split into span-equality
     (`segment-over-capacity`) vs containment (`starved-machines`)
     predicates (adversarial LOW).
  4. `decode.ts` port split at the bytes seam — pure
     `decodeBytes(Uint8Array)` core + `File` shell; "verbatim" retracted
     (adversarial LOW).
  5. Non-tier override label fallback pinned: `custom · <capacity>/min`,
     never a faked `MkN` (adversarial LOW).
  Attacks refuted (recorded): integer-indices layout invariant sufficient
  for the whole mockup; formatRate scan bounded + round-trip-safe;
  renderToStaticMarkup posture feasible zero-dep; overrides-shrink
  misaddressing impossible (solver empty-belts emission); uploadDocsText is
  a single-decode seam.
