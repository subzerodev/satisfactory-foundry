# #144 — A refreshed bundled catalog reaches existing users

**Tier 2 · brainstorm+spec (merged, lean).** Design substance dual-reviewed as
gap-report W4 (`features/game-mechanics-audit/gap-report.md` @ `ae266b1`);
fix shape approved by Michael (#140 comment 24744; ticket #144). This spec
pins implementation choices only.

## Already settled — do NOT re-litigate

- The defect: cache staleness keys solely on `parser_version`
  (`src/data/catalog-store.ts:199-201`); `init()` takes the cache unconditionally on
  `hit` (`src/state/store.ts:1317-1324`); `source_hash` is write-only; no `steamBuild`
  comparison exists. Shipping a refreshed `en-US.json` therefore never
  reaches existing users without a hand-bump of `CATALOG_PARSER_VERSION` —
  the recorded `isRawResource` scar (`src/data/catalog-store.ts:31-36`) as a live trap.
- The fix shape: compare the boot-fetched `provenance.steamBuild` against the
  cached row's `source.steamBuild`; a difference is treated as stale and
  self-heals (#144).
- **A user-uploaded catalog is never evicted** — upload-beats-bundle stands
  (#144 ticket constraint).
- Lands ahead of the #140 arc, standalone (#140 comment 24744).
- The bundle refresh itself (re-running `update-bundled-docs.mjs`) is the
  ticket's follow-up step, gated on this mechanism landing first.

## Purpose

Make a shipped bundle refresh reach users who already have a cached bundled
catalog, without touching user uploads and without breaking offline boots.

## Design

### D1 — where the comparison lives: `init()`, on the bundled-hit path only

`loadCatalog()` (storage layer) stays network-free — the comparison belongs
in `store.ts init()`, which already owns the bundled-provider fallback.

New flow inside `init()` after `loadCatalog()` returns `hit`:

- `source.kind === "user"` → **unchanged**: cache wins, no fetch, no
  comparison. (The never-evict constraint, by construction.)
- `source.kind === "bundled"` → fetch the provenance sidecar ONLY
  (`${base}bundled-docs/provenance.json`, ~200 bytes — NOT the 5.3 MB
  `en-US.json`) and compare `steamBuild`:
  - fetch fails / non-OK / malformed → **keep the hit** (offline PWA boot,
    dev server without the asset — degrading to today's behaviour, never
    eviction);
  - `steamBuild` equal → keep the hit;
  - `steamBuild` differs → run a bundled refresh. **This is an EXTRACTION,
    not a fall-through** (design-review r1 correction): the existing non-hit
    branch's tail is coupled to `result.status` and the `unavailable` flag —
    on failure it sets `needs-upload{reason: result.status}`
    (`src/state/store.ts:1390-1397`), which for a hit would produce the invalid
    `needs-upload{"hit"}` and exactly the no-catalog degradation this path
    must never take. Instead, extract the bundled load+parse+save sequence
    (`src/state/store.ts:1340-1388` — through the parse-failure `catch { ready = false }`
    and the closing of the `if (bundled !== null)` block, since that catch is
    what drives the parameterized fallback) into a helper parameterized by
    its FAILURE fallback:
      - called from the non-hit path → fallback = today's needs-upload tail
        (behaviour unchanged);
      - called from the stale-bundled-hit path → fallback = **leave the
        already-set ready state untouched** (under D1b's set-first ordering,
        ready fired on the cached catalog before the refresh ran — the
        failure path simply does nothing; save still fires only on a
        successful refresh parse).

    The helper also takes the `unavailable` flag (declared OUTSIDE the
    extracted range, `src/state/store.ts:1339`) — its success path forks on it
    (no-save+note vs save, `src/state/store.ts:1361-1383`). The hit caller always
    passes `false`, so its successful refresh always saves; the non-hit
    caller passes its real flag, behaviour unchanged (design-review r2
    precision fold).

### D1b — ordering: set-first, refresh in the background (r2 IMPORTANT fold)

The hit path's `set(ready)` on the CACHED catalog fires FIRST, exactly as
today — the fast path never gains a network wait, and offline/slow-network
boots are indistinguishable from current behaviour (acceptance criterion 3
by construction).

**Promise boundary, pinned (r3 fold):** `init()` RESOLVES after
`deriveAllStages` (`src/state/store.ts:1403`), exactly as today — the provenance check
+ possible refresh run as a **DETACHED continuation** (a `void`-ed async
chain started by `init()` but not awaited by it). This is what makes the
trio consistent: tests `await init()` throughout the suite
(`store.test.ts:236,873,1017,…`), the ordering-pin test uses a
never-resolving provenance stub, and neither may hang. The detached chain
must swallow its own errors (nothing propagates to an unhandled rejection).
Harness note: the never-resolving stub leaks a pending promise across
tests unless the provenance provider is reset in the same `beforeEach` that
resets the docs provider (`store.test.ts:226` pattern) — required. The
`pendingBundledRefresh` binding is reset there too (same leak-hygiene
argument: a user-hit test would otherwise leave a prior test's never-settling
promise in place), and so is `catalogSaveQueue` (`= Promise.resolve()`) —
per-link totality rules out poisoning and every enqueue is awaited before
its action returns, so the reset is hygiene rather than correctness, but
resetting all three module-level bindings in one place keeps the reasoning
uniform (r5 code-review NIT fold).

**Never-evict guard, pinned (r3 fold — the upload race):** the detached
refresh runs while the UI is live, so a user can upload DURING the refresh
window. `uploadDocsText` writes `{kind:"user"}` to memory and to the single
IDB row (`src/state/store.ts:1460,1468`); an unguarded late-completing refresh would
clobber both with bundled data — violating the hard constraint. Therefore,
immediately before the refresh applies its `set` + `saveCatalog`, it
re-checks the CURRENT state: `get().catalogSource?.kind === "bundled"` —
anything else (user upload landed, or state changed in any way) → discard
the refresh silently, no set, no save. The check happens after the parse,
at apply time, in the same microtask as the set — no window between check
and apply beyond synchronous store semantics.

**The guard alone is NOT sufficient (r4 BLOCKER fold): the save-vs-save
race.** `saveCatalog` is async (`src/data/catalog-store.ts:162-176`: await
points at sha256Hex, openDb, db.put) writing one last-writer-wins IDB row.
Sequence: refresh guard passes → refresh `set(bundled)` → refresh save
suspends → upload runs fully (`set(user)` + its own save) → the refresh's
suspended `db.put` lands LAST → IDB holds bundled while memory holds user;
next boot loses the upload. Fix: **one module-level save queue** in
`store.ts` — `catalogSaveQueue = catalogSaveQueue.then(() => saveCatalog(…))`
— through which BOTH the refresh's save and `uploadDocsText`'s save
(`src/state/store.ts:1468`) are routed (the non-hit init save too, for uniformity).
Serialization makes row-write order equal set order, and the last set on
any interleaving is the user's: if the upload sets before the refresh's
guard, the guard discards the refresh; if after, the upload's save is
enqueued after the refresh's and wins the row. Queue failures keep the
existing per-caller error handling (each link catches its own).

On a build mismatch the refresh applies like a live upload does
(`uploadDocsText`, `src/state/store.ts:1406-1450`, the existing replace-while-ready
precedent): a second `set` with the new catalog + a `deriveAllStages`
re-derive + the save. **The re-derive is therefore NOT inside the extracted
helper** (whose range `1340-1388` contains set+save but no derive — the
only in-init derive is at `:1403`, which under set-first ran on the OLD
catalog): the stale-hit caller's success APPLY is its own step, mirroring
`uploadDocsText:1444-1462` — one `set()` carrying the new catalog AND the
`deriveAllStages` projection, then `saveCatalog`. Equivalently: the helper
is parameterized by its success-apply as well as its failure fallback; the
non-hit caller's apply is today's bare set (init's `:1403` derive follows
it), the hit caller's apply is the upload-shaped set+derive. (r3
code-review fold — without this the refresh would leave stages solved
against the old catalog.)

**Test observability of the detached refresh (r3 code-review fold):** the
detached chain's promise is retained on the provider-seam module (e.g.
`pendingBundledRefresh(): Promise<void> | null`, set by `init()` when it
detaches, cleared on settle) so the "differs" / upload-race tests can
`await` it deterministically instead of polling. Production code never
awaits it; it exists for the harness, beside the two provider seams.

Visible consequence, stated honestly: on the ONE boot
after a bundle refresh, the app is briefly ready on the old data and then
re-renders on the new — the same UX class as an upload replacing a live
catalog. A stale-interaction window of one fetch+parse exists on that boot
only; every subsequent boot compares equal and never re-renders.

### D2 — the lightweight provenance fetch

A new small helper alongside the provider seam: `bundledProvenanceProvider`
(settable like `setBundledDocsProvider`, defaulting to a fetch of
`provenance.json` mirroring the shape already parsed in `src/ui/App.tsx:48-58`).
Rationale: `bundledDocsProvider` fetches BOTH files (`src/ui/App.tsx:42-45`) —
using it for the comparison would download 5.3 MB on every boot for every
bundled-catalog user, which is exactly what the cache exists to avoid. Tests
inject a stub provider, same pattern as the existing seam
(`src/state/store.ts:1188-1192`).

### D3 — what does NOT change

- `loadCatalog()` / `CacheLoadResult` — untouched. Staleness-by-parser-version
  stays; this adds a second, independent trigger at the init layer.
- The `unavailable` carve-out (`src/state/store.ts:1329-1338`) — untouched; a refresh
  save only happens through the existing hit→refresh path where IDB reads
  succeeded.
- `saveCatalog` — untouched (the refresh path already saves with the new
  bundled source).
- `App.tsx`'s own provenance fetch for the banner — untouched (it renders
  from `catalogSource`, which the refresh path updates).
