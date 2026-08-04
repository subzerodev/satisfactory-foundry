# Chain-aware helpers (Stage 6 arc)

**Started:** 2026-08-04
**Status:** in-progress
**Current phase:** Phase 1 (data groundwork) designing
**Final PR:** —
**Epic:** #24 (board #21, Stage 6 milestone 77)

## Phase decomposition

Two sequential phases: data groundwork first (power into the catalog —
parser + cache version + bundled snapshot; plan export/import as files),
then the helper surfaces (match-demand suggestions, finding-fix hints,
power display) whose design defers until the power shape lands.

Governing decisions: epic #24 §Decisions + master-plan §Stage 6. The
sequential posture continues per Michael's 2026-08-04 direction ("all
except 3", then Stage 7 logistics).

## Phases

### Phase 1 — data groundwork (power + export/import)

- **Ticket:** #25 (In Progress)

### Phase 2 — helper surfaces (deferred design)

- **Ticket:** #26 (blocked-by #25)

## Decisions log

- 2026-08-04: Arc started; decomposition on epic #24. Docs.json power
  fields grounded at pickup: mPowerConsumption + mPowerConsumptionExponent
  per building; variable-power machines (e.g. Hadron Collider) carry
  mPowerConsumption=0 + mEstimatedMininumPowerConsumption /
  mEstimatedMaximumPowerConsumption (the game's own "Mininum" typo —
  match verbatim). CATALOG_PARSER_VERSION mechanism already exists
  (mismatch → re-parse).

## Final report

—
