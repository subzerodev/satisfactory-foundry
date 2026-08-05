# Stage 12 / P2+P3 combined — clarity + views navigation (tickets #65 + #64) — brainstorm v6 — FROZEN 2026-08-05

> **FROZEN.** Correctness: r4 pair APPROVED (0+0) on v5; scoped r5
> pair APPROVED (0+0) on the v6 simplify folds. Simplify:
> APPROVED_WITH_NITS (3), all dispositioned (v6 history). This is
> the implementation contract for tickets #64 + #65.

**Goal.** Michael's fix-all-now directive (epic #59 decision 2026-08-05).
Three fixes: (A) override rows labeled + grouped; (B) one recipe-less
vocabulary; (C) labels OFF the lanes + views open at a readable zoom
with panning. Evidence: his Computer ×40 screenshot — the output label
garbled ON its orange lane despite the P1 halo; bare "Feed 1" rows with
no lane grouping or explanation.

*Cites: view files = src/ui/….*

## Already settled — do NOT re-litigate

- S12P1 (v10 frozen): the LOD band, the scale floor
  (min(REF_W/vbW, min(vbH,capH)/vbH) floored at 0.06), .bp-scroll,
  explicit px, the halo (stays as defense-in-depth). All prior stage
  identity/spacing decisions. All-Claude roster; full gate; walks at
  Michael's cases (Computer ×40 AND Plastic ×161) in both media.

## Grounded current state

1. Override rows (LaneOverrides.tsx:63-79): the lane wrapper carries
   only data-item — NO item heading, NO panel explanation; rows read
   "Feed 1 · 480/min · enters at head" with a bare input.
2. Blueprint labels (Blueprint.tsx:221-227): feed label above, output
   below its own bus with 7dm clearance AT EVERY SCALE (both offsets
   and the 11-dm font scale together — r1 adversarial killed the v1
   "small scales" diagnosis). The REAL mechanism is the P1 doc's own:
   ADJACENT-lane crowding at LANE_SPACING=60 (layout/layout.ts:77) —
   a label clears its own lane but lands on its NEIGHBOR when rows
   stack tight (Michael's "Computer" label under the machine row).
3. Unsolved message (ChainBlueprint.tsx:98-99): "N stage(s) not shown —
   unsolved" vs the plate's "no recipe" vs findings "No warnings".

## Axis A — override panel clarity (#65a)

**Pick: the lane-overrides section gains (1) a panel heading in the
drafting label idiom: "BELT LOAD OVERRIDES" with a one-line sub-label
"type a rate to override a belt's load · empty = computed"; (2) each
.lane-overrides-lane gains an item heading (the catalog displayName,
mono 11px letter-spaced uppercase — the schedule-header idiom) so
"Feed 1" rows group under their item. Markup additions in LaneOverrides.tsx + one CSS line (the heading
spans the lane grid via grid-column: 1 / -1); idioms reused, no new
tokens.**

## Axis B — one recipe-less vocabulary (#65b)

**Pick: ChainBlueprint's skip note becomes "N stage(s) not drawn — no
recipe or invalid settings" (r1 adversarial: SolveState has THREE
statuses and `invalid` stages HAVE a recipe — the v1 "without a
recipe" phrase was false for them; this phrase is accurate for
idle + invalid and calm). The findings panel is UNTOUCHED ("No
warnings" is about lane findings — correct; the alarm came from the
word "unsolved", now gone).**

## Axis C — labels off lanes + initial readable zoom (#64)

