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
- **Status: SHIPPED 2026-08-03** — epic #2 (children #3–#6, all Done);
  released via PR #7 (`develop → main`, merge 8875c4a); 208/208 tests.
  Record: `features/manifold-visualizer/final-report.md`.
- **Post-release follow-on:** #9 bundled default catalog (decision #8 —
  boot-ready without an upload; not part of the Stage 1 release). SHIPPED
  2026-08-03 via PR #10 (merge 7de608a); 226/226 tests.

## Growth-path sequence (Stages 2–5)

**Decision (Michael, 2026-08-03):** run all four v1 growth-path arcs
sequentially — save/load → chained stages → physical layout → polish — with
opus/sonnet implementation-agent dispatch (opus for design-judgment tasks,
sonnet for mechanical; review roster stays all-Claude per epic #2). Order
rationale: serialization de-risks chaining; layout builds on the chained
canvas; polish lands last on the finished surface.

## Stage 2 — Plan save/load

- **Goal:** serialize the store to named, locally-persisted factory plans
  (save/list/load/rename/delete), exactness preserved, format forward-open
  for Stage 3's stage graphs.
- **Ticket:** #11 (milestone 73). **Status: SHIPPED 2026-08-03** — merged
  to develop (264/264 tests; 6-round design gate + first-try boundary
  convergence); released via the Stage 2 PR.

## Stage 3 — Chained stages (graph editor)

- **Goal:** the endgame — a factory graph of linked manifold stages (React
  Flow node editor); one stage's outputs feed the next; supersedes the
  third-party Modeler. Tier-3 multi-phase arc; decomposition at pickup.
- **Epic:** #12 (milestone 74). Blocked-by Stage 2.

## Stage 4 — Physical layout layer

- **Goal:** geometry over the solve — footprints, splitter placement,
  foundation alignment; the schematic becomes a buildable blueprint view.
- **Ticket:** #13 (milestone 75). Blocked-by Stage 3.

## Stage 5 — Polish round

- **Goal:** UX batch on the finished surface (styled tooltips, drag-drop
  upload, dark mode, large-N labels + accumulated small items).
- **Ticket:** #14 (milestone 76). Blocked-by Stage 4.
