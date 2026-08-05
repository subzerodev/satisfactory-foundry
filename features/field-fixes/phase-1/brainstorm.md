# Stage 12 / Phase 1 — views at scale: readable at 161 machines (ticket #62) — brainstorm v9 (FROZEN)

**Goal.** Michael's field case: a 161-machine Plastic stage renders the
Schematic as dash-noise, the Blueprint with lane-name/pipe-lane text
overlap, and the Combined unreadable. "Readable at real scale" becomes
a designed property of all three views.

*Cite shorthand: view files = src/ui/… · `layout.ts` = src/ui/layout.ts.*

## Already settled — do NOT re-litigate

- The dm-scale geometry is SOLVER-DRIVEN and untouched (S4 frozen): this
  phase changes RENDERING only. The drawing identity + S11P0 treatments
  bind. All-Claude roster; full gate; walk at the exact 161-machine case.

## The grounded failure modes

1. **Schematic — tick noise at the pitch floor.** `LAYOUT.viewW = 960`,
   pitch clamps to [8, 48] (layout.ts:17-26); at 161 machines the ideal
   pitch 912/161 ≈ 5.7 floors to 8 → width 1336px (scrolled: true), and
   each machine rect is `pitch − 2` = 6px (Schematic.tsx:225) — 161
   six-pixel ticks reading as noise, with bus dashes at a fixed rhythm
   compounding it.
2. **Blueprint — unbounded fit-scaling + label collisions.** The SVG's
   viewBox IS decimeters and `width="100%"` (Blueprint.tsx:79-98): the
   whole floor plan compresses to the container with NO scale floor, so
   a 161-machine row downscales until machine rects are hairlines; and
   lane-name labels sit at fixed dm offsets that collide with adjacent
   dashed pipe lanes when rows are tight (Michael's "Heavy Oil Residue"
   overlap).
3. **Combined — same fit-scaling** (ChainBlueprint.tsx:85-101, plus the
   height cap :35) multiplied across sites.

## Axis 1 — Schematic: level-of-detail machine band (the drafting answer)

**Pick: band mode engages exactly when the layout FLOORS — when the
unfloored ideal pitch would fall below `minPitch` (USABLE/N < 8, i.e.
N > 114; r1 fold — derived from the existing constants instead of an
arbitrary 14px; 66-114 machines keep readable 8-13px ticks; labelPitch
weighed). Below that, STOP drawing per-machine ticks. The machine row renders as
ONE continuous band (the existing machine-row rect vocabulary) carrying
a centered `×N` count in the display face, with individual boundaries
drawn ONLY where something happens: feed entry points, output breakout
points, segment boundaries, AND any machine index a FINDING references
(r1 adversarial HIGH — starved/partial findings name arbitrary interior
machines, format.ts:120-128 / manifold.ts:103, and the band must keep
"machine 20" locatable; assumption 4's "no new math" is corrected to
"one set-union over existing solve data"). EVERY significant boundary
carries its index label in band mode. Closure: the textual layer
(findings, tooltips, override rows) references ONLY entries, breakouts,
segment bounds, and finding machines — with those marked, no referenced
index is unlocatable; unreferenced interior machines are exactly what a
drawing's break convention elides.** A real drawing never draws 161 identical ticks — it
draws a break convention + a count. Above the threshold, today's
rendering is unchanged (no churn for small stages).

## Axis 2 — Blueprint + Combined: a scale floor + scroll (the schematic's own posture)

