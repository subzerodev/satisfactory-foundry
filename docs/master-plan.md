# Master plan

The plan layer of the operating model: Stages own the why / what / sequence and
the locked decisions. Each Stage maps to a Forgejo milestone (see
`.forgejo-ops.toml` `[stages]`).

## Stage 0 — Bootstrap

- **Goal:** stand the project up — Vite + React + TypeScript scaffold, Vitest,
  lint/check tooling, `src/core/` purity boundary in place.
- **Deliverables:** runnable dev/build/test commands (recorded in `CLAUDE.md`),
  empty-but-typed `src/core/` with the `Fraction` exact-arithmetic foundation.
- **Decisions:** _<locked decisions — mirror from the board's `decision:` audit comments>_

## Stage 1 — Manifold visualizer (v1)

- **Goal:** ship v1 = the manifold visualizer, per
  `docs/superpowers/specs/2026-08-03-manifold-visualizer-design.md`.
- **Deliverables:** the manifold solver in `src/core/` (exact rational
  arithmetic) + the visualizer UI on top of it.
- **Decisions:** design decisions locked in the v1 spec (see its
  "Decisions made during brainstorming" section).
