# Stage 10 / Phase 1 — resizable canvas + flow direction (ticket #51) — brainstorm v3 (FROZEN)

*Cite shorthand: `store.ts` = src/state/store.ts · `graph-flow.ts` /
`app.css` / `GraphCanvas.tsx` = src/ui/… · `plan-store.ts` =
src/data/plan-store.ts · `index.mjs` = node_modules/@xyflow/react/dist/esm/
(r2 nit — basenames disambiguated once here).*

**Goal.** Michael's ask, verbatim: "the graph area needs to be bigger and
resizeable and give the option of making the flow chart go left to right or
top to bottom." Three deliverables: a bigger default canvas, user resizing,
and an LR/TB flow-direction option that drives handles + auto-placement while
user-positioned nodes stay put.

## Already settled — do NOT re-litigate

- Stage 9 identity binds: tokens/names, radius-0 chrome, the dimension-tick
  marker idiom, both-media walks. Stage 10 P0 base control rules bind.
- Epic #48 decisions: opus implementer, all-Claude roster, full gate; this
  phase is NOT behavior-frozen (real behavior + tests expected); P2 (#50
  spacing) runs after this phase.
- The semi-controlled RF model (S3P2 frozen): structure derives from the
  store via `graphToFlow`; RF owns only interim drag frames; drag-END commits
  once to `setStagePosition`. Nothing here reopens that.

## Axis 1 — bigger + resizable: a pure CSS seam

**Pick: CSS-only. `.graph-canvas` goes from the fixed 340px strip to
`height: 560px` default with `resize: vertical`, `min-height: 340px`,
`max-height: 85vh`, and `border-radius: 0` (folding a Stage 9 straggler —
app.css:789 still carries `border-radius: 6px`, the app's last rounded
chrome). No drag-handle component, no JS, no persistence of the chosen
size (session-only, browser-native).**

- Grounded: CSS `resize` requires `overflow` ≠ visible — `.graph-canvas`
  already has `overflow: hidden` (app.css:790). React Flow observes its
  wrapper with a ResizeObserver (`@xyflow/react` index.mjs:1273
  `updateDimensions`; `@xyflow/system` index.mjs:2917 pane-extent refresh),
  so the pane tracks the user's resize live — no wiring needed.
- Width stays governed by the `.app` 1024px column — widening the whole app
  re-flows every surface and belongs to the P2 spacing audit if Michael wants
  it, not here (recorded non-goal).
- The native corner grip is the resize affordance; `color-scheme` (P0) keeps
  it medium-tracked. No custom grip drawing.
- **Grip-occlusion risk (r1 adversarial — named, mitigated, walk-gated):**
  RF's root pane absolutely fills `.graph-canvas` (base.css:66-69) and the
  chain-power `<Panel position="bottom-right">` (GraphCanvas.tsx:493-497)
  renders in the same corner the browser paints the grip. Mitigation: the
  power panel gets a corner inset (margin keeping it clear of the ~16px grip
  square), and the walk asserts an actual GRIP DRAG with RF mounted and the
  power panel present — not just "grip visible". If the drag proves
  unreachable through RF's overlay live, the recorded fallback is a thin
  dedicated bottom seam handle — a design change to escalate, not silently
  ship.

## Axis 2 — where the direction preference lives: store field, persisted per-plan (file v5)

