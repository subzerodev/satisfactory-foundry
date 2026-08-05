# Stage 9 / Phase 0 — tokens + type + sheet chrome (ticket #44) — brainstorm v3 (FROZEN)

**Goal.** The identity's foundation lands app-wide: both media (vellum /
cyanotype) as CSS custom properties, the three-face type system, and the
app shell re-chromed as a drawing sheet — frame, top strip with the
line-conventions legend, and a TITLE BLOCK footer carrying real data.

## Already settled — do NOT re-litigate

- The #42 direction decision binds: palette (vellum #EDE9DC / ink
  #24384A / orange #E8722D — SUPERSEDED on vellum to #C25A1D, the r1
  contrast correction in Axis 1 / stamp #B3382C; cyanotype #123C63 /
  #D9E8F5 / #F5913E (un-superseded, passes) / #FF8073), type (Big Shoulders display + IBM Plex Mono
  numeric + quiet sans prose), title block, dimension lines (P1),
  stamps (P1), line-conventions legend. Orange is the ONE accent.
- The epic #43 decision binds: behavior-frozen (presentation only; the
  703 suite stays green — literal class/string pins may move, nothing
  else); three phases; full gate with BOTH-media walks.
- Existing theme mechanism is frozen infrastructure (app.css:34-66):
  `:root[data-theme="dark"]` + the `:root:not([data-theme])` media
  fallback with the pinned cascade guard — the media mapping reuses it
  verbatim (Axis 2), no new mechanism.
- All-Claude roster; opus implementer; full gate.

## Axis 1 — token home: re-value the EXISTING vars in place, add the new ones beside them

**Pick: app.css's `:root` block stays the single token home. The
existing semantic vars (--fg/--bg/--bg-panel/--border/--accent/
--error/--surface-*/--notice…) KEEP THEIR NAMES and get the new VALUES
(vellum set in `:root`, cyanotype set in the dark block); THREE new
tokens join them (simplify fold, v3 — the v2 set of eight shrank):
--border-soft (a real second border value — frame ink vs faint
interior separations), --font-display, --font-mono-num. Rejected as
aliases or premature: --ink (≡ --fg — a comment carries the drafting
vocabulary), --sheet (≡ --bg — --bg IS the sheet; --bg-panel is the
on-sheet panel value), --grid-line and --stamp (no P0 consumer —
they land in P1 with their first rendered use; --error carries the
stamp red meanwhile), --frame-gap (one literal at one site — inlined
with its comment).**

- Why re-value not rename: ~890 lines of existing CSS + every SVG
  surface consume the current names; renaming is churn with zero
  rendered difference and maximal literal-pin breakage. The identity is
  values + new chrome, not a naming project. (A tokens.css split is
  rejected the same way: one more import for zero benefit at this size.)
