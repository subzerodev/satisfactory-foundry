# Phase 3 brainstorm — src/state Zustand store (ticket #5, epic #2)

Date: 2026-08-03 · Status: v1, design dual-review pending
Grounding: the live contracts on `develop` — `src/data/catalog.ts`
(`parseCatalogFromText`), `src/data/catalog-store.ts` (`loadCatalog` →
`{hit|stale|empty}`, `saveCatalog`), `src/data/stage-input.ts`
(`toStageInput(recipe, catalog, opts)` + its stated throw cases),
`src/core/manifold.ts` (`solveStage`, `StageSolveResult`), `src/data/types.ts`
(`Catalog`). Reuse-first: the planner's state layer is Svelte-runes +
plan-solver-specific — verified nothing portable; designed fresh.

## Already settled — do NOT re-litigate

- **One Zustand store**; selection (recipe, machine count, clock %, unlocked
  tiers, overrides) + derived solve result; unlocked tiers persisted to
  **localStorage**; NO document persistence in v1; "every control change
  recomputes live" (v1 spec §Architecture + decisions table).
- `zustand` installed since Stage 0 (locked stack); `src/state` outside the
  core purity boundary.
- The data-layer contracts above are frozen (Phases 1–2 merged); the store
  adapts to them — never the reverse.
