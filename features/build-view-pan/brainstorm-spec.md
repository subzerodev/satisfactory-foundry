# #154 — Build view pans at readable pitch; the ruler gets a legend entry

**Ticket:** #154 · **Tier:** 2 · **Status:** design v1
**Anchors:** `develop` @ `66f985a` (post-arc).

## Purpose

Michael's field report on the live release (2026-08-19): *"this needs to be
moveable like the flow chart your compressing the end also what are the
spikes highlighted."* Two findings: (1) at 106 machines the build view
compresses to the 8px pitch floor and crushes the right end (terminal
endpoint labels collide; 3-digit ruler numbers overlap); (2) the P3 ruler
has no legend entry — the drawing's newest element is the one the legend
doesn't name.

## The root cause, verified

`computeLayout` (`layout.ts:289-295`): `pitch = clamp(8, floor(912/N), 48)`;
`scrolled = pitch === 8 && 8·N > 912`. So for N in [102..114] the pitch
floors at 8 and the drawing FITS (8·106 = 848 < 912) — cram, no scroll.
Above 114 it already scrolls (at the same unreadable 8px) AND band mode
engages (`bandMode: 912/N < 8`). The fit-to-width premise is what Michael
is overriding: he wants a readable drawing that pans, like the flow chart.

## Decision axes

### A1 — the readable pitch floor: **24px**

Grounded in the label arithmetic (r1-corrected: `.machine-label` carries
NO halo — the halo idiom lives on the lane-row text classes): 10px mono
digits ≈ 6px/char → a 3-digit index ("106") ≈ 18px ink; at 24px pitch
adjacent centred labels keep a ≥6px ink gap, clean at labelStep 1 and
comfortably above `labelPitch` (20), so every machine gets a number. `LAYOUT.minPitch` becomes 24 (renamed
semantics: the READABLE floor, not the cram floor). `maxPitch` 48 stays.
At N=20 nothing changes (pitch 45). At N=106: pitch 24, width = 48 +
24·106 = 2592px, scrolled.

### A2 — scrolled semantics: any time content exceeds the panel

`scrolled = pitch · N > USABLE` (drop the `pitch === minPitch` conjunct —
with the readable floor the old form is equivalent, but the simple form
states the intent). `width` formula unchanged. The existing
`.schematic-scroll` container (`app.css:693-700`, `overflow-x: auto`)
already does the panning; both views already select it off
`layout.scrolled` (`Schematic.tsx:686`, `Machines.tsx:102`).

### A3 — "moveable like the flow chart": native scroll + grab-drag

The flow chart pans by pointer drag (React Flow). The schematic gets the
same feel with a small, dependency-free handler on the scroll container:
pointerdown on empty space → track movement → adjust `scrollLeft`;
`cursor: grab/grabbing`. Interactive children (segments, labels with
tooltips) keep working — the handler starts the drag only when the target
is the container/svg background, and a drag beyond a 4px threshold
suppresses the click. Wheel/trackpad/scrollbar continue to work natively.
One shared hook (`useGrabScroll`) used by both Schematic and Machines.

### A4 — band mode RETIRES (its premise is gone)

Band mode existed because sub-8px ticks read as noise under fit-to-width
(the S12 P1 rationale, `layout.ts:41-47`). With a 24px readable floor that
state is unreachable — `912/N < 8` still becomes true above N=114, but the
RENDERED pitch is 24 and per-machine rects/ticks are readable; the band
would hide readable content behind a grey block for no reason, and the
Machines view at N=161 would draw a 3.9k-px-wide band. Deletions:

- `bandMode`, the `band` field, `MachineBand` (lives in `Machines.tsx`
  post-P3), the band arm of the machines view (rects render at every N,
  scrolled), the ruler's band-mode label source.
- `labeledSignificant` + `labeledSignificantOf` (band-only label thinning;
  at pitch ≥ 24, `labelStep` is always 1 — `pitch >= labelPitch` — so the
  whole labelStep machinery collapses to `labeled: true`; `labelStep`
  field retires too).
- `significant` STAYS — the ruler's major ticks read it at every N (the
  P3 registration requirement is untouched).
