# P2 completion report — the drawing (#152, child of #140)

**Merged:** `feature/phase-p2` → `develop`, `--no-ff`, 2026-08-19 (seven
commits `cdc98db..1d38a82`; 14 files, +1507/−60).
**Spec:** `p2-brainstorm-spec.md`, frozen at r4 (`0a4808f`).
**Trunk state after merge:** 1203 tests green, `npm run check` clean
(verified after worktree removal).

## What landed

- **D1 — tapering ribbons.** Feed bus segments render as trapezoid
  polygons: left height ∝ entry flow, right ∝ carried-onward flow
  (RIBBON_MAX 9px / RIBBON_MIN 1px halves, scaled against the lane's top
  unlocked tier, over-B clamped). The terminal stretch tapers to hairline
  — thickness means carried flow everywhere, honoring P1 caveat 1. Feed
  seam ticks grew to ±11; output lanes keep constant-width lines and ±6
  seams (the #76 name baseline stays safe).
- **D2 — endpoint numbers.** One baseline above the ribbon: entry
  (start-anchored) per stretch, hand-off (end-anchored) at positive
  non-terminal seams, terminal "0" at the lane end. Halo idiom on every
  label; glyph-width thinning; the two-sided token collision rule (right
  candidate pushes the entry label, left candidate suppresses the
  hand-off — tooltips keep every number findable).
- **D3 — tooltip rewrite.** `segTooltip`'s three shapes (entry → hand-off;
  terminal spare-capacity; output "collects"); "peak" removed from the
  tooltip vocabulary ONLY — findingText, the FindingsPanel hint, and
  advice.ts keep their correct over-capacity usage (P1 caveat 2, scoped).
- **D4 — pipe honesty drawn.** Pipe feed lanes get a neutral dashed
  connector with one tooltip (total demand vs supplied, nominal-ceiling
  caveat); `lane-undersupplied` colours the whole connector; no ordered
  claims.
- **D5/D6 — cards + legend.** Per-lane hardware line (splitters · seam
  mergers · head cascade), the c24796 standing-buffer line, the
  spare-belt-capacity line, output collection-cascade suffix; three new
  legend conventions.
- **D7 — site-plan junction kinds.** `splitter | seam-merger | merger` on
  every junction (`data-kind` + title), residue-in derived by the
  override-invariant subtraction (`entryFlow − belt.capacity`), proven
  against the empty-span counter-case.
- **8411 end-to-end:** 17 tapering stretches, eight "60" hand-offs, a
  terminal "0", spare capacity 30/min on the card.

## Review trail

- **Design:** 4 rounds + zero-finding simplify. Substantive catches: the
  terminal surplus-thickness rule would have relocated caveat-1's
  misreading into the thickness channel (r1, adopted zero-taper); the
  unqualified "peak" gate was false against live source (r1, both
  reviewers); the below-ribbon label row collided with the next lane's
  name by 1px (r1); the seam-kind derivation broke on empty spans (r1);
  the stale ledger copy (r2, both); the halo requirement (r2); the
  LEFT-token/hand-off collision (r3). One reviewer-vs-reviewer split
  (the r1 adversarial misread the terminal rule) resolved on the record.
- **Diff:** code-reviewer APPROVED_WITH_NITS + adversarial APPROVED
  (zero findings — the polygon vertex math, both collision fixtures, and
  the empty-span discriminator all hand-traced). Simplify
  APPROVED_WITH_NITS: the identity `JUNCTION_WORD` map folded (`1d38a82`,
  scoped correctness re-run APPROVED + APPROVED); the zero-constant
  consolidation REJECTED with rationale (would couple src/ui to
  src/layout for a zero literal).
- **Implementer judgment calls, all endorsed:** glyph-width thinning
  (faithful to the spec's controlling text; the ~60px was a worst-case
  estimate), `pipeConnectorTooltip` extracted to format.ts (the
  string-ownership pattern), `pipe-manifold` composed alongside
  `lane-pipe`.
- **Bidirectionality:** `p2-verification.log` — 7 behaviours
  mutation-proven, compiling mutants, no green mutants.

## Recorded NIT (awareness, no action)

The pipe connector's `lane-pipe` class is a semantic/test marker only —
no bare `.lane-pipe` CSS rule matches it; the dashed treatment is
value-copied into `.pipe-manifold`. Correct rendering; the composition is
nominal. If a future change restyles pipes, update both rules.

## Acceptance criteria

All six met: the 8411 drawing shape (1), no surplus-as-flow + scoped peak
removal (2), the pipe connector (3), the legend (4), junction kinds (5),
suite + lint green (6).
