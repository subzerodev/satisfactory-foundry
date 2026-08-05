# Stage 16 combined — field polish (tickets #83 + #84 + #85 + #86) — brainstorm v1

**Goal.** Michael's two field reports (2026-08-05, verbatim): "this
doesnt say the output per min also we can add more to the tiles like
the device that we need to make eg x65 smelters" and "breaks out
after machine 12 but this says before in the diagram also the numbers
arent in the middle in schematic view so its hard to see where the
feed out is". Four axes, one cycle, under his clear-the-board
directive.

*Cites: view files = src/ui/…; engine = src/layout/layout.ts.*

## Already settled — do NOT re-litigate

- All S12–S15 decisions stand (gutter, toggle, override table,
  restored schematic, band thinning incl. the S15 priority/greedy
  rule, tabs). All-Claude roster; full gate; walk on Michael's
  Copper Ingot cases.

## Grounded current state (this session)

1. **#85 ROOT CAUSE — a real off-by-one in the Blueprint's machine
   labels.** Blueprint.tsx:196-205 renders machine rects at
   `x = i·pitch` (0-based loop, engine layout.ts:146-149) and labels
   each rect `{i}` — DISPLAYING THE 0-BASED INDEX. The solver's
   vocabulary is 1-based (machines 1..N; "breaks out after machine
   12"); marks sit at `boundaryX(m) = m·pitch` = solver-machine m's
   RIGHT edge (engine layout.ts:96-98) — which is the right edge of
   the rect DISPLAYING "m−1" and the left edge of the rect
   DISPLAYING "m". Michael's reading was exactly right: the "after
   machine 12" mark renders at the left edge of the rect wearing
   "12" (really machine 13). The SCHEMATIC labels are correct
   (1-based m.index, Schematic.tsx:307-309; ui/layout.ts machines
   carry index i+1). The mark GEOMETRY is correct everywhere — only
   the Blueprint's displayed numbers are wrong.
2. **#86 — schematic numbers straddle boundaries.** Non-band row:
   label at `x = m.x` (the CELL START) with text-anchor:middle
   (Schematic.tsx:307-309; .machine-label centered) — every number
   sits ON the boundary line between two cells. Band mode: the
   significant label also renders at the machine's left edge
   (xOf(index), :215), beside its boundary tick. Machine rects span
   [m.x, m.x + pitch−2].
3. **#83 — alt-compare rows lack the output rate.** CompareRow =
   {recipeName, machines, power, rawDraw, byproducts, isCurrent}
   (AltCompare.tsx:40-49); the table renders recipe/machines/power/
   raw-draw + the apply cell (:138-166). The comparison runs at the
   stage's current primary-lane totalOutput R (:83-85, same-output
   premise); each candidate's machine count is ceilDiv(R, candidate
   perMinute) (:103) — so each row's ACTUAL produced rate
   (machines × perMinute) can OVERSHOOT R differently.
4. **#84 — tiles name no building.** graph-flow.ts:644 builds
   StageNodeData {recipeName, machineCount, powerText, …};
   GraphCanvas.tsx:147-167 renders recipeName, ×{machineCount},
   powerText. The catalog's machine displayName is reachable where
   powerTextOf already reads catalog.machines (graph-flow.ts:491).

## Axis A — #85: fix the Blueprint's machine numbers (1-based)

