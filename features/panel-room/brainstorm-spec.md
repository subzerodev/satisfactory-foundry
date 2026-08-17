# #134 — Extraction panel room (Stage 23)

**Ticket:** #134 · **Epic:** #136 · **Milestone:** 94 · **Tier:** 2
**Status:** design r7 — the CSS is unchanged since r5 and has now been confirmed
sound by three consecutive reviewer pairs. r7 deletes a gate change that could
not ship, and corrects three justifications that still did not match the evidence
they cited.

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

## Why this is r6

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

**r6 changes no part of the shape.** It replaces the false justifications with
the true ones — which were available and stronger — and re-allocates the
clearance budget after a reviewer showed it was spent backwards.

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
canvas, `x924..1264` at 560, the difference being its shrink-to-fit content).
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
`wrapper.height − min(stack.height, wrapper.height)` — purely *vertical*, so it
is blind to bare wrapper area beside the content. Two such regions exist:

- **narrow `notice`:** the wrapper and the stack both span `x9..351` (342px),
  while `.graph-canvas-notice` inside them caps at `max-width: 240px`
  (`app.css:1269`) — leaving a ~100×42px band that is bare stack, and the stack
  sets no background, so it is transparent down to the canvas;
- **every at-cap row:** the stack measures 15px narrower than the wrapper
  (`x9..336` vs `x9..351`; `x909..1249` vs `x909..1264` at desktop). The 15px
  appears exactly where `overflowing=true` and vanishes in every
  `overflowing=false` row, so it is the scrollbar gutter — but `deadZone` cannot
  tell a gutter from a hole.

**The claim this design actually needs is comparative, and it holds:** *the
change adds no transparent area the shipped build lacks.* Both regions are
present identically today, measured in the baseline arm:

- the notice band is a property of the notice card's own `max-width`, and the
  baseline stack spans the same `x9..351` (`probe-r6.log`, `BASELINE 360px notice`);
- the scrollbar gutter lands in the same x-band either way. Today the **stack**
  is the scroll container (`app.css:1288`) inside a wrapper of identical width
  (baseline `wrapper x9..351`, `stack x9..351`), so its scrollbar is drawn at
  `x336..351`; under this design the **wrapper** is the scroll container and its
  scrollbar occupies that same strip, which is why the stack's box measures
  `x9..336`. The gutter moves owner, not position.

Vertically the wrapper genuinely has no slack: `.react-flow__panel` has margin
only, no padding or border (`style.css:291-295`), which is what `deadZone = 0`
does establish.

r4's regression was a *new* transparent region ~528px tall. This design creates
none, and that is a different and weaker statement than "there is no transparent
area at all", which is what r6 wrongly claimed.

**What the change does newly cover, read off the log rather than summarised.**
Two *fixed* canvas-local sample points, because the shipped wrapper ends at a
different y per width — 219 narrow, 276 desktop — so one point cannot witness
both. At the 560px canvas:

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

3. **`:155` becomes an always-armed equality, keeping its tolerance.** Assert
   `Math.abs(s.height - Math.min(wrapper.scrollHeight, expectedCap)) <= 0.5`.
   Three deliberate details: `min()` because the wrapper is shrink-to-fit, so
   equality against the cap alone is wrong in `state=notice`; `wrapper.scrollHeight`
   named explicitly, because r5 left `contentHeight` undefined; and the existing
   **0.5px tolerance retained**, because r5 silently proposed `===` on a
   fractional `getBoundingClientRect().height` against an integer `scrollHeight`.
   *Fails when:* the percentage fails to resolve — at the pinned 340px canvas the
   wrapper would grow to its 380px content where 260 is expected, and
   `min(380, 260) = 260 ≠ 380` fires. Armed in `state=notice` too: there content
   is 42px, so the assertion pins `min(42, 260) = 42` against the measured 42 and
   would fire on any wrapper that stopped shrink-wrapping.

4. **`:151-155` and `:163-171` — the scroll/clip box moves from the stack to the
   wrapper.** `content` is bound to `.graph-top-right-stack`; under this design
   the stack no longer carries `overflow-y`, so the scrollable test and the
   `visible = rect(content)` containment test must read the wrapper. Leaving them
   on the stack would make containment trivially true, the stack now being
   unclipped at full content height.

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
   false *without* it. No formulation of `:167` is both armed and green there.
   So containment belongs only where content fits — gate change 7, at 560px —
   and `:167` is left alone and labelled for what it is. `avoidsChrome` at
   `:168` is unaffected and remains the half of this loop that can fail.

   *r6's error, recorded:* it cited the `PURE-NOSCROLL` probe rows as proof this
   was achievable. Those are emitted only in the 560px interaction loop, a state
   `geometryCheck` never reaches. They support gate change 7 and say nothing
   about `:163-171` — proof from the wrong world, which is the failure class
   this ticket keeps repeating.

6. **`pointerFocusControl` (`:53`, `:62`) — rebind `panel` to the wrapper**, for
   the same reason as change 4.

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

9. **Doc drift.** `phase-1/brainstorm-spec.md:338-342` states normatively that
   *the stack* is bounded, scrolls internally, and caps at 170px, and at `:340`
   that "Desktop top-right content is capped at 260px". Both sentences drift:
   the properties move to the wrapper, 170 becomes 169, and **260 stops being a
   constant at all** — it becomes `H − 80`, which is 260 only at the pinned
   340px canvas and 480 at the default 560. That passage is this spec's own
   grounding citation and must be rewritten in the same commit.

## Acceptance criteria

- 560px canvas, all three widths: mix visible, wrapper not overflowing, no
  collision.
- 340px canvas: still scrolls; wrapper height equals `min(content, derived cap)`;
  `:141-143` green **without modification**.
- Canvas, controls, attribution and resize grip all still reachable, and no
  transparent wrapper region exists that the shipped build does not already have
  (the comparative claim — `deadZone` alone cannot discharge this, see above).
- `phase-1/brainstorm-spec.md:338-342` updated, including its 260px sentence.
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
| No *new* transparent area vs the shipped build | **Measured** for the vertical axis (`deadZone = 0`, all 24 rows) plus the two horizontal regions enumerated above, each present identically in both arms. `deadZone` is one-dimensional and does **not** by itself establish an area property |
| The furniture regions stay outside the wrapper | **Measured** — `insideWrapper=false` for controls, attribution and grip in all 24 rows |
| Content is 380px (mix expanded) | **Measured in `?mode=interaction`**, with a hard liveness gate on the three mix inputs rendering; independently corroborated in `?mode=geometry` with a different fixture (`1/1/1` at clock 250 vs `0/5/0` at clock 100) |
| Containment is assertable without scrolling **at 560px** | **Measured** — `PURE-NOSCROLL contained=true overhang=-98` at all three widths. It is **not** assertable at the pinned 340px canvas, where the design intends to overflow — which is why gate change 5 drops the idea and change 7 carries it |
| `:141-143` stay green unmodified | **Measured** — false in all 24 rows |

## Revision history

**r6 → r7.** Both reviewers returned `NEEDS_REWORK`, each with **one BLOCKER, the
same one**, and both again stated the CSS shape is sound (code-reviewer: 1
BLOCKER, 2 IMPORTANT, 5 NITs; adversarial-reviewer: 1 BLOCKER, 3 IMPORTANT, 4
NITs). Verdict relay: #134 comment pending this revision.

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
