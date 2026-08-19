# #133 — Packaging for a raw input (Stage 23)

**Ticket:** #133 · **Epic:** #136 · **Milestone:** 94 · **Tier:** 2
**Status:** design r5 (post-arc revalidated)

## Purpose

Michael: *"i dont see where to click to make the water be packaged."* He is right
— there is nothing to click. Stage 22 shipped packaging as an insertion **on a
link**, and the 10,600 m³/min water that motivated Stage 22 arrives as a **raw
feed**, which has no link. The feature cannot be pointed at the case it was built
for.

Outcome: the Extraction panel for a raw input offers packaging, and answers
*"what does it cost to move this to the factory as packaged cargo?"*

## Settled — do NOT re-litigate

From Michael, 2026-08-17 (#133 comment 24629, option 2 of three offered):

> **Packaging for a raw input lives in the Extraction panel**, not as a second
> transport surface on the raw card — *"directly under the extractor plan"*.

Carried constraints from epic #136:

- **Do not widen `StageLink` to cover raw feeds.** Plan v8 persistence and the
  solver's cycle guard both key off real links.
- Behaviour-frozen: packaging is a **reporting layer**. It adds no Packager cycle
  to the factory graph, exactly as the link case does not.

## What the code already gives us — verified

| Fact | Source | Why it matters |
|---|---|---|
| `LinkPlanLink` is a **standalone structural type**, not `StageLink` | `core/link-plan.ts:40-46` vs `state/store.ts:136-143`; `LinkPlanLink` referenced only in `link-plan.ts` and its test | Reusing the packaging math does **not** touch `StageLink`. |
| `StageLink` must stay *assignable* to `LinkPlanLink` | `LinkInspector.tsx:151`, `store.ts:630` pass a real `StageLink` into `deriveLinkPlan` | A real coupling, not "no dependency" — keeping `deriveLinkPlan`'s signature preserves it. |
| `effectiveLinkCargo` is exported and pure | `link-plan.ts:75-93` | Cargo math already takes plain `Fraction`s. |
| `link`/`stages` are read at exactly six places | `:100` `interstep`, `:108` `itemId`, `:119`/`:182` `transport`, `:139`/`:140` supply+demand, `:172` tiers | `PackagingPlanInput` covers exactly that set. |
| Every computed figure depends on **demand only** | `:145-170`, `:180-193`; `cargoSupply` written at `:89`, read nowhere outside the test | Supply is reported, never consumed. |
| The extraction plan already computes supply and takes demand | `extraction-plan.ts:53`, `:63` | Both packaging inputs are in hand at the panel. |
| Raw-feed demand is always a real `Fraction` | `graph-flow.ts:148`, `:656` | `materialDemand` is never null on the extraction path. |

## Persistence — the plan file goes to v9

**This is the correction that drove r2.** r1 proposed adding an optional field
with no `format_version` bump. That is wrong, and `plan-store.ts:22-35` states
the rule twice:

> *"a pre-Stage-10 build's v4 validator IGNORES … so a … file would validate under
> the old build and SILENTLY DROP both … A v5 header makes the old build reject
> the file loudly (load → null) instead."*

**The mechanism, verified:** `isPlanFileV8` gates on `format_version !== 8`
exactly (`:713`) and delegates to `isStageV7Shape` (`:1091-1117`, which adds only
the `purityMix` check) → `isStageV6Shape` (`:1062-1089`, where the named-field-only
extraction loop actually lives). An older build reading a v8 file carrying `packaging`
accepts it, drops the field, and re-saves without it.

**The old reader is real.** The app ships as a PWA with Workbox precache and
`registerType: 'prompt'` (`vite.config.ts:15-35`) — updating needs user action, so
older builds persist on devices, and the deployed Pages build is a second reader.

*(r1's ledger row "validators do not reject unknown fields — Verified" was the
reason the bump **is** required; r1 recorded it as the reason it was not. The
inversion is the root error, not the missing bump.)*

Following the `ExtractionSelectionV6` idiom (`:182-185`) exactly:

```ts
interface ExtractionSelectionV7 {            // NEW: freeze the current shape
  machineId: string;
  clockPercentText: string;
  purityMix?: PurityMixText;
}
export interface PlanStageV7 extends PlanStageV2 {
  userPlaced: boolean;
  extraction?: Record<string, ExtractionSelectionV7>;   // was the LIVE interface
}
export interface PlanStageV8 extends PlanStageV2 {      // NEW
  userPlaced: boolean;
  extraction?: Record<string, ExtractionSelection>;     // live, now with packaging
}
export interface PlanFileV9 {                            // NEW
  format_version: 9;
  /* …name, createdAt, updatedAt, flowDirection… */
  stages: PlanStageV8[];
  links: PlanLinkV8[];
}
```

- `PlanFileV8.stages` stays `PlanStageV7[]`, which now correctly means the frozen
  shape — this is the retroactive-meaning bug r1 would have introduced.
- **`isStageV8Shape`** = `isStageV7Shape` plus, when `packaging` is present,
  **`isPackagingInterstepShape`** (`:780-797`) — which already validates this exact
  payload with `hasExactKeys`, `isRawTransportShapeV8` and the illegal-route
  refusal. r1 proposed a `purityMix`-style named-field check, which would admit a
  malformed `returnTransport`; the correct validator already exists.
- `isPlanFileV9` gates on `9` and uses `isStageV8Shape`; `isPlanFileV8` keeps
  `isStageV7Shape`, so v8 acceptance is unchanged.
- **`migrateV8` must REBUILD each extraction selection field-by-field, not pass it
  through.** r2 said "a passthrough bump; a ≤v8 file cannot contain `packaging` by
  construction" — that **inverts this spec's own central finding one step further
  down the chain**, exactly as r1 did. If the v7/v8 stage validators check named
  fields only (they do), then a v8-headered file *can* carry `packaging`: a
  hand-edited or imported JSON with `format_version: 8` and a garbage `packaging`
  blob passes `isPlanFileV8`, is returned verbatim by `validatePlanFile` (`:303`),
  and a passthrough `migrateV8` delivers it into a `PlanFileV9` **having passed no
  `packaging` validation at all** — `isStageV8Shape` is reachable only from the
  `isPlanFileV9` arm. It then lands in live state via the shallow spread
  (`store.ts:758`) and is re-saved as a v9 row `isStageV8Shape` will *reject*: the
  app writes a row it can never read back. That directly falsifies this spec's own
  criterion "a malformed blob is rejected, not admitted".
  The codebase idiom is rebuild-not-passthrough for precisely this reason:
  `migrateV3:382-398` rebuilds each transport, `migrateV7:436-443` rebuilds each
  link field-by-field (silently dropping a smuggled `interstep`), and
  `copyHistoricalExtraction:494-506` rebuilds each selection.
- **`migrateV7:435` is the same hole.** It passes `stages: plan.stages` **verbatim**
  while rebuilding `links` field-by-field, so a *v7*-headered file reaches v9
  through the identical gap. It needs the same rebuild.
- Save writes v9; reads accept v1–v9.

## Design

**One shared core, two callers.** Extract the pure body of `deriveLinkPlan`:

```ts
export interface PackagingPlanInput {
  itemId: string;
  intent: PackagingInterstep;
  forwardTransport: LinkTransport | undefined;
  materialSupply: Fraction | null;
  materialDemand: Fraction | null;
  unlockedTiers: { belt: number; pipe: number };
}
export function derivePackagingPlan(
  catalog: LinkPlanCatalog,
  input: PackagingPlanInput,
): DerivedLinkPlan;
```

`deriveLinkPlan(catalog, link, stages)` keeps its signature and becomes a thin
adapter resolving supply, demand and tiers from `stages` exactly as today.
**`intent` is non-optional on the input, so the adapter must retain the
`interstep === undefined` early return and its
`"packaging interstep is not enabled"` string (`:101-106`)** — easy to lose in the
split.

The extraction path calls `derivePackagingPlan` with `materialSupply` = the
extraction plan's `totalSupply`, `materialDemand` = the raw feed's demand, and
`forwardTransport: undefined` (auto by tier; `computeLinkTransport` already
accepts an absent transport, `:180-186`).

**Why not synthesise a degenerate link.** Not because it would lose supply —
`cargoSupply` is displayed nowhere — but because encoding a raw feed as a link
with a `fromStageId` that resolves to nothing is exactly the shape the epic's
constraint warns against.

### State

**The write boundary must canonicalize, and r3 missed it.** The link path does not
trust its UI: `setLinkInterstep` runs every incoming payload through
`canonicalizePackagingInterstep` (`store.ts:1834`; `link-transport.ts:168-183`),
which *rebuilds* the object, canonicalizes `returnTransport` via
`canonicalizeLinkTransport` (`:101-165`), and **returns null for a pipe /
fluid-truck return route, dropping the write** (`store.ts:1835`). That rebuild is
why the strict `hasExactKeys` in `isPackagingInterstepShape` is satisfiable at all.

The extraction path writes through `setExtractionSelection` (`store.ts:1608-1633`),
which only spreads via `copyExtractionSelection`, and `savePlan` is a bare
`db.put` (`plan-store.ts:261-264`) — no validation. So a stale key left by the
return-transport selector, or an illegal `pipe` choice, would reach IndexedDB
unvalidated and surface on the *next* load as a refusal of **the entire plan**.

**Therefore: route the extraction packaging write through
`canonicalizePackagingInterstep`, exactly as `setLinkInterstep` does.** Not
optional, and not an implementation detail.

`ExtractionSelection` (`store.ts:101-105`) gains `packaging?: PackagingInterstep`,
reusing the type verbatim (`link-transport.ts:34-41`). **Three sites carry it:**

1. `store.ts:113-120` `copyExtractionSelection` — a deep-copy arm, matching the
   `purityMix` idiom, so the nested `returnTransport` is not aliased across copies.
2. `ui/extraction-plan.ts:7-11` — a **second structural declaration** of
   `ExtractionSelection`, the type of `deriveExtractionPlan`'s `selection` param.
3. `GraphCanvas.tsx:362-372` `setMachine` — see below.

### UI

**Inside the `result.status === "planned"` block** (`GraphCanvas.tsx:477-580`),
**after the water-gated purity fragment closes at `:578`** — i.e. between `:578`
and `:579`.

Two boundaries, both load-bearing, and r2 named only one:
- *not* between `:580` and `:581` — outside the planned block, so it would render
  with `selection === null` and nowhere to write;
- *not* "below the purity fields" as r2 said — the purity fragment is wrapped in
  `{rawNode.data.itemId !== "water" && (` at `:504`, so that region is **excluded
  for water**. Water is the motivating case and acceptance criterion #1. r2 would
  have hidden the feature from the exact input it exists for, and nothing in the
  verification plan would have caught it: the browser harness cannot cover the
  visible water case, and no test touches panel placement.

- **Gate:** `selection !== null` **and**
  `pairs.length > 0 || selection.packaging !== undefined` — the second arm mirrors
  `packagingOptionsFor` (`LinkInspector.tsx:98-104`) so a configured interstep
  stays visible, and clearable, when a user-uploaded catalog no longer resolves
  its pair.
- Enabled: packager recipe select (when >1 pair), clock % field, return-transport
  mode — mirroring `LinkInspector.tsx:194-216`, with the same initial shape
  (`:206-210`). **The initial `returnTransport` MUST be belt (r5, adversarial
  INFO hardened to a requirement):** the link path self-heals a bad seed by
  forcing belt on first enable (`store.ts:2064-2069`); the extraction path has
  no such heal — `canonicalizePackagingInterstep` returns null on an illegal
  route and would silently drop the enabling write forever.
- Reports Packager/Unpackager counts, power, packaged cargo rate,
  empty-container return rate, and both routes.

**`setMachine` must carry `packaging`.** `GraphCanvas.tsx:362-372` rebuilds the
selection field-by-field with an explicit `purityMix` arm and no `...selection`;
without a matching arm, changing the extractor silently discards packaging. The
clock input (`:454-459`) and both purity setters (`:377-393`) already spread — this
is the one exception.

**A note on Resource Well items.** `nitrogen_gas` has a raw-feed card and an
opening panel but **no standalone extractor**, so `selection` stays `null`
permanently while `discoverPackagingPairs` is non-empty for it. Under the gate
above it therefore shows no packaging control. That is correct and follows from
Michael's decision — packaging sits *under the extractor plan*, and an item that
cannot be planned has no plan to sit under. It is consistent with the panel's
existing refusal to plan it — the `unavailable` arm at `:469-471`, fed by
`resourceWellDetail` (`extraction-plan.ts:285-294`) and pinned by
`GraphCanvas.dom.test.tsx:614-628`. *(Not `:581`, which is the one branch that
explicitly **excludes** `nitrogen_gas`.)*

## Changes

1. `core/link-plan.ts` — extract `derivePackagingPlan`; `deriveLinkPlan` becomes
   an adapter. No behaviour change on the link path.
2. `state/store.ts` — `packaging?` on `ExtractionSelection`; deep-copy arm in
   `copyExtractionSelection`.
3. `ui/extraction-plan.ts` — the field on the second declaration; surface the
   packaging plan alongside the extractor plan.
4. `data/plan-store.ts` — `ExtractionSelectionV7` frozen, `PlanStageV8`,
   `PlanFileV9`, `isStageV8Shape` (via `isPackagingInterstepShape`),
   `isPlanFileV9`, a **rebuilding** `migrateV8`, the `migrateV7` stage rebuild,
   `listPlans`' hardcoded validator chain (`:271-293`), `copyHistoricalExtraction`'s
   declared return type re-typed to the frozen alias (`:494-496`), and the stale
   header comment (`:19-20`).
5. `state/store.ts` — **this is where "save writes v9" actually lives**: the
   `format_version` literals are `:2209` and `:2220` (re-anchored r5 after the
   P0-P2 shift), not in `plan-store.ts` (`savePlan:261` only takes the file). Also `PlanBundle.plans` (`:387`) and the
   type annotations at `:727`, `:1260`, `:1269`, `:1277`, `:2076`, `:2127`. All
   caught by `npm run check`, so churn rather than silent defect — but r2's change
   list understated it.
5. `ui/GraphCanvas.tsx` — the panel UI, the gate, and the `setMachine` arm.
6. Tests — below.

## Tests

**r1 claimed "`link-plan.test.ts` passes untouched" was the pin on the refactor.
It is not**, and both reviewers said so. Two specific gaps, both verified:

- **`unlockedTiers` is fixture-degenerate.** `link-plan.test.ts:236-242` stamps
  `{belt: bundled.tiers.belt.length, pipe: bundled.tiers.pipe.length}` — textually
  the value `globalUnlockedTiers` falls back to when `stages` is empty
  (`link-plan.ts:231-237`). An adapter that ignored `stages` entirely would pass
  every test, while a user with belt tier 2 unlocked silently gets all six.
- **The null supply/demand branch is never exercised.** All nine calls build both
  endpoints solved with a matching lane, so `materialDemand === null` at `:145` —
  `status: "ready"` with null machines and power — is never asserted. That branch
  is what the adapter's resolution step feeds.

New tests required:

1. `deriveLinkPlan` with **decorrelated** `unlockedTiers` (e.g. `{belt: 2, pipe: 1}`
   against a catalog with more tiers), pinning that the adapter reads `stages`
   rather than falling back. *(Only the **tiers** read is fixture-degenerate —
   supply and demand also come from `stages` and are asserted at
   `link-plan.test.ts:23-27`, `:48-52`. r2's "an adapter that ignored `stages`
   entirely would pass every test" overstated it.)*
2. `deriveLinkPlan` with an unsolved endpoint, pinning the null-demand branch.
3. `derivePackagingPlan` called directly with explicit supply/demand, pinning
   parity with the adapter on the same inputs.
4. Round trip: save → load with `packaging`, and a v8 file loading forward.
5. A malformed `packaging` blob is **rejected** by `isStageV8Shape`.
6. Extractor change preserves `packaging`.
7. **A v8 file carrying a garbage `packaging` blob is stripped by `migrateV8`,
   not admitted** — the blocker above, and the one test that would have caught it.
8. Re-point `plan-store.test.ts:679-684` and `:898-901`, which assert that
   `format_version: 9` on a v8 body is rejected; under v9 that payload is valid, so
   both must move to `10`.
9. **~17 further assertions pin 8 as the migration/save/export target**
   (re-anchored r5; treat this as a CONTENT sweep — re-grep both files, never
   the line list) — `plan-store.test.ts:105`, `139`, `197`, `528`, `683`,
   `704`, `1053`, `1148`, `1282`, `1330`; `store.test.ts:2069`, `2377`,
   `3492`, `3528`, `3538`, `3572`, `3889`. Two of the store.test.ts pins are
   NOT `.toBe(8)`-shaped: `:3538` is a string-literal
   `toContain('\n  "format_version": 8')` and `:3889` an `=== 8` envelope
   pin. **Two are not bookkeeping:** `store.test.ts:2069`
   (`written.format_version`) and the export pins are what catch a
   passthrough `migrateV8` once updated. The stale header comment at
   `plan-store.ts:19-20` and `listPlans`' "all eight versions" (`:277`) go too.
10. **Pin the early return.** The one thing this spec calls "easy to lose in the
    split" — the `interstep === undefined` guard and its
    `"packaging interstep is not enabled"` string (`link-plan.ts:101-106`) — appears
    in no test, and both production call sites guard on `interstep !== undefined`
    (`LinkInspector.tsx:150-151`, `store.ts:626-630`), so losing it would be
    invisible to `npm test` *and* to the app. One assertion closes it.
11. **A test that a freshly saved plan has `format_version === 9`** — no listed
    test pinned it, and the round-trip test passes either way because
    `isStageV7Shape` admits the unknown key and `store.ts:758` spreads it through.

## Acceptance criteria

- The Wet Concrete case: the Water raw feed's Extraction panel offers packaging,
  and enabling it reports Packagers, Unpackagers, power, packaged cargo rate and
  empty-container return rate.
- An item with no packager pair and no saved config shows **no** packaging control;
  an item with a saved config shows it even if the pair no longer resolves.
- A Resource Well item (no standalone extractor) shows no packaging control.
- **Changing the extractor preserves the packaging config.**
- `deriveLinkPlan`'s behaviour is unchanged, pinned by the new decorrelated and
  null-branch tests — not by the existing suite alone.
- Packaging config survives save → load; a v8 file still loads; a **v9 file is
  rejected loudly by a v8 validator** (the whole point of the bump).
- A malformed `packaging` blob is rejected, not admitted.
- `npm test`, `npm run check`, `npm run build` green; both browser matrices green.
- **Bidirectionality:** every new test fails with its production code reverted,
  captured in `features/raw-packaging/r2-verification.log`.

## Out of scope

- The solve. Packaging is reporting; no Packager cycle enters the factory graph.
- Any change to `StageLink` or the link packaging UI.
- Forward-transport configuration on the extraction side (auto by tier).

## Assumptions ledger

| Assumption | Grounding |
|---|---|
| `StageLink` is untouched | **Verified** — separate declarations; `LinkPlanLink` referenced only in `link-plan.ts` + its test. `StageLink` stays assignable to it, which keeping the adapter signature preserves |
| Supply is not needed for any computed figure | **Verified** — `:145-170`, `:180-193` read demand; `cargoSupply` read nowhere outside the test |
| The `format_version` bump is required | **Verified** — the rule at `plan-store.ts:22-35`, the exact-match gate at `:713`, the named-field-only stage checker at `:1091-1117`, and a PWA with `registerType: 'prompt'` (`vite.config.ts:15-35`) putting old readers on devices |
| `isPackagingInterstepShape` validates the payload adequately | **Verified** — `:780-797`: `hasExactKeys` + `isRawTransportShapeV8` + illegal-route refusal |
| `copyHistoricalExtraction` cannot drop `packaging` | **Verified, corrected** — it is reachable for **any file ≤ v6** (`migrateV6` at `:423`, reached from `:305`), *not* pre-v5-only as r1 said. The conclusion holds because `ExtractionSelectionV6` (`:182-185`) is frozen without the field, so a ≤v6 file cannot carry it |
| `setMachine` would drop the field without an arm | **Verified** — `GraphCanvas.tsx:362-372` has no `...selection`. Every other copy site spreads and carries it automatically (`store.ts:758`, `:1621`, `:1977`, `GraphCanvas.tsx:378`/`383`/`391`/`455`) |
| `StageLink` is passed to `deriveLinkPlan` at **four** sites, not two | **Verified, corrected** — `LinkInspector.tsx:151`, `store.ts:630`, `graph-flow.ts:484`, `:535`. This strengthens the assignability conclusion |
| `materialSupply` = the extraction plan's `totalSupply` | **Underspecified** — `deriveExtractionPlan` returns two: top-level `totalSupply` (`extraction-plan.ts:162`) and `purity.totalSupply` (`:200`, `:227`), which diverge when a node mix is configured. Harmless today because `cargoSupply` is displayed nowhere, but the implementer must pick the top-level one |
| The existing `link-plan.test.ts` is **not** a sufficient pin | **Verified** — degenerate `unlockedTiers` fixture (`:236-242`) and no null-demand coverage |
| The extraction browser harness cannot cover the visible case | **Verified** — its catalog has `recipes: {}` and only `stone` (`extraction-panel-browser-harness.tsx:18-52`), so `discoverPackagingPairs` is empty there. It can cover the hidden case; the visible (water) case needs a fixture or is covered by unit tests instead |

## Revision history (arc-era)

- **r4 → r5** (the fresh r4 gate the r2 disposition required, run 2026-08-19
  as P4 of the #140 arc, doubled as post-arc revalidation @ bee9544):
  code-reviewer APPROVED_WITH_NITS (2 — both stale line lists), adversarial
  APPROVED (3 NIT/INFO). The never-gated r3/r4 folds verified sound against
  live source (the rebuild migrations; the canonicalized extraction write);
  the third-instance hunt (the re-inversion class that produced r1 and r2's
  blockers) found the class CLOSED at the validatePlanFile chokepoint — no
  fourth unguarded ingress; tier flow confirmed undrifted by P0/P1
  (extraction-plan carries stage.selection.unlockedTiers, same clamped source
  as the link path); the 17-pin sweep count reconciled exactly with
  re-anchored lines. Folded: §Changes.5 + §Tests.9 re-anchored (content-sweep
  discipline stated), the belt-initial-returnTransport INFO hardened to a
  requirement. §Tests.8's v10 flip re-confirmed load-bearing. r5 goes to the
  one-shot simplify pass (the correctness pair converged this round).