**Pick: ONE shared scale helper used by BOTH Blueprint and
ChainBlueprint (r1 adversarial — the width logic is DUPLICATED today,
ChainBlueprint restates it at :83-86/:98-103, justified by the comment
at :27-31 — r2 cite precision; the v1 inherits-via-bp-* claim was
false): **`fitScale := min(REF_W / vbW, capH / vbH)` where `REF_W` is the
FIXED reference width (LAYOUT.viewW = 960 — the Schematic's own
posture, r3 adversarial HIGH: today's width="100%" needs NO
measurement, and a formula taking a live containerW would need
ResizeObserver plumbing the design never specified; the Schematic
precedent sidesteps measurement with the fixed reference, and so does
this) and `capH` is a PER-CALL-SITE parameter (520 Blueprint / 640
ChainBlueprint — r3 LOW). This is today's effective meet scale
INCLUDING the height cap (r2 adversarial HIGH: the
fixed height attribute PARTICIPATES in today's scale, so a width-only
fitScale would CHANGE small-plan renders — the smelter smoke case
letterboxes at 1 px/dm today but would jump to 4.5; and the cap was
protecting deep-narrow plans, r2 MEDIUM). Then `scale = max(fitScale,
MIN_PX_PER_DM)`**, and the SVG renders EXPLICIT `width = vbW * scale`,
`height = vbH * scale` — both axes from the one scale,
preserveAspectRatio irrelevant. Consequences, now exact: DISENGAGED
(scale == fitScale): height-governed plans render pixel-identical to
today (the cap still bounds them); width-governed plans are identical
ONLY where the live column equals 960 (viewport ≈ 992) — on NARROWER
columns they render LARGER under the fixed reference (toward
readability — accepted; r5 adversarial killed the "≤ 960 identical"
clause), and on WIDER screens they shrink ~6.25% (the live 1024px content column —
`.app` is CONTENT-box, no border-box reset exists, so the 16px padding
sits OUTSIDE max-width; r5 code-reviewer corrected the v7 992px/3.3%
figure — becomes the fixed 960 reference; r4 adversarial killed the
unconditional-identity claim).
This bounded delta is ACCEPTED and stated: it also makes the Blueprint
consistent with the Schematic, which already renders fixed-960
(Schematic.tsx:197) in the same column with no complaint; FLOORED (readability wins)
the render exceeds the reference and scrolls — inside a NEW
dedicated scroll wrapper (`.bp-scroll`, mirroring `.schematic-scroll`;
r3 MEDIUM: `.bp-svg`'s overflow: visible is LOAD-BEARING for
out-of-box mark labels and must not be mode-flipped) — which also
— but deep-NARROW plans are explicitly OUT of the floor's
scope (r3 code-reviewer, computed: a 3× Quantum Encoder stage sits at
capH/vbH ≈ 0.68 px/dm, an order of magnitude ABOVE the 0.06 floor —
the floor never engages, and at 0.68 px/dm a 220dm encoder renders
~150px wide: readable already; the v4 "floor also fixes deep plans"
claim was INVERTED and is WITHDRAWN — deep plans keep today's cap
behavior). The svg ATTRIBUTES change from
width="100%"+meet to explicit px in all cases — the smoke pin at
smoke.test.tsx:350-351 churns DELIBERATELY (enumerated) — and a
letterboxed (narrower-than-wrapper) plan keeps its centering via
`margin-inline: auto` on the block svg (r3 HIGH: explicit width would
otherwise left-align what xMidYMid centers today; one CSS line,
stated). MIN_PX_PER_DM target ~0.06 px/dm
(oil_refinery 100dm -> >=6px machines); the 161-machine row (161 x
110dm pitch ~ 17710dm) renders ~1063px wide — scrollable, not absurd
(r1-computed against footprints.ts).**

**Label collisions: paint-order halo; the EXISTING outside-anchoring
stays.** Lane names get `paint-order: stroke` with a `--bg` stroke (the
drafting halo, both media via the token). The current asymmetry (feeds
above, outputs below — Blueprint.tsx:222) is CORRECT
outside-of-the-stack placement and is KEPT (r1 — v1's uniform "above"
would have flipped output labels into the machine row); the HOR overlap
is label-on-lane, resolved by the halo, with the below-offset clearance
walk-tuned if residual touch remains.

## Axis 3 — non-goals

- No geometry/solver changes; no zoom UI (scroll is the navigation, as
  everywhere else in the app); no virtualization; no per-view scale
  preferences; no RF canvas changes.
- The Combined view applies the SAME shared scale helper at its own
  call site (the logic is duplicated today, not shared — r1 fix of the
  false claim). Axis 1's band does not apply to Combined (no tick row).

## Test plan sketch

- layout: the LOD threshold decision is pure (band mode ⇔ the floor
  engages, N > 114 — r2 fix: the test plan had kept the dropped 14px
  wording) — unit-test the mode flag + the significant-boundary set at
  161 machines (entries, breakouts, segment bounds, AND
  finding-referenced machines — r2 fix: "only" contradicted fold 2).
- Schematic render (SSR-string posture): band mode emits ONE band rect +
  `×161` text and NOT 161 machine rects; small-stage mode unchanged
  (existing pins stay green).
