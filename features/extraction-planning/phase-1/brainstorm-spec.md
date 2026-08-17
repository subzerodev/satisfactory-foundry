# Extraction planning Phase 1 - brainstorm/spec candidate r6

**Ticket:** #112
**Epic:** #114
**Milestone:** Stage 22 (93)
**Status:** frozen after r6 correctness convergence and one-shot parsimony review
**Scope:** normal-purity requirement only

## Goal

Click a visible raw-input card and answer, from the stage's exact unresolved
demand: which normal-purity extractor is used, how many are required at the
chosen clock, how much they supply and draw, and whether each extractor's one
output can fit the plan's currently unlocked belt or pipe.

For Michael's Wet Concrete example, Limestone at 12,720/min with Miner Mk.3 at
100% must report exactly 53 miners. Water at 10,600 m3/min with Water Extractors
at 100% must report 89 extractors. The total requirement is never compared to a
single output belt or pipe; saturation is checked per extractor output.

## Settled Boundaries

- Requirement-first, normal purity, selected extractor, clock, and saturation
  are locked by Michael on #112.
- Phase 2 owns Impure/Normal/Pure mixing. No Phase 2 editor, state shape, or
  implementation plan is specified here.
- The raw feed remains a derived display node. It does not become a production
  stage or a connectable React Flow node.
- Nitrogen Gas is not a solid and is never offered a Miner.
- Resource Wells are a pressurizer-plus-satellites topology. Phase 1 identifies
  them explicitly but does not convert their nominal satellite rate into a
  buildable count without well/node inventory.

## Source Grounding

### Existing application seams

1. `src/ui/graph-flow.ts:548-630` already derives one raw node from each solved,
   unlinked `FGResourceDescriptor` input and reads the exact
   `FeedLaneResult.totalDemand`; this is the authoritative requirement.
2. `src/ui/graph-flow.ts:126-164` keeps raw nodes separate from persisted stage
   nodes, while `src/ui/GraphCanvas.tsx:429-464` appends them only at the React
   Flow render boundary. This remains intact.
3. `src/ui/GraphCanvas.tsx:178-216` is the current thin raw-card renderer. Its
   no-control posture changes only by adding an accessible open button.
4. `src/data/types.ts:48-78` and `src/data/docs-loader.ts:105-114,315-343`
   already parse exact per-machine power and exponent; `src/ui/advice.ts:87-112`
   already owns the labeled float boundary for overclocked power.
5. `src/data/tiers.ts` is the single belt/pipe throughput table, and every
   stage already carries unlocked tier-prefix counts in `Selection`.
6. `src/ui/advice.ts:21-43` already provides exact ceil count plus surplus for a
   demand and per-machine rate. Phase 1 reuses that helper.
7. `src/data/plan-store.ts:1-27,142-174` establishes that plan files persist user
   intent and bump format when an older reader would silently drop new intent.

### Structured game data

Direct reads of `public/bundled-docs/en-US.json` establish that extractor rates
need no description parsing and no curated normal-rate constants:

| Building | Structured fields | Exact normal rate | Power |
|---|---|---:|---:|
| Miner Mk.1 | 1 item / 1.0 s | 60/min | 5 MW |
| Miner Mk.2 | 1 item / 0.5 s | 120/min | 15 MW |
| Miner Mk.3 | 1 item / 0.25 s | 240/min | 45 MW |
| Oil Extractor | 2000 L / 1.0 s | 120 m3/min | 40 MW |
| Water Extractor | 2000 L / 1.0 s | 120 m3/min | 20 MW |
| Resource Well Extractor | 1000 L / 1.0 s | 60 m3/min nominal | 0 MW |
| Resource Well Pressurizer | no per-cycle output | not a standalone rate | 150 MW |

The exact rate formula is `mItemsPerCycle * 60 / mExtractCycleTime`, with the
same exact `/1000` normalization already used for fluid recipe amounts in
`src/data/docs-loader.ts:402-409`.

The applicability fields are also structured:

- Miners: `mAllowedResourceForms=(RF_SOLID)` and no restricted resource list.
- Oil Extractor: `RF_LIQUID`, restricted to `Desc_LiquidOil_C`.
- Water Extractor: `RF_LIQUID`, restricted to `Desc_Water_C`.
- Resource Well Extractor: `RF_LIQUID,RF_GAS`, restricted to Crude Oil,
  Nitrogen Gas, and Water.

