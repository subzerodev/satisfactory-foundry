# Stage 18 completion — PWA + GitHub Pages (#56)

**Merged:** 2026-08-06, `b745bf6` (feature/pwa-pages → develop, --no-ff,
5 commits). 764/764 tests, `npm run check` clean.

## What landed

- **Fonts fix (pre-existing production bug):** the four `@font-face` urls
  were CSS-relative `url("./fonts/…")` — unresolvable at build, emitted
  verbatim into hashed CSS, 404 at ANY base. Now root-absolute `/fonts/…`,
  base-rewritten by Vite. Found by the adversarial design reviewer (r1
  IMPORTANT), reproduced empirically before folding.
- **PWA layer:** `vite-plugin-pwa@^1.3.0` — prompt-mode SW, manifest
  (Satisfactory Foundry / Foundry, standalone, ink/vellum colors), Workbox
  precache with 8 MiB cap (the 5.3 MB catalog precaches; fully offline
  after first visit), `UpdateToast` (REVISION AVAILABLE / RELOAD) via
  `useRegisterSW`; offlineReady silent.
- **Icons:** hand-authored drafting-stamp `icon.svg` (opaque vellum field,
  ink manifold glyph in the maskable safe zone, single accent) + 3 PNGs
  (192 / 512 `any maskable` / apple-touch-180) via a minimal
  `scripts/generate-icons.sh` recorder.
- **Deploy:** `.github/workflows/deploy-pages.yml` — Vite's documented
  Pages workflow, `--base=/satisfactory-foundry/` build, owner-guarded
  (`github.repository_owner == 'subzerodev'`) so it is inert on Forgejo.
- **Mirror policy:** `github` remote (HTTPS+broker), push ONLY on explicit
  approval, `main` only. Recorded in CLAUDE.md + decision audit on #56.

## What the reviewers caught

- Design r1 (adversarial, IMPORTANT): the font-404 bug + the walk gap that
  would have missed it (precache-contains is not a load assertion).
- Design simplify: dropped the separate maskable PNG (dual-purpose 512),
  stripped icon-script ceremony. r3 fold-check added the opaque
  edge-to-edge icon requirement.
- Boundary r1 + diff-simplify: zero findings; adversarial independently
  re-ran tests and inspected the icon rasters.
- One code-reviewer nit REJECTED with counter-evidence (provenance.json is
  exactly 292 B).

## Walk evidence (subpath preview, `vite preview --base=/satisfactory-foundry/`)

- App + catalog render under `/satisfactory-foundry/`; SW activated,
  scope correct; 15 precache entries incl. `en-US.json` + 4 woff2.
- Fonts served from SW cache (`transferSize: 0`, ~1 ms) — the offline
  path, live. Icons 200. No toast without an update.
- Update cycle: probe rebuild → reload → REVISION AVAILABLE toast (both
  themes, screenshots) → RELOAD → new SW controlling, probe title live.
- `vite preview` gotcha for future walks: it does NOT read the build's
  base — pass `--base=/satisfactory-foundry/` to preview too, or every
  asset falls into the SPA fallback.

## Acceptance criteria

- [x] Installable PWA; fully offline after first visit (walk-verified
  locally; final install check on the live URL)
- [x] Full gate at pickup (design r1-r3, boundary, simplify ×2, walk)
- [ ] **App live on GitHub Pages — awaiting Michael:** approve
  `git push github main` + set the mirror repo's Pages source to
  "GitHub Actions". Ticket #56 stays open until the live URL loads.