- No UI change: the banner already re-renders from `catalogSource`.

### D4 — behaviour changes, stated

1. A user on cached bundle N boots while bundle N+1 is served → one-time
   ~5.3 MB re-fetch + re-parse + save, then ready on N+1. Subsequent boots:
   provenance-only fetch, equal, no cost.
2. Every bundled-catalog boot now performs one ~200-byte conditional fetch
   it did not perform before. Offline (PWA): the service worker serves the
   precached `provenance.json`, which matches the precached `en-US.json`
   because Workbox `generateSW` installs the revisioned precache manifest as
   a unit and `registerType: 'prompt'` defers activation — within one
   activated SW generation the pair cannot skew (`vite.config.ts:16` for the
   registerType; `:35-40` for the workbox precache block; generateSW is the
   plugin default, no `strategies` override exists).
   A hard-offline fetch failure keeps the hit.
3. User-upload users: zero change, zero new fetches.

### Tests

New tests (store-level, stubbed providers, fake IDB — existing harness):

- bundled hit + provenance equal → ready from cache, no docs fetch (assert
  the docs provider was NOT called).
- bundled hit + provenance differs → ready on the new parse, `saveCatalog`
  row updated (assert new `source.steamBuild`).
- bundled hit + provenance fetch fails → ready from cache (no eviction).
- bundled hit + provenance differs + docs provider fails → **ready from the
  CACHED catalog** (the D1 fallback), not the degraded no-catalog state.
