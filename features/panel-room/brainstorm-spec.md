# #134 — Extraction panel room (Stage 23)

**Ticket:** #134 · **Epic:** #136 · **Milestone:** 94 · **Tier:** 2
**Status:** design r5 — adopts the shape both r4 reviewers proposed independently,
after measuring it. r1–r3 were killed by unmeasured layout claims; r4 cleared
both reviewers with zero BLOCKERs but was rejected for never questioning its own
premise.

## Purpose

Michael: *"i dont like having to scroll the little panel."* The purity-mix
controls #124 shipped sit below the fold. Outcome: at his real canvas the whole
panel is visible without scrolling.

## Settled, and not re-opened

The 260/170 caps are **not stale constants** — they are collision limits. The
canvas has furniture below the panel and the caps stop the stack reaching it.
`features/extraction-planning/phase-1/brainstorm-spec.md:338-340` states this;
`phase-1/r2-verification.log:70` is the checked-in evidence of the assertion
firing:

```
FAIL 360/extraction: top-right stack overlaps bottom-left controls; stack y=49..269, controls y=220..324
```

## Why this is r5

Each earlier round failed on its **basis**, not its arithmetic:

- **r1** argued a `max-height` from a sibling `max-width` rule — different axis,
  element and containing block.
- **r2** argued that a parent `max-height` constrains a block child's auto height.
- **r3** wrote the cap as a percentage and then reasoned about it as if it
  resolved against the canvas. It resolves against the wrapper. Real cap was
  `H − 106`, not `H − 74`; at the 340px harness canvas the "fix" *lowered* the cap
  from 260 to 234.
- **r4** fixed the basis by measurement and cleared both reviewers with no
  BLOCKERs — then both, separately, pointed out it had never asked whether its
  central premise was necessary. It inflated the wrapper to a fixed height, which
  forced a `pointer-events` rule (a behavioural change in a layout-only ticket) and
  a rebinding of the gate's collision assertions (its own "riskiest change").

**r5 keeps r4's measured box model and drops r4's shape.**

## The box chain, measured

`features/panel-room/probe-r5.log`, produced by
`features/panel-room/probe-r5.mjs`. Canvas-local coordinates.

| Box | What sets it | Role |
|---|---|---|
| `.graph-canvas` | `app.css:1237-1253` — `border-box`, `height: 560px`, `min-height: 340px`, `max-height: 85vh`, `resize: vertical`, `border: 1px` | definite height `H` |
| `.react-flow` | inline `wrapperStyle`, `@xyflow/react/dist/esm/index.js:3721-3727`, applied `:3736` — `position: relative; height: 100%` | definite, `H − 2`; the percentage basis |
| `.react-flow__panel.top.right` (**wrapper**) | `margin: 15px` (`style.css:291-295`) + `top: 0`; narrow overrides to `top: 48px; margin: 0` (`app.css:1567-1573`) | the **visible** box — what the gate measures |
| `.graph-top-right-stack` (**stack**) | `app.css:1282-1290`, `:1575-1578` | flex column of cards |
| `.extraction-panel` | child of the stack (`GraphCanvas.tsx:283` → `:402`) | the panel itself |

Furniture, measured at both canvas heights: bottom-left controls occupy
`H−120 .. H−16` (4 × 26px buttons, `style.css:415-421`, in a `margin: 15px`
panel); bottom-right chain-power occupies `H−58 .. H−16`.

## Design

