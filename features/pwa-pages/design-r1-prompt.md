# Design review r1 — Stage 18 (#56): PWA + GitHub Pages

Review the merged brainstorm+spec at
`/home/subzerodev/workspace/satisfactory-foundry/features/pwa-pages/brainstorm.md`
against the live repo at `/home/subzerodev/workspace/satisfactory-foundry`
(branch `develop`, clean tree).

## A. Current-state anchors (verify against live source)

- `src/ui/App.tsx:38-42` — catalog fetch is `import.meta.env.BASE_URL`-relative.
- `src/ui/app.css:1-70` — fonts BASE_URL-relative; drawing-identity tokens
  (`--bg #ede9dc`, `--fg #24384a`, `--accent #c25a1d`).
- `vite.config.ts` — react plugin + vitest `environment: 'node'`, NO `base`.
  Vitest shares this config file (`/// <reference types="vitest/config" />`).
- `index.html` — Vite default: title `satisfactory-foundry`, no icons/manifest.
- `package.json` — vite ^8.2.0, no PWA tooling; scripts `build`, `check`
  (`tsc -b && eslint . && prettier --check src`), `test` (vitest run).
- `public/bundled-docs/en-US.json` is 5.3 MB; `public/fonts/` 4 woff2 files.
- No `.github/` or `.forgejo/` directories exist.
- Standing decisions on ticket #56 (audit trail): mirror
  `subzerodev/satisfactory-foundry` is deploy-only, pushed ONLY on explicit
  approval; Forgejo stays source of truth; remote is HTTPS+broker.
  Share-plan-as-link remains excluded.

## B. Claims / design choices to verify

1. **External claims:** vite-plugin-pwa 1.3.0 adds Vite 8 peer support
   (vite-pwa/vite-plugin-pwa#923); Vite's documented Pages deploy is the
   Actions workflow (configure-pages → upload-pages-artifact → deploy-pages,
   permissions contents:read/pages:write/id-token:write); Workbox
   generateSW's default `maximumFileSizeToCacheInBytes` is 2 MiB (which would
   silently skip the 5.3 MB catalog).
2. **Axis picks:** CI-only `--base=/satisfactory-foundry/` flag (repo config
   untouched) vs hardcoded base — is the pick sound, and does vite-plugin-pwa
   really derive scope/start_url/precache URLs from the resolved base when it
   comes from the CLI flag? Prompt-based update (`registerType: 'prompt'`,
   `useRegisterSW` from `virtual:pwa-register/react`) vs autoUpdate.
   Full-precache (~7 MB incl. catalog) vs runtime caching for the catalog.
   Owner-guard (`if: github.repository_owner == 'subzerodev'`) as Forgejo
   Actions interference protection.
3. **Completeness:** does the spec cover everything the ticket's acceptance
   criteria need (installable, fully offline after first visit, live on
   Pages)? Is anything missing — e.g. SPA-fallback/404 handling on Pages,
   iOS/apple-touch specifics, `start_url`/`scope` under a subpath, the
   navigateFallback story for a single-page app, stale-SW pitfalls with
   `vite preview` walks?
4. **Test plan honesty:** the spec claims no unit tests are warranted
   (config/build-output feature; bidirectionality rule does not fire) and
   substitutes build+walk verification incl. a local preview SW/update-toast
   walk and a post-approval live check. Is that defensible, or is there a
   genuinely unit-testable seam being dodged?
5. **Scope discipline:** nothing in the spec re-opens settled exclusions
   (share-as-link) or violates the push-on-approval mirror policy (no push
   happens inside the arc).

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged (BLOCKER / IMPORTANT / NIT), line-cited
findings.