- Blueprint: the width formula (floor engages at the 161 case, not at
  small cases) — unit-test the computed width; halo class present.
- Churned pins, enumerated: the smoke svg-attribute pin
  (smoke.test.tsx:350-351, width=100%+meet -> explicit px); all else
  expected stable (band gated above N=114).
- Both-media walk AT THE 161-MACHINE CASE (Michael's chain: Plastic ×161
  + the copper line): schematic shows the band + count + significant
  boundaries, readable; blueprint scrolls at a readable scale, no label
  overlap anywhere (the Heavy Oil Residue case specifically); combined
  readable; small plans unchanged.

## Assumptions ledger

1. layout.ts pitch clamp + LAYOUT constants read this session
   (:17-26); machine rect width `pitch − 2` (Schematic.tsx:225);
   scrolled flag exists (layout.ts:36).
2. Blueprint/Combined viewBox-in-dm + width="100%" read this session
   (Blueprint.tsx:79-98, ChainBlueprint.tsx:85-101). The exact
   MIN_PX_PER_DM value requires the dm machine footprint sizes
   (layout constants in the S4 blueprint layer) — derived and pinned at
   spec/implementation, walk-verified.
3. `paint-order: stroke` on SVG text is Baseline-supported and the halo
   reads correctly on both papers via var(--bg) (walk-verified).
4. The significant-boundary set's EXISTING members (entries, breakouts,
   segment bounds) are already computed (boundaryX consumers,
   layout.ts:64-112) — the band reuses them; the finding-machine
   members are item 6's one set-union (r2 cross-ref).
5. Suite count re-baselined at implementation (741 was stated, not
   recounted — r1 flag).
6. The finding-referenced machine set derives from existing solve
   findings (format.ts:120-128 consumers) — one set-union, the
   corrected scope of the no-new-math claim.

## Revision history

- v1 (2026-08-05): initial — grounded in this session's reads of the
  pitch clamp, the fit-scaling seams, and Michael's numeric case
  (912/161 → pitch floor → 6px ticks).
- v2 (2026-08-05): dual-review r1 — BOTH NEEDS_REWORK ([code-reviewer]
  2 IMPORTANT + 2 NITs; [adversarial] 1 HIGH + 2 MEDIUM + 3 LOW),
  heavily overlapping; all folded: band mode keeps finding-referenced
  machine indices locatable (the HIGH; no-new-math corrected); the
  scale floor drives BOTH axes explicitly (meet + height caps dropped
  in floored mode — they could silently defeat a width-only floor); the
  shared scale helper applied at BOTH call sites (inherits-via-bp-* was
  false); the band threshold derived from the layout's own floor
  (N > 114) instead of an arbitrary 14px; the feed-above/output-below
  asymmetry KEPT (uniform-above would flip outputs into the machine
  row); the smoke svg-attribute churn enumerated; suite count marked
  re-baseline. Confirmed sound by r1: the numeric case (1336px/6px
  ticks), the scroll-vs-compress diagnosis (schematic scrolls; the
  Blueprint compresses), the significant-boundary data availability,
  the halo grounding, SSR band-pin feasibility.
- v3 (2026-08-05): r2 — [code-reviewer] NEEDS_REWORK (2 IMPORTANT + 1
  NIT, all folded): the test-plan section had kept the pre-fold
  language (the dropped 14px threshold; the "only" that excluded
  finding-machines) — both rewritten to match the body; ledger 4
  cross-referenced to 6. All six v2 folds verified sound against
  source (N>114 recomputed at the clamp; the reference-set closure
  grep-verified complete incl. segmentErrored's segment-granularity
  consumption; the meet/height-cap diagnosis; the duplicated width
  logic; the label asymmetry).
- v4 (2026-08-05): r2 adversarial NEEDS_REWORK (1 HIGH + 2 MEDIUM; the
  test-plan 14px item was already folded in v3 from the code-reviewer's
  identical catch). Folds: **the scale formula redefined so fitScale IS
  today's effective meet scale including the height cap** — the HIGH
  proved the v2/v3 width-only fitScale changed small-plan renders (the
  smelter case: 1 px/dm today vs 4.5 under the old formula), and the
  MEDIUM proved deep-narrow plans lost the cap's protection; under v4
  disengaged mode is exactly today's render and the floor lifts ONLY
  for readability (which deliberately also fixes deep plans — stated; [withdrawn v6]).
  ChainBlueprint cite precision (:83-86/:98-103). r2 confirmed sound:
  the N>114 arithmetic + the honest 66-114 zone, the textual closure
  (grep-complete incl. the machine-1 head literals), the shared-helper
  coherence.
