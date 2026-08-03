# Phase 3 spec — src/state Zustand store (ticket #5, epic #2)

Date: 2026-08-03 · Status: v1, design dual-review pending
Provenance: brainstorm (FROZEN after 4 correctness rounds + simplify,
`features/manifold-visualizer/phase-3/brainstorm.md`) — **its pinned rules
are normative and cited here, not restated**; where this spec is lossy, the
frozen brainstorm governs. Live contracts: `src/data/*` + `src/core/manifold.ts`.

## Deliverable

`src/state/store.ts` + colocated `store.test.ts`. Zero changes elsewhere; no
new dependencies (zustand 5.0.14 already installed).

## Contract

- **Types + top-level shape**: exactly the frozen brainstorm Axis 2 —
  `CatalogState` / `Selection` / `SolveState` unions and the flat
  `AppState { catalog, selection, solve, uploadError }` with the disjoint
  upload-error channels.
- **Store construction**: `createStore` from `zustand/vanilla` wrapped with
  `persist` (`zustand/middleware`); exported `useAppStore` React hook via
  `useStore` (one line, unconsumed until Phase 4); exported vanilla store for
  headless tests (Axis 1).
- **Actions**: the eight of Axis 4, with its pinned semantics — notably the
  **replacement-keyed override clear** (clear iff the in-memory catalog is
  replaced: parse success regardless of save outcome, never on parse
  failure), recipeId re-validation on replacement, dense-array `setOverride`
  padding, tier clamping, the wide catch with `uploadError` cleared at
  entry, and mutate-fully-then-derive-once ordering.
- **derive()**: the Axis 3 pipeline verbatim, including the dangling-id
  `idle` guard, machineCount=0 → `solved` (degenerate), densified override
  parsing, toStageInput throws → `invalid 'bad-override'`, and the
  error-routing rule (parse/shape → `invalid`; count-excess → `solved` +
  finding).
- **Persistence**: `persist` with
  `partialize: s => ({ unlockedTiers: s.selection.unlockedTiers })`, custom
  validating `merge` (clamp to `[1..TIER_TABLE.<kind>.length]`, default on
  corrupt), storage key `satis_foundry:tiers`, `createJSONStorage` with
  injectable storage (localStorage in app, plain-object stub in tests).

## Defaults

`catalog: {status:'initializing'}`; `selection: { recipeId: null,
machineCount: 1, clockPercentText: "100", unlockedTiers: { belt:
TIER_TABLE.belt.length, pipe: TIER_TABLE.pipe.length }, overrides: { feeds:
{}, outputs: {} } }`; `solve: {status:'idle'}`; `uploadError: null`.

## Test plan (Vitest node env; fake-indexeddb for catalog IO; object-stub storage)

1. **Catalog lifecycle**: init → `needs-upload{empty}`; seeded cache → init →
   `ready` (via real saveCatalog/loadCatalog); version-stale →
   `needs-upload{stale}`.
2. **Upload paths — all four sub-cases** (the brainstorm's r3/r4-pinned
   matrix): parse-fail fresh-boot → `needs-upload{upload-error, message}`;
   parse-fail while ready → stays `ready`, overrides KEPT, `uploadError`
   set; parse+save success → `ready(new)`, overrides cleared, uploadError
   null; parse success + save fail (broken IDB stub) → `ready(new)` in
   memory, overrides cleared, `uploadError` notes cache miss. Wide catch:
   non-JSON text (SyntaxError) and DocsParseError both routed.
3. **Re-upload re-validation**: recipeId missing from new catalog → reset to
   null → `idle`; recipeId surviving → kept, overrides cleared, fresh solve.
4. **Live derivation**: selectRecipe on a DOCS_FRAGMENT-style fixture through
   the REAL parse→toStageInput→solveStage pipeline → `solved` with the known
   Phase 1 worked-example values; each setter (machineCount, clock text,
   tiers, override) triggers exactly one recompute with updated result.
5. **Invalid inputs**: clock "0"/"abc"/"-5" → `invalid bad-clock`;
   machineCount 1.5/-1 → `invalid bad-machine-count`; 0 → `solved` empty;
   malformed override text → `invalid bad-override`; unknown-item override
   (simply `setOverride` with an itemId absent from the selected recipe —
   the setter has no membership guard, derive's buildLanes throws) →
   `invalid bad-override`; out-of-range
   override index → `solved` + `overrides-exceed-belt-count` finding (the
   routing split).
6. **Overrides discipline**: setOverride at index 3 on empty → dense
   null-padded array; selectRecipe/upload-replacement clear them;
   machineCount/clock changes do NOT.
7. **Persistence**: tiers survive a store re-create via the stub (hydrate
   before first action); corrupt stored JSON → defaults; nothing but
   `{unlockedTiers}` in the stored value; key `satis_foundry:tiers`.

Bidirectionality log per the workflow rule
(`features/manifold-visualizer/phase-3/r2-verification.log` at
implementation).

## Acceptance criteria (mirrors ticket #5)

- Full headless flow green (lifecycle, uploads, derivation, invalid routing,
  persistence); `npm run check` + `npm test` + `npm run build` green.
- Core purity untouched; zero dependency delta.
- Cumulative diff dual-reviewed at the phase boundary; merged `--no-ff`.

## Assumptions ledger

- **Frozen-brainstorm rules are implementation-ready** — 4 correctness
  rounds pinned every seam (upload matrix, clear rule, densification,
  hydration order); this spec adds no design.
- **zustand 5.0.14 subpaths** (`vanilla`, `middleware`, `createJSONStorage`,
  synchronous hydration for sync storage) — verified against installed
  node_modules during review rounds 2/4.
- **fake-indexeddb + object-stub storage under node env** — Phase 2
  precedent + persist's documented `storage` API.
- **The store imports only `../data/*` and `../core/fraction.ts` types** —
  no react import in `store.ts` itself (the hook wrapper imports
  `zustand/react` = the `useStore` binding, which is react-peer but
  tree-shaken from headless tests; if `zustand/react` pulls react into the
  node test graph, the hook moves to a separate `use-app-store.ts` module —
  decided at implementation drift-hunt, either shape satisfies the spec;
  the deciding test is simply `npm test` green under node env with the hook
  exported — react is a direct dependency so resolution cannot fail, making
  the single-module shape the expected outcome).
