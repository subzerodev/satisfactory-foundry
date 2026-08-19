# P3 completion report — the schematic split (#135, final phase of #140)

**Merged:** `feature/phase-p3` → `develop`, `--no-ff`, 2026-08-19 (four
commits `759e7eb..dbaae86`; 8 files, +714/−202).
**Spec:** `p3-brainstorm-spec.md` (the FRESH post-P2 spec, frozen at r2 +
zero-finding simplify @ `6e27ed2`; supersedes the pre-arc r3).
**Trunk after merge:** 1227 tests green, check clean.

## What landed

- **The build view** (the Schematic): both machine-row arms replaced by
  the 12px two-mark `Ruler` — major ticks at belt-stretch boundaries
  (solver-derived via the un-gated `significant`, both density modes),
  minor ticks binding each label to its cell (Michael's option-A pick,
  c24913). The grey band and ×N count left the drawing; ~28px reclaimed;
  `machineTop` and every feed-lane/P2 pixel unchanged by construction.
- **The Machines view**: new tab (Schematic · Machines · Blueprint)
  carrying the block verbatim — rects below the band threshold,
  MachineBand + ×N above. #138 owns what it grows into.
- **`computeLayout(result, N, machineRowH = 40)`**: the one parameter;
  ~21 existing call sites untouched by the default.
- **The r1 HIGH's fix**: the output-lane anchor parameterized to
  `machineTopY + rulerH` with a register pin proven falsifiable against
  the coincidence trap (the risen outputTop numerically equals the old
  `+ 40` literal — the mutant renders 140, the pin demands 112).

## Review trail

- **Design:** the fresh spec converged in 2 rounds + zero-finding
  simplify (the pre-arc #135 r1/r2 findings were folded in as
  requirements from the start; the fresh r1 adversarial still found one
  HIGH — the un-parameterized :735 anchor hidden by the outputTop
  coincidence). Michael decided the axis fork (the one the pre-arc r2
  gate reserved for him) from a rendered three-option mockup.
- **Diff:** code-reviewer APPROVED + adversarial APPROVED, both zero
  findings (tick math re-derived concretely; the 16/17 seam-bracketing
  question resolved as by-design; the machines-view lift verified
  byte-faithful). Simplify APPROVED_WITH_NITS: the dead CSS selector
  folded (`dbaae86`, scoped re-run APPROVED + APPROVED); the
  two-call-site fixture extraction rejected with rationale.
- **Bidirectionality:** `p3-verification.log` — 7 compiling mutants, no
  greens; one non-compiling variant disclosed and replaced per the
  discipline.

## Acceptance criteria

All five met: the 106-machine build view with ruler + Machines tab (1),
pixel-identical feeds + 28px reclaim (2), both density arms verbatim (3),
presentation-only (4), suite + lint green (5).

## Arc status

P3 was the final phase. P0 (#150), P1 (#151), P2 (#152), P4 (#133), and
P3 (#135) are all merged to develop. The arc's remaining act is the ONE
`develop → main` release PR (#136 c24714 / confirmed c24859).
