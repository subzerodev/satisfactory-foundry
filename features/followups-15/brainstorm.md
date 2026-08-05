# Stage 15 combined — chain-engine disposition + band label declutter (tickets #77 + #78) — brainstorm v3 — FROZEN 2026-08-05

> **FROZEN.** Correctness: r1 folded (converged Axis B IMPORTANTs);
> r2 BOTH APPROVED_WITH_NITS (citation-precision nits, folded in
> this version). Simplify disposition recorded in the revision
> history. Implementation contract for tickets #77 + #78.

**Goal.** Michael's call-up (2026-08-05, verbatim): "ok work on that
77 and 78".

*Cites: ui/layout.ts = src/ui/layout.ts (schematic geometry);
layout/layout.ts = src/layout/layout.ts (the engine) — same-named
files, prefix per this legend (r2 nit folded).*

## Already settled — do NOT re-litigate

- All S12–S14 decisions stand (band mode + significant set, the
  restored schematic, the kept LinkInspector surface, tabs, gutter,
  override table). All-Claude roster; full gate; walks at Wire ×28 +
  Plastic ×161, both themes.

## Grounded current state (this session)

1. **#77 — the deletion premise is DEAD (pickup grounding, posted on
   #77):** `drawnDistanceDm` (chain-view.ts:112-129) derives site
   origins via `buildChain` → `layoutChain`, whose Step-2 scale
   K = max over ALL site pairs of requiredScaleForPair
   (layout.ts:389-399+) — the measured distance between two stages
   depends on every OTHER stage's canvas position. The ticket's
   byte-identical acceptance therefore forbids deleting the engine:
   any direct two-site derivation changes values whenever a third
   stage forces K up. Full deletion = a user-visible semantics
   change to the LinkInspector measure feed → out of scope absent
   Michael's explicit call (recorded).
2. **chain-view export surface:** solvedStageIds (:57),
   buildChainSites (:66), buildChain (:93) are exported with ZERO
   external consumers (S15 diff-simplify finding); their only caller
   is drawnDistanceDm in the same file. nearestEdgeConnector stays
   exported (chain-view.test.ts imports it); drawnDistanceDm etc.
   stay exported (LinkInspector). layoutChain stays exported
   (layout.test.ts + buildChain).
3. **#78 — band label mechanics (arithmetic CORRECTED, r1 both
   reviewers):** MachineBand (Schematic.tsx:176-216) renders, for
   EVERY significant index, a boundary tick + an index label at
   xOf(index) = machines[index−1].x. significant = set-union of
   entries/breakouts/segment-bounds/finding-referenced
   (layout.ts:103-143), exposed on SchematicLayout (:57). The
   rendered band pitch is ALWAYS the clamped minPitch = 8px (the
   unfloored 5.7 only decides band mode, layout.ts:210-214) — and
   the real crowding source is CONSECUTIVE significant indices: the
   pinned N=161 set (ui/layout.test.ts:161-168) — an opening pair
   {1,2}, triples {16,17,18} … {144,145,146}, the finding pair
   {148,149} (gap at 147), and the boundary pair {160,161} (r2:
   not uniformly triples) — has consecutive members at 8px spacing vs ~12px
   two-digit width at the 10px mono label font (app.css:511) — the
   85 measured crossings. The band's ×N count text
   (Schematic.tsx:198-200, y = top+24 — a different row from the
   labels at top+52, so labels can never collide with it) already
   shows the total. Non-band mode already THINS labels
   (machines[].labeled via labelStep, LAYOUT.labelPitch = 20 — the
   in-repo precedent and the SAME shared constant).

## Axis A — #77: internalize + pin + record (NOT delete)

**Pick: the honest ticket-conformant outcome.**
- De-export solvedStageIds, buildChainSites, buildChain in
  chain-view.ts (module-private functions; zero external consumers —
  compile-enforced by the de-export itself).
- **NEW value pin:** a drawnDistanceDm unit test on a THREE-stage
  scenario that pins exact distances AND documents the global
  coupling (moving stage C changes the A↔B distance because K is a
  max over all pairs) — the pin that makes the byte-identical
  contract explicit and protects any future re-scope.
