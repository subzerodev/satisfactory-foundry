# Stage 10 / Phase 0 — theming stragglers: base element rules (ticket #49) — brainstorm v4 (FROZEN)

**Goal.** Every button/select/input matches the medium in both papers —
Michael's live feedback: the P2 container enumeration missed the
controls outside the six panels.

## Already settled — do NOT re-litigate

- Stage 9 decisions bind: token names/values, the three-block cascade
  guard, the quiet-mono control look (mono face, --border-soft 1px,
  transparent ground, radius 0), the frameless close ✕ (:not-excluded),
  the :focus-visible rule. CSS-only, behavior-frozen, 707 green.
- All-Claude roster; full gate; both-media walk.

## Axis 1 — invert the approach: BASE element rules

**Pick (r1 REWRITE — both reviewers): the base rules adopt the P2
group's EXACT existing look so the fold is near-neutral, and the
carve-outs are explicit:**

- `button, select, input:where(:not([type="radio"]):not([type="checkbox"]))`
  → font --font-mono-num, font-size 12px, color --fg-muted, background
  transparent, border 1px --border-soft, radius 0, padding tuned,
  cursor: pointer (r3 fold — every control is interactive; the UA
  button default is `default`, and the joiner fold would otherwise
  drop the pointer the legacy rules carried). The
  `:where()` wrapper is LOAD-BEARING (r2 fix — a bare :not([type=…])
  carries attribute-selector specificity, making the input arm (0,2,1)
  and silently DEFEATING every class-level exception; :where() zeroes
  the pseudo-class contribution so all three arms are (0,0,1) and the
  exceptions win as intended). Deltas vs the folded P2 group, stated
  (r2 precision): 11→12px AND padding added (the group declared none);
  the alt-compare apply grows with them — accepted for uniformity; the
  11px table-HEADER rule is separate and untouched.
- Radios + checkboxes get ONLY `accent-color: var(--accent)` (the
  box declarations are carved out above — native marks must not be
  boxed/distorted; today they are unstyled, so this is purely
  additive).
- File inputs: the base box applies to the input; the button face via
  `::file-selector-button` with the base declarations (Baseline
  supported; unstyled-native fallback acceptable, recorded).
- `color-scheme` is NEW (r1 — nothing sets it today, the v1 claim was
  false): `color-scheme: light` in :root, `color-scheme: dark` in BOTH
  dark blocks (the cascade-guard pair), so native popups/spinners
  track the medium.