**Pick: `flowDirection: "LR" | "TB"` on the store's graph slice, default
`"LR"` (today's implicit orientation). It persists PER-PLAN in the plan
file — save writes `format_version: 5` with a top-level `flowDirection`
field AND an optional per-stage `userPlaced?: true` flag (r2 adversarial
IMPORTANT — see Axis 3); load restores both; v1–v4 files migrate with
`"LR"`.**

- Why per-plan and not app-level (the theme precedent): saved positions are
  already direction-SHAPED — a TB-laid chart saved to file and reloaded
  must come back TB, or the chart renders its vertical layout with
  left/right handles (a broken-looking drawing). Orientation is a property
  of the drawing, like positions; theme is a property of the viewer.
- Why a v5 bump and not v4-in-place (the field is optional-shaped): the
  twice-recorded precedent (plan-store.ts:18-23, v4's own header) — an old
  build's v4 validator would accept the file and SILENTLY DROP the user's
  direction, rendering a TB-positioned chart with LR handles. The bump makes
  the old build reject loudly instead. Save-writes-latest is the accepted
  cost, exactly as v3→v4.
- Store stays window-free (headless node tests): no localStorage read for
  this field — the plan file is its only persistence.

## Axis 3 — direction mechanics: handles, placement, the switch

**Handles.** `stageHandles()` (graph-flow.ts:154) and the `StageNode`
`<Handle>` pair (GraphCanvas.tsx:93-94) both hardcode left/right. Both take
the direction: LR = target left / source right (today), TB = target top /
source bottom. `graphToFlow` gains a `flowDirection` parameter so the
node-side `handles` geometry (which RF uses for handleBounds — no DOM
measurement) matches the rendered Handle elements exactly; StageNode reads
the direction from the store (`useAppStore(s => s.flowDirection)`) — no
per-node data churn. Edges re-route automatically (bezier endpoints follow
handle positions); the dim-tick marker is `orient="auto"` and follows.
**`flowDirection` MUST join the `derived` useMemo's dependency array
(GraphCanvas.tsx:239-247) alongside becoming a `graphToFlow` argument (r1
code-reviewer IMPORTANT): a fully user-dragged plan or a pinned v1–v4 load
toggles with ZERO position change (r3 wording — v5 auto stages DO re-grid,
below), and in that zero-delta case, without the dep, the memo never
recomputes and the node-side `handles`
geometry — RF's handleBounds source — stays on the old sides while the
rendered `<Handle>` elements flip. The dep is the whole fix.**

**Viewport re-frame (r1 adversarial MEDIUM — fitView is initial-only).**
The static `fitView` prop only seeds the initial fit (`fitViewQueued`,
index.mjs:3328, fired once at :3407) — after a direction switch transposes
the layout 90°, the viewport would stay on the old coordinates with nodes
scrolled out of frame. Fold: a tiny child INSIDE the RF tree (the toggle's
own component) runs `useReactFlow().fitView()` in an effect keyed on
`flowDirection` — the effect fires after the commit that rendered the
re-slotted positions, re-framing the chart. Walk-asserted in both media.

**Auto-placement.** `placementSlot(seq)` (store.ts:782) gains the direction:
LR keeps today's grid (4 columns 260 apart, rows 140 apart — reading order
right-then-wrap); TB transposes it (4 rows down, columns wrap:
`x: 40 + floor(seq/4)*260, y: 40 + (seq%4)*140`) so a growing chain flows
downward. **FOUR call sites thread it (r1 code-reviewer — the body said
three while the ledger said four; four is correct):** `addStage`
(store.ts:1260), initial-stage seed (store.ts:946), the chain builder's
`applyProposalToSlice` (store.ts:733), and the `rebuildFromPlan` fallback
(store.ts:627) — the load path, which slots a v1-migrated positionless
stage and must use the FILE's direction.

**The switch (the one destructive-risk fork).** Epic decision: "node handle
positions + auto-placement orientation; user-positioned nodes stay
user-positioned." Mechanism:

- New store field `userPlaced: Record<stageId, true>` — set by
  `setStagePosition` (the drag-END commit, store.ts:1406), pruned with the
  stage on remove, and seeded by `rebuildFromPlan` AT LOAD (r1 adversarial
  — after :627 every stage has a position, so the distinction is
  unrecoverable from the positions map later).
- **The flag PERSISTS in the v5 file (r2 adversarial IMPORTANT — the v2
  not-persisted design had a save→load hole): save writes `position`
  unconditionally (store.ts:1464 — exact-restore is right and stands), so
  without a persisted flag every re-saved auto slot would seed as
  user-placed on the next load, permanently exempting auto nodes from the
  direction switch after one round-trip. The v5 stage entry therefore
  carries `userPlaced?: true` (written only for user-placed stages); a v5
  load seeds the store set from the flag. For v1–v4 files (no flag), the
  seeding falls back to `entry.position !== undefined` — old saves' layouts
  are conservatively treated as intent (pinned), the stated cost of not
  scrambling a pre-v5 layout on switch; a v1-migrated positionless stage
  auto-slots and stays auto.**
- `setFlowDirection(dir)`: writes the field; re-slots every NON-userPlaced
  stage to `placementSlot(orderIndex, dir)` by its `stageOrder` index
  (original seqs aren't retained; order-index re-gridding is deterministic,
  compacts removal gaps, and only ever touches nodes the user never moved);
  userPlaced stages keep their exact positions. No derive, no
  reconciliation — positions are presentation (the cadence row precedent,
  store.ts:1406-1410).
- Same-direction set is a no-op.

## Axis 4 — the direction control

**Pick: a compact toggle button in the canvas's existing top-left RF
`<Panel>`, next to `＋ stage` (GraphCanvas.tsx:488-492): label `FLOW L→R` /
`FLOW T↓B` (click toggles; title text spells it out). It wears the P0 base
button look unmodified — no new CSS beyond, at most, joining
`.graph-add-stage`'s layout-only rule.** The canvas panel is the closest
chrome to the thing the control changes; the header stays reserved for
app-level controls (theme, upload).

## Axis 5 — non-goals

- No app-column widening (1024px stands; P2/observed follow-up if asked).
- No persistence of the user's resized height; no custom resize grip.
- No auto-layout/re-layout button beyond the direction switch's re-slot;
  no dagre/elk; no edge-type change (bezier stands).
- No per-node direction, no RL/BT directions — exactly the two Michael
  named.
- No behavior change to links, solving, reconciliation, transport, or the
  SVG views (Schematic/Blueprint are unaffected by canvas direction).

## Test plan sketch

Real behavior — real tests (bidirectionality log required):

- store: `setFlowDirection` transposes non-userPlaced positions by order
  index, preserves userPlaced ones, no-ops on same direction;
  `setStagePosition` marks userPlaced; remove prunes it; `placementSlot`
  TB arm; builder apply under TB.
- plan-store: v5 round-trip carries `flowDirection` AND per-stage
  `userPlaced`; a new `migrateV4` step joins the `migrateV1→V2→V3` chain
  (plan-store.ts:196-271) defaulting `flowDirection: "LR"` (r3 — the chain
  step named, not just the endpoint); v5 validator rejects a malformed
  direction value and a non-`true` `userPlaced`.
- save→load→switch cycle (the r2 hole, now a pinned test): an auto-placed
  stage saved and reloaded (v5) STILL re-grids on a direction switch; a
  dragged stage saved and reloaded stays pinned.
- graph-flow: `graphToFlow` emits top/bottom handle geometry under TB,
  left/right under LR (existing pins stay).
- rebuild-on-load: `userPlaced` seeded from the v5 flag, or from
  `entry.position !== undefined` for v1–v4 files (a pre-v5 positioned
  stage is NOT re-slotted by a subsequent switch; a v1-migrated
  positionless stage IS, and its load-time slot used the file's
  direction).
- smoke: unchanged posture (SSR-string; no jsdom) — the toggle button
  appears in the canvas markup.
- Both-media walk: an actual GRIP DRAG with RF mounted + power panel
  present (not just visible — the occlusion risk in Axis 1), RF tracks the
  new size; toggle direction on a mixed chain (auto nodes re-grid, a
  hand-moved node stays, edges + dim-ticks re-route, **the viewport
  re-frames via the fitView effect**); save/load round-trip restores
  direction; `＋ stage` and builder apply place correctly in TB.

## Assumptions ledger

1. RF tracks container resize natively — verified this session
   (`@xyflow/react` index.mjs:1273 ResizeObserver → updateDimensions;
   `@xyflow/system` index.mjs:2917).
2. `.graph-canvas` has `overflow: hidden` + `border-radius: 6px` today
   (app.css:785-792, read this session) — resize works under hidden;
   radius-0 fold is real.
3. Handles hardcoded left/right in exactly two places: `stageHandles()`
   (graph-flow.ts:154-176) and StageNode (GraphCanvas.tsx:93-94) — read
   this session.
4. `placementSlot` call sites — FOUR: store.ts:627 (rebuild fallback),
   :733 (builder apply), :946 (seed), :1260 (addStage — the
   `placementSlot(s.placementSeq)` call line; r1 fixed the body's :1258
   off-by-two) — grep this session. The rebuild fallback (:627) uses the
   FILE's direction for a v1-migrated positionless stage.
5. Plan file is at v4; the bump-on-silent-drop rationale is recorded at
   plan-store.ts:18-23. Save-writes-latest, read-accepts-all is the
   standing migration posture.
6. Plans saved before v5 have no direction → migrate as `"LR"`, which is
   exactly how they were laid out.
7. RF's `fitView` prop is initial-only: it seeds `fitViewQueued`
   (index.mjs:3328) consumed once at :3407 — r1 adversarial, verified
   against RF 12.11.2 source. Subsequent bulk position writes do NOT
   re-frame; hence the effect-keyed imperative `fitView()` in Axis 3.
8. `useReactFlow` is callable from any component inside the `<ReactFlow>`
   tree (RF wraps children in its own provider — index.mjs:3706/:3718,
   r2-verified); the toggle lives in an RF `<Panel>`, satisfying this.
9. The save path writes `position: s.positions[id]` unconditionally for
   every stage (store.ts:1464, verified this session) — the premise of the
   v5 `userPlaced` flag: position-presence alone cannot survive a
   round-trip as an auto-vs-user signal.

## Revision history

- v1 (2026-08-05): initial, grounded in this session's reads (GraphCanvas,
  graph-flow handles, store placement/positions, plan-store versions,
  app.css canvas rule, RF ResizeObserver internals).