**Pick: `{i}` → `{i + 1}` (Blueprint.tsx:204).** One-token fix; the
rects then display 1..N matching the solver vocabulary, and every
mark ("after machine 12" at machine 12's right edge) reads correctly.
The mark geometry, boundaryX, and the schematic are untouched (all
already correct). Audit recorded on #85: the geometry was right; the
display indexing lied.

## Axis B — #86: center the schematic's machine numbers

**Pick: label x moves to the CELL CENTER in BOTH modes; ticks stay
at boundaries.**
- Non-band: `x = m.x + pitch/2` (the label names the machine, so it
  centers under the machine cell; the blueprint already centers
  in-rect).
- Band mode: the significant label ALSO centers (`xOf(index) +
  pitch/2`) while its boundary tick stays at xOf(index) — the tick
  marks the boundary, the number names the machine. Consistent
  reading everywhere; the S15 thinning spacing is unaffected (a
  constant +pitch/2 shift preserves all label-to-label distances,
  so the ≥3-index/24px guarantee and the nine-pair residual pins
  hold verbatim).

## Axis C — #83: the compare table shows output /min

**Pick: a per-row OUTPUT column with the ACTUAL produced rate.**
- CompareRow gains `output: string` = formatRate(machines ×
  candidate perMinute) + "/min" — the actual (ceil-overshooting)
  rate, honest per row; the current row shows the stage's real R.
  Computed in the same adapter that builds machines/rawDraw (pure,
  testable).
- Column order: RECIPE | MACHINES | OUTPUT | POWER | RAW DRAW |
  (apply) — output beside machines, where the overshoot reads
  naturally. Header idiom unchanged (schedule table).

## Axis D — #84: tiles name the building

**Pick: `×N MachineName` on the existing machines line.**
- StageNodeData gains `machineName: string | null` (the catalog
  machine displayName for the stage's recipe machineId; null when
  recipe-less — same nullability posture as recipeName). Built in
  graph-flow.ts beside recipeName/powerText (the catalog is already
  in scope at :644).
- GraphCanvas's machines span renders `×{machineCount}
  {machineName}` when machineName is non-null (recipe-less tiles
  unchanged — the span is already gated on recipeName). Michael's
  example: "×65 Refinery" (Pure Copper Ingot), "×81 Smelter"
  (Copper Ingot).

## Non-goals

- No mark/boundary geometry changes (#85 is display-only); no
  solver/engine changes; no compare-model changes beyond the one
  column; no store changes; no new views or panels; the S15
  thinning rule untouched.

## Test plan sketch

- A: the blueprint SSR pin — machine labels render 1..N (a fixture
  asserting the first rect's label "1" and the N-th "N"; sweep any
  existing pin of the 0-based labels — drift hunt).
- B: schematic label x pins — non-band label at m.x + pitch/2 (the
  worked N=20 fixture: machine 1's label at marginX + pitch/2);
  band-mode significant label at xOf + pitch/2; tick x unchanged at
  xOf; the S15 thinning pins (nine-pair residual, labeled subsets)
  UNCHANGED (spacing invariant under constant shift).
- C: adapter unit test — a candidate whose ceil overshoots pins the
  actual output string (e.g. R=810 with perMinute 12.5 → 65
  machines → 812.5/min); the current row pins R exactly; SSR pin of
  the OUTPUT header + a row value.
- D: graph-flow unit — machineName resolves the displayName, null
  when recipe-less; SSR/node pin "×65 Refinery" on the walk fixture
  (or the store-test fixture equivalent).
- Bidirectionality log per axis —
  features/field-polish-16/r2-verification.log.
- Both-media walk (Michael's Copper Ingot ×81 + Pure Copper ×65 +
  the Plastic ×161 breakout case): the "after machine 12" mark sits
  at the right edge of the rect labeled 12; schematic numbers
  centered under cells both modes/themes; the compare table shows
  OUTPUT per row incl. the overshoot; tiles read "×65 Refinery";
  collision scans stay zero (labels shifted, not resized).

## Assumptions ledger

1. The off-by-one grounding (Blueprint `{i}` at :204 vs the 1-based
   solver vocabulary and boundaryX comment) — read this session;
   the schematic's 1-based correctness read at Schematic.tsx:307.
2. No existing test pins the Blueprint's 0-based label content
   (drift hunt verifies; if one does, it flips with the fix as a
   corrected pin, not churn).
3. The compare adapter has the candidate perMinute in scope where it
   computes machines (AltCompare.tsx:103 idiom) — verify the exact
   adapter location at implementation.
4. catalog.machines[machineId].displayName exists (the power path
   reads catalog.machines at graph-flow.ts:491; verify the
   displayName field name against the catalog types at
   implementation).
5. A constant +pitch/2 label shift preserves ALL S15 spacing
   invariants (label-to-label distances unchanged) — the nine-pair
   and subset pins must pass untouched.

## Revision history

- v1 (2026-08-05): initial — grounded in Michael's two reports, the
  #85 off-by-one root cause (display indexing, not geometry), the
  compare-row and node-data shapes, and the schematic label
  anchoring.
