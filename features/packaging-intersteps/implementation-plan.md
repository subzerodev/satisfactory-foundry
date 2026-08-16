# Packaging Intersteps Implementation Plan

> **For agentic workers:** use test-driven development and implement each task
> as an atomic reviewed unit. Checkbox steps are the execution record.

**Goal:** Let a user package a fluid/gas link for solid transport and see exact
Packager counts, power, packaged flow, empty-container return flow, and two
independent transport routes without changing the material graph.

**Architecture:** Persist only user intent on `StageLink`; discover reversible
Packager pairs from catalog IO; derive one pure material/cargo plan; keep
material reconciliation in fluid units while every transport consumer uses the
projected solid cargo. Plan v8 is a closed-world raw-intent boundary. Store
actions preserve a saveable-state invariant and recompute cached findings.

**Tech stack:** React 19, TypeScript 6, Zustand, exact `Fraction`, Vitest/jsdom,
Vite, system Chromium through CDP.

---

### Task 1: Shared Types And Pair Discovery

**Files:**

- Create: `src/core/link-transport.ts`
- Create: `src/data/packaging.ts`
- Create: `src/data/packaging.test.ts`
- Modify: `src/state/store.ts`

- [x] Write failing tests for all 12 bundled reversible pairs. Pin package ID,
      reverse recipe ID, target fluid/gas, packaged item, container item, and every
      exact IO rate. Include Nitrogen's `240 -> 60` package ratio and gas tank.
- [x] Add malformed catalog fixtures for incomplete, mismatched, ambiguous, and
      non-Packager candidates; none may be offered.
- [x] Move `LinkTransport`/`TransportMode` to `src/core/link-transport.ts`, retarget
      all store/data/UI imports directly, and remove the store type export. Add
      `PackagingInterstep { packageRecipeId; clockPercentText; returnTransport }`.
- [x] Implement `discoverPackagingPairs(catalog, itemId)` and
      `resolvePackagingPair(catalog, packageRecipeId)`. Match exact IO identity and
      reciprocal ratios, never display names. A package ID is the sole pair key.
- [x] Add optional `interstep` to `StageLink`, but do not expose it through
      `addLink`. Define `NewStageLink = Omit<StageLink, "id" | "interstep"> & {
interstep?: never }`; add a compile-time wider-variable rejection fixture.
- [x] Run `npm test -- --run src/data/packaging.test.ts` and `npm run check`.

### Task 2: Canonical Exact Derived-Link Plan

**Files:**

- Move: `src/ui/transport-plan.ts` -> `src/core/transport-plan.ts`
- Move: `src/ui/clock.ts` -> `src/core/clock.ts`
- Create: `src/core/machine-power.ts`
- Create: `src/core/machine-power.test.ts`
- Modify: `src/ui/advice.ts`
- Modify: `src/ui/advice.test.ts`
- Create: `src/core/link-plan.ts`
- Create: `src/core/link-plan.test.ts`
- Modify: transport-plan import sites as required by TypeScript

- [x] First write failing tests for Water at `10,600/min`: 177 package, 89
      unpackage, 10,600 packaged, 10,600 empty returns, 2,660 MW, 9 Mk6 lanes each.
- [x] Add Nitrogen supply/demand tests proving material values remain in gas
      units while cargo values independently map by `1/4`. Add Nitric Acid and Heavy
      Oil Residue slower-unpackage rows, clock scaling, pair mismatch, stale ID,
      invalid clock, and safe-integer overflow.
- [x] Move the pure transport derivation to core so both store and UI can use it;
      update all imports directly and remove the old UI module path.
- [x] Move `parseClockText` to core, update all imports directly, and remove the
      old UI module path. Add a core `machinePowerProjection` that returns an
      exact `Fraction` result at 100% and a numeric `estimated` result at other
      clocks, including variable-power bounds. Adapt `stagePowerText` to format that
      projection instead of owning the calculation; no core module imports UI.
- [x] Pin constant and variable machine power at 100% plus non-100% estimated
      power before using the projection in `deriveLinkPlan`.
- [x] Implement `deriveLinkPlan(catalog, link, stages)` with:
  - `ready`: pair, optional `materialSupply/materialDemand`, optional machine
    result when demand is solved, `cargoSupply/cargoDemand`, packaged/container
    identities and rates, power, forward transport, return transport;
  - `unavailable`: one exact error for stale/missing/invalid pair, bad clock,
    overflow, or illegal packaged mode, with no cargo/count/transport payload.
