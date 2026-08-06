# satisfactory-foundry

*Follows the global workflow in `~/.claude/CLAUDE.md` (branch & push model,
agent-led dual-review, commit & comment hygiene). Below: this repo's specifics.*

Minimal, ground-up successor to `satisfactory-planner` (and eventually the
third-party Satisfactory Modeler). Features are added one at a time, each in
its correct architectural place. v1 = the manifold visualizer; design spec at
`docs/superpowers/specs/2026-08-03-manifold-visualizer-design.md`.

Forge: `sudohworks/satisfactory-foundry` on the sudohworks Forgejo (HTTP+broker
origin; regular-push default applies). Board `#21`; operating model per
`.forgejo-ops.toml` + `docs/operating-model.md`.

## Stack

React + TypeScript + Vite, Zustand, Vitest. `src/core/` is pure TS (no React,
no DOM) — all solver math lives there, in exact rational arithmetic
(`Fraction`), never floats.

## Workflow commands

lint: npm run check
test: npm test

## GitHub mirror (deploy-only) — deviation from the single-remote default

`github` remote → `https://github.com/subzerodev/satisfactory-foundry.git`
(HTTP+broker, never SSH). It exists ONLY to publish GitHub Pages: push it
**solely on Michael's explicit approval**, and only `main`. Forgejo `origin`
remains the source of truth for all branches, board, and CI. Deploy runbook:
get approval → `git push github main` → the owner-guarded
`.github/workflows/deploy-pages.yml` builds (`--base=/satisfactory-foundry/`)
and publishes Pages. Icons regenerate via `scripts/generate-icons.sh`.