The current building regex admits `FGBuildableResourceExtractor` (miners/oil)
but not `FGBuildableWaterPump` or `FGBuildableFrackingExtractor`. Phase 1 must
widen that parser boundary before the UI can make honest decisions for Water
and Nitrogen. `FGBuildableFrackingActivator` remains outside the catalog: Phase
1 does not calculate Resource Well setups, so admitting an otherwise unused
support building would add parser/cache surface without a consumer.

## Approaches Considered

### A. Parsed extractor index plus a focused raw-card panel - recommended

Parse structured extractor capabilities into the catalog, derive a pure
requirement result, and open a compact panel from the raw card. Persist only the
selected extractor ID and clock text per stage/raw item.

This reuses the exact demand, power, tier, and plan-intent seams already present.
It keeps React Flow display-only while making the user's choices durable.

### B. Turn extractors into ordinary production stages

This would reuse machine cards but would invent recipes for extraction, add
connectable graph state, change chain-builder raw termination, and make Resource
Wells look like ordinary manufacturers. It is rejected because extraction is a
requirement attached to a raw boundary, not another recipe stage.

### C. UI-side static extractor table

This has the smallest initial diff, but duplicates rates and applicability that
the uploaded Docs.json already carries. It also makes user-provided game data
unable to update extraction planning. It is rejected by the zero-curated-
constant and source-grounding requirements.

## Proposed Data Contract

Add a required catalog map, keyed by machine ID:

```ts
interface CatalogExtractor {
  machineId: string;
  topology: "standalone" | "resource-well";
  normalRate: Fraction;
  itemIds: string[];
}

interface Catalog {
  // existing fields...
  extractors: Record<string, CatalogExtractor>;
}
```

`itemIds` is a fully materialized applicability list. Restricted extractors use
the normalized `mAllowedResources` references. For an unrestricted extractor,
the parser post-processes all parsed `FGResourceDescriptor` items against the
extractor's allowed forms; the current shipped unrestricted case is the miners'
`RF_SOLID`. Resource form is retained only in the parser's temporary records, so
`CatalogItem` does not gain another field. This post-process is source-order
independent: Docs.json need not place item groups before building groups.

The topology comes from the admitted native building family:

- `FGBuildableResourceExtractor` and `FGBuildableWaterPump` -> `standalone`
- `FGBuildableFrackingExtractor` -> `resource-well`

The pressurizer remains source-grounded context, not a `CatalogMachine`, because
it has no Phase 1 calculation. A future full Resource Well phase must decide its
own parsed contract instead of Phase 1 pre-building one.

The parser rejects an admitted extractor with missing, malformed, or non-positive
`mItemsPerCycle`/`mExtractCycleTime`. A plausible-looking zero is worse than a
loud upload error. Unknown resource-form tokens are also a named parse error for
that extractor. Restricted resource references are normalized and materialized;
an unrestricted extractor's forms are matched only against raw resources. This
follows the existing loud recipe-duration boundary.

`mOnlyAllowCertainResources` is textual in Docs.json. Parse exactly `"True"` or
`"False"`; reject a missing or any other value for an admitted extractor. Never
use JavaScript truthiness because `"False"` is truthy. When it is `"True"`,
require `mAllowedResources` to parse as a non-empty list of valid normalized raw
resource references; missing, empty, malformed, or unresolved references reject
the catalog. When it is `"False"`, derive applicability from the strictly parsed
allowed forms and raw resource descriptors, not from a restricted list.

`CATALOG_PARSER_VERSION` moves 5 -> 6. `StoredCatalogData`, serializer, and
reviver all carry the extractor map and exact rate strings. A version-5 cache is
stale and follows the existing bundled-refetch/user-reupload behavior.

No prose descriptions are parsed. No normal extraction rate is hardcoded.

## Pure Requirement Derivation

Create `src/ui/extraction-plan.ts`, with no React or store imports. It owns:

1. Candidate filtering by membership in `CatalogExtractor.itemIds` and
   `topology === "standalone"`. The same two checks validate a persisted
   selected extractor before any count or power derivation. A resource-well
   machine ID imported for Water or Crude Oil returns the explicit unavailable
   Resource Well result rather than dividing its nominal satellite rate. A
   standalone extractor that does not list the current raw item, such as Oil
   Extractor persisted for Water, is likewise unavailable and never derives a
   count, transport status, or power.
2. Clock parsing as an exact `Fraction` in `(0, 250]`, using the same messages
   and boundary as ChainBuilder's clock control.
