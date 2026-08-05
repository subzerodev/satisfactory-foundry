# Stage 12 / P2+P3 combined — clarity + views navigation (tickets #65 + #64) — brainstorm v4

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
"Feed 1" rows group under their item. Markup additions only in
LaneOverrides.tsx; CSS reuses existing idioms (no new tokens).**

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

**C2 — initial readable zoom + pan. THIS SUPERSEDES the P1 frozen
"no zoom UI" non-goal (named per r1 — justified by Michael's explicit
"we need to start zoomed in" + "fix all issues now" directives).**
Open scale = max(fitScale, READABLE_PX_PER_DM) with READABLE = 1.0
(natural size — making the toggle label honest): small plans open
exactly as today (fit ≥ 1 → unchanged, the natural-size posture
preserved), big plans open at 1 px/dm readable detail. The toggle
(quiet-mono buttons, shown ONLY when fit < 1): [FIT | DETAIL] —
DETAIL = 1 px/dm, FIT = the P1 fit/floor scale. Pan = native scroll
in .bp-scroll (both axes; head-anchored passively via scrollLeft 0 —
stated as passive, r1 nit; .bp-scroll becomes overflow-x: auto,
matching the .schematic-scroll mirror it cites and killing the
latent inner-vertical-scrollbar drift trap — r2 nit). The gutter
labels reposition with the active scale (same px math).

## Non-goals

- No wheel-zoom/pinch (native scroll is the navigation; the toggle
  covers the two useful scales); no schematic changes beyond Axis B's
  none; no RF canvas changes; no solver/geometry changes (the gutter
  is viewBox framing, not layout math).

## Test plan sketch

- LaneOverrides SSR: heading + sub-label + per-lane item headings —
  via the EXISTING App itemName prop pattern (App.tsx:264, already
  threaded to Schematic/FindingsPanel; r1 — named now, not deferred).
  The heading spans the lane grid via grid-column: 1 / -1 (one CSS
  line — the "markup only" claim corrected, r1 nit).
- ChainBlueprint: the skip note text pinned to the new phrase.
- svg framing: viewBox includes the gutter; labels' x within the
  gutter (unit-testable from the emitted markup); the zoom toggle
  switches width/height between fit-scale and readable-scale values.
- Pins: the ChainBlueprint note gets a NEW string pin (nothing pins
  the current text — r2 precision); the lane-name <text> removal is
  pin-safe BECAUSE the only label assertions are location-agnostic
  toContain()s that still match the gutter markup (r2 — stated, not
  assumed); no viewBox/width/height pin churns (HTML gutter + open
  scale max(fit,1)).
- Both-media walk at Computer ×40 AND Plastic ×161: at DETAIL no
  label touches any lane or any other label (Plastic ×161 opens at
  DETAIL ≈ 17710px wide — the pinned figure, r2 nit — scrolling
  head-anchored); at FIT the gutter is collapsed (no labels, by
  design); override panel self-explanatory; the skip note reads calm.

## Assumptions ledger

1. Grounded this session: LaneOverrides markup (:63-79 — no headings),
   Blueprint label anchors (:221-227, BELT_LANE=20 :39),
   ChainBlueprint skip note (:98-99).
2. The catalog displayName is reachable in LaneOverrides (it receives
   itemId; catalog access pattern to verify at implementation — the
   parent panel has the catalog).
3. GUTTER_DM sizing needs the longest realistic item name at the label
   font — computed at implementation, walk-verified.
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
