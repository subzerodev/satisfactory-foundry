# #157 — Packaging chains join the build view: manifold drawing + belt lane counts (brainstorm+spec, r1)

Ticket: #157 (leads; #156 consumes its outputs). Tier 2.
Field report (Michael, 2026-08-19, on the Extraction — Water dialog): *"we are
completely missing the visuals on how many belts we need to transport that
amount of containers or how the mainfolds work? also where should all this go"*

## Already settled — do NOT re-litigate

- **Own view** (#157 c24989, Michael: "own view i think"): the packaging
  manifold surfaces as its OWN selectable subject in the build drawing — not an
  extension of the extraction/link view.
- **#146 deferral**: the lane model carries one itemId per lane; multi-item bus
  is backlogged. This design must not require it (it doesn't: a packager's two
  inputs are two separate single-item lanes — `StageInput.feeds` is already a
  list, `manifold.ts:30`).
- **#133 model**: packaging sizing flows through `derivePackagingPlan` /
  `DerivedLinkPlan` (`src/core/link-plan.ts:58-73,116`); the extraction path
  reuses it via `deriveExtractionPackagingPlan`. That stays the single sizing
  source — this feature reads it, never re-derives.
- **#154**: build views render at a readable 24px pitch floor and pan. The
  packaging views inherit this by reusing the same components.

## The gap, grounded

1. **Belt counts are computed, then hidden.** `solveContinuous` returns
   `runs = ceil(rate / laneRate)` for every continuous plan
   (`src/core/transport.ts:50,76`) — belts included. The suppression is one
   deliberate line: `edgeChip` returns `null` for `mode === "belt"`
   (`src/ui/transport-text.ts:247`, comment "Belt renders as today (no
   chip)"), while pipes render "N pipes" and vehicles/trains/drones render
   counts. The 10600/min packaged-water route therefore shows bare "Belt".
2. **The drawing never sees packaging machines.** All three build tabs render
   the ACTIVE STAGE's `solve.result` (`src/ui/App.tsx:476-503`); the view enum
   is App-local (`App.tsx:180`). A packaging interstep's 177 packagers + 89
   unpackagers have no `StageInput`, so no manifold, ruler, or ribbon is ever
   drawn for them — despite being the exact machine-group-fed-by-manifold
   shape the visualizer exists for.

## Decision axes

### A1 — What solve feeds the packaging drawing

**Pick: a pure adapter, `packagingStageInputs`, feeding the existing
`solveStage` unchanged.** New `src/core/packaging-stage-input.ts`:
`(catalog, plan: ReadyLinkPlan, clockPercent, capacities) →
{ packager: StageInput; unpackager: StageInput } | null` (null when machine
counts are null). Mapping, exact `Fraction` arithmetic throughout:

- **Packager group**: `machineCount = plan.packageMachines`; feeds =
  `[ {itemId: fluid, kind: "pipe", perMachineRate: pair.packageFluidRate},
     {itemId: plan.containerItemId, kind: "belt", perMachineRate: pair.packageContainerRate} ]`;
  outputs = `[ {itemId: plan.packagedItemId, kind: "belt", perMachineRate: pair.packagePackagedRate} ]`.
- **Unpackager group**: the mirror, from the pair's unpackage rates.
- `clockPercent` = the interstep's packager clock (the same value
  `derivePackagingPlan` sized the counts with).

Per-machine pair rates are read off `PackagingPair` (the fields
`packageFluidRate` / `packageContainerRate` / `packagePackagedRate` are used
exactly this way at `link-plan.ts:80-83`); the implementation runs the standard
pre-impl drift hunt on the unpackage-side field names.

**Rejected:** bespoke drawing math for packaging (violates reuse-first — the
manifold solver + P2 drawing are the product's core; `solveStage`
(`manifold.ts:231`) already accepts mixed pipe+belt feed lanes, the P2
pipe-manifold connector is precedent).

### A2 — How the own view is selected

