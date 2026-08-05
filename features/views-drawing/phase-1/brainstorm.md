# Stage 11 / Phase 1 — visible raw feeds in the chain flow (ticket #57) — brainstorm v8 (FROZEN)

**Goal.** Michael: "it should go to ore or ingot for everything so the
plastic should go back to the oil etc.. needed." Raw extraction inputs
(Crude Oil, Copper Ore, Water, …) become visible in the chain flow with
their exact rates, so a one-craft-step branch reads as complete as a
multi-step one. NOT behavior-frozen — real derive logic + tests.

*Cite shorthand: `graph-flow.ts`/`GraphCanvas.tsx` = src/ui/… ·
`manifold.ts`/`chain-builder.ts` = src/core/… · `store.ts` =
src/state/store.ts · `types.ts`/`docs-loader.ts`/`catalog-store.ts` = src/data/….*

## Already settled — do NOT re-litigate

- The semi-controlled RF model (S3P2), flowDirection/userPlaced (S10P1),
  the drawing identity + P0's treatments. All-Claude roster; full gate.
- The chain BUILDER's raw-leaf semantics (chain-builder.ts selectProducer —
  no qualifying default producer ⇒ raw) are settled and untouched; P1 is
  a DISPLAY feature over the live graph, not a builder change.

## Axis 1 — the shape: DERIVED display-only source nodes (no store, no persistence)