3. `perExtractor = normalRate * clock / 100` at Normal purity.
4. `suggestSupply(demand, perExtractor)` for exact integer count and surplus.
5. Power text via `stagePowerText(machine.power, count, clock)`; exact at 100%,
   labeled `approximately` by the existing `≈` renderer at other clocks.
6. Output transport status by scanning the relevant full tier table in
   ascending order for the smallest capacity `>= perExtractor`, then comparing
   it with the target stage's unlocked prefix.

   **Superseded during implementation (`c8828d2`, recorded in `../FEATURE.md`
   "Phase 1 Diff Parsimony Disposition"):** the scan reads `catalog.tiers`, not
   the global `TIER_TABLE`. Both catalog parse/revive constructors
   (`src/data/docs-loader.ts`, `src/data/catalog-store.ts`) stamp the same
   constant, so values are unchanged on every path that reaches this code, but the
   capacity and its label now resolve from one table. (A third `Catalog` literal
   with empty tiers exists in `GraphCanvas.tsx` for the no-catalog render; it only
   feeds `graphToFlow`, and the extraction panel renders solely when a catalog is
   loaded.) Pinned by probe 11 in `r2-verification.log`.

The transport comparison is deliberately per extractor. Fifty-three miners at
240/min require fifty-three machine outputs that may be merged downstream; they
do not require one 12,720/min belt. The planner must never emit a total-demand-
versus-one-belt warning from this feature.

Result arms are explicit:

```ts
// Superseded during implementation (`c8828d2`): the `pick-extractor` arm no
// longer carries `candidates` -- it had no production consumer, since
// GraphCanvas derives `standaloneExtractors` itself. See `../FEATURE.md`
// "Phase 1 Diff Parsimony Disposition".
type ExtractionPlan =
  | { status: "pick-extractor"; candidates: CatalogExtractor[] }
  | { status: "invalid-clock"; detail: string }
  | { status: "unavailable"; detail: string }
  | {
      status: "planned";
      count: number;
      perExtractor: Fraction;
      totalSupply: Fraction;
      surplus: Fraction;
      powerText: string;
      transport: ExtractionTransportStatus;
    };
```

A safe-integer overflow from the reused count helper is caught at this boundary
and returned as `unavailable`; it never crashes React.

## State and Plan Persistence

The open panel ID is component-local UI state in `GraphCanvas`; it has no plan
meaning. The selected extractor and clock do have plan meaning and persist on
the owning stage:

```ts
interface ExtractionSelection {
  machineId: string;
  clockPercentText: string;
}

interface StageNode {
  // existing fields...
  extraction?: Record<string, ExtractionSelection>; // keyed by raw item ID
}
```

Absence means the user has not selected a setup. Water and Crude Oil, which each
have one standalone choice, are auto-seeded at `100` when their panel first
opens and no entry exists; an existing but unavailable selection is never
overwritten. Solids remain explicitly unselected until the user chooses Miner
Mk.1, Mk.2, or Mk.3. Merely rendering a raw card does not mutate state.

Add one store action that atomically sets or clears a stage/item extraction
selection. It validates no catalog semantics; derivation handles a machine that
disappears after a Docs.json replacement as an unavailable selection and asks
the user to choose again. Removing a stage removes its selections with the
stage. Recipe changes retain every keyed selection; entries for inputs absent
from the current recipe stay inert and are persisted so swapping back restores
the user's prior setup. They have no derived or rendered effect while their raw
card is absent.

Plan files move from v5 to v6 because an older build would otherwise accept the
file and silently discard extraction intent. `PlanStageV6` adds optional
`extraction`; save always writes v6; v5 and older migrate through the existing
chain with extraction absent. The v6 validator requires non-empty item and
machine IDs and a string `clockPercentText`. Like the existing stage clock, raw
editing text is valid plan intent even when it does not currently parse; derive
time owns the `(0,250]` error. Saving midway through an invalid edit must
round-trip that text rather than make the whole plan unloadable.

V6 removes the fragile external placement-origin flag by making
`PlanStageV6.userPlaced: boolean` required. Every successful validation/migration
returns a fully explicit v6 file before any caller can save, import, rename,
bundle, or export it:

- v6 validates the required boolean;
- v5->v6 maps `entry.userPlaced === true` and preserves auto versus pinned;
- v1-v4->v6 materializes the legacy conservative rule from the **original**
  source entry: an original saved position becomes `userPlaced: true`, while a
  positionless entry is false. Positions synthesized by later migration steps
  must not be mistaken for original placement intent.