- v2 (2026-08-05): dual-review r1 — BOTH NEEDS_REWORK ([code-reviewer]
  2 IMPORTANT + 1 confirmed-correct NIT; [adversarial] 2 MEDIUM + 1 LOW +
  1 TRIVIAL), zero contradictions; all folded:
  - `flowDirection` added to the `derived` useMemo deps (the loaded-plan
    toggle changes no position → stale handleBounds without it).
  - Call-site count corrected to FOUR (the :627 rebuild fallback is on the
    load path); addStage cite fixed :1258→:1260.
  - fitView is initial-only (verified index.mjs:3328/:3407): an
    effect-keyed imperative `fitView()` inside the RF tree re-frames on
    direction switch; walk-asserted.
  - Grip-occlusion risk named + mitigated (power-panel corner inset; walk
    asserts a real grip DRAG; dedicated-seam fallback recorded as an
    escalation, not a silent ship).
  - `userPlaced` load-seeding made explicit: `rebuildFromPlan` seeds from
    `entry.position !== undefined` (the distinction is unrecoverable after
    :627 writes the positions map).
  Both reviewers independently verified all v1 citations accurate and the
  v5-bump rationale sound against the recorded v4 precedent
  (plan-store.ts:18-23, version-exact validators :392-438).
- v3 (2026-08-05): dual-review r2 — [code-reviewer] APPROVED_WITH_NITS
  (1: ledger numbering, folded); [adversarial] NEEDS_REWORK (1 IMPORTANT +
  2 NITs, all folded):
  - **The save→load hole (IMPORTANT, source-verified store.ts:1464):** the
    v2 "not persisted" userPlaced design broke after one round-trip — save
    materializes every auto slot into a file position, so the next load's
    position-presence seeding pinned auto nodes forever. Fold: the v5
    stage entry carries `userPlaced?: true`; v5 loads seed from the flag;
    v1–v4 loads keep the conservative position-presence fallback (stated
    cost: pre-v5 layouts load pinned). Save still writes positions
    unconditionally — exact restore stands.
  - Ledger fixed: the v2-added items 7–8 re-appended in order (the r2
    numbering nit) and the new item 9 (the store.ts:1464 save premise)
    added; cite basenames disambiguated once in the header note.
  r2 confirmed sound under refutation: fold 3's fitView timing
  (StoreUpdater's prop-effect precedes the toggle child's effect; the fit
  itself defers through the node queue + RAF and reads nodeLookup fresh —
  index.mjs:1208, :949-983, :3353-3372) incl. the zero-position-delta
  toggle case; assumption 8's implicit provider (:3706/:3718); all four
  placementSlot sites; the TB transpose; the memo-dep fix's resync path
  (reference-identity at GraphCanvas.tsx:306, merge takes derived
  handles).