- [x] Keep trip/derate parse failures inside each independent `TransportPlan`;
      they do not erase valid interstep counts or the other route. Preserve
      `sharedEnds.from/to` as physical producer/consumer sides on return trains.
- [x] Run `npm test -- --run src/core/link-plan.test.ts src/core/machine-power.test.ts src/ui/transport-plan.test.ts src/ui/advice.test.ts`
      and `npm run check`.

### Task 3: Atomic Plan V8 Persistence

**Files:**

- Modify: `src/data/plan-store.ts`
- Modify: `src/data/plan-store.test.ts`
- Modify: `src/state/store.ts`
- Modify: `src/state/store.test.ts`

Tasks 1-3 are one persistence unit: do not commit a widened live `StageLink`
while any writer still emits v7.

- [x] Write failing v8 tests before production edits: current save/load,
      export/import, bundle, stale package IDs, raw invalid clock/trip/pipe derate
      text, closed-world field placement, illegal packaged routes, and future v9.
- [x] Freeze v7 types. Add `PlanLinkV8`/`PlanFileV8`; all current APIs and store
      writer constructors emit v8. Old builds must reject v8 rather than erase
      interstep intent.
- [x] Implement closed-world raw-intent validators. Mode/trip/fuel discriminants,
      required fields, exact key placement, and `sharedEnds` shape are strict;
      numeric string semantics are deferred. Interstep forward/return routes reject
      pipe and fluid-truck.
- [x] Implement v7 migration by rebuilding every accepted legacy transport arm
      from recognized fields. Strip ignored/misplaced outer and nested fields.
      Prove v7 load -> v8 save -> v8 reload preserves recognized intent.
- [x] Ensure v1-v6 migration chains end at canonical v8 and plan list/load/save,
      rename, import/export, and bundle use `PlanFileV8`.
- [x] In the same atomic unit, add guarded `setLinkInterstep`, make
      `setLinkTransport`/`clearLinkTransport` preserve intent, and refuse packaged
      pipe/fluid-truck routes before mutation. Narrow/runtime-guard `addLink` and
      explicitly construct ordinary fields. Add red tests for each bypass plus
      save/reload of the retained valid state.
- [x] Enable writes forward belt + return belt atomically. Disable chooses pipe
      for a current fluid/gas, belt for a current solid, and absent transport when
      the item is missing. At this stage setters recompute existing material
      reconciliation; Task 4 adds interstep findings and graph projection together.
- [x] Run `npm test -- --run src/data/plan-store.test.ts src/state/store.test.ts`,
      `npm run check`, then commit Tasks 1-3 as one atomic persistence commit.

### Task 4: Store, Reconciliation, And Graph Consumers

**Files:**

- Modify: `src/core/reconcile.ts`
- Modify: `src/core/reconcile.test.ts`
- Modify: `src/state/store.ts`
- Modify: `src/state/store.test.ts`
- Modify: `src/ui/graph-flow.ts`
- Modify: `src/ui/graph-flow.test.ts`
- Modify: `src/ui/transport-text.ts`
- Modify: `src/ui/transport-text.test.ts`
- Modify: `src/ui/GraphCanvas.tsx`
- Modify: `src/ui/app.css`

- [ ] Write failing lifecycle tests for enable, pair/clock update, disable,
      valid-invalid-valid, clear transport, removal, catalog replacement, and stale
      recovery. Public route/addLink refusal tests already land in Task 3.
- [ ] Add `interstep-problem` to `LinkFinding`. Keep `reconcileLinks` material
      inputs in original units and append at most one interstep finding after the
      material finding for that link.
- [ ] Update every full-derive/rebuild cadence to derive material reconciliation
      plus the optional interstep problem atomically. Pin unavailable crossed with
      under/over/dangling, deterministic ordering, and no stale findings.
- [ ] Write failing graph tests proving forward/return chips and train findings
      use packaged/container stack sizes and rates, including Nitrogen's `1/4`
      cargo ratio and both one-sided return `sharedEnds` cases.
- [ ] Before graph implementation, add failing unavailable x under-supply,
      over-supply, and dangling rows. Each asserts both diagnostic texts, problem
      state precedence, finding count two, and preserved apply payload only for the
      original-unit under-supply row.
- [ ] Replace direct transport resolution with `deriveLinkPlan`. Keep the main
      edge item/material shortage wording in fluid units; add packaged transport
      chips/results from cargo units.
- [ ] Add a combined edge diagnostic projection that partitions material and
      interstep findings. Problem styling wins, both texts remain visible, and
      finding counts include both. Unavailable suppresses both route results.
- [ ] Extend plan-wide transport findings to inspect both routes without
      duplicating the canonical projection or changing ordinary links.