`rebuildFromPlan` then reads only the required boolean; `loadPlanWithOrigin` and
`wasV5` are deleted rather than renamed. Because placement intent is embedded in
the v6 value, immediate persistence by single import, bundle import, legacy-row
rename, save-over, or export cannot erase its origin. Update every explicit
format enumeration, including `listPlans`, validation, load/import docs, and
tests, to recognize v6 first and migrate v5 and older into this explicit shape.

## Exact live raw-demand path

Extend `RawFlowNode.data` with structured identity and demand alongside the
existing display strings:

```ts
data: {
  stageId: string;
  itemId: string;
  demand: Fraction;
  itemName: string;
  rateText: string;
}
```

`deriveRawFeeds` copies `feed.totalDemand` directly and never reconstructs a
rate from `rateText`. GraphCanvas stores only the open identity
`{ stageId, itemId }`, not a click-time demand snapshot. On every render it finds
that identity in the current derived `rawFeedNodes` and derives the panel from
the current exact demand, catalog, selection, and extraction intent. A missing
raw node closes the panel. Any upstream solve change while the panel remains
open recomputes the result from the new exact demand without another click. At
the React Flow boundary, GraphCanvas augments each ephemeral raw node's data
with its local open callback; the pure graph derive remains callback-free.

## Interaction and Presentation

The fixed-size raw node keeps its source handle and its non-draggable,
non-selectable, non-deletable React Flow flags. At the React Flow prop boundary,
each raw wrapper also sets `style.pointerEvents = "all"` and `focusable = false`:
XYFlow otherwise disables pointer events without a node callback and keeps the
wrapper in the tab order. Its content becomes the sole keyboard-reachable button
(`nodrag nopan`) with `aria-haspopup="dialog"` and an accessible name such as
`Plan extraction for Limestone, 12720 per minute required`.

Click/Enter/Space opens a compact work region in the canvas top-right stack. The
canvas renders one `Panel position="top-right"` whenever either `canvasNotice`
or extraction is present. Inside it, an unframed `.graph-top-right-stack`
vertically lays out the notice first and extraction region second with a fixed
gap. This replaces the standalone notice Panel, so two identically positioned
XYFlow Panels cannot overlap. The extraction region is not a nested card or
modal. It is a labeled non-modal dialog region and moves focus to its first
control. It contains:

The stack always has a bounded height and internal vertical scrolling so it
stops above the bottom-left React Flow controls and bottom-right chain-power
panel. Desktop top-right content is capped at 260px. At canvas widths `<=720px`,
it additionally clears the horizontal top-left `+ stage` / flow-direction row,
fits the canvas width minus side gutters, and caps at 170px; on the app's 340px
minimum-height canvas this leaves explicit top and bottom control zones. The
mobile browser gate inspects 360px and 720px widths at 340px canvas height with
chain power present, covering notice-only, extraction-only, and combined states.

- `EXTRACTION - <item>` heading and icon close button with tooltip;
- exact requirement line;
- Extractor select (empty first option for solids; single Water/Oil choice
  auto-seeded on first open);
- Clock % text input;
- result count, per-extractor rate, supplied total, spare rate, output transport
  tier/status, and power.

Example at 100%:

```text
EXTRACTION - LIMESTONE
12,720/min required
Extractor  Miner Mk.3
Purity     Normal
Clock %    100

53 x Miner Mk.3
240/min each - 12,720/min supplied - 0/min spare
Output: Mk3 belt or better
Power: 2385 MW
```

If only Mk4 belts are unlocked and Miner Mk.3 is set to 250%, the count remains
valid but transport warns that each 600/min output needs Mk5. Unlocking Mk5
removes that warning. The stage manifold is not mutated by the panel.

The panel closes when its raw node ceases to exist (for example, an incoming
stage link suppresses that raw card), on its close button, or when another raw
card opens. Focus returns to the opener on close when the opener still exists.

## Resource Well and Nitrogen Contract

Resource-well candidates are never included in the standalone extractor select.
For Water and Crude Oil, the panel computes the Water/Oil Extractor setup and
also states that a Resource Well alternative is not counted in Phase 1 because
it needs a pressurizer plus a map-specific set of satellite nodes.

For Nitrogen Gas there is no standalone candidate. The entire result is:

