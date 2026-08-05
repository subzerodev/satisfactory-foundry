# Stage 9 / Phase 1 — canvas as a drawing: plates, dimension lines, stamps (ticket #45) — brainstorm v3 (FROZEN)

**Goal.** The graph canvas joins the drawing: stage nodes read as machine
plates, edges as dimension lines, problem labels as inspection stamps,
and the React Flow chrome takes the medium's colors — closing the
P0-recorded stock gap.

## Already settled — do NOT re-litigate

- #42/#43/P0 decisions bind: the two media's token values (vellum accent
  #C25A1D; cyanotype #F5913E; stamp reds = the re-valued --error), the
  existing token names as the identity's API, behavior-frozen
  (presentation only; graphToFlow, edge label STRINGS, selection
  semantics, interactions unchanged; 706 suite green modulo literal
  pins), stamp intensity tunable at THIS phase's design, both-media
  walks.
- StageNode's structure is frozen S3 work: the head (rename-able name,
  remove ✕), recipe line, foot (machines ×N, findings count, power) —
  P1 re-CLOTHES this markup, never re-architects it.
- All-Claude roster; opus implementer; full gate.

## Axis 1 — machine plates: CSS on the existing StageNode classes

**Pick: the plate treatment is (almost) pure CSS on the existing
`.stage-node*` classes: the card loses its rounded-card look for a
square-cornered PLATE — 2px ink border, --bg-panel fill; the head strip
becomes the plate's NAME BAR (--font-display, letter-spaced, uppercase
via CSS text-transform — the DOM text is untouched so no literal pin
churns; a hairline --border-soft rule under it); recipe + foot lines go
--font-mono-num; the power line reads as plate data. `.selected` keeps
the accent outline idiom (accent 2px). `solve-invalid` keeps its error
tint; `solve-idle` its muted tint — re-expressed in medium values.**

- Why CSS-only: every plate element already has a named class
  (stage-node-head/-name/-recipe/-foot/-machines/-findings/-power,
  verified GraphCanvas.tsx:88-155). Zero markup change ⇒ zero smoke
  churn, behavior-frozen by construction. ONE allowed markup exception:
  none needed — even the uppercase is CSS.
