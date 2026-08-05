# Stage 11 / Phase 0 — views join the drawing (#54) + sticky title block (#55) — brainstorm v3 (FROZEN)

**Goal.** Michael, on the live Stage 10 build: "all of the views here need
work to fit within the theming and spacing, the blueprint, combined and
schematic views" — and, on the title block, "this doesnt make sense to be
at the bottom" → his decided fix: "it could stay at the bottom but be
sticky?" (decision recorded on #55). CSS-only, behavior-frozen; no SVG
geometry changes (the dm-scale layout is solver-driven and untouched).

*Cite shorthand: `app.css` = src/ui/app.css.*

## Already settled — do NOT re-litigate

- Stage 9 identity + Stage 10 decisions bind: tokens/names (no new
  tokens), radius-0 chrome, the label idiom (letter-spaced mono), the
  base control rules, the 6/8/12/16 gap rhythm, both-media walks.
- S5 pipe treatments (dash rhythms, opacity fades) and all bus/lane
  tier colouring are settled behavior-adjacent conventions — untouched.
- #55 decision: STICKY BOTTOM placement (Michael 2026-08-05) — the
  design details land here; the placement itself is not a fork.
- All-Claude roster; full gate; 728 suite stays green (zero churn
  expected — CSS-only).

## The audit (static, line-cited; the walk verifies live)

1. **`.override-label` is the last undressed text family** (app.css:708-710
   — only `min-width: 320px`): the "Feed 1 · 60/min · enters at head"
   rows render in plain body sans at default size, and the rigid 320px
   column opens a dead gulf between label and input (visible in
   Michael's screenshot). The inputs themselves are fine (S10P0 base).
2. **`.tooltip` carries the app's last rounded chrome** (app.css:484-496):
   `border-radius: 4px`, body sans — pre-identity survivor.
3. **`.bp-notice` (app.css:588-592) + `.chain-bp-footer` (:689-693)**:
   `0.85rem` body sans — the only rem-sized text in the views; reads as
   default web text, not the drawing's label idiom.
4. **View containers under-spaced**: `.schematic`/`.schematic-scroll`
   (:471-475) and `.bp-view` (:579-581) pad `8px 0` — below the 12px
   standard (S10P2), and the view butts the toggle above it.
5. **Site names miss the display face**: `.chain-bp-name` (:652-656) is
   12px/600 mono; the graph's stage plates use `--font-display` — the
   combined view's site names should echo them.
6. ~~SVG-label letter-spacing~~ — DROPPED at simplify (gold-plating:
   the labels are already on-identity via the S9P2 mono face
   (:1356-1365), and the artifact's own "data sentences, not labels"
   rule exempts them — the same reasoning that spares the override
   rows. A future polish item only if Michael asks).
7. **Title block** (:1211-1218): static footer, `margin-top: 16px`,
   transparent ground — scrolls away with the page (#55).
8. **Three rounded-chrome stragglers adjacent to the views (r1
   adversarial NIT, promoted to in-scope — the identity has no rounded
   chrome, S9P2's own rule):** `.summary-card` (:454, 4px),
   `.graph-canvas-notice` (:822, 4px), `.graph-chain-power` (:949,
   4px) → `border-radius: 0`. **`.stage-node-findings` (:924, 8px)
   KEEPS its radius** — it is the count pill, a deliberate round stamp
   dot, recorded as such.

Audited CLEAN (no change): machine/foundation/junction/bus fills +
strokes (all tokened, S9P0), pipe dash treatments (S5), mark glyphs,
`chain-bp-link` connectors, the selected-site accent outline (S8P1),
`.view-toggle` (S10P0 base + layout), lane-overrides container spacing
(12px 0, frameless — correct for an in-flow section).

## Axis 1 — the type fixes (defects 1, 3, 5, 6)

**Pick:**

- `.override-label` joins the label idiom: `--font-mono-num`, 11px,
  `--fg-muted` — and the alignment mechanism becomes a REAL shared
  track (r2 adversarial MAJOR — the value-retune lineage is dead):
  **`.lane-overrides-lane { display: grid; grid-template-columns:
  max-content max-content; gap: 8px; align-items: center; }` (a
  NET-NEW selector — no rule exists for it today; r3-simplify
  precision) +
  `.override-row`'s EXISTING flex block (app.css:702-706) REPLACED by
  `{ display: contents; }` (r3 nit — edit that block, don't append) +
  `.override-label`'s `min-width` REMOVED entirely.** Why this shape (the r1 adversarial's
  own prescription): v1's `min-width: 0` broke alignment (each row is
  an independent flex container — no shared track exists); v2's 220px
  retune was undersized — the longest OUTPUT label
  (`Out 9 · 1200/min load · breaks out after machine 24`,
  LaneOverrides.tsx:43; 4-digit rates are first-class, src/data/tiers.ts:11) is
  ~51 chars ≈ 337px at 11px mono, and `.override-label` has no
  `white-space` rule, so long labels WRAP today (320px sans) and would
  keep wrapping at 220px — breaking the very column the retune
  protected. The grid track kills all three failure modes at once:
  `max-content` never wraps (track = unwrapped width of the lane's
  longest label), the shared track aligns every input in the lane, and
  content-sizing eliminates the dead gulf. Cross-LANE column widths may
  differ (lanes are separate visual groups — accepted, stated). Both
  columns `max-content` so inputs keep their intrinsic width (no
  stretch). Letter-spacing NOT applied (data sentences, not labels).
- `.bp-notice` + `.chain-bp-footer` → `--font-mono-num` 11px (px, not
  rem — the app sets sizes in px throughout); colors stand (--notice /
  --fg-muted).
- `.chain-bp-name` → `--font-display`, 13px, `letter-spacing: 0.02em`
  (the stage-plate name treatment, scaled to the floor plan).
- The S9P2 SVG-label group (:1356-1365) is UNTOUCHED except that
  `chain-bp-name` leaves it (display face now). (The 0.04em tracking
  proposal died at simplify — audit item 6.)

## Axis 2 — chrome + spacing (defects 2, 4)

**Pick:**

- `.tooltip`: `border-radius: 0`; `--font-mono-num` 11px. The inverted
  ink block (bg `--fg`, text `--bg-panel`) STAYS — an ink stamp reads
  correctly on both papers.
- `.schematic`, `.schematic-scroll`, `.bp-view`: `padding: 12px 0` (the
  P2 rhythm; horizontal stays 0 — views are in-flow sheet content, not
  framed panels; the SVGs own their edge geometry).
- NO frames on the views (a drawing's views sit ON the sheet — framing
  them would nest sheets; recorded as the deliberate call).
- The three radius stragglers (audit item 8) fold to `border-radius: 0`;
  the findings pill stays round (deliberate).
- **Scope boundary (r1 nit, named; r3-simplify precision):** this phase
  = the three views + their adjacent in-flow chrome (override rows,
  notices, footers) + the three radius stragglers + the sticky title
  block. Note the stragglers include two of OUR chips rendered inside
  the graph canvas (.graph-canvas-notice, .graph-chain-power — app
  chrome in RF Panels, fair game); RF's OWN chrome (controls,
  attribution) plus the header, upload screen, and panel internals
  beyond the above are OUT (already treated in S9/S10 or deliberately
  excluded).

## Axis 3 — the sticky title block (#55)

**Pick: `position: sticky; bottom: 0` on `.title-block`, with
`background: var(--bg)` (opaque — panels must not bleed through) and
`z-index: 6` — above the tooltip's 5 (app.css:487, the only in-flow
stacking peer; RF chrome is contained by `.graph-canvas` overflow) and
below the drop overlay's 100 (:302, which must stay topmost). `margin-top: 16px` stays (its at-rest
seat); the existing 1px `--border` frame stays (the top rule doubles as
the sticky seam).** The `.app` container's 16px bottom padding remains
outside the sticky element — at rest the block sits 16px above the
sheet edge exactly as today; while scrolling it pins to the viewport
bottom. No shadow (the identity has none); the ink border is the
separation.

