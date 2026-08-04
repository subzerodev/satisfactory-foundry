# Stage 7 / Phase 3 — combined multi-stage blueprint (ticket #33) — brainstorm v3-r4 (FROZEN)

**Goal.** One floor-plan view spanning the chain: every solved stage's
blueprint rendered as a site in a shared space, inter-site links drawn with
their transport annotations, and the drawn site-to-site distance offered back
to the P2 transport planner (measure-on-the-blueprint). The S4P2 deferral,
sequenced last so the links it draws are transport-aware.

## Already settled — do NOT re-litigate

- The per-stage layout engine + Blueprint view are frozen S4 contracts:
  `layoutStage(solve, machineId, machineCount, FOOTPRINTS)` → `StageLayout`
  (dm units, machines/lanes/foundations bbox, findings); `Blueprint.tsx`
  deliberately restates render constants rather than widening src/layout's
  contract (S4P2 decision — the combined view must respect the same
  boundary).
- src/layout purity: no state/ui imports (data allowed); plain `number` dm
  math (not Fraction land — layout geometry, not solver rates).
- Transport annotations come from P2's PUBLIC pair — `computeLinkTransport`
  (transport-plan) + `edgeChip` (transport-text) — the same composition the
  private graph-flow `transportChipFor` performs (chips: "· 3 trucks",
  "· ≈ 2×1-car trains"); solved-only discipline. ChainBlueprint composes
  the public pair itself OR graph-flow exports its helper — a mechanical
  call the implementer makes, boundary-reviewed (r1 fold: the private
  helper is not API).
- Station/port power is inspector-only per the P2 decision, with the P3
  revisit hook (Axis 5 takes it up).
- Distance semantics per mode (P2 units trap): road/train ONE-WAY meters,
  drone ROUND-TRIP flight meters. Any measure-feed must map per arm.
- All-Claude roster; full gate; browser walk.

## Axis 1 — site composition: the canvas arrangement IS the site plan

**Pick: derive site placement from the EXISTING graph-canvas positions
(`state.positions`) — no new arrangement UI. A pure `layoutChain` composer in
src/layout scales the canvas arrangement to world dm with the minimal
non-overlap factor.**

```
layoutChain(sites, arrangement) -> ChainLayout
  sites:       { stageId, layout: StageLayout }[]   // per-stage, precomputed
  arrangement: { stageId, x, y }[]                  // canvas px (relative only)
  ChainLayout: { units: "dm", sites: { stageId, origin: Point }[],
                 bounds: Rect, scale: number }
```

- The canvas positions carry the user's INTENT (which site is north of
  which); their magnitudes are px, not meters. The composer normalizes in
  three deterministic steps:
  1. **Coincidence tie-break** (the totality guard): any zero-separation
     cluster (two or more sites on the same canvas point — a reachable
     drag state) is fanned apart FIRST via a GLOBALLY collision-free slot
     sequence in stageOrder — fanned members take successive slots from
     one shared monotonic sequence checked against ALL occupied positions
     (the real placementSlot mechanism), so no fanned member can land on
     another site or another cluster's member: totality closes BY
     CONSTRUCTION (r2 fold), and every pair carries strictly positive
     separation before K is derived. Without this, a coincident pair's
     required K is infinite and "max over pairs" is undefined — the
     r1-caught hole. One stage (or ALL positions equal) still degenerates
     to the horizontal auto-row.
  2. **Minimal scale**: K = max over pairs of (required separation /
     canvas separation), where required separation keeps the two sites'
     foundation-bboxes (inflated by an 8 m gutter — one foundation tile)
     from overlapping; clamp K ≥ K_MIN. Finite by step 1; deterministic.
  3. **Grid rounding**: origins round up to the 1 m grid (`ceilTo10`).
     **Rounding-safety invariant (stated, test-pinned): `ceilTo10` moves an
     origin by strictly less than 10 dm per axis (post-K origins may be
     non-integer, so < 10 dm is the tight bound — r2 fold), and the 80 dm
     per-axis gutter strictly exceeds the worst-case relative drift
     (separating-axis argument: the separating axis keeps ≥ 70 dm), so
     rounding can never re-introduce an overlap step 2 excluded.**
