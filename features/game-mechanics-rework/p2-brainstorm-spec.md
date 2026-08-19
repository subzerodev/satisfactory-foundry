# P2 — drawing: tapering ribbon + endpoint numbers, legend, hardware tables (#152)

**Arc:** #140 Phase 2 (FEATURE.md P2). Merged brainstorm+spec. The rendering
was decided from mockups (c24769: D ribbon + F endpoint numbers; per-gap
numbers and attachment-count labels DECLINED); the table lines were decided
at c24796 (buffer, one line) and c24797 (cascade counts). Anchors verified
against `develop` @ `88a87d2` (post-P1).

## Already settled — do NOT re-litigate

- **D+F rendering** (c24769): trunk as a tapering ribbon (thickness =
  remaining flow, resetting at each belt entry) + numbers at span endpoints
  ONLY (entry rate, hand-off residue, final 0). Constant label ink at 106+
  machines is the criterion that killed options A/B.
- **Buffer = one table line** (c24796); **cascade counts in tables**
  (c24797); nothing per-machine on the drawing.
- **P1 hand-off caveat 1 (binding, p1-completion.md):** the terminal
  stretch's `handoffResidue` is CAPACITY SURPLUS, not onward flow. The
  ribbon's terminal endpoint must not read "N/min leaves the lane".
- **P1 hand-off caveat 2 (binding):** `segTooltip`'s "peak" copy is
  rewritten here to the entry/hand-off vocabulary.
- **Pipe honesty is Level 1** (c24770, implemented in P1): pipe feed lanes
  have no segments — no ordered-flow claims may be drawn for them.
- **P3 (#135, the schematic-split rethink) is deferred** — P2 changes what
  the existing Schematic draws, not the view architecture.

## Inputs (the P1 result shape, live at manifold.ts)

Per belt feed lane: `segments[]` with `entryFlow`/`handoffResidue`
(`manifold.ts` BusSegment), `hardware: {splitters, seamMergers, headCascade}
| null` (:83), `standingBufferItems` (:85), `belts[]`. Output lanes:
`collectionCascade` (:107), segments with `entryFlow = load`,
`handoffResidue = 0`. Pipe feed lanes: `segments = []`, `hardware = null`,
`standingBufferItems = 0`, runs in `belts[]`.

## Design

### D1 — ribbon geometry (belt feed lanes)

`LaneTrack.segments` (src/ui/layout.ts:80-90) gains `handoffResidue:
Fraction` alongside the existing `entryFlow` pass-through (same
display-data convention — the layout's "never a coordinate" contract holds;
both flows stay Fractions until Schematic).

Schematic replaces each feed `bus-seg` LINE with a **trapezoid polygon**
centered on `track.busY`: left half-height ∝ `entryFlow`, right
half-height ∝ the flow CARRIED ONWARD past the stretch (see the terminal
rule below — `handoffResidue` for interior stretches, 0 for the terminal
one). The drain is uniform per machine, so the honest shape between
endpoints is the straight taper (linear in x at constant pitch; a
single-machine stretch is a short straight segment; no zero-x-width
segment is ever EMITTED — the solver's start > end case folds into
survivedIn without pushing a segment, `manifold.ts:509-512` — so no
skip-polygon guard is needed, r4 wording fix of the r1 fold).
Half-height scale, one helper in Schematic:

```
halfPx(flow, busCap) = RIBBON_MIN + (RIBBON_MAX − RIBBON_MIN) × min(1, flow/busCap)
```

- `RIBBON_MAX = 9` px half-height (18px full), `RIBBON_MIN = 1` px (a
  zero-flow hand-off still draws a hairline point, not a gap). Seam ticks
  grow to ±(RIBBON_MAX+2) **on FEED lanes only** (r1 fold — the output
  seam ticks stay ±6: output buses remain constant-width lines, and the
  output-lane name baseline at `busY + 18` is load-bearing on the ±6
  extent per the #76 comment at `Schematic.tsx:116-121`; growing output
  seams would re-introduce that collision for nothing).
- `busCap` is the lane's current top unlocked tier (the `busCapacity` prop
  Schematic already receives) — one scale per lane, so equal thickness =
  equal flow across stretches. `flow/busCap` computed as a JS number
  (display-only; the rendered-layout convention — exactness stays in core).
  `min(1, ·)` clamps an over-B overridden stretch at full thickness (its
  error state is already carried by `seg-error` + the finding).