> Nitrogen Gas requires a Resource Well Pressurizer and satellite Resource Well
> Extractors. Phase 1 cannot derive a buildable count without a specific well and
> its satellite nodes; no Miner estimate is shown.

The panel does not display a satellite count. Dividing the nominal 60 m3/min
rate into total demand would ignore per-well topology and availability. If the
product requires a full Resource Well planner, it is a separately ticketed
phase with map/node inputs; it is not silently absorbed into purity mixing.

## Error Handling

- Invalid clock: inline field error; prior computed result disappears.
- Removed/missing extractor after catalog replacement: unavailable message and
  a live candidate select; no stale calculation.
- No standalone extractor: explicit Resource Well/Nitrogen message.
- No known transport tier carrying one output: planned count remains visible,
  with a hard output-capacity warning.
- Count beyond `Number.MAX_SAFE_INTEGER`: unavailable message, no throw.
- Unsolved/linked/non-raw input: no raw card, therefore no extraction panel.

## Test Contract

### Data and cache

- Parser fragment pins exact rates 60/120/240, 120 oil, 120 water, and 60
  resource-well satellite from structured cycle fields.
- Water Pump and Fracking Extractor are admitted. The Pressurizer stays
  unadmitted and is never mistaken for a standalone extractor.
- Applicability pins all raw solids -> three miners; Water -> Water Extractor
  standalone plus Resource Well non-standalone; Crude Oil -> Oil Extractor plus
  Resource Well; Nitrogen -> Resource Well only and zero standalone candidates.
- Missing/zero cycle fields and unknown forms reject with named parser errors.
- `mOnlyAllowCertainResources` accepts only exact `"True"`/`"False"`; missing or
  unknown text rejects. A restricted extractor with missing, empty, malformed,
  or unresolved `mAllowedResources` rejects. A `"False"` miner remains
  unrestricted rather than being misclassified by string truthiness.
- Catalog store round-trips extractor Fractions/topology/applicability; parser
  version 5 reads stale under version 6.

### Pure derivation

- Limestone 12,720/min, Miner Mk.3, 100% -> 53, 240 each, total 12,720,
  surplus 0, power `2385 MW`.
- Same demand at 250% -> 22, 600 each, total 13,200, surplus 480; Mk4-only is a
  per-output warning requiring Mk5, Mk5-unlocked is clean.
- Water 10,600/min, 100% -> 89, 120 each, 10,680 total, 80 surplus, `1780 MW`,
  Pipe Mk1 carries each output.
- Water at 250% -> 36, 300 each, 10,800 total, 200 surplus; Pipe Mk1 is exactly
  sufficient and power carries the approximation marker.
- Invalid text, zero, negative, and >250 clocks return invalid; safe-integer
  overflow returns unavailable.
- A mutation that compares total demand to one tier must fail the worked tests.
- Nitrogen produces no planned count and names the Resource Well topology.
- A persisted Resource Well Extractor selection for Water or Crude Oil is
  rejected from standalone derivation and produces no count, supply, or power.
- A persisted cross-item standalone selection (Oil Extractor for Water) is
  rejected by current-item applicability and produces no derived result.

### State and plan file

- Setting one stage/item selection does not affect another stage or raw item.
- v6 save/load round-trips extractor ID and raw clock text, including malformed
  in-progress text; derive reports that text invalid after load.
- v5 migrates with no extraction selection; malformed v6 extraction fails
  validation; older versions continue through the migration chain.
- V6 requires an explicit `userPlaced` boolean. V5 preserves its explicit flag;
  v1-v4 materialize the legacy original-position rule before any rewrite.
  Single import, bundle import, legacy-row rename/save-over, and export/reimport
  all preserve pinned/auto behavior. `listPlans` recognizes all six versions.
- Removing a stage removes its extraction intent; catalog replacement with a
  missing extractor remains loadable and renders unavailable.

### UI

- Mouse and keyboard activation of a raw card open the matching item/demand.
- The XYFlow raw wrapper has pointer events enabled but is not focusable; the
  inner button is the sole tab stop. Pointer activation works without a
  node-level click handler.
- Solids require an explicit miner choice; Water/Oil auto-seed their sole
  standalone choice only on first open.
- Edits update exact count/surplus/transport/power; invalid edits remove stale
  output.
- Every planned result visibly labels `Purity Normal`; no result is presented as
  purity-independent.
- Close restores focus; opening another raw replaces the panel; disappearance
  of the raw node closes it.
- While open, an upstream solve change updates the panel from the current exact
  `Fraction` demand without parsing `rateText` or retaining a click snapshot.
