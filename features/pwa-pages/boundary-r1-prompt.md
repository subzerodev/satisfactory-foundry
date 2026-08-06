# Boundary review r1 — Stage 18 (#56): PWA + GitHub Pages implementation

Review the CUMULATIVE implementation diff for Stage 18 against its frozen
design contract. Worktree (absolute path, review against THIS tree):
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/pwa-pages`
(branch feature/pwa-pages, 5 commits over develop at 3f7bdb8).

The diff (develop...HEAD) is at:
`/home/subzerodev/workspace/satisfactory-foundry/features/pwa-pages/boundary-r1.diff`
(8520 lines — the bulk is package-lock.json churn and PNG binary stubs;
review those for plausibility, the rest hunk-by-hunk).

## A. Contract anchors

- Frozen contract: `features/pwa-pages/brainstorm.md` (v3 FROZEN 2026-08-06,
  in the worktree). The diff must implement spec items 0-6, no more, no
  less. Spec item 7 (CLAUDE.md/master-plan/.forgejo-ops.toml docs) is
  deliberately absent — the team lead lands it at merge; do NOT flag that.
- Spec item 0: the four `@font-face` src urls become root-absolute
  `url("/fonts/…")`; the stale comment at app.css:1-6 rewritten to describe
  the real mechanism. This also fixes a pre-existing production font 404 at
  base `/`.
- Spec items 1-2: `vite-plugin-pwa@^1.3.0` devDependency; VitePWA plugin
  with registerType 'prompt', the manifest (name "Satisfactory Foundry",
  short_name "Foundry", standalone, theme #24384a, background #ede9dc,
  icons 192 implicit-any + 512 "any maskable"), workbox globPatterns
  covering js/css/html/svg/png/woff2/json/webmanifest and
  maximumFileSizeToCacheInBytes 8 MiB, navigateFallback left default. NO
  `base` in vite.config (CI passes --base).
- Spec item 3: index.html — title "Satisfactory Foundry", root-absolute
  icon/apple-touch/theme-color additions (Vite HTML transform rewrites
  under --base).
- Spec item 4: public/icons/icon.svg — full-bleed OPAQUE vellum field
  (#ede9dc) edge-to-edge, ink (#24384a) manifold glyph inside the inner-80%
  maskable safe zone, single accent (#c25a1d); pwa-192/pwa-512/
  apple-touch-icon(180) PNGs committed; scripts/generate-icons.sh a minimal
  rsvg-convert recorder (no ceremony).
- Spec item 5: UpdateToast via useRegisterSW from
  'virtual:pwa-register/react', "REVISION AVAILABLE" + "RELOAD", rendered
  from App.tsx, styled with existing tokens (both themes), offlineReady
  produces NO UI. Types via src/vite-env.d.ts.
- Spec item 6: .github/workflows/deploy-pages.yml — push:main +
  workflow_dispatch, permissions contents:read/pages:write/id-token:write,
  owner guard `if: github.repository_owner == 'subzerodev'` on every job,
  checkout → setup-node(LTS,npm cache) → npm ci →
  `npm run build -- --base=/satisfactory-foundry/` → configure-pages →
  upload-pages-artifact(dist) → deploy-pages, consistent current majors,
  concurrency group.

## B. Claims to verify

1. Every hunk against the contract — flag scope creep, retained dead code,
   settled-decision violations (e.g. a `base` sneaking into vite.config, a
   maskable-512 PNG, autoUpdate semantics, share-link anything).
2. Implementer claims: 764/764 tests green + `npm run check` clean in the
   worktree (re-run both yourself if you have shell); the vitest fallback
   was NOT needed (plugin active during tests). Verify no test files were
   modified or deleted.
3. Icon SVG correctness: actually opaque full-bleed (no transparent
   background), glyph within the safe zone, colors match the identity
   tokens, PNG sizes as declared (the committed PNGs should match a fresh
   rsvg-convert of the SVG in dimensions; spot-check bytes exist and are
   plausible PNG sizes).
4. Workflow file: would it deploy correctly on GitHub AND stay inert on the
   Forgejo origin (owner guard on ALL jobs)? Any pinned-action-version
   inconsistency or missing permission?
5. UpdateToast: no render-loop/setState hazards; toast only appears on
   needRefresh; RELOAD calls updateServiceWorker(true); no UI for
   offlineReady; accessible (button semantics); styles present for BOTH
   themes (check the DWG dark-theme token overrides in app.css).
6. No new unit tests were added (spec says none warranted) — confirm no
   bidirectionality log is required. Confirm dist/ is not committed and
   .gitignore still covers it.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings.