**Pick: `graphToFlow` derives raw-feed source nodes + edges every
render, from data that already exists. Nothing is stored, placed by the
user, or persisted — the plan file is untouched (no v6), `positions`/
`placementSlot`/`userPlaced` are untouched, and the nodes FOLLOW their
consuming stage automatically (their position is derived from the
stage's).** Why not real graph objects: source nodes as store/plan
entities would drag in placement seq, drag semantics, persistence
(a plan-file bump), removal cascades — all for chrome the solve can
re-derive at any moment. The derived shape gives Michael the visual
completeness with zero new state.

**What qualifies (both conditions):**
1. The input item is EXTRACTION-LEVEL by the GAME'S OWN declaration
   (r2 adversarial — BOTH recipe-set heuristics are dead): the item's
   Docs.json NativeClass is `FGResourceDescriptor`. **`CatalogItem`
   gains `isRawResource?: boolean` — OPTIONAL with absent ⇒ non-raw
   (r4 adversarial: a REQUIRED field breaks `tsc -b` across ~7 test
   fixture literals that enumerate CatalogItem fields; the one
   consumer read `?.isRawResource === true` is already
   truthiness-safe, so optional is behaviourally identical, leaves
   every fixture compiling unchanged, and keeps ledger 6's zero-churn
   claim literally true; the docs-loader sets it `true` only for
   FGResourceDescriptor items)** (docs-loader already holds
   `nativeClass` per group, docs-loader.ts:63, in scope through the item branch :66-80 — one added test +
   field); NO parser-version bump (simplify F1 — the optional field makes a
   stale cache SELF-HEALING: absent reads non-raw via the `=== true`
   read, so a pre-flag cache merely shows no feed cards until its next
   natural re-parse — acceptable for display chrome, and strictly
   milder than forcing every user a re-parse and uploaded-Docs users a
   re-upload). Condition 1 is then a direct lookup:
   `catalog.items[itemId]?.isRawResource === true`. Why ground truth
   and not inference: the r1 fold's primary-only Set misclassified
   byproduct-only items (Heavy Oil Residue, rescued only by an
   Unpackage-recipe coincidence), and the r2 fold's all-outputs Set
   mirror-failed on Water (a byproduct of THREE default recipes —
   Aluminum Scrap, Battery, Non-Fissile Uranium — yet unambiguously an
   extraction resource). The game already answers the question; no
   recipe-derived Set can. The builder's selectProducer semantics
   (chain-builder.ts:101-130) are untouched and now genuinely
   independent of P1's display classification.
2. The stage has NO incoming lane for that item (no `StageLink` with
   `toStageId === stage && itemId === item`). A linked-but-under-supplied
   lane is the LANE's story (its finding + inspector) — drawing a raw
   feed beside it would tell two conflicting stories.

**The rate:** the solve's own number — `FeedLaneResult.totalDemand`
(manifold.ts:48-53, exact Fraction, D = N × d, clock-scaled), looked up
from the stage's `solve.result.feeds` by itemId. No new math, no
re-derivation (reuse-first). Unsolved / recipe-less / invalid stages
emit NO raw feeds (the powerText posture — manifold data only exists on
a solved stage).

## Axis 2 — rendering: a compact supply card + dashed feed lane

- **`FlowGraph` gains a SEPARATE `rawFeeds: { nodes, edges }` field**
  (graph-flow.ts:86-112 shapes reused) — NOT appended to the existing
  `nodes`/`edges` arrays, so every existing graph-flow/store pin (node
  counts, edge sets) stays byte-stable.
- **Pipeline placement (r1 adversarial nit — the architecture stated
  ONCE):** rawFeeds live OUTSIDE the `nodes` useState and the
  interim-drag merge entirely — GraphCanvas concatenates them at the
  `<ReactFlow nodes={[...merged, ...rawFeedNodes]}>` prop, AFTER the
  resync/merge machinery (which stays keyed on `derivedNodes` only,
  untouched). Consequences, intended: `nodesRef.current` never
  contains a raw node, so `applyNodeChanges` silently drops any
  `raw:`-targeted change (RF's documented unknown-id behavior); the
  drag-preservation and `measured` logic never sees them (they carry
  node-side dimensions like stage nodes, no DOM measurement needed).
- **Node:** RF type `"rawFeed"`, id `raw:{stageId}:{itemId}`, a compact
  card (~150×44): item name (mono 11px) over the rate line
  (`formatRate(totalDemand)/min`, the app's exact-format idiom), dashed
  1px `--border-soft` frame, `--bg-panel` ground — the drafting
  "supply callout". One `source` handle (right in LR, bottom in TB —
  the stageHandles mirror). Non-interactive via RF's OWN flags (r1
  code-reviewer — the cleaner mechanism than id-prefix filtering):
  the concatenated RF nodes carry `draggable: false, selectable:
  false, deletable: false`, so RF generates no position/select changes
  for them; and because rawFeeds sit outside the `nodes` state (the
  pipeline-placement pick below), `applyNodeChanges` drops any stray
  `raw:` change as unknown-id. The drag-END and select arms
  KEEP the one-line `raw:` id skip (simplify F2 was applied then
  REVERSED by the r6 correctness re-check, source-decided: the commit
  loop iterates the RAW `changes` array — `for (const c of changes)`,
  GraphCanvas.tsx:398 — so the outside-the-state layer never gates the
  setter path; RF's flags prevent change GENERATION at runtime, but
  the skip is the only APP-level guard at the loop boundary and the
  only thing that makes the synthesized-change invariant test
  meaningful). The card renders no controls.
- **Edge:** id `rawedge:{stageId}:{itemId}`, source the feed node,
  target the stage's `in` handle, `className: "edge-raw"` — dashed
  hairline (the pipe-dash vocabulary at a lighter weight), the shared
  dim-tick markerEnd rides along (defaultEdgeOptions). Label: none (the
  card carries item + rate; an edge label would duplicate it).
- **Position (derived, direction-aware):** named constants
  `RAW_NODE_WIDTH = 150`, `RAW_NODE_HEIGHT = 44` (independent of
  `NODE_WIDTH/HEIGHT` — a future stage-size change must not silently
  misalign feeds; r1 nit), and BOTH are set as the RF node objects'
  `width`/`height` fields (r2 nit — fitView and the direction-switch
  re-frame include feed nodes in the bounding box; zero-extent nodes
  would mis-frame). LR: left of the stage — `x = stage.x − 190`
  (card right edge ~40px clear of the 220-wide stage), `y = stage.y +
  i × 54` for the stage's i-th raw feed (54px pitch clears the 44px
  card); TB: above — `y = stage.y − (90 + i × 54)`, `x = stage.x`.
  Derived from the CONSUMING stage's live position each render, so
  feeds follow drags and direction switches for free. Overlap with
  other user-positioned stages is possible and ACCEPTED (display-only
  chrome; the user resolves it by moving the stage; recorded).

## Axis 3 — surfaces beyond the canvas

- **NON-GOALS this phase:** the Combined blueprint view, the Schematic,
  and the builder's raw list are UNTOUCHED (the schematic already
  renders feed lanes; the combined view's raw story is a future item if
  Michael asks). The canvas chain flow is where the "rootless branch"
  reads wrong — that is the fix surface.

## Axis 4 — non-goals

