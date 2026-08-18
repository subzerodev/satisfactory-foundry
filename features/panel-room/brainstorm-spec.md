# #134 — Extraction panel room (Stage 23)

**Ticket:** #134 · **Epic:** #136 · **Milestone:** 94 · **Tier:** 2
**Status:** design r10 — specification only.

## Purpose

Michael: *"i dont like having to scroll the little panel."* The purity-mix
controls #124 shipped sit below the fold. Outcome: at his real canvas the whole
panel is visible without scrolling.

## Scope note — why this document is short

r1–r8 grew a ~600-line evidentiary argument around a three-line CSS change. Five
consecutive reviewer pairs confirmed the CSS and none found a defect in it; ~60
findings landed on the prose, and each of the last two repairs introduced fresh
defects of the same class (a true claim citing evidence that does not support
it). Michael's call (#134 comment 24661): cut the artifact to what is needed to
build and verify the change. **The forensic record is not lost — it lives in the
#134 audit trail (comments 24651, 24653, 24655-24657, 24658-24660), and the
measurements live in `probe-r6.mjs` + `probe-r6.log`, which are the evidence of
record.**

## Settled, and not re-opened

The 260/170 caps are **not stale constants** — they are collision limits. The
canvas has furniture below the panel and the caps stop the stack reaching it.
`phase-1/brainstorm-spec.md:338-343` states this; `phase-1/r2-verification.log:70`
is the checked-in evidence of the assertion firing:

```
FAIL 360/extraction: top-right stack overlaps bottom-left controls; stack y=49..269, controls y=220..324
```

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
(inline `wrapperStyle`, `@xyflow/react/dist/esm/index.js:3721-3727`, applied
`:3736`; measured `1..H−1` in `probe-r6.log`), so a percentage on the wrapper
resolves against a box that is not sized by its own content. The wrapper still
shrink-wraps — measured at 42px in `state=notice`, against a 169/260 cap.

That shrink-wrap is what keeps this ticket layout-only: no `pointer-events` rule,
and no rebinding of `extraction-panel-browser-check.mjs:122`, so **the three
collision assertions at `:141-143` keep passing byte-identical** — what #136
asked for.

### Where 78 and 169 come from

Each is (the wrapper's top inset) + (the binding furniture's inset from the
canvas bottom) + a clearance, less the 2px of canvas border already excluded from
the percentage basis. Since the basis is `H − 2`, the caps are `H − 80` and
`H − 171`.

| | top inset | binding furniture | clearance | K |
|---|---|---|---|---|
| desktop | 16 | power panel, `H−58` | **6** | `16 + 58 + 6 − 2` = **78** |
| narrow | 49 | controls, `H−120` | **2** | `49 + 120 + 2 − 2` = **169** |

**The clearance is `H`-independent.** Where the wrapper is at its cap the gap to
the furniture is exactly the clearance; where it is content-limited, larger. So
the geometry matrix's pinned 340px canvas is the **strictest** collision test,
which is why `:141-143` needs no 560px counterpart.

**Why the clearance is asymmetric.** The two widths clear *different* furniture.
Desktop binds against `.graph-chain-power`, which is font-metric-derived
(`app.css:1586-1597`: `padding: 4px 10px`, `border: 1px`, `margin: 0 18px 18px 0`,
`font-size: 12px`, no `line-height`), so clearance there buys something real and
desktop has margin to spare — 6px, reproducing today's shipped value. Narrow
binds against `.react-flow__controls-button`, which is fixed-pixel chrome
(`height: 26px; width: 26px; padding: 4px`, `svg { max-height: 12px }` —
`style.css:415-421`, `:438-443`), so it does not move under font drift. The only
residual is subpixel rounding, and `overlap` at `:141-143` is a strict comparison
so tangency is not a collision. 2px covers it and still improves on today's 1px;
the remaining budget goes to content margin, where it is scarce.

## Measured results

