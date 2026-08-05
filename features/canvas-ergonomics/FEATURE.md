# Canvas ergonomics + theming stragglers (Stage 10 arc)

**Started:** 2026-08-05
**Status:** complete — all three phases merged; release PR at close
**Current phase:** — (arc closed 2026-08-05)
**Final PR:** #52 (develop → main, merged 2026-08-05)
**Epic:** #48 (board #21, Stage 10 milestone 81)

## Phase decomposition

- **P0** — theming stragglers: base element rules (button/select/input)
  app-wide replace the too-narrow P2 container enumeration; existing
  specific overrides stand.
- **P1** — canvas ergonomics: bigger + user-resizable graph area; a
  flow-direction option (LR vs TB — node handles + placementSlot +
  builder apply placement; user positions untouched). Behavior phase:
  full design loop (preference home, persistence, plan-file impact).

## Phase status

- P0 (#49): complete (merged 2026-08-05; 707/707; three design rounds
  — the :not() specificity trap fixed with :where(); boundary + walk
  clean).
- P1 (#51): complete (merged 2026-08-05, f7ab3ec; 728/728, +22 tests).
  Design: three correctness rounds to convergence + simplify (the r2
  save→load pinning hole caught pre-impl). Implementation: opus, zero
  drift, one plumbing realization (loadPlanWithOrigin/v5Native — boundary-
  verified complete across all plan paths). Boundary: code-reviewer
  APPROVED_WITH_NITS (log nits, folded) + adversarial APPROVED; diff-
  simplify APPROVED_WITH_NITS (stale-comment fold + no-action). Walk:
  both media — resize seam computed-verified + RF live-tracking proven,
  LR↔TB round-trips (handles flip, autos re-grid exact, fitView
  re-frames), TB placement flows downward, zero console errors. The
  native grip drag itself is browser-UA machinery synthetic events can't
  drive — Michael's first real drag is the last evidence; fallback
  recorded in the frozen spec.
- P2 (#50): complete (merged 2026-08-05, 5a86002). A measured
  computed-gap audit found three defects — the four S9P2-framed panels
  flush at 1px, the canvas buttons touching at 0px, tier chips merged
  at 2px — fixed at 12px/8px/6px per the app's existing rhythm.
  Correctness converged first round; both boundary reviews APPROVED
  with zero findings; both-media walk re-measured every fix site
  (13px insets, 8px gap, 6px chips) plus the clean-list spot-checks.

## Final report

Stage 10 arc: three phases, all live feedback from Michael on the
shipped Stage 9 identity. P0 inverted control theming to base element
rules (the :where() specificity trap caught in review). P1 delivered
the resizable canvas (pure CSS seam over RF's ResizeObserver) and the
per-plan LR/TB flow direction (plan-file v5 with the userPlaced flag —
the save→load pinning hole caught by adversarial review pre-impl;
728 tests). P2 fixed the measured spacing defects. Every phase: design
to convergence, simplify dispositioned, isolated worktree, boundary
dual-review, both-media walk, trunk-verified merge. Suite 706 → 728.

## Decisions log

- 2026-08-05 (P0 landed): base element rules are the control-theming
  API (the :where() wrapper is load-bearing); enumerate exceptions,
  never stragglers; color-scheme rides the three-block guard.

- 2026-08-05 (P1 frozen): flow direction is a per-plan property (plan
  file v5: top-level `flowDirection` + per-stage `userPlaced?: true` —
  the flag is forced by the unconditional position save, store.ts:1464);
  resize is a pure CSS seam (560px default, resize: vertical, radius-0
  fold); direction switch re-grids only non-userPlaced stages by order
  index; `flowDirection` joins the derived-memo deps; an effect child
  re-frames via fitView (the prop is initial-only).

- 2026-08-05: Arc started from Michael's live feedback; decomposition
  on epic #48.