- v5 (2026-08-05): r3 — [adversarial] NEEDS_REWORK (2 HIGH + 1 MEDIUM
  + 1 LOW, all folded): fitScale's width input becomes the FIXED
  reference (LAYOUT.viewW 960, the Schematic's real posture — no
  measurement plumbing; the containerW input had no source);
  letterbox centering preserved via margin-inline auto (stated, one
  line); the floored scroll lives in a NEW .bp-scroll wrapper
  (.bp-svg overflow: visible is load-bearing for out-of-box labels);
  capH parameterized per call site (520/640). The floor arithmetic,
  deep-plan fix [withdrawn v6], N>114 gate, textual closure, and helper-at-both-sites
  all confirmed sound this round.
- v6 (2026-08-05): r3 [code-reviewer] NEEDS_REWORK (1 IMPORTANT + 1
  NIT, folded): the v4 deep-plan-fix claim was arithmetically INVERTED
  (the Quantum Encoder case sits at ~0.68 px/dm, far above the floor,
  which never engages and would render WORSE if it did) — claim
  WITHDRAWN; the floor's scope is WIDE plans (Michael's case); deep
  plans keep the cap and are readable today. The fitScale redefinition
  + the smelter pixel-identity + cite precision confirmed sound. Both
  r3 verdicts (this + the adversarial's REF_W/.bp-scroll/centering/
  capH folds in v5) now fully dispositioned.
- v7 (2026-08-05): r4 — [code-reviewer] APPROVED_WITH_NITS (1:
  supersession markers on the v4/v5 history lines, folded);
  [adversarial] NEEDS_REWORK (1 IMPORTANT, folded): the disengaged
  "pixel-identical" claim over-reached on the width axis — a
  width-governed plan on a wide screen shrinks (992→3.3% as v7 stated
  it; corrected to 1024→6.25% in v8 — .app is content-box); the claim
  is bounded and the delta stated + accepted (with the Schematic's fixed-960 posture as the
  consistency argument). The behavior itself (fixed REF_W) was
  confirmed correct and r3-forced; composites (b) wrapper/centering
  bi-view coverage, (c) no-Michael-complaint-left-unfixed, and (d)
  implementability all held under refutation.
- v8 (2026-08-05): r5 [code-reviewer] NEEDS_REWORK (1 IMPORTANT,
  folded): the v7 delta arithmetic was off 2× — `.app` has NO
  border-box (content-box default, the sole stylesheet carries no
  reset), so max-width bounds the CONTENT at 1024px with padding
  outside; the width-governed disengaged shrink is 960/1024 ≈ 6.25%,
  not 3.3%. Figures corrected in body + history; the bounded-accepted
  conclusion and the Schematic-consistency argument survive unchanged
  (the Schematic already renders 960 in the same 1024 column).
- v9 (2026-08-05): r5 [adversarial] NEEDS_REWORK (1 MEDIUM, folded):
  the "width-governed ≤ 960 identical" clause was the mirror
  over-reach — narrow columns render LARGER under the fixed 960
  reference (identity holds only at exactly the 960 column). The
  bounded statement is now complete on both sides: narrower → larger
  (toward readability, accepted), 960 column → identical, wider →
  ~6.25% smaller (the r5 code-reviewer's content-box arithmetic
  supersedes the adversarial's border-box-assumed 992/3.3% — .app has
  no border-box, grep-proven). Its refutation otherwise confirmed:
  the wide-screen ceiling, all cites, no other residual identity
  language, and "once folded, the loop is genuinely DONE."
- v9-simplify (2026-08-05): one-shot simplify pass APPROVED_WITH_NITS
  (2, dispositioned): the shared-helper check recorded as real
  de-duplication (no action); the document-shape nit (inline revision
  provenance woven through the decided prose) folds at the
  implementer-prompt level per the reviewer's own recommendation —
  the prompt states the decided design declaratively; this doc keeps
  its transcript. Probes (a) band-vs-pitch-floor and (b) the
  scale-floor parameterization both CLEARED on grounding. FROZEN.
