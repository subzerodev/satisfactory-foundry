# #134 — Extraction panel room (Stage 23)

**Ticket:** #134 · **Epic:** #136 · **Milestone:** 94 · **Tier:** 2
**Status:** design r8 — the CSS is unchanged since r5 and has now been confirmed
sound by four consecutive reviewer pairs. r8 repairs a gate assertion that was
inert in the world-state it named, completes an enumeration that was presented as
exhaustive, and corrects four justifications that still did not match the
evidence they cited.

## Purpose

Michael: *"i dont like having to scroll the little panel."* The purity-mix
controls #124 shipped sit below the fold. Outcome: at his real canvas the whole
panel is visible without scrolling.

## Settled, and not re-opened

The 260/170 caps are **not stale constants** — they are collision limits. The
canvas has furniture below the panel and the caps stop the stack reaching it.
`features/extraction-planning/phase-1/brainstorm-spec.md:338-342` states this;
`phase-1/r2-verification.log:70` is the checked-in evidence of the assertion
firing:

```
FAIL 360/extraction: top-right stack overlaps bottom-left controls; stack y=49..269, controls y=220..324
```

## Why this is r8

Each round failed on a different thing, and the pattern is worth keeping:

- **r1–r3** asserted rendered layout from CSS source. r3's cap resolved against
  the wrapper, not the canvas, so its "fix" *lowered* the cap from 260 to 234.
- **r4** fixed the basis by measurement and drew zero BLOCKERs — then both
  reviewers noted it never asked whether its own premise was necessary. It
  inflated the wrapper, which forced a `pointer-events` rule and a rebinding of
  the gate's collision assertions.
- **r5** adopted the shape both reviewers proposed, and measured it first. Both
  confirmed the *design*: the percentage resolves, the wrapper stays
  `min(content, cap)`, `:141-143` stay unmodified and armed, the constants are
  derived rather than fitted. Both then rejected the *write-up*, because two of
  its central justifications were contradicted by the log it cited.

- **r6 and r7** changed no part of the shape either. Each replaced false
  justifications with true ones, and each was rejected for a fresh instance of
  the same class: a claim that is true, cited to evidence that does not support
  it.

**r8 changes no part of the shape.** One of its corrections is substantive
rather than editorial — gate change 3's assertion could not fire in the
world-state the write-up named as its witness, so the assertion itself is
rebound. The rest close the evidence gaps r7's pair found.

## The box chain, measured

`features/panel-room/probe-r6.log`, produced by `probe-r6.mjs`. Canvas-local
coordinates.

| Box | What sets it | Role |
|---|---|---|
| `.graph-canvas` | `app.css:1237-1253` — `border-box`, `height: 560px`, `min-height: 340px`, `max-height: 85vh`, `resize: vertical`, `border: 1px` | definite height `H` |
| `.react-flow` | inline `wrapperStyle`, `@xyflow/react/dist/esm/index.js:3721-3727`, applied `:3736` — `position: relative; height: 100%` | definite, **measured `1..H−1`**; the percentage basis |
| `.react-flow__panel.top.right` (**wrapper**) | `margin: 15px` + `top: 0` (`style.css:291-297`); narrow overrides to `top: 48px; left: 8px; right: 8px; max-width: none; margin: 0` (`app.css:1567-1573`) | the **visible** box — what the gate measures |
| `.graph-top-right-stack` (**stack**) | `app.css:1282-1290`, `:1575-1578`; the 8px inter-card gap is `app.css:1286` | flex column of cards |
| `.extraction-panel` | child of the stack (`GraphCanvas.tsx:283` → `:402`) | the panel itself |

Furniture, measured at both canvas heights: bottom-left controls occupy
`H−120 .. H−16`; bottom-right chain-power occupies `H−58 .. H−16`.

**The narrow rule really does span the full width — now measured, not assumed.**
At a 360px viewport the wrapper spans `x9..351` — the full canvas width less its
8px gutters. At 1280 it spans only the right-hand ~355px (`x909..1264` at a 340px
canvas, `x924..1264` at 560). The 15px difference is **not** shrink-to-fit
content — `.extraction-panel` is a fixed `width: 340px` (`app.css:1294`) in both
rows. It is the scrollbar gutter: present at 340, where the box overflows, and
absent at 560, where it does not.
That is the basis for the whole asymmetry below: at narrow widths the wrapper
overlaps the controls' column, so **the controls are the binding furniture**; at
desktop widths it does not, so **the power panel binds**. r5 asserted this from
CSS and never measured it.

## Design

Cap the **wrapper** as a percentage of `.react-flow`, and move the scroll
container up to it. The wrapper stays `height: auto`, so it shrink-wraps to
`min(content, cap)`.

```css
/* app.css — .graph-canvas .react-flow__panel.top.right */
max-height: calc(100% - 78px);
overflow-y: auto;
overscroll-behavior: contain;

/* app.css — .graph-top-right-stack
   max-height, overflow-y and overscroll-behavior are DELETED (moved above). */

/* app.css — @media (max-width: 720px)
   .graph-canvas .react-flow__panel.top.right */
max-height: calc(100% - 169px);
/* .graph-top-right-stack max-height: 170px is DELETED. */
```

**Why the wrapper and not the stack.** `.react-flow` has a definite height
(measured `1..H−1`), so a percentage on the wrapper resolves against a box that
is not sized by its own content — the circularity that forced r3 and r4 to give
the wrapper a definite height. The wrapper remains shrink-wrapped: **measured at
`state=notice` it is 42px tall, against a 169/260 cap**.