**Pick: a drawing-subject selector above the view tabs.** When the active plan
has ≥1 packaging chain, a select appears: default option "Stage: <active
stage>" (today's behavior, unchanged when no chains exist — the selector is
absent then), plus one option per chain: "Packaging: <item> — extraction @
<stage>" for extraction intersteps, "Packaging: <item> — <from> → <to>" for
link intersteps. The label FLOOR is disambiguation-only (the item name
suffices when chains don't collide); the composed extraction/link phrasing is
presentation, refinable under #156 rather than frozen here. Choosing a
packaging subject re-points the view tabs at the packaging solves. Subject state is App-local alongside `view` (`App.tsx:180`
precedent — meaningless headless, no store field). Enumeration source: the
stored stages' extraction selections with `packaging` set + links with
`interstep` — both already in the plan store.

**Rejected:** extra view tabs (the tab row is view-KIND — schematic vs machines
vs blueprint — not subject; mixing axes breaks it). Graph-canvas node selection
(an extraction interstep has no canvas node to click; the dialog owns it).

### A3 — One subject per chain, both groups stacked

**Pick: one subject renders BOTH groups stacked** — packager manifold above,
unpackager below, each with a heading ("177 × Packager", "89 × Unpackager")
and per-group power (via the existing `machinePowerProjection` path,
`src/core/machine-power.ts:55` — see A5). Michael's question is "how do the manifolds
work" for the chain — one selection answers it whole. Components already take
`solve.result` props (`App.tsx:477-502`), so stacking is composition.

Scope per tab: **Schematic + Machines render stacked groups; Blueprint is
STAGE-ONLY for packaging subjects this ticket** — the tab disables with a
one-line note when a packaging subject is selected. The disabled tab is
non-interactive; if blueprint was the active view when a packaging subject is
selected, the pane shows the same one-line note (`view` state is NOT reset —
switching back to a stage subject restores the blueprint). Decided at design time
(simplify fold), not deferred: `Blueprint` takes a single `machineId`
(`App.tsx:492`) and a stacked chain is definitionally two machine kinds, so
per-group Blueprint needs prop-threading this ticket does not specify. That
follow-up is **#158** (blocked on this ticket).

### A4 — Belt lane counts surface (the #156 feed)

**Pick: `edgeChip`'s belt case returns the count, exactly like pipes — AND the
graph-flow belt short-circuit's mode half lifts so the chip can reach ordinary
links.** Two coordinated changes:

1. `transport-text.ts:247` `null` →
   `chip(\`${runs} ${runs === 1n ? "belt" : "belts"}\`, false)`; the stale
   halves of the doc comment (`transport-text.ts:236-237` "Returns null for a
   belt link (renders exactly as today)") go with it.
2. `graph-flow.ts:521` — `transportChipFor` short-circuits
   `link.transport === undefined || link.transport.mode === "belt"` BEFORE
   `edgeChip` is ever reached, so without this change an ordinary configured
   belt link would still show no chip. The **mode half lifts** (a configured
   belt link flows to `planForLink → edgeChip` like a truck link); the
   **undefined half stays** (a default belt link has no transport config to
   size against — today-unchanged, and its pin at `graph-flow.test.ts:1047-1058`
   is a KEEP). The function's doc comment (`graph-flow.ts:500-502`) and the
   `:520` comment update accordingly.

No new sizing rule is invented: `runs` and `laneRate` are already on the plan
(`transport.ts:76`); the tier POLICY stays whatever each call site already
passes as `laneRate` today — #157 adds no tier-selection change. Consequences,
scoped precisely:

- **configured** belt links chip "N belts" on the graph canvas
  (`transportChipFor`'s ordinary path, post-lift); **default** (unconfigured)
  belt links stay chipless;
- interstep routes chip via `routeEdgeChip` (`graph-flow.ts:512-514`), which
  delegates to `edgeChip` with no belt guard of its own
  (`transport-text.ts:284`);
- `routeSummary` in the extraction panel (`GraphCanvas.tsx:840-847`) starts
  showing "9 belts" for forward/return — #156 restyles that block, this ticket
  only makes the number exist;
- the panel/tier label ("Mk6") is #156's presentation concern, derivable from
  `laneRate` via `tierLabel` where the catalog is in scope.

### A5 — Power per group

**Pick:** each group's power computed through the existing
`machinePowerProjection(power, machineCount, clock)` path
(`machine-power.ts:55` — the function `derivePackagingPlan` already uses at
`link-plan.ts:181`; `effectiveMachinePower` is the recipe variable-power
correction feeding it), shown in the group headings (A3) and consumable by
#156's totals. `plan.power` (the combined projection, `link-plan.ts:63`) is
untouched.

## Changes

1. **`src/core/packaging-stage-input.ts`** (new, pure): the A1 adapter +
   unit tests pinning the exact lane mapping for a known pair (water /
   packaged water / empty canister), including the mixed pipe+belt feed shape
   and clock passthrough.
2. **`src/ui/App.tsx`**: subject state + selector (A2); packaging solves via
   `useMemo` (`solveStage` over the adapter outputs); stacked rendering path
   (A3) for Schematic + Machines; Blueprint disables for packaging subjects
   with the one-line #158 note.
3. **`src/ui/transport-text.ts`**: the A4 belt chip; delete the "Belt renders
   as today (no chip)" comment (:246) and the stale doc-comment half (:236-237)
   with the behavior they document.
4. **`src/ui/graph-flow.ts`**: lift the mode half of the `:521` belt
   short-circuit (keep the undefined half); update the `:500-502` and `:520`
   comments.
5. **Tests**: adapter unit tests; a subject-selector + stacked-render DOM test
   (selector absent with no chains; present + switches subjects with one);
   belt-chip re-derivations; bidirectionality log
   (`features/packaging-build-view/r2-verification.log`) with compiling
   mutants per new production behaviour.

## Deleted-behaviour sweep (grep is the authority)

`grep -rin "no chip|tobenull" src/ui/transport-text.test.ts src/ui/graph-flow.test.ts src/ui/LinkInspector.dom.test.tsx src/ui/GraphCanvas.dom.test.tsx` +
`grep -rin "belt" src/ui/transport-text.test.ts src/ui/graph-flow.test.ts` at
implementation time; EVERY hit dispositioned (keep / re-derive / delete) in the
diff's sweep map. Known now:

- `transport-text.test.ts:292-300` — "belt continuous → no chip (renders as
  today)" pins the deleted behavior → RE-DERIVE to pin the new "N belts" chip
  (count from a fixture whose rate/laneRate quotient is non-trivial, per the
  fixture-degeneracy rule).
- `transport-text.test.ts:314-330` — "omits unsolved, error, and belt route
  summaries": the `:329` assertion `routeEdgeChip("forward", <continuous belt
  plan>).toBeNull()` pins the SAME deleted behavior through the delegate
  (`routeEdgeChip` has no belt guard of its own, `transport-text.ts:284`) →
  RE-DERIVE to the chip-bearing route label ("· forward N belts"); the
  unsolved/error arms of that test are KEEP.
- `graph-flow.test.ts:1047-1058` — "belt (absent transport) appends NO chip"
  pins the UNDEFINED-transport half of the `graph-flow.ts:521` guard, which
  survives the A4 lift → KEEP (permanent behavior, not the deleted mode half).
- Any LinkInspector/GraphCanvas DOM test asserting a belt edge label WITHOUT a
  chip → re-derive to the chip-bearing label.

## Assumptions ledger

- `runs` on a continuous plan means countable parallel lanes — verified,
  `transport.ts:50-77` (doc comment + `ceilDiv`).
- `solveStage` accepts multiple feeds of mixed kinds — verified,
  `manifold.ts:26-32` (`feeds: LaneInput[]`, `kind` per lane); P2's
  pipe-manifold connector is rendering precedent.
- Packager/unpackager counts + pair + container/packaged itemIds all live on
  `ReadyLinkPlan` — verified, `link-plan.ts:58-66,48-56`.
- The unpackage-side per-machine rate field names on `PackagingPair` are
  symmetric to the package side — VERIFIED: `unpackagePackagedRate` /
  `unpackageFluidRate` / `unpackageContainerRate` (`packaging-pair.ts:29-31`),
  with mirror directionality (packaged = input, fluid + container = outputs)
  at `packaging-pair.ts:134-136`. The standard pre-impl drift hunt still runs.
- The stored plan exposes extraction packaging + link intersteps for the A2
  enumeration — grounded in `ExtractionSelection.packaging`
  (`extraction-plan.ts:10`) and `LinkPlanLink.interstep` (`link-plan.ts:45`);
  exact store selectors confirmed at implementation.

## Out of scope

Multi-item bus (#146), head lift (#147), Somersloop (#148), Resource Wells
(#149), the #156 panel restructure (follows this), any tier-selection policy
change, any solver change to `solveStage` itself.

## Revision history

- r1 — initial draft (team lead), grounded against develop @ ccc90fb.
- r2 — fold of the r1 degraded-pair review (code-reviewer NEEDS_REWORK 2
  IMPORTANT + 2 NIT; adversarial-reviewer NEEDS_REWORK 1 IMPORTANT, overlapping).
  Folded: (1) the A4 "everywhere" claim was FALSE — `transportChipFor`
  short-circuits belt at `graph-flow.ts:521` before `edgeChip`; resolved by
  LIFTING the mode half of that guard (new Changes item 4) so configured belt
  links chip like pipes/trucks, keeping the undefined half + its
  `graph-flow.test.ts:1047` pin (KEEP); (2) the sweep's known-now list gained
  the second belt-null pin `transport-text.test.ts:314-330/:329`
  (`routeEdgeChip` delegate) → RE-DERIVE, both reviewers flagged it; (3) NIT:
  A3/A5 now cite `machinePowerProjection` (`machine-power.ts:55`, the function
  `derivePackagingPlan` uses at `link-plan.ts:181`) instead of
  `effectiveMachinePower`; (4) NIT: the unpackage-side pair fields re-labeled
  VERIFIED (`packaging-pair.ts:29-31,:134-136`). Adversarial refutations that
  HELD (no change needed): no double-clocking (`link-plan.ts:162-165` ×
  `manifold.ts:286-288` agree); enumeration complete (`store.ts:112,:161` the
  only two interstep homes); no degenerate `laneRate` can reach `edgeChip`
  (`transport.ts:73-75` throws).
- r3 — simplify pass (claude-simplify-reviewer, degraded roster):
  APPROVED_WITH_NITS, 2 findings, both FOLDED. (1) A3's Blueprint hedge was
  undecided work deferred past design — decided now: Blueprint is stage-only
  for packaging subjects this ticket (single `machineId` prop, `App.tsx:492`,
  vs two machine kinds in a chain); per-group Blueprint filed as #158,
  blocked on #157. (2) A2 gains the label floor (disambiguation-only; composed
  phrasing refinable under #156). Explicitly not-flagged by the lens: A5
  per-group power, the sweep section's size, A4's consequence enumeration —
  all "correctly-sized rigor". Correctness pair re-runs scoped to these two
  folds (the simplify pass is one-shot and does not re-run).
- r3 scoped re-run — CONVERGED: code-reviewer APPROVED (0 findings; both folds
  verified against `App.tsx:492` / `Blueprint.tsx:25`; the label floor judged a
  clean implementer contract since item-name collisions are live);
  adversarial-reviewer APPROVED_WITH_NITS (1 NIT: the stale-`view` carryover on
  subject switch was under-specified — FOLDED: the disabled tab is
  non-interactive, an active blueprint view shows the note in the pane, `view`
  is not reset). Spec FROZEN at this revision.
- diff-r1 folds — Blueprint tab genuinely disabled per the frozen clause;
  adapter fixture decorrelated; stage-scoped panels (LaneOverrides/FindingsPanel)
  hidden under packaging subjects, a scope completion the spec's tab-only wording
  left silent.
