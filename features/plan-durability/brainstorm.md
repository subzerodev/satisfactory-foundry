# Stage 19 — Plan durability: persist() + export-all (brainstorm + spec)

**Ticket:** #92 · **Milestone:** 90 (Stage 19) · **Status:** v3 FROZEN 2026-08-06
(design r1: NEEDS_REWORK+APPROVED_WITH_NITS, IMPORTANT duplicate-name pin
folded · r2: APPROVED+APPROVED · simplify: 1 NIT folded · r3 on the fold
delta: APPROVED+APPROVED — all reviews degraded: same-vendor, all-Claude
roster per user directive)
**Tier:** 2 (single feature, full gate)

## Purpose

Kill the two realistic ways a saved plan dies: browser storage eviction
(request persistent storage so the browser never auto-evicts the origin) and
device loss (one-click export of EVERY plan into a single re-importable
backup file).

## Already settled — do NOT re-litigate

- **Michael's pick (decision on #92, 2026-08-06):** options 1+2 —
  `navigator.storage.persist()` + export-all bundle. Reminder nudge (3) and
  FS-Access auto-backup (4) rejected; backend (5) excluded by standing rule.
- No new ambient UI beyond one button (the nudge rejection binds).
- Import must not auto-load a plan (existing importPlan comment: "saving ≠
  switching the working graph") — bundles inherit that.

## Ground truth (verified this session)

- `src/state/store.ts:1707-1711` — `exportPlan(id)` = loadPlanFile →
  `JSON.stringify(plan, null, 2)`, null on missing/corrupt.
- `src/state/store.ts:1713-1770` — `importPlan(text)`: enqueue-serialized;
  JSON.parse → `validatePlanFile` (refuses foreign/corrupt, nothing
  written) → name trim + refuse-empty → collision by trimmed name
  (overwrite keeps prior createdAt, stamps updatedAt; new row gets
  `crypto.randomUUID()`, createdAt now) → `doRefresh()`; does NOT
  auto-load; failures set `planError` strings ("import failed: not valid
  JSON" / "not a valid plan file" / "plan name required").
- `src/data/plan-store.ts` — versioned per-plan file shape, save writes
  latest (`PlanFileV5`), read accepts v1–v5 via migrations;
  `listPlans()` returns metas; store plan ops are serialized via `enqueue`
  (Axis-3 atomicity comment at store.ts:972).
- `src/ui/PlansBar.tsx:4-15` — props incl. `onExport(id)`,
  `onImport(file)`; button row at :64-93 (SAVE/LOAD/RENAME/EXPORT/DELETE);
  hidden file input at :108.
- `src/ui/App.tsx:112-121` — `downloadTextFile` helper (Blob → anchor);
  `:260-266` — export handler names files
  `${sanitizeFilename(name)}.foundry-plan.json`.
- Vitest node env with `fake-indexeddb`; store.test.ts exercises
  import/export semantics already.
- `navigator.storage.persist()` — Storage API; on Chromium an INSTALLED PWA
  gets persistence granted without a prompt, plain tabs may be judged on
  site-engagement; Firefox may show a permission prompt; Safari grants
  silently based on heuristics. Returns Promise<boolean>. Absent on old
  browsers/insecure contexts → must feature-detect.

## Decision axes

### Axis 1 — Where persist() is called

Options: (a) App boot effect (UI layer, fire-and-forget); (b) inside
`db.ts` openDb; (c) a store action.

**Pick (a).** It's a browser-environment request, not data logic — the same
layering as theme (App-level, store-free). `db.ts` stays pure IDB plumbing
(and is exercised under fake-indexeddb where `navigator.storage` may not
exist); the store never touches browser chrome APIs. Shape: one
`useEffect(() => { void requestPersistence() }, [])` in App calling a tiny
exported helper with feature-detect (`navigator.storage?.persist`). Result
handling: `console.info` the granted/denied boolean — no UI (the rejected
nudge binds; a denied result changes nothing the user can act on here).

### Axis 2 — Bundle file shape

Options: (a) a distinct bundle envelope carrying per-plan file objects;
(b) an array of plan files; (c) zip of individual files.

**Pick (a):**
```json
{ "kind": "foundry-plan-bundle", "format_version": 1,
  "exportedAt": "<ISO>", "plans": [ <per-plan file object>, … ] }
```
Each `plans[]` entry is EXACTLY the existing per-plan file shape (latest v5
as written by exportPlan's source). Import revives each entry through the
SAME `validatePlanFile` path — so a bundle written today stays importable
by future builds exactly as long as single files do (one migration
surface, no second format to version beyond the envelope). (b) has no
sniffable identity and no room for versioning; (c) drags in a zip
dependency for kilobytes of JSON — both rejected. A distinct `kind` string
makes single-vs-bundle sniffing exact, and `format_version` on the
envelope reserves bundle evolution.

### Axis 3 — Import path

Options: (a) extend `importPlan(text)` to sniff bundle-vs-single;
(b) a separate `importBundle` action + second file input.

**Pick (a).** One user-facing IMPORT affordance stays one affordance
(PlansBar's existing file input, zero UI change on the import side). Sniff:
parsed object with `kind === "foundry-plan-bundle"` → bundle arm; anything
else → the existing single-file arm untouched (a per-plan file has no
`kind` field, so the sniff cannot misfire). Bundle arm semantics, mirroring
the single path per entry: validate each entry with `validatePlanFile`;
apply the SAME name-trim/refuse-empty and collision-overwrite rules,
refactored into a shared per-plan helper. The whole loop runs inside ONE
enqueue slot — **serialized w.r.t. other plan ops** (each entry is still
its own IDB `put` transaction; a mid-loop I/O error leaves prior entries
committed, no rollback — the skip-invalid policy covers the expected
validation-failure path). Does NOT auto-load; one `doRefresh()` at the end.

**Within-bundle duplicate names (PINNED — design r1 IMPORTANT):** the
per-plan helper MUST resolve collisions against a per-entry-fresh view —
either re-reading `listPlanFiles()` after each awaited save (the existing
single-path behavior) or threading the running name→id map through the
loop. Two entries with the same trimmed name therefore resolve
deterministically **last-entry-wins into ONE row** (the second entry sees
the first's committed row and overwrites it). Hoisting one
`listPlanFiles()` read above the loop is FORBIDDEN — it would let
same-named entries each miss the match and create duplicate rows,
breaking the by-construction name-uniqueness invariant (store.ts:972-974,
1558-1560). Test-enforced (spec item 5).

**Per-entry failure policy:** skip invalid entries, import the valid ones,
and report via `planError`: `"imported N of M plans (K invalid skipped)"`
only when K>0; a bundle with ZERO valid entries errors
("import failed: no valid plans in bundle"). Rationale: a backup file is a
recovery artifact — refusing 30 good plans over 1 corrupt entry defeats
its purpose; silently dropping entries is worse. Empty `plans: []` bundle
→ the zero-valid error. Wording note (design r1): this **extends the
error channel to carry a partial-success caveat** — `planError` today is
failures-only and its banner renders `var(--error)` red — mirroring
`uploadError`'s established precedent for exactly this shape
("catalog loaded but could not be cached: …", store.ts:1097/1189). A
partial recovery message showing in the red banner is the accepted,
precedented behavior.

### Axis 4 — Export-all UI + filename

One button in PlansBar's row: `EXPORT ALL` (drawing-identity idiom, same
plain `<button>` styling as its siblings), enabled whenever ≥1 plan exists
(disabled empty-list state matches the row's existing disabled idiom),
independent of the active-plan selection. **Rejected simpler shape
(simplify r1):** composing existing `exportPlan(id)` calls in an App-side
loop (~6 lines, zero new store surface) — rejected because `exportPlan`
is deliberately no-enqueue, so N calls across await boundaries can
interleave with a concurrent save and produce a TORN multi-plan snapshot;
a backup file must be a consistent point-in-time read. Hence the new
store action `exportAllPlans(): Promise<string | null>` (null when no
plans) —
list + load every plan inside one enqueue slot (a DELIBERATE divergence
from exportPlan's documented no-enqueue posture, store.ts:1705: a bundle
snapshot wants a consistent multi-row read; the implementation comments
this divergence), envelope per Axis 2, `JSON.stringify(…, null, 2)`. App
wires it to `downloadTextFile` with filename
`foundry-plans-<YYYY-MM-DD>.foundry-plans.json` (date from the export
moment; the `.foundry-plans.json` double extension is the machine/import
signal, the prefix is the human Downloads-sorting signal — the token
repetition is accepted as serving two audiences; design r1 NIT
rejected-with-rationale).

## Spec (file-by-file)

1. **`src/ui/persistence.ts`** (new, ~15 lines) — `requestPersistence()`:
   defensive feature-detect
   `typeof navigator !== "undefined" && navigator.storage?.persist`
   (safe to call from ANY env, including node), call it, `console.info`
   the outcome, swallow rejections (never throws); returns
   Promise<boolean> (false when unsupported).
2. **`src/ui/App.tsx`** — one boot `useEffect` calling it (fire-and-forget);
   export-all handler (store call → `downloadTextFile` with the Axis-4
   name); pass `onExportAll` to PlansBar.
3. **`src/state/store.ts`** — `exportAllPlans()` action (Axis 4);
   `importPlan` gains the bundle sniff + bundle arm (Axis 3), with the
   per-plan save logic factored into one helper used by both arms
   (behavior of the single arm UNCHANGED, byte-for-byte error strings).
4. **`src/ui/PlansBar.tsx`** — `EXPORT ALL` button + `onExportAll` prop.
5. **Tests** (store.test.ts additions; fake-indexeddb):
   - export-all round-trip: save 2 plans → exportAllPlans → wipe →
     importPlan(bundle) → both back, names/graphs intact, no auto-load.
   - envelope shape: kind/format_version/exportedAt/plans length.
   - collision: bundle entry matching an existing name overwrites, keeps
     prior createdAt.
   - within-bundle duplicate names (PINNED case): two entries, same
     trimmed name → exactly ONE row survives with the LAST entry's
     content; total plan count proves no duplicate row.
   - per-entry skip: bundle of [valid, corrupt, valid] → 2 imported,
     planError reports "imported 2 of 3".
   - zero-valid bundle + empty bundle → error, nothing written.
   - single-file imports (existing tests) untouched and still green.
   **Bidirectionality log required** (`features/plan-durability/`
   `r2-verification.log`): per new behavior, a genuine vitest FAIL with the
   production code broken, then restore + green.
6. **Docs at merge (team lead):** master-plan Stage 19 section,
   `.forgejo-ops.toml` stage entry, changelog entry, completion note.

## Explicitly out of scope

- Any persistence-state UI, reminder nudges (rejected option 3).
- FS-Access auto-backup (rejected option 4), any backend (excluded 5).
- Changing the per-plan file format (bundle wraps it, never alters it).
- Auto-loading imported plans; changing single-file import behavior.
- The live Pages deploy — rides the NEXT approved mirror push.

## Test + verification plan

- Unit tests per spec item 5 with the bidirectionality log.
- `npm test` + `npm run check` green in worktree AND on trunk after
  worktree removal.
- **Walk:** dev-server — save two plans, EXPORT ALL downloads the bundle,
  wipe site data, re-import restores both (list only, no graph switch);
  invalid-entry bundle shows the partial-import message; persist():
  `navigator.storage.persisted()` before/after boot in the preview browser
  (grant is environment-dependent — assert the call happens and the
  boolean logs, not that every browser grants).

## Assumptions ledger

- Store plan ops are enqueue-serialized so a bundle import is atomic
  w.r.t. concurrent saves — grounded: store.ts:972 Axis-3 comment + all
  plan actions route through `enqueue` (read this session).
- `validatePlanFile` accepts v1–v5 per-plan objects and refuses foreign
  payloads — grounded: importPlan uses exactly it today
  (store.ts:1728-1732) and plan-store documents the migration ladder.
- `navigator.storage.persist()` exists in all target browsers but must be
  feature-detected — grounded: Storage API baseline. Tests are unaffected
  primarily because the node-env suites never mount App and so never CALL
  the helper (design r1 correction — the feature-detect is defense in
  depth, not the immunity mechanism).
- PWA-install grants persistence silently on Chromium — grounded: Chromium
  storage documentation idiom; the design does not DEPEND on a grant (the
  bundle covers denial).

## Revision history

- v1 (2026-08-06): initial merged brainstorm+spec.
- v2 (2026-08-06): design r1 fold. code-reviewer NEEDS_REWORK (1 IMPORTANT
  + 2 NIT), adversarial-reviewer APPROVED_WITH_NITS (2 NIT + 1 note) —
  both degraded: same-vendor.
  - **FOLDED (IMPORTANT, code-reviewer):** within-bundle duplicate-name
    behavior PINNED — per-entry-fresh collision view, last-entry-wins
    into one row, listPlanFiles-hoist forbidden; dedicated test family
    added. (Adversarial independently confirmed the same mechanism.)
  - **FOLDED (NIT, code-reviewer):** "atomically" corrected to
    "serialized w.r.t. other plan ops; no mid-loop rollback".
  - **REJECTED (NIT, code-reviewer):** filename token repetition
    (`foundry-plans-<date>.foundry-plans.json`) — rationale recorded in
    Axis 4: extension is the machine signal, prefix the human signal.
  - **FOLDED (NIT, adversarial):** test-immunity rationale corrected
    (suites never call the helper; feature-detect is defense in depth) +
    defensive `typeof navigator` guard specified.
  - **FOLDED (NIT, adversarial):** partial-success message wording — the
    design now names it an extension of the error channel mirroring
    uploadError's precedent, red banner accepted.
  - **FOLDED (note, adversarial):** exportAllPlans's enqueue divergence
    from exportPlan's no-enqueue posture made explicit + must be
    commented in the implementation.
- v3 (2026-08-06): simplify-pass fold (one-shot, post-convergence).
  claude-simplify-reviewer APPROVED_WITH_NITS (1) — degraded: same-vendor.
  - **FOLDED (NIT-1):** Axis 4 now names the rejected compose-in-App
    alternative (loop exportPlan, zero store surface) and why it loses:
    no-enqueue exportPlan calls can interleave with a concurrent save →
    torn snapshot. The exportAllPlans action stands. Doc-only fold; no
    contract change.
  - All other weighed items (envelope fields, persistence.ts module,
    shared helper, message shape, 7 test families) confirmed
    already-minimal — no change.
