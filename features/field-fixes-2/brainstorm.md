# Stage 13 combined — remove schematic, blueprint overlap, override table (tickets #68 + #69 + #70) — brainstorm v3 — FROZEN 2026-08-05

> **FROZEN.** Correctness: r1 both NEEDS_REWORK (converged IMPORTANT,
> folded v2); r2 both APPROVED_WITH_NITS (shared nit, folded v3).
> Simplify: APPROVED (0 findings — every probed shape confirmed the
> forced minimum). This is the implementation contract for tickets
> #68 + #69 + #70.

**Goal.** Michael's field report on the Stage 12 build (2026-08-05,
verbatim): "remove schematic view its not working also blueprint still
has overlapping issues and the belt load stuff is not aligned at all
and needs to be better displayed". Evidence: two screenshots — the
schematic with "Cable" garbled on its bus under a "View: Blueprint"
toggle (the toggle names the NEXT view — App.tsx:414's own comment),
and the override panel with inputs zig-zagging across WIRE/CABLE
groups.

*Cites: view files = src/ui/….*

## Already settled — do NOT re-litigate

- The schematic view is REMOVED (user directive — not a fix, a
  removal). All S12 decisions stand: the gutter (Blueprint-only,
  DETAIL-only, sizer twins), fitScale + max(fit,1) + the FIT|DETAIL
  toggle in both blueprint views, the skip-note phrase, the override
  panel headings. All-Claude roster; full gate; both-media walks at
  Michael's cases.

## Grounded current state (this session)

1. **Schematic surface:** Schematic.tsx (sole consumer of
   src/ui/layout.ts — computeLayout/bandMode/significantMachines/
   LAYOUT); src/ui/layout.test.ts tests that module;
   **src/ui/svg-scale.ts imports LAYOUT for REF_W = LAYOUT.viewW**
   (svg-scale.ts:14-17 says so explicitly) — the ONE non-schematic
   consumer. App.tsx: View type + VIEW_CYCLE (:64-71), default view
   "schematic" (:171), toggle labelled with the NEXT view (:414-421,
   his screenshot confusion grounded). app.css schematic blocks;
   smoke.test.tsx schematic tests; comment-only mentions in
   format.ts/FindingsPanel.tsx/Blueprint.tsx/src/layout/layout.ts.
2. **Blueprint overlap (live audit, develop @ 587cc06, Wire ×28,
   posted on #69):** 35 `.bp-mark-label`-crosses-`.bp-junction`
   incidents at DETAIL; zero text-on-text. Mechanism: the mark circle
   (r=8) sits ON the lane band; its label renders at
   `x = at.x + 12, y = at.y + 4` (Blueprint.tsx:265-266) — vertically
   ON the lane, extending rightward ACROSS nearby 40dm junction boxes
   (sample: label 36×13px at 134-170 vs junction 141-181 → 29px ≈ 80%
   of the text on glyph ink). The halo keeps it legible; it is still
   text-on-ink. Machine-number labels are fully contained by their
   own machine boxes (by design, excluded). Scale-invariant (dm
   geometry) — same crossing at FIT, smaller.
3. **Override panel:** each lane is its OWN grid
   (.lane-overrides-lane, app.css:862; max-content label track) —
   columns cannot align across lanes; his screenshot shows exactly
   that. Rows are .override-row { display: contents } (:869); the
   item heading spans via grid-column 1/-1 (:848).

## Axis A — remove the schematic + honest view switcher (#68)

**Pick: full deletion + a two-tab switcher.**
- DELETE: Schematic.tsx; src/ui/layout.ts; src/ui/layout.test.ts;
  the schematic CSS blocks; the schematic smoke tests; the
  "schematic" View member, its VIEW_CYCLE entry and its App render
  branch. Default view becomes **"blueprint"**.
- **svg-scale decoupling (the one dependency):** REF_W becomes a
  local `const REF_W = 960` in svg-scale.ts (the value LAYOUT.viewW
  supplied; comment updated to state the 960 reference is now the
  blueprint fit reference in its own right). svg-scale.test.ts drops
  its LAYOUT import the same way. Pure value-preserving refactor —
  no scale behavior change, no pin churn.
- **The switcher becomes two TABS naming the CURRENT view:**
  [BLUEPRINT | COMBINED], active tab marked — the same quiet-mono
  button idiom as the FIT|DETAIL toggle (bp-zoom-btn/.active,
  app.css:664-677 — cite corrected, r1 nit). This kills the grounded mislabel confusion (his
  screenshot: the schematic under "View: Blueprint"). With only two
  views a cycle button has no advantage over honest tabs.
- Comment-only Schematic mentions in format.ts / FindingsPanel.tsx /
  Blueprint.tsx / src/layout/layout.ts reworded in place (no
  behavior).

## Axis B — mark labels off the drawing ink (#69)

**Pick: lift the rate labels off the lane band in dm geometry.**
- Feed lanes (label currently ON the band): `y = at.y − 24`
  (baseline; 10dm font → bbox ≈ at.y−34…−24) — clears the lane band
  (±10), the mark circle (r=8), and the 40dm junction boxes (top at
  busY−20) by 4dm; stays 6dm clear of the neighbor lane's junction
  bottom at LANE_SPACING 60 (busY−60+20 = busY−40).
- Output lanes: mirrored below — `y = at.y + 32` (bbox ≈
  at.y+22…+32… below the +20 junction bottom). Below-bus overflow at
  the sheet edge is already the load-bearing .bp-svg
  overflow:visible posture (S12P1).
- `x = at.x + 12` unchanged (the label still reads as the glyph's
  annotation; horizontal spans over a junction's x-range are fine
  once the text is vertically clear of the ink).
- **Deliberate asymmetry (r1 nits, both reviewers):** the output
  side's clearance is tighter (~2dm bbox-top above the junction
  bottom at +32, vs the feed side's 4dm at −24) and both margins are
  glyph-dependent — they hold because the rate glyphs
  ("480/min (…load)") have no descenders. The geometry unit test
  pinning the label bbox band clear of [busY−20, busY+20] is
  therefore NON-OPTIONAL — it is what protects these tight margins.
- dm-space fix ⇒ holds identically at FIT and DETAIL (the audit's
  scale-invariance), both themes (geometry, not color).
- Acceptance = the #69 audit scan re-run at the walk returns ZERO
  text-crosses-ink (own-container machine numbers excluded), Wire ×28
  AND Plastic ×161, FIT + DETAIL.

## Axis C — the override panel becomes one aligned table (#70)

**Pick: a NEW inner table element carries the grid; the panel header
stays genuinely outside it.** (r1 BOTH reviewers, the converged
IMPORTANT: v1's "hoist the grid to .lane-overrides" contradicted its
own "head/sub sit above the grid" — .lane-overrides-head and -sub are
DIRECT CHILDREN of .lane-overrides (LaneOverrides.tsx:102-105), so
making the panel the grid would auto-place them as grid items: the
sub-label lands in the input column / blows out the max-content label
track, defeating the alignment the axis exists for. So this is NOT
CSS-only — one wrapper div is budgeted.)
- Markup: `.lane-overrides` keeps its flex column (head, sub, then a
  NEW `<div className="lane-overrides-table">` wrapping ALL the lane
  wrappers). CSS: `.lane-overrides-table { display: grid;
  grid-template-columns: max-content max-content; gap: 8px;
  align-items: center }` (label + input tracks; the gap and vertical
  centering CARRY OVER from the dying per-lane grid — r2 both
  reviewers: display:contents makes those declarations inert on
  .lane-overrides-lane, so omitting them here would drop the row gap
  and stretch the inputs); `.lane-overrides-lane` → `display: contents` (the element
  and its data-item stay — pins and grouping semantics intact);
  `.override-row` stays `display: contents`;
  `.lane-overrides-item` keeps its 1/-1 span — now spanning the
  TABLE grid. Every label/input across every group shares the same
  two tracks; head/sub are outside the grid by structure, not by
  span.
- "Better displayed" grooming, drawing-identity idiom: the input
  column right-aligned at a consistent `ch`-based width
  (schedule-column feel), a hairline rule under each item heading
  (the schedule-header idiom the headings already use), row hover
  unchanged. The head + sub-label (S12) are untouched.

## Non-goals

- No Combined-view changes beyond losing its cycle neighbor (its
  toggle, skip note, footer stay); no RF canvas changes; no
  solver/layout-engine changes (src/layout/layout.ts geometry is
  untouched — only its comment); no gutter changes; no new views.

## Test plan sketch

- App view tests: default view = blueprint; tabs render BOTH names
  with the active one marked (current-state honesty pinned); no
  "schematic" anywhere (a not.toContain sweep in the App smoke).
- svg-scale.test.ts: the two assertion bodies that reference
  LAYOUT.viewW (:19, :32) are rewritten to the literal 960 alongside
  the import drop (r1 nit — more than an import-line deletion);
  numeric pins otherwise unchanged (value-preserving — the pins ARE
  the proof).
- Marks: label y constants pinned (feed at.y−24 / output at.y+32) via
  the smelter fixture's known busY values (the S12 gutter-top pin
  pattern); a geometry unit test asserting the label bbox band
  (font 10dm) clears [busY−20, busY+20].
- LaneOverrides SSR: markup shape unchanged (headings + rows), so the
  existing pins hold; the grid hoist is CSS-only — pinned instead by
  a structural assertion that lane wrappers carry no per-lane grid
  class… (CSS is not SSR-assertable; the walk owns the visual
  alignment check; state this honestly).
- Deleted-surface sweep: no import of "./layout.ts" outside tests;
  Schematic files gone; schematic CSS classes absent from app.css.
  EXCEPTION (r1 nit): the "boots to the schematic-default surface"
  smoke test (:579-586) SURVIVES semantically — its bp-svg absence
  comes from the unsolved/initializing SSR path, not the schematic
  default — so it is RENAMED + re-commented for the blueprint
  default, not deleted.
- Bidirectionality log per new/changed behavior (view default, tabs,
  mark y, grid hoist where assertable).
- Both-media walk (Wire ×28 + Plastic ×161, both themes, FIT +
  DETAIL): the #69 audit scan returns 0 text-crosses-ink; override
  input column x identical across groups (measured); no schematic
  reachable; tabs show current view; Combined + Blueprint behavior
  otherwise unchanged.

## Assumptions ledger

1. src/ui/layout.ts consumers grepped this session: Schematic.tsx,
   layout.test.ts, svg-scale.ts (LAYOUT only), svg-scale.test.ts
   (LAYOUT only). Re-verify at implementation (drift hunt).
2. The #69 audit numbers (35 crossings; 29px/80% penetration; label
   at busY±[−6..+7]; junction ±20) — live-browser measured this
   session, posted on #69.
