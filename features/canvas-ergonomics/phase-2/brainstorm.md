# Stage 10 / Phase 2 — spacing pass: breathing room, both media (ticket #50) — brainstorm v1 (FROZEN)

**Goal.** Michael's live feedback during the P0 walk: "theres a few spacing
isssues somethings are too close." A systematic computed-gap audit (this
session, live app @ develop f7ab3ec, 1280px viewport) found the cramped
sites; this phase fixes them against the app's existing gap rhythm.
CSS-only, behavior-frozen.

*Cite shorthand: `app.css` = src/ui/app.css (r1 nit — disambiguated once).*

## Already settled — do NOT re-litigate

- Stage 9 identity + Stage 10 P0/P1 decisions bind (panel dress, base
  control rules, canvas seam). All-Claude roster; both-media walk; the
  728-test suite stays green (zero churn expected — CSS-only).

## The audit (measured, not guessed)

Method: getComputedStyle + bounding-rect sibling-gap sweep over every
visible container, plus frame-flush insets (content left/right offset vs
panel edge), dark medium, full surface up (recipe selected). Findings:

1. **Content flush against the S9P2 frames (the systemic defect).** The
   panel-dress rule (app.css:1312-1321) framed all six panels, but the
   FOUR that gained a frame kept their pre-frame `padding: 12px 0`:
   `.plans-bar` (:344), `.chain-builder` (:373), `.summary-cards` (:445),
   `.findings-panel` (:713). Measured: content starts 1px inside the
   frame (the border itself). The two panels that always had frames pad
   `12px` all around (`.link-inspector` :1031, `.alt-compare` :1164).
2. **The canvas panel buttons TOUCH (0px).** `＋ stage` and the P1 `FLOW`
   toggle sit in the same RF top-left panel with no gap (measured 0px —
   two 1px-bordered buttons reading as one merged control).
3. **Tier chips read merged.** `.tier-toggles { gap: 2px }` (:425) was
   set when the buttons were borderless; the P0 base rule gave each a
   1px border, so 2px between borders reads as touching segments.

Audited and CLEAN (no change): header strip (16px gaps), legend (12px),
controls-strip/summary internals (12px), plans-save/-manage (8px),
lane-overrides (8px, frameless so flush-left is correct), title-block
butted cells (the drawing's ruled-cell idiom, 6px 10px inner padding —
deliberate), label-to-field inline layout, view-toggle, canvas grid.

## Axis 1 — the fixes (three, exactly matching the audit)

**Pick:**

1. The four under-padded panels: `padding: 12px 0` → `padding: 12px` —
   joining the 12px inset the other two framed panels already use. NOT a
   new grouped rule: four one-line edits in place (the panels' own rules
   already exist; the dress rule stays layout-free).
2. `.graph-canvas .react-flow__panel.top.left { display: flex; gap: 8px; }`
   — scoped to the one panel holding the two buttons (RF's own controls/
   attribution panels untouched); 8px is the app's control-sibling gap
   (plans-save/-manage precedent).
3. `.tier-toggles` gap `2px` → `6px` — the tier area's own rhythm
   (`.tier-controls` gap is 6px); chips separate without becoming loose.

## Axis 2 — the gap rhythm, stated (not a new token system)

The app's existing rhythm, now used consistently: 16 section (header),
12 panel inset + panel-content gaps, 8 sibling controls, 6 compact
chip/label separation, 2 reserved for intra-control density only (none
left after fix 3). No CSS variables added — the values are already
literals throughout app.css; introducing a spacing token system for
three fixes is out of scope (recorded).

## Axis 3 — non-goals

- No app-column widening; no title-block/header/legend changes; no
  frameless-section padding (lane-overrides et al are correct flush).
- No spacing-token variables; no markup changes; no behavior.
- Anything Michael names later that this audit missed → follow-up fold
  on this ticket's walk, or a new ticket if post-merge.

## Test plan sketch

Zero new node tests (CSS-only; the 728 suite must stay green with zero
churned pins). Both-media walk: the four panels show 12px insets left
and right of content (measured, not eyeballed); ＋ stage / FLOW gap 8px;
tier chips visibly separate; nothing else moved (spot-check header,
title block, legend against the audit's clean list).

## Assumptions ledger

1. Audit measurements from the live develop build @ f7ab3ec this
   session (dark medium; spacing CSS is theme-independent so the values
   hold in vellum — the walk still verifies both).
2. The four panels' padding lines: app.css :344 (.plans-bar), :373
   (.chain-builder), :445 (.summary-cards), :713 (.findings-panel);
   the two already-correct panels :1031, :1164 — read this session.
3. `.tier-toggles` gap 2px at :425 with the P0 layout-only comment
   block at :428-433 — read this session.
4. The RF top-left panel's classes are `react-flow__panel top left`
   (measured live from the DOM this session); `.top.left` therefore
   selects exactly it; RF's controls (`react-flow__controls vertical
   bottom left`) and attribution carry different position classes.
5. Making the panel a flex row does not reorder its two children
   (source order ＋ stage then FLOW is preserved by flex).

## Revision history

- v1 (2026-08-05): initial, grounded in this session's live computed-gap
  audit + static CSS reads.
- v1-r1 (2026-08-05): dual-review — [code-reviewer] APPROVED (0);
  [adversarial] APPROVED_WITH_NITS (2 trivial, folded: :424→:425
  off-by-one; app.css path shorthand note). Correctness CONVERGED first
  round. Adversarial verified under refutation: no full-bleed victim in
  the four panels (the .finding-error accent bar becoming an inset card
  is the intended breathing room; panel border-bottom seams sit on the
  box edge, unaffected); RF 12.11.2 Panel emits `top left` as split
  classes and its stylesheet sets no display property, so the flex+gap
  override is purely additive and cannot reach the bottom-right/top-right
  panels or Controls; no recorded segmented-control intent for tier
  chips (the P0 record treats each as an individual bordered control);
  clean-list spot-checks hold; no frozen-decision conflict.
- v1-simplify (2026-08-05): one-shot simplify pass APPROVED (2 trivial
  advisory nits, both dispositioned no-action on the reviewer's own
  reasoning: the ledger's falsifiable-claims framing is a distinct job
  from the inline cites; the "(none left after fix 3)" parenthetical is
  harmless). All three probes affirmed: the audit prose IS the design
  for a spacing pass; no fix drops or merges (the rejected grouped-rule
  merge was the correct parsimony call); the no-token-system decision is
  right. FROZEN.
