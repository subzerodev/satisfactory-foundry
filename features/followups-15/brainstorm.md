# Stage 15 combined — chain-engine disposition + band label declutter (tickets #77 + #78) — brainstorm v1

**Goal.** Michael's call-up (2026-08-05, verbatim): "ok work on that
77 and 78".

*Cites: view files = src/ui/…; engine = src/layout/layout.ts.*

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
3. **#78 — band label mechanics:** MachineBand (Schematic.tsx:177-
   215) renders, for EVERY significant index, a boundary tick + an
   index label at xOf(index) = machines[index−1].x. significant =
   set-union of entries/breakouts/segment-bounds/finding-referenced
   (layout.ts:103-143), exposed on SchematicLayout (:57). At Plastic
   ×161: breakouts every 3 machines, pitch ≈ 5.7px → labels ~17px
   apart vs ~12px two-digit width → the 85 measured crossings. The
   band's ×N count text (Schematic.tsx:188-190) already shows the
   total. Non-band mode already THINS labels (machines[].labeled via
   labelStep, LAYOUT.labelPitch = 20 — the in-repo precedent).

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
  stays UNCHANGED — recorded on #77 as value-load-bearing, with the
  future re-scope (a pure two-site measure) named as a Michael-call
  behavior change, not a refactor.
- #77's acceptance line is superseded by this decision (the
  "engine deleted" clause was written before the K-coupling
  grounding; the decision comment on #77 carries the supersession).

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
  2. GREEDY FILL ascending over the remaining significant indices:
     keep index m's label iff its px distance ((m − k) × pitch,
     nearest kept neighbor on either side) ≥ LAYOUT.labelPitch (20 —
     the SAME constant the non-band labelStep thinning uses; no new
     constant).
  3. No last-index anchor: the band's ×N count already communicates
     the total, so losing the last label to thinning costs nothing
     (stated — the r-review should check this reasoning).
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
  dense-breakout fixture (significance every 3 at floored pitch)
  yields zero adjacent-label crossings by construction ((kept gap)
  × pitch ≥ 20 > 12px two-digit width; a 3-digit 18px label at
  exactly 20px spacing clears by 2px — stated, the walk scan gates
  the visual); band=false ⇒ labeledSignificant empty; SSR pin that
  the band renders MORE ticks than labels on the dense fixture.
- Bidirectionality log per behavior —
  features/followups-15/r2-verification.log.
- Both-media walk (Wire ×28 + Plastic ×161, both themes): the
  collision scan INCLUDING machine-label×machine-label returns ZERO
  on the schematic; ticks visibly intact at thinned positions;
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
   the 11px mono label size) vs labelPitch 20 — the greedy rule
   clears by construction; the walk scan is the visual gate.
4. significantMachines currently returns one merged set; the split
   (finding-tier vs rest) is an internal refactor of that function
   with the merged set unchanged (ticks identical — pinned by
   existing band tests if any, else by the SSR tick count).

## Revision history

- v1 (2026-08-05): initial — grounded in the pickup grounding on #77
  (the K-coupling kill), the MachineBand/significant mechanics, the
  labelPitch precedent, and the measured 85-crossing walk evidence.