- Mapping (light → vellum): --bg #EDE9DC (sheet), --bg-panel a slightly
  lighter vellum #F2EFE4 (panels sit ON the sheet), --fg #24384A ink,
  --fg-muted #4A5D6E, --border #24384A at hairline weight for FRAME
  lines but a soft #C9C3B2 for interior panel borders (two border
  roles — new token --border-soft; the drawing reads because frame
  lines are ink and fill separations are faint), --accent **#C25A1D**
  (r1 CORRECTION — the #42 concept's #E8722D computes 2.51:1 on
  vellum, FAILING the 3:1 gate for display text and non-text contrast;
  #C25A1D computes 3.62:1 on vellum and 4.4:1 under white text, same
  hue family — supersedes the #42 hex for the VELLUM medium only),
  --accent-strong #A64A16 (4.79:1), #E8722D permitted ONLY as a fill
  under light text (never display type or borders on vellum), --error
  → the stamp red #B3382C (4.91:1 ✓), SVG surface set re-valued to
  vellum-tinted equivalents (fills #E5E0D0, strokes ink-muted).
- Dark block → cyanotype: --bg #123C63, --bg-panel #17466F, --fg
  #E8F1F8, --fg-muted #A8C4DC, --border #D9E8F5, --border-soft
  #2A5580, --accent #F5913E, --error #FF8073, surfaces re-valued to
  blue-tinted equivalents. The toggle is untouched code-wise — the
  medium change IS the value change.
- Contrast gate (COMPUTED at r1, all passing): ink/vellum 9.94:1;
  muted/vellum 5.61:1; accent #C25A1D/vellum 3.62:1 (display+non-text
  ✓; body-size orange text stays FORBIDDEN); stamp/vellum 4.91:1;
  #A8C4DC/cyanotype 6.26:1; #E8F1F8/cyanotype 9.92:1; orange
  #F5913E/cyanotype 4.86:1; #FF8073/cyanotype 4.64:1. The spec carries
  this table verbatim.
- REACT FLOW SCOPE (r1 fold — recorded, not discovered later):
  GraphCanvas imports @xyflow/react/dist/style.css whose --xy-* vars
  (background dots, controls, minimap, default edge strokes) do NOT
  read the app tokens — in P0 the RF-owned canvas chrome stays stock
  by DESIGN (Axis 5 fences canvas to P1, which re-skins via --xy-*
  overrides). The goal line's "app-wide" means the app's OWN tokens
  and chrome; the P0 walk accepts the stock canvas panel as a known
  state. (.stage-node cards DO re-value — they use app tokens.)

## Axis 2 — fonts: self-hosted woff2, no CDN

**Pick: Big Shoulders (SemiBold 600 + Bold 700, latin subset) and IBM
Plex Mono (Regular 400 + Medium 500, latin) as woff2 files in
`public/fonts/`, declared via @font-face at the top of app.css with
`font-display: swap`; prose stays the existing system-ui stack (the
"quiet sans" IS the system stack — zero bytes, native rendering).**

- Why self-host: the planner runs mid-game and after `npm run dev` on a
  LAN box — a Google Fonts CDN dependency would flash fallback or fail
  offline entirely; the repo already bundles its data (Docs.json
  precedent — the app is self-contained by posture). License: both are
  OFL — a `public/fonts/OFL.txt` rides along.
- Fallback stacks: `"Big Shoulders", "Arial Narrow", sans-serif` (a
  condensed-ish fallback keeps layout close);
  `"IBM Plex Mono", ui-monospace, Menlo, monospace`.
- The implementer downloads the subsets at build time ONCE and commits
  them (static assets, the bundled-docs precedent — no network at
  runtime or CI).

## Axis 3 — the sheet chrome: frame + top strip

**Pick: the app root gets the double-line drawing frame — an outer 1px
ink border and an inner line 3px inside it (mechanically, r1 fix: ONE
element carries one border; the inner line is an `outline: 1px solid`
with `outline-offset: -4px` — no new DOM, no pseudo-element; the
existing .app `padding: 16px` STAYS as the content inset, sitting
inside the frame lines). The header re-styles in place:
the h1 becomes the Big Shoulders wordmark "SATISFACTORY FOUNDRY /
FICSIT DWG" (orange suffix); the Legend component re-skins as the
line-conventions key (Mk chips become line samples — a solid rule
swatch per belt tier in its existing TIER_COLOR, a dashed rule for
pipes) — SAME component, same props, new presentation; the upload
input and theme toggle re-style as quiet mono controls.**

- No layout re-architecture in P0: header stays a flex row, panels stay
  where they are. P0 changes what things LOOK like, P2 refines panel
  placement if the walk demands it (recorded).
- The theme toggle's glyphs change from ☀/☾ to the medium's names —
  a small mono button reading "CYANOTYPE" (in vellum) / "VELLUM" (in
  cyanotype): the toggle names its destination (write-the-destination
  rule), and the words ARE the feature now. aria-label carries the
  same text.

## Axis 4 — the title block: real data, zero new state

**Pick: a new thin `TitleBlock` component rendered by App as the sheet
footer — a bordered cell strip (the mockup's shape): TITLE = the
ACTIVE stage's name (always resolves — the store invariant); SHEET =
"S<stageOrder.length> · L<links.length>"; REV = today's date (client
clock, display-only); UNITS = "/MIN · EXACT ℚ" (static — the honest
brag); Σ POWER = `chainPowerText(Object.values(stages), catalog)`
(the EXISTING advice.ts helper — already the labeled-≈ discipline),
orange value. Data via ordinary store selectors in App, props down —
TitleBlock stays pure/presentational (SSR-smoke testable).**

- Why not the loaded plan's name: the store does NOT track a current
  plan id (verified — savePlanAs/loadPlan keep no cursor), and adding
  one is BEHAVIOR — out of the arc's charter. The active stage name is
  real, always-present data the drawing is genuinely "of". Recorded:
  a currentPlan cursor is a future ticket if wanted.
- The existing Combined-view footer (ChainBlueprint's sites Σ +
  transport note) is UNTOUCHED in P0 — it's a P2 surface; the title
  block is app-level chrome, not a replacement for it. Duplication of
  the Σ between the two is acceptable and honest (same helper, same
  number).

## Axis 5 — non-goals

- No canvas/node/edge changes (P1); no stamps (P1); no panel/table
  re-skin beyond inherited tokens (P2).
- No new store state, actions, or selectors beyond App-level reads.
- No motion/animation work (reduced-motion posture: the arc adds no
  new animation, so `prefers-reduced-motion` has nothing to gate in
  P0; recorded for P1/P2 if motion appears).
- No light/dark beyond the two media; no per-user palette knobs.
- No favicon/document-title change (candidate P2 polish, recorded).

## Test plan sketch

Node/SSR: TitleBlock renders the cells from props (name, counts, Σ
text, the static units string); the wordmark + legend line-convention
markup in the smoke suite (updated pins where class names/markup
legitimately changed — each churned pin listed in the boundary
report); token presence pins are NOT written (CSS values aren't
unit-testable in node — the walk is the gate). 703 baseline stays
green otherwise. Bidirectionality log for the new TitleBlock rows.
Browser walk BOTH media: frame + title block + legend render; toggle
swaps medium AND its own label; contrast spot-checks via
preview_inspect computed colors; no layout breakage in all three
views + inspector + builders.

## Assumptions ledger

1. Token home + dark mechanism verified this session: app.css :root
   (:1-32), `:root[data-theme="dark"]` (:39) + media fallback with
   cascade guard (:62-66). Re-valuing in place preserves the mechanism
   untouched.
2. Legend is a props-driven component (App passes catalog.tiers —
   App.tsx renders `<Legend tiers={catalog.tiers} />`); re-skinning it
   is presentation-only. TIER_COLORS stay data-driven (app.css:10-12
   comment — deliberately not tokens).
3. chainPowerText(stages, catalog) returns string | null
   (advice.ts:124-127; the ?? "—" posture from ChainBlueprint:306).
   App does NOT currently import it (r1 precision — it imports
   stagePowerTextFor only): the implementer ADDS the import and the
   Object.values(...) wrap — s.stages (the Record) is in scope at
   App.tsx:419; the array wrap is new one-line code.
4. activeStageId ALWAYS resolves (store invariant, store.ts:168-170,
   r1 cite fix) — TITLE never needs a fallback.
5. index.html is the only HTML shell (verified); fonts need no Vite
   config (public/ assets serve verbatim, the bundled-docs precedent).
6. Smoke-churn surface (r1+r2 CORRECTED): App IS rendered once via
   renderToStaticMarkup at smoke.test.tsx:449, but on the
   catalog-initializing path (the :446-448 comment) — the connected
   header/wordmark/toggle are never reached and the sole App assertion
   is `not.toContain("bp-svg")` (:450), so the wordmark + toggle-label
   changes break ZERO assertions (verified: no header string pins
   exist anywhere in the suite). The only at-risk pin is the Legend
   swatch COUNT (:650, `.toBe(6 + 2 + 2)`) — churns only if the
   swatch class/count changes. TitleBlock coverage is ADDED, not
   churned. The suite is ~825 lines. Keep node tests off the connected
   App path.

## Revision history

- v1 (2026-08-05): initial, grounded in this session's reads of
  app.css (:root + dark mechanism), App.tsx (header/footer/plumbing),
  index.html, ChainBlueprint:291-306 + GraphCanvas:211-213
  (chainPowerText), smoke.test.tsx posture, and the #42/#43 decisions.

- v2 (2026-08-05): dual-review r1 — [code-reviewer] APPROVED_WITH_NITS
  (1 IMPORTANT + 3 NITs); [adversarial-reviewer] NEEDS_REWORK (1 HIGH
  + 1 MEDIUM + 2 LOW). All folded:
  - HIGH: the vellum orange #E8722D computed 2.51:1 — FAILING the
    design's own 3:1 gate for display text + non-text contrast. Team
    lead recomputed candidates: vellum --accent is now #C25A1D
    (3.62:1; 4.4:1 under white text; #A64A16 as accent-strong at
    4.79:1); #E8722D demoted to fill-under-light-text only. Supersedes
    the #42 hex for the vellum medium (recorded).
  - MEDIUM: the React Flow --xy-* stylesheet gap made explicit — P0
    accepts stock RF canvas chrome; P1 re-skins via --xy-* overrides;
    the "app-wide" claim scoped honestly.
  - LOWs: the double-frame mechanic named for real (outline +
    outline-offset -4px; the 16px content inset preserved); assumption
    #6 rewritten to the ACTUAL churn surface (no header pins exist;
    one Legend count pin; suite is 783 lines; never render connected
    App in node); activeStageId cite fixed (:168-170); the
    chainPowerText import-must-be-added note.
  Verified clean by the reviewers: the hardcoded-hex sweep (zero
  literals outside the token blocks + the data-driven colors.ts set),
  all other contrast pairings (computed, all passing), no-plan-cursor,
  Legend props compatibility, the theme mechanism, public/fonts
  precedent, behavior-frozen soundness.