- v3-r3 (2026-08-05): scoped re-check — BOTH APPROVED_WITH_NITS
  (correctness CONVERGED). [code-reviewer] 1 NIT (revision-history wording,
  folded); [adversarial] 2 NITs (folded: the stale line-92 "every loaded
  stage is userPlaced" parenthetical — falsified by the v3 flag design
  itself, replaced with the zero-delta wording; the `migrateV4` chain step
  named in the test plan). The flag verified as a stable fixpoint across
  repeated cycles, remove/re-add, builder stages, and interleaved
  switches; the v1–v4 pinning cost affirmed as stated-not-hidden; the
  direction switch's direct position write confirmed to never pollute the
  userPlaced set.
- v3-simplify (2026-08-05): one-shot simplify pass APPROVED_WITH_NITS
  (2, dispositioned): (1) the pre-named grip-fallback mechanism ("thin
  dedicated bottom seam handle") flagged as mitigation-for-a-mitigation
  ahead of walk evidence — REJECTED with rationale: it is one sentence
  recording the candidate escape hatch; the walk remains the only gate
  either way, and if the walk fails in a later session the recorded
  candidate spares rediscovery — removing it saves nothing and loses
  context (the reviewer itself rated fold-or-reject "a coin toss").
  (2) density observation — reviewer-stated no-action. All five probes
  otherwise affirmed minimal: the v5 bump is the standing v3→v4 idiom, the
  persisted flag is FORCED by store.ts:1464 (verified), the fitView effect
  child is the idiomatic minimum for an imperative post-commit fit, the
  test plan maps 1:1 to introduced mechanisms. FROZEN.