- [ ] Add restrained problem styling and verify labels do not resize or overlap
      fixed graph elements.
- [ ] Run `npm test -- --run src/core/reconcile.test.ts src/state/store.test.ts src/ui/graph-flow.test.ts src/ui/transport-text.test.ts`
      and `npm run check`; commit reconciliation and graph consumers as one
      compile-safe unit.

### Task 5: Link Inspector Interaction

**Files:**

- Modify: `src/ui/LinkInspector.tsx`
- Modify: `src/ui/LinkInspector.test.ts`
- Create: `src/ui/LinkInspector.dom.test.tsx`
- Modify: `src/ui/chain-view.ts`
- Modify: `src/ui/chain-view.test.ts`
- Modify: `src/ui/app.css`

- [ ] Write failing pure/DOM tests for checkbox visibility, sole/multiple pair
      selection, enable defaults, pair/clock edits, disable, stale disable recovery,
      and independent route mode/trip editors.
- [ ] Add a saved-intent DOM row where catalog replacement removed the linked
      item entirely. It must bypass the current item-missing early return, render a
      fallback item-id identity and checked recovery control, render no route math,
      and disable to a link with absent transport.
- [ ] Add failing drawn-distance rows for forward and return train routes with
      `{ from: true }` and `{ to: true }`. Applying estimated distance must target
      only the chosen route and preserve the physical-side key byte-for-byte.
- [ ] Extract a small reusable route editor within `LinkInspector.tsx`; do not
      create a new cross-module UI framework. Solid modes only for packaged routes.
- [ ] Render package/unpackage counts, total power, packaged/min, empty/min,
      forward result, return result, seed-container advisory, and separate-return
      advisory from `deriveLinkPlan` only. Render exact unavailable error and no
      stale counts.
- [ ] Preserve current fluid identity/rate and material apply action. Make
      `applyBlockFor` search specifically for material under-supply even when an
      interstep problem coexists.
- [ ] Generalize drawn-distance helpers only enough to edit either route. Return
      train labels retain physical side semantics; no key inversion.
- [ ] Verify all controls have native labels, keyboard access, stable dimensions,
      mobile wrapping, and no nested-card styling.
- [ ] Run `npm test -- --run src/ui/LinkInspector.test.ts src/ui/LinkInspector.dom.test.tsx src/ui/chain-view.test.ts`,
      `npm run check`; commit the inspector unit.

### Task 6: Browser Evidence And Full Verification

**Files:**

- Create: `features/packaging-intersteps/browser-harness.html`
- Create: `src/ui/packaging-intersteps-browser-harness.tsx`
- Create: `scripts/packaging-intersteps-browser-check.mjs`
- Create: `features/packaging-intersteps/completion-report.md`
- Create: `features/packaging-intersteps/r2-verification.log`
- Modify: `features/packaging-intersteps/FEATURE.md`
- Modify: `CHANGELOG.md`

- [ ] Build a checked-in Vite/system-Chromium CDP gate using the real
      `LinkInspector` and production CSS. Do not assign input values through JS;
      use pointer/key events and CDP text insertion.
- [ ] At 1280px run the full workflow: enable, clock edit, independent route
      changes, return trip input, stale recovery/disable, and keyboard operation.
      At 360, 720, and 1280 assert all four rectangle edges, wrapping, no overlap,
      and document/body width no larger than client width; perform one real packaged
      control activation at each width to prove hit-testing/reachability. Save and
      inspect screenshots.
- [ ] Re-run the extraction browser gate to protect the existing 360px fix.
- [ ] Record exact test/browser evidence, user-visible behavior, constraints,
      and review dispositions in the completion report and feature ledger.
- [ ] Populate `r2-verification.log` with bidirectional evidence per distinct
      production behavior: exact green command/output; exact temporary
      `apply_patch` break; focused Vitest output containing a real `FAIL`/`×` line
      naming the new test; exact restoring `apply_patch`; and green rerun. Cover
      representative pair/derive math, v8/store guard, combined graph diagnostic,
      and inspector interaction behavior. Never leave a break applied.
- [ ] Run fresh branch verification:

```bash
node scripts/packaging-intersteps-browser-check.mjs
node scripts/extraction-panel-browser-check.mjs
npm test
npm run check
npm run build
git diff --check develop...HEAD
```

- [ ] Generate a cumulative `develop...HEAD` diff prompt. Run both correctness
      reviewers in parallel until both approve, then one diff simplify pass,
      disposition findings, rerun correctness if code changes, and only afterward
      merge as a separate action.