- **Why not auto-tiling**: it discards the user's mental map (the canvas
  IS their arrangement — reuse beats a second layout algorithm).
- **Why not a new drag UI**: P3 would duplicate what the graph canvas
  already does; if users want to rearrange sites they drag the graph nodes
  and the combined view follows live. Recorded as the deliberate scope cut.
- Unsolved/invalid stages: SKIPPED from the composition, listed in a notice
  line ("2 stages not shown — unsolved"); solved-only uniform (S6/P2
  discipline). A skipped ENDPOINT also skips its links.

## Axis 2 — the combined view surface

**Pick: a third app view — `schematic | blueprint | combined` — rendered by a
`ChainBlueprint` component (Blueprint's sibling), one SVG.**

- The existing per-stage view toggle becomes a 3-way; "combined" ignores the
  active stage (whole-chain view). No routing/URL work — the same in-panel
  switch idiom.
- `ChainBlueprint` reuses `Blueprint`'s render vocabulary per site (same
  foundation/machine/lane drawing — extracted into a shared pure render
  helper ONLY if the extraction is mechanical; otherwise each site renders
  via the same SVG conventions restated, mirroring Blueprint's deliberate
  restatement posture — implementation judgment, boundary-reviewed).
- Site chrome: a name label + the stage's power line above each site bbox
  (the S6 card line, same wording).
- viewBox = ChainLayout.bounds + PAD; the Blueprint MAX_SVG_HEIGHT cap idiom
  applies (a chain can be tall — the SVG scales inside the cap).
- **Inter-site links**: a straight connector between the two sites' bbox
  edge midpoints (nearest edges), carrying the P2 chip text as its label
  ("Iron Ingot · ≈ 2×1-car trains") plus the drawn distance ("· 412 m").
  Belt/pipe links solid, vehicle links dashed (mode-class visual only — no
  pathfinding, recorded non-goal). Label text comes from the public
  computeLinkTransport + edgeChip pair + the link item name (no new wording
  vocabulary beyond the distance token; same correction as the settled
  list — the graph-flow helper is private).

## Axis 3 — measure-on-the-blueprint feeds the transport planner

**Pick: the drawn straight-line distance is DISPLAYED on every inter-site
link, and estimated-mode links get an explicit "use drawn distance" action in
the LinkInspector — never an automatic write.**

- Distance = straight line between site bbox edge midpoints in dm → meters
  (÷10, exact integers after grid rounding). It measures the DRAWN plan —
  a lower bound on any real route — so the inspector labels it "drawn
  straight-line — optimistic", stacking with the estimated-basis suffix
  discipline.
- The action writes the P2 raw-text field per the mode's arm: road/train
  `distanceText` = the one-way drawn meters; drone `flightMetersText` =
  2 × drawn meters (round-trip, the P2 units trap honored in ONE mapping
  site). Measured-mode links show the distance readout only (no action —
  a measured time is better information than a drawn line; never downgrade).
- Why explicit-action not auto-sync: arrangement dragging would silently
  rewrite transport inputs (and re-derive fleets) on every pixel move —
  surprising and destructive to hand-entered values. The click is the
  consent. (The P2 "no one-click-apply" rejection was about CHANGING modes;
  filling a numeric field the user explicitly requested is the measure
  feature itself — recorded distinction.)

## Axis 4 — combined-view power footer (the P2 revisit hook)

**Pick: a footer line on the combined view — "Sites Σ X MW · transport
Y MW" (NO merged total: it would sum the ≈-float sites term with the
exact transport term, laundering the float across the labeled boundary —
implementation amendment per the #33 boundary decision, 2026-08-04) —
computed from the existing per-stage power math plus
the P2 station/port power of CONFIGURED links. Chain Σ elsewhere (canvas
panel, SummaryCards) stays stages-only, unchanged.**