`probe-r6.log` — 12 contexts (geometry 3 widths × 3 states incl. `notice`;
interaction × 3 widths), baseline and variant per context, 24 rows.

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
5. **The furniture stays outside the wrapper** — `insideWrapper=false` for
   controls, attribution and grip in all 24 rows.

### Transparent area

The change moves three declarations up one level. It adds and removes no element,
sets and clears no `background`, and adds, removes or alters no width, padding,
border or gap **declaration** on any child. Rendered geometry can still differ —
it does — and the two mechanisms below are the ones that can move *bare area*,
both measured. (A third rendered difference exists and is inert: the stack's own
laid-out height, which goes 260→380 at the 340px/1280 case where the wrapper's
height does not change at all. The overflow is clipped by the wrapper, so it
covers nothing — `newly296` still hits `react-flow__pane` and `insideWrapper` is
false in that row.)

- **the wrapper's height**, where the cap now binds. What fills it is opaque
  panel content, not bare area; `deadZone` (wrapper-vs-stack slack) is 0 in all
  24 rows;
- **the scrollbar.** At the 340px canvas it moves from the stack to the wrapper
  and occupies the same strip — the wrapper's span is unchanged and the stack's
  narrows by 15px (`x909..1264` → `x909..1249`; `x9..351` → `x9..336`). At the
  560px canvas **it disappears entirely** (`content=380/380 overflowing=false`),
  and at 1280 the right-anchored wrapper is then 15px *narrower*
  (`x909..1264` → `x924..1264`), covering strictly less canvas. At narrow widths
  the media query pins the wrapper to `left: 8px; right: 8px`, so its span does
  not change at either canvas height.

Neither difference adds transparent area. Bare regions that do exist — the notice
band, the scrollbar gutter, and the stack's 8px inter-card `gap` (`app.css:1286`,
no `background`) — are properties of declarations this change does not touch.

`deadZone` alone does **not** discharge this: it is one-dimensional and
wrapper-vs-stack, so it is blind to bare area beside the content and to bare area
*inside* the stack (the 8px gap is exactly that, and `deadZone` reports 0 in the
rows containing it). The discharge above is structural, from the diff.

**What the change newly covers**, read off the log. Two sample points fixed in
canvas-local **y**, because the shipped wrapper ends at a different y per width
(219 narrow, 276 desktop). At the 560px canvas:

| Width | y=239 baseline → variant | y=296 baseline → variant |
|---|---|---|
| 360 | `stage-node-recipe` → `P` | `react-flow__pane` → `SPAN` |
| 720 | `stage-node-power` → `P` | `react-flow__pane` → `SPAN` |
| 1280 | `extraction-result` → `extraction-result` | `react-flow__pane` → `INPUT` |

The taller panel covers canvas that was previously clickable, **with opaque panel
content — the feature working, not a dead zone.** The 1280/y=239 row witnesses
nothing: y=239 is already inside the shipped desktop wrapper. y=296 is what
covers the desktop case.

## Known bounds

The canvas is user-resizable between `min-height: 340px` and `max-height: 85vh`
(`app.css:1246-1248`), so the honest statement is a threshold. The mix fits when:

- **desktop:** canvas ≥ **460px** (cap `H − 80` ≥ 380)
- **narrow:** canvas ≥ **551px** (cap `H − 171` ≥ 380)

The default canvas is 560px, so both hold, including Michael's case.

- **Narrow clears the content by 9px** at the default canvas (389 cap vs 380).
  Any future row added to the panel re-breaks narrow first.
- **`combined` state content is 430px** (42px notice + 8px gap + 380). At the
  default canvas it fits on desktop (480) but not narrow (389), so a narrow
  viewport showing an error notice *and* an expanded mix still scrolls. Out of
  scope; recorded so it is not mistaken for a regression.
- On a phone viewport shorter than ~649px CSS pixels, `85vh` caps the canvas
  below 551 and the narrow mix still needs a short scroll. Unchanged in kind from
  today, which scrolls at every height.

