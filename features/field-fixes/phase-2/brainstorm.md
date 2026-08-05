# Stage 12 / P2+P3 combined — clarity + views navigation (tickets #65 + #64) — brainstorm v1

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
2. Blueprint labels (Blueprint.tsx:221-227): feed label y = busY −
   BELT_LANE (above), output label y = busY + BELT_LANE + 8 (below);
   the bus rect spans busY ± BELT_LANE/2 — offsets are in dm and the
   11-user-unit text can still land visually on/near the bus at small
   scales (Michael's screenshot).
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

**Pick: the canonical phrase is "no recipe" (the plate's existing
word). ChainBlueprint's skip note becomes "N stage(s) without a recipe
— not drawn"; the findings panel is UNTOUCHED (its "No warnings" is
about lane findings and is correct — the confusion came from the
"unsolved" word implying a problem; recorded).**

## Axis C — labels off lanes + initial readable zoom (#64)

**C1 — label gutter.** Blueprint/Combined lane labels move OFF the
geometry into a LEFT GUTTER: the SVG viewBox gains a fixed-dm gutter
column (GUTTER_DM, sized to the longest label at the label font);
lane names render right-aligned in the gutter at their lane's y,
never over geometry. The halo stays (defense at gutter/lane seams).
The schematic already labels lanes above-left (its labels are fine —
untouched).

**C2 — initial readable zoom + pan.** The bp views open at
READABLE_PX_PER_DM (target: the P1 walk-verified comfortable scale,
~0.4-1.0 — exact value derived at implementation from the Computer ×40
case and pinned) anchored at the head (left edge), inside the existing
.bp-scroll (pan = native scroll, both axes — no custom pan code). A
small zoom control (the quiet-mono button idiom): [fit | 1:1]
toggling between the P1 fit/floor scale and the readable scale. The
P1 floor remains the zoomed-out bound; deep plans unchanged.

## Non-goals

- No wheel-zoom/pinch (native scroll is the navigation; the toggle
  covers the two useful scales); no schematic changes beyond Axis B's
  none; no RF canvas changes; no solver/geometry changes (the gutter
  is viewBox framing, not layout math).

## Test plan sketch

- LaneOverrides SSR: heading + sub-label + per-lane item headings
  (displayName resolved); rows unchanged otherwise.
- ChainBlueprint: the skip note text pinned to the new phrase.
- svg framing: viewBox includes the gutter; labels' x within the
  gutter (unit-testable from the emitted markup); the zoom toggle
  switches width/height between fit-scale and readable-scale values.
- Churned pins enumerated (the ChainBlueprint note text; any viewBox
  pins).
- Both-media walk at Computer ×40 AND Plastic ×161: no label touches
  any lane at either zoom; override panel self-explanatory; the skip
  note reads calm.

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