- The P2 panel-controls GROUP folds away (members now inherit the
  near-identical base). EXCEPTIONS — the closed set the design
  enumerates INSTEAD of stragglers (r1 inversion): the frameless
  .link-inspector-close and .stage-node-remove (own rules, higher
  specificity, stand); .stage-node-rename gains an explicit exception
  rule (border none, background transparent — it must not be boxed
  mid-plate; r1 catch); .theme-toggle + .app-header input (own rules
  stand — accepting the base's inert props (font/radius/padding)
  leaking onto them, the same posture as the RF note, r3 wording); RF
  .react-flow__controls-button OUTRANKS the base (0,1,0 vs 0,0,1 with
  :where() — the --xy chrome wins; base only contributes inert
  font/radius); .graph-add-stage, .tier-toggles
  button AND .view-toggle INTENTIONALLY join the base look (r2 catch —
  they carried legacy border/background (+ radius on .view-toggle
  only, r3 precision): at implementation their rules fold to
  LAYOUT-ONLY (padding/font-size where wanted; cursor moves to the
  base) so the base dresses
  them uniformly; their text going mono/muted is the intended re-skin.
  The `.tier-toggles .tier-on` ACTIVE-STATE rule survives untouched
  (r3 — it is semantic state, not box chrome, and outranks the base at
  (0,2,0)).**

- Why base rules: enumerating stragglers repeats the P2 mistake (v1's
  own list missed .graph-add-stage, the UploadScreen file input, and
  .stage-node-rename — r1). The base rule covers ALL controls; only
  the EXCEPTIONS are enumerated (the closed, defensible set above).
- The fold is near-neutral FOR FORMER P2-GROUP MEMBERS (r2
  qualification): same muted/transparent/border-soft look, size +
  padding deltas stated. Controls OUTSIDE the group that now join
  (.graph-add-stage, .tier-toggles, .view-toggle) change deliberately
  — that is Michael's ask. Contrast unchanged (audited tokens).

## Axis 2 — non-goals

- No markup changes; no new tokens; no custom checkbox/radio drawing;
  no number-input spinner suppression beyond color-scheme; no layout.

## Test plan sketch

Zero new node tests (CSS-only; the base rule is walk-gated). Churned
pins expected zero. R2 log honest posture. Both-media walk: EVERY
control — header (upload, toggle), settings (Recipe, Machines, clock,
overrides), plans bar, builders, inspector (mode/trip/radios/fuel/
derate/checkboxes), alt-compare/train buttons — reads medium-correct;
the close ✕ stays frameless; radios/checkboxes show accent marks;
native select popups match via color-scheme.

## Assumptions ledger

1. Radios/checkboxes at LinkInspector.tsx:358/366/617/627 (verified);
   no other radio/checkbox exists (grep).
2. The base rule reproduces the P2 group's declarations exactly except
   font-size (11→12px — the one intended visual delta, r1-corrected
   wording; the group's members change ONLY in size).
3. color-scheme is NOT set anywhere today (r1-verified — grep) — the
   design ADDS it: light in :root, dark in both dark blocks.

## Revision history

- v1 (2026-08-05): initial, from the live-feedback straggler sweep.
- v2 (2026-08-05): dual-review r1 — BOTH NEEDS_REWORK
  ([code-reviewer] 3 IMPORTANT + 2 NITs; [adversarial] 2 HIGH + 2 MED
  + 1 LOW), heavily overlapping; all folded:
  - The base values were WRONG (would have recolored panel controls
    --fg-muted→--fg, transparent→--bg-panel): v2 adopts the P2
    group's exact look; the only delta is 11→12px, stated (incl. the
    alt-compare apply growing — the "tables keep 11px" claim was
    ungrounded for it and is withdrawn).
  - color-scheme claim was FALSE (nothing sets it) — now explicitly
    NEW in all three blocks.
  - The enumeration inverted: base covers everything; the EXCEPTIONS
    are the closed set (close ✕, node remove ✕, node rename —
    explicit new carve-out so it isn't boxed mid-plate, theme toggle,
    header file input, RF controls outranked-note, graph-add-stage
    intentionally joining).
  - Radios/checkboxes carved out of the box treatment (accent-color
    only — native marks never boxed); the 12px justification
    re-grounded (the P2 group styled form controls, not table
    buttons).
  Verified clean: the radio/checkbox inventory (exactly four), RF
  controls outranking, the attribution link unselected,
  ::file-selector-button baseline posture.
- v3 (2026-08-05): dual-review r2 — BOTH NEEDS_REWORK, complementary:
  [adversarial] caught the :not() specificity trap (the input arm was
  (0,2,1), defeating the .stage-node-rename and .app-header input
  exceptions — the exact regression r1 had "fixed"); FOLDED with the
  :where() zero-specificity wrapper, all arms now (0,0,1).
  [code-reviewer] caught .tier-toggles button + .view-toggle missing
  from the "closed" exception set (their text would re-font silently);
  FOLDED as intentional joiners with their legacy box rules reduced to
  layout-only; the near-neutral claim qualified to former-group
  members; padding named as the second delta. Verified clean by both:
  color-scheme honestly new, the radio/checkbox carve-out coherent +
  reachable, the file-input posture consistent, residue swept.
- v3-r3 (2026-08-05): scoped re-check — [code-reviewer]
  APPROVED_WITH_NITS (2, folded: .view-toggle-only radius precision;
  the .tier-on active-state survivor named explicitly; also flagged
  that .app-header input[type=file] computes (0,2,1) — outranks the
  base comfortably). All five r2 folds verified conformant with
  re-scored specificity. [adversarial-reviewer] NEEDS_REWORK (1
  IMPORTANT + 1 NIT, both folded: cursor: pointer joins the BASE rule
  — the layout-only joiner fold would have dropped it, a behavior
  regression; the base's inert props leaking onto the frameless
  exceptions is stated as ACCEPTED, matching the RF-controls note).
  The :where() resolution verified genuinely closed (every exception
  re-scored winning); smoke input-count pins confirmed safe.
  Correctness CONVERGED (the surviving items are the reviewers' own
  one-declaration prescriptions, boundary-verified next).
- v4 (2026-08-05): r3 adversarial folds applied (cursor to the base;
  leak-acceptance wording); FROZEN for the simplify pass.
- v4-simplify (2026-08-05): simplify pass APPROVED (0 folds — the
  three frameless exceptions verified genuinely divergent, the
  file-selector-button rule earns its place against the loudest
  medium-mismatch, the walk checklist is the only executable check;
  the v1-to-v2 inversion praised as the simplifying move). FROZEN.
