# Stage 16 combined — field polish (tickets #83 + #84 + #85 + #86) — brainstorm v3

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
3. **#83 — alt-compare rows lack the output rate (r1 CORRECTED —
   both reviewers, the converged BLOCKER/MAJOR).** The table's row
   type is CandidateRow (chain-builder-adapter.ts:134-152:
   recipeName, machines, power, rawDraw, byproducts, isCurrent),
   wrapped by AltCompare's CompareRow {row, apply} (:40-44). The
   displayed `machines` is the Σ machineCount across the candidate's
   WHOLE SUBTREE (candidateRowsFor, chain-builder-adapter.ts:272-276
   — proposal.stages.reduce) from a multi-stage proposeChain run —
   NOT ceilDiv(R, perMinute) (that is the separate apply-payload
   count, :300-308). So v1's `machines × perMinute` output formula
   was WRONG for any multi-stage candidate (the widget←gadget
   fixture at chain-builder-adapter.test.ts:411-419 exercises
   exactly this). The honest produced rate ALREADY EXISTS:
   `ProposedStage.outputRate` (src/core/chain-builder.ts:46-51,
   :295) — the primary stage's exact, ceil-overshooting rate.
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

**Pick (r1-corrected): a per-row OUTPUT column sourced from the
primary stage's `outputRate` — no recomputation.**
- `CandidateRow` gains `output: string`, computed inside
  candidateRowsFor (chain-builder-adapter.ts:256-289) with a
  GUARDED lookup (r2 BOTH reviewers, the converged IMPORTANT/MAJOR:
  a SELF-CONSUMING candidate — one listing its own primary output
  among its inputs — passes candidateRecipesFor's filter but is
  demoted to RAW by proposeChain's cycle guard, chain-builder.ts:
  207-213, leaving NO stage for itemId; an unguarded
  .find(...).outputRate would TypeError inside the render):
  `const primaryStage = proposal.stages.find(s => s.itemId ===
  itemId); output = primaryStage === undefined ? "—" :
  formatRate(primaryStage.outputRate) + "/min"` — the file's
  never-throw idiom (subtreePower skips, swapMachineCountFor
  floors, machineNameFor falls back). The rate itself is the exact,
  per-candidate ceil-overshooting produced rate, correct for
  single- AND multi-stage candidates (the r1 BLOCKER: `machines`
  is the subtree Σ; PreviewRow.outputRate at :98 is the
  pass-through precedent). r2 adversarial REFUTED its own
  divergence attacks: ProposedStage.outputRate is always the
  100%-clock count × primary perMinute (chain-builder.ts:295), and
  the proposal's root count equals swapMachineCountFor's ceilDiv —
  the displayed OUTPUT cannot diverge from the post-apply machine
  count. (Noted, out of scope: stages running at clock ≠ 100 have a
  PRE-EXISTING compare/apply 100%-clock convention shared by the
  MACHINES column — the OUTPUT column is internally consistent with
  it.)
- Every row — INCLUDING the current one — shows its candidate's
  ACTUAL produced rate uniformly (v1's "current row shows R
  exactly" claim DROPPED, r1: the current recipe's own ceil can
  overshoot R too; uniform actuals are the honest display).
- Column order: RECIPE | MACHINES | OUTPUT | POWER | RAW DRAW |
  (apply). Header idiom unchanged (schedule table).

## Axis D — #84: tiles name the building

**Pick: `×N MachineName` on the existing machines line.**
- StageNodeData gains `machineName: string | null` (null ONLY when
  recipe-less — same nullability posture as recipeName). For a
  recipe whose machineId is OFF-TABLE (reachable — the Blueprint's
  "footprint unknown" path proves it), fall back to the RAW
  machineId string per the existing machineNameFor precedent
  (chain-builder-adapter.ts:88-92) — never null under a non-null
  recipeName, so the span cannot render a dangling "×N " (r1
  adversarial). Built in graph-flow.ts beside recipeName/powerText
  (catalog in scope at :644; displayName field verified at
  src/data/types.ts:38-42; the machines span gate is
  GraphCanvas.tsx:154-156).
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
- C: adapter unit tests — (1) a single-stage candidate whose ceil
  overshoots pins the actual output string; (2) a MULTI-STAGE
  candidate (the widget←gadget fixture idiom,
  chain-builder-adapter.test.ts:411-419) pins output = the PRIMARY
  stage's outputRate, NOT machines × perMinute — the test that
  would have caught the v1 formula (r1); (3) the current row pins
  its own actual rate; (4) a SELF-CONSUMING candidate (demoted to
  raw — no stage for itemId) pins output "—" without throwing —
  the test that would have caught the v2 unguarded deref (r2).
  SSR pin of the OUTPUT header + a row value.
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
3. RESOLVED at r1 (no longer deferred): the adapter is
   candidateRowsFor at chain-builder-adapter.ts:256-289; the output
   field lives on CandidateRow; the source is the primary
   ProposedStage.outputRate.
