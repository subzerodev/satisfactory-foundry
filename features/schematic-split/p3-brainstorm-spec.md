# P3 — the schematic splits: build view + ruler, machines view (#135)

**Arc:** #140 Phase 2 (FEATURE.md P3). Fresh merged brainstorm+spec on the
POST-P2 ribbon drawing — supersedes `brainstorm-spec.md` (the pre-arc r3,
kept as historical record; its axis shape was AGREED by Michael on
2026-08-19, #135 c24913, but its anchors predate the overflow model).
Anchors verified against `develop` @ `8bb34b5` (post-P0/P1/P2/P4).

## Already settled — do NOT re-litigate

- **The split** (#135 c24630): the bus/feed drawing answers "how to build
  it + what is over capacity"; the 106-machine block becomes its own view.
- **The axis** (#135 c24913, Michael's option-A pick on a rendered mockup
  of the NEW drawing): a 12px two-mark ruler — MAJOR ticks at
  belt-stretch boundaries (solver-derived, both density modes), MINOR
  ticks binding each label to its machine cell. ~28px reclaimed.
- **#138 owns what the machines view SHOWS.** This ticket moves the block
  verbatim; no content redesign here.
- **Presentation only.** No solver change, no store field (the view choice
  is component-local like today's `View` state, App.tsx:178).
- Prior #135 gates (r1: the band-threshold error + no-ticks blocker; r2:
  the registration defect + the mechanical set) are folded INTO this
  design from the start — their findings appear below as requirements,
  not as open questions.

## The post-P2 base (what changed under the old r3)

The feed buses are now tapering ribbon POLYGONS with endpoint labels
ABOVE each ribbon (`busY − 13`) and grown feed seams (±11) — all inside
the feed lane rows, which sit ABOVE the machine row and do not touch it.
The machine row itself is untouched by P0-P2: `machineTop` has no
`machineH` term (`layout.ts:316-317` — only `outputTop`:318 and
`height`:323-328 carry `LAYOUT.machineH`), the non-band arm renders
rect+label only (no tick line), the band arm renders the grey band + ×N +
`significant` ticks. `significant` is still hard-empty when `band` is
false (`layout.ts:291-297`, the two ternaries). Output lanes anchor `machineTopY + 40`
(`Schematic.tsx:735`); the band tick literal `top + 40` at `:575`.

## Design

### D1 — the ruler (build view, both density modes)

`LAYOUT` gains `rulerH: 12`. `computeLayout` gains a third parameter
`machineRowH = LAYOUT.machineH` (default 40 keeps every existing call
site compiling — the r2-counted ~21-22 sites in layout.test.ts,
smoke.test.tsx, coincident-feed-marks.test.tsx). The Schematic (the build
view) passes `LAYOUT.rulerH`. `machineTop` is untouched (it has no
machineH term — the register with the feed lanes and P2's endpoint rows
is pixel-identical by construction); `outputTop` and `height` use the
parameter, so the build view shrinks by 28px and the output lanes rise
with it. **The one hardcoded literal that survives into the build view
(r1 adversarial HIGH):** the output-lane anchor `machineTopY + 40` at
`Schematic.tsx:735` is the machine row's BOTTOM edge feeding the output
break-out arrows' top endpoint (`:467`); it MUST become
`machineTopY + machineRowH` (= + rulerH in the build view), or every
output arrow detaches from the shrunken row — the risen `outputTop`
happens to EQUAL the old `machineTop + 40`, so the arrows would float
inside the output lane, an error no existing test pins. A new pin
asserts the output belt-arrow `y1 === machineTop + rulerH` in the build
view.

**`significant` computes in BOTH modes (the r2 registration fix):**
`layout.ts:292` drops the `band ?` gate — `significantMachines(result, N)`
always runs (the `band ?` ternary head at `layout.ts:291`) (it is a pure set-union over existing solve data; entries,
breakouts, segment bounds, finding refs). `labeledSignificant` stays
band-gated (label thinning is a band-density concern). The
`SchematicLayout` doc comments for both fields update.

One `Ruler` sub-component replaces BOTH machine-row arms in Schematic:

- A baseline at `machineTop + rulerH` spanning the row.
- **Major ticks** (full 12px) at `xOf(index)` — the machine's LEFT edge,
  `boundaryX` — for every index in `significant`: these are the belt-span
  boundaries the axis exists to register with (the r1 blocker's fix: the
  ticks are solver-derived in both modes, never `labelStep` arithmetic).
- **Minor ticks** (4px, from the baseline up) at `m.x + pitch/2` — the
  cell CENTRE — for every labeled machine (`m.labeled` in non-band mode;
  `labeledSignificant` in band mode): the mark that binds each number to
  its machine (the r2 registration defect's fix — a label is never
  equidistant between two boundary ticks again).
- **Labels** keep their content and x (`m.x + pitch/2`), baseline
  `machineTop + rulerH + 12` = machineTop + 24 — inside the busH band
  (28px) above the risen outputTop, same clearance idiom the old +52
  baseline had under machineH 40.
- The band-mode extras die here: the grey band `<rect>` and the ×N count
  leave the build view (the count moves to the machines view); the
  `machine-band-mark` ticks are subsumed by the major/minor ruler marks.

### D2 — the machines view

New component `Machines.tsx`: the block, lifted verbatim (the r1
"lift-and-shift is impossible" blocker applied to the RULER, not the
block — the block's two arms ARE liftable):

- non-band arm: per-machine `<rect>` (pitch−2 × 40) + thinned labels —
  today's `Schematic.tsx` non-band branch.
- band arm (N > 114): the `MachineBand` component moves here whole (band
  rect, ×N count, significant ticks + labels).
- Its own `<svg>`: width = the same `computeLayout(result, N)` width
  (default machineRowH 40 — the machines view uses the stock layout);
  height = `marginY*2 + machineH + 24` (the row + label band). The
  machine row renders at `y = marginY` — the view has no lanes, so none
  of the lane-relative fields are read.
- No new solve math; `computeLayout` is called once per view render
  exactly as the Schematic does today (memoized the same way).

### D3 — the view switcher

`App.tsx`'s `View` union (`:86`) gains `"machines"`; a third tab in the
existing `view-tabs` block (`:448-460`-era) labeled `Machines`; the
render branch mounts `Machines`. Component-local state exactly as today
(no store field, no persistence — the r1-verified five-site blast radius
in App.tsx). Tab order: Schematic, Machines, Blueprint (the block's view
sits next to the drawing it left).

### D4 — what does NOT change

The ribbons, endpoint labels, seams, tooltips, cards, legend, findings
(P2 surface): untouched — the feed lanes and `machineTop` are
pixel-identical (D1). **What MOVES, enumerated (r1 fold — output-side
motion is not implicit):** `outputTop` −28, output `track.y`/`busY` −28,
the output-lane name baseline −28 (the smoke re-pin), and the output
break-out arrows' top endpoint (the `:735` parameterization above). All
four move together or the drawing breaks; the height shrinks 28. The Blueprint/site plan: untouched. The solver and
store: untouched. `#139`-era copy: untouched (already retired in P1).

## Tests

- **Ruler registration (the r1/r2 defect class, now pinned):** at N=20
  (pitch 45, labelStep 1): every `significant` index draws a major tick
  at `xOf(index)` (assert a tick x EQUALS a segment boundary x taken from
  the same layout's feed segments); every machine draws a minor tick at
  `m.x + pitch/2`; labels sit under minor ticks (same x). At N=106
  (non-band): `significant` is NON-EMPTY (the un-gated computation) and
  major ticks land on the 17-stretch boundaries.
- **Band-mode ruler** at N=161: major ticks from `significant`, labels
  from `labeledSignificant`, NO band rect and NO ×N in the build view.
- **Output-arrow register (the r1 HIGH's pin):** in the build view the
  output belt-arrows' `y1` equals `machineTop + rulerH` (the row's new
  bottom) — the pin that did not exist for the old `+ 40`.
- **Height reclaim:** build view height at machineRowH 12 is exactly 28px
  less than at 40 (same fixture through `computeLayout(result, N, 12)` vs
  default); `machineTop` IDENTICAL in both (the register pin).
- **Machines view:** renders the rects (N=20 → 20 rects), the band + ×161
  at N=161, and nothing lane-related; the third tab mounts/unmounts it
  (smoke).
- **computeLayout default:** one call without the third argument
  type-checks and equals the machineRowH-40 result (the ~21 existing call
  sites stay valid — `npm run check` is the gate).
- **Relocations/re-pins (the five r2-enumerated breakers, re-verified
  against current smoke.test.tsx before freezing — the implementer
  re-greps, P2/P4 moved lines):** the ≥20-rect pin (moves to the machines
  view test), the machine-band/×161 pins (move), the `class="machine"`
  count (moves), the class-name pins (split between views), and the
  output-lane name y literal (re-derive: −28 under the risen outputTop —
  it pins the SHIFT, do not delete it). PLUS the sweep additions: grep
  `machine-band`, `machineH`, `+ 40`, `significant` over src/ui tests —
  the TWO below-threshold empties (r1-located): `layout.test.ts:132-135`
  (`significant` empty at N=114 — FLIPS to non-empty under the
  un-gating) and `:256-260` (`labeledSignificant` empty — STAYS empty,
  it remains band-gated); re-pin them distinctly.
- Bidirectionality log per behaviour (ruler marks, un-gated significant,
  height/param, machines view, tab) at
  `features/schematic-split/p3-verification.log`.

## Acceptance criteria

1. At Michael's 106-machine case the build view shows ribbons + the 12px
   ruler (no 40px block, no grey band) with major ticks on real stretch
   boundaries; the Machines tab shows the block.
2. `machineTop` and every feed-lane/P2 pixel are unchanged in the build
   view; total height shrinks by 28px.
3. The machines view renders both density arms verbatim (rects below the
   threshold, band + ×N above).
4. No solver/store/persistence change; the view choice is
   component-local.
5. `npm test` + `npm run check` green.

## Assumptions ledger

- `machineTop` has no machineH term — verified `layout.ts:316-317`
  (r2-verified, re-verified post-P2; the register guarantee is
  structural).
- `significantMachines` is pure over existing solve data and safe to run
  in both modes — verified `layout.ts:106-171` (a set-union; no band
  dependency inside).
- The block's two arms are liftable verbatim — verified: the non-band arm
  (`Schematic.tsx` rect+label branch) and `MachineBand` read only
  `machines/significant/labeledSignificant/pitch/top`, all on the layout
  object; no lane coupling.
- The five breaking tests are the complete set for the OLD row —
  r2-enumerated; the implementer re-greps before the sweep (P2/P4 moved
  lines; the memory-rule class).
- ~21-22 `computeLayout` call sites need the default — r2-counted;
  `npm run check` enforces.

## Revision history

- P3-v1 — fresh merged brainstorm+spec on the post-P2 base; the prior
  #135 r1/r2 findings folded in as requirements (band-threshold, ruler
  ticks solver-derived, registration minor ticks, machineTop
  no-shift, the five test relocations, the computeLayout default);
  Michael's axis decision c24913 locked in. Dispatched to the degraded
  correctness pair.
- **P3-r1 → r2** (design review r1: code-reviewer APPROVED_WITH_NITS — 3
  citation NITs, folded; adversarial NEEDS_REWORK — 1 HIGH + 1 LOW + 1
  NIT, folded): (1) HIGH — the hardcoded output-arrow anchor
  `Schematic.tsx:735` (`machineTopY + 40`) was named as an anchor but
  never parameterized; under the ruler the risen outputTop EQUALS the
  old literal, so output arrows would float inside their lane, detached
  from the row, unpinned by any test — D1 now prescribes
  `+ machineRowH` and a new y1 register pin; (2) LOW — D4 now enumerates
  the four output-side movers explicitly; (3) NIT — the flip pin is TWO
  tests (:132-135 flips, :256-260 holds), cited distinctly; citation
  off-by-ones fixed (:291 ternary head, :106-171, :291-297). Verified
  sound by both: the register guarantee, the un-gated significant's
  purity + threshold arithmetic, the label-baseline y-map, the
  machines-view sizing (52 < 48+marginY fits in 96), ruler readability
  at the threshold edge without extra thinning, ~23 default-safe call
  sites, decision conformance. r2 goes to both correctness reviewers.
- **P3-r2 — CONVERGED** (design review r2: code-reviewer APPROVED;
  adversarial APPROVED_WITH_NITS — 1 NIT, folded: the output-name re-pin
  prose now names WHICH call it targets, since the default-call pins
  correctly stay at 194). The adversarial additionally proved the new
  y1-register pin falsifiable under the coincidence trap (wrong code
  renders 40, the pin demands rulerH=12), re-swept the build-view path
  (:735 is the sole surviving literal; CSS has no height cap; no fifth
  mover), and confirmed the flip-pin split. Correctness gate closed
  after two rounds; the one-shot simplify pass follows.