**C1 — HTML label gutter (r1 BOTH reviewers — the v1 in-SVG dm gutter
is dead: it widened vbW and perturbed the frozen fitScale, and its
dm-scaled labels were sub-pixel at floor zoom anyway). The lane
labels LEAVE the SVG entirely: a screen-space HTML gutter column sits
LEFT of .bp-scroll (a flex row: [.bp-gutter][.bp-scroll>svg]), each
label positioned at its lane's rendered y — `(laneY_dm − viewBoxMinY)
× scale` px (r2 code-reviewer IMPORTANT: the viewBox origin is
NEGATIVE for every real stage, the smelter's minY is −100 — bare
laneY×scale would misplace every label), right-aligned, mono 11px SCREEN px — and rendered ONLY at DETAIL
zoom (r2 adversarial IMPORTANT: at floor zoom adjacent lanes sit
60dm × 0.06 = 3.6px apart in the gutter while labels are 11px tall —
label-on-label crowding, the on-lane problem's twin; at FIT the
gutter collapses and the view is the geometry overview — names are
DETAIL's job, stated); the SVG lane-name <text> elements are REMOVED
(the halo stays only on mark labels). Zero viewBox change → zero
fitScale coupling → the smelter viewBox/width/height pins DON'T
churn.** The schematic's screen-space labels are fine — untouched.

**C1 scope (r3 adversarial IMPORTANT): the gutter + the lane-name
<text> removal are Blueprint-ONLY.** ChainBlueprint renders no lanes
and no .bp-lane-name text at all (its only text chrome is the
chain-bp-name site label, ChainBlueprint.tsx:204) — there is nothing
to gutter; a single left column cannot represent lanes from sites
stacked in 2D chain space (same-y collisions across sites); and the
single-site px formula would be wrong there anyway — each site is
rendered site-local then translated by (originX − fx, originY − fy)
(ChainBlueprint.tsx:167), so a lane's chain-world y needs the
per-site translate term the formula omits. The Combined view keeps
its lane-less site overview.

**C2 — initial readable zoom + pan, in BOTH blueprint views
(Blueprint AND ChainBlueprint — r3 adversarial: the Combined view
shares .bp-scroll and restates the same fitScale-at-cap math
(ChainBlueprint.tsx:90,:106-107), and a floored multi-site chain is
exactly as unreadable as a floored single stage; Michael's "the
other views are not readable at all" names it). THIS SUPERSEDES the
P1 frozen "no zoom UI" non-goal (named per r1 — justified by
Michael's explicit "we need to start zoomed in" + "fix all issues
now" directives).**
Open scale = max(fitScale, READABLE_PX_PER_DM) with READABLE = 1.0
(natural size — making the toggle label honest): small plans open
exactly as today (fit ≥ 1 → unchanged, the natural-size posture
preserved), big plans open at 1 px/dm readable detail. The toggle
(quiet-mono buttons; mounted iff fitScale(w, h, cap) < 1 — the ONE
canonical gate, every other mention defers here (simplify nit);
per-view presentation useState): [FIT | DETAIL] — DETAIL = 1 px/dm,
FIT = the P1 fit/floor scale. ChainBlueprint gets the toggle WITHOUT a gutter (C1 scope).
Pan = native scroll (head-anchored passively via scrollLeft 0 —
stated as passive, r1 nit). **.bp-scroll KEEPS overflow: auto — the
r2 "→ overflow-x: auto" fold is REVERTED (r3 adversarial IMPORTANT:
it lands on a class ChainBlueprint shares, unconsidered — and it was
a literal no-op anyway: per the CSS overflow computed-value rule, a
lone overflow-x: auto computes overflow-y to auto, identical to
overflow: auto).** The invariant that actually keeps gutter labels
aligned is stated instead: .bp-scroll has NO height cap, so the
explicit-px svg sizes it and the inner vertical scrollbar never
engages — vertical pan is page scroll, which moves the in-flow
gutter with it; only horizontal pan happens inside .bp-scroll, and
the gutter sits to its left, outside the scrolling box, by design.
The gutter labels reposition with the active scale (same px math).

## Non-goals

- No wheel-zoom/pinch (native scroll is the navigation; the toggle
  covers the two useful scales); no schematic changes beyond Axis B's
  none; no RF canvas changes; no solver/geometry changes (the gutter
  is an HTML column outside the SVG — zero viewBox/layout impact);
  no Combined-view gutter (C1 scope — ChainBlueprint has no lanes to
  label; it gets C2's toggle only).

## Test plan sketch

- LaneOverrides SSR: heading + sub-label + per-lane item headings —
  via the EXISTING App itemName prop pattern (App.tsx:264, already
  threaded to Schematic/FindingsPanel; r1 — named now, not deferred).
  The heading spans the lane grid via grid-column: 1 / -1 (one CSS
  line — the "markup only" claim corrected, r1 nit).
- ChainBlueprint: the skip note text pinned to the new phrase.
- gutter: label y positions = (laneY − minY) × scale (unit-testable
  from the component's computed positions); the zoom toggle switches
  svg width/height between fit-scale and 1 px/dm values — in BOTH
  views (ChainBlueprint toggle asserted with no gutter markup).
- Pins: the ChainBlueprint note gets a NEW string pin (nothing pins
  the current text — r2 precision); the lane-name <text> removal is
  pin-safe BECAUSE the only label assertions are location-agnostic
  toContain()s that still match the gutter markup (r2 — stated, not
  assumed); no existing viewBox/width/height pin churns (HTML gutter
  + open scale max(fit,1): every pinned fixture is a sub-cap fit ≥ 1
  plan that opens unchanged, both views).
- Both-media walk at Computer ×40 AND Plastic ×161: at DETAIL no
  label touches any lane or any other label (Plastic ×161 opens at
  DETAIL ≈ 17710px wide — the pinned figure, r2 nit — scrolling
  head-anchored); at FIT the gutter is collapsed (no labels, by
  design); the Combined view at DETAIL: site chrome readable at
  1 px/dm, pan via page scroll + horizontal .bp-scroll, NO gutter;
  override panel self-explanatory; the skip note reads calm.

## Assumptions ledger

1. Grounded this session: LaneOverrides markup (:63-79 — no headings),
   Blueprint label anchors (:221-227, BELT_LANE=20 :39),
   ChainBlueprint skip note (:98-99).
2. The catalog displayName is reachable in LaneOverrides (it receives
   itemId; catalog access pattern to verify at implementation — the
   parent panel has the catalog).
3. The gutter column width sizes to the longest item name at 11px
   screen mono (CSS max-content — no dm constant needed) WHEN
   POPULATED, i.e. at DETAIL; at FIT the gutter renders empty and
   collapses to zero width (an empty max-content flex column — the
   "gutter collapses" in C1, made explicit per simplify nit).
4. The zoom toggle is presentation-only state (component useState —
   not store, not persisted).

## Revision history

- v1 (2026-08-05): initial — grounded in the fix-all-now directive,
  Michael's two field screenshots, and this session's reads.
- v2 (2026-08-05): dual-review r1 — BOTH NEEDS_REWORK ([code] 2
  IMPORTANT + 2 NITs; [adversarial] 4 IMPORTANT + 4 NITs), folded as a
  REWORK of Axis C: the in-SVG dm gutter died (fitScale perturbation +
  sub-pixel labels at floor — both reviewers) → HTML screen-space
  gutter outside the SVG (zero coupling, readable at every zoom, no
  pin churn); the v1 overlap diagnosis corrected to adjacent-lane
  crowding (the P1 doc's own mechanism); Axis B's phrase corrected for
  `invalid` stages ("no recipe or invalid settings"); the P1 "no zoom
  UI" non-goal SUPERSEDED explicitly (Michael's directive); open
  scale = max(fit, 1.0) preserves the small-plan natural-size posture
  and makes the [FIT|DETAIL] labels honest; the itemName prop pattern
  named; the heading-span CSS acknowledged.
- v3 (2026-08-05): r2 adversarial NEEDS_REWORK (1 IMPORTANT + 2 nits,
  folded): gutter labels render ONLY at DETAIL (the floor-zoom
  label-on-label crowding twin — 3.6px lane pitch vs 11px labels —
  is resolved by making names DETAIL's job; FIT is the geometry
  overview with the gutter collapsed); .bp-scroll → overflow-x: auto
  (the mirror it cites; kills the inner-scrollbar drift trap); the
  DETAIL-mode Plastic ×161 width (~17710px) pinned in the walk.
  Confirmed held: the Axis B phrase across all three SolveState
  statuses, Axis A implementability, the C2 toggle logic coherence.
- v4 (2026-08-05): r2 code-reviewer NEEDS_REWORK (1 IMPORTANT + 2
  nits, folded): the gutter px formula gains the viewBox-origin term
  ((laneY − minY) × scale — bare laneY×scale would misplace every
  label; the smelter's minY is −100); the pin-safety of the lane-name
  text removal stated with its reason (location-agnostic toContain);
  the skip-note pin reclassified NEW-not-churned. Confirmed held: the
  Axis B phrase, the P1 supersession, the crowding re-diagnosis, the
  open-scale formula incl. the fit<1 toggle gate at the smelter, the
  itemName pattern, the grid-column heading span.
- v4b (2026-08-05): stale-residue sweep before r3 — the three lines
  still describing the dead in-SVG gutter (non-goals "viewBox
  framing", the "viewBox includes the gutter" test item, the
  GUTTER_DM ledger entry) rewritten for the HTML-gutter shape; Axis
  A's "markup only" aligned with the grid-column correction.
- v5 (2026-08-05): r3 verdicts — code-reviewer APPROVED (0);
  adversarial NEEDS_REWORK (2 IMPORTANT, folded). (1) Axis C scoped:
  the gutter + lane-name removal are Blueprint-ONLY (ChainBlueprint
  has no lanes/lane-name text; a single column can't represent
  2D-stacked sites; the naive formula would omit the per-site
  translate term originY − fy, ChainBlueprint.tsx:167). (2) The r2
  ".bp-scroll → overflow-x: auto" fold REVERTED — it landed
  unconsidered on a class ChainBlueprint shares, and was a literal
  no-op (CSS computed-value rule: lone overflow-x: auto computes
  overflow-y to auto); replaced by the stated no-height-cap
  invariant that actually keeps gutter labels aligned (vertical pan
  = page scroll; horizontal pan stays inside .bp-scroll, gutter
  outside it). C2 widened to BOTH blueprint views (same fitScale
  math, shared .bp-scroll, Michael's "other views not readable" —
  toggle per-view, no Combined gutter). Held per r3 adversarial: the
  DETAIL-only gutter trade at FIT (FIT keeps geometry + belt/pipe
  kind legibility — defensible overview), Axis B across all three
  SolveState statuses, the minY term, the open-scale formula, the
  pin-safety claims.
- v6 (2026-08-05): r4 pair BOTH APPROVED (0 + 0, explicit loop-done)
  → correctness converged. One-shot claude-simplify-reviewer:
  APPROVED_WITH_NITS (3), dispositioned: (1) "sub-label exceeds the
  directive" REJECTED — Michael's verbatim field reports are "what
  are these input boxes its unclear" and "the feed info overrider
  still needs a label"; the empty-vs-computed sub-label answers
  exactly that observed confusion, it is not speculative; (2) toggle
  gate stated thrice → FOLDED: C2 now carries the one canonical gate
  (mounted iff fitScale(w, h, cap) < 1), other mentions defer; (3)
  gutter width at FIT under-specified → FOLDED: ledger #3 states the
  empty gutter collapses to zero width at FIT (max-content sizing
  applies only when populated at DETAIL). Simplify also affirmed:
  DETAIL-only gutter, per-view useState, gutter-outside-scroll flex
  row, C1 scoping, and max(fit,1) are each the minimal correct shape;
  nothing speculative found.
