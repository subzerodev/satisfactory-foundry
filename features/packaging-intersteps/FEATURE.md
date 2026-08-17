# Packaging Intersteps - Stage 22

**Ticket:** #113
**Epic:** #114
**Status:** merged to `develop` as `3c4324b`. Its r5 correctness round was skipped
at merge time and run retroactively under #127, which found **no correctness
defects**: both reviewers confirmed all five r4-repair claims. Its verdicts were
`NEEDS_REWORK` (code-reviewer, on the false convergence record) and
`APPROVED_WITH_NITS` (adversarial-reviewer). Four hygiene/evidence nits were
folded — the v3 fixture decorrelation plus cycles 10a/10b, the log's
pre-rename-capture annotation, its section-numbering annotation, and a corrected
`migrateV3` header-test comment — and a raw NUL byte was split to #129. See the
Review Disposition in `completion-report.md`.

## Frozen Direction From The Board

Intersteps are user-directed insertions on a link. The chain solver continues
to exclude Packager cycles. This feature plans exact container flow and warns
about loop hazards; it does not infer packaging or fabricate in-flight
container capital without route-length/timing evidence.

## Delivered Behavior

- `Package for transport` is available on reversible fluid/gas links and for
  saved stale intent that needs recovery.
- The inspector derives exact packaging and unpackaging machine counts, shared
  clock power, packaged cargo, and empty-container return flow.
- Forward and return routes are independent solid-cargo plans. Pipe and
  fluid-truck are refused at action, persistence, and derive boundaries.
- Graph chips and train findings use packaged cargo, while reconciliation and
  machine-count apply actions retain the original fluid/gas units.
- Plan v8 preserves raw numeric edit text and interstep intent; v7 migration
  canonicalizes legacy transport objects before writing v8.

## Verification Evidence

- Unit/integration baseline before browser work: 44 files, 1,127 tests passed.
- The checked-in Chromium gate activates real packaging controls at 360, 720,
  and 1280px with no horizontal overflow, then runs the complete 1280px
  enable/edit/independent-route/stale-recovery keyboard workflow.
- Screenshots are generated under `/tmp/satisfactory-foundry-113-browser` and
  were inspected at all three widths plus workflow, stale, and recovered states.
- The extraction browser gate remains green at 360, 720, and 1280px.
- `r2-verification.log` contains real break/fail/restore/green evidence for
  derive math, store guards, graph diagnostics, and inspector behavior.

See `completion-report.md` for exact browser rows and final command evidence.
