# Review request — #135 P3 implementation, phase-boundary cumulative diff (r1)

**Artifact:** the cumulative diff `develop...feature/phase-p3` (8 files, +715/−202; three commits 759e7eb/c0db95b/a7b910c). Generate it in the worktree: `git diff develop...feature/phase-p3` — or read the touched files directly.
**Worktree (live source):** `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/phase-p3` (branch `feature/phase-p3`)
**Spec (frozen, the contract):** `features/schematic-split/p3-brainstorm-spec.md` in the worktree (the FRESH P3 spec, frozen at r2 + zero-finding simplify; the old `brainstorm-spec.md` is superseded history).
**State:** `npm test` 1227 passed, `npm run check` clean (team-lead re-verified).

## A. Current-state anchors

Read in the worktree: `src/ui/layout.ts` (rulerH, machineRowH param, the un-gated significant), `src/ui/Schematic.tsx` (the Ruler, the :735-era parameterization), the new `src/ui/Machines.tsx`, `src/ui/App.tsx` (the third tab), `src/ui/app.css` (new rules), `src/ui/layout.test.ts` + `src/ui/smoke.test.tsx` (the flips + relocations), `features/schematic-split/p3-verification.log`.

## B. What to verify

1. **Spec conformance D1-D4 item by item:** rulerH 12 + machineRowH default; machineTop untouched; the un-gated significant with labeledSignificant still band-gated (doc comments updated); the Ruler's three mark kinds at the exact prescribed positions (major at xOf(index) from significant, minor at cell centre, labels at +rulerH+12); the band rect + ×N gone from the build view; the output anchor `machineTopY + machineRowH`; the Machines view lifting BOTH arms verbatim at stock 40 with the prescribed svg sizing; the third tab (order Schematic, Machines, Blueprint), component-local state.
2. **The register pins:** the output-arrow y1 pin (must demand machineTop + rulerH — verify it would fail the +40 coincidence render); ruler major ticks EQUAL segment boundary x from the same layout; machineTop identical across machineRowH values; height −28.
3. **The relocations/flips:** the five smoke relocations landed (the output-name pin re-targeted to the build view at 166; default-call pins still 194 where applicable); layout.test.ts:132-135 flipped to non-empty, :256-260 still empty with the stale comment updated.
4. **The verification log:** 7 compiling mutants, genuine FAILs naming new tests (incl. B1's coincidence-trap kill and B5's disclosed rejected non-compiling variant), restore-green.
5. **No scope creep, no weakened tests** — nothing touches solver/store/persistence; the P2 surface (ribbons/endpoints/seams/cards/legend) untouched.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