- Stroke/fill: the polygon fills with the stretch's belt-capacity colour at
  reduced opacity + a 1px outline in the same colour; the errored state
  keeps `ERROR_COLOR` (colors.ts is untouched — same colour vocabulary,
  new shape). The `lane-pipe` dashed treatment never applies (pipes draw no
  ribbon, D4).
- The existing `bus-seg` class stays on the polygon (the DOM pins that
  count segments keep counting); the element changes `<line>` → `<polygon>`.

Output lanes KEEP the constant-width line (a break-out belt's load is flat
along its span — a taper would be false there). One lane model, two
shapes, matching the solver's two segment readings.

### D2 — endpoint numbers (F) + the terminal rule

New SVG text elements per feed stretch, class `ribbon-endpoint`. **Both
label rows sit ABOVE the ribbon at ONE baseline `busY − RIBBON_MAX − 4`
(r1 fold — the original below-ribbon hand-off row at `busY + RIBBON_MAX +
12` landed 13px past the lane row's bottom and within 1px of the NEXT feed
lane's name baseline, a guaranteed collision on any multi-feed-lane
stage; feed lanes pack at 56px with no inter-lane gap, `layout.ts` row
math).** Anchoring keeps the two numbers apart at a seam without a second
row: the hand-off number is END-anchored at `x2 − 3` (its glyphs extend
LEFT into its own stretch), the entry number is START-anchored at
`x1 + 3` (glyphs extend RIGHT into its own stretch) — at a seam the two
labels sit back-to-back on opposite sides of the tick, no overlap by
construction.

- **Entry number** per stretch: `formatRate(entryFlow)` (the ribbon's
  reset thickness — the number that makes the reset legible). **Collision
  rule (r2 fold):** when a rendered feed-group-count token occupies the
  same boundary (its left-anchored placement `coordinate + 4` sits within
  1px of `x1 + 3` — the coincident-marks case), the entry label's start-x
  pushes right past the token (`+ 20px`); the narrow-stretch thinning
  rule then applies to the pushed position (tooltip keeps it findable if
  dropped). **The LEFT candidate too (r3 fold — the symmetric hazard):**
  `placeGroupTokens` may place the token at `coordinate − 32` (glyphs in
  `[coordinate−32, coordinate−4]`), the same left-of-seam territory an
  end-anchored HAND-OFF label at `x2 − 3` occupies, only ~6px apart
  vertically (token row +29 vs endpoint row +35). When a rendered group
  token takes the left candidate at a boundary equal to a stretch's `x2`,
  that stretch's hand-off label is SUPPRESSED (dropping beats pushing —
  pushing an end-anchored label left detaches it from its endpoint; the
  segment tooltip keeps the hand-off findable, same as thinning). One
  rule, both candidates: a rendered token displaces the endpoint label on
  its own side — entry pushes right, hand-off drops.
- **Halo (r2 fold):** `ribbon-endpoint` carries the codebase's
  text-over-linework idiom — `paint-order: stroke` with the `--bg` halo,
  exactly as `.lane-name` / `.feed-group-count` (app.css:756-758,
  :779-782) — because the one-baseline row overlays the entry arrows and
  stems by construction. Bare glyphs over tier-coloured lines are the
  defect the idiom exists for; the pin asserts the class is present on
  every endpoint text.