- The ×N count (the band's one genuinely useful datum) survives as a
  static caption in the Machines view header ("×106"), rendered at every
  N — cheap, honest, and it answers "how many" without scrolling.

This supersedes the S12 P1 fit-with-band decision on Michael's explicit
new directive (readable + pan > fit); recorded as such, not silently.
**#138 coordination (r1 fold — the machines-view content is #138's
scope):** the band cannot survive this ticket's floor change (its premise
is fit-to-width), so its removal is a forced consequence, not a content
redesign; the rects-at-every-N + ×N caption is the NEUTRAL PLACEHOLDER
this ticket leaves for #138, which still owns what the view becomes. A
comment on #138 records the changed baseline when this merges.

### A5 — the ruler legend entry

`Legend.tsx` gains one composite entry using the **ConventionEntry idiom,
NOT Swatch** (r1 fold — ConventionEntry deliberately omits the
`legend-swatch` substring because a smoke pin counts `/legend-swatch/g`;
a Swatch-idiom ruler entry would inflate that pin): `machine ruler — tall tick: a belt stretch starts/ends · short
tick: this number's machine`. (The ruler hover tooltip proposed earlier
was DROPPED at the simplify pass — the legend entry is the AC3
requirement and the only copy of the string; hover-discoverability was
designed past requirement.)

### A6 — the terminal end, verified readable

At pitch 24 the terminal stretch (m105-106) is 48px wide; the endpoint
labels ("840" entry, terminal "0") sit at x1+3/x2−3 with the P2 thinning
rule available if a fixture is narrower. The ruler numbers at labelStep 1
and 24px spacing separate cleanly. A pin asserts no two ruler labels
overlap at N=106 (x-distance ≥ 24) and the terminal endpoint labels
render un-thinned.

## Changes

1. `src/ui/layout.ts` — minPitch 8 → 24 (comment rewritten to the readable
   rationale); `scrolled` simplification; DELETE `bandMode`, `band`,
   `labeledSignificant`, `labeledSignificantOf`, `labelStep` — all RETIRE
   (r2 fix: A4 governs; the earlier "implementer picks" clause
   contradicted it). `machines[].labeled` becomes always-true and the
   field itself retires with labelStep; its readers re-pin.
2. `src/ui/Schematic.tsx` — Ruler loses its band branch (labels from
   `m.labeled` only); the grab-scroll hook on the container. (The ruler
   hover sentence was dropped at the simplify pass — see A5.)
3. `src/ui/Machines.tsx` — MachineBand deleted; rects at every N; the ×N
   caption; the grab-scroll hook.
4. `src/ui/useGrabScroll.ts` — the shared hook (new, ~30 lines).
5. `src/ui/Legend.tsx` + `app.css` — the ruler entry; grab cursors.
6. Tests — below.

## Tests

- Pitch floor: N=106 → pitch 24, scrolled true, width 2592; N=20
  unchanged (pitch 45, not scrolled); N=161 → pitch 24, scrolled.
- **The N=39 sliver (r1, accepted with a sentence):** floor(912/39)=23
  clamps to 24 → 24·39=936 > 912 → scrolled by 24px. Accepted: a
  one-machine overflow scroll is imperceptible in use (drag still works,
  the bar is faint) and rounding it away would reintroduce sub-24 pitch.
  A pin documents the boundary (N=38 fits at width 960; N=39 scrolls at
  984).
- Ruler at N=106: labelStep-1 labels every machine, no two label x within
  24px; major ticks still on the 17 stretch boundaries (the P3
  registration pin re-anchored to the new pitch); terminal endpoint labels
  present.
- Machines view at N=161: rects (161), the ×161 caption, NO machine-band
  element.
- Grab-drag: pointerdown+move on the container background changes
  scrollLeft (jsdom-level: the handler's math unit-tested; the
  suppress-click threshold pinned); a pointerdown on a bus segment does
  NOT start a drag.