## Axis 4 — non-goals

- No SVG geometry/structural changes; no new tokens; no markup changes
  (all fixes land on existing classes); no view frames.
- No lane-overrides input relabeling (S10P0 posture stands).
- No mobile/responsive pass (desktop-first stands).
- Raw-feed visibility is P1, not here.

## Test plan sketch

Zero new node tests (CSS-only); zero churned pins expected (no markup).
Both-media walk: override rows read mono/muted; within each lane the
inputs sit on ONE aligned column, every label on ONE line (max-content
— no wrap even for the ~51-char output labels), the dead gulf gone
(track hugs content); a multi-machine stage with output lanes is the
REQUIRED test data (the worst-case label length);
summary cards / canvas notice / chain-power chip square (the findings
pill still round);
tooltip square + mono (hover a lane); bp-notice/footer mono; combined
view site names in the display face;
view padding 12px; title block PINS to the viewport bottom while
scrolling (panels scroll under it, opaque, no bleed-through), sits in
its normal seat at rest, in BOTH papers; keyboard focus + resize seam
unaffected.

## Assumptions ledger

1. All cited lines read this session against develop @ 844e223:
   override rules :695-710, tooltip :484-496, bp-notice :588-592,
   chain-bp-footer :689-693, chain-bp-name :652-656, view containers
   :471-481 + :579-581, S9P2 label group :1356-1365, title block
   :1211-1218, findings-panel 12px :712-714.
2. The views' TSX carries no hardcoded presentation (grep this
   session: only the tooltip's positional `style` and one
   `cursor: pointer`) — every fix lands in app.css.
2b. Override label templates (LaneOverrides.tsx:25-44, r2-verified):
   the output branch (`Out N · R/min load · breaks out after machine
   M`) is the longest at ~51 chars with 4-digit rates (src/data/tiers.ts:11,
   belts reach 1200) and 2-digit machine indices — the content bound
   that killed both the v1 (min-width: 0) and v2 (220px) shapes.
   `.override-label` has no white-space rule; long labels WRAP today.
   `max-content` grid tracks are wrap-proof by definition.
