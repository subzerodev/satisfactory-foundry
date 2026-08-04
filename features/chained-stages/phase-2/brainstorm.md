# Stage 3 / Phase 2 brainstorm — the canvas (ticket #17, epic #12)

Date: 2026-08-03
Status: v5 FROZEN — correctness converged (r3); simplify dispositioned
Inputs: the landed P1 model (`src/state/store.ts` @ post-P1 develop: stages
map + mirrors, links, reconciliation, cadence helpers; the mirror boundary
amendment), P1 brainstorm (frozen), web grounding: @xyflow/react 12.11.x
(npm), the React Flow zustand controlled-state idiom
(reactflow.dev/learn/advanced-use/state-management), RF12 SSR support
(xyflow.com/blog/react-flow-12-release).

## Already settled — do NOT re-litigate

1. Sequential directive + auto-greenlit gates; all-Claude roster; opus
   implementer for design-judgment work.
2. `@xyflow/react` is the sanctioned library (v1 spec stack rationale) —
   this brainstorm argues the version + integration shape, not the choice.
3. The P1 model is frozen: stages/links/reconciliation shapes, the mirror
   mechanism, the cadence table, addLink refusal rules (self-link,
   duplicate consumer-item), removeStage rules (cascade/cursor/last-stage
   no-op), cycles structurally allowed.
4. Node positions were explicitly NOT in the P1 model; the P1 fold deferred
   the cycle-indicator question to this phase.
5. Testing posture: no jsdom / no browser automation in the suite; pure
   modules + static-markup smoke + team-lead browser walk.

## Axis 1 — Dependency: `@xyflow/react` ^12.11

- **The first runtime dependency added since Stage 0** (react/react-dom/
  zustand). Justification: the graph editor is the arc's deliverable; RF12
  is the mature choice the approved spec names; it uses zustand internally
  (idiomatically aligned).
- Cost accepted: bundle grows (~150KB min+gz class); one global stylesheet
  import (`@xyflow/react/dist/style.css`) from the canvas module. No other
  config or transitive-dep surprises (RF12 is self-contained).
- Version pinned `^12.11` at implementation; the exact resolved version is
  recorded in the completion report.

## Axis 2 — Sync model: fully controlled, store-derived

React Flow renders **derived props, owns nothing**:

- New pure module `src/ui/graph-flow.ts`: `graphToFlow(catalog, stages,
  stageOrder, links, reconciliation, positions, activeStageId) →
  { nodes, edges }` (r1 fold — the CATALOG is a required argument: recipe
  and item display names are `catalog.recipes[id].displayName` /
  `catalog.items[id].displayName` lookups, underivable from the graph
  slice alone). Nodes: id = stageId, `type: "stage"`, `position` from the
  positions map, explicit `width`/`height` + `handles` on the NODE object
  (r1 fold — RF12 SSR needs sized nodes, and node-side handles are what
  enable server-side edge rendering), `data` = {name, recipeName,
  machineCount, solveStatus, findingCount}, `selected` = active.
  **Recipe-less stages (r2 fold):** a stage with `recipeId: null` — the
  default the ＋stage flow itself produces — emits `recipeName: null` and
  the node card renders a "no recipe" placeholder; never
  `catalog.recipes[null]`. Its solve is IDLE (the SolveState union has no
  null; r3 nit); the card blanks machineCount as a display choice (it is
  a selection input, always present) but findingCount still counts
  incident link findings — a persisted link can outlive its endpoint's
  recipe (re-upload #5 nulls recipeIds without pruning links) and its
  dangling-link finding must not be hidden (r3 nit). Edges: id = linkId, source/target = stage ids, label = the item
  displayName + the link's reconciliation state, where (r1 fold — the
  vocabulary maps the REAL reconcile union): absence of a finding for the
  linkId = "ok"; `under-supply` renders the exact shortfall;
  `over-supply` the surplus (muted); `dangling-link` renders per its
  `end`. There is no "ok" finding variant — absence IS ok. Pure,
  node-testable, zero RF imports (plain structurally-typed objects).