- The catalog change's FULL surface, named (r3 adversarial IMPORTANT —
  the field round-trips through IDB via three field-ENUMERATING
  functions, so omitting any one makes the flag silently vanish on the
  SECOND boot, a cache hit): `CatalogItem.isRawResource` (types.ts) +
  the docs-loader test-and-set + `StoredCatalogItem`
  (catalog-store.ts:34-39; its field is ALSO optional — r5 nit, a
  required stored field would tsc-clash reviving undefined) + `serializeItem` (:198-206) + `reviveItem`
  (:270-280) + a
  round-trip test asserting the flag SURVIVES save/load (the existing
  round-trip would pass with the field absent). This is the recorded
  exception to "no data changes" — ground truth beats inference (r2).
- No store fields, no plan-file change (no v6), no placement/persistence
  for feed nodes; no extraction-machine modeling (miners/extractors as
  stages stays excluded scope); no linking from/to feed nodes (their
  handles accept no connections — `isConnectable` false); no per-node
  toggle to hide feeds (all-or-nothing display; a toggle is a future
  ask).

## Test plan sketch

Real tests (bidirectionality log required):

- graph-flow: rawFeeds emitted for an unlinked extraction-level input
  with the exact `totalDemand`; a LINKED raw input suppresses its feed;
  an unlinked NON-raw input (craftable) emits nothing; recipe-less and
  unsolved stages emit nothing; LR vs TB positions/handles; ids stable
  (`raw:{stage}:{item}`); the separate-field shape leaves the existing
  `nodes`/`edges` pins untouched (assert lengths unchanged on the
  existing fixtures).
- docs-loader: `isRawResource` true for FGResourceDescriptor items,
  false for every other descriptor class; **the two adversarial probes
  pinned as classification tests: Heavy Oil Residue (item descriptor,
  byproduct of default Plastic) is NOT raw; Water (resource
  descriptor, ALSO a byproduct of three default recipes) IS raw** —
  the exact cases that killed both recipe-set heuristics; Crude Oil +
  Copper Ore raw. (No version-bump test — the bump died at simplify
  F1.)
- catalog-store: `isRawResource` SURVIVES serialize/revive (r4 nit —
  the test plan self-contained; the existing round-trip asserts only
  stackSize and would pass with the flag absent).
- non-interactivity pinned (r1; r6 restored the mechanism): a
  synthesized `position`/`select` change for a `raw:` id reaches
  neither setStagePosition nor setActiveStage — passes via the
  commit-loop `raw:` skip (the app-level guard), with RF's flags
  preventing real generation.
