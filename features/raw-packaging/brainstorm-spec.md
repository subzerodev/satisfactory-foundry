# #133 — Packaging for a raw input (Stage 23)

**Ticket:** #133 · **Epic:** #136 · **Milestone:** 94 · **Tier:** 2
**Status:** design r1

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
> transport surface on the raw card. The panel is already where he clicks and
> already holds the rate, extractor count and transport tier.

Carried constraints from epic #136:

- **Do not widen `StageLink` to cover raw feeds.** Plan v8 persistence and the
  solver's cycle guard both key off real links, and #113's reviews leaned on that.
- Behaviour-frozen: packaging is a **reporting layer**. It does not add a
  Packager cycle to the factory graph, exactly as the link case does not.

## What the code already gives us — verified, not assumed

| Fact | Source | Why it matters |
|---|---|---|
| `LinkPlanLink` is a **standalone structural type**, not `StageLink` | `core/link-plan.ts:40-46` vs `state/store.ts:136-143` — two separate declarations; `StageLink` does not extend it, and `LinkPlanLink` is referenced only in `link-plan.ts` and its test | Reusing the packaging math does **not** touch `StageLink`. The constraint is satisfiable without a workaround. |
| `effectiveLinkCargo(pair, materialSupply, materialDemand)` is **exported and pure** | `core/link-plan.ts:75-93` | The cargo/return-rate math already takes plain `Fraction`s. No link, no stages. |
| `stages` is used for exactly three lookups | `link-plan.ts:139` (supply), `:140` (demand), `:172` (global tiers) | Everything else in `deriveLinkPlan` (`:100-137`, `:142-194`) is pure over explicit values. |
| Every machine-count, power and transport figure depends on **demand only** | `link-plan.ts:145-170`, `:180-193` | Supply is a *reported* figure. A raw feed with unknown supply would still compute correctly. |
| The extraction plan **already computes supply** | `ui/extraction-plan.ts:53` `totalSupply: Fraction`, `:159-163` | Supply is known here; it does not need to be null. |
| Demand is already an input to the extraction plan | `extraction-plan.ts:63` `demand: Fraction` | Both packaging inputs are in hand at the panel. |
| Adding an optional field to `ExtractionSelection` **persists automatically** | `state/store.ts:1976-1978` passes `node.extraction` **wholesale** into `PlanStageV7` | No serializer change, no schema bump. `copyHistoricalExtraction` (`plan-store.ts:494-506`) copies field-by-field but is pre-v5-only, where packaging cannot exist. |
| The optional-field precedent is `purityMix` | `plan-store.ts:1091-1117` (`isStageV7Shape`) validates it as its own tier | Same pattern applies: a new validator tier for `packaging`. |

## Design

**One shared core, two callers.** Extract the pure body of `deriveLinkPlan` into
a function that takes supply and demand explicitly, and have both the link path
and the new extraction path call it.