- toStageInput throws are caller-bug SHAPE errors; solver findings are VALUE
  errors (Phase 2 spec's throw-vs-finding principle).

## Purpose

Lock the store's state shape, actions, derivation flow, and persistence — the
contract Phase 4's UI consumes — and implement it fully headless-tested.

## Decision axes

### Axis 1 — Store construction: vanilla core + React hook wrapper

Options: (a) `create()` from `zustand` (React-bound hook only);
(b) `createStore()` from `zustand/vanilla` + `useStore` re-export for React.

**Pick: (b).** The store must be **headless-testable** (this phase ships no
UI; Vitest runs node-env) and Phase 4 then consumes it via React. Vanilla
core + a one-line `useAppStore` hook wrapper is the zustand-documented
pattern for exactly this split, keeps tests free of React, and changes
nothing for Phase 4.

### Axis 2 — State shape

```ts
type CatalogState =
  | { status: 'initializing' }
  | { status: 'needs-upload'; reason: 'empty' | 'stale' | 'upload-error'; message?: string }
  | { status: 'ready'; catalog: Catalog };

interface Selection {
  recipeId: string | null;
  machineCount: number;          // UI-facing integer, default 1
  clockPercentText: string;      // raw user input, default "100"
  unlockedTiers: { belt: number; pipe: number }; // default full table
  overrides: {
    feeds: Record<string, (string | null)[]>;    // capacity as exact strings; arrays ALWAYS dense (null-padded)
    outputs: Record<string, (string | null)[]>;
  };
}

type SolveState =
  | { status: 'idle' }                                  // no catalog / no recipeId / recipeId not in catalog
  | { status: 'solved'; result: StageSolveResult }      // findings included
  | { status: 'invalid'; reason: 'bad-clock' | 'bad-machine-count' | 'bad-override'; detail: string };

// Top-level store shape (flat):
interface AppState {
  catalog: CatalogState;
  selection: Selection;
  solve: SolveState;
  uploadError: string | null;    // transient: last upload/persist failure while
                                 // a working catalog stayed 'ready'; cleared on
                                 // the next upload attempt. Fresh-boot upload
                                 // failure (no prior catalog) instead lands in
                                 // needs-upload{'upload-error'} — the two cases
                                 // are DISJOINT by construction.
  // + actions
}
```

Key calls:
- **`clockPercentText` is a raw string** — the store is the seam between UI
  text inputs and solver Fractions; parsing happens at derive time and a
  malformed value becomes `SolveState 'invalid'`, never a crash and never a
  stale-solve lie.
- **Override capacities stored as strings** (exact decimal text, e.g. "780")
  — parsed via `Fraction.parse` at derive time; keeps persisted/serializable
  state Fraction-free and the exactness discipline intact.
- **`SolveState` is a discriminated union**, mirroring the layers below:
  solver findings live INSIDE `result` (value errors); un-derivable input is
  `'invalid'` (shape errors caught at the boundary).

### Axis 3 — Derivation: eager recompute inside actions

Options: (a) every selection action ends by recomputing `solve` synchronously
(store holds the result); (b) memoized selector computing on read;
(c) subscribe-middleware recompute.

**Pick: (a).** The v1 spec says "every control change recomputes live"; the
solver is pure exact math over tiny inputs (N ≤ hundreds — Phase 1 tests run
in ms), so eager synchronous recompute in a single shared `derive()` helper
called at the end of each mutating action is the simplest correct shape: no
memo invalidation surface, no middleware, the stored `solve` is always
consistent with the stored selection. (b)/(c) buy nothing at this scale.

`derive()` flow: no catalog, no recipeId, **or `catalog.recipes[recipeId]`
undefined** (a dangling id — see the re-upload rule in Axis 4) → `idle`;
parse clock text (`Fraction.parse`, must be > 0) → else `invalid 'bad-clock'`;
validate machineCount non-negative safe integer → else
`invalid 'bad-machine-count'` (0 is VALID — solver-degenerate, `solved` with
empty lanes); densify + parse override strings → `Fraction` (index iteration,
holes and `null` → `null`; malformed string → `invalid 'bad-override'`);
build opts → `toStageInput` (its throws — unknown key/duplicate lane/tier
range — caught → `invalid 'bad-override'` with the thrown message as detail;
tier range is prevented by construction, see Axis 4) → `solveStage` → `solved`.

**Error-routing rule (stated for Phase 4's warnings panel):** override-*parse*
failure and toStageInput shape throws → `invalid`; override-*count* excess
(`overrides-exceed-belt-count`) is a solver VALUE finding and surfaces as
`solved` with the finding inside `result` — two distinct wiring paths, per
the Phase 2 throw-vs-finding principle.

### Axis 4 — Actions (the Phase 4 API)

```ts
interface Actions {
  init(): Promise<void>;                     // loadCatalog → ready | needs-upload{empty|stale}
  uploadDocsText(text: string): Promise<void>; // parse → saveCatalog → ready; DocsParseError → needs-upload{upload-error, message}
  selectRecipe(recipeId: string | null): void; // resets overrides (they're per-recipe lanes)
  setMachineCount(n: number): void;
  setClockPercentText(text: string): void;
  setUnlockedTiers(t: { belt: number; pipe: number }): void; // clamped to [1..table length]
  setOverride(side: 'feeds' | 'outputs', itemId: string, beltIndex: number, capacityText: string | null): void;
  clearOverrides(): void;
}
```

- `selectRecipe` **clears overrides** — they are lane-addressed per recipe;
  carrying them across recipes would misaddress lanes. Machine count / clock
  / tiers survive recipe changes (natural UI expectation).
- **Overrides clear iff the in-memory catalog is REPLACED** — i.e. on
  **parse success**, regardless of `saveCatalog` outcome; **never on a parse
  failure**. Rationale: catalog replacement is exactly the moment override
  lane semantics can no longer be trusted — a recipe may survive with the
  same id but changed lanes, and a stale override would silently misapply
  (the stale-solve lie the design forbids). A FAILED parse keeps the old
  catalog and therefore keeps its still-valid overrides (no data loss on a
  no-op); a save-failure-after-good-parse still adopted the new catalog in
  memory, so it still clears. On replacement, additionally: if the new
  catalog no longer contains `recipeId`, reset `recipeId → null` (dangling
  ids never reach derive; derive's `recipes[recipeId] === undefined → idle`
  branch is belt-and-braces). Machine count / clock / tiers survive
  (catalog-independent).
- `setOverride` writes **dense arrays only**: growing to `beltIndex` pads
  intermediate slots with `null` (never sparse writes — a sparse array's
  `.length` counts holes and would trip the solver's
  `overrides-exceed-belt-count` length check spuriously).
- `setUnlockedTiers` **clamps** to `[1..TIER_TABLE.<kind>.length]` at the
  action boundary, so toStageInput's tier-range throw is unreachable from
  store-driven flows (belt-and-braces: derive still catches).
- **Upload failure handling (single rule, wide catch):** `uploadDocsText`
  **clears `uploadError` at entry** (both success and failure paths start
  clean), then catches EVERY failure — `SyntaxError` from `JSON.parse`
  (non-JSON file), `DocsParseError`, and `saveCatalog`/IndexedDB rejection —
  never only `DocsParseError`. Routing: no prior `ready` catalog →
  `needs-upload{'upload-error', message}`; prior catalog was `ready` → stays
  `ready` + `uploadError` set (a bad re-upload never bricks a session). A
  `saveCatalog` failure after a SUCCESSFUL parse does NOT block `ready` —
  the catalog is usable this session, merely uncached — with `uploadError`
  noting the cache miss.
- Action ordering: every mutating action applies its state change fully,
  THEN calls `derive()` exactly once (e.g. selectRecipe: set id + clear
  overrides, then derive) — derive never observes intermediate state.

### Axis 5 — Persistence: zustand/persist middleware, tiers only

Options: (a) `zustand/middleware` `persist` with `partialize` →
`unlockedTiers` only; (b) hand-rolled localStorage read/write in the action.

**Pick: (a).** `persist` + `partialize` is the zustand-shipped, documented
idiom (no new dependency — it's inside the zustand package); it handles
hydration ordering and storage errors. The projection is pinned:
`partialize: s => ({ unlockedTiers: s.selection.unlockedTiers })` (persisted
shape is top-level `{unlockedTiers}`; a validating `merge` writes it back
into `selection.unlockedTiers`, clamped, defaulting on corrupt/missing
values) — nothing else ever touches localStorage (the v1 spec persists tiers
only). Storage key: **`satis_foundry:tiers`** (v1) — same naming discipline
as the `satis_foundry` IndexedDB decision, no collision with the planner.
**Hydration order:** with a synchronous storage (localStorage or the test
stub) persist hydrates during store creation, BEFORE `init()` is ever
callable — so derive never runs on default-then-hydrated tiers; `init()`
performs the single first derive.

### Axis 6 — Module layout

`src/state/store.ts` (store + types + derive) + `store.test.ts` (headless:
fake-indexeddb for the catalog path, a localStorage stub for persistence,
DOCS_FRAGMENT-style fixture through the REAL parse→map→solve pipeline).
Single module until it grows — the Phase 1/2 precedent.

## Out of scope (Phase 3)

All UI/React components (Phase 4 — the `useStore` hook wrapper is exported
but unconsumed); plan save/load (v1 non-goal); catalog re-parse UI flows
beyond upload; chained stages.

## Assumptions ledger

- **Live contracts verified this session** — loadCatalog statuses, toStageInput
  signature + throw cases, solveStage, DocsParseError all built + reviewed in
  Phases 1–2 (paths in the header); the store adds no new claims about them.
- **zustand vanilla + persist are in the installed package** — `zustand`
  ^5 ships `zustand/vanilla` and `zustand/middleware` (persist) as
  subpath exports; verify exact import paths at implementation drift-hunt.
- **Solver speed makes eager recompute safe** — Phase 1's 30-test suite incl.
  N=40 cases runs in single-digit ms; a UI keystroke-rate recompute is
  negligible.
- **localStorage stub under node-env Vitest** — plain object stub injected
  via persist's `storage` option (documented API); no jsdom needed.
- **Nothing portable in the planner's state layer** — verified: Svelte runes
  + plan/LP-solver semantics, different framework and problem.

## Revision history

**Round 1 design review** (code-reviewer: NEEDS_REWORK, 1 IMPORTANT + 2 NIT;
adversarial-reviewer: NEEDS_REWORK, 1 HIGH + 1 MEDIUM + 1 LOW + nits). All
folded; none rejected:

- **Dangling recipeId after re-upload** (adversarial HIGH): successful
  re-upload re-validates selection (reset id + clear overrides if missing
  from the new catalog) **[clear-rule superseded in R2, re-pinned in R3]**;
  derive adds the `recipes[recipeId] === undefined → idle` guard. The
  never-crash guarantee now holds on the re-upload sequence.
- **Upload-error state reconciled** (code-reviewer IMPORTANT): top-level
  `AppState` drawn with the transient `uploadError` field; fresh-boot failure
  → `needs-upload{'upload-error'}`, re-upload-while-ready → stays `ready` +
  `uploadError` — disjoint by construction, three models collapsed to one.
- **setOverride dense-padding + derive densification** (adversarial MEDIUM):
  arrays always dense (null-padded); derive index-iterates holes/null → null
  — the spurious `.length` finding is unreachable.
- **Wide upload catch** (adversarial LOW + code-reviewer NIT): every failure
  (JSON SyntaxError, DocsParseError, saveCatalog/IDB rejection) routed by the
  single rule; save-failure-after-good-parse stays `ready` (uncached).
- **Error-routing rule stated** (code-reviewer NIT): override-parse →
  `invalid`; override-count excess → `solved`+finding.
- **Top-level shape + partialize projection + hydration order pinned**
  (adversarial nits); machineCount=0 explicitly valid/degenerate.
- **Action ordering stated**: mutate fully, then derive once.

**Round 2 design review** (code-reviewer: APPROVED, 0 — zustand persist
internals traced, custom-merge mandate confirmed; adversarial-reviewer:
NEEDS_REWORK, 1 IMPORTANT + 1 NIT). Folded:

- **Re-upload ALWAYS clears overrides** (adversarial IMPORTANT, superseding
  the round-1 reset-only-when-missing rule): a same-id recipe with changed
  lanes would silently misapply a stale override (`buildLanes` finds the
  itemId, no throw; length fits, no finding) — the exact stale-solve lie the
  invariant forbids. Unconditional clear on catalog replacement closes it
  completely; out-of-range/dense-padding and hydration surfaces HELD under
  attack.
- **`uploadError` clear-point pinned** (adversarial NIT): cleared at
  `uploadDocsText` entry.

**Round 3 design review** (code-reviewer: APPROVED_WITH_NITS, 1 history NIT;
adversarial-reviewer: NEEDS_REWORK, 1 IMPORTANT). Folded:

- **Clear-rule pinned to catalog REPLACEMENT** (adversarial IMPORTANT): the
  round-2 wording was stated two incompatible ways ("successful re-upload"
  vs "unconditionally"); neither reconciled the save-failure sub-case. Now:
  clear iff the in-memory catalog is replaced — on parse success regardless
  of save outcome; never on parse failure (failed parse keeps the old
  catalog AND its valid overrides — no data loss on a no-op).
- Round-1 ledger line annotated [superseded] (code-reviewer NIT).