- v2-r2 (2026-08-05): scoped re-check — [code-reviewer]
  APPROVED_WITH_NITS (3 precision nits, folded: the 783 figure was the
  non-blank count, restored ~825; the App-not-rendered phrasing made
  precise — it renders the catalog-initializing path with one non-pin
  assertion; the Object.values wrap named as new code). All
  substantive folds independently recomputed CLEAN: the four WCAG
  ratios exact, the RF --xy-* claims match the stylesheet, the
  outline-offset -4px geometry yields the stated 3px gap.
  [adversarial-reviewer] APPROVED_WITH_NITS (1 — the settled block
  restated #E8722D without a supersession marker; folded, plus the
  FEATURE.md follow-up noted). Both r1 findings independently
  recomputed CLOSED. Correctness CONVERGED.
- v3 (2026-08-05): simplify pass (one-shot, post-convergence)
  APPROVED_WITH_NITS (4, ALL FOLDED): --ink dropped (pure alias);
  --grid-line + --stamp deferred to P1 (land with their first
  consumer); --sheet dropped (--bg IS the sheet); --frame-gap inlined
  (one literal, one site). Affirmed without change: the four font
  files (weight contrast is real — faux-bold would be
  wrong-because-simpler; implementer confirms each weight has a CSS
  consumer before committing the file), the five title-block cells
  (REV-as-print-date is honest zero-state information), the
  two-border-role split (the one new token that clearly earns it),
  the re-value spine, the RF fence, the deferral set. FROZEN.
