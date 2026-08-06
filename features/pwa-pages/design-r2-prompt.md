# Design review r2 — Stage 18 (#56): PWA + GitHub Pages (brainstorm v2)

Review the REVISED merged brainstorm+spec at
`/home/subzerodev/workspace/satisfactory-foundry/features/pwa-pages/brainstorm.md`
(v2) against the live repo at `/home/subzerodev/workspace/satisfactory-foundry`
(branch `develop`; only `features/pwa-pages/` is untracked).

This is round 2. Round 1 (both reviewers, degraded same-vendor) produced:
code-reviewer APPROVED_WITH_NITS (4), adversarial NEEDS_REWORK (1 IMPORTANT +
3 NITs). The v2 `## Revision history` block records every disposition,
including one REJECTED nit with counter-evidence. Focus on whether the fold
is correct and complete — do not re-litigate what r1 already settled and v2
records.

## A. Current-state anchors (verify against live source)

- `src/ui/app.css:12,19,26,33` — `@font-face src: url("./fonts/…woff2")`
  (CSS-relative); `src/ui/fonts/` does not exist; woff2 files live in
  `public/fonts/`. The comment at `app.css:1-6` wrongly claims
  "BASE_URL-relative".
- `src/ui/App.tsx:37-43` — catalog + provenance fetch genuinely
  `import.meta.env.BASE_URL`-relative.
- `vite.config.ts` (no `base`, react + vitest node env), `index.html` (Vite
  default), `package.json` (vite ^8.2.0, no PWA tooling) — unchanged from r1.

## B. Claims to verify in the v2 delta

1. **Spec item 0 (the r1 IMPORTANT fold):** changing the four `@font-face`
   URLs to root-absolute `url("/fonts/…")` fixes both the subpath deploy AND
   a pre-existing production 404 at base `/`. The artifact claims this was
   verified empirically (a `--base=/satisfactory-foundry/` build of the
   current CSS emits `url(./fonts/…)` verbatim into
   `dist/assets/index-HASH.css`; the same build after the fix emits
   `url(/satisfactory-foundry/fonts/…)`). You may reproduce: run
   `npm run build -- --base=/satisfactory-foundry/` and grep the emitted CSS
   (restore with `git checkout src/ui/app.css; rm -rf dist` if you edit).
2. **Walk additions:** fonts-render + no-woff2-404 assertion; SW/cache-clear
   hygiene between iterations. Are they sufficient to catch the failure mode
   r1 exposed?
3. **Revision history dispositions:** each r1 finding folded or rejected with
   grounded rationale (check the provenance.json rejection: `ls -la
   public/bundled-docs/provenance.json` — is it 292 bytes?).
4. Everything else is unchanged from the r1-reviewed design (Axes 1–7, spec
   items 1–7, scope, test plan) — flag only if the v2 edits broke internal
   consistency.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings.
