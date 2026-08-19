# P1 — solver core: feed lanes become overflow chains (#151)

**Arc:** #140 Phase 2 (FEATURE.md P1). Merged brainstorm+spec. All topology
decisions were locked interactively on 2026-08-18 (#140 decision index c24798);
this document binds to them and designs only the mechanics. Anchors verified
against `develop` @ `67d1fcd` (post-P0: `catalog.tiers` is already the parsed
table; `sliceTier` already passes it into `StageInput.capacities`).

## Already settled — do NOT re-litigate

- **Overflow chain is the solver's stated default** (c24742): Smart Splitters
  with an Overflow rule, residue rides the trunk onward, full rate delivered,
  peak ≤ B by construction. Per-lane topology override deferred, not designed.
- **Fan-in/out ≤ 3 enforced** (c24797): the solver emits merger/splitter
  cascade counts and tiers so every reported junction is buildable.
- **Buffer cost = one line in the side tables** (c24796): "standing buffer:
  N items"; nothing on the drawing.
- **Fluid depth Level 1** (c24770): pipe lanes stop getting belt-shaped
  per-machine starvation claims; they emit an unordered "lane under-supplied
  by X m³/min" finding with the nominal-ceiling caveat. Head lift → #147.
- **Rendering is P2** (c24769, ribbon + endpoint numbers): P1 produces the
  numbers the ribbon needs (entry rate, hand-off residue, final 0) but draws
  nothing.
- **Pipe `parallelCount` already suppressed** (#145, merged): `bundleEligible`
  is belt-only today.
- **Multi-item bus deferred** (#146, c24761); Somersloop #148, wells #149,
  monitor annotation declined (c24780).

## The model, grounded

The audit's chain behaviour (gap-report §1.2 @ ae266b1, header-grounded
`FGOverflowDescriptor.h:9-11`, `FGBuildableConveyorBase.h:301-305`):
node *i* is a splitter configured `machine-port → Any`, `trunk-port →
Overflow`. Trunk flow after node *i* is `S − i·d`, monotonically decreasing,
bounded by the feeding tier, never the sum of two belts. Chain ends when the
carry drops below `d`.

**The key identity: the existing head-first drain IS this arithmetic.**
`drainSpan` (`src/core/manifold.ts:285-301`) already computes
`survived = available − span·d` — exactly the trunk carry. The entry
boundaries (`floor(cumulative/d)`, `manifold.ts:385-387`) are unchanged: belt
*j* still begins serving at the machine where cumulative prior capacity is
exhausted. What changes is the **physical reading of the seam** and therefore
the peak claim:

- OLD (merged bus): residue `r` and the next belt's full flow share one line →
  `peakFlow = r + c ≤ 2B` → the x2 mark.
- NEW (overflow chain): the residue (`r < d` always, by head-first drain) rides
  its own thin line to a **seam merger** (2 inputs: residue + a tap from the
  next belt) that completes exactly the seam machine. Every trunk line carries
  ≤ its own belt's capacity ≤ B; every seam line carries ≤ d ≤ B. **No line
  ever sums two belts.** The x2 machinery retires.

Worked 8411 check (the ticket's live case): d=120, B=780, D=12720, k=17.
Entries after machines 0,6,13,19,26,… (floor(6.5·j)); stretches alternate 7 and
6 machines; residues alternate 60 and 0 — the eight 60-residues are exactly the
eight old x2 segments, now eight seam mergers. Final belt: remainder 240 →
Mk3 (270), hand-off 30 — the terminal CAPACITY SURPLUS (270 − 240), corrected
at the diff review: the original prose said "hand-off 0", conflating the tail
demand (240) with the tail belt's capacity (270). The terminal
`handoffResidue` is unused capacity, a DIFFERENT quantity from c24769's
ribbon "final 0" (onward flow to a consumer — there is none; the source
produces exactly D and the machines consume exactly D). P2 must render the
two distinctly: the terminal endpoint number is not "30/min leaves the
lane". Recorded as the P2 hand-off caveat in p1-completion.md.

## Design

### D1 — feed-lane semantics: same arithmetic, new outputs

`solveFeedLane` keeps: scaled `d`, `D = N·d`, feasibility (`d ≤ B` else
`infeasible-machine-demand`), `combineFeedBelts` (k−1 top-tier + remainder
tier), override replacement by slot (unclamped, count-checked), entry
boundaries, head-first drain, starvation findings for under-capacity
(override-broken) chains.

Per stretch the segment now reports the overflow-chain quantities:

```ts
export interface BusSegment {
  fromMachine: number;          // unchanged
  toMachine: number;            // unchanged
  entryFlow: Fraction;          // residue-in + this belt's capacity (the
                                // ribbon's reset thickness; c24769 "entry rate")
  handoffResidue: Fraction;     // trunk carry past the last machine (< d on
                                // auto-sized chains; the "hand-off" endpoint)
  beltIndex: number;            // unchanged
}
```

`peakFlow` and `parallelCount` are DELETED from the type (deletion sweep in
Tests). `entryFlow` is the old `available`; `handoffResidue` is the old
`drain.survived` — both already computed, now surfaced. The final stretch's
`handoffResidue` is 0 exactly when supply meets demand (auto-sizing
guarantees it; an oversize final override leaves a positive residue, which is
honest surplus, not an error).

**Residue bound, universal (r1 fold — the mod invariant):** residue-in is
< d for EVERY machine-bearing stretch, overrides included, not merely on
auto-sized chains. Entry boundaries derive from POST-override cumulative
capacity (`manifold.ts:376-395`: `cumulative` sums the override-replaced
capacities before the `floorDiv(d)`), so the flow surviving past stretch j
is `cumulative_j mod d < d` whenever stretch j+1 has machines. An oversize
NON-final override therefore widens its own stretch (the next entry point
moves later) instead of pushing ≥ d residue downstream; the only residue
that can reach or exceed d is the terminal `handoffResidue` (the final
surplus above), which feeds no seam. The 2-input seam merger and the ≤ d
seam line therefore hold for ALL lanes — the r1 adversarial's contrary
claim was checked and refuted on a constructed counterexample (override
175 with d=10: next entry after floor(175/10)=17, residue 175−170=5 < d).

Output lanes: `solveOutputLane` is UNCHANGED in math (break-out walk, one
belt per span, x1 by construction). Its segments carry the same new shape
with `entryFlow = handoffResidue`-free semantics: for an output segment
`entryFlow = load` (the span's collected flow at break-out) and
`handoffResidue = ZERO` (a break-out belt hands nothing onward). One segment
type, two documented readings — mirroring how `peakFlow` was already
direction-dependent ("feed: at head; output: at tail", `manifold.ts:44`).

**Findings unchanged on the belt feed side** except: `segment-over-capacity`
now fires only for an explicit override > B (a physically unbuildable single
line — the #145-shaped path, `bundleEligible`'s successor) — its `peakFlow`
field is renamed `flow` to match the new vocabulary. `starved-machines`
(partial + run) keeps belt-chain order semantics: on an overflow chain the
head-first drain order IS the physical order.

### D2 — hardware: attachments, seams, cascades (c24797)

New per-feed-lane result fields:

```ts
export interface FeedLaneHardware {
  splitters: number;        // one per machine served by trunk taps = N served
  seamMergers: number;      // one per stretch with residue-in > 0
  headCascade: Cascade | null;      // fan-out from the lane head to k belts
}
export interface Cascade {
  ways: number;             // lines being joined/split
  junctions: number;        // 3-way nodes: ceil((ways − 1) / 2)
  tiers: number;            // ceil(log3(ways))
}
```

- **splitters** = machines that draw from a trunk (every served machine has
  its overflow-splitter node) = `N` on a fully-served lane; on a starved lane,
  the count of machines that received any flow — the partially-served
  machine (`drainSpan.partialReceived > 0`) HAS a splitter node and is
  included (r1 precision fold).
- **seamMergers** = number of stretches whose residue-in is positive (the
  seam machine needs the 2-input merger). 8411: 8.
- **headCascade**: k belts must leave the lane's head; a single upstream
  point fans out through 3-way splitters. `ways = k`; `junctions =
  ceil((k−1)/2)` (each 3-way node adds 2 net lines); `tiers = ceil(log3(k))`.
  k=1 → null. The Q5 mockup pins the merger mirror: 9 ways → 4 junctions,
  2 tiers — the same formula (`ceil(8/2)=4`, `ceil(log3 9)=2`).
- Output lanes get the mirror: `collectionCascade: Cascade | null` — b
  break-out belts merge toward the downstream link through 3-way mergers,
  same formulas with `ways = b`.

Cascade math is a pure helper (`cascadeFor(ways)`) in manifold.ts — exact
integer arithmetic (no `Math.log`; `tiers` by repeated multiplication).

### D3 — standing buffer (c24796)

`FeedLaneResult.standingBufferItems: number` = `9 × splitters`.
Grounding: splitter inventory `mInventorySize = 9` [docs, gap-report §1.2
"Cost: 9 items of standing buffer per node"], and c24796's accepted framing
("a 20-machine overflow stretch holds ~180 items" = 9 × 20). Seam mergers'
transient inventory is NOT counted — the decision's arithmetic is
splitter-only, and inventing a merger term would exceed the decided scope.
Integer count of items (item counts are integral); not a Fraction. Output
lanes carry no buffer figure (no splitter chain).

### D4 — pipe lanes: Level-1 honesty (c24770)

Pipe feed lanes keep sizing (`k = ceil(D/B_pipe)` via the same
`combineFeedBelts`) and keep `infeasible-machine-demand` and the
override-shape findings. They STOP emitting `starved-machines` (belt-ordered
physics). Instead, when assigned capacity cannot meet demand (undersized
overrides: `Σ capacities < D`), the lane emits ONE unordered finding:

```ts
| {
    type: "lane-undersupplied";
    itemId: string;
    shortfall: Fraction;          // D − Σ capacity
    nominalCeiling: true;         // the caveat marker: pipe ratings are
                                  // nominal; real steady-state can sit lower
  }
```

Pipe lane segments: a pipe manifold has no ordered drain — segments and
per-machine attribution are belt physics. Pipe feed lanes emit **no
segments** and **no hardware/cascade/buffer fields** (junction behaviour is
equal-split, gap-report FICSIT-manual digest; modelling it is the declined
full sim). `belts[]` (the sized pipe runs) remains — the UI's per-run
capacities stay. Pipe OUTPUT lanes likewise drop segments; their breakouts
remain. This is the honest surface: sized runs + total-vs-capacity truth,
no fabricated order.

`FeedLaneHardware`/buffer/cascade are belt-only: the fields are
`null`/absent for pipe lanes (typed as optional with the kind discriminant
documented).

### D5 — UI consumers: mechanical silencing only (P2 owns the redesign)

The type deletions and renames touch the following sites — the COMPLETE
enumeration (r1 fold: both reviewers found the original five-site list
under-counted; grep-grounded over `parallelCount`, `peakFlow`,
`maxParallelCount`, `firstLockedTierForOneLine`). P1 adapts them
mechanically, no visual redesign (Q3/c24769 says the x2 surfaces "go
silent" under overflow; the ribbon replaces them in P2):

- `src/ui/Schematic.tsx:81,165-183` — the `parallelCount === 2` highlight
  branches: deleted (draw single lanes). The `seg.peakFlow` read (:172) and
  the `segTooltip` call (:177) move to `entryFlow` / the new signature.
- `src/ui/format.ts` — `segTooltip` (:127-146): the `parallelCount` param,
  the "N parallel lines ×" bundle string AND the `oneLineTier` param with
  its "Mk6: 1 line" suffix all deleted; the surviving single-line path's
  `seg.peakFlow` reads (:133,:139) rename to `entryFlow`. `findingText`
  (:157): `f.peakFlow` → `f.flow` (the finding rename).
  `firstLockedTierForOneLine` (:66) loses BOTH consumers (SummaryCards +
  Schematic x2 paths) and is deleted as dead code. #139's self-contradictory
  pairing ("bus up to 2 parallel" / "supports one bus line") disappears
  entirely — record in the completion note.
- `src/ui/SummaryCards.tsx:32-61` — the WHOLE block: the `bundled` filter,
  the `highestPeak` reduce (reads `peakFlow`), the `oneLineTier`
  derivation, and both copy suffixes ("· bus up to 2 parallel",
  "· {tier} supports one bus line"): deleted.
- `src/ui/FindingsPanel.tsx:88` — `finding.peakFlow` → `finding.flow`
  (the `tierFixHint` path).
- `src/ui/layout.ts` — the `parallelCount` field + passthroughs
  (:84,:238,:267): deleted; the `peakFlow` passthroughs (:83,:237,:266):
  renamed `entryFlow`.
- `src/layout/layout.ts` — the `maxParallelCount` field (:61), its sets
  (:135,:206,:243) and the max-parallel fold (:207): deleted.
- `src/ui/Blueprint.tsx:270-277` — the user-visible `bp-parallel-max`
  "x2 max" marker gated on `maxParallelCount === 2`: deleted (a genuine x2
  surface the r1 list missed).
- Pipe-lane segment consumers: any UI iterating `lane.segments` renders
  nothing for pipes (empty array — already the natural behaviour of a map).

### D6 — findings surface in stage-input/store

`sliceTier`/`toStageInput` (`src/data/stage-input.ts`) pass through
unchanged (P0 already parameterized the table). The store's finding
consumers (advice/format vocab) gain the `lane-undersupplied` rendering:
"lane under-supplied by X/min (nominal pipe ceiling)". Existing
`starved-machines` copy stays for belts.

## Tests

- **Trunk-carry endpoints** (the 8411 shape, scaled): d=120, B=780, N=13,
  D=1560, k=2 → stretch 1 m1-6 entry 780 hand-off 60; stretch 2 m7-13 entry
  840 (60+780) hand-off 0. Pins entryFlow/handoffResidue and that entry
  boundaries did not move vs the old model.
- **Full 8411 integration** (106 machines): 17 belts, 17 stretches, residues
  alternate 60/0 (8 positive) → seamMergers = 8, splitters = 106,
  standingBufferItems = 954, headCascade {ways 17, junctions 8, tiers 3}.
  Zero x2 anywhere (type-level: parallelCount no longer exists).
- **Cascade math pins**: 1→null; 2→{1,1}; 3→{1,1}; 4→{2,2}; 9→{4,2} (the Q5
  mockup's pinned 9-into-4-in-2-tiers); 17→{8,3}; 27→{13,3}.
- **Buffer**: 9 × splitters, integer.
- **Override-broken chain**: undersized override still yields
  `starved-machines` with the same boundary arithmetic (belt lanes).
- **Over-B override**: `segment-over-capacity` (field renamed `flow`) still
  fires; auto lanes never fire it.
- **Pipe feed lane**: no segments, no hardware, no buffer; undersized
  override → ONE `lane-undersupplied` with exact shortfall + nominalCeiling;
  adequate auto-sizing → no finding; `d > B_pipe` → infeasible unchanged.
- **Pipe output lane**: breakouts kept, segments empty.
- **Output belt lane**: walk unchanged; segments carry entryFlow = load,
  handoffResidue = 0; collectionCascade {ways = b} when b > 1.
- **Deletion sweep (greps run against develop @ 67d1fcd, per the memory
  rule):** `parallelCount` pins at `src/core/manifold.test.ts` (11 sites,
  incl. the two #120 describes "bounded parallel feed buses" and "parallel
  cardinality compatibility" — both DELETED, superseded by the trunk-carry
  pins), `src/layout/layout.test.ts` (3), `src/ui/parallel-feed-belts.test.tsx`
  (whole file is the x2 feature: the "2 parallel lines × 780/min · Mk6: 1
  line" pins at :135,:337 — file DELETED, replaced by a single-lane
  rendering smoke asserting the bundle string is GONE); the `peakFlow`
  name at every manifold.test.ts assertion moves to entryFlow (re-derive
  each expected value: entry includes residue-in, so old peak values carry
  over unchanged on the feed side — verify per assertion, not find-replace).
  **r1 fold — four further pin files both reviewers found unswept:**
  `src/data/stage-input.test.ts:78` (`s.peakFlow` on feed segments);
  `src/ui/format.test.ts:114-135` (the `segTooltip` describe — fixtures
  construct `peakFlow:` at :118,:130 and pin the old signature) plus
  :152-164 (the `findingText` pin constructing `peakFlow:` at :158);
  `src/ui/smoke.test.tsx:292,545,969,997,1031` (segment/finding `peakFlow`
  literals, incl. "shows a segment's honest peakFlow" — each re-pins to
  entryFlow/flow with values re-derived, not renamed blind);
  `parallel-feed-belts.test.tsx:392-396` (the `bp-parallel-max` / "x2 max"
  DOM pins — die with the file); **`src/ui/layout.test.ts` (r2 fold — the
  seventh pin file, found by BOTH r2 reviewers):** the feed pins at :80-81
  (`peakFlow.eq(480)`/`.eq(120)` inside "passes each segment's exact
  peakFlow through") and the output pin at :94 (`peakFlow.eq(30)` inside
  the "peakFlow ≠ belt capacity" describe) — both test TITLES (one it, one
  describe) also carry the old name; re-pin to entryFlow with values
  re-derived (feed
  peaks carry over unchanged; the output 30 maps to entryFlow = load).
  The "supports one bus line" copy is pinned
  ONLY in parallel-feed-belts.test.tsx (grep-verified). Final sweep gate
  before review: grep for `parallelCount`, `peakFlow`, `maxParallelCount`,
  `parallel lines`, `one bus line`, `x2 max` across src/ — all zero
  (except the finding's renamed `flow` and revision-history mentions).
  Diff-review addition: the CSS class names too (`parallel-rail`,
  `parallel-segment`, `parallel-run-label`, `bp-parallel-max`) — the r1
  adversarial found five dead selectors in app.css that the string-only
  gate missed.
- Bidirectionality log per behaviour: endpoints, seam-merger count, cascade
  formula, buffer product, pipe undersupplied, x2-string absence.

## Acceptance criteria

1. The 8411 case solves with zero parallel-line claims; every trunk line's
   entryFlow ≤ B on auto-sized lanes; the eight artifacts are now eight seam
   mergers.
2. Feed lanes report entry/hand-off endpoints per stretch (ribbon-ready),
   hardware counts, cascade counts (≤3-way by construction), and the
   standing-buffer line item.
3. Pipe lanes emit the unordered `lane-undersupplied` finding with the
   nominal-ceiling caveat and no per-machine starvation or segment claims.
4. `parallelCount`, the x2 highlights, the "N parallel lines ×" copy, and
   "bus up to 2 parallel" are gone repo-wide (grep-verified).
5. `npm test` + `npm run check` green.

## Assumptions ledger

- The overflow-chain arithmetic equals head-first drain (entry boundaries,
  residues) — grounded: gap-report §1.2's `S − i·d` model against
  `manifold.ts:285-301,385-387`; the 8411 worked check above reproduces the
  audit's eight 60-residues.
- Residue-in < d for every machine-bearing stretch, OVERRIDES INCLUDED (so
  a 2-input seam merger always suffices) — grounded by the mod invariant
  (D1): entry boundaries derive from post-override cumulative capacity
  (`manifold.ts:376-395`), so surviving flow is `cumulative mod d`; the
  Phase-1 baseline's structural bound (#140 c24726) is the auto-sized
  special case. Only the terminal handoffResidue escapes the bound (final
  surplus, no seam).
- 3-way junction cascade formulas: `junctions = ceil((ways−1)/2)`, `tiers =
  ceil(log3(ways))` — grounded by the Q5 mockup's accepted 9→4-in-2-tiers
  (c24797) which both formulas reproduce.
- Splitter standing inventory 9 — grounded: Docs.json `mInventorySize = 9`
  (gap-report §1.2), and c24796's accepted ~180-per-20-machine framing.
- No UI test pins the format bundle branch outside
  `parallel-feed-belts.test.tsx` — grounded by grep on develop @ 67d1fcd
  (the Tests section names the sweep; implementer re-runs it).

## Revision history

- v1 — initial merged brainstorm+spec; dispatched to the degraded correctness
  pair (code-reviewer + adversarial-reviewer).
- **r1 → r2** (design review r1: code-reviewer NEEDS_REWORK — 4 IMPORTANT,
  all blast-radius under-enumeration, folded; adversarial NEEDS_REWORK — 2
  IMPORTANT folded, 1 IMPORTANT REJECTED with counter-evidence). Folded:
  (1) `Blueprint.tsx` "x2 max" marker + `maxParallelCount` field/fold added
  to D5 (a missed user-visible x2 surface), its DOM pins added to the sweep;
  (2) SummaryCards' full `highestPeak`/`oneLineTier` block deleted (not just
  the bundled filter), killing "supports one bus line" too;
  `firstLockedTierForOneLine` deleted as dead; (3) the finding rename's
  consumers enumerated (`FindingsPanel.tsx:88`, `format.ts:157`); (4) the
  `peakFlow` passthroughs/reads outside the bundle branch enumerated
  (`layout.ts:83,237,266`, `format.ts:133,139`, `Schematic.tsx:172,177`);
  (5) four unswept pin files added (stage-input.test.ts, format.test.ts,
  smoke.test.tsx, the bp-parallel-max pins) plus the final grep gate;
  (6) the splitter count's partial-machine inclusion stated. REJECTED: the
  adversarial's claim that a non-final oversize override pushes residue ≥ d
  downstream — false by the mod invariant (entry boundaries use
  post-override cumulative capacity, `manifold.ts:376-395`; counterexample
  worked in D1; the code-reviewer independently confirmed the same
  invariant in the same round). The spec now states the universal bound
  instead of the auto-sized-only phrasing that invited the attack. Verified
  sound by both reviewers: the 8411 arithmetic, the cascade formulas at
  powers of 3, pipe honesty as the decided change, no locked decision
  re-opened, the single-head cascade consistent with the lane model.
  r2 goes to both correctness reviewers.
- **r2 → r3** (design review r2: code-reviewer NEEDS_REWORK — 1 IMPORTANT;
  adversarial NEEDS_REWORK — 1 IMPORTANT; BOTH the identical gap): the
  sweep enumeration was still short exactly one file —
  `src/ui/layout.test.ts` (:80-81 feed pins, :94 output pin, two describe
  titles carrying `peakFlow`), distinct from the enumerated
  `src/layout/layout.test.ts`. Folded with re-derivation notes. Both
  reviewers' file-count reconciliation confirms seven pin files total, all
  now enumerated. Everything else in the r1→r2 delta verified faithful by
  both: every D5 site resolves, no third `firstLockedTierForOneLine`
  consumer, the mod invariant re-derived and the r1 rejection re-confirmed
  (the fresh adversarial re-derived it independently), the clamped-entry
  edge cannot create a machine-bearing stretch with residue ≥ d, no `flow`
  name collision, no internal contradiction. r3 goes to both correctness
  reviewers scoped to the one-file delta.
- **r3 — CONVERGED** (design review r3: code-reviewer APPROVED_WITH_NITS +
  adversarial APPROVED_WITH_NITS, the identical single NIT — "describe
  TITLES" where one title is an `it` block; folded as "test TITLES"). The
  adversarial additionally proved the carry-over claim definitional (old
  feed `peakFlow` IS `available` = residue-in + capacity = the new
  `entryFlow`; old output `peakFlow` IS `load`), re-ran the reconciliation
  (no eighth pin file), and confirmed the fold introduced no inconsistency.
  Correctness gate closed after three rounds; the one-shot simplify pass
  follows.