- The canvas component (`src/ui/GraphCanvas.tsx`) is the only RF importer:
  `<ReactFlow nodes edges onNodesChange onEdgesChange onConnect
  onNodeClick …>` with a custom `StageNode` card component.
  **Drag mechanics (r1 fold — the applyNodeChanges pin):** the canvas is
  SEMI-controlled per the documented idiom: graph STRUCTURE (node set,
  data, edges, selection) derives from the store via `graphToFlow`, held
  in component state that resyncs whenever the store's graph slice
  changes; `onNodesChange` funnels through **`applyNodeChanges`** into
  that component state — preserving RF's interim positions and `dragging`
  flag per frame — and a position change arriving with `dragging: false`
  (drag END) commits once to `setStagePosition(id, xy)`. The store never
  sees per-frame updates; RF's drag machinery sees exactly the change
  stream it expects. **The resync must not clobber in-flight drag state
  (r2 nit):** a naive `setNodes(graphToFlow(...))` effect would overwrite
  the interim position + `dragging` flag; the resync merges derived
  structure while preserving any currently-dragging node's interim
  position/flag (in practice unreachable mid-drag — single user, and
  `setStagePosition` itself triggers no derive — but the implementer must
  not write the naive form).
  - `onConnect({source, target})` → connect-time picker: the link's
    itemId is the single item the producer outputs that the consumer also
    inputs (`pickLinkItem(producerRecipe, consumerRecipe)` — the caller
    resolves both `CatalogRecipe`s via the catalog first, r1 fold; the
    helper is pure over the two recipes' IO). **If either endpoint's
    `recipeId` is null (r2 fold), the picker is never called: the gesture
    is refused with its own notice class — "that stage has no recipe
    yet" — alongside zero-match/multi-match.** Unique match → the canvas
    first consults **`canLink(state, from, to, itemId)`** (a new exported
    pure READ helper answering "ok" | "self" | "duplicate" from the same
    frozen rules `addLink` enforces — the enforcement itself is unchanged)
    and only then calls `addLink`; ANY refusal class — no-recipe,
    zero-match, multi-match, self, duplicate — sets the notice (r1 fold:
    the silent addLink-refusal path is now covered without touching the
    frozen action). `canLink` and `addLink` live side-by-side in store.ts
    and MUST stay in lockstep (r2 nit — a drift degrades to a stale
    notice, never a bad write, since addLink remains the sole enforcer).
  - **`canvasNotice` semantics (r1 fold):** component-local
    `string | null` (not store — canvas-gesture feedback, meaningless
    headless). The five refusal branches each set their own literal
    message; there is NO modeled class/enum — the branches are real, the
    taxonomy is not (simplify fold). Cleared by the next canvas gesture
    (success or refusal — the uploadError cleared-at-next-op posture). No
    timers.
  - `onNodesChange` selection changes → `setActiveStage`; removals from
    the canvas are DISABLED (deletion goes through an explicit per-node ✕
    with the last-stage rule surfaced as a disabled control — avoids RF's
    batch-delete semantics colliding with the cascade rules).
  - `onEdgesChange` removals → `removeLink`.
- **Positions**: a new `positions: Record<string, {x,y}>` top-level store
  field + `setStagePosition` action (sync, no derive/reconcile — cadence
  row: none/none). **Lifecycle pins (r1 fold):** `removeStage` also
  deletes `positions[id]` (a P2 extension of the action body — the frozen
  P1 cascade/cursor/last-stage rules are unchanged; no orphan entries);
  auto-placement uses a **monotonic `placementSeq` counter** in the store
  (never reused, immune to stageOrder compaction) mapped to a column-flow
  slot (`x = 40 + (seq%4)*260, y = 40 + floor(seq/4)*140`). **No
  collision handling (simplify fold):** monotonic never-reused seq means
  two auto-placed nodes cannot share a slot by construction; the only
  possible overlap is a user-dragged node sitting on a fresh slot —
  cosmetic, immediately draggable, not defended against (the r2-era
  Chebyshev nudge + cap machinery is deleted). Positions are
  session-state this phase; **persisting them is Phase 3's plan-format
  decision** (recorded as deferred, mirroring the P1 links posture).

## Axis 3 — Layout: canvas above, v1 drill-in below

Ready-state layout becomes: header (unchanged) → **GraphCanvas panel**
(fixed-height, ~340px, full width) → the existing v1 surface (ControlsStrip
… FindingsPanel) which already follows `activeStageId` via the mirror.
Clicking a node switches the whole lower surface to that stage — no other
component changes. An "＋ stage" button lives in the canvas corner
(`addStage`); each node card carries ✕ (remove, disabled at one stage) and
an inline rename (double-click name → input, `renameStage`).

## Axis 4 — Cycle indicator: DECLINED (deferred decision resolved)

RF renders cyclic edges without issue; reconciliation is cycle-indifferent
(P1); no user story requires a cycle badge. The P1-deferred question is
answered **no indicator in Phase 2** — revisit only if the polish round
(Stage 5) surfaces a want. Recorded in FEATURE.md.

## Axis 5 — Testing posture (the RF constraint, pinned both branches)

- `graph-flow.test.ts` — the bulk: pure mapping table-driven (node/edge
  emission, labels incl. exact shortfall strings from reconciliation,
  selected flag, auto-placement, dangling styling), node env, no RF.
- Store rows: `setStagePosition` + auto-placement on addStage; the
  connect-time item-match rule (unique/zero/multi) tested as a pure helper
  (`pickLinkItem(producerRecipe, consumerRecipe) → itemId | "none" |
  "ambiguous"` in graph-flow.ts — pure over two resolved CatalogRecipes,
  exercised headless; `canLink` rows: ok/self/duplicate).
- Canvas smoke — **the pinned posture (simplify fold):** the canvas
  component is EXCLUDED from the node-env smoke suite (recorded in the
  test file header); `graphToFlow` carries the render-contract weight and
  the team-lead browser walk is the visual gate. Opportunistic bonus: if
  `renderToStaticMarkup(<GraphCanvas…>)` happens to work in node (RF12
  SSR), the implementer MAY add one smoke row asserting node names/edge
  labels — otherwise nothing changes. Node width/height + handles are
  required by the runtime canvas (controlled layout + edge routing)
  regardless of SSR — they are not SSR-motivated.
- Browser walk (team lead): add stages, draw a link, see reconciliation
  badge change with machine counts, drill-in follows selection.

## Assumptions ledger

1. P1 model shapes as merged this session — grounded (I wrote/reviewed the
   merge).
2. RF12 controlled-flow + zustand idiom — grounded: reactflow.dev
   state-management guide (the documented pattern).
3. Node sizing + handles serve the runtime canvas; RF12 SSR (release
   notes) is opportunistic upside only — nothing load-bearing (simplify
   fold demoted the former attempt-branch).
4. `~150KB` bundle-class estimate — order-of-magnitude from RF docs/npm;
   exact number recorded at implementation (build output).
5. The connect-time unique-item rule operates on the two RESOLVED
   `CatalogRecipe`s (producer outputs ∩ consumer inputs) — the caller
   resolves them via the catalog, which is now an explicit argument
   everywhere names/IO are needed (r1 fold).

## Revision history

- **r1 correctness (2026-08-03):** code-reviewer NEEDS_REWORK (2 IMPORTANT
  + 2 NIT); adversarial NEEDS_REWORK (3 IMPORTANT + 1 NIT). Folded in v2:
  1. **Catalog into the signatures** (both reviewers' root find):
     graphToFlow takes catalog; pickLinkItem takes two resolved recipes.
  2. **applyNodeChanges drag pin** (adversarial): semi-controlled canvas —
     structure store-derived, onNodesChange through applyNodeChanges
     preserving interim positions + dragging; commit on drag-end only.
  3. **Refusal coverage + notice lifecycle** (both): canLink pure read
     helper fronts addLink (enforcement unchanged); canvasNotice
     component-local, cleared-at-next-gesture.
  4. **Positions lifecycle** (adversarial): removeStage prunes
     positions[id]; monotonic placementSeq + 24px collision-nudge.
  5. **Label vocabulary** mapped to the real reconcile union (absence =
     ok); **SSR handles** added to the node emission.
  Cleared r1: dual-selection store-authoritative; SSR honestly hedged;
  CSS import not a crash vector; no frozen-rule violations.
- **r2 correctness (2026-08-04):** code-reviewer APPROVED_WITH_NITS (2
  NIT); adversarial NEEDS_REWORK (1 IMPORTANT + 2 NIT). Folded in v3:
  1. **recipeId:null served** (adversarial IMPORTANT): recipe-less nodes
     emit recipeName:null → "no recipe" placeholder; the connect picker is
     never called on a null-recipe endpoint — new "no-recipe" notice class.
  2. **Resync-preserves-drag pin** (adversarial NIT): the structure resync
     merges around a currently-dragging node; naive setNodes(graphToFlow)
     named as the forbidden form.
  3. **Nudge metric + bound** (both): Chebyshev 24px; monotonic-diagonal
     termination argument + explicit stageCount+1 cap.
  4. **canLink↔addLink lockstep note** (code-reviewer NIT).
  Refuted-and-held r2: overrides cannot alter recipe IO (buildLanes throws
  on non-IO override keys) so two-recipe pickLinkItem suffices when
  recipes exist; handles correctly node-side; no canLink drift risk
  beyond stale-notice.
- **r3 correctness (2026-08-04): CONVERGED** — code-reviewer APPROVED (0);
  adversarial APPROVED_WITH_NITS (2 NIT, one sentence). Folded in v4: the
  recipe-less card's solve is IDLE not null; machineCount blanked as a
  display choice (selection input); findingCount NOT blanked — a persisted
  link can outlive its endpoint's recipe (re-upload #5) and its dangling
  finding must stay visible. Refuted-and-held r3: recipe-less edge/
  drill-in/SSR surfaces all covered by existing vocabulary; Chebyshev
  strict-bound/+24-step exactly right; merge-around-drag coherent.
- **Simplify pass (2026-08-04, one-shot): APPROVED_WITH_NITS (4 NIT).**
  Dispositions:
  1. FOLDED — canvasNotice is plain `string | null`; five refusal
     branches set literal messages, no modeled class/enum.
  2. FOLDED — collision-nudge machinery DELETED (Chebyshev loop, +24
     diagonal, stageCount+1 cap): monotonic placementSeq already
     precludes auto-placement collisions by construction; user-dragged
     overlap is cosmetic and immediately draggable. placementSeq kept
     (compaction immunity is one integer, not machinery).
  3. FOLDED — testing posture: canvas-excluded-from-smoke is THE pinned
     posture; SSR demoted to an opportunistic one-row bonus; node
     width/height + handles re-justified by the runtime canvas, not SSR.
  4. REJECTED with rationale — `solveStatus` stays in node data: it is
     the only carrier of per-stage solve health on the card (findingCount
     counts LINK findings from reconciliation only; an `invalid` solve
     must tint the card distinctly — the card renders it).
  Affirmed already-simple: canLink fronting, label vocabulary, positions
  prune, persistence deferral, cycle declination.
- **v5 FROZEN (2026-08-04)** after a scoped correctness re-check of folds
  2–3 (material deletions; fold 1 is prose).