- The engine (layoutChain + helpers + its layout.test.ts blocks)
  stays UNCHANGED — recorded on #77 as value-load-bearing. The
  future re-scope (a pure two-site measure) is a Michael-call
  behavior change with its OWN design ticket **#81** (created at r1
  fold per the hard follow-on rule — r1 adversarial MEDIUM), carded
  on the board awaiting his call.
- #77's acceptance line is superseded by this decision (the
  "engine deleted" clause was written before the K-coupling
  grounding; the decision comment on #77 carries the supersession —
  legitimate without Michael because the user-visible byte-identical
  contract is preserved; only delete-vs-internalize changes, r1
  adversarial confirmed).
- The pin's concrete case (r1 adversarial constructed + verified):
  three smelters (bbox 80×160), A=(0,0), B=(100,0); with C=(0,300)
  K is driven by A-B → A↔B nearest-edge = 80dm; moving C to (50,5)
  drives K via the C pairs → A↔B = 240dm. Grid rounding and K_MIN
  do not decouple the pair.

## Axis B — #78: thin the band's labels, keep every tick

**Pick: a pure labeled-subset with finding-priority, computed in
layout.ts.**
- SchematicLayout gains `labeledSignificant: number[]` (empty when
  !band): the subset of `significant` that carries an index LABEL.
  Ticks are UNCHANGED — every significant machine keeps its boundary
  tick (the break-convention geometry stays; only the text thins).
- The rule (pure, deterministic):
  1. PRIORITY: every finding-referenced machine is labeled
     (significantMachines already collects these; the set is split
     out so the priority tier is known). The S12P1 findability
     invariant holds where it is load-bearing — the findings panel
     names exactly these indices. Accepted residual: two finding
     machines closer than the pitch may still crowd (findings are
     rare; naming correctness beats aesthetics; stated).
  2. GREEDY FILL ascending over the remaining significant indices —
     **the kept set is PRE-SEEDED with the entire priority tier**
     (r1 BOTH reviewers, the converged IMPORTANT: without seeding,
     a greedy label can land < labelPitch from a priority label —
     concrete case at the pinned N=161 set: greedy candidate 146
     sits 2 indices = 16px from priority 148): keep index m's label
     iff its px distance ((m − k) × pitch) to the nearest kept
     label on EITHER side — priority or greedy — ≥ LAYOUT.labelPitch
     (20; the SAME constant the non-band labelStep thinning uses).
     In band mode pitch is always the clamped 8, so the rule keeps
     labels ≥ 3 indices = 24px apart — clearing the ~18px
     worst-case three-digit width at the 10px font by construction
     (r1 adversarial verified).
  3. No last-index anchor: the band's ×N count already communicates
     the total, so losing the last label to thinning costs nothing
     (r1 adversarial verified: the ×N text sits at y = top+24, a
     different row from the labels at top+52).
- MachineBand renders the tick for every significant index, the
  label only when the index is in labeledSignificant.
- Wire ×28 unaffected (band is off below N=115); non-band labeling
  untouched.

## Non-goals

- No engine deletion or drawn-distance semantics change (#77
  decision above); no significant-set change (ticks identical); no
  band-count/rect changes; no schematic changes beyond the label
  subset; no Blueprint/store changes.

## Test plan sketch

- #77: the three de-exports compile-verified (tsc fails on any
  external import); the NEW three-stage drawnDistanceDm pin (exact
  values + the move-C-changes-A↔B coupling assertion); existing
  chain-view/layout tests untouched and green.
- #78: pure unit tests on the subset rule — priority machines always
  present; greedy spacing ≥ labelPitch/pitch indices apart;
  the dense fixture yields zero adjacent-label crossings among
  GREEDY-KEPT labels by construction (band pitch 8 ⇒ minimum kept
  gap 3 indices = 24px center-to-center; text-anchor middle ⇒
  inner-edge clearance 24 − 9 − 9 = 6px at the 18px three-digit
  worst case — r2 corrected margin); band=false ⇒ labeledSignificant empty; SSR pin that
  the band renders MORE ticks than labels on the dense fixture.
- Bidirectionality log per behavior —
  features/followups-15/r2-verification.log.
