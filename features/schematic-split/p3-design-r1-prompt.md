# Review request — #135 P3 design (fresh r1, post-P2 base)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/schematic-split/p3-brainstorm-spec.md` (uncommitted, P3-v1)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `8bb34b5`)
**Stage:** first design review of the FRESH P3 spec. The pre-arc `brainstorm-spec.md` (r3) in the same directory is historical context ONLY — its axis shape was agreed by Michael (c24913) but its anchors predate P0-P2; this spec re-derives everything on the current tree. The pre-arc #135 r1/r2 gate findings (recorded at #135 c24699/c24706) are folded in as requirements.

## A. Current-state anchors (verify against live source)

- `src/ui/layout.ts` — machineTop/outputTop/height (:316-328), the `band ?` significant gate (:292-296), `significantMachines` (:107-163), `labeledSignificant`/labelStep, LAYOUT (:18-28).
- `src/ui/Schematic.tsx` — the two machine-row arms (non-band rect+label; `MachineBand`), the band tick literal `top + 40` (:575), the output-lane anchor `machineTopY + 40` (:735), the P2 additions (ribbons, endpoint rows at busY − 13, feed seams ±11).
- `src/ui/App.tsx` — the `View` union (:86), view state (:178), the tabs block (:441-460-era).
- The decisions: #135 c24630 (split), c24913 (option A, the two-mark ruler), the #138 scope-out.
- The five r2-enumerated breaking tests in `smoke.test.tsx` (line numbers have moved since — re-locate by content).

## B. Claims to verify (the design's load-bearing spine)

1. **The register guarantee:** `machineTop` has no machineH term, so the feed lanes + P2 endpoint rows are pixel-identical under machineRowH 12 — and `outputTop`/`height` are the ONLY places the parameter must reach. Grep `machineH` and literal `40` through layout.ts + Schematic.tsx: is the spec's touch-list complete (the :575 band tick and :735 output anchor are named — anything else)?
2. **The un-gated `significant`:** is `significantMachines` genuinely safe/pure in non-band mode (any hidden band assumption in it or its consumers)? What existing tests pin `significant === []` below the threshold (the spec predicts layout.test.ts holds one — verify and cite)?
3. **The ruler geometry vs the P2 additions:** labels at machineTop + 24 inside the 28px busH band above the RISEN outputTop — verify the arithmetic clears the output lanes' new position and nothing else occupies that band. Do the endpoint labels/seams in the feed lanes (busY − 13, ±11) interact with the ruler at all (they shouldn't — different rows; confirm).
4. **The machines-view lift:** are the two arms genuinely liftable (no lane coupling), and is the proposed standalone svg sizing sound (does MachineBand or the rect arm read anything lane-relative)?
5. **The five test relocations + the flip pins:** re-locate the five by content in the current smoke.test.tsx (P2/P4 moved lines); find the `significant`-empty pin(s); is the output-lane-y re-derivation (−28) right?
6. **The computeLayout default-param claim** (~21-22 call sites) — re-count on the current tree.
7. **Decision conformance:** nothing re-litigates the split or the option-A pick; #138's content scope stays out; presentation-only holds (no store/solver change anywhere in the spec).

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