2c. `display: contents` on plain `<div>` rows is well-supported (the
   known legacy issues concern interactive/list elements); the rows
   carry no ARIA roles or semantics that flattening would break
   (LaneOverrides.tsx:63-80 — divs, a span, an input).
3. `.title-block` is the last child inside `.app` (App.tsx render
   order) — sticky bottom within the body scroll behaves as described;
   the app's 1024px column bounds its width unchanged.
4. `position: sticky` requires no markup change and keeps the block in
   normal flow at rest — the at-rest layout is pixel-identical.
5. z-index inventory (grep this session): `.tooltip` 5 (app.css:487)
   and `.drop-overlay` 100 (:302, fixed full-screen drag affordance,
   pointer-events none — correctly ABOVE the sticky block). Title block
   at 6 sits above the tooltip and below the overlay; RF chrome is
   contained by `.graph-canvas` overflow.

## Revision history

- v1 (2026-08-05): initial — static line-cited audit + the #55 sticky
  decision folded in.
- v2 (2026-08-05): dual-review r1 — [code-reviewer] APPROVED_WITH_NITS
  (2, folded: z-index prose tightened to the single value 6; :708-710
  cite); [adversarial] NEEDS_REWORK (1 MAJOR + 1 MINOR + 1 NIT, all
  folded):
  - **MAJOR (source-verified):** v1's `min-width: 0` rested on a false
    "shared row grid" mechanism — each override row is an independent
    flex container and the 320px min-width is the ONLY cross-row input
    alignment. Fold: KEEP the min-width mechanism, retune 320→220px for
    the 11px mono metrics; both properties (aligned + fits) walk-
    asserted.
  - MINOR: the z-index self-argument (already tightened per the
    code-reviewer nit — single value 6, above tooltip 5, below overlay
    100).
  - NIT: scope boundary named; the three genuine radius stragglers
    (.summary-card :454, .graph-canvas-notice :822, .graph-chain-power
    :949) promoted IN as audit item 8; the findings pill (:924)
    recorded as deliberately round.
  Survived refutation (r1-verified): sticky mechanics (last-child,
  page scroll container, at-rest seat, opaque ground never overpaints
  the frame band), 0.04em tracking clips nothing (overflow postures
  :584/:478), chain-bp-name→display legitimately supersedes the S9P2
  refinement (not a frozen pin), the rem clean-list.
- v3 (2026-08-05): dual-review r2 — BOTH NEEDS_REWORK on the SAME
  defect, independently computed: the v2 220px retune was undersized
  (the longest OUTPUT label — `Out N · 1200/min load · breaks out
  after machine M` — is ~51 chars ≈ 337px at 11px mono, not the ~30
  chars the fold assumed; and with no white-space rule the label WRAPS
  rather than pushes, silently breaking the column). Fold: the value
  lineage is abandoned for the r1 adversarial's own prescribed shape —
  a REAL shared track: `.lane-overrides-lane` becomes a two-column
  `max-content` grid, rows go `display: contents`, the min-width dies.
  Wrap-proof (max-content), aligned (shared track), gulf-free
  (content-sized); cross-lane width variation accepted + stated; walk
  requires worst-case output-lane data. Ledger 2b/2c added (label
  templates + display:contents support). r2 confirmed clean: the three
  radius stragglers, the findings-pill exception, the scope boundary,
  z-index 6 (complete two-entry inventory).
- v3-r3 (2026-08-05): scoped re-check — BOTH APPROVED_WITH_NITS
  (correctness CONVERGED). [code-reviewer] 1 NIT (src/data/tiers.ts
  path, folded); [adversarial] 1 MINOR (same path) + 1 NIT (the
  .override-row edit REPLACES the :702 flex block — folded into Axis
  1's wording). The grid fix survived all five refutation axes: lane
  children uniform (no orphans), display:contents breaks no focus/
  events/hooks (data-item unused by CSS/JS), NO overflow possible
  (worst-case lane ≈ 515px inside the ~992px app content width —
  computed), cross-lane variation reads as grouped stacks, and the
  zero-churn claim verified against the only LaneOverrides pin
  (smoke.test.tsx:455-472, DOM-only).
- v3-simplify (2026-08-05): one-shot simplify pass NEEDS_REWORK
  (advisory — 3 findings, all dispositioned): (1) the 0.04em SVG-label
  tracking DROPPED as gold-plating (the reviewer's prescription,
  FOLDED — the labels are already on-identity and the artifact's own
  data-sentences rule exempts them; future polish only if Michael
  asks); (2) scope-boundary wording fixed (FOLDED — the two in-canvas
  chips are OUR app chrome in RF Panels, kept in scope; RF's OWN
  chrome stays out; all three radius fixes stand); (3) the lane grid
  rule named as a NET-NEW selector (FOLDED, one word). The grid shape,
  sticky details, and per-defect fix list otherwise affirmed minimal
  ("three rounds converged ONTO the lean form"). No correctness re-run:
  fold 1 is a pure subtraction no surviving item depends on
  (chain-bp-name had already left the group), folds 2-3 are wording —
  the r3 approvals cover the remaining subset. FROZEN.