That shrink-wrap is what removes r4's two liabilities: no `pointer-events` rule
(so no behavioural change inside a ticket #136 scopes layout-only), and no
rebinding of `extraction-panel-browser-check.mjs:122`, so **the three collision
assertions at `:141-143` keep passing byte-identical** — what #136 asked for.

### Where 78 and 169 come from

Each is (the wrapper's top inset) + (the binding furniture's inset from the
canvas bottom) + a clearance, less the 2px of canvas border already excluded from
the percentage basis:

| | top inset | binding furniture | clearance | K |
|---|---|---|---|---|
| desktop | 16 | power panel, `H−58` | **6** | `16 + 58 + 6 − 2` = **78** |
| narrow | 49 | controls, `H−120` | **2** | `49 + 120 + 2 − 2` = **169** |

**The clearance is `H`-independent.** At any canvas height where the wrapper is
at its cap, the gap to the furniture is exactly the clearance; where the wrapper
is content-limited, it is larger. This is why the geometry matrix's pinned 340px
canvas is the **strictest** collision test, and therefore why `:141-143` needs no
560px counterpart. r5 asserted that conclusion without this support.

**Why the clearance is asymmetric, 6px desktop and 2px narrow.** The two widths
are kept clear of *different furniture*, and the two behave differently under
font drift. That, not a single ratio, is the derivation:

- **Desktop binds against the power panel, which is font-metric-derived.**
  `.graph-chain-power` (`app.css:1586-1597`) sets `padding: 4px 10px`,
  `border: 1px`, `margin: 0 18px 18px 0`, `font-size: 12px` and **no
  `line-height`** — so its measured 42px is `14 + 8 + 2 + 18`, and a font change
  moves its top edge. Clearance here buys something real, and desktop has ~100px
  of content margin to spare, so 6px is free. It also reproduces today's shipped
  6px exactly.
- **Narrow binds against the controls, which are fixed-pixel chrome.**
  `.react-flow__controls-button` is `height: 26px; width: 26px; padding: 4px`
  with `svg { max-height: 12px }` (`style.css:415-421`, `:438-443`) — no
  font-derived box anywhere, and the measured 104px column is exactly `4 × 26`.
  **Under font drift this furniture does not move at all.** The only residual
  risk is subpixel rounding, since `overlap` at `:141-143` is a strict
  comparison and tangency is therefore not a collision. 2px covers that, and it
  still improves on today's shipped 1px — so the remaining 4px goes to content
  margin, where it is scarce.

*r6's error, recorded:* it derived a ~12:1 font-sensitivity ratio from the
**desktop** furniture and then used it to justify the **narrow** cut, where the
furniture is font-insensitive. The conclusion (2px is safe at narrow) was right;
the reason was imported from the wrong pair. Applied literally, a 12:1 split of
narrow's 11px budget would give ~0.85px of clearance, not 2px.

## Measured results

`probe-r6.log`, 12 contexts (geometry 3 widths × 3 states including `notice`;
interaction × 3 widths), baseline and variant per context — 24 measured rows.

| Canvas | Width | Baseline wrapper | Variant wrapper | Content | Scrolls? | Clearance |
|---|---|---|---|---|---|---|
| 340 | 360/720 | 170 | **169** (at cap) | 380 | yes (correct) | 2px to controls (was 1px) |
| 340 | 1280 | 260 | **260** (at cap) | 380 | yes (correct) | 6px to power (unchanged) |
| 560 | 360/720 | 170 | **380** (content) | 380 | **no** | 11px to controls |
| 560 | 1280 | 260 | **380** (content) | 380 | **no** | 106px to power |

1. **The ticket's goal is met** — at the real 560px canvas the mix is fully
   visible at all three gate widths, `scrollHeight === clientHeight`.
2. **The desktop cap at 340 is 260 — exactly today's shipped constant**, with
   exactly today's 6px clearance.
3. **Wrapper-vs-furniture collisions are `false` in all 24 rows**, baseline and
   variant alike, so `:141-143` are green without modification.
4. **The wrapper shrink-wraps** — 42px in `state=notice`, far below its cap.

### Transparent area: the comparative claim, which is the one that is true

r5 claimed the `elementFromPoint` samples were adequate "because the wrapper's
box is unchanged from baseline in every state where it is not at its cap."
**False, and r5's own log disproved it**: at 560px the wrapper goes `h170` →
`h380`, because deleting the stack's cap is the entire fix.

r6 replaced that with `deadZone = 0` in all 24 rows. **That was also too strong,
and its own log again carries the counter-example.** `deadZone` is
`wrapper.height − min(stack.height, wrapper.height)` (`probe-r6.mjs:110`) — a
one-dimensional measure of slack *between the wrapper and the stack*. It is
therefore blind to two whole classes of bare area: anything beside the content
horizontally, and anything *inside* the stack, which is subsumed in
`stack.height` before the subtraction ever happens. **At least three such regions
exist** — r7 enumerated two and presented the list as exhaustive, which is what
this round rejected:

- **the notice band**, wherever the notice card is narrower than the box beside
  it. `.graph-canvas-notice` sets `max-width: 240px` with `padding: 6px 10px` and
  `border: 1px` (`app.css:1269-1274`) and **no `box-sizing`** — `app.css` carries
  no universal reset (eight `box-sizing` declarations, all per-rule, none
  reaching this selector), so the 240 is a *content-box* cap and the rendered
  border box is **262**. That figure is measured, not derived: the desktop
  `notice` wrapper shrink-wraps to exactly `x1002..1264` (`probe-r6.log`). So at
  narrow `notice` the band is `342 − 262` = **80px**, not the ~100 r7 claimed by
  subtracting a content-box cap from a border-box measurement — the wrong-box
  error that sank r1–r3. The band is also **not narrow-only**: in `combined` the
  262px notice sits beside a fixed `width: 340px` panel (`app.css:1294`), leaving
  the same band on desktop;
- **the scrollbar gutter**, in the variant's at-cap rows: the stack measures 15px
  narrower than the wrapper (`x9..336` vs `x9..351`; `x909..1249` vs `x909..1264`
  at desktop). *Stated precisely, because the obvious phrasing is wrong:* all six
  `overflowing=true` rows are `VARIANT-D`, so that correlation is **within one
  arm** and cannot by itself say anything about the baseline. `deadZone` also
  cannot tell a gutter from a hole;
- **the 8px inter-card gap**, in `combined`: `.graph-top-right-stack` sets
  `gap: 8px` (`app.css:1286`) and no `background`, so a full-width band between
  the notice and the panel is transparent to canvas. This spec already relies on
  that gap at "`combined` state content is 430px" below (42 + 8 + 380). It sits
  *inside* `stack.height`, which is precisely why `deadZone` reports 0 while it
  exists.

**The claim this design actually needs is comparative:** *the change adds no
transparent area the shipped build lacks.*

**It is discharged structurally, not by enumeration — and that distinction is the
lesson of this round.** r6 tried to discharge it with a metric (`deadZone`) that
measures one axis between two boxes; r7 tried to discharge it with a list, and
the list was short by one. A list can always be short by one, so the argument is
made from the diff instead:

> The change moves three declarations (`max-height`, `overflow-y`,
> `overscroll-behavior`, plus the narrow `max-height`) from
> `.graph-top-right-stack` up to `.react-flow__panel.top.right`. It adds no
> element and removes none; it sets no `background` and clears none; it changes
> no child's width, padding, border or gap. **Every background-less box in the
> variant therefore has an identical counterpart in the baseline**, and only two
> things can differ: the wrapper's *height*, where the cap now binds it, and
> *which element owns the scrollbar*.

Both differences are accounted for. The height difference is the fix itself, and
what fills it is opaque panel content, not bare area — `deadZone = 0` in all 24
rows is the measurement that establishes there is no wrapper-vs-stack slack to
fill. The scrollbar difference moves the gutter's owner, not its position or its
opacity.

The three regions above are **spot-checks of that structural claim, not the claim
itself** — so the argument does not depend on the list being complete. Each
checks out:

- the notice band is a property of the notice card's own `max-width`, and the
  baseline stack spans the same `x9..351` (`probe-r6.log`, `BASELINE 360px notice`)
  — **measured**;
- the 8px gap is set on the stack, which this design does not touch apart from
  deleting its three cap/scroll declarations — **source-derived**
  (`app.css:1286`), and corroborated by `content=430` appearing in both arms;
- the scrollbar gutter lands in the same x-band either way. Today the **stack**
  is the scroll container (`app.css:1288`); under this design the **wrapper** is,
  and its scrollbar occupies the same strip, which is why the stack's box then
  measures `x9..336`. The gutter moves owner, not position.

  **Label this one carefully — it is derived, and r7 called it measured.** The
  best baseline evidence is `BASELINE 1280px extraction`, where the shipped stack
  spans `x909..1264` (**355px**) around an `.extraction-panel` fixed at
  `width: 340px` (`app.css:1294`). Both figures are measured and nothing else in
  the CSS accounts for 15px, so a scrollbar in the shipped stack is the sound
  reading — but it is a **reading, not a direct observation**, because *the probe
  never measures the stack's scroll state at all.* `probe-r6.mjs:119-120` records
  `wrapperScroll` only, which is why baseline rows report `content=170/170` and
  `260/260`: that is the **wrapper** reporting `scrollHeight === clientHeight`,
  not the stack. *r7 cited the narrow `notice` rows, where wrapper and stack are
  equal widths — rows that cannot witness a scrollbar either way — and labelled
  the result "measured". Same class again.*

**On the vertical axis, `deadZone = 0` establishes less than r7 said it did.** It
establishes that the wrapper adds no slack around the stack — true, and expected,
since `.react-flow__panel` has margin only, no padding or border
(`style.css:291-295`). It does **not** establish that the wrapper contains no
vertical bare area, because the 8px gap is vertical bare area and `deadZone`
reports 0 in the very rows that contain it. The vertical axis is discharged by
the same comparative argument as the horizontal one, not by the metric alone.

r4's regression was a *new* transparent region ~528px tall. This design creates
none, and that is a different and weaker statement than "there is no transparent
area at all", which is what r6 wrongly claimed.

**What the change does newly cover, read off the log rather than summarised.**
Two sample points fixed in **y**, because the shipped wrapper ends at a
different y per width — 219 narrow, 276 desktop — so one point cannot witness
both. They are *not* fixed in x: `hitAt` takes x from `(w.left + w.right) / 2`
(`probe-r6.mjs:96-99`), the wrapper's own centre, which differs between arms
wherever the wrapper's width does — at `1280 interaction`, baseline x = 1086.5
against variant x = 1094. The rows below are unaffected (both x values fall
inside both boxes), but the probe's "both arms probe the same point" comment
overstates it. At the 560px canvas:

| Width | y=239 baseline → variant | y=296 baseline → variant |
|---|---|---|
| 360 | `stage-node-recipe` → `P` | `react-flow__pane` → `SPAN` |
| 720 | `stage-node-power` → `P` | `react-flow__pane` → `SPAN` |
| 1280 | `extraction-result` → `extraction-result` | `react-flow__pane` → `INPUT` |

The taller panel does cover canvas that was previously clickable, **with opaque
panel content — the feature working, not a dead zone.** Note the 1280/y=239 row:
the baseline already returns panel content there, because y=239 is *inside* the
shipped desktop wrapper. r6 quoted that row as evidence of newly-covered canvas;
it witnesses nothing. The y=296 column is what covers the desktop case, and it
was added after a reviewer showed the desktop band had never been sampled.

The three furniture regions are never inside the wrapper: `ctlBtn`, `attr` and
`grip` report `insideWrapper=false` in all 24 rows.

## Known bounds

The canvas is user-resizable between `min-height: 340px` and `max-height: 85vh`
(`app.css:1246-1248`), so the honest statement is a threshold. The mix fits when:

- **desktop:** canvas ≥ **460px** (cap `H − 80` ≥ 380)
- **narrow:** canvas ≥ **551px** (cap `H − 171` ≥ 380)

The default canvas is 560px, so both hold, including Michael's case. Three
consequences:

- **Narrow clears the content by 9px** at the default canvas (389 cap vs 380),
  up from r5's 5px. Any future row added to the panel still re-breaks narrow
  first.
- **`combined` state content is 430px** — the 42px error notice plus the stack's
  8px gap (`app.css:1286`) plus 380. At the default canvas it fits on desktop
  (480) but not narrow (389), so a narrow viewport showing an error notice *and*
  an expanded mix still scrolls. Out of scope; recorded so it is not mistaken for
  a regression.
- On a phone viewport shorter than ~649px CSS pixels, `85vh` caps the canvas
  below 551 and the narrow mix still needs a short scroll. Unchanged in kind from
  today, which scrolls at every height.

## Gate changes

`scripts/extraction-panel-browser-check.mjs`. #136 requires these be
**re-derived, not re-baselined**. Each names the world-state that makes it fail.

1. **`:141-143` — unchanged.** No edit. They already measure the wrapper, which
   is still the visible box, and the 340px matrix is the strictest case (see the
   `H`-independence note above).

2. **`:150` `expectedCap` becomes derived.** Replace `innerWidth <= 720 ? 170 : 260`
   with `innerWidth <= 720 ? c.height - 171 : c.height - 80`.
   *Fails when:* a constant drifts from the furniture it encodes.

   **A naming warning, because this is the trap that killed r1–r3.** In
   `check.mjs` the const named `stack` (`:122`) is the **wrapper** element
   (`.react-flow__panel.top.right`) and `s` (`:129`) is its rect; the const named
   `content` (`:148`) is the **stack** (`.graph-top-right-stack`). There is no
   identifier called `wrapper`. Changes 3 and 4 below name the identifiers that
   exist; r5 and r7 both wrote `wrapper.…`, which would not have compiled and
   invited exactly the conflation this ticket keeps repeating.

3. **`:155` becomes an always-armed equality against the content, keeping its
   tolerance.** Assert
   `Math.abs(s.height - Math.min(rect(content).height, expectedCap)) <= 0.5`,
   and drop its `state !== 'notice'` guard so it runs in every state.

   **Why the content's rect and not the wrapper's `scrollHeight`.** r7 proposed
   `Math.min(wrapper.scrollHeight, expectedCap)` and claimed it "would fire on any
   wrapper that stopped shrink-wrapping". **It would not — it cannot fire there
   at all.** `scrollHeight` is floored at `clientHeight`, and `.react-flow__panel`
   carries margin only, no padding and no border
   (`@xyflow/react/dist/style.css:291-295`; the app's overrides at
   `app.css:1278-1280` and `:1566-1573` add none), so
   `clientHeight === getBoundingClientRect().height === s.height`. Whenever
   `s.height <= expectedCap` the expression reduces to `s.height` and the
   assertion is an identity. In the named witness — r4's exact regression, a
   wrapper forced to 260px holding 42px of content — `scrollHeight` reports
   **260**, `min(260, 260) = 260`, `|260 − 260| = 0`, and it **passes**. It would
   have been a no-op in all 18 `overflowing=false` rows of `probe-r6.log`, live
   only where content already exceeds the cap, where it degenerates to today's
   assertion with a derived constant. r7 closed r5's undefined-`contentHeight`
   gap by binding it to the one measure that self-satisfies.

   `rect(content).height` is content-derived — after the CSS change the stack
   carries no `max-height` and no `overflow-y`, so it lays out at its full
   content height and the wrapper cannot floor it.

   *Fails when*, at the pinned 340px canvas, desktop (`expectedCap` 260):

   | World-state | stack | wrapper `s.height` | computes | |
   |---|---|---|---|---|
   | healthy, at cap | 380 | 260 | `min(380,260)=260`, diff 0 | passes |
   | percentage fails to resolve | 380 | 380 | `min(380,260)=260`, diff **120** | **fires** |
   | healthy `notice` | 42 | 42 | `min(42,260)=42`, diff 0 | passes |
   | shrink-wrap lost (r4's regression) | 42 | 260 | `min(42,260)=42`, diff **218** | **fires** |

   The **0.5px tolerance is retained** — both terms are now fractional
   `getBoundingClientRect()` heights, so r5's proposed `===` would have been
   wrong for a second reason.

4. **The scroll and clip box moves from the stack to the wrapper —
   `:151-153` and `:163-171`.** Note this range **excludes `:155`**, which is
   change 3's business and reads `s` already. Today `scrollable` (`:151-153`)
   tests `getComputedStyle(content).overflowY` and
   `content.scrollHeight > content.clientHeight`, and `:165` takes
   `visible = rect(content)` — all three on the stack. Under this design the
   stack no longer carries `overflow-y`, so all three must read the wrapper
   element (`stack`, rect `s`). `content` keeps its current binding, because
   change 3 needs the stack's rect. Leaving these on the stack would make the
   scrollable test simply false and containment trivially true, the stack now
   being unclipped at full content height.

5. **`:163-171` stays post-scroll, and is documented as a chrome-avoidance test
   rather than a reachability oracle.** The tautology is real — `:164` scrolls,
   `:165` re-measures, `:167` computes `contained` against the just-scrolled
   container, so `contained` is forced true in *either* binding. But r6's
   proposed cure (capture it before the scroll) **cannot ship**, and both
   reviewers showed why: `geometryCheck` runs only against the pinned 340px
   canvas, where this design *deliberately* caps the wrapper at 169/260 against
   380 of content. The lower controls genuinely are not contained without
   scrolling there — the shipped gate's own readings show the toggle needing
   `scrollTop 68` and *Pure* `112` (`phase-2/completion-report.md:45-46`). A
   pre-scroll capture would turn a can't-fail assertion into a **can't-pass**
   one, and would contradict gate change 4 on the same run, which asserts the
   wrapper *is* internally scrollable in exactly those states.

   **The structural conclusion, which is the useful part:** at a 340px canvas
   with the wrapper binding, containment is tautological *with* the scroll and
   false *without* it. No **rect-containment** formulation of `:167` — a
   rect-in-rect test against the container that was just scrolled — is both armed
   and green there. *(Scoped deliberately: r7 wrote "no formulation", which is an
   unbounded absolute and false. A reachability formulation — post-scroll
   `elementFromPoint`, a technique already in this repo's toolkit at
   `probe-r6.mjs:81-84` — would be both armed and green. It is not proposed here,
   because it tests a different property than the one `:167` is named for.)* So
   rect containment belongs only where content fits — gate change 7, at 560px —
   and `:167` is left alone and labelled for what it is.

   **`avoidsChrome` at `:168` is not the half that can fail either, and r7 said
   it was.** After change 4, `visible` at `:165` is the rect of the wrapper —
   the same element already bound at `:122` and captured as `s` at `:129`. So
   `contained` ⟹ `r ⊆ s`; and `:141-143` assert `s` is disjoint from `t`, `ctl`
   and `p`, the same three rects `:168` tests against. `avoidsChrome` is
   therefore *implied* by the two things around it: it cannot be false unless
   `contained` is already false, or `:141-143` have already pushed an error and
   the run has already failed. **Both halves of this loop are redundant at 340px**
   — that is the honest label, and it is a stronger statement than r7's, not a
   weaker one. *(One residual: `contained` does still fire if a control is taller
   or wider than the scrollport, which `scrollIntoView` cannot fix, or if a
   control ever leaves the wrapper's scroll subtree. That is the real reason to
   keep the loop rather than delete it — that, and the `controlMeasurements` it
   feeds to the PASS line. r7 kept the loop for a reason that does not exist.)*

   *r6's error, recorded:* it cited the `PURE-NOSCROLL` probe rows as proof this
   was achievable. Those are emitted only in the 560px interaction loop, a state
   `geometryCheck` never reaches. They support gate change 7 and say nothing
   about `:163-171` — proof from the wrong world, which is the failure class
   this ticket keeps repeating.

6. **`pointerFocusControl` (`:53`, `:62`) — rebind `panel` to the wrapper**, for
   the same reason as change 4: `:53` binds it to `.graph-top-right-stack`, which
   after this design is no longer the scroll container.

   **This is the second post-scroll containment guard, and change 5's analysis
   applies to it too.** `:55` calls `scrollIntoView`, `:57` re-measures, `:63`
   computes `contained`, `:68` throws. Rebinding `panel` to the scroll container
   makes the *rect-in-rect* half of `:63` the same forced-true construct as
   `:167`. **Unlike `:167`, its other half stays genuinely armed:** `:63` also
   requires `r.left >= 0 && r.right <= innerWidth && r.top >= 0 &&
   r.bottom <= innerHeight`, which is a viewport test the container's own scroll
   cannot satisfy for it. So this guard is *partially*, not wholly, tautological
   after the rebind — and that is the fact that makes gate change 7's placement
   **before** the `pointerFocusControl` calls the right one, rather than an
   arbitrary ordering. r7 asserted that placement without stating why.

7. **New rows in the interaction loop.** At the real 560px canvas, all three
   widths, with the mix expanded and measured **before** the `pointerFocusControl`
   calls on the purity inputs (`:326-338`): assert
   `wrapper.scrollHeight <= wrapper.clientHeight + 1`, and that the *Pure nodes*
   input's rect lies within the wrapper's rect.
   *Correcting r5:* the containment half is the one that **fails on the shipped
   build**; the overflow half **passes** today, because today's scroll container
   is the stack, so the wrapper shrink-wraps and never overflows (`probe-r6.log`
   baseline: `content=170/170`, `260/260`, `overflowing=false` — measured). The
   containment half's shipped-build failure is **source-derived, not measured**:
   the probe injects the variant CSS before its `PURE-NOSCROLL` block, so no
   baseline `PURE` row exists. It rests on `phase-2/completion-report.md:45-47`
   recording 112px/22px of required scroll inside a 170/260 box. The overflow half
   is still live *after* the change — a cap below the 380px content fires it — but
   it is not the shipped-build regression witness, and r5 said it was. Naming the
   wrong witness invites confirming "the gate is armed" with the half that cannot
   fail: the wrapper/stack conflation that killed r1–r3.
   *Dropped from r5:* a `scrollTop === 0` row. When content fits, the browser
   clamps `scrollTop` to 0, so it cannot fail independently of the overflow
   assertion beside it.

8. The existing `PASS interaction` line's `extractor scroll / toggle / Pure`
   readings stay as reported measurements. They will print `0 / 0 / 0` where they
   printed `0 / 68 / 112` at 360 and 720 and `0 / 0 / 22` at 1280
   (`phase-2/completion-report.md:45-47`).

9. **Doc drift.** `phase-1/brainstorm-spec.md:338-343` states normatively that
   *the stack* is bounded, scrolls internally, and caps at 170px, and at `:340`
   that "Desktop top-right content is capped at 260px". Both sentences drift, and
   **they drift the same way**: the properties move to the wrapper, and *neither*
   number survives as a constant.

   - desktop: 260 becomes `H − 80` — 260 only at the pinned 340px canvas, **480**
     at the default 560;
   - narrow: 170 becomes `H − 171` — **169** only at that same pinned canvas,
     **389** at the default 560.

   *r7 de-constantised the desktop half correctly and then wrote "170 becomes
   169" for the narrow half — substituting one bare constant for another.* The
   phase-1 sentence is not scoped to a 340px canvas, so that rewrite would have
   installed a **fresh false constant** in the passage this spec cites as its own
   grounding. Both halves must be rewritten as `H`-relative, in the same commit.
   (Note the range: the narrow sentence runs to `:343`, not `:342`.)

## Acceptance criteria

- 560px canvas, all three widths: mix visible, wrapper not overflowing, no
  collision.
- 340px canvas: still scrolls; wrapper height equals `min(content, derived cap)`;
  `:141-143` green **without modification**.
- Canvas, controls, attribution and resize grip all still reachable, and no
  transparent wrapper region exists that the shipped build does not already have.
  This is the **comparative** claim, discharged **structurally from the diff** —
  no element added, no `background` changed, no child geometry changed — with the
  three regions above (notice band, scrollbar gutter, 8px inter-card gap) as
  spot-checks rather than as the proof. `deadZone` alone discharges neither axis.
- `phase-1/brainstorm-spec.md:338-343` updated — **both** the 260px and the 170px
  sentences, each rewritten `H`-relative rather than re-pinned to a new constant.
- `npm test`, `npm run check`, `npm run build`, both browser matrices green.

## Assumptions ledger

| Assumption | Grounding |
|---|---|
| Caps exist to avoid canvas furniture | `phase-1/brainstorm-spec.md:338-342` + `phase-1/r2-verification.log:70` |
| `.react-flow` is a definite-height percentage basis | `index.js:3721-3727` applied `:3736`; **measured `1..H−1`** at both canvas heights (`probe-r6.log`, `flow=` field) |
| A percentage `max-height` on the wrapper resolves | **Measured** — caps directly observed at the 340px canvas (169 narrow, 260 desktop). At 560 the wrapper is content-limited to 380, so the 389/480 caps there are computed from the same resolved rule, not directly observed |
| The wrapper still shrink-wraps | **Measured** — 42px in `state=notice`, against a 169/260 cap |
| Narrow spans the full width, so controls bind | **Measured** — wrapper `x9..351` at a 360px viewport vs the right-hand ~355px at 1280 |
| 78 / 169 preserve today's caps and improve clearance | **Measured** — desktop 260 with 6px, identical to baseline; narrow 169 with 2px, against baseline's 1px |
| No *new* transparent area vs the shipped build | **Structural, from the diff** — no element added or removed, no `background` set or cleared, no child width/padding/border/gap changed, so every background-less box in the variant has a baseline counterpart; the only differences are the wrapper's height (the fix, filled with opaque content, `deadZone = 0` in all 24 rows) and the scrollbar's owner. Spot-checked, not proved, by three regions: notice band — **measured** (`BASELINE 360px notice`, plus the 262px border box measured directly as the desktop `notice` wrapper); scrollbar gutter — **derived, not measured** (`BASELINE 1280px extraction` measures a 355px stack around a fixed 340px panel; the 15px is read as a scrollbar because nothing else accounts for it, and the probe never captures the stack's scroll state — `probe-r6.mjs:119-120` records `wrapperScroll` only); 8px inter-card gap — **source-derived** (`app.css:1286`, untouched by this design), corroborated by `content=430` in both arms. `deadZone = 0` establishes only that the wrapper adds no slack *around* the stack; it is blind to slack beside the content and to slack *inside* the stack, so it discharges **neither** axis by itself |
| The furniture regions stay outside the wrapper | **Measured** — `insideWrapper=false` for controls, attribution and grip in all 24 rows |
| Content is 380px (mix expanded) | **Measured in `?mode=interaction`**, with a hard liveness gate on the three mix inputs rendering; independently corroborated in `?mode=geometry` with a different fixture (`1/1/1` at clock 250 vs `0/5/0` at clock 100) |
| Containment is assertable without scrolling **at 560px** | **Measured** — `PURE-NOSCROLL contained=true overhang=-98` at all three widths. It is **not** assertable at the pinned 340px canvas, where the design intends to overflow — which is why gate change 5 drops the idea and change 7 carries it |
| `:141-143` stay green unmodified | **Measured** — false in all 24 rows |

## Revision history

**r7 → r8.** Both reviewers returned `NEEDS_REWORK` (code-reviewer: 0 BLOCKER,
3 IMPORTANT, 6 NITs; adversarial-reviewer: 1 BLOCKER, 5 IMPORTANT, 4 NITs), and
both again stated the CSS shape is sound — the fourth consecutive pair to say so.
Verdict relay: #134 comments 24655 / 24656, detail 24657.

- **Gate change 3's assertion was inert in the world-state it named** —
  *folded*, and this one is substantive rather than editorial.
  `min(wrapper.scrollHeight, expectedCap)` cannot fire on a wrapper that stopped
  shrink-wrapping, because `scrollHeight` is floored at `clientHeight` and
  `.react-flow__panel` has no padding or border, so the expression reduces to
  `s.height` whenever the wrapper is at or under its cap. In r4's exact
  regression it computes `|260 − 260| = 0` and passes. Rebound to
  `rect(content).height` — the stack's own laid-out height, which the wrapper
  cannot floor — and checked against all four world-states in a table.
  Verified against source by the team lead before folding.
- **A third bare region existed** — *folded.* The stack's 8px `gap`
  (`app.css:1286`) with no background is transparent to canvas in `combined`, and
  `deadZone` is structurally blind to it because it lives inside `stack.height`.
  Both reviewers found this independently. **Folded twice over:** the region is
  added, and the comparative claim no longer rests on the list at all — it is now
  argued from the diff (no element added, no `background` changed, no child
  geometry changed), with the regions demoted to spot-checks. r6 tried to
  discharge this criterion with a metric and r7 with an enumeration; both failed
  the same way, so the third attempt does not use a list.
- **The notice band was ~80px, not ~100** — *folded.* r7 subtracted a
  *content-box* `max-width: 240px` from a *border-box* measurement; the rendered
  border box is 262, measured directly in the log as the desktop `notice`
  wrapper. Also corrected: the band is not narrow-only, it appears in desktop
  `combined` too. The wrong-box error that sank r1–r3, recurring.
- **The scrollbar gutter was labelled "measured" on rows that cannot witness it**
  — *folded, and folded further than the finding asked.* The cited narrow
  `notice` rows have equal wrapper/stack widths. Re-cited to
  `BASELINE 1280px extraction` (a 355px stack around a fixed 340px panel) — but
  **relabelled derived, not measured**, because checking the log here showed the
  probe records `wrapperScroll` only and never the stack's scroll state, so no
  direct witness exists in either arm. Also corrected: "the 15px appears exactly
  where `overflowing=true`" is a within-arm correlation — all six
  `overflowing=true` rows are `VARIANT-D`.
- **`avoidsChrome` was named as "the half of this loop that can fail"** —
  *folded.* After change 4 it is implied by `contained` plus `:141-143`, so it
  cannot be false in a run that has not already failed. Both halves are redundant
  at 340px; the loop is kept for the residual case `scrollIntoView` cannot fix,
  and for the measurements it feeds the PASS line.
- **`pointerFocusControl` is a second post-scroll containment guard** — *folded.*
  Change 6 rebinds it to the scroll container without previously saying so. Its
  viewport half stays genuinely armed, which is what makes change 7's placement
  before it correct rather than arbitrary.
- **Gate change 9 repeated for narrow the error it fixed for desktop** —
  *folded.* "170 becomes 169" swapped one bare constant for another; the narrow
  cap is `H − 171`, i.e. 389 at the default canvas. Both halves are now
  `H`-relative. Line range corrected to `:338-343`.
- **`:304`'s "no formulation" was an unbounded absolute** — *folded*; scoped to
  rect-containment formulations, with the reachability counter-example named.
- **The 15px at `:66` was attributed to shrink-to-fit content** — *folded*; it is
  the scrollbar gutter, and `.extraction-panel` is a fixed 340px in both rows.
- **`wrapper.…` names an identifier that does not exist in `check.mjs`** —
  *folded*; changes 3 and 4 now name `stack`/`s`/`content` as bound, with the
  naming trap called out. Change 4's range corrected to exclude `:155`.
- **Hit samples are fixed in y only** — *folded*; x is the wrapper's centre and
  differs between arms where wrapper width does. Conclusion unaffected, claim
  narrowed.
- **Stale r6 framing throughout an r7 document** — *folded*; heading, shape
  sentence, verdict relay and the probe's header/comments all corrected.
- **Adversarial's judgment that gate change 9 was complete** — *rejected with
  counter-evidence.* It reviewed the line range and missed the narrow constant
  asymmetry that code-reviewer caught; verified against `phase-1:338-343` and the
  K table here before folding code-reviewer's finding instead.
- **Adversarial's nested verifier did not report**; it stated the decisive
  finding marked verified-by-itself rather than withholding it. That finding —
  the gate change 3 blocker — was independently re-verified here against
  `style.css:291-295` and both app overrides before folding.

**r6 → r7.** Both reviewers returned `NEEDS_REWORK`, each with **one BLOCKER, the
same one**, and both again stated the CSS shape is sound (code-reviewer: 1
BLOCKER, 2 IMPORTANT, 5 NITs; adversarial-reviewer: 1 BLOCKER, 3 IMPORTANT, 4
NITs). Verdict relay: #134 comment 24653.

- **Gate change 5 could not ship** — *folded by deletion.* Capturing containment
  before `:164`'s `scrollIntoView` would have failed the 340px geometry matrix on
  this design's own intended overflow, and contradicted gate change 4 on the same
  run. Both reviewers reached this independently. The replacement records the
  structural fact instead: containment is tautological with the scroll and false
  without it at 340px, so it can only be asserted at 560px.
- **`PURE-NOSCROLL` was cited as proof for the wrong gate change** — *folded.* It
  is emitted only in the 560px interaction loop and supports change 7, not
  `:163-171`. Proof from the wrong world-state, the same failure class as r5's.
- **`deadZone = 0` was escalated into an area claim it cannot support** —
  *folded.* Replaced with the comparative claim, which is what the design needs
  and which is true: two bare-wrapper regions exist (the narrow notice band and
  the scrollbar gutter) and both are present identically in the shipped build.
- **The `newlyCovered` account misread its own log** — *folded.* The variant
  returns `P` at 360/720, not `extraction-result`; at 1280 the baseline already
  returned panel content because y=239 sits inside the shipped desktop wrapper.
  A second fixed sample at y=296 was added, and the desktop band is now measured:
  `react-flow__pane` → `INPUT`.
- **The 12:1 ratio was imported from the wrong furniture** — *folded.* The narrow
  clearance is now derived from the controls being fixed-pixel chrome, so the 2px
  covers subpixel rounding rather than font drift. Stronger and actually true.
- **Gate change 9 understated the drift** — *folded*; `phase-1:340`'s "capped at
  260px" also stops being true.
- **Gate change 7's containment half is inference, not measurement** — *folded*;
  now labelled source-derived, with its basis named.
- **Probe header still said "r5" and documented `K = 173`** while injecting 169 —
  *folded*; the header, the constants and the guard set are corrected, and the
  log regenerated so it matches its generator.
- **The stack's `overflow-y` override was never guarded**, despite a comment
  claiming the guard set was complete — *folded*; guarded now.
- **"records left/right for every box"** — *folded*; scoped to wrapper and stack.
- **The `min(528, 260)` illustration mixed canvas heights** — *folded*; restated
  at a single canvas, and the `notice` arming case restated correctly as
  `min(42, 260)`.

**r5 → r6.** Both reviewers returned `NEEDS_REWORK` (code-reviewer: 0 BLOCKER,
2 IMPORTANT, 6 NITs; adversarial-reviewer: 2 BLOCKER, 5 IMPORTANT, 8 NITs), and
both stated that the *design* survives and the *justification* does not. Verdict
relay: #134 comment 24651.

Independently verified by both and not re-opened: the percentage basis; 78/173
derived not fitted (both re-derived from first principles); the wrapper staying
`min(content, cap)`; `:141-143` unmodified and armed; gate change 3 armed
including in `state=notice`; the completeness of the stack→wrapper rebinding
(exactly two gate bindings exist); the probe's `none`/`visible` stand-in for
deletion being faithful; and every count, clearance figure and threshold.

- **The reachability adequacy argument is contradicted by the log** — *folded.*
  Replaced with the `deadZone = 0` measurement, which is what the argument was
  reaching for. The probe's wrapper-tracking sample is replaced by a fixed-point
  sample measured in both arms, and what the change newly covers is now stated
  plainly rather than denied.
- **`contained` at `:167` is a tautology in both bindings** — *folded* as a new
  gate change 5, with the non-tautological form demonstrated by measurement.
- **Gate change 6 named the wrong failure witness** — *folded*; the containment
  half is the shipped-build witness, the overflow half passes today.
- **The clearance split is allocated backwards** — *folded.* Narrow clearance
  6px → 2px, content margin 5px → 9px, with the asymmetry argued from the
  ~12:1 font sensitivity rather than applied uniformly.
- **The clearance is `H`-independent** — *folded* as a strengthening, not a
  correction: it is why the 340px matrix is the strictest collision test.
- **`-42`/`-111` mislabelled** — *folded.* On this basis they give 296/227; the
  266/171 I quoted come from K=72/167. The conclusion held under either reading,
  but the attribution was wrong in a document whose thesis is that its constants
  are derived.
- **The narrow full-width premise was never measured** — *folded*; the probe
  records left/right for the wrapper and the stack (not for the furniture, whose
  columns are still inferred from the wrapper spanning `x9..351` of a 360px
  canvas).
- **`:155`'s 0.5px tolerance dropped; `contentHeight` undefined** — *folded* into
  gate change 3.
- **Probe fields computed but never printed** (`flow`, `insideWrapper`, furniture
  bottoms) — *folded*; all are logged, so the claims citing them rest on the log
  rather than on inference.
- **The probe's at-cap NOTE could never fire** (comparing an unresolved
  `calc(...)` string to a px string) — *folded*; replaced with a guard that the
  wrapper's `overscroll-behavior` actually applied, which was previously
  unchecked.
- **`state=notice` omitted; 8px gap cited to JSX; "covers nothing" overstated** —
  *folded* (`notice` was added in r5 and retained; the gap is `app.css:1286`; the
  claim is now "no *transparent* area").
- **Doc drift in `phase-1/brainstorm-spec.md:338-342`** — *folded* as gate
  change 9.
- **"Committed as of this revision" overstates the tree state** — *rejected with
  counter-evidence.* Verified live: `fb93c00` landed and all seven files are
  tracked. The reviewer read the session-start git status from its prompt context
  and correctly flagged the finding as unverified.
- **Three nested verifiers never reported** to the adversarial reviewer; it
  re-stated those findings marked unconfirmed and source-derived rather than
  dropping them. Each was independently checked here against the live tree before
  folding.