- Corner bolts / rivet dots are REJECTED (decoration that reads as
  theme-park; the mockup's plates were plain bordered rectangles).

## Axis 2 — dimension-line edges: canvas-level options + CSS, zero graphToFlow change

**Pick: edges become thin ink dimension lines with TICK ends. Mechanics:
(a) stroke/label styling via CSS on the existing per-state classes
(edge-ok/-under/-over/-dangling, GraphCanvas.tsx:167-172) — ink-colored
1px stroke for ok (state colors stay semantic: under=stamp red,
over=muted, dangling=notice); (b) the tick END via ReactFlow's
`defaultEdgeOptions={{ markerEnd: "dim-tick" }}` — END ONLY (simplify
fold, v3: these are DIRECTED flow edges; the terminal tick marks the
consumer end, which is what a supply link is — the both-ends drafting
metaphor spent a second marker on the metaphor, not the data; a start
tick is a walk-gated addition if the single end reads unfinished)
— the BARE marker id, r1 fix: RF wraps string markers in `url('#…')`
ITSELF (react index.mjs:2955-2956; getMarkerId passes strings verbatim,
system index.js:1465-1466), so a pre-wrapped url() would double-wrap
dead. Verified r1: defaultEdgeOptions MERGES under every controlled
edge ({ ...defaultEdgeOptions, ...edge }, react index.mjs:2911), and
string markers get NO auto-def (createMarkerIds is object-markers-only)
— GraphCanvas renders the ONE custom def (a short 45° tick) in a
hidden <svg><defs> block;
(c) the edge LABEL becomes the dimension text — transparent label
background, --font-mono-num, ink color, positioned as today (RF
default).**

- Why defaultEdgeOptions and not graphToFlow: graphToFlow is pure +
  pinned by its own suite — its OUTPUT SHAPE must not change
  (behavior-frozen). defaultEdgeOptions merges presentation defaults at
  the canvas layer; the marker def is chrome, not data. (The prop shape
  is SETTLED at r1 — no drift-hunt item remains; the citations are in
  the pick above.)
- The tick markers use `stroke="context-stroke"`? NO — context-stroke is
  unreliable cross-browser; the marker uses currentColor/var(--fg) with
  the state classes overriding marker color being IMPOSSIBLE per-state
  via one def — accepted: ticks render in ink for ALL states (the LINE
  carries the state color; the ticks are the dimension convention).
  Recorded as the honest compromise; if the walk shows it reads wrong,
  the fallback is two defs (ink + stamp) switched per-state by class —
  decided AT THE WALK, not speculatively built.

## Axis 3 — inspection stamps: the under-supply label treatment

**Pick: `.edge-under`'s LABEL gets the stamp treatment. MECHANICS
(r1 precision — the RF label is SVG, not HTML: a <g> holding
<rect.react-flow__edge-textbg> + <text.react-flow__edge-text>, react
index.mjs:2512): the "border" is `stroke: var(--error); stroke-width: 2`
on the rect, the "fill" is SVG `fill: var(--bg)` on the rect, the text
`fill: var(--error)` (uppercase via text-transform — applies to SVG
text). The -2° ROTATION must NOT sit on the <g> (RF sets an inline
translate there — a CSS transform would clobber the positioning, r1
trap): it goes on the rect + text with `transform-box: fill-box;
transform-origin: center; transform: rotate(-2deg)` on BOTH (simplify
fold, v3 — the r2 adversarial pass PROVED the centers coincide: the
rect is built symmetrically around the text bbox, so per-element
centers register exactly; the implementation carries a one-line
why-comment recording that proof, and the shared-explicit-origin form
is the parked fallback if any RF geometry change ever breaks the
symmetry). `.edge-dangling`
gets the un-rotated note shape: --notice STROKE on the rect (non-text
3:1 — #8A5A2A/vellum computes ~4.79:1 (r2 recompute), passes non-text) with the TEXT
in --fg ink (r1 contrast fold — notice-colored text would sit below
AA-normal on vellum; ink text + notice box passes everywhere). ok/over
labels stay quiet dimension text (ink fill, transparent-ish rect).
Selected-edge labels keep their emphasis idiom in medium values.**

- Intensity (the #42 tunable, decided here): the MOCKUP's rotated-stamp
  look, but restrained — rotation only on under-supply (the true
  violation), no border texture, no stamp on nodes (node findings stay
  the count badge). The browser walk in both media is the calibration
  gate; the rotation is one CSS line to drop if it reads gimmicky live.
- Behavior-frozen: the label STRING is untouched (the S6 wording);
  only its box is dressed.

## Axis 4 — the RF chrome: --xy-* per medium + a lined grid

**Pick: app.css's two token blocks gain the --xy-* overrides (plain
custom properties RF reads — names SETTLED at r1 against
dist/style.css, no drift-hunt item remains):
--xy-background-pattern-color (the single hook all three pattern
variants read, style.css:389-405), --xy-edge-stroke (:138-139) + -selected (:181, r2 cite fix), --xy-edge-label-color + -background-color (:620-624),
--xy-controls-button-* (bg/color/border),
--xy-attribution-background-color (:318 — the -color suffix, r1 fix)
— valued per medium (faint ink on vellum; pale line on cyanotype).
There is NO minimap in the app (r1 catch — GraphCanvas mounts
Background + Controls + Panels only, :443-459): all minimap
references are DROPPED; adding one would be behavior, out of charter. The Background
component switches from dots to LINES variant (gap ~24, the graph-paper
grid of the mockup) — a component-prop change in GraphCanvas, canvas
chrome not data. The `colorMode` prop keeps forwarding as today.**

- The controls re-skin is what kills the last stock-looking panel;
  without it the sheet illusion still breaks at the corner.

## Axis 5 — SVG views: NOT this phase

The schematic/blueprint/combined SVGs already re-valued through the P0
tokens (surface-fill/foundation/bus/junction are medium-tinted). Their
drawing-refinements (foundation grid weight, seam styling, site
label type) are P2 polish — recorded, out of P1. P1 touches ONLY the
RF canvas layer.

## Axis 6 — non-goals

- No markup changes to StageNode (CSS-only re-clothing); no new
  components; no graphToFlow/edge-data changes; no label-string changes.
- No node stamps, no rivets/bolts/textures, no drop shadows (the
  drawing is flat ink).
- No motion (no stamp-thunk animations — reduced-motion has nothing to
  gate; recorded again).
- No controls REMOVAL (chrome re-skins, the feature stays); no
  minimap ADDITION (none exists — r1).
- No SVG-view work (Axis 5).

## Test plan sketch

Node tests: none beyond the existing suite (the phase is CSS + two
canvas-level props; graphToFlow's suite pins the data unchanged; any
literal pin that churns is enumerated). The marker-def block, if it
renders as a component fragment, gets ONE smoke row (defs present).
R2 log covers any new testable surface (expected: the defs row only —
CSS values are walk-gated). Both-media browser walk: plates (border,
name bar, mono data) in vellum + cyanotype; dimension ticks on edges;
an under-supplied link showing the rotated stamp label; dangling's
un-rotated ink-text/notice-box note; lined grid + re-skinned controls;
selection
idioms intact; drag/connect/select interactions unchanged; contrast
spot-checks on the stamp label in both media.

## Assumptions ledger

1. StageNode markup + classes verified this session (GraphCanvas.tsx:
   75-161); EDGE_CLASS states :167-172; colorMode prop :180-184.
2. SETTLED at r1 (both reviewers, against installed RF 12.11.2
   source): defaultEdgeOptions merges under controlled edges
   (index.mjs:2911); string markers pass the BARE id (RF url()-wraps,
   :2955-2956; no auto-def for strings). The state classes style the
   edge PATH today (app.css:811-822) — the label-box CSS is NEW
   SVG-targeted work (stroke/fill on textbg/text, the fill-box
   rotation), not parity.
3. The --xy-* vars are the RF style surface (verified at the P0
   boundary — dist/style.css uses var(--xy-..., default) chains
   overridable from app CSS).
4. Uppercase via text-transform does not change DOM text — no test
   pin can see it (SSR markup carries the original casing).
5. SETTLED at r1: GraphCanvas renders a bare <Background /> today
   (:443, dots default); variant="lines" + gap are real props
   (RF index.mjs:4409-4432).

## Revision history

- v1 (2026-08-05): initial, grounded in this session's reads of
  GraphCanvas.tsx (StageNode classes, EDGE_CLASS, colorMode), the P0
  boundary's --xy-* verification, and app.css's stage-node/edge blocks.

- v2 (2026-08-05): dual-review r1 — BOTH NEEDS_REWORK
  ([code-reviewer] 2 IMPORTANT + 2 NITs; [adversarial] 1 IMPORTANT +
  2 NITs), heavily overlapping and mutually confirming; all folded:
  - The marker form corrected to the BARE id (RF url()-wraps strings
    itself — a pre-wrapped url would double-wrap dead); the merge-into-
    controlled-edges question the adversarial was sent to break was
    REFUTED in the design's favor (index.mjs:2911) and is now cited.
  - There is NO minimap (conformance catch) — all references dropped.
  - Axis 3 rewritten in SVG vocabulary (stroke/fill on the textbg
    rect + text; the inline-translate rotation trap solved with
    fill-box transform-origin on the children, never the <g>).
  - The dangling label re-specced: ink text + notice box (the
    notice-as-text pairing computed ~4.3:1, below AA-normal).
  - --xy-attribution-background-color suffix fixed; the resolved
    --xy names + Background usage cited as settled (off the
    drift-hunt).
  Verified clean: the CSS-only plate claim (all elements classed; the
  exact-case label pins survive text-transform), the stamp contrast
  in both media (--error 4.91/4.64:1), Background variant props,
  behavior-frozen soundness.
- v2-r2 (2026-08-05): scoped re-check — [code-reviewer]
  APPROVED_WITH_NITS (1 judgment IMPORTANT + 1 cite NIT, both folded:
  the rotation now specifies ONE SHARED pivot for rect + text — the
  per-element fill-box centers provably differ, two pivots would
  mis-register the stamp; the -selected stroke cite split to :181).
  All five folds verified citation-exact (marker merge/wrap/no-auto-def
  lines land verbatim; minimap purge clean; --xy names real; residue
  sweep clean). [adversarial-reviewer] APPROVED (it CONSTRUCTED the
  rotation failure case and refuted it — the rect is built
  symmetrically around the text bbox so the fill-box centers coincide
  at (w/2, h/2); the shared-pivot spec stands as the belt-and-braces
  form; its 1 NIT — the ~4.3:1 notice figure understated the real
  ~4.79:1 — folded; it also noted the dangling PATH stroke changes
  error→notice, a within-charter re-color, recorded). Correctness
  CONVERGED.
- v3 (2026-08-05): simplify pass (one-shot, post-convergence)
  APPROVED_WITH_NITS (3): NIT 1 FOLDED — markerEnd only (the start
  tick was metaphor over data on a directed flow edge; walk-gated
  re-addition recorded); NIT 2 FOLDED — per-element fill-box centers
  are PROVEN coincident (the r2 adversarial geometry), so the simple
  form ships with a why-comment and the shared pivot demoted to the
  parked fallback; NIT 3 affirmed (the two-defs fallback is parked
  correctly). Clean probes: one ok/over treatment, every --xy
  override has a consumer. FROZEN.