- **Hand-off number**: rendered ONLY when `handoffResidue > 0` AND the
  stretch is NOT terminal (a 0 hand-off adds no information the taper
  doesn't show; the eight 60s in the 8411 case are exactly what renders).
- **Terminal endpoint (caveat 1, shape corrected r1):** the LAST stretch
  always renders the onward-flow number **"0"** end-anchored at the lane's
  end, and its ribbon **tapers to RIBBON_MIN (onward flow = 0)** — NOT to
  the surplus thickness. Thickness means CARRIED FLOW everywhere (one
  invariant, matching the D6 legend "trunk carry"); the r1 code-reviewer
  showed the original surplus-thickness terminal relocated caveat-1's
  "30/min leaves the lane" misreading into the thickness channel under a
  legend that contradicted it. Terminal capacity surplus (the 8411 case's
  30) surfaces ONLY textually: the tooltip (D3) and the summary card's
  spare-capacity line (D5).
- **Label thinning:** within one stretch, if the stretch is too narrow for
  both its entry and hand-off glyphs (estimated width; threshold ~60px),
  the hand-off label drops (entry wins — it carries the reset; the
  tooltip keeps the hand-off findable). At 8411's normal-mode 8px pitch
  (~50px per stretch, r1 wording fix — 106 machines is BELOW the 114
  band threshold) hand-off labels render only at the eight seams and
  never share a stretch edge closer than a stretch width; nothing thins.
- **Empty-span belts (r1 fold):** a belt whose span is empty emits no
  segment (`manifold.ts` start > end carry-forward), so it gets no entry
  number; its capacity appears folded into the NEXT stretch's entryFlow —
  by design (the entry number reflects everything arriving there). The
  8411 fixture has no empty spans (entry boundaries strictly increase),
  so AC1's 17-stretch count stands.

### D3 — segTooltip rewrite (caveat 2)

`segTooltip(seg, busCapString)` (format.ts:117-124) becomes:

- Non-terminal feed stretch: `machines X–Y · entry N/min → hand-off
  M/min · bus B/min`.
- Terminal feed stretch with surplus: `machines X–Y · entry N/min →
  0/min onward · S/min spare belt capacity`.
- Output segment (entryFlow = load, handoff always 0): `machines X–Y ·
  collects N/min of B/min` — the word "peak" disappears from segTooltip
  (r2 wording fix: findingText, the FindingsPanel hint, and advice.ts
  keep their correct over-capacity usage per the scoped gate below).

The signature gains the flags it needs (`terminal: boolean`, `side`), or
two named functions — implementer's choice, pinned by the format tests.
`findingText` is untouched (already renamed in P1).

### D4 — pipe feed lanes: draw the runs, claim no order

P1 removed pipe segments, so Schematic currently draws pipe feed lanes as
arrows with NO bus at all (the natural empty-map result). P2 makes that
deliberate and legible: a single **uniform thin connector line** (class
`pipe-manifold`, the existing dashed pipe treatment, neutral width 2px)
spanning the lane's runs, carrying ONE tooltip: `total demand D/min ·
supplied S/min (nominal pipe ceiling)` — no taper, no endpoint numbers, no
per-machine claims. The `lane-undersupplied` finding still colours it via
the existing error path when present (segmentErrored gains the
`lane-undersupplied` variant: it errors the whole connector — the finding
is lane-scoped, unordered by design).

### D5 — summary cards: the hardware + buffer lines

`SummaryCards.tsx` per-lane cards gain (belt feed lanes only, from the P1
fields — null-guarded):

- `hardware`: `N splitters · M seam mergers` (+ ` · head cascade: J
  junctions / T tiers` when `headCascade` non-null).
- `standingBufferItems > 0`: `standing buffer: N items` — the c24796 line.
- Terminal surplus (computed from the last segment's `handoffResidue > 0`):
  `spare belt capacity: S/min` — the caveat-1 surface.

Output cards gain ` · collection cascade: J junctions / T tiers` when
`collectionCascade` non-null. Pipe feed cards gain nothing new (the runs
count already renders; honesty lives in the finding + tooltip).

### D6 — legend

`Legend.tsx` appends three line-convention entries after the tier swatches
(same Swatch idiom; one new `tapered` swatch variant rendered as a small
filled triangle):

- taper swatch — `trunk carry (thins as machines draw)`
- seam swatch (the existing vertical-tick style) — `belt seam (merger)`
- dashed neutral swatch — `pipe manifold (unordered)`

The existing override/problem entries stay.

### D7 — the site-plan attachment kinds (src/layout)

The Blueprint site plan already places one 4×4 junction per machine column
(`src/layout/layout.ts:59,192,224`; footprints.ts:73-77) — geometry without
vocabulary. P2 adds the KIND: `junctions` entries gain
`kind: "splitter" | "seam-merger" | "merger"` — feed columns are
`splitter` except a stretch's first column when its residue-in > 0 (that
column is the seam: `seam-merger`); output columns stay `merger`. The
Blueprint renders the kind as the rect's `data-kind` + tooltip word (no new
geometry). This is the "layout attachment kinds" scope line from
FEATURE.md, kept to naming — footprint sizes are identical in-game (4×4).

Note: `buildJunctions` currently emits one junction per column uniformly;
the kind derivation needs the feed lane's segments, threaded as data
already present in `StageSolveResult` (`layoutFeedLane` receives the full
lane) — no solver change. **Residue-in derivation corrected (r1
adversarial H2):** residue-in of an emitted stretch is
`seg.entryFlow − belts[seg.beltIndex].capacity` (post-override capacity —
`entryFlow = survivedIn + capacity` in the solver, so the subtraction
recovers `survivedIn` exactly), NOT `segments[j-1].handoffResidue` — the
segments array is sparse relative to belts (empty-span belts emit no
segment but carry capacity forward), so the previous-segment read
mislabels a seam that follows an empty span. The subtraction form is
correct across empty spans by construction and agrees with the solver's
own `seamMergers` count. seam-merger ⇔ residue-in > 0; the seam column is
the stretch's `fromMachine` column (1-based stretch machine → 0-based
junction `col` needs the −1 offset).

## Tests

- Ribbon geometry: a 2-stretch fixture (the P1 N=13 case: entry 780 →
  hand-off 60; entry 840 → 0) renders two `bus-seg` polygons; the first's
  left half-height > right half-height (numeric attribute assertion via
  the points string); the second tapers to RIBBON_MIN.
- Terminal rule: a lane whose final stretch has positive `handoffResidue`
  (the 8411-tail shape: 270 capacity, 240 demand) renders the terminal
  endpoint text "0" (NOT "30"), a terminal ribbon whose RIGHT half-height
  is RIBBON_MIN (not the surplus thickness), and the card line `spare belt
  capacity: 30/min`; a demand-exact lane renders "0" with no spare line.
- Endpoint numbers: entry label per stretch (start-anchored at x1+3);
  hand-off label only where residue > 0 and non-terminal (end-anchored at
  x2−3; the N=13 case: exactly one hand-off label, "60"); the
  one-baseline placement (busY − RIBBON_MAX − 4) — NO text below the
  ribbon (the r1 cross-lane collision pin: a two-feed-lane fixture
  asserts no ribbon-endpoint element renders below busY); narrow-stretch
  thinning drops the hand-off label (a dense synthetic fixture); every
  `ribbon-endpoint` element carries the halo class/style (r2 pin); a
  coincident-marks fixture asserts the entry label's x is pushed past
  the group token (r2 collision pin); a LEFT-placed-token fixture (the
  coincident-feed-marks.test.tsx:119-123 left-fallback shape, at a
  boundary carrying a positive hand-off) asserts the hand-off label is
  suppressed (r3 collision pin).
- segTooltip: the three shapes pinned (non-terminal, terminal-surplus,
  output); the word "peak" absent from segTooltip's body (the SCOPED
  grep gate below).
- Pipe lane: connector line present, no polygon, no endpoint text; the
  tooltip's `nominal pipe ceiling` copy; `lane-undersupplied` colours the
  connector via segmentErrored.
- SummaryCards: hardware line, cascade suffixes, buffer line, spare line —
  each null-guarded case pinned (pipe card unchanged).
- Legend: three new entries by label text.
- Site plan: junction kinds — a fixture with one seam yields exactly one
  `seam-merger` in the feed row, rest `splitter`; output row all `merger`;
  and the r1 empty-span counter-case: a lane where an empty-span belt
  precedes a seam (prior stretch hand-off 0, carried capacity > 0) still
  labels the seam column `seam-merger` (kills the segments[j-1] regression
  — the subtraction derivation must survive this fixture).
- **Deletion/re-pin sweep (grep-grounded on develop @ 88a87d2; citations
  corrected r1):** `segTooltip` pins — `format.test.ts:121,:133` (the
  `.toBe("… peak …")` assertions; :118/:130 are the fixture-construction
  lines) and TWO `smoke.test.tsx` pins: :535 ("carries the worked
  example's honest bus-segment string" — "machines 1–16 · peak 480/min…")
  and :549 ("shows a segment's honest entryFlow, not the belt's capacity"
  — "machines 17–17 · peak 30/min…") — all re-pin to the new copy. The
  `bus-seg` DOM pins survive the line→polygon change:
  `single-lane-feed-belts.test.tsx:65` matches `class="bus-seg` as an
  HTML-string regex (verified, not tag-anchored); implementer verifies any
  other selector (`querySelectorAll(".bus-seg")` stays; a `line.bus-seg`
  selector re-anchors). `coincident-feed-marks`/`layout` tests are
  x-coordinate-only — unaffected. **Final gate, SCOPED (r1 — both
  reviewers found the unqualified gate false and hazardous):** grep
  `peak` in `format.ts`'s `segTooltip` body and in the
  `format.test.ts`/`smoke.test.tsx` segTooltip pins — zero hits.
  EXPLICITLY EXEMPT (correct "peak" usages that P2 must NOT touch):
  `findingText`'s over-capacity copy (`format.ts:134`, P1-settled),
  `FindingsPanel.tsx:97-98` (the fix-hint copy), `advice.ts`'s `peak`
  parameter + JSDoc (:46-68), and history comments (`layout.test.ts:80`).
  Also grep `ribbon-endpoint`, `pipe-manifold`, `data-kind` — present at
  their new pins.

## Acceptance criteria

1. The 8411 case draws 17 tapering stretches, eight hand-off numbers
   ("60"), a terminal "0", and no constant-width feed bus lines; the card
   reads splitters/seam-mergers/cascade/buffer/spare.
2. No drawn or written surface renders terminal capacity surplus as
   departing flow (caveat 1) — the terminal ribbon tapers to RIBBON_MIN
   and the endpoint reads "0"; the TOOLTIP "peak" vocabulary is gone
   (caveat 2, scoped exactly as p1-completion.md scoped it — findingText,
   the FindingsPanel hint, and advice.ts's parameter keep their correct
   over-capacity "peak" usage).
3. Pipe feed lanes draw the neutral connector with the nominal-ceiling
   tooltip and no ordered-flow geometry.
4. The legend names the ribbon, seam, and pipe conventions.
5. The site plan labels junction kinds (splitter / seam-merger / merger).
6. `npm test` + `npm run check` green.

## Assumptions ledger

- `entryFlow`/`handoffResidue` per stretch are sufficient for the linear
  taper — grounded: the drain is uniform per machine (`drainSpan`), so the
  in-stretch profile is exactly linear; no per-machine data needed.
- The float division for half-heights is acceptable — grounded: rendered
  geometry only, matching the existing convention that coordinates are JS
  numbers (`layout.ts` header) while exact math stays in core; no test
  asserts equality on the float, only ordering/monotonicity.
- `busCapacity` prop is the right per-lane thickness reference — grounded:
  Schematic already receives it per lane (`Schematic.tsx:395,449`), and
  P1's invariant keeps auto entryFlow ≤ B, so the scale saturates only on
  explicit over-B overrides (clamped, error-styled).
- The seam-kind derivation needs no solver change — grounded (ledger
  corrected r2; the r1 fold fixed D7 but left THIS entry on the broken
  form): residue-in of an emitted stretch =
  `seg.entryFlow − belts[seg.beltIndex].capacity` (post-override; recovers
  the solver's `survivedIn` exactly, `manifold.ts:508,520`, and survives
  empty spans, unlike the rejected `segments[j-1].handoffResidue` read);
  `seamMergers` already counts positives; the site plan reads the same
  segments via `layoutFeedLane`'s full-lane parameter.
- No test pins the current pipe-lane "no bus" rendering as intended —
  grounded by grep: pipe-lane Schematic tests assert runs/arrows and
  finding text, none pins the absence of a connector (the new element adds,
  not replaces).

## Revision history

- v1 — initial merged brainstorm+spec; dispatched to the degraded
  correctness pair (code-reviewer + adversarial-reviewer).
- **r1 → r2** (design review r1: code-reviewer NEEDS_REWORK — 2 IMPORTANT
  + 3 NITs; adversarial NEEDS_REWORK — 2 HIGH + 2 MEDIUM + 2 LOW; all
  folded, one reviewer-vs-reviewer split resolved): (1) TERMINAL RULE
  reshaped per the code-reviewer's adjudication — the surplus-thickness
  terminal relocated caveat-1's misreading into the thickness channel
  under a contradicting legend; the ribbon now tapers to RIBBON_MIN
  (thickness = carried flow, ONE invariant) and surplus is textual only.
  (The adversarial had cleared B2 by misreading the spec as already
  doing this — the code-reviewer's reading of the actual text governs.)
  (2) The "peak" gate SCOPED to segTooltip + its pins with explicit
  exemptions (findingText format.ts:134, FindingsPanel.tsx:97-98,
  advice.ts:46-68, history comments) — both reviewers found the
  unqualified gate false; AC2 narrowed to match p1-completion's caveat
  scope. (3) D7's residue-in derivation corrected to
  `entryFlow − belt.capacity` (the segments-array-is-sparse empty-span
  counter-example; new counter-case test pinned). (4) Hand-off labels
  moved ABOVE the ribbon (end-anchored at x2−3, one baseline) — the
  below-ribbon row collided with the next feed lane's name (1px apart,
  any multi-feed-lane stage); new no-text-below-busY pin. (5) Seam-tick
  growth scoped to feed lanes (output ±6 stays; the #76 name-baseline
  comment is load-bearing). (6) NITs: 8411 is normal-mode 8px pitch (106
  < 114), zero-x-width stretches render no polygon, sweep citations
  corrected (format.test.ts:121/:133; smoke :535 AND :549 — two pins),
  empty-span belts' entry-number semantics stated. r2 goes to both
  correctness reviewers.
- **r2 → r3** (design review r2: code-reviewer NEEDS_REWORK — 2 IMPORTANT
  + 1 NIT; adversarial NEEDS_REWORK — 2 IMPORTANT; one finding shared):
  (1) SHARED — the assumptions ledger still carried the broken
  `segments[j-1].handoffResidue` derivation the r1 fold removed from D7
  (the stale-parallel-copy class); corrected to the subtraction form.
  (2) `ribbon-endpoint` gains the paint-order/--bg halo idiom (the
  one-baseline row overlays arrows by construction; bare glyphs were a
  real legibility defect) + a class pin. (3) The entry-label vs
  feed-group-count-token co-location at coincident boundaries (both
  left-anchored within 1px) gets an explicit collision rule (+20px push)
  + a fixture pin. (4) NIT — "peak disappears everywhere" scoped to
  segTooltip at both D3 sites. Cleared by the same round: the terminal
  RIBBON_MIN taper on seam/starved terminals, the override-invariant
  subtraction algebra, the feed-only seam conditional against the shared
  LaneG path, all corrected citations. r3 goes to both correctness
  reviewers.
- **r3 → r4** (design review r3: code-reviewer APPROVED — all four folds
  faithful, the LEFT token candidate adjudicated clear of the ENTRY
  label; adversarial NEEDS_REWORK — 1 IMPORTANT, folded): the r2
  collision rule covered only the RIGHT token candidate vs the entry
  label; the LEFT candidate (`coordinate − 32`) occupies the hand-off
  label's territory (end-anchored at `x2 − 3`, glyphs extending left) ~6px
  apart vertically, and placeGroupTokens knows nothing of endpoint
  labels. Folded as one symmetric rule: a rendered token displaces the
  endpoint label on its own side — entry pushes right (+20px), hand-off
  DROPS (pushing an end-anchored label detaches it from its endpoint;
  the tooltip keeps it findable) — with a left-fallback fixture pin.
  Cleared by the same round: the stale-derivation sweep (all remaining
  segments[j-1] mentions are negating/historical), the halo pin's
  jsdom-testability, the "peak" scoping consistency across D3/AC2/gate.
  r4 goes to both correctness reviewers.
- **r4 — CONVERGED** (design review r4: code-reviewer APPROVED +
  adversarial APPROVED with 1 cosmetic NIT, folded — the zero-x-width
  phrasing reworded to "never emitted" so no implementer adds an
  unreachable skip-polygon guard). The adversarial's three attacks all
  refuted on the record: one token takes exactly one candidate (push and
  drop are mutually exclusive per boundary), no suppressed hand-off can
  lack its polygon tooltip (zero-width stretches are never segments), and
  the push/drop prose is exact. Correctness gate closed after four
  rounds; the one-shot simplify pass follows.