3b. PROVENANCE (r3 adversarial advisory): the Apply button remains
   live on a "—" (self-consuming, demoted) row — a PRE-EXISTING
   AltCompare property (rows get apply payloads regardless;
   candidateRecipesFor never filtered self-consumers; the row's
   other columns already degrade the same way). Unchanged by this
   arc; if ever deemed a UX trap it gets its OWN ticket.
4. catalog.machines[machineId].displayName VERIFIED
   (src/data/types.ts:38-42); provenance corrected (r1 nit):
   graph-flow.ts:491 delegates power to advice.ts — the direct
   catalog.machines read precedent is chain-builder-adapter.ts:199,
   and machineNameFor (:88-92) is the fallback idiom.
5. A constant +pitch/2 label shift preserves ALL S15 spacing
   invariants (label-to-label distances unchanged) — the nine-pair
   and subset pins must pass untouched.

## Revision history

- v1 (2026-08-05): initial — grounded in Michael's two reports, the
  #85 off-by-one root cause (display indexing, not geometry), the
  compare-row and node-data shapes, and the schematic label
  anchoring.
- v2 (2026-08-05): r1 BOTH NEEDS_REWORK, CONVERGED on the Axis C
  formula ([code] 1 BLOCKER + 1 IMPORTANT + 2 nits; [adversarial]
  2 MAJOR + 1 MINOR + 2 LOW): v1's `machines × perMinute` was wrong
  — the displayed machines is the SUBTREE Σ, so the formula breaks
  on any multi-stage candidate; CORRECTED to the primary stage's
  ProposedStage.outputRate (already exact, PreviewRow precedent),
  computed on CandidateRow in candidateRowsFor; the "current row
  shows R exactly" claim dropped (uniform actuals); the multi-stage
  test added to the plan as the bug-exposing pin. Axis D gains the
  off-table-machineId fallback (raw id per machineNameFor — never a
  dangling "×N "). Citations fixed (CompareRow wrapper vs
  CandidateRow; graph-flow provenance; GraphCanvas :154-156). Both
  reviewers verified Axes A + B fully sound (nothing consumes the
  0-based blueprint label; the +pitch/2 shift touches no pin; the
  N=161 band edge stays in-bounds at 1308 < 1310 < 1336).
- v3 (2026-08-05): r2 BOTH NEEDS_REWORK, CONVERGED on the unguarded
  deref ([code] 1 IMPORTANT; [adversarial] 1 MAJOR): the v2
  .find(...).outputRate would TypeError for a self-consuming
  candidate (candidateRecipesFor doesn't filter self-consumers;
  proposeChain demotes them to raw, emitting no stage for itemId) —
  the codebase's only unguarded deref against the adapter's
  never-throw idiom. FOLDED: guarded lookup with a "—" fallback + a
  bug-exposing self-consume test. r2 adversarial refuted its own
  divergence attacks (outputRate is 100%-clock count × perMinute;
  proposal root count ≡ swapMachineCountFor's ceilDiv — display
  cannot diverge from post-apply) and re-verified Axes A/B/D sound
  (raw-id fallback total; required machineId; centering shift
  pin-safe). The clock≠100 observation recorded as a PRE-EXISTING
  compare-convention property shared with the MACHINES column, out
  of this arc's scope.
- v3-r3 (2026-08-05): r3 pair CONVERGED — code-reviewer APPROVED
  (0), adversarial APPROVED (0 + 1 advisory, folded as ledger #3b:
  the live-Apply-on-dashed-row provenance recorded as pre-existing
  and out of scope). Correctness converged after 3 rounds.