## Gate changes

`scripts/extraction-panel-browser-check.mjs`. #136 requires these be
**re-derived, not re-baselined**.

**Naming, because this is the trap that killed r1–r3.** There is no identifier
called `wrapper` in `check.mjs`. The const `stack` (`:122`) is the **wrapper**
element and `s` (`:129`) is its rect; the const `content` (`:148`) is the
**stack**. The changes below name only identifiers that exist.

1. **`:141-143` — unchanged.** They already measure the wrapper, and the 340px
   matrix is the strictest case.

2. **`:150` `expectedCap` becomes derived.** Replace
   `innerWidth <= 720 ? 170 : 260` with
   `innerWidth <= 720 ? c.height - 171 : c.height - 80`.
   *Fails when:* a constant drifts from the furniture it encodes.

3. **`:155` becomes an always-armed equality against the content.** Assert
   `Math.abs(s.height - Math.min(rect(content).height, expectedCap)) <= 0.5`, and
   drop its `state !== 'notice'` guard. Keep the 0.5px tolerance — both terms are
   fractional `getBoundingClientRect()` heights.

   **Not `scrollHeight`.** `scrollHeight` is floored at `clientHeight`, and
   `.react-flow__panel` carries margin only, no padding or border
   (`style.css:291-295`; the app's overrides at `app.css:1278-1280` and
   `:1566-1573` add none), so a `scrollHeight` form reduces to `s.height` whenever
   the wrapper is at or under its cap and cannot fire at all.
   `rect(content).height` is content-derived: after this change the stack carries
   no `max-height` and no `overflow-y`, so it lays out at full content height and
   the wrapper cannot floor it. *(`content` must be non-null — `:151`'s ternary
   guards only its own `scrollable` expression, so the grounding is
   `GraphCanvas.tsx:283`, which renders the stack unconditionally.)*

   *Fails when*, at the pinned 340px canvas, desktop (`expectedCap` 260):

   | World-state | stack | `s.height` | computes | |
   |---|---|---|---|---|
   | healthy, at cap | 380 | 260 | `min(380,260)=260`, diff 0 | passes |
   | percentage fails to resolve | 380 | 380 | `min(380,260)=260`, diff **120** | **fires** |
   | healthy `notice` | 42 | 42 | `min(42,260)=42`, diff 0 | passes |
   | shrink-wrap lost | 42 | 260 | `min(42,260)=42`, diff **218** | **fires** |
   | stack cap not deleted | 260 | 260 | `min(260,260)=260`, diff 0 | **passes — see below** |

   **The last row is a gap in this assertion, stated plainly because r9's pair
   both caught it being overstated.** If the stack's `max-height` deletion fails
   to land, change 3 passes at both widths. At narrow the arithmetic is
   `|169 − min(170, 169)| = 0`: the wrapper is clamped to 169 by its *own* cap
   while the stack sits at 170, so the difference the earlier draft credited
   (`|170 − 169|`) is `rect(content).height − expectedCap`, which is not the
   expression proposed here. Reading 170 as `s.height` is the wrapper/stack
   conflation warned about above.

   **What does catch it**, split by whether `overflow-y` was also left on the
   stack:

   - *both declarations retained* — the stack clips at its cap, so the wrapper's
     `scrollHeight` equals its `clientHeight`: `:154` fires at 1280 (260 == 260),
     but **not** at narrow (170 > 169 leaves `scrollable` true). At 560px change
     7's containment half fires, because *Pure* is clipped out of a 260/170 box.
   - *only `max-height` retained* — the stack overflows visibly, so the wrapper's
     `scrollHeight` stays ~380 and `:154` is silent at **both** widths. Change 7's
     overflow half fires at 560px.

   So the mutant is caught, but by change 7 at 560px in both sub-cases, and by
   the 340px matrix only at desktop and only in the first. The geometry matrix
   alone does not cover it.

   **Provenance:** the two sub-cases above are **source-derived**, not measured —
   the probe models the deletion by setting `stackMaxH=none`, so no arm measures
   a *partial* deletion. They are reasoned from `scrollHeight`'s definition plus
   the clip behaviour of `overflow-y: auto` versus visible overflow. If that
   coverage matters more than it does here, the honest next step is to measure
   it, not to argue it.

