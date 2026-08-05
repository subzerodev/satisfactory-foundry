# Stage 9 / Phase 2 — panels as drawing schedules + arc polish (ticket #46) — brainstorm v3 (FROZEN)

**Goal.** The last surfaces join the drawing: tables become drawing
SCHEDULES, panels take the sheet treatment, the SVG views get their
deferred refinements, and a final both-media sweep closes the arc.

## Already settled — do NOT re-litigate

- #42/#43/P0/P1 decisions bind: token values + names, behavior-frozen
  (presentation only; 707 suite green modulo enumerated literal pins),
  the three-block cascade guard, the stamp/dimension idioms, both-media
  walks. The P1 walk surfaced NO calibration items (stamp intensity and
  ink ticks read correctly live) — nothing carries in.
- All-Claude roster; opus implementer; full gate; release PR at close.

## Axis 1 — the schedule idiom: ONE shared table treatment via a grouped selector

**Pick: one CSS block styling `.train-table, .alt-compare-table` (the
only two real tables — verified train-table LinkInspector.tsx:532,
alt-compare-table AltCompare.tsx:137) as drawing schedules: full
--font-mono-num body; the header row in 11-12px letter-spaced UPPERCASE
(text-transform — DOM untouched) with a 2px --fg rule under it; row
separators hairline --border-soft; numeric cells right-aligned
(text-align on td via :nth-child is BRITTLE across two different
column layouts — instead a shared class is NOT added to markup;
alignment stays per-table where it already differs, only the type/rule
treatment is shared); the current/apply affordances re-expressed in
medium tokens (alt-compare-current row gets a --accent left rule;
buttons the P0 quiet-mono control look).** ChainBuilder's preview list
(a <ul className="chain-builder-rows">, ChainBuilder.tsx:135 — r1
cite fix, not a table) gets the same type treatment + hairline
separators as a list — the schedule LOOK without forcing table markup
(markup untouched).

## Axis 2 — panel treatment: the existing panels re-dressed in place

**Pick: LinkInspector, FindingsPanel, SummaryCards, PlansBar,
ChainBuilder, AltCompare containers get the sheet-panel dress via their
EXISTING container classes: ONE grouped selector across all six
(simplify fold, v3 — the rule shape stated): --bg-panel ground, 1px
--border-soft frame, border-radius 0. This INTENDS the deltas the
current CSS shows: .link-inspector + .alt-compare change border color
--border → --border-soft and radius 4→0; the other four GAIN a frame
they lack today — uniform panel dress is the point (the drawing has no
rounded or frameless chrome), panel titles/headers in the
letter-spaced mono label idiom (the TitleBlock's .title-block-label
look — promoted to a shared `.sheet-label` utility class applied ONLY
in CSS terms via grouped selectors on the existing header classes, no
markup change), findings keep their semantic colors (error/notice) in
medium values.** Inputs/selects/buttons app-wide get the P0 quiet-mono
control treatment generalized (one grouped rule — the header controls
already have it; the panel controls join).

## Axis 3 — SVG views: token-consistency refinements only

**Pick: the MINIMAL set — (a) the schematic/blueprint/combined already
sit on medium tokens (P0); P2 adds ONLY: foundation grid strokes to
--border-soft weight (consistency with the sheet), site/stage labels in
the SVG views to --font-mono-num (font-family on SVG text via the
existing classes), and the blueprint view's title strip (if any text
chrome exists) to the label idiom. (b) NOTHING structural — no new SVG
elements, no re-drawn seams. Anything more is deferred-forever unless a
walk demands it (recorded).**

## Axis 4 — a11y + polish sweep

- Focus visibility: the new chrome must keep visible focus — one
  grouped `:focus-visible` rule (2px --accent outline, offset 1px) for
  buttons/selects/inputs/links app-wide (today's default focus may be
  invisible on vellum — the sweep's one real a11y risk).
- The `.selected` node outline, inspector affordances, and stamp
  contrast were verified in P1 walks — spot-rechecked only.
- Document title stays "satisfactory-foundry" (recorded P0 non-goal —
  unchanged; a favicon is NOT added: out of charter, no asset exists).
- Reduced motion: still nothing animated in the arc — nothing to gate
  (final recording).

## Axis 5 — non-goals

- No markup changes anywhere (CSS-only; grouped selectors over new
  utility classes in markup).
- No table-column re-alignment via nth-child; no shared class added to
  TSX.
- No SVG structural work; no favicon; no motion; no new tokens (the
  P0 three + the --xy set are the complete vocabulary — if a value is
  missing, the answer is an existing token, not a new one).
- No behavior anywhere; the release PR + arc close follow the merge.

## Test plan sketch

Zero new node tests expected (pure CSS phase; grouped selectors).
Any churned literal pin enumerated (expected zero — no markup change).
R2 log records the honest walk-gated posture. Both-media walk: the
train schedule + alt-compare schedule + builder preview in both media;
panel dress on all six containers; SVG views' label type + foundation
strokes; focus-visible on keyboard tab across header + panels; the
full three-view cycle + inspector + builders sweep for stragglers
(any hardcoded-looking color = a bug against the P0 sweep).

## Assumptions ledger

1. The two real tables verified this session (train-table
   LinkInspector.tsx:532; alt-compare-table AltCompare.tsx:137 —
   r1-confirmed the COMPLETE table set, no third table exists;
   ChainBuilder's preview is a <ul>, ChainBuilder.tsx:135, styled via
   .chain-builder-rows).
2. All six panel containers have stable existing classes (app.css
   already styles .link-inspector/.findings-panel/.summary-cards/
   .plans-bar/.chain-builder/.alt-compare — the implementer's drift
   hunt confirms each name).
3. SVG view text carries classes reachable for font-family (the P0
   token re-value already touched their fills — same class surface).
4. No test pins panel container markup beyond class names that stay.

## Revision history

- v1 (2026-08-05): initial, grounded in this session's reads of the
  table/panel class surface + the P0/P1 records.
- v2 (2026-08-05): dual-review r1 — [code-reviewer]
  APPROVED_WITH_NITS (2); [adversarial-reviewer] APPROVED_WITH_NITS
  (1) — the SAME nit: the preview list is a <ul> at :135 (not an <ol>;
  :129 was the wrapper div). Folded. Converged first round. Verified
  clean by both: the table set is COMPLETE at two; all six container
  classes exact in TSX + CSS; every SVG text element is classed
  (lane-name/machine-label/bp-*/chain-bp-*); NO :focus rule exists
  today (the a11y premise is real; the proposed outline is disjoint
  from the .selected canvas idioms); no new tokens needed (every value
  maps to an existing token); no smoke pin on panel presentation
  (.alt-compare's border-radius 4px→0 is clean churn).
- v3 (2026-08-05): simplify pass (one-shot, post-convergence)
  APPROVED_WITH_NITS (1, FOLDED): the panel dress is ONE grouped
  selector across all six containers, with the two-panel border-color
  delta and the four-panel gains-a-frame delta stated as intended.
  All other probes affirmed minimal (grouped-selectors-over-markup
  correctly judged; the SVG label font is a REAL delta — zero SVG work
  would leave labels off-identity; the a11y sweep closes to one rule;
  test plan honest). FROZEN.