- The P2 objection (routes aren't stages) dissolves HERE because the
  combined view shows both sites and routes; the split labeling keeps the
  provenance visible. Exactness split (r1 fold): the TRANSPORT term is
  exact Fraction (station/port constants × integer counts); the SITES term
  follows the existing per-stage discipline — exact at 100% clock,
  labeled-≈ float when any contributing stage is overclocked (the
  advice.ts boundary; chainPowerText is already the ≈ path).
- Transport term: per configured link by mode — train 2×(50+50c) for the
  SELECTED consist? No: P2 computes options, not a selection. A range
  (min..max option)? Honest but uninformative — a ~7× spread carries no
  decision signal next to exact terms (simplify fold, v3). HONEST PICK:
  vehicle-mode links with a single determinate power (truck-likes 40 MW
  both ends; drone 100 MW × nDrones home ports) sum exactly; TRAIN links
  are OMITTED WITH A NOTE — the footer renders
  "transport N MW (+ trains — see per-link)" when any train link exists,
  pointing at the inspector's authoritative cars-vs-trains table. Less
  code, no invented pick, no noise. Belt/pipe contribute 0 (no stations).

## Axis 5 — non-goals

- No pathfinding, no route drawing beyond the straight connector; no
  collision-aware routing between sites.
- No new arrangement/drag UI (the graph canvas owns arrangement).
- No per-site editing in the combined view (click a site → nothing in P3;
  a future affordance could focus that stage — recorded, not built).
- No plan-schema change: the combined view derives everything from existing
  state (positions, solves, links, transport). The distance ACTION writes
  through the existing P2 setLinkTransport path.
- No layout-module contract widening beyond the new pure `layoutChain`
  composer (which imports only layout-internal types).

## Test plan sketch

layoutChain rows: non-overlap guarantee (constructed overlap → K scales it
apart; gutter respected), the COINCIDENT-PAIR-AMONG-MANY row (two sites on
one point, a third distinct → tie-break fans the cluster, K finite,
deterministic), the ROUNDING-SAFETY row (a pair whose post-K gap is exactly
the gutter → rounding does not re-introduce overlap), determinism (same
inputs → same output), degenerate single-site/equal-positions row; distance
math (edge-midpoint
line, dm→m); the drone 2× mapping vs road one-way in the apply action (store
test through setLinkTransport); footer power sums (the determinate
truck/drone terms); solved-only skip + notice; the footer train-note branch
(train link present → the "+ trains" note, no range); ChainBlueprint smoke-level render data
(the canvas-exclusion posture from S4 applies to SVG internals — data pinned
via layoutChain/graph-flow tests, render smoke minimal). The R2
test-bidirectionality log (the workflow's PASS/break/FAIL/restore artifact,
per every prior phase — not a design term). Browser walk: arrange the walk plan's two sites, read the combined
view, apply a drawn distance to the train link, watch the fleet re-derive.

## Assumptions ledger

1. `state.positions` always has an entry per stage (auto-slotted on
   load/create — verified in store source: rebuildFromPlan auto-slots
   missing positions; addStage slots on create).
2. StageLayout.foundations gives the site bbox (origin + cols/rows ×
   FOUNDATION_TILE) — the composer needs only this, not machine internals.
3. The minimal-K computation is exact enough in number math (layout land);
   rounding to the 1 m grid after scaling keeps integers (the ceilTo10
   idiom).
4. The chip behavior ChainBlueprint relies on (belt/unconfigured → "" —
   combined view then shows just the item + distance) is verified in
   source; the REUSE TARGET is the public computeLinkTransport + edgeChip
   pair (graph-flow's transportChipFor is private — r1 fold).
5. The trainOptions rows computed by computeLinkTransport flow ONLY to the
   inspector's cars-vs-trains table (the authoritative per-link surface
   the footer note points at) — the footer itself consumes no train rows
   (r3 fold: the pre-fold "footer range" wording here was residue).

## Revision history

- v3-r3 (2026-08-04): round 3 scoped to the v3 folds — BOTH reviewers
  NEEDS_REWORK on the same two live residues the range fold missed: the
  test-plan clause "incl. the train range bounds" (contradicting its
  neighbor row) and Assumption #5's "trains' footer range". Both fixed:
  the test row now names the determinate truck/drone sums; #5 restated as
  the inspector table being the sole trainOptions consumer. Verified
  clean by both: the note string cannot be misread as a total (the
  parenthetical marks trains as an uncounted addend), the rejected-NIT-2
  rationale grounded (both R2 logs verified real), the r1/r2 set intact.
- v3 (2026-08-04): simplify pass (one-shot, post-convergence)
  APPROVED_WITH_NITS. Dispositions:
  - NIT 1 FOLDED (the reviewer's substantive finding): the footer's train
    power RANGE (min..max ≈ 7× spread) was honest but carried no decision
    signal next to the exact truck/drone terms — replaced with
    omit-with-note ("+ trains — see per-link"), pointing at the
    inspector's authoritative table. Less code, same honesty.
  - NIT 2 REJECTED with rationale (a reviewer misread): "Bidirectionality
    log" in the test plan is the WORKFLOW'S mandated R2 artifact
    (features/<slug> PASS/break/FAIL/restore log, required for any diff
    adding tests — the P1/P2 precedent), not an ungrounded design term.
    The test-plan line now names it explicitly to prevent the same
    misread by the implementer.
  - Affirmed without change: the three-step K composer (explicitly judged
    simpler-correct than rank-into-grid — the grid discards proportional
    arrangement for comparable math), the measure-feed ACTION (display-only
    would cut the deliverable's "feeds" verb), site chrome, scope cuts.

- v1 (2026-08-04): initial, grounded in src/layout + Blueprint.tsx +
  store positions source reads this session.
- v2 (2026-08-04): dual-review r1 folds — [code-reviewer] NEEDS_REWORK
  (1 IMPORTANT + 3 NITs); [adversarial-reviewer] APPROVED_WITH_NITS
  (1 medium + 2 low) — the same four findings, all folded:
  - IMPORTANT/medium (both) — coincident-pair-among-many made the pairwise
    K infinite while the all-equal guard missed it: the composer gains the
    step-1 coincidence tie-break (deterministic per-cluster fan-out in
    stageOrder) before K; test row added.
  - NIT/low (both) — the gutter-absorbs-rounding invariant now stated
    explicitly and test-pinned (ceilTo10 drift ≤ 9 dm < the 80 dm gutter).
  - NIT/low (both) — transportChipFor is graph-flow-private, not API: the
    reuse target corrected to the public computeLinkTransport + edgeChip
    pair (export-vs-compose left as a boundary-reviewed mechanical call).
  - NIT (code-reviewer) — "Exact Fraction sums" overstated the sites term:
    the exactness split now states transport-exact / sites-per-the-existing
    ≈-when-overclocked discipline.
- v2-r2 (2026-08-04): round 2 scoped to the folds — code-reviewer APPROVED
  (0; composer totality + the separating-axis rounding argument verified;
  the post-prompt Axis 2 label fix confirmed); adversarial
  APPROVED_WITH_NITS (2, both folded): the fan-out now uses a globally
  collision-free slot sequence (totality by construction, not per-cluster
  local offsets); the drift bound stated as < 10 dm (tight for
  non-integer post-K origins). Correctness CONVERGED.
  Both reviewers verified clean: the train power range (min..max over
  TrainOption.stationPowerMw, strictly increasing in c), the drone
  portPowerMw × nDrones multiplier, the Axis 3 units mapping + no-downgrade
  rule + one-click distinction, the 3-way view read of App.tsx, and every
  anchor citation.
