# Plan save/load — brainstorm (ticket #11, Stage 2, Tier 2)

Date: 2026-08-03
Status: v6 — FROZEN (correctness converged r6 after six rounds; simplify
APPROVED 0 findings — name-as-key simplification considered + rejected:
rename AC + Stage-3 stable identity). Tier-2: this document is the binding
implementation contract.
Inputs: live contracts `src/state/store.ts` (post-#9: Selection, catalogSource,
uploadError), `src/data/db.ts` (DB_VERSION 1, single `catalog` store,
get/put-only SatisDb), `src/data/catalog-store.ts` patterns; v1 design spec
§Growth path ("Plan save/load: serialize the store"); ticket #11 ACs.

## Already settled — do NOT re-litigate

1. Growth-path sequence + opus/sonnet implementer dispatch (master-plan
   §Growth-path, Michael 2026-08-03). All-Claude review roster (epic #2).
2. Exactness end-to-end; `satis_foundry` IDB identity; core purity; the
   frozen `CatalogState` union; the #5 re-validation rule (a recipeId absent
   from the live catalog resets to null); thin-UI testing posture.
3. Ticket AC: save/list/load/rename/delete named plans; format versioned +
   documented; **Stage-3 graph extension structurally open**.

## Axis 1 — What a plan IS (the format, graph-forward)

A plan stores **user intent, not derived data**: exactly the `Selection`
shape — which is already 100% JSON-safe strings/numbers
(`recipeId: string|null`, `machineCount: number`, `clockPercentText: string`,
`unlockedTiers: {belt,pipe}`, `overrides: Record<string,(string|null)[]>`).
No solve results, no catalog, no Fractions — exactness is trivial because
rates are never stored, only the user's own input text. Plans reference
recipes by id against whatever catalog is live at load time.

```ts
interface PlanFileV1 {
  format_version: 1;
  name: string;
  createdAt: string;            // ISO
  updatedAt: string;            // ISO
  stages: { selection: Selection }[]; // exactly 1 entry in Stage 2
  links: never[];               // reserved: Stage-3 edges (empty array now)
}
```

`stages` is an **array from day one** and `links` a reserved empty array —
Stage 3 adds entries/edges without a format break (`format_version` bumps
only if a field's *meaning* changes). This is the whole graph-forward
requirement; anything more (node positions, edge types) is Stage-3 design.

## Axis 2 — Storage: IDB `plans` store (additive v2 upgrade)

- `db.ts`: `DB_VERSION` 1 → 2; `onupgradeneeded` additionally creates a
  `plans` object store (out-of-line keys, same idiom as `catalog`). The
  upgrade is **purely additive** — the catalog store is untouched, so
  existing users' cached catalog + any future rows survive. A test pins
  the v1→v2 upgrade (seed under v1 shape, reopen, catalog intact).
- **Multi-tab upgrade safety (r1 fold — MAJOR):** the version bump
  first-activates IDB's blocked-upgrade path, and today's `openDb` wires no
  `onblocked`/`onversionchange` — an old tab's v1 connection would leave the
  new tab's open promise unsettled forever (boot hang). Two small handlers
  close it: (a) `req.onblocked` → **reject** with a distinct error, which
  flows through `loadCatalog`'s access-failure catch into the existing
  `unavailable` path — boot lands in the #9 bundled-without-save state (a
  rendered, data-preserving degrade, never a hang; the error's distinct
  message is **diagnostic-only** — loadCatalog's catch collapses all
  open-rejections identically, and nothing branches on it — r2 fold); (b) `db.onversionchange`
  on every opened connection → `close()` + clear the module cache, so an
  old-build tab yields and the upgrading tab proceeds (the standard IDB
  idiom). Test: a stubbed open that fires `onblocked` must land boot in the
  unavailable degrade, not a hang.
- `SatisDb` gains two verbs in the existing idiom: `getAllWithKeys<T>(store)`
  (readonly cursor/getAll+getAllKeys) and `delete(store, key)`. `get`/`put`
  unchanged.