- user hit → provenance provider NOT called (assert stub uncalled).
- **ordering pin (D1b):** with a provenance stub that NEVER resolves, a
  bundled hit still reaches `ready` on the cached catalog — proving the
  fast path is not gated on the fetch. (`await init()` must return; pins
  the detached-continuation boundary.)
- **upload-race pin (D1b guard):** bundled hit + provenance differs, with
  the docs-provider stub gated so the refresh completes only AFTER a
  `uploadDocsText` lands during the window → the user catalog survives in
  BOTH memory (`catalogSource.kind === "user"`) and the IDB row; the
  refresh's set and save never fire.
- **save-serialization pin (r4 BLOCKER):** the refresh passes its guard and
  applies (set bundled), then an upload lands while the refresh's save is
  in flight → after both settle (`await pendingBundledRefresh()` + the
  upload), the IDB row's `source.kind === "user"` — the queue makes the
  upload's write land last on every interleaving.

Deletion sweep (per the new memory rule): no existing test asserts the
absence of a provenance fetch on hit, and no string this diff deletes is
asserted anywhere — the init changes are additive branches. Existing init
tests (`store.test.ts` hit-path cases) must stay green; any that stub
`loadCatalog` to a bundled hit will now need the provenance stub wired —
enumerated at implementation time against the actual failures, expected
shape: add the stub to the harness defaults (equal-build), which preserves
every existing test's behaviour. NOTE the load-bearing coincidence: the
equal-build default works because the whole suite uses ONE build constant
(`BUNDLED_PROVENANCE.steamBuild = "23855724"`, `store.test.ts:201-202`) — a
future test introducing a second build would silently trip the refresh path
under the default stub; the harness comment must say so.