```ts
// core/link-plan.ts
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
adapter: it resolves supply, demand and tiers from `stages` exactly as today,
then delegates. **Its behaviour is unchanged** — that is what the existing
`link-plan.test.ts` suite pins.

The extraction path calls `derivePackagingPlan` directly with:

- `materialSupply` = the extraction plan's `totalSupply`;
- `materialDemand` = the raw feed's demand (the panel's existing `demand` input);
- `forwardTransport` = `undefined`, so the packaged-cargo route is auto-selected
  by tier. There is no user-configured forward transport on the extraction side,
  and `computeLinkTransport` already accepts `undefined` (`link-plan.ts:180-186`
  passes `link.transport`, which is optional at `:44`).

**Why not synthesise a fake link.** Passing a `LinkPlanLink` with a
`fromStageId` that resolves to nothing would work — supply would come back
`null` — but it discards supply the panel already knows, and it encodes a raw
feed as a degenerate link, which is the shape the epic's constraint is warning
against.

### State

```ts
// state/store.ts — ExtractionSelection, currently :101-111
packaging?: PackagingInterstep;   // NEW, optional
```

Reuses `PackagingInterstep` verbatim (`core/link-transport.ts:34-41`:
`packageRecipeId`, `clockPercentText`, `returnTransport`). No new persisted type.

### UI

In `ExtractionPanel` (`ui/GraphCanvas.tsx:299-589`), below the existing extractor
plan and above the Resource Well disclaimer:

- a **"Package for transport"** checkbox, shown only when
  `discoverPackagingPairs(catalog, itemId)` is non-empty — i.e. only for items
  that actually have a packager pair (water does; ore does not);
- when enabled: the packager recipe select (when more than one pair exists), a
  clock % field, and the return-transport mode — mirroring `LinkInspector.tsx:194-216`;
- the resulting plan: Packager and Unpackager counts, power, packaged cargo rate,
  empty-container return rate, and both routes.

Enabling writes an interstep with the same initial shape `LinkInspector` uses
(`:206-210`): first discovered pair, `clockPercentText: "100"`,
`returnTransport: { mode: "belt" }`. Disabling clears the field.

## Changes

1. `core/link-plan.ts` — extract `derivePackagingPlan`; `deriveLinkPlan` becomes
   an adapter over it. No behaviour change on the link path.
2. `state/store.ts` — `packaging?: PackagingInterstep` on `ExtractionSelection`.
3. `data/plan-store.ts` — a validator tier for `packaging` (the `purityMix`
   precedent at `:1091-1117`), rejecting a malformed blob rather than admitting it.
4. `ui/extraction-plan.ts` — surface the packaging plan alongside the extractor
   plan, so the panel renders from one derived object.
5. `ui/GraphCanvas.tsx` — the panel UI above.
6. Tests — see below.

## Acceptance criteria

- The Wet Concrete case: opening the Water raw feed's Extraction panel offers
  packaging, and enabling it reports Packagers, Unpackagers, power, packaged
  cargo rate and empty-container return rate.
- An item with no packager pair shows **no** packaging control at all.
- `deriveLinkPlan`'s existing behaviour is unchanged — `link-plan.test.ts` passes
  untouched, which is the pin on the refactor.
- Packaging config survives save → load, including a plan saved without it.
- A malformed `packaging` blob is rejected by the plan validator, not admitted.
- `npm test`, `npm run check`, `npm run build` green; both browser matrices green.
- **Bidirectionality:** every new test fails with its production code reverted,
  captured in `features/raw-packaging/r2-verification.log`.

## Out of scope

- The solve. Packaging is reporting; no Packager cycle enters the factory graph.
- Any change to `StageLink`, the link packaging UI, or plan `format_version`.
- Forward-transport configuration on the extraction side (auto by tier).

## Assumptions ledger

| Assumption | Grounding |
|---|---|
| `StageLink` is untouched by reusing the math | **Verified** — `LinkPlanLink` (`link-plan.ts:40`) and `StageLink` (`store.ts:136`) are separate declarations; `grep` shows `LinkPlanLink` referenced only in `link-plan.ts` + its test |
| Supply is not needed for any computed figure | **Verified** — `link-plan.ts:145-170` and `:180-193` read `materialDemand` and `cargo.cargoDemand`/`containerReturnRate`; `cargoSupply` is returned, never consumed |
| A new optional field on `ExtractionSelection` persists | **Verified** — `store.ts:1976-1978` spreads `node.extraction` wholesale; the field-by-field copier at `plan-store.ts:494-506` is reachable only from the pre-v5 path (`:423`) |
| Validators do not reject unknown fields | **Verified** — `isStageV6Shape`/`isStageV7Shape` (`plan-store.ts:1062-1117`) check named fields only |
| `computeLinkTransport` accepts an absent forward transport | **Verified** — `LinkPlanLink.transport` is optional (`:44`) and passed straight through at `:182` |
| The extraction panel already knows supply and demand | **Verified** — `extraction-plan.ts:53` (`totalSupply`), `:63` (`demand` input) |
| No `format_version` bump is required | **Derived**, not measured — follows from the wholesale spread plus permissive validators. To be confirmed by the save→load test in the acceptance criteria |