- New module `src/data/plan-store.ts` (mirrors catalog-store's posture):
  `savePlan(plan, id)` (put), `listPlans()` → `{id, name, updatedAt}[]`
  sorted by updatedAt desc (skipping rows that fail a shape check — a
  corrupt row is skipped-and-reported, never a crash), `loadPlan(id)` →
  validated `PlanFileV1 | null` (null on missing/corrupt), `deletePlan(id)`.
  Validation is a small reviver-style shape check (format_version === 1,
  stages array of selection-shaped objects; unknowingly-newer
  `format_version` → treated as corrupt-for-this-build, reported not
  crashed). Two shape-check pins (r1 folds): **`links` must be an empty
  array for format_version 1** — a populated `links` in a v1 file is
  corrupt-for-this-build (reserved means reserved); and **`machineCount`
  accepts `number | null`** — a live selection can legitimately hold `NaN`
  (only derive validates it) and `JSON.stringify(NaN)` emits `null`, so the
  check must accept what save can produce; load coerces `null → NaN` (a
  saved-invalid count loads as the same rendered-invalid state — honest
  round-trip). Plan ids: `crypto.randomUUID()` (DOM lib + node ≥19 — a
  *different* crypto surface than the `crypto.subtle` precedent; its own
  availability is pinned by the first plan-store test that runs).

## Axis 3 — Store surface (5 actions + 2 state fields)

State: `plans: { id: string; name: string; updatedAt: string }[] | null`
(null = not yet listed; refreshed after every mutation) and
`planError: string | null` (transient, mirrors `uploadError`'s posture —
set by a failed plan op, cleared at the next plan op; kept SEPARATE from
`uploadError`, whose semantics are catalog-specific).

**Name identity model (r1 fold, mechanism corrected r2):** names are
`trim()`ed at every entry point; empty-after-trim → rejected with
`planError` ("plan name required"); matching is **case-sensitive exact** on
the trimmed name; and **name uniqueness is an invariant**: `savePlanAs`
preserves it by construction (overwrite the unique holder or create), and
`renamePlan` to a name held by a *different* plan is **rejected** with
`planError` (an operation *refusal* that resolves — distinct from a promise
rejection, which the totality rule forbids). **The name→id lookup in BOTH
actions runs against a fresh
`listPlans()` IDB read at action time — never against `state.plans`** (r2
fold: the in-state list is nullable pre-refresh and can go stale; reading
it would let the null window duplicate an existing name). `state.plans` is
a **display cache only**; every mutation refreshes it after the fact.

**Mutation serialization (r3 fold; totality pinned r4 — the invariant's
real enforcement):** a fresh read alone is not atomic — two
`savePlanAs("A")` calls interleaving across the `await listPlans()`
boundary (an ordinary double-click) would both see no "A" and both create.
So **all plan operations enqueue on a module-level promise chain**
(`planOpChain = planOpChain.then(op)` — a few lines, no new deps), with the
enqueued `op` **total by construction** (r4 fold, both reviewers — the
load-bearing precondition):
- the op is a single async function whose body contains the **entire**
  fresh-`listPlans()` read → decide → write → refresh sequence (a read
  hoisted outside the enqueued body re-opens the r3 window);
- the op **catches its own failure into `planError` inside that body and
  always resolves, never rejects** — the value reassigned to `planOpChain`
  is therefore always a fulfilled promise. (A `.catch` applied to the
  returned-but-not-reassigned promise would satisfy the error-surfacing
  wording while leaving the chain poisoned: one rejection would silently
  skip every future plan op. The catch lives inside; the chain cannot
  poison.)
**Only externally-initiated operations enqueue** (r5 fold — the
re-entrancy pin): the five actions and the App-mount `refreshPlans()` are
chain entry points; an op's own terminal *refresh step* is a **direct
inline `listPlans()` read + `set` within the already-running op body**,
never a re-entrant call to the enqueuing `refreshPlans()` action — a
re-entrant enqueue would await a chained op that cannot start until the
current op resolves (self-deadlock, violating always-resolves). The inline
refresh and the `refreshPlans` action share one module-private
non-enqueuing `doRefresh` helper (r6 fold — kills the two-line duplication
drift); generally, **op bodies are composed of plan-store module primitives
only, never of other store actions** (the r6 dual-name rule: module
`loadPlan`/`savePlan` inside ops; the identically-named store actions are
the enqueuing wrappers).

Under a total, serialized op the induction is genuinely sound: each op
observes the committed result of every prior op; a double-click yields
create-then-overwrite (one row), never a duplicate. (Cross-tab writes
remain out of scope — plans are a single-tab editing surface; the store's
whole session model already assumes it.)

Actions:
- `refreshPlans()` — list into state (errors → `planError`).
- `savePlanAs(name)` — trim/validate the name; serialize the current
  `selection` into a new `PlanFileV1` (or overwrite: if a plan **in the
  fresh `listPlans()` read** already has the name, its id is reused and
  `updatedAt` bumps — **save-by-name-overwrites**, the spreadsheet-familiar
  semantic); refresh.
- `loadPlan(id)` — load + validate; apply `selection` with two guards
  (mirroring every other entry point into the store): **recipeId
  re-validated against the live catalog** (absent → null — the #5 rule) and
  **`unlockedTiers` clamped via `clampTier`** (r1 fold — wholesale apply
  must not bypass the setter/persist clamp invariant; an out-of-range tier
  from an old or hand-edited plan lands clamped, not as a mislabeled
  invalid). Overrides apply verbatim (malformed strings / count excess
  surface through the existing derive/findings paths). Single `derive()`;
  corrupt/missing plan → `planError`, state untouched.
- `renamePlan(id, name)` — trim/validate + uniqueness-check the name; load
  (**the plan-store module `loadPlan`, never the enqueuing store action** —
  the same dual-name rule as the refresh pin), rename, save under the same
  id (updatedAt bumps); refresh.
- `deletePlan(id)` — delete; refresh.

No "current plan"/dirty tracking in Stage 2 — a plan is a snapshot you save
or load, not a live document. (Stage 3's graph editor revisits document
identity; the format doesn't care.)

All plan ops catch into `planError` — the never-crash posture of the
catalog lifecycle, applied symmetrically. Loading a plan never touches the
catalog or `catalogSource`.

## Axis 4 — UI: one PlansBar (thin)

A single `PlansBar` component in the ready-state layout (between the
ControlsStrip and the cards): a name `<input>` + `Save` button; a `<select>`
of saved plans (name + relative date) + `Load` + `Rename` (renames the
selected plan to the current name-input text) + `Delete`; `planError`
renders in the same muted banner idiom as `uploadError`. Presentational
component + App wiring, matching the established split (App remains the
sole store importer). The `plans: null` (not-yet-listed) and `[]` (listed,
none) states render the same "— no saved plans —" placeholder (r1 fold —
App triggers `refreshPlans()` when the ready layout mounts, so `null` is
transient; no loading affordance needed).

## Testing posture (inherited; zero new deps)

- **Store tests (headless, fake-indexeddb real path):** save→list→load
  round-trip restoring the exact selection (fractional clock text "37.5",
  override strings, tiers); save-by-name overwrite (same id, bumped
  updatedAt); rename; **rename-to-collision rejected + empty-name rejected**
  (r1 fold); **null-window uniqueness: savePlanAs overwrites (not
  duplicates) an existing name with `state.plans` still null / never
  refreshed** (r2-fold regression pin); **concurrent double savePlanAs("A")
  (two unawaited calls, then await both) → exactly one row** (r3-fold
  serialization pin); **chain rejection-resilience: an op forced to fail
  (broken IDB for one call) → planError set, and the NEXT op still runs to
  completion** (r4-fold totality pin); delete; corrupt row skipped in list + load-corrupt →
  `planError` with state untouched; dangling recipeId on load → null +
  idle solve; **out-of-range tiers on load → clamped** (r1 fold);
  **machineCount null in file → NaN → rendered invalid** (r1 fold); plan
  ops with broken IDB → `planError`, never a crash; **v1→v2 DB upgrade
  preserving the catalog row**; **onblocked open → unavailable degrade,
  never a hang** (r1 fold).
- **plan-store unit tests:** shape-check accept/reject rows (incl.
  future-format_version); list sorting.
- **Smoke:** PlansBar renders (empty state; populated select; planError
  banner), exact strings.
- Bidirectionality log: `features/plan-save-load/r2-verification.log`
  (created at implementation time — forward reference).

## Implementation dispatch (per the directive)

Opus implementer for the data/store commits (format validation + upgrade
+ lifecycle choreography = design-judgment); sonnet implementer acceptable
for the PlansBar UI commit (mechanical, contract-pinned). Team lead may run
both in one opus dispatch if sequencing is simpler.

## Assumptions ledger

1. `Selection` is wholly JSON-serializable (strings/numbers/null arrays —
   no Fractions) — grounded: `store.ts` Selection interface read this
   session; overrides are capacity *text* by design (Phase 3).
2. Additive IDB version upgrade preserves existing stores — grounded: IDB
   spec semantics (`onupgradeneeded` only creates what's missing; catalog
   store untouched) + pinned by the upgrade test.
3. `crypto.randomUUID` available in the DOM lib + node ≥20 test env —
   grounded: `crypto.subtle` precedent in catalog-store.ts:194 runs in the
   same suites today.
4. Applying `overrides` wholesale on load cannot crash the solve — grounded:
   Phase 3's derive routes malformed strings to `invalid{bad-override}` and
   count-excess to solver findings; both are rendered states, not crashes.
5. `Date`/`new Date()` usage for createdAt/updatedAt is app-side only
   (store actions), not core — no purity implication.

## Revision history

- **r1 correctness (2026-08-03):** code-reviewer NEEDS_REWORK (2 IMPORTANT
  + 1 NIT); adversarial NEEDS_REWORK (1 MAJOR + 3 material + 2 NIT). All
  folded in v2:
  1. **Blocked-upgrade boot-hang (adversarial MAJOR):** openDb gains
     `onblocked` → reject (routes into the #9 `unavailable` degrade — a
     rendered state, never a hang) + `onversionchange` → close + cache
     clear (old tabs yield); test row added.
  2. **Tier clamp on load (both):** loadPlan clamps `unlockedTiers` via
     `clampTier` — wholesale apply no longer bypasses the store invariant.
  3. **Name identity model (both):** trimmed, non-empty, case-sensitive,
     unique-by-invariant; rename-to-collision rejected; overwrite therefore
     deterministic.
  4. **machineCount round-trip (adversarial):** shape check accepts
     `number | null`; load coerces null → NaN (saved-invalid loads
     rendered-invalid).
  5. **links pin (adversarial NIT):** non-empty links in a v1 file =
     corrupt-for-this-build.
  6. **plans null-vs-empty (adversarial NIT):** same placeholder; App
     refreshes on ready-mount.
  7. **randomUUID precedent (code-reviewer NIT):** reworded — different
     crypto surface; availability pinned by its own first test.
- **r2 correctness (2026-08-03):** code-reviewer APPROVED (0); adversarial
  NEEDS_REWORK (1 IMPORTANT + 1 NIT). Folded in v3:
  1. **Uniqueness mechanism (IMPORTANT):** name→id lookups in savePlanAs +
     renamePlan run against a fresh `listPlans()` IDB read at action time,
     never `state.plans` (nullable/stale — the null-window duplicate trace);
     `state.plans` demoted to display cache.
  2. **onblocked error distinctness** marked diagnostic-only (no consumer
     branches on it).
  Refuted clean r2: onblocked→unavailable routing, versionchange deferral,
  clampTier totality, NaN round-trip idempotence.
- **r3 correctness (2026-08-03):** code-reviewer APPROVED_WITH_NITS (2 —
  "listed plan" wording + null-window test row, both folded); adversarial
  NEEDS_REWORK (2 IMPORTANT). Folded in v4:
  1. **Mutation serialization (IMPORTANT):** all plan ops enqueue on a
     module-level promise chain — the fresh read alone was not atomic
     across await interleaving (double-click double-create trace); the
     induction now holds because each op observes every prior op's
     committed result. Cross-tab explicitly out of scope.
  2. **Serialization pin (IMPORTANT):** concurrent double-savePlanAs test
     row added (exactly one row results); the null-window row (from the
     code-reviewer nit, folded in parallel) pins the fresh-read half.
- **r4 correctness (2026-08-03):** both NEEDS_REWORK on ONE shared defect,
  two facets — **op-totality was the chain's unpinned load-bearing
  precondition**. Folded in v5: the enqueued op is total by construction
  (entire read→decide→write→refresh inside the op body; catch-into-planError
  INSIDE the body so the op always resolves — the reassigned chain value is
  always fulfilled, poisoning impossible); rejection-resilience test row
  added (failed op → next op still runs). Refuted clean r4: double-click
  create-then-overwrite; catalog-lifecycle independence (no deadlock;
  loadPlan-during-init coherent); refresh ordering; minimal machinery.
- **r5 correctness (2026-08-03):** code-reviewer APPROVED_WITH_NITS (2
  trivial, folded: status line; refusal-vs-rejection wording); adversarial
  NEEDS_REWORK (1 IMPORTANT + 1 NIT). Folded in v6:
  1. **Refresh re-entrancy pin (IMPORTANT):** only externally-initiated
     operations enqueue; an op's terminal refresh is a direct inline
     listPlans+set — a re-entrant refreshPlans() enqueue would self-deadlock
     (breaks always-resolves).
  2. Dangling log path marked as an implementation-time forward reference.
  Refuted clean r5: both totality facets; sync-throw windows; the
  resilience row's bidirectionality both directions.
- **r6 correctness (2026-08-03):** code-reviewer APPROVED (0) + adversarial
  APPROVED_WITH_NITS (2) — **CONVERGED after 6 rounds.** Nits folded:
  renamePlan's internal load pinned to the plan-store module fn (the r6
  dual-name rule: op bodies compose module primitives, never store
  actions); shared non-enqueuing `doRefresh` helper for the inline +
  action refresh. Refuted clean r6: all six entry points deadlock-free;
  derive/set non-re-entrant; cross-doc consistency end to end.