- Legend: the ruler entry text.
- **Deletion sweep (grep-grounded; enumeration COMPLETED r1 — both
  reviewers found the original list missed the highest-value file):**
  - **`p2-drawing.test.tsx` (r1, BOTH reviewers — the pitch-8-keyed
    fixtures the original grep list could never surface):** the r3
    left-fallback test (:277-352) is BROKEN TWICE at 24px: its literal
    token x (`toBe(896)` = pitch-8 boundary math) fails, AND its trigger
    INVERTS — at pitch 24 the RIGHT candidate fits inside the wider
    laneEnd, so the LEFT-suppression behaviour the test pins never fires.
    The fixture must be RE-DERIVED to force the left candidate at 24px
    (a stretch whose x2 boundary sits within TOKEN_GAP+TOKEN_WIDTH of the
    new laneEnd), with the token x and suppressed label re-computed —
    never renamed blind. The N=130 narrow-thinning fixture (:354-409)
    SURVIVES (a 1-machine stretch still trips endpointsCollide at 24px —
    verified both pitches) and the AC1 count-only pins (:412-429)
    survive; both re-verified, not assumed.
  - `layout.test.ts:104-119` (r1): the compression describe — the
    `labelStep toBe(5)` pin dies with the machinery; the pitch pin's
    comment re-derives; the N=2000 pin re-derives against the 24 floor.
  - The TWO surviving significant flip pins BOTH read the deleted `band`
    field and must be DE-BANDED, not merely kept:
    `layout.test.ts:157-175` (N=106, `.band` at :163) and `:189-203`
    (N=114, `.band` at :195) — drop the `.band` assertions, keep the
    significant assertions.
  - `labeledSignificant` pins (`:256-260`-era + the labeledSignificantOf
    describes) — DELETE with the machinery.
  - The band smoke pins (`smoke.test.tsx` ×161/machine-band in the
    MACHINES suite — re-pin to rects+caption); the P3 band-mode ruler pin
    (re-pin to scrolled ruler at N=161).
  - Every literal `8`-as-minPitch / `114`-as-threshold / derived-width
    assertion — re-derive from the new constants, never find-replace
    (r5 cross-reference: this rule governs LAYOUT-VALUE assertions only;
    threshold-PREMISE tests delete or re-pin per the scoping below —
    never "re-derive").
  - **THE GREP IS THE AUTHORITY (r2 inversion — the manual enumeration
    was under-inclusive twice running, the recurring sweep class):** the
    gate is `grep -rin "band\|labeledsignificant\|labelstep\|minpitch\|114" src/`
    — CASE-INSENSITIVE (r3 fix: the case-sensitive form missed
    `MachineBand`, the primary deletion target; `-i` folds
    bandMode/machine-band/MachineBand into the one `band` token) — with
    EVERY hit given an explicit disposition (delete / de-band /
    re-derive / discard-as-unrelated) before the diff goes to review —
    zero undispositioned hits. The enumeration here is the MAP, not the
    gate. Known dispositions the r2 reviewers added:
    `layout.test.ts:5` (the bandMode IMPORT — dies with bandMode or the
    whole file fails to load); `:178-187` (the bandMode threshold
    describe — DELETE, it cannot be re-derived); `:230-237` (the
    significant set-union pin — DE-BAND :232, KEEP the toEqual);
    `:309` (another .band read in the N=161 describe — de-band or delete
    with its labeledSignificant host); `smoke.test.tsx:532-567` (the #78
    ticks-vs-labels band pin — DELETE, hard-fails with MachineBand);
    `:569-614` (the #86 band label-centering pin — DELETE).
    Blueprint.tsx:278-280 / Blueprint.geometry.test.ts hits are the
    site-plan's unrelated "band" sense — discard, touch nothing.
    The p2-drawing pitch-8 fixtures (named above) are map-only for
    their pitch-8 SEMANTICS — the gate cannot see that their literals
    derive from pitch 8 (r3 correction: the earlier "contain NONE of
    the grep tokens" claim was FALSE — `p2-drawing.test.tsx:326` has
    `fromMachine: 114` as fixture data, a gate hit whose disposition is
    discard-as-data). Both lists apply.
    Known unrelated-hit discards beyond Blueprint (r3): the vertical
    lane-band/outBandY sense in `layout.test.ts:46,:50-52`.
    The build-view `not.toContain("machine-band")` pins at
    `smoke.test.tsx:221,:234` — dispositioned DELETE (r4 correction of
    the r3 KEEP: post-retirement the machine-band class has NO producer
    anywhere in src, so the pins are green BY CONSTRUCTION — a
    tombstone, not a guard; the sibling not.toContain('class="machine"')
    pins remain the meaningful build-view leakage guards since machine
    rects still exist in the Machines view).
    `smoke.test.tsx:616-624` (r4 — the undispositioned 114-token hit the
    category rule misdirected): the "below the threshold (N=114): the
    full rect row, no band" MACHINES pin — its threshold PREMISE dies
    with bandMode (N=114 renders identically to N=161 post-retirement),
    so "re-derive" is the wrong action; disposition: DELETE (simplify
    pass adjudication, superseding the r4 RE-PIN: post-retirement the
    render path is un-branched, so an N=114 rect-count pin is a third
    collinear point behind the N=20 and N=161 pins — the N=161 re-pin
    uniquely carries the caption + retirement boundary; N=114 pins
    nothing they don't). The
    "114-as-threshold → re-derive" category rule is hereby scoped to
    LAYOUT-VALUE assertions only — THRESHOLD-PREMISE tests delete or
    re-pin, never "re-derive".
- Bidirectionality log at `features/build-view-pan/r2-verification.log`.

## Acceptance criteria

1. Michael's 106-machine build view renders at 24px pitch, pans by drag
   and scroll, and the right end is uncrushed (terminal labels + 3-digit
   ruler numbers separated).
2. The Machines view pans the same way; ×N is always visible; no band.
3. The legend names the ruler's two tick kinds.
4. N≤38 drawings are pixel-identical to today (pitch unchanged above the
   old fit range — verify: at what N does today's pitch first differ?
   floor(912/N) < 24 ⇔ N ≥ 39; so N ≤ 38 identical, pin one).
5. `npm test` + `npm run check` green.

## Assumptions ledger

- The scroll container + `scrolled` flag already exist and both views use
  them — verified `layout.ts:294-295`, `Schematic.tsx:686`,
  `Machines.tsx:102`, `app.css:693-700`.
- Band mode's premise (unreadable sub-8px ticks) is unreachable at a 24px
  floor — by construction; its retirement supersedes S12 P1 on Michael's
  2026-08-19 directive (#154).
- `significant` (the ruler's major-tick source) is independent of band
  machinery — verified in P3 (un-gated, pure set-union).
- 24px separates 3-digit labels — arithmetic above; the no-overlap pin
  enforces it.
- No consumer outside layout/Schematic/Machines reads `band`/
  `labeledSignificant`/`labelStep` — to be grep-verified by the
  implementer (the reviewers check the claim now).

## Revision history

- v1 — initial; dispatched to the degraded correctness pair.
- **r1 → r2** (design review r1: code-reviewer NEEDS_REWORK — 1 IMPORTANT
  + 4 NITs; adversarial NEEDS_REWORK — 2 HIGH + 2 MEDIUM + 2 LOW; all
  folded): (1) BOTH found the p2-drawing.test.tsx pitch-8 fixtures the
  sweep never named — the adversarial additionally proved the r3
  left-fallback fixture's TRIGGER inverts at 24px (the right candidate
  fits again), so it needs re-derivation, not re-pinning; the
  N=130/AC1 survivals verified. (2) layout.test.ts:104-119 compression
  pins enumerated. (3) The TWO surviving flip pins read the deleted
  `band` field — de-band instruction added (:157-175 AND :189-203).
  (4) The #138 scope collision resolved: the band removal framed as a
  forced consequence of the floor change with the rects+caption as
  #138's neutral placeholder + a coordination comment on #138 at merge.
  (5) The N=39 24px-sliver scroll accepted with rationale + a boundary
  pin. (6) The Blueprint "band" grep-noise note. (7) NITs: the floor
  range corrected to [102..114]; the legend entry re-idiomed to
  ConventionEntry (the legend-swatch count pin); the halo attribution
  dropped from the A1 arithmetic (.machine-label has no halo); the
  reuse-first note (blueprint-zoom is native-scroll-only; nothing to
  reuse). Verified sound by both: the root-cause and boundary arithmetic,
  labelStep's collapse, the confined blast radius with significant
  independent, the scrolled-simplification equivalence, no width cap
  needed, decision conformance incl. the honest S12 P1 supersession.
  r2 goes to both correctness reviewers.
- **r2 → r3** (design review r2: both NEEDS_REWORK — 1 IMPORTANT each,
  heavily overlapping: the "COMPLETED" sweep enumeration was STILL
  under-inclusive — layout.test.ts:5 import + :178-187 bandMode describe
  (whose deletion otherwise kills the whole file), the third de-band
  site :230-237/:232 + :309, and two unnamed smoke band pins :532-567 /
  :569-614; 1 NIT — the labelStep-fate contradiction between A4 and
  Changes). Folded by INVERTING the authority: the grep (extended with
  bandMode/machine-band tokens) is now the gate — every hit explicitly
  dispositioned, zero undispositioned — with the enumeration as the map
  carrying all reviewer-verified dispositions; the p2-drawing fixtures
  stay map-only entries (no grep token matches them). labelStep's fate
  fixed to RETIRES (A4 governs). Verified sound by both: the
  left-candidate forcing geometry EXISTS at 24px (m ≥ N−1 forces LEFT;
  the current fixture's m=113 at N=115 is exactly why the trigger
  inverted), the ×N caption is preserved content (already rendered
  inside the band face), the #138 treatment honest, all four r1 NIT
  fixes correct. r3 goes to both correctness reviewers.
- **r3 → r4** (design review r3: code-reviewer APPROVED — the inversion
  proved itself, the gate caught a pin the map omitted; adversarial
  NEEDS_REWORK — 2 IMPORTANT + 1 NIT, folded): (1) the gate was
  case-sensitive and BLIND to `MachineBand` (Machines.tsx:24,:109 carry
  no lowercase token) — the gate is now `grep -i`, folding every band
  casing into one token; (2) the "contain NONE of the grep tokens"
  claim was false (`p2-drawing.test.tsx:326` has `fromMachine: 114` as
  data) — corrected to map-only-for-semantics with the data hit's
  discard disposition; (3) NIT — the discard list widened
  (layout.test.ts lane-band sense; the smoke not.toContain pins
  dispositioned KEEP as the permanent absence pins). Verified sound by
  the same round: :230-237's keep is genuinely survivable (the fixture
  has no band-only setup), :309 deletes with its labeledSignificant
  host, the labelStep reader instructions coherent, and the tsconfig
  noUnusedLocals backstop noted. r4 goes to both correctness
  reviewers.
- **r4 → r5** (design review r4: code-reviewer APPROVED — gate verified
  zero-undispositioned on its run, folds faithful; adversarial
  NEEDS_REWORK — 1 IMPORTANT + 1 NIT, folded, including a
  reviewer-vs-reviewer split resolved AGAINST the r4 code-reviewer):
  (1) IMPORTANT — smoke.test.tsx:616-624 (the N=114 below-threshold
  MACHINES pin) was an undispositioned 114-token hit that the
  "re-derive" category rule actively misdirected (a threshold-premise
  test cannot be re-derived once the threshold dies); dispositioned
  RE-PIN to a plain rects+caption render, and the category rule scoped
  to layout-value assertions only. (2) The :221/:234 KEEP flipped to
  DELETE — the adversarial proved machine-band has no producer anywhere
  post-retirement, so the pins are green by construction (the
  code-reviewer's "future reintroduction" defense applies to any
  deleted string ever and is not a pin rationale); the sibling
  class="machine" pins carry the real leakage guard. Cleared by the
  same round: the -i gate's sufficiency (MachineBand surfaced), the
  collapsed token set a strict superset, the :326 discard-as-data,
  no fold contradictions. r5 goes to both correctness reviewers.
- **r5 — CONVERGED** (design review r5: code-reviewer APPROVED;
  adversarial APPROVED_WITH_NITS — the :174 cross-reference folded, and
  the N=114-redundancy observation handed to the simplify lens).
  Correctness gate closed after five rounds.
- **simplify (one-shot) — APPROVED_WITH_NITS, both folded:** (1) the
  N=114 re-pin adjudicated DELETE (superseding the r4 RE-PIN — the
  un-branched post-retirement render makes it a third collinear point
  behind the N=20 and N=161 pins); (2) the ruler hover sentence dropped
  from A5 AND Changes item 2 (AC3's requirement is the legend entry).
  Confirmed already-simple: useGrabScroll, the scrolled simplification,
  the sweep's gate+map sizing.
- **scoped re-run on the simplify folds:** code-reviewer NEEDS_REWORK —
  2 IMPORTANT, both BOOKKEEPING defects from the folds themselves (the
  stale Changes-item-2 hover instruction; the ledger missing the
  post-r5 entries — root cause: two unasserted string replaces silently
  no-op'd, the team lead's own recurring class), both fixed in this
  revision with asserted edits; adversarial APPROVED (the DELETE loses
  no distinct pin — no boundary survives at N=114 under the new
  constants; the legend-only answer adjudicated sufficient against the
  ticket's own legend-incompleteness framing, with the
  point-of-confusion caveat noted as Michael's product call, not a
  defect). One more scoped confirmation pass closes the loop.