- smoke: the rawFeed card class appears in canvas markup (SSR posture).
- Both-media walk, BOTH directions: the Plastic/Crude-Oil case
  (Michael's exact complaint) shows the oil feed with its rate; feeds
  follow a stage drag and a direction switch; linked lanes show no
  duplicate feed; zero console errors.

## Assumptions ledger

1. `FeedLaneResult` carries `itemId` + `totalDemand` (exact Fraction) —
   manifold.ts:48-53, read this session; `StageSolveResult.feeds` at
   :75-76; stages hold it at `stage.solve` (SolveState union,
   store.ts:74-92 — `.result.feeds` reachable only under
   status === "solved"; the store itself does this exact lookup at
   :547-551 (r3 range fix), r1-confirmed).
2. (Classification clause SUPERSEDED by the v4 ground-truth rule —
   r3 nit; the type cites stay accurate.) `CatalogRecipe` fields at
   types.ts:63-72 / RecipeIO :58-61; NOTHING in the v5 flow reads
   recipes for classification — condition 1 is the item flag alone.
3. `graphToFlow`'s signature (graph-flow.ts:460-469) already receives
   catalog + stages + links + positions + flowDirection — every input
   the derive needs; the separate `rawFeeds` return field is additive.
4. GraphCanvas builds RF nodes from `derived.nodes` (:310-333 per the
   r1 read) and can concatenate `derived.rawFeeds` with a second
   nodeTypes entry; its onNodesChange is at :386-412 (r1 cite fix):
   removals are blanket-dropped at :393, and the drag-END/select arms
   at :398-408 are where the `raw:` belt-and-braces skip lands. The
   PRIMARY non-interactivity mechanism is the RF node flags
   (draggable/selectable/deletable false), not change-stream
   filtering.
5. (SUPERSEDED by the v4 ground-truth rule — retained for history.)
   The chain-builder raw classification (selectProducer :101-130) uses
   isAlternate + primary-output + machine exclusions; P1's display set
   deliberately drops the exclusion condition (recorded delta — an
   excluded machine still exists in the world; its item is not
   extraction-level).
6. Suite at 728 (P0 merged); zero churn to existing pins via the
   separate-field shape; new tests are additions.

## Revision history

- v1 (2026-08-05): initial — grounded in this session's reads
  (manifold feeds shape, Recipe IO fields, graphToFlow signature,
  chain-builder raw semantics).
- v2 (2026-08-05): dual-review r1, code-reviewer NEEDS_REWORK (2
  IMPORTANT + 2 NITs, all folded): onNodesChange cite fixed
  (:386-412, not the memo ranges); the non-interactivity mechanism
  corrected — RF node flags (draggable/selectable/deletable false) are
  PRIMARY, the change-stream `raw:` skip is belt-and-braces, and the
  ledger no longer contradicts the body; a non-interactivity test
  pinned in the plan; raw-card dimensions promoted to named constants
  independent of NODE_WIDTH/HEIGHT; type-range cites fixed
  (CatalogRecipe :63-72). The reviewer independently confirmed the
  rate seam (the store's own feeds lookup at :544-549) and the
  separate-field pin-stability argument.
- v3 (2026-08-05): dual-review r1, adversarial APPROVED_WITH_NITS
  (1 MEDIUM + 2 nits, all folded):
  - **MEDIUM (the sharpest probe, source-grounded to the bundled
    catalog):** the primary-only raw-Set would misclassify
    byproduct-only items, and Heavy Oil Residue — in the design's own
    example chain — was rescued only by the Unpackage recipe
    coincidentally qualifying. Fold: the Set is built from ALL outputs
    of default recipes (principled, coincidence-free); the HOR
    byproduct test pinned; the two selectProducer deltas both recorded.
  - Nits: the stale GraphCanvas cites (fixed with the code-reviewer's
    identical finding); the two-architectures ambiguity resolved to
    path (a) — rawFeeds concatenated at the RF nodes prop OUTSIDE the
    useState/merge, stated once with its consequences.
  Confirmed sound under refutation: the derive inputs (stages carry
  solve results into graphToFlow), totalDemand override-independence
  (overrides reshape belts only, manifold.ts:338-368), negative-coord
  rendering + fitView, and the zero-churn claim against the actual
  pins (graph-flow.test.ts:232/:483 destructured arrays; smoke
  toContain-only).
- v4 (2026-08-05): dual-review r2 — [code-reviewer]
  APPROVED_WITH_NITS (2, folded: selectProducer naming unified;
  :97-129 range); [adversarial] NEEDS_REWORK (1 IMPORTANT + 2 nits,
  all folded):
  - **IMPORTANT (source-grounded to the bundled catalog, nested-
    verifier confirmed):** the v3 all-outputs Set mirror-failed on
    WATER — a byproduct of three default recipes (Aluminum Scrap,
    Battery, Non-Fissile Uranium; en-US.json:17078/:18953/:15998) yet
    the design's flagship raw item; the pinned Water test would have
    FAILED against the v3 rule. Fold: classification moves to the
    game's own declaration — CatalogItem.isRawResource from
    FGResourceDescriptor + a CATALOG_PARSER_VERSION bump; both
    recipe-set heuristics retired; HOR + Water pinned as the
    classification tests.
  - Nits: residual producerFor names unified to selectProducer (with
    the code-reviewer's identical finding); RAW_NODE_WIDTH/HEIGHT
    explicitly set as the RF nodes' width/height fields so fitView
    frames feeds (folded into Axis 2).
  Confirmed sound under refutation: the outside-the-state concat
  (edges across the two populations fine; no S10P1 re-slot
  interaction), the non-interactivity layers (the raw: skip covers a
  path the flags miss — the changes loop iterates raw changes;
  deletable:false noted as mild over-defense for the simplify lens),
  the rate seam.
- v5 (2026-08-05): dual-review r3 — [code-reviewer] APPROVED_WITH_NITS
  (4 citation-precision nits, folded: shorthand covers src/data files;
  docs-loader :63/:66-80; selectProducer :101-130; store lookup
  :547-551). The ground-truth premise verified against the bundled
  catalog: FGResourceDescriptor is ONE group of exactly 13 genuine
  extraction resources (all ores, Coal, Limestone, Raw Quartz, Crude
  Oil, Water, SAM, Nitrogen Gas, Caterium, Sulfur, Uranium); HOR under
  FGItemDescriptor; parser version currently 3.
  [adversarial] NEEDS_REWORK (1 IMPORTANT + 2 nits, all folded):
  - **IMPORTANT: the IDB round-trip surface.** CatalogItem fields are
    ENUMERATED in StoredCatalogItem/serializeItem/reviveItem — adding
    the flag without all three makes it silently vanish on the second
    boot (cache hit), regressing the exact feature. The full
    catalog-change surface is now named in Axis 4 + a
    flag-survives-round-trip test pinned.
  - Nits: assumption 2's vestigial raw-set-derivation clause marked
    superseded (nothing in v5 reads recipes for classification).
  Its refutation also confirmed: biomass items (Wood/Leaves/Mycelia)
  are NOT resource descriptors — no spurious feed cards; the
  13-member enumeration is complete and correct; the parser-bump
  invalidation covers bundled AND uploaded caches; the loader can
  test the class per group trivially.
- v6 (2026-08-05): dual-review r4 — [code-reviewer] APPROVED_WITH_NITS
  (1: the catalog-store round-trip test bullet added to the test plan,
  folded). [adversarial] NEEDS_REWORK (1 IMPORTANT + 1 MEDIUM + 1 nit,
  all folded as ONE decision): the field becomes OPTIONAL
  (`isRawResource?: boolean`, absent ⇒ non-raw) — a required field
  would TS2741-break ~7 fixture literals (catalog-store/graph-flow/
  chain-builder-adapter/AltCompare/transport-plan/ChainBlueprint/
  chain-view tests) at the `tsc -b` check gate; the consumer read is
  truthiness-safe so optional is behaviourally identical and the
  fixtures stay untouched. The serialization-surface enumeration
  (r3 fold) was confirmed complete for the surface it names; the
  round-trip pin guards serialization while optionality removes the
  compilation surface entirely.
- v6-r5 (2026-08-05): scoped re-check — [code-reviewer] APPROVED (0);
  [adversarial] APPROVED_WITH_NITS (1, folded: StoredCatalogItem's
  field also optional — one word). Correctness CONVERGED after five
  rounds; the fold verified holeless (the === true read collapses
  undefined/false/true correctly through either serialization idiom;
  the round-trip pin stays load-bearing).
- SUPERSEDED (2026-08-05, Stage 12 P0 / #60): the v7-simplify F1
  disposition (no version bump) proved wrong in the field — a healthy
  bundled cache has NO natural re-parse trigger, so the feature stayed
  invisible for existing users. CATALOG_PARSER_VERSION 3 → 4 restored.
- v7-simplify (2026-08-05): one-shot simplify pass NEEDS_REWORK
  (advisory — 4 findings, all dispositioned): F1 FOLDED — the
  parser-version bump dropped (the optional field makes stale caches
  self-healing; the bump would have forced every user a re-parse and
  uploaded-Docs users a re-upload for display chrome; the reviewer
  verified the `=== true` read is the only consumer). F2 FOLDED — the
  hand-written `raw:` skip dropped (layers 1+2 structural and each
  sufficient; the invariant test stays, repointed at the architecture).
  F3 recorded — the RF-node form vs a text line is JUSTIFIED (a
  topological complaint needs a topological fix; no action). F4
  contingent-on-F1 (the bump test died with the bump). The derived-node
  heart, the three store touchpoints, and the classification pins all
  affirmed minimal. FROZEN pending the post-fold correctness re-check.
- v8 (2026-08-05): post-simplify correctness re-check (r6) — BOTH
  NEEDS_REWORK, and they DISAGREED on subtraction 2; the team lead
  verified against source (GraphCanvas.tsx:398 — the commit loop
  iterates the RAW changes array), deciding FOR the code-reviewer:
  layer 2 never gates the setter path, so the F2 fold's redundancy
  premise was false. **F2 REVERSED — the one-line commit-loop `raw:`
  skip returns** (restoring the r5-converged mechanism; the ledger and
  body are consistent again, which also resolves the adversarial's
  contradiction finding). **F1 CONFIRMED by both r6 reviewers**
  (self-healing verified: no consumer misbehaves on a flag-less cache;
  no other pending shape reason; the only live bump precedent was for
  a REQUIRED field). Loop closure: v8 = the r5-converged design (five
  rounds, every element dual-approved) + the F1 subtraction (r6
  dual-verified sound) — every line now carries both-reviewer
  approval. FROZEN.
