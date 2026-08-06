# Stage 18 — Packaging: PWA + GitHub Pages (brainstorm + spec)

**Ticket:** #56 · **Milestone:** 89 (Stage 18) · **Status:** v3 FROZEN 2026-08-06
(design r1: fold incl. the pre-existing font-404 discovery · r2: APPROVED +
APPROVED · simplify: 2 NITs folded · r3 on the fold delta: APPROVED_WITH_NITS
(1, folded: opaque edge-to-edge icon note) + APPROVED — all reviews degraded:
same-vendor, all-Claude roster per user directive)
**Tier:** 2 (single feature, full gate per ticket)

## Purpose

Anyone without tech skills can use the app: it is hosted as a static site on
GitHub Pages (the "install" is clicking a link), the browser offers "Install
app" (PWA), it gets an icon and its own window, and it works fully offline
after the first visit.

## Already settled — do NOT re-litigate

- **PWA + Pages is in scope** (Michael 2026-08-05, ticket #56 body) — it
  supersedes the old sharing/PWA exclusion for the PWA half only.
- **"Share plan as a link" stays OUT** (URL-encoded plans / paste-bin backend).
  File export/import remains the sharing mechanism.
- **Mirror push policy** (Michael at pickup, 2026-08-06, decision on #56):
  the GitHub repo `subzerodev/satisfactory-foundry` is a deploy-only mirror,
  pushed ONLY on Michael's explicit approval to update Pages. Forgejo stays
  the source of truth for all branches, board, CI. The remote is configured
  HTTPS+broker (`github` remote, already added) — never SSH.

## Ground truth (verified this session)

- App is a fully static client-side SPA: React 19 + Vite 8.2, no backend,
  IndexedDB persistence, bundled catalog fetched at runtime.
- **Catalog fetch is BASE_URL-aware**: `src/ui/App.tsx:37-43` fetches
  `${import.meta.env.BASE_URL}bundled-docs/en-US.json` + `provenance.json`.
- **Fonts are NOT base-safe — pre-existing production bug** (adversarial r1
  IMPORTANT, empirically confirmed this session): the `@font-face` `src`
  declarations at `src/ui/app.css:12,19,26,33` use CSS-relative
  `url("./fonts/…")`. `src/ui/fonts/` does not exist, so Vite cannot resolve
  the asset at build time and emits the URL untouched into
  `dist/assets/index-HASH.css` — where it resolves to `<base>assets/fonts/…`
  at runtime while the files are served at `<base>fonts/…`. **Today's
  production build at base `/` already 404s all four fonts** (dev works only
  because injected styles resolve against the page URL; every prior walk used
  the dev server). The comment at `app.css:1-6` asserting "BASE_URL-relative"
  is wrong. Fix verified empirically: root-absolute `url("/fonts/…")` is
  base-rewritten by Vite — a `--base=/satisfactory-foundry/` build emits
  `url(/satisfactory-foundry/fonts/…)`.
- Runtime payload: `public/bundled-docs/en-US.json` **5.3 MB**,
  `provenance.json` 292 B, 4 woff2 fonts ~15 KB each (~72 KB).
- `vite.config.ts` is minimal (react plugin + vitest node env); **no `base`
  set**. `index.html` is the Vite default (title `satisfactory-foundry`, no
  icons, no manifest).
- No `.github/` or `.forgejo/` workflow dirs exist yet.
- Drawing-identity tokens (VELLUM, the default sheet): `--bg: #ede9dc`,
  `--fg: #24384a` (ink), `--accent: #c25a1d` (`src/ui/app.css:43-55`).
- `vite-plugin-pwa` **1.3.0 (2026-05-05) adds Vite 8 to peerDependencies**
  (`^3.1.0 || … || ^8.0.0`) — shipped in the v1.3.0 release via PR
  [vite-pwa/vite-plugin-pwa#924](https://github.com/vite-pwa/vite-plugin-pwa/pull/924)
  (requested in [#923](https://github.com/vite-pwa/vite-plugin-pwa/issues/923));
  registry peer string verified by both r1 reviewers.
- Vite's documented GitHub Pages idiom ([static-deploy guide](https://vite.dev/guide/static-deploy.html)):
  project page served at `https://<user>.github.io/<repo>/` with
  `base: '/<repo>/'`; deploy via Actions (`configure-pages` →
  `upload-pages-artifact` of `dist/` → `deploy-pages`), permissions
  `contents: read, pages: write, id-token: write`, trigger on push to the
  default branch.
- Rasterizer available locally: `rsvg-convert` (also imagemagick).

## Decision axes

### Axis 1 — Deploy mechanism

Options: (a) Actions workflow on the mirror builds from source and deploys
Pages; (b) build locally, push a `gh-pages` branch; (c) commit `dist/` to main.

**Pick (a)** — the Vite-documented idiom. It composes exactly with the
push-on-approval policy: *approval → `git push github main` → Actions builds →
Pages updates*. No build artifacts in git; the mirror carries only source.
(b)/(c) put generated output under version control and add a second push
surface — rejected.

### Axis 2 — Vite `base`

Options: (a) hardcode `base: '/satisfactory-foundry/'` in `vite.config.ts`;
(b) pass `--base=/satisfactory-foundry/` only in the CI build; (c) env-var
conditional in the config.

**Pick (b)** — repo config stays untouched, local dev/preview keeps serving at
`/` (the walk pattern, launch.json, and every doc that says
`localhost:5173/` keep working). The CI build step runs
`npm run build -- --base=/satisfactory-foundry/`. `vite-plugin-pwa` derives
the SW scope, `start_url`, and precache URLs from the *resolved* config base,
so the flag flows through the whole PWA layer. (c) is (b) with an extra
moving part — rejected on parsimony.

### Axis 3 — Service worker: plugin vs hand-rolled

Options: (a) `vite-plugin-pwa` (Workbox generateSW); (b) hand-rolled SW.

**Pick (a)**. The hard part of a static-app SW is precaching *hashed* build
assets — Workbox generates that manifest at build time; a hand-rolled SW
would re-implement it badly (stale-hash bugs are the classic failure).
Community idiom, one devDependency, version `^1.3.0` (Vite 8 peer support
verified above). Parsimony ladder: this is the "take the dependency" rung —
the alternative is more code, not less.

### Axis 4 — What is precached (offline scope)

**Pick: everything the app needs — app shell + fonts + the bundled catalog.**
`globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,webmanifest}']` and
`maximumFileSizeToCacheInBytes` raised to 8 MiB (Workbox's 2 MiB default
would silently skip the 5.3 MB `en-US.json`, breaking the "fully offline"
acceptance criterion). Total precache ≈ 7 MB — a one-time cost on first
visit, acceptable for guaranteed offline.

### Axis 5 — Update story

Options: (a) `registerType: 'autoUpdate'` (silent); (b) `'prompt'` + an
in-app "update available" affordance.

**Pick (b)** — the ticket names "an update-available story (the changelog
idiom fits)". A small drawing-identity toast: **`REVISION AVAILABLE`** with a
`RELOAD` action, driven by `useRegisterSW` from
`virtual:pwa-register/react`. Silent auto-update would fight the changelog
idiom (Michael tells the app's story per revision; the user should choose the
moment). `offlineReady` produces no UI (avoid first-visit noise).

### Axis 6 — Manifest + icons

- Manifest: `name: "Satisfactory Foundry"`, `short_name: "Foundry"`,
  `display: "standalone"`, `theme_color: #24384a` (ink),
  `background_color: #ede9dc` (vellum sheet), description in the app's voice.
- Icons: one **source SVG drawn in the drawing identity** — ink manifold
  glyph (bus + drop symbols) on a full-bleed vellum field with the single
  orange accent, reading as a drafting stamp — **authored with the glyph
  inside the maskable safe zone** (inner 80%) and **an opaque background
  edge-to-edge (no transparent margin)** — the dual-purpose declaration is
  correct ONLY because the field is full-bleed opaque; a transparent-padded
  icon would render as a shrunken glyph in "any" contexts (the exact web.dev
  caution) — so ONE set of rasters serves both purposes: `pwa-192.png`, `pwa-512.png` (declared
  `purpose: "any maskable"`), `apple-touch-icon.png` (180). No separate
  maskable variant (simplify r1); if the crop genuinely diverges at
  authoring time, the implementer may split it — noted, not expected.
  Rasterized once via a minimal `scripts/generate-icons.sh` (a plain
  `rsvg-convert` recorder for regen provenance — no idempotency/PASS-FAIL
  scaffolding; simplify r1); PNGs committed (no rasterizer needed in CI).
  `index.html` gains the real title ("Satisfactory Foundry"),
  `<link rel="icon">` (SVG), apple-touch-icon, and `theme-color` meta.

### Axis 7 — Workflow file placement + Forgejo interference

The workflow lands in-repo at `.github/workflows/deploy-pages.yml` (merged to
`develop` → `main` via the normal flow, so the approved mirror push carries
it). Guard every job with `if: github.repository_owner == 'subzerodev'` — if
Forgejo Actions is ever enabled on the origin (owner `sudohworks`), the job
skips instead of failing on GitHub-only actions. Trigger: `push` to `main` +
`workflow_dispatch`.

## Spec (file-by-file)

0. **`src/ui/app.css`** — change the four `@font-face` `src` URLs
   (`:12,19,26,33`) from `url("./fonts/…")` to root-absolute
   `url("/fonts/…")` (Vite base-rewrites root-absolute public-asset
   references in emitted CSS — verified empirically this session), and
   correct the stale comment at `:1-6` to describe the real mechanism. This
   also fixes the pre-existing font 404 in production builds at base `/`.
1. **`package.json`** — add devDependency `vite-plugin-pwa@^1.3.0`.
2. **`vite.config.ts`** — add `VitePWA({ registerType: 'prompt', manifest: …,
   workbox: { globPatterns, maximumFileSizeToCacheInBytes: 8 MiB } })` per
   Axes 3–6. No `base` in config (Axis 2).
3. **`index.html`** — title "Satisfactory Foundry"; icon links + theme-color
   meta (BASE_URL-relative via Vite's HTML transform, i.e. plain `/…` hrefs
   that Vite rewrites under `--base`).
4. **`public/icons/`** — `icon.svg` (source, hand-authored, glyph in the
   maskable safe zone), `pwa-192.png`, `pwa-512.png` (dual-purpose
   `any maskable`), `apple-touch-icon.png` (generated, committed).
   **`scripts/generate-icons.sh`** — a minimal rsvg-convert recorder
   (provenance for regeneration; no ceremony).
5. **`src/ui/UpdateToast.tsx`** (+ styles in `app.css`) — `useRegisterSW`
   prompt toast, `REVISION AVAILABLE` / `RELOAD`, drawing identity, rendered
   from `App.tsx`. TS types via `vite-plugin-pwa/react` client reference.
6. **`.github/workflows/deploy-pages.yml`** — Vite's documented Pages
   workflow (checkout → setup-node LTS+npm cache → `npm ci` →
   `npm run build -- --base=/satisfactory-foundry/` → configure-pages →
   upload-pages-artifact(`dist`) → deploy-pages), permissions
   `contents: read, pages: write, id-token: write`, owner guard (Axis 7).
7. **Docs** — `CLAUDE.md`: mirror-remote deviation note (push-on-approval,
   HTTPS+broker, deploy runbook one-liner). `docs/master-plan.md`: Stage 18
   section. `.forgejo-ops.toml`: stage 18 entry. Changelog entry at merge.

## Explicitly out of scope

- Share-plan-as-link (standing exclusion).
- Custom domain, analytics, install-promotion UI beyond the browser's own.
- Forgejo-side CI for the deploy (mirror-only concern).
- Pushing anything to the mirror within this arc — the first push is a
  **separate, explicitly-approved step** after merge.

## Test + verification plan

Config/build-output feature — **no new unit tests** (nothing here is a pure
function; the bidirectionality rule does not fire). Verification is
build-level and walk-level:

- `npm test` (764) + `npm run check` stay green (UpdateToast must typecheck;
  vitest shares vite.config so the plugin must not break node-env tests —
  implementer verifies this drift-hunt point explicitly).
- **Walk (local):** `npm run build -- --base=/satisfactory-foundry/` +
  `vite preview` — assert: manifest served + parsed, SW registers, Cache
  Storage precache contains `en-US.json` + fonts + hashed assets; catalog
  loads under the subpath; **the identity typefaces actually render and no
  `fonts/*.woff2` request 404s under `/satisfactory-foundry/`** (precache
  globs pass by filename, so only a real load assertion catches a wrong
  `@font-face` URL — adversarial r1); then rebuild with a trivial change →
  reload → `REVISION AVAILABLE` toast appears → RELOAD activates the new SW.
  **Walk hygiene:** unregister the SW + clear Cache Storage between walk
  iterations (or use a fresh browser context) — a stale SW from a prior
  iteration can keep controlling the page and make the update-toast
  assertion untrustworthy (adversarial r1). Plus the standard dev-server
  walk for visual/theme checks of the toast.
- **navigateFallback:** left at the plugin default (`index.html`). The app
  has no client-side router (verified: no react-router/history usage in
  `src/`), so there are no deep routes — no Pages 404 shim is needed.
- **Live (post-approval, user-gated):** after Michael approves
  `git push github main` and sets the repo's Pages source to "GitHub
  Actions": site loads at `https://subzerodev.github.io/satisfactory-foundry/`,
  installable, airplane-mode reload works. Acceptance box 1 of the ticket can
  only be ticked here.

## Assumptions ledger

- `vite-plugin-pwa@^1.3.0` works against Vite 8.2 — grounded:
  [#923](https://github.com/vite-pwa/vite-plugin-pwa/issues/923) added
  `^8.0.0` peer support in 1.3.0.
- The catalog fetch needs no code changes for subpath serving — grounded:
  `App.tsx:37-43` is BASE_URL-relative (read this session). The fonts DO need
  the spec-item-0 fix — grounded empirically: `--base` builds of both the
  current CSS (emits broken `./fonts/…`) and the root-absolute fix (emits
  `url(/satisfactory-foundry/fonts/…)`) were run and inspected this session.
- Workbox default file-size cap would exclude the 5.3 MB catalog — grounded:
  measured `du` this session; Workbox `maximumFileSizeToCacheInBytes`
  documented default 2 MiB.
- GitHub Pages will serve from Actions on the mirror — assumption: Michael
  (repo owner) enables Pages "GitHub Actions" source in repo settings; named
  as an explicit user step in the walk plan.
- Vitest (node env, shared vite.config) tolerates the VitePWA plugin —
  **unverified until implementation**; flagged as the implementer's first
  drift-hunt check, with fallback (exclude plugin under `mode === 'test'`)
  named in advance.

## Revision history

- v1 (2026-08-06): initial merged brainstorm+spec.
- v2 (2026-08-06): design r1 fold. code-reviewer APPROVED_WITH_NITS (4),
  adversarial-reviewer NEEDS_REWORK (1 IMPORTANT + 3 NIT) — both degraded:
  same-vendor.
  - **FOLDED (IMPORTANT, adversarial):** fonts mischaracterized as
    BASE_URL-relative — real mechanism is unresolvable CSS-relative
    `url("./fonts/…")` emitted verbatim, a pre-existing production 404 even
    at base `/`. Team lead reproduced both the bug and the root-absolute fix
    with instrumented `--base` builds before folding. New spec item 0.
  - **FOLDED (NIT, adversarial):** walk now asserts fonts render + no woff2
    404 (precache-contains is not a load assertion).
  - **FOLDED (NIT, adversarial):** walk hygiene — clear SW/Cache Storage
    between iterations.
  - **FOLDED (NIT, both):** citations tightened — `App.tsx:37-43`,
    `app.css:12,19,26,33`, vite-plugin-pwa Vite 8 support cited to the
    v1.3.0 release / PR #924 (not the #923 request).
  - **FOLDED (NIT, code-reviewer):** navigateFallback note added — plugin
    default, no router, no Pages 404 shim.
  - **REJECTED (NIT, code-reviewer):** "provenance.json is materially larger
    than 292 B" — counter-evidence: `ls -la public/bundled-docs/` this
    session shows exactly 292 bytes. The stated figure stands.
- v3 (2026-08-06): simplify-pass fold (one-shot, post-convergence).
  claude-simplify-reviewer APPROVED_WITH_NITS (2) — degraded: same-vendor.
  - **FOLDED (NIT 1):** separate `maskable-512.png` dropped — the source SVG
    is authored with the glyph inside the maskable safe zone and the 512 is
    declared `purpose: "any maskable"`; three PNGs instead of four. Escape
    hatch recorded if the crop genuinely diverges at authoring time.
  - **FOLDED (NIT 2):** `generate-icons.sh` reduced to a minimal
    rsvg-convert recorder (regen provenance) — idempotency/PASS-FAIL
    ceremony dropped; it is a build-time-once authoring artifact, not an
    operational script.
  - All other candidates the lens weighed (CI-only --base, full precache,
    prompt update story, owner guard, plugin-over-hand-rolled, fonts fix)
    were found already-minimal — no change.
