# Canvas ergonomics + theming stragglers (Stage 10 arc)

**Started:** 2026-08-05
**Status:** in-progress
**Current phase:** Phase 1 (resizable canvas + flow direction) — design next
**Final PR:** —
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
- P1: design next. P2 (#50): spacing pass — Michael's live feedback,
  runs after P1.

## Decisions log

- 2026-08-05 (P0 landed): base element rules are the control-theming
  API (the :where() wrapper is load-bearing); enumerate exceptions,
  never stragglers; color-scheme rides the three-block guard.

- 2026-08-05: Arc started from Michael's live feedback; decomposition
  on epic #48.

## Final report

—
