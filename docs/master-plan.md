# Master plan

The plan layer of the operating model: Stages own the why / what / sequence and
the locked decisions. Each Stage maps to a Forgejo milestone (see
`.forgejo-ops.toml` `[stages]`).

## Stage 0 — Bootstrap

**Status: delivered** (ticket #1, merged to `develop` 2026-08-03; completion
note at `features/stage0-bootstrap/completion.md`).

- **Goal:** stand the project up — Vite + React + TypeScript scaffold, Vitest,
  lint/check tooling, `src/core/` purity boundary in place.
- **Deliverables:** runnable dev/build/test/check commands (recorded in
  `CLAUDE.md`), `src/core/` with the `Fraction` exact-arithmetic foundation
  (70-test suite).
- **Decisions** (mirrored from ticket #1 `decision:` audit comments):
  - `Fraction` is hand-rolled + BigInt-backed (no fraction.js dependency).
  - Lint tooling = ESLint flat config + `tsc -b`; core purity enforced as a
    package-import allowlist + globals ban; Prettier scoped to `src`.
  - Stage 0 spec frozen after 4-round dual-review + simplify pass:
    `docs/superpowers/specs/2026-08-03-stage0-bootstrap-design.md`.

## Stage 1 — Manifold visualizer (v1)

- **Goal:** ship v1 = the manifold visualizer, per
  `docs/superpowers/specs/2026-08-03-manifold-visualizer-design.md`.
- **Deliverables:** the manifold solver in `src/core/` (exact rational
  arithmetic) + the visualizer UI on top of it.
- **Decisions:** design decisions locked in the v1 spec (see its
  "Decisions made during brainstorming" section).