- Canvas notice and extraction content coexist in one top-right vertical stack
  with neither overlap nor dismissal of the other.
- At 360px and 720px widths with the 340px minimum canvas height and chain power
  present, the stack clears top-left controls and stops above both bottom control
  zones, stays within side gutters, and scrolls internally in every notice /
  extraction combination.
- Nitrogen displays the explicit Resource Well message and no miner control or
  count.
- Existing raw-node position, source handle, linked-input suppression, and
  `raw:` commit guard remain pinned.

Full phase verification remains `npm test`, `npm run check`, `npm run build`,
`git diff --check`, plus a desktop/mobile browser walk of the raw-card panel.

## Out of Scope

- Impure/Pure selection or mixed node inventory.
- Automatic node-location or map availability lookup.
- Full Resource Well pressurizer/satellite allocation.
- Adding extraction machines as chain stages or links.
- Changing the manufacturing stage's machine count, recipe, manifold, or
  existing lane overrides from the extraction panel.
- A Phase 2 implementation plan.

## Assumptions Ledger

1. **Raw demand is authoritative.** Grounded in `deriveRawFeeds`, which reads the
   solved feed lane's exact `totalDemand`; no duplicate calculation is needed.
2. **Normal rates are structured.** Grounded by direct bundled Docs.json reads
   of `mItemsPerCycle` and `mExtractCycleTime` for all six output-producing
   extractor classes, using the existing exact fluid normalization.
3. **Applicability is structured.** Grounded by `mAllowedResourceForms`,
   `mOnlyAllowCertainResources`, and `mAllowedResources` in those same classes.
4. **Power reuse is valid.** Every relevant building carries
   `mPowerConsumptionExponent=1.321929`; `stagePowerText` already implements and
   labels the approved irrational clock-power boundary.
5. **Per-output saturation is the honest comparison.** The extractor
   descriptions and structured output connection model give each extractor its
   own belt/pipe output; total extraction may use multiple lines. Comparing the
   aggregate requirement to one line would recreate #120's false premise.
6. **Extraction choice is plan intent.** A selected miner/oil/water setup changes
   what the user intends to build and must survive save/load; the plan-file bump
   follows the existing anti-silent-drop rule.
7. **Resource Well count is not derivable requirement-first.** The installed
   data exposes a satellite nominal rate and a separate pressurizer, while a
   buildable answer depends on a specific well's satellite nodes. The design
   therefore reports the topology and refuses an invented count.
8. **Purity values are ready but deferred.** Build 24656030's installed headers
   and pak establish order and exact 0.5/1/2 values; provenance is in
   `../FEATURE.md`. They do not enter Phase 1 code.

## Revision History

- **r1:** initial source-grounded Phase 1 candidate.
- **r2:** preserves v5/v6 placement-origin semantics, strictly parses textual
  extractor restriction fields, carries exact live raw identity/demand, makes
  the inner raw button the sole pointer/tab target, and consolidates top-right
  canvas content into one non-overlapping stack.
- **r3:** defines the narrow-canvas top clearance/width/scroll contract and
  updates the manifest to the current review prompt.
- **r4:** materializes `userPlaced` into every v6 stage across all rewrite paths
  and bounds the responsive stack between both top and bottom control zones.
- **r5:** validates persisted selections as standalone before count derivation
  and makes the Phase 1 Normal-purity assumption explicit in every result.
- **r6:** also validates a persisted standalone extractor against the current
  raw item's applicability, and repairs the r5 review-trace links.
- **r7 implementation correction:** revises the mobile stack cap from 220px to
  the measured 170px maximum. At 360px wide, the production stack starts at
  y=49 and React Flow controls start at y=220; 220px overlaps the controls by
  49px, while 170px ends at y=219 and preserves the required control zone.

## Unresolved Risks for Review

1. Whether #112's final acceptance requires a full Resource Well planner rather
   than the explicit, measured Phase 1 refusal. If yes, that is a new phase and
   ticket before the arc can close; it cannot be hidden inside Phase 2 purity.
2. React Flow event propagation for a focusable button inside a non-selectable
   node must be browser-walked (`nodrag nopan` is the established RF mechanism,
   but the current app has no interactive raw-node precedent).
3. Persisting extraction intent causes a v6 format bump. Dropping persistence
   would reduce code but would make saved factory plans lose selected extractors
   and clocks; this candidate treats that as unacceptable.
