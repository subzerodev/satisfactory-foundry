# Bundled default catalog — brainstorm (ticket #9, Tier 2)

Date: 2026-08-03
Status: v2+r2 — FROZEN (correctness converged r2 APPROVED_WITH_NITS ×2, all
nits folded; simplify APPROVED 0 findings). Tier-2: this document is the
binding implementation contract (no separate spec/plan).
Inputs: decision #8 (posture: bundled default, upload overrides) + #9 decision
(snapshot source: Michael's install file, Steam build 23855724); live contracts
`src/state/store.ts`, `src/data/catalog-store.ts` (@ develop e9bedb6).

## Already settled — do NOT re-litigate

1. **Posture: bundled default catalog** with a provenance banner; upload still
   overrides (#8 decision; hosted fetch + picker declined).
2. **Snapshot source: the user's own install file** (Steam build 23855724,
   validated through the production parser: 195 items / 20 machines / 290
   recipes, exact rates); community mirror = documented fallback (#9 decision).
3. All Stage-1 frozen contracts: store lifecycle unions, override clear rules,
   IDB identity `satis_foundry`, exactness end-to-end, UI thin-testing posture
   (no jsdom), core purity.

## Axis 1 — What gets bundled: raw Docs.json vs pre-parsed catalog

**Pick: the raw file, re-encoded UTF-8, served as a static asset.**

- The bundled path becomes *literally the upload path minus the file picker*:
  fetch asset → `parseCatalogFromText` → `saveCatalog` cache. Zero new
  serialization formats, zero generation-time parsing that could drift from
  runtime parsing, exactness automatic (same decimal-string extraction).
- A pre-parsed bundle would need the `catalog-store` serializer promoted to a
  build artifact + its own versioning story — real machinery to save ~4 MB of
  asset weight in a locally-served tool. Rejected as gold-plating.
- Re-encoding UTF-16→UTF-8 at snapshot time halves the bytes (10.6 → ~5.3 MB)
  and lets the boot path skip `decodeBytes` (fetch + `.text()` is UTF-8).
  The upload path keeps `decodeBytes` unchanged.
- Asset location: `public/bundled-docs/en-US.json` + sidecar
  `public/bundled-docs/provenance.json` (`{ source, steamBuild, extractedAt,
  items, recipes }`). `public/` passes through Vite untouched (no bundling
  cost, cache-friendly), fetched at runtime via
  `` `${import.meta.env.BASE_URL}bundled-docs/en-US.json` `` (r1 fold —
  document-relative would break under a subpath deploy; BASE_URL is exact
  in dev and build).

## Axis 2 — Boot precedence + store changes (minimal shape)

Current `init()`: `loadCatalog()` → `hit` → ready; `empty`/`stale` →
needs-upload. New `init()`:

1. `loadCatalog()` `hit` → ready (**cache wins** — a user's uploaded catalog,
   or a previously-cached bundled one, never regresses).
2. `empty` / `stale` → **bundled fallback + SAVE**: fetch the asset +
   provenance, `parseCatalogFromText`, → ready + `saveCatalog` (same
   never-block save as upload: save failure ⇒ usable-this-session +
   `uploadError` note). These rows are absent (`empty`) or genuinely unusable
   (`stale`), so replacing them with bundled data is safe.
2b. `unavailable` → **bundled fallback WITHOUT save** (boundary r1 fold):
   an IDB *access* failure means the cache row may be a valid, possibly newer
   user catalog we merely couldn't READ — and because `openDb` is memoized, a
   `db.get` rejection leaves a healthy connection through which a save would
   *destructively* clobber that row. So the unavailable path runs bundled but
   does **NOT** call `saveCatalog` (usable this session, cache untouched) and
   sets a **distinct** note: `cached data couldn't be read this session —
   using bundled data`. See `CacheLoadResult`'s `unavailable` variant.
3. Bundled fetch/parse failure (asset missing, corrupt) → **degrade to v1
   behavior**: `needs-upload` with the existing reason. Never a crash, never
   a worse outcome than today. **The provider call itself is try/caught**
   (r1 fold): a *rejected* promise (thrown `fetch`) degrades identically to
   a resolved `null` — both are the same degrade path. On the `unavailable`
   path the degrade maps to `needs-upload{stale}` — the frozen UI reason union
   (`empty` / `stale` / `upload-error`) is untouched, so `unavailable` never
   leaks into it.

State addition (one field, not a union change):
`catalogSource: { kind: "user" } | { kind: "bundled"; steamBuild: string;
extractedAt: string } | null` — set by init (bundled path), by upload
(`user`), and **persisted in the cache row** so a reboot's `hit` still knows
what it's showing. That persistence requires **three coordinated changes**
(r1 fold — naming one alone would silently drop the banner after the first
reboot):
1. `StoredCatalog` gains the optional `source` field, and
   `saveCatalog(text, catalog, source?)` gains an **optional** parameter
   defaulting to `{ kind: "user" }` — the four existing 2-arg call sites
   (both test suites) keep compiling unchanged (r2 fold);
   `uploadDocsText`'s save at `store.ts:344` passes `{ kind: "user" }`
   explicitly (the "upload flips source" write — r2 fold);
2. `CacheLoadResult`'s `hit` variant carries `source` alongside `catalog`;
3. `loadCatalog` reads `stored.source ?? { kind: "user" }` — the
   legacy-row default lives in **loadCatalog, not the reviver** (the reviver
   never touches row-level fields; that is exactly why the addition is
   transparent to it).
`CATALOG_PARSER_VERSION` stays 1 (additive row field, outside the reviver's
validation surface — reviewer-verified r1).

Injection seam for headless tests (mirrors the Phase 3 `storageProvider`
pattern): a module-level `bundledDocsProvider: () => Promise<{ text: string;
provenance: Provenance } | null>` — the app wires fetch; tests inject fixture
text or null (null ⇒ degrade path). The provider resolves
`{ text, provenance }` **as a unit** — a provenance-fetch failure collapses
the whole result to null (whole-degrade; no half-loaded banner state — r2
fold).

## Axis 3 — UI surface (small)

- **UploadScreen is no longer the first-boot screen** (it remains the
  degrade path + upload-error screen, unchanged).
- Header banner when `catalogSource.kind === "bundled"`:
  `bundled game data · Steam build 23855724 (2026-04-30) — upload your own
  Docs.json if your game is newer` (values from provenance, not hardcoded).
  Renders as one line beside the existing header re-upload input; disappears
  once the user uploads (`source` becomes `user`).
- No other component changes. `initializing` now covers the bundled fetch
  (~5 MB local asset, imperceptible).

## Axis 4 — Snapshot refresh workflow

`scripts/update-bundled-docs.mjs` (node, no deps): reads a Docs file path
(default: the Steam install path, overridable arg), decodes via **importing
the shared `decodeBytes` from `src/ui/decode.ts`** (r1 fold — the earlier
"must stay browser-only" duplication rationale was factually wrong: no lint
rule scopes beyond `src/core`, and `decodeBytes` is pure
TextDecoder/Uint8Array, node-safe; node type-stripping runs it directly,
proven this session), validates by running `parseCatalogFromText`, writes
the UTF-8 asset **without a BOM** (r1 fold — `JSON.parse` rejects a leading
BOM and `fetch().text()` does not strip one) + the provenance sidecar
(steamBuild read from the Steam appmanifest when resolvable, else an
explicit `--build` arg; extractedAt = run date; item/recipe counts
recorded). Run manually after game patches; documented in the script header
+ README-level note in the provenance file itself.

## Testing posture (inherited, zero new deps)

- Store tests (headless, existing suite file): bundled-fallback matrix —
  empty→bundled-ready(+cached+source persisted), stale→bundled-ready,
  hit-beats-bundled, provider-null→needs-upload degrade, provider-REJECTS→
  same degrade, bundled parse failure→degrade, **bundled-ready-but-save-
  failed** (usable this session + `uploadError` note — the never-block
  mirror; r1 fold), upload flips source to `user`.
- `catalog-store` test: `source` round-trip + legacy row (no source) revives
  as `user`.
- Smoke test: banner renders from a bundled `catalogSource`, absent for
  `user`.
- Script: validated by running it against the real install file (its own
  parse-validate step is the test); not unit-tested (node tooling, one
  consumer, manual runbook).
- Bidirectionality log per the R2 rule: `features/bundled-catalog/r2-verification.log`.

## Assumptions ledger

1. Store/init + cache contracts as read this session (`store.ts:278-290`,
   `catalog-store.ts:51-99`) — grounded.
2. The user's Docs file parses clean through the production parser —
   grounded: validated this session (195/20/290, exact rates).
3. `public/` assets fetch at runtime untouched by Vite — grounded: Vite
   static-asset contract (public directory copied verbatim to dist root).
4. Additive optional `source` on the stored row survives the existing
   reviver without a version bump — **grounded r1: both reviewers verified**
   the reviver validates only `StoredCatalogData` (items/machines/recipes),
   never row-level fields; the `?? user` legacy default lives in
   `loadCatalog`.
5. Node type-stripping runs our TS in the refresh script — grounded: done
   this session (node v26, `erasableSyntaxOnly` config).

## Revision history

- **r1 (2026-08-03):** code-reviewer NEEDS_REWORK (1 IMPORTANT + 3 NIT);
  adversarial APPROVED_WITH_NITS (2 NIT + 1 spec-pin). Folded in v2:
  (1) source persistence spelled as the three coordinated changes
  (saveCatalog param, hit-carries-source, loadCatalog default) — the
  IMPORTANT banner-vanishes-on-reboot gap; (2) legacy default placed in
  loadCatalog; (3) save-failed + provider-rejects rows added to the test
  matrix; (4) asset written BOM-less; (5) script imports the shared
  decodeBytes (duplication premise was false); (6) fetch URL pinned to
  BASE_URL form. Attacks refuted (recorded): override-clear moot at boot
  (nothing persisted to clear); init choreography race-free; source field
  transparent to the reviver (no version bump); catalogSource orthogonal to
  the frozen CatalogState union.
- **r2 (2026-08-03):** code-reviewer APPROVED_WITH_NITS (1) + adversarial
  APPROVED_WITH_NITS (2) — CONVERGED. Folded: saveCatalog `source?` pinned
  optional-defaulting-user (four 2-arg callers unchanged); the
  uploadDocsText explicit `user` write named in the change list; provider
  unit-degrade wording (provenance failure ⇒ whole-null). Refuted clean:
  decode.ts has zero imports (node-safe end to end); .mjs→.ts import
  outside tsc's purview; import.meta.env isolated behind the seam.
- **Boundary amendment (2026-08-03, boundary r1 fold — adversarial IMPORTANT):**
  the implemented diff's boundary review found a real **destructive-overwrite /
  data-loss defect**. Root cause: `loadCatalog`'s first try/catch **conflated
  three distinct causes** — an IDB access failure (openDb/get rejection), an
  absent row, and a corrupted/version-stale row — collapsing them all into
  `stale`. init() then ran `empty`/`stale` → bundled + **SAVE**; because
  `openDb` is memoized, a `db.get`-failure sub-case left a *healthy* connection,
  so `saveCatalog`'s `put` SUCCEEDED and **overwrote a valid, possibly newer
  user-uploaded catalog with older bundled data** — permanent silent data loss,
  a regression vs v1 (whose stale screen was non-destructive), contradicting
  "never a worse outcome than today". Amendment: (1) `CacheLoadResult` gains an
  **`unavailable`** variant — IDB access failure → `unavailable`; absent →
  `empty`; version mismatch / reviver failure → `stale`. (2) init's
  `unavailable` path runs **bundled WITHOUT `saveCatalog`** (usable this
  session, the user's row left intact) and sets the distinct note `cached data
  couldn't be read this session — using bundled data`; `empty`/`stale` keep the
  bundled + save semantics unchanged. (3) On the `unavailable` path a provider
  degrade maps to **`needs-upload{stale}`** — the frozen UI reason union is
  untouched. (4) A **data-preservation proof test** (seed a user IRON row into a
  healthy IDB → break IDB → boot with a COPPER bundled provider → assert
  bundled-ready + the couldn't-read note → restore the healthy IDB → assert the
  next boot HITs the intact IRON user row, no copper) proves no overwrite
  end-to-end.
