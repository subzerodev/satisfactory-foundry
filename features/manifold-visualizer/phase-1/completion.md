# Phase 1 completion — src/core manifold solver (ticket #3, epic #2)

Date: 2026-08-03
Branch: `feature/phase-1.0` → merged `--no-ff` into `develop` (7 commits;
worktree + branch removed post-merge). Trunk verified: 100/100 tests, `check`
+ `build` green.

## What landed

- `src/core/manifold.ts` (543 lines): the pure exact-rational manifold solver
  — `solveStage` / `solveFeedLane` / `solveOutputLane` + the full locked type
  contract (`StageInput`, `FeedBelt`, `BusSegment`, `BreakoutBelt`, lane
  results, the `Finding` union).
- `src/core/manifold.test.ts` (654 lines, 30 tests): all ten spec rows plus
  the N=0-precedence, p∤T-walk, and over-B-override clamp regression rows —
  exact `Fraction` assertions throughout.
- The frozen design set (`brainstorm.md` v4, `spec.md` incl. the
  walk-authoritative amendment, `plan.md`) and the bidirectionality +
  purity verification log.

## What the gate caught (the arc's proof of value)

- **Design (brainstorm 4 rounds, spec 2, plan 1):** the unstated starvation
  distribution model (→ head-first draw pinned); the `BusSegment.flow`
  self-contradiction (→ `peakFlow` span-max); segment→belt attribution gap;
  override-by-index coherence (→ count-stable semantics); oversize-overrides
  routing; N=0 precedence.
- **Implementation drift-hunt:** the agent surfaced a real spec-internal
  divergence — break-out walk vs `ceil(N×p/T)` count (they differ when
  `p ∤ T`) → team-lead decision: walk authoritative, spec amended, N=25
  regression row.
- **Boundary diff review (2 rounds):** a genuine phantom-index bug — feed
  entry/span indices unclamped to N under over-B overrides (`toMachine: 21`
  on a 20-machine stage; escaped per-task tests because all override rows
  were k=1) → clamp fix + regression; float `Math.ceil` belt count → exact
  guarded form.
- **Simplify passes:** 1 fold at brainstorm, 0 at spec, 2 reasoned rejections
  at diff — parsimony held without inventing work.

## Acceptance criteria (ticket #3) — final status

- Solver API + result types designed via dual-reviewed frozen brainstorm+spec — **met**.
- Feed/output/validation/degenerate behaviour per the v1 spec math — **met**.
- 20-smelter worked example with hand-verified entry/break-out points — **met**.
- Fractional-rate, exact-boundary, override-breaks, infeasibility rows — **met**
  (plus the three regression rows the gate added).
- `src/core` purity holds; check + tests green — **met** (purity mechanically
  re-proven in the log).
- Cumulative diff dual-reviewed at the boundary; merged `--no-ff` — **met**.

## Handed to Phase 2

The solver input contract is live on `develop`: the parser maps the catalog
onto `StageInput` (ascending `Fraction` capacity lists per kind; decimal
strings → `Fraction.parse`; rates per-machine at 100% clock).