## Acceptance criteria

1. Bundled-cache user + refreshed bundle served → next boot lands on the new
   build without any version bump.
2. User-uploaded catalog: never evicted, no new network calls.
3. Offline PWA boot with a bundled cache: still boots ready (no eviction).
4. Refresh-path failure falls back to the cached catalog, never to
   no-catalog.
5. `npm test` + `npm run check` green.

## Assumptions ledger

- `provenance.json` is served alongside `en-US.json` and precached by the
  PWA — grounded: `src/ui/App.tsx:44` fetches it today; the workbox glob includes
  `json` (`vite.config.ts` globPatterns).
- The bundled row's `source.steamBuild` is populated — grounded: the
  non-hit path saves it (source built at `src/state/store.ts:1351-1355`, saveCatalog call at `src/state/store.ts:1375`); legacy bundled rows predating
  `source` are backfilled `{kind:"user"}` (`src/data/catalog-store.ts:206-209`) and
  therefore (conservatively, correctly) never auto-refresh.
- A steamBuild MISMATCH in either direction means "the served bundle is the
  truth" — grounded: the bundle ships with the app version the user is
  running; there is no downgrade hazard distinct from the app itself being
  rolled back, in which case matching the served bundle is still right.

## Revision history

- **r1 → r2** (design review r1, code-reviewer NEEDS_REWORK: 1 IMPORTANT +
  1 NIT, both verified against source and folded): (1) IMPORTANT — D1's
  "fall through to the existing non-hit path" understated the change: that
  branch's failure tail sets `needs-upload{reason: result.status}`
  (store.ts:1390-1397), which for a hit yields the invalid
  `needs-upload{"hit"}` and the forbidden no-catalog degradation. D1 now
  specifies an EXTRACTION of the bundled load+parse+save sequence
  parameterized by failure fallback. (2) NIT — the Tests note now names the
  single-build-constant coincidence that makes the equal-build harness
  default safe, and requires a harness comment. Also verified sound by the
  reviewer: Workbox precache atomicity (new provenance + old docs cannot
  co-occur), the second-seam justification, the never-evict guard, and the
  D3 App.tsx claim. Adversarial verdict pending at time of fold.
- **r2 (adversarial r1 folded in):** adversarial-reviewer APPROVED_WITH_NITS
  — its NIT 1 (the fall-through phrasing) was the same finding as the
  code-reviewer's IMPORTANT, already folded above; NIT 2 folded: D4.2 now
  grounds the offline no-skew claim in its mechanism (Workbox generateSW
  revisioned precache installs as a unit; prompt-type registration defers
  activation) instead of asserting "by construction". Its never-evict walk,
  deletion-sweep check (store2 reboot at store.test.ts:887 is the one
  affected test, equal-build default keeps it green), and unavailable-path
  non-interaction all survived refutation and are recorded sound. r2 goes to
  both correctness reviewers.
- **r2 → r3** (design review r2: code-reviewer APPROVED_WITH_NITS — both
  citation nits folded (extraction endpoint 1383→1388; vite.config
  registerType line 16 + generateSW-default note); adversarial-reviewer
  NEEDS_REWORK — 1 IMPORTANT + 3 NITs, all folded). The IMPORTANT: refresh
  ordering/latency was unspecified, and the two orderings differ observably.
  New D1b pins SET-FIRST: ready on the cached catalog exactly as today (fast
  path gains no network wait; offline unchanged), provenance check + refresh
  in the background, applying like the existing uploadDocsText live-replace
  precedent (second set + re-derive + save), with the one-boot content swap
  stated honestly. New ordering-pin test: a never-resolving provenance stub
  must not block ready. NITs: helper explicitly takes the unavailable flag
  (hit caller passes false); App.tsx citations prefixed src/ui/; the
  saveCatalog call line (:1375) added. r3 goes to both correctness reviewers.