4. **The scroll and clip box moves from the stack to the wrapper — `:151-153`
   and `:163-171`** (not `:155`, which is change 3's and reads `s` already).
   Today `scrollable` tests `getComputedStyle(content).overflowY` and
   `content.scrollHeight > content.clientHeight`, and `:165` takes
   `visible = rect(content)`. Under this design the stack no longer carries
   `overflow-y`, so all three must read the wrapper (`stack`, rect `s`).
   `content` keeps its binding, because change 3 needs the stack's rect.

5. **`:163-171` stays post-scroll, documented as a chrome-avoidance test rather
   than a reachability oracle.** `:164` scrolls and `:165` re-measures, so at the
   pinned 340px canvas — where this design deliberately overflows — `contained`
   is green for every control that fits the scrollport, and a *pre-scroll*
   capture would be red (the shipped gate records the toggle needing `scrollTop`
   68 and *Pure* 112, `phase-2/completion-report.md:45-46`). So pre-scroll
   containment cannot be asserted here; it belongs at 560px, in change 7.

   **What the loop still catches**, and it is not nothing: `block: 'nearest'`
   performs a *minimal* scroll, so a control taller or wider than the scrollport
   leaves an edge outside and `:167` fires. `avoidsChrome` at `:168` is the
   weaker half — with `visible` bound to the wrapper it is implied by `contained`
   plus `:141-143` — but the loop also produces the `controlMeasurements` the
   PASS line reports.

6. **`pointerFocusControl` (`:53`) — rebind `panel` to the wrapper**, for the
   same reason as change 4. Note it is a **second** post-scroll containment
   guard: `:55` scrolls, `:63` computes `contained`, `:69` throws. Its
   rect-in-rect half behaves like `:167` after the rebind; its viewport half
   (`r.left >= 0 && r.right <= innerWidth && …`) stays independently armed. That
   is why change 7 is placed at `:326`, **before the three purity
   `pointerFocusControl` calls** — it must precede the *Pure* one. It is after
   the extractor (`:299`) and toggle (`:311`) calls, which is harmless: at 560px
   the wrapper does not overflow, so those scrolls are no-ops
   (`PURE-NOSCROLL … scrollTop=0`).

7. **New rows in the interaction loop.** At the real 560px canvas, all three
   widths, mix expanded, measured **before** the `pointerFocusControl` calls
   (`:326-338`): bind the wrapper locally, then assert
   `scrollHeight <= clientHeight + 1` on it, and that the *Pure nodes* input's
   rect lies within its rect.
   The **containment** half is the shipped-build failure witness; it is
   **source-derived, not measured** — the probe injects the variant before its
   `PURE-NOSCROLL` block, so no baseline `PURE` row exists, and the basis is
   `phase-2/completion-report.md:45-47` recording 112px/22px of required scroll
   inside a 170/260 box. The **overflow** half passes today (today's scroll
   container is the stack, so the wrapper never overflows) and stays live after
   the change — a cap below the 380px content fires it.

8. The existing `PASS interaction` line's `extractor scroll / toggle / Pure`
   readings stay as reported measurements. They will print `0 / 0 / 0` where they
   printed `0 / 68 / 112` at 360 and 720 and `0 / 0 / 22` at 1280
   (`phase-2/completion-report.md:45-47`).

9. **Doc drift — three passages, two files.** All must be rewritten in the same
   commit.
   - `phase-1/brainstorm-spec.md:338-343`: the properties move to the wrapper,
     and **neither** cap survives as a constant — desktop 260 becomes `H − 80`
     (480 at the default canvas), narrow 170 becomes `H − 171` (389). Write both
     `H`-relative; do not substitute a new constant.
   - `phase-1/brainstorm-spec.md:477-480`, inside `## Test Contract` (`:407`) →
     `### UI` (`:459`), so normative: "At 360px and 720px widths … **the stack**
     clears top-left controls and **stops above both bottom control zones**,
     stays within side gutters, and **scrolls internally** in every notice /
     extraction combination." In that document "the stack" is
     `.graph-top-right-stack` (`:331-332`). After this change the stack does
     neither — `probe-r6.log` measures `stack=49..429(h380)` against
     `ctl=220..324` with `stackMaxH=none`. The wrapper does both. Rewrite the
     subject.
   - `phase-2/brainstorm-spec.md:134-136`: "Its body already scrolls at the
     measured 170px mobile cap; the browser gate must prove the new controls are
     reachable **by scrolling** at 360px and do not overlap chain controls."
     After this change the 170px cap does not exist, the scroll container is the
     wrapper, and change 7 asserts reachability **without** scrolling at 560px.

   *Why the third was nearly missed, recorded because it generalises:* it carries
   no `170px`/`260px` literal, so a constant-string sweep structurally cannot
   reach it. Drift lives in the *subject* of a sentence as well as its numbers.

   Deliberately left alone, having been checked: `FEATURE.md:211` (inside
   "## Phase 1 Diff Review Disposition"), `phase-1/brainstorm-spec.md:541-544`
   (a revision-history bullet), `phase-1/implementation-plan.md:233` (a
   checked-off task), the panel-room and phase-1 review prompts
   (`panel-room/design-r7-prompt.md:49`, `phase-1/design-r4-prompt.md:11`,
   `phase-1/diff-r3-prompt.md:24`, `:33`), and `phase-2/completion-report.md:45-47`
   (a dated record of measurements taken then).

   `docs/foundry-changelog.md:32-33` is a separate case worth naming: it carries
   no `170px`/`260px` literal, but it does say "On narrow screens the controls
   scroll inside the panel", which this change makes false at the default canvas.
   It stays because it is a **dated changelog entry** describing what shipped on
   that date — changelog history is not rewritten when later work supersedes it.

## Acceptance criteria

- 560px canvas, all three widths: mix visible, wrapper not overflowing, no
  collision.
- 340px canvas: still scrolls; wrapper height equals `min(content, derived cap)`;
  `:141-143` green **without modification**.
- Canvas, controls, attribution and resize grip all still reachable, and no
  transparent region exists that the shipped build does not already have —
  discharged structurally from the diff (no element added, no `background`
  changed, no child width/padding/border/gap **declaration** changed), not by
  `deadZone` and not by enumeration. Rendered child geometry does differ; see
  § Transparent area for the mechanisms and why none of them adds bare area.
- `phase-1/brainstorm-spec.md:338-343`, `phase-1/brainstorm-spec.md:477-480` and
  `phase-2/brainstorm-spec.md:134-136` all updated.
- `npm test`, `npm run check`, `npm run build`, both browser matrices green.

## Assumptions ledger

| Assumption | Grounding |
|---|---|
| Caps exist to avoid canvas furniture | `phase-1/brainstorm-spec.md:338-343` + `phase-1/r2-verification.log:70` |
| `.react-flow` is a definite-height percentage basis | `index.js:3721-3727` applied `:3736`; **measured `1..H−1`** at both canvas heights |
| A percentage `max-height` on the wrapper resolves | **Measured** at the 340px canvas (169 narrow, 260 desktop). At 560 the wrapper is content-limited to 380, so the 389/480 caps there are computed from the same resolved rule, not directly observed |
| The wrapper still shrink-wraps | **Measured** — 42px in `state=notice` |
| Narrow spans the full width, so controls bind | **Measured** — wrapper `x9..351` at a 360px viewport vs the right-hand ~355px at 1280 |
| 78 / 169 preserve today's caps and improve clearance | **Measured** — desktop 260 with 6px, identical to baseline; narrow 169 with 2px against baseline's 1px |
| No *new* transparent area vs the shipped build | **Structural, from the diff** — no element added, no `background` changed, no child width/padding/border/gap **declaration** changed. Rendered child geometry does differ; the two differences that can move bare area (wrapper height; scrollbar) are measured and neither adds any, and the third (the stack's own laid-out height) is clipped by the wrapper. `deadZone = 0` in all 24 rows establishes only the wrapper-vs-stack part |
| Content is 380px (mix expanded) | **Measured in `?mode=interaction`**, with a liveness gate on the three mix inputs rendering; corroborated in `?mode=geometry` with a decorrelated fixture |
| Containment is assertable without scrolling **at 560px** | **Measured** — `PURE-NOSCROLL contained=true overhang=-98` at all three widths. Not assertable at the pinned 340px canvas, where the design intends to overflow |
| `:141-143` stay green unmodified | **Measured** — collisions false in all 24 rows |

## Revision history

Full findings and dispositions are in the #134 audit trail; one line each here.

- **r10** (comments 24662-24663) — `NEEDS_REWORK` ×2, 5 findings each, both
  converging on gate change 3's last table row: it credited the assertion with
  firing at narrow where it provably passes (`|169 − min(170,169)| = 0`; the
  quantity written was `rect(content).height − expectedCap`, not the proposed
  expression). That row is now stated as a gap, with what actually catches the
  mutant split by sub-case. Also folded: a **fifth** drifting passage,
  `phase-1/brainstorm-spec.md:477-480`, normative in `## Test Contract` and
  invisible to a constant-string sweep because the drift is in the sentence's
  *subject* (code-reviewer; adversarial's independent sweep concluded no fifth
  existed — resolved against source, `:407`/`:459`/`:331-332`). The acceptance
  criterion and ledger row lost the word "declaration" that the body relies on,
  restoring a claim the log falsifies; a third rendered difference (the stack's
  own height) is now named and shown inert; change 7's placement, the `content`
  non-null grounding, the truncated phase-2 quotation and the ambiguous
  "r3/r4 prompts" list are corrected. `docs/foundry-changelog.md:32-33` is
  newly named as deliberately-untouched dated history.
- **r9** — artifact cut to a specification per Michael's decision (#134 comment
  24661). Substantive carry-overs folded from r8's pair: gate change 9 gains
  `phase-2/brainstorm-spec.md:134-136` (a fourth drifting sentence, found by
  code-reviewer); gate change 5 no longer claims `contained` is "forced true"
  (`block:'nearest'` scrolls minimally, so an oversized control still fires it);
  the transparent-area argument no longer claims the scrollbar merely changes
  owner (at 560 it is eliminated and the desktop wrapper narrows 15px); the
  fabricated "`content=430` in both arms" corroboration is gone (all three such
  rows are `VARIANT-D`); `.extraction-panel`'s 340px is no longer called
  measured; and the stale `probe-r6.mjs` line citations are dropped rather than
  renumbered.
- **r8** (comments 24658-24660) — `NEEDS_REWORK` ×2. Repaired 10 findings,
  introduced 3 of the same class. Triggered the decision to cut.
- **r7** (24655-24657) — `NEEDS_REWORK` ×2, incl. a BLOCKER: gate change 3's
  assertion could not fire in the world-state it named.
- **r6** (24653) — `NEEDS_REWORK` ×2, one shared BLOCKER: the proposed pre-scroll
  containment capture could not ship.
- **r5** (24651) — `NEEDS_REWORK` ×2; design confirmed, justifications rejected.
- **r4** — no BLOCKERs; both reviewers asked whether its premise was necessary.
  It was not: the wrapper-cap shape (this design) removed the `pointer-events`
  rule and the `:122` rebinding.
- **r1–r3** — asserted rendered layout from CSS source. r3's cap resolved against
  the wrapper rather than the canvas and *lowered* the cap to 234.
