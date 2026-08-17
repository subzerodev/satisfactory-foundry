# Packaging Intersteps - Stage 22

**Ticket:** #113
**Epic:** #114
**Status:** implementation complete; cumulative review pending

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