- **r3 → r4** (design review r3, adversarial-reviewer NEEDS_REWORK: 2
  IMPORTANT + 1 NIT, all folded; code-reviewer r3 verdict pending at fold
  time): (1) IMPORTANT — the upload race: the detached refresh could clobber
  a user catalog uploaded during the refresh window; D1b now pins an
  apply-time guard (current catalogSource.kind must still be "bundled", else
  silent discard) + a dedicated upload-race test. (2) IMPORTANT — init()'s
  promise boundary was contradictory with the never-resolving-stub test;
  D1b now pins init() resolving after deriveAllStages with the refresh as a
  DETACHED, error-swallowing continuation, + the harness beforeEach reset
  requirement. (3) NIT — D1's hit-path failure fallback reworded from
  "set(ready) on the cached catalog" to "leave the already-set ready state
  untouched" (set-first made the old wording describe a redundant set).
- **r4 amended (code-reviewer r3 folded in):** code-reviewer r3 NEEDS_REWORK
  — 2 IMPORTANT + 2 NITs. IMPORTANT 1 (detach + test synchronization): the
  detach half was already pinned by the adversarial fold; the NEW half is
  folded — the detached promise is retained on the provider-seam module
  (`pendingBundledRefresh()`) so tests await it deterministically.
  IMPORTANT 2 (missing re-derive): folded — the helper is parameterized by
  success-apply too; the hit caller's apply is the uploadDocsText-shaped
  set+deriveAllStages, then save. NIT (redundant fallback wording) was
  already folded; NIT (catalog-store.ts path prefixes) folded. Its 1(c)
  verification (via two nested verifiers) confirmed D1/D1b are consistent
  in substance. r4 goes to both correctness reviewers.
- **r4 → r5** (design review r4, code-reviewer NEEDS_REWORK: 1 BLOCKER +
  1 NIT, folded; nested-verifier confirmed the race against source): the
  apply-time guard protected the set but not the async save tail —
  saveCatalog's last-writer-wins db.put could land after an upload's,
  evicting the upload from IDB across a reboot. D1b now adds a module-level
  catalogSaveQueue serializing ALL catalog saves (refresh, uploadDocsText,
  non-hit init), making row-write order equal set order, so the user's set
  always wins the row; plus a save-serialization test pin. NIT: source-built
  citation corrected to :1351-1355. Adversarial r4 verdict pending at fold
  time. r5 goes to both correctness reviewers.
- **r5 amended (adversarial r4 folded in):** adversarial-reviewer r4
  APPROVED_WITH_NITS — it reviewed the on-disk r5 content, independently
  re-derived the save race (real, reachable, non-self-healing: the 5.3 MB
  hash makes the refresh's db.put land last), and verified the
  catalogSaveQueue fold sound (set-and-enqueue share a microtask in both
  callers; per-link catch prevents queue poisoning, mirroring planOpChain).
  Its two NITs folded: pendingBundledRefresh reset added to the harness
  beforeEach note; all bare store.ts citations prefixed src/state/. It also
  cleared the double-init hazard (init is module-load, main.tsx:6, not
  effect-driven). r5 needs only the CODE-REVIEWER's re-verdict (the
  adversarial verdict above IS its r5 verdict).
- **r5 final (code-reviewer r5 APPROVED_WITH_NITS):** the BLOCKER verified
  closed on all three interleavings (the third — an upload wedging between
  the refresh's set and enqueue — proven impossible: no await between them);
  per-link totality + closure-over-args verified against the planOpChain
  precedent. Its one NIT folded: catalogSaveQueue added to the harness
  beforeEach reset list with the hygiene-not-correctness rationale.
  Correctness gate CONVERGED at r5 (adversarial r4-on-r5-content AWN +
  code-reviewer r5 AWN, all findings dispositioned).
- **r5 simplify pass (one-shot, APPROVED_WITH_NITS):** the accreted shape
  judged load-bearing, not over-hardened — await-first refuted from source
  (render tree mounts parallel to init, main.tsx:6 + App.tsx:191, so the
  upload window exists under ANY ordering; the version that closes it costs
  a 5.3 MB fast-path block). Guard and queue proven non-subsumable (memory
  projection vs row-write order). NIT dispositions: (1) vitest waitFor in
  place of the pendingBundledRefresh seam — REJECTED with rationale: the
  save-serialization pin needs settle-ordering, where a polling predicate
  is racier than awaiting the retained promise, and the seam is idiomatic
  beside the two existing provider seams; (2) save-queue-as-planOpChain
  idiom — noted, no change (already cited). DESIGN FROZEN at r5.
