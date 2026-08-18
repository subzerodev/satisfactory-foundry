# #133 — Packaging for a raw input (Stage 23)

**Ticket:** #133 · **Epic:** #136 · **Milestone:** 94 · **Tier:** 2
**Status:** design r2

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
exactly (`:713`) and delegates to `isStageV7Shape`, which checks **named fields
only** (`:1091-1117`). An older build reading a v8 file carrying `packaging`
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
- `migrateV8(v8): PlanFileV9` — a passthrough bump; a ≤v8 file cannot contain
  `packaging` by construction.
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

`ExtractionSelection` (`store.ts:101-105`) gains `packaging?: PackagingInterstep`,
reusing the type verbatim (`link-transport.ts:34-41`). **Three sites carry it:**

1. `store.ts:113-120` `copyExtractionSelection` — a deep-copy arm, matching the
   `purityMix` idiom, so the nested `returnTransport` is not aliased across copies.
2. `ui/extraction-plan.ts:7-11` — a **second structural declaration** of
   `ExtractionSelection`, the type of `deriveExtractionPlan`'s `selection` param.
3. `GraphCanvas.tsx:362-372` `setMachine` — see below.

### UI

**Inside the `result.status === "planned"` block** (`GraphCanvas.tsx:477-580`),
below the purity fields — *not* between `:580` and `:581`, which is outside the
block and would render with `selection === null` and nowhere to write.

- **Gate:** `selection !== null` **and**
  `pairs.length > 0 || selection.packaging !== undefined` — the second arm mirrors
  `packagingOptionsFor` (`LinkInspector.tsx:98-104`) so a configured interstep
  stays visible, and clearable, when a user-uploaded catalog no longer resolves
  its pair.
- Enabled: packager recipe select (when >1 pair), clock % field, return-transport
  mode — mirroring `LinkInspector.tsx:194-216`, with the same initial shape
  (`:206-210`).
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
existing Resource Well refusal (`:581`), not a new limitation.

## Changes

1. `core/link-plan.ts` — extract `derivePackagingPlan`; `deriveLinkPlan` becomes
   an adapter. No behaviour change on the link path.
2. `state/store.ts` — `packaging?` on `ExtractionSelection`; deep-copy arm in
   `copyExtractionSelection`.
3. `ui/extraction-plan.ts` — the field on the second declaration; surface the
   packaging plan alongside the extractor plan.
4. `data/plan-store.ts` — `ExtractionSelectionV7` frozen, `PlanStageV8`,
   `PlanFileV9`, `isStageV8Shape` (via `isPackagingInterstepShape`),
   `isPlanFileV9`, `migrateV8`; save writes v9.
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
   rather than falling back.
2. `deriveLinkPlan` with an unsolved endpoint, pinning the null-demand branch.
3. `derivePackagingPlan` called directly with explicit supply/demand, pinning
   parity with the adapter on the same inputs.
4. Round trip: save → load with `packaging`, and a v8 file loading forward.
5. A malformed `packaging` blob is **rejected** by `isStageV8Shape`.
6. Extractor change preserves `packaging`.

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
| `setMachine` would drop the field without an arm | **Verified** — `GraphCanvas.tsx:362-372` has no `...selection` |
| The existing `link-plan.test.ts` is **not** a sufficient pin | **Verified** — degenerate `unlockedTiers` fixture (`:236-242`) and no null-demand coverage |
| The extraction browser harness cannot cover the visible case | **Verified** — its catalog has `recipes: {}` and only `stone` (`extraction-panel-browser-harness.tsx:18-52`), so `discoverPackagingPairs` is empty there. It can cover the hidden case; the visible (water) case needs a fixture or is covered by unit tests instead |