Cap the **wrapper** as a percentage of `.react-flow`, and move the scroll
container up to it. The wrapper stays `height: auto`, so it still shrink-wraps to
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
max-height: calc(100% - 173px);
/* .graph-top-right-stack max-height: 170px is DELETED. */
```

**Why the wrapper and not the stack.** `.react-flow` has a definite height, so a
percentage on the wrapper resolves against a box that is *not* sized by its own
content — which is exactly the circularity that forced r3 and r4 to give the
wrapper a definite height. Capping the wrapper needs no such crutch, and the
wrapper remains shrink-wrapped: **measured at `state=notice`, the wrapper is 42px
tall, nowhere near its 165/260 cap** (`probe-r5.log`, the `notice` rows). That
single property is what makes everything below fall out.

**What this deletes relative to r4:**

- **No `pointer-events` rule.** r4's wrapper became a ~528px transparent hit
  target over the canvas, so it needed `pointer-events: none` plus a compensating
  `auto` on the stack — a behavioural change introduced purely to neutralise a
  regression the design itself caused, inside a ticket #136 scopes layout-only.
  Here the wrapper never grows past its content, so the regression never exists.
- **No rebinding of `extraction-panel-browser-check.mjs:122`.** The wrapper stays
  the visible box, so **the three collision assertions at `:141-143` keep passing
  byte-identical** — the outcome #136 asked for and r3 promised before r4
  abandoned it. They remain the real regression guard, untouched.

**Where 78 and 173 come from.** Each is (the wrapper's top inset) + (the furniture
inset from the canvas bottom) + a **6px clearance**, less the 2px of canvas
border already excluded from the percentage basis:

- desktop: the binding furniture is the bottom-right power panel, `58px` above the
  canvas bottom; wrapper top inset `16`; `16 + 58 + 6 − 2 = 78`.
- narrow: the stack spans the full width, so the binding furniture is the
  **controls**, `120px` above the canvas bottom; wrapper top inset `49`;
  `49 + 120 + 6 − 2 = 173`.

The 6px clearance is deliberate and is the fix for an r4 defect: r4's constants
were the *exact* distance to the furniture, so the panel's bottom edge landed
tangent to it, with zero tolerance in the fail direction. It matters because the
desktop furniture height is font-metric-derived — `.graph-chain-power`
(`app.css:1586-1597`) sets no `line-height`, so its 42px is margin + border +
padding + a 14px line box at `font-size: 12px`, and a font change moves it.

## Measured results

`probe-r5.log`, 12 contexts (geometry 3 widths × 3 states, **including
`notice`**, which the r4 probe skipped; plus interaction × 3 widths), baseline and
variant per context — 24 measured rows.

| Canvas | Width | Baseline wrapper | Variant D wrapper | Content | Scrolls? | Clearance |
|---|---|---|---|---|---|---|
| 340 | 360/720 | 170 | **165** (at cap) | 380 | yes (correct) | 6px to controls (**was 1px**) |
| 340 | 1280 | 260 | **260** (at cap) | 380 | yes (correct) | 6px to power (**unchanged**) |
| 560 | 360/720 | 170 | **380** (content) | 380 | **no** | 11px to controls |
| 560 | 1280 | 260 | **380** (content) | 380 | **no** | 106px to power |

1. **The ticket's goal is met** — at the real 560px canvas the mix is fully
   visible at all three gate widths, `scrollHeight === clientHeight`.
2. **The desktop cap at 340 is 260 — exactly today's shipped constant**, with
   exactly today's 6px clearance. The narrow cap is 165 against today's 170, and
   *improves* clearance from 1px to 6px.
3. **Wrapper-vs-furniture collisions are `false` in all 24 measured rows**,
   baseline and variant alike — so `:141-143` are green without modification.
4. **The wrapper shrink-wraps.** In `state=notice` it measures 42px, far below its
   cap, in both baseline and variant. This is the property r4 lacked.

**Reachability of the regions r4's reviewers flagged as untested.** Measured
directly with `elementFromPoint`, none of them ever returns the wrapper: the
canvas below the panel (`react-flow__pane` or a node), a controls button, the
attribution link, and the resize-grip corner. *Pre-existing and unchanged: at a
340px canvas the grip corner returns the attribution anchor in both baseline and
variant — that overlap is not caused by this change and is out of scope.*

## Known bounds

The canvas is user-resizable between `min-height: 340px` and `max-height: 85vh`
(`app.css:1246-1248`), so the honest statement is a threshold. The mix fits when:

- **desktop:** canvas ≥ **460px** (cap `H − 80` ≥ 380)
- **narrow:** canvas ≥ **555px** (cap `H − 175` ≥ 380)

The default canvas is 560px, so both hold, including Michael's case. Three
consequences:

- **Narrow clears the content by 5px** at the default canvas (385 cap vs 380). The
  6px clearance and this 5px margin split the same 11px of slack; spending less on
  clearance would buy content margin and vice versa. Any future row added to the
  panel re-breaks narrow first.
- **`combined` state content is 430px** — the error notice plus the stack's 8px gap
  (`GraphCanvas.tsx:283-285`). At the default canvas it fits on desktop (480) but
  not narrow (385), so a narrow viewport showing an error notice *and* an expanded
  mix still scrolls. Out of scope; recorded so it is not mistaken for a regression.
- On a phone viewport shorter than ~653px CSS pixels, `85vh` caps the canvas below
  555 and the narrow mix still needs a short scroll. Unchanged in kind from today,
  which scrolls at every height.

## Gate changes

`scripts/extraction-panel-browser-check.mjs`. #136 requires these be
**re-derived, not re-baselined**. Each names the world-state that makes it fail,
because three rounds nominated an assertion that could not.

1. **`:141-143` — unchanged.** No edit. They already measure the wrapper, which is
   still the visible box. Stated explicitly because it is the constraint #136 set
   and the one r4 could not meet.

2. **`:150` `expectedCap` becomes derived.** Replace `innerWidth <= 720 ? 170 : 260`
   with `innerWidth <= 720 ? c.height - 175 : c.height - 80` — the furniture-derived
   allowance including clearance, in canvas terms.

3. **`:155` becomes an always-armed equality.** Assert
   `s.height === Math.min(contentHeight, expectedCap)` rather than
   `s.height === expectedCap`. The wrapper is shrink-to-fit, so equality against
   the cap alone is wrong wherever content is shorter — which is exactly the
   `notice` state. r4 proposed guarding this with a content-exceeds-cap
   precondition; both reviewers correctly noted that branch is dead in the
   geometry loop, and that it introduces a silent-disable path for the only cap
   assertion. `min()` has neither problem.
   *Fails when:* the percentage fails to resolve (wrapper grows to 380 where 260
   is expected); or a constant is wrong — r4's `-42`/`-111` on this basis would
   give 266/171 and fire immediately.

4. **`:151-155` and `:163-171` — the scroll/clip box moves from the stack to the
   wrapper.** `content` is currently bound to `.graph-top-right-stack`; under this
   design the stack no longer carries `overflow-y`, so the scrollable test and the
   `visible = rect(content)` containment test must read the wrapper. Leaving them
   on the stack would make containment trivially true (the stack is now unclipped
   at full content height) — a tautology, and the failure this ticket has shipped
   three times.
   *Fails when:* the scroll container is not where the design says it is.

5. **`pointerFocusControl` (`:53`, `:62`) — same move.** It binds `panel` to
   `.graph-top-right-stack` for both containment and its `scrollTop` reading;
   both must read the wrapper for the same reason.

6. **New rows in the interaction loop — the proof of the fix.** At the real 560px
   canvas, all three widths, with the mix expanded: assert
   `wrapper.scrollHeight <= wrapper.clientHeight + 1` and that the *Pure nodes*
   input's rect lies within the wrapper's rect.
   Placement is the load-bearing detail: these must be measured **immediately
   after the mix fields render and before the `pointerFocusControl` calls on the
   purity inputs** (`:326-338`), because that helper calls `scrollIntoView` at
   `:55` before computing containment at `:63` and so proves nothing about
   reachability. r4 said "before any interaction", which is unachievable — the mix
   is only reachable *through* two earlier `pointerFocusControl` calls.
   *Dropped from r4:* a `scrollTop === 0` row. When content fits, the browser
   clamps `scrollTop` to 0, so it cannot fail independently of the overflow
   assertion beside it.
   *Fails when:* the cap is at or below today's 260/170 — the shipped build fails
   this row, which is the point.

7. The existing `PASS interaction` line's `extractor scroll / toggle / Pure`
   readings stay as reported measurements. They will print `0 / 0 / 0` where they
   printed `0 / 68 / 112` at 360 and 720 and `0 / 0 / 22` at 1280
   (`phase-2/completion-report.md:45-47`).

## Acceptance criteria

- 560px canvas, all three widths: mix visible, wrapper not overflowing, no
  collision.
- 340px canvas: still scrolls; wrapper height equals `min(content, derived cap)`;
  `:141-143` green **without modification**.
- Canvas, controls, attribution and resize grip all still reachable.
- `npm test`, `npm run check`, `npm run build`, both browser matrices green.

## Assumptions ledger

| Assumption | Grounding |
|---|---|
| Caps exist to avoid canvas furniture | `phase-1/brainstorm-spec.md:338-340` + `phase-1/r2-verification.log:70` |
| `.react-flow` is a definite-height percentage basis | `index.js:3721-3727` applied `:3736`, over `app.css:1237-1253`; **measured** as `H − 2` at both canvas heights |
| A percentage `max-height` on the wrapper resolves | **Measured** — caps directly observed at the 340px canvas (165 narrow, 260 desktop). At 560 the wrapper is content-limited to 380, so the 385/480 caps there are computed from the same resolved rule, not directly observed |
| The wrapper still shrink-wraps | **Measured** — 42px in `state=notice`, against a 165/260 cap |
| 78 / 173 preserve today's caps and clearance | **Measured** — desktop 260 with 6px clearance, both identical to baseline; narrow 165 with 6px, improving on baseline's 1px |
| Content is 380px (mix expanded) | **Measured in `?mode=interaction`**, with a hard liveness gate on the three mix inputs rendering; independently corroborated in `?mode=geometry` with a different mix (`1/1/1` vs `0/5/0`) |
| Content is 430px in `combined` | **Measured** |
| No new region becomes unreachable | **Measured** — `elementFromPoint` over canvas, controls, attribution and grip never returns the wrapper |
| `:141-143` stay green unmodified | **Measured** — false in all 24 rows |

## Revision history

**r4 → r5.** Both reviewers returned `NEEDS_REWORK` with **zero BLOCKERs**
(code-reviewer: 2 IMPORTANT, 6 NITs; adversarial-reviewer: 3 IMPORTANT, 5 NITs).
Verdict relay: #134 comment 24649. Both independently verified and I have not
re-opened: the probe's injected CSS matched the shipped rule set exactly; 42/111
were derived rather than fitted; the gate rebinding was a legitimate
re-derivation; no assertion was a tautology; `bottom` → definite height is a CSS
spec guarantee (CSS 2.1 §10.6.4, §10.7); and 380px was not an artifact of the
probe's synthetic `<select>` drive. Dispositions:

- **The wrapper need not be inflated — both reviewers, independently** — *folded,
  and it replaced the design.* Measured as variant D before adoption, per both
  reviewers' own warning that they were proposing it unmeasured.
- **Zero clearance to the furniture** — *folded.* A 6px clearance is now part of the
  derivation, and I have stopped presenting the 266-vs-260 surplus as validation
  of the formula when the surplus *was* the clearance being spent.
- **Probe inertness guards one short** — *folded.* Three independent guards now:
  wrapper `max-height` must change, the stack override must compute to `none`, and
  the wrapper's `overflow-y` must apply.
- **Probe skipped `state=notice`** — *folded.* The geometry matrix is now complete,
  and `notice` turned out to carry the load: it is the state that demonstrates the
  wrapper still shrink-wraps.
- **Untested regions under an inflated wrapper** (controls, attribution, resize
  grip) — *folded* by measuring all of them, and largely *dissolved* by the shape
  change: the wrapper no longer covers anything.
- **`scrollTop === 0` adds nothing** — *folded*, row dropped, with the reason
  recorded.
- **"Before any interaction" is unachievable** — *folded.* Gate change 6 now names
  the exact insertion point.
- **The content-exceeds-cap guard is dead code** — *folded*, replaced by an
  always-armed `min(content, cap)` equality.
- **`0 / 68 / 112` is wrong at 1280** — *folded*; verified `0/0/22` at
  `phase-2/completion-report.md:47`.
- **"Two consequences" then three bullets; "eight selectors" vs eight rules /ten
  selectors** — *folded* (the latter by deletion; the claim's load-bearing half is
  no longer needed, since r5 adds no `pointer-events` rule).
- **391/486 labelled "Measured" but never directly observed** — *folded.* The ledger
  now distinguishes the caps observed at 340 from the ones computed at 560.
- **"Checked in" overstated the tree state** — *folded*; the probes, logs and review
  prompts are committed as of this revision.
- **`bottom` ledger row should cite the CSS clause, not one engine** — *moot*: r5
  does not use `bottom`.