3. Feed-label lift clearances derive from BELT_LANE=20 (band ±10),
   junction box 40dm (±20 about the lane), LANE_SPACING=60
   (src/layout/layout.ts:77) — the implementer verifies the junction
   rect's actual y-extent against layout output before pinning −24/
   +32 (if junctions extend asymmetrically the constants shift with
   the same clearance rule: 4dm past the ink, ≥6dm short of the
   neighbor's).
4. The view-state is presentation useState in App (:171) — tabs set
   it directly; no store/persistence (unchanged posture).

## Revision history

- v1 (2026-08-05): initial — grounded in Michael's directive, his two
  screenshots, this session's greps, and the live #69 overlap audit.
- v2 (2026-08-05): r1 BOTH NEEDS_REWORK ([code] 1 IMPORTANT + 3 nits;
  [adversarial] 1 IMPORTANT + 2 nits — the IMPORTANTs converged on
  the same defect), folded: Axis C's grid moves to a NEW inner
  .lane-overrides-table wrapper (v1's panel-level grid would have
  auto-placed the head/sub as grid items — sub-label into the input
  column, label track blown out; the "CSS-only" framing dropped, one
  wrapper div budgeted); svg-scale.test.ts fold widened to the two
  LAYOUT.viewW assertion bodies; the schematic-default smoke test
  reclassified rename-not-delete (its assertion survives via the
  unsolved SSR path); the output-side ~2dm clearance asymmetry stated
  with the geometry unit test marked non-optional; the bp-zoom-btn
  CSS cite corrected (:664-677). Confirmed held by BOTH r1 reviewers
  against source: the complete Axis A deletion surface (ui/layout.ts
  consumers exactly Schematic/layout.test/svg-scale(+test);
  LAYOUT.viewW === 960; no persisted view state; .schematic classes
  applied only in Schematic.tsx), the Axis B geometry (junctions
  exactly ±20 about busY via 40×40 SPLITTER/MERGER footprints; marks
  ALWAYS at busY — no at.y ≠ busY case; −24/+32 clear ink and
  neighbors at LANE_SPACING 60; overflow:visible covers below-bus),
  and the two-tab switcher (no third view imminent).
- v3 (2026-08-05): r2 pair CONVERGED — code-reviewer
  APPROVED_WITH_NITS (1), adversarial APPROVED_WITH_NITS (1), the
  SAME nit, folded: the .lane-overrides-table CSS block carries
  gap: 8px + align-items: center over from the dying per-lane grid
  (inert under display:contents; omitting them would drop the row
  gap and stretch inputs). r2 adversarial cleared under determined
  refutation: the 1/-1 span through two display:contents levels, the
  max-content×ch interplay, focus/a11y of contents on role-less
  divs, the rename-not-delete SSR-gate claim (bp-svg mounts only in
  the solved block, unreachable headless), the svg-scale literal-960
  value preservation (960/200, 960/3000).