- Both-media walk (Wire ×28 + Plastic ×161, both themes): the
  collision scan INCLUDING machine-label×machine-label returns ZERO
  on the schematic EXCEPT the disclosed priority-priority residual —
  on this fixture exactly the {148,149} finding pair (both
  force-kept 8px apart, ~10px overlap BY DESIGN; r2 adversarial
  INFO) — the walk asserts the crossing set is exactly that pair,
  distinguishing the accepted residual from any greedy regression; ticks visibly intact at thinned positions;
  LinkInspector drawn-distance readout unchanged on a saved
  multi-stage plan (the value pin's live twin).

## Assumptions ledger

1. The K-coupling grounding (layout.ts:389-399 read this session;
   posted on #77) — the load-bearing fact for Axis A's shape.
2. chain-view.test.ts imports nearestEdgeConnector but NOT the three
   de-export candidates (verified S14; re-verify at implementation —
   if any kept test imports one, that test moves to the internal
   surface via the public drawnDistanceDm instead).
3. The label glyph widths (two-digit ≈ 12px, three-digit ≈ 18px at
   the 10px mono label size — app.css:511, cite corrected r1) vs
   the ≥24px kept spacing at band pitch 8 — the greedy rule clears
   by construction; the walk scan is the visual gate.
4. significantMachines currently returns one merged set; the split
   (finding-tier vs rest) is an internal refactor of that function
   with the merged set unchanged — ticks-identical is ENFORCED by
   the existing exact pin layout.test.ts:161-168 (stated as fact,
   r1: it pins the full significant array and does NOT pin any
   label count, so labeledSignificant adds churn-free; the SSR band
   pin smoke.test.tsx:274-289 also stands).

## Revision history

- v1 (2026-08-05): initial — grounded in the pickup grounding on #77
  (the K-coupling kill), the MachineBand/significant mechanics, the
  labelPitch precedent, and the measured 85-crossing walk evidence.
- v2 (2026-08-05): r1 — code-reviewer NEEDS_REWORK (2 IMPORTANT + 2
  nits), adversarial APPROVED_WITH_NITS (1 MEDIUM + 4 LOW),
  converged on the Axis B gaps; all folded: (1) the greedy kept-set
  is explicitly PRE-SEEDED with the priority tier and every
  candidate checks against ALL kept labels (the 146-vs-148 16px
  counterexample); (2) the crowding arithmetic corrected — band
  pitch is always the clamped 8, the crowding source is consecutive
  significant triples at 8px, the rule yields ≥3-index/24px kept
  spacing clearing the 18px worst case at the 10px font; (3) cites
  corrected (MachineBand :176-216, ×N text :198-200 on its own row,
  label font 10px); (4) Assumption #4 stated as fact
  (layout.test.ts:161-168 pins significant exactly; nothing pins
  label count); (5) the MEDIUM ticket-rule gap discharged — the
  future two-site-measure re-scope now has its OWN design ticket
  #81, carded. BOTH reviewers independently confirmed the
  K-coupling claim (the adversarial constructed the 80dm→240dm
  numeric case, folded into the pin's test plan) and the zero
  external consumers of the three de-export candidates.
- v3 (2026-08-05): r2 BOTH APPROVED_WITH_NITS — CONVERGED; nits
  folded: the same-named-file cite legend hardened (ui/ vs layout/
  prefixes); the test-plan margin corrected to the real by-
  construction guarantee (24px center-to-center, 6px inner-edge
  clearance under text-anchor middle — not the generic 20px/2px);
  the pinned-set characterization made exact (pair {1,2}, triples,
  the {148,149} finding pair, the {160,161} tail); the walk
  criterion adjusted per the r2 adversarial INFO — the {148,149}
  priority-priority overlap manifests BY DESIGN on the walk fixture,
  so the scan asserts the crossing set is exactly that pair. r2 also
  verified: the seeded rule closes the 146-vs-148 case and every
  attempted new counterexample (incl. text-anchor-middle half-width
  analysis), band pitch cannot clamp below 8 for any N, #81
  satisfies the follow-on rule. FROZEN on the simplify disposition
  (recorded next).
