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

(to be filled in once the project is scaffolded: dev / build / test / check)
