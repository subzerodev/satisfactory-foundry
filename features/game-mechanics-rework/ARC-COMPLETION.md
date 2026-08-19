# Arc completion report — #140 Phase 2: the game-mechanics rework

**Status:** all phases merged to `develop` (2026-08-19). The release PR
`develop → main` is the arc's final act (#136 c24714, confirmed c24859).
**Trunk:** 1227 tests green, `npm run check` clean, tree clean.

## The arc, end to end

Michael's complaint — a solver that ignored valid game mechanics, shown by
eight phantom `x2` belt doublings on his 8411 Wet Concrete plant — drove a
Phase-1 audit (6 agents, header-grounded, all 16 scope decisions made by
Michael interactively) and a five-phase rework:

| Phase | Ticket | What shipped |
|---|---|---|
| P0 | #150 | Belt/pipe tiers parsed from the game's Docs file (exact Fractions, parse-else-curated, real-file drift guard); train lockout exactly 27 s |
| P1 | #151 | The overflow-chain solver model: entry/hand-off endpoints, hardware + ≤3 cascades + standing buffer, pipe Level-1 honesty; the whole x2 surface retired (resolves #139's wording) |
| P2 | #152 | The drawing: tapering ribbons + endpoint numbers (D+F), scoped tooltip rewrite, pipe connector, hardware/buffer/spare card lines, legend conventions, site-plan junction kinds |
| P4 | #133 | Packaging for a raw input in the Extraction panel (the Wet Concrete water case); plan file v9 with rebuilding migrations and a canonicalized write |
| P3 | #135 | The schematic split: build view with the 12px two-mark ruler (option A), the new Machines tab (#138 owns its future content) |

Pre-arc, four defect fixes landed separately per Michael's Q16 decision:
#142 variable power, #143 clock floor, #144 catalog self-heal, #145 pipe
x2 suppression.

**The ticket's test case, answered:** all eight 8411 `x2` runs were merge
artifacts; under the shipped model they are eight seam mergers, drawn as
ribbon hand-offs ("60") with a terminal "0" — pinned end-to-end by the
P1/P2 integration tests.

## Process record

Every phase ran the full gate: design brainstorm+spec through the degraded
all-Claude dual-review (code-reviewer + adversarial-reviewer) to
convergence, a one-shot simplify pass, worktree-isolated implementation,
bidirectionality logs with compiling mutants (35 behaviours
mutation-proven across the arc, zero green mutants accepted), and a
phase-boundary cumulative diff gate. 20 design rounds and 10 diff gates in
total; two reviewer-vs-reviewer factual splits resolved by reading source
(zustand middleware; the P2 terminal rule); one previously-skipped gate
(#133's r4) caught via the audit trail and run. Every phase closed with a
USER GATE Michael passed explicitly; both design forks reserved for him
(the release shape; the #135 axis) were decided by him from rendered
options.

## Deferred, tracked

#146 multi-item bus, #147 head lift (Backlog); #148 Somersloop, #149
Resource Wells (Backlog, on-demand only per Michael); #138 machines-view
content (own ticket). The #144 follow-up (re-run
scripts/update-bundled-docs.mjs) remains available on demand.

## Release

The single `develop → main` PR carries the whole rework. After merge, the
GitHub Pages deploy (github remote, `main` only) requires Michael's
explicit approval per the repo's deploy runbook.
