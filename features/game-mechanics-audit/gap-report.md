# #140 Phase 1 — game-mechanics gap report

**Status: for Michael's review. Nothing here is designed or decided.**
**Revision 2.** R1 was reworked after two reviewers returned NEEDS_REWORK and after
Michael corrected the scope. See *Corrections to revision 1* at the end — several
of R1's findings were wrong, and they are listed rather than quietly fixed.

## Sources

| Source | What it is | Note |
|---|---|---|
| **Game C++ headers** | `CommunityResources/Headers.zip`, 1144 files, extracted | **Authoritative.** Beats the wiki everywhere. R1 did not use this at all. |
| Docs.json | `CommunityResources/Docs/en-US.json`, UTF-16LE, 114 classes / 2868 entries | Shipped data values |
| `FactoryGame.usmap` | Unreal property mappings | Consulted only to confirm two absences |
| Wiki | satisfactory.wiki.gg | Used **only** where neither header nor Docs.json carries the fact, and labelled as such |

**Two different build numbers, do not conflate them:**

- **Installed game: build `24656030`** (`~/.steam/steam/steamapps/appmanifest_526870.acf:12`). This is what the audit read.
- **Bundled snapshot in this repo: build `23855724`**, extracted 2026-08-03
  (`public/bundled-docs/provenance.json`).

They differ. That gap is itself finding W4.

App source audited at `f494e75`.

## How to read this

Findings are split four ways, deliberately. An audit that files "produces a wrong
number today" alongside "correct but hardcoded" yields a scary total and a
useless priority order.

| Kind | Meaning |
|---|---|
| **WRONG** | Produces an incorrect result today. |
| **ABSENT** | A real mechanic with no representation. Not wrong, incomplete. |
| **RISK** | Correct for 1.2, but drifts silently on a patch. |
| **PASS** | Verified correct. Recorded so it is not re-audited. |

Every claim is tagged by provenance: **[header]**, **[docs]**, **[wiki]**, or
**[inference]**. Absence claims cite the grep and its result count.

**This revision closes nothing.** Michael's directive is *"all logistics support
all splitters etc."* — where R1 wrote "no change needed", this revision states
what modelling the mechanic would require and moves the scope call to the *Open
questions* section.

---

## 1. The finding that opened the ticket

**All eight `x2` runs in the 8411 Wet Concrete case are merge artifacts. None is real.**

Numbers in the [#140 baseline comment](http://10.0.0.69:3000/sudohworks/satisfactory-foundry/issues/140#issuecomment-24726).
Every overshoot is 60/min — half of one machine's demand.

**The bound is structural.** `peakFlow = survivedIn + belt.capacity`
(`manifold.ts:410`, assigned to `peakFlow` at `:417`) can only exceed the top
tier `B` when `survivedIn > 0`, and head-first drain keeps `survivedIn < d`.

This claim was attacked deliberately by the adversarial reviewer along four
routes — the `combineFeedBelts` remainder belt, the empty-span carry-forward
(`:411-415`), the `end = min(next entry, N)` clamp, and capacity overrides — and
it held. The invariant is `survivedIn = cumulative mod d`, re-established at
every span because `entersAfterMachine = floor(cumulative/d)` (`:385-387`) is
derived from the same cumulative capacity that is drained. An oversize override
sets `bundleEligible = false` (`:422`), giving `parallelCount = 1` plus a
capacity finding, never an `x2`. **The report's central claim survives.**

`manifold.ts:418-421` already concedes in a comment that the bound is an
artefact of the drain model rather than a game rule.

### 1.1 There are three different game answers to the 60/min residue

R1 named one and implied it was *the* fix. There are at least three, they build
differently, and they deliver different rates. **This is the first open question.**

| Option | What happens to the residue | Delivered |
|---|---|---|
| **Overflow chain** (Smart Splitter, Overflow rule) | Routed onward on the trunk | Full |
| **Basic splitter chain** | Backs up; throttles the source | Source drops to `(k−1)·B` |
| **In-line Storage Container** | Absorbed | Full, with standing inventory |

All three make `peakFlow ≤ B` an invariant and retire `parallelCount`.

### 1.2 Overflow — the mechanism, confirmed at source

`UFGOverflowDescriptor`: *"Descriptor Rule. Will consider all items that cannot
be placed for a given tick on their specified output."*
**[header: Resources/FGOverflowDescriptor.h:9-11]**

Three consequences follow from that one sentence:

1. **It is item-agnostic** — "all items", keyed on placement failure, not
   identity. **This refutes R1's stated reason for deferring Smart Splitters**
   ("nothing to attach to while lanes are single-item"). Overflow needs no
   multi-item bus.
2. The trigger primitive is `availableSpace > ITEM_SPACING`
   **[header: FGBuildableConveyorBase.h:301-305]**, cached per output as
   `FConveyorSpaceData::AvailableSpace` **[header: FGBuildableSplitterSmart.h:39-56]**.
3. The remainder is **routed** out the Overflow `OutputIndex` on an ordinary belt.

**Chain behaviour.** Node *i* configured `Left→Any` (machine), `Right→Overflow`
(trunk). Trunk flow after node *i* is `S − i·d`, monotonically decreasing,
bounded by the feeding tier, **never the sum of two belts**. Per-line peak
becomes `max(trunkIn, belt.capacity) ≤ B`. Chain ends when `S − i·d < d`.

For your Limestone at `d = 120`, Mk5 `B = 780`: belt 1 serves 6 machines, the
60/min leaves via the overflow port onto the trunk — **one belt width, not two**.

Cost: 9 items of standing buffer per node **[docs: mInventorySize = 9]**.

The sort-rule vocabulary is four real descriptor subclasses, all header-defined:
`UFGWildCardDescriptor` (Any), `UFGNoneDescriptor` (None),
`UFGAnyUndefinedDescriptor` (Any Undefined, with a worked example in its own doc
comment), `UFGOverflowDescriptor`. A rule is
`FSplitterSortRule{ ItemClass; OutputIndex }` **[header: FGBuildableSplitterSmart.h:11-35]**.

**Correction to the handoff.** It states `grep -riE 'splitter|merger' src/core/
src/data/` returns zero hits. Re-verified true. But the concepts exist in
`src/layout/` as 40×40 footprints (`footprints.ts:73-77`, placed at
`layout.ts:194-200,230-236`) — geometry without behaviour. "Absent repo-wide"
would be wrong.

---

## 2. WRONG — produces incorrect output today

### W1. Variable-power machines report the wrong draw, with false precision

`parseMachinePower` uses the building's all-recipes envelope midpoint
(`docs-loader.ts:497-501`). The game puts real figures on individual recipes via
`mVariablePowerConsumptionConstant` / `mVariablePowerConsumptionFactor`. Neither
key is in `RawRecipe` (`docs-loader.ts:43-50`); `grep -rn "mVariablePower" src/`
→ **0**.

Worked case, corroborated by the game's own text: a Particle Accelerator running
Plutonium Pellet draws 250–750 MW, mean **500 MW** — and
`Desc_PlutoniumPellet_C.mDescription` states *"Power Usage: 250-750 MW (500 MW
average)"*. The app reports **875 MW** labelled "varies 250–1500 MW", for that
and every other recipe the building runs. Quantum Encoder's 0–2000 envelope
makes its reported 1000 MW midpoint uninformative.

Feeds the chain power total (`chain-builder-adapter.ts:799`, `advice.ts:124`).

**The fix has a trap — R1's recommendation contained a worse bug than the
defect.** 46 recipes carry a non-default factor, but **only 43 sit on the three
`FGBuildableManufacturerVariablePower` classes**. Three are on constant-power
buildings where the fields are inert: `Recipe_SpaceElevatorPart_11_C` (Ballistic
Warp Drive, Manufacturer, 55 MW, const 500 / factor 1000), a Blender recipe
(75 MW), and `Recipe_SingularityCell_C` (factor `0.000000`). Gating on *the
recipe supplying the fields* would report Ballistic Warp Drive at 500–1500 MW
instead of 55 MW.

**Recommendation:** parse the two fields onto `CatalogRecipe`, but **gate on the
producing building's native class**, not on the recipe's fields. Then use
`[const, const + factor]`, mean `const + factor/2`.

### W2. Two clock validators disagree, so the same value is legal or illegal by route

`parseClockText` rejects `> 250` (`clock.ts:15-17`). The store's stage-solve
derive parses with a bare `Fraction.parse` and checks only `lte(0)`
(`store.ts:503,511`); the solver agrees, rejecting only non-positive clock
(`manifold.ts:196-201`). The UI input has no `max` (`ControlsStrip.tsx:104-109`).

A 1000% stage solves and reports machine counts and power for an unbuildable
factory, while the chain builder would have refused the same string. The game's
1% floor (`mMinPotential = 0.010000`, uniform across all 62 carrying classes) is
enforced nowhere.

**Recommendation:** route the store's derive through `parseClockText`; add the
1% floor.

### W3. Fluid lanes get belt physics — and the `x2` claim is physically false for them

`manifold.ts` branches on `lane.kind` in exactly two places (`:348-349`, `:501-502`),
both only to select the capacity table. Everything downstream is shared,
including `drainSpan`'s head-first ordering (`:285-301`) **and `parallelCount`
(`:423-424`)**.

Two distinct defects:

1. **Starvation shape.** For a pipe the solver emits "machines 1..k served,
   machine k+1 receives exactly this shortfall, the rest zero" — an exact index
   and an exact `Fraction` for a system that equalises. The headers confirm the
   mechanism: `FFluidBox` with `PressureGroup`, `PressureColumn`,
   `ElevationPressureColumn` **[header: FGFluidIntegrantInterface.h:84-87]**;
   *"Overfilling is what creates pressure in the pipes"* **[:51-61]**; signed
   `Flow` — fluid moves backwards — and `ShouldBreakPressureGroup`
   **[header: FGPipeNetwork.h:27-63]**.
2. **`parallelCount` is emitted for pipe lanes.** "Run two pipes in parallel" is
   a different physical claim from two belts: parallel pipes **share a
   `PressureGroup` and do not add**. This is wrong output on half the lane kinds
   the branch applies to, and it may be worth fixing ahead of everything else.

The honest caveat already exists one module over: `transport.ts:16-19` documents
pipe capacity as a nominal ceiling, surfaced as "manifolds can sustain less"
(`transport-text.ts:51,76`), with a user derate. `grep -c "derate"
src/core/manifold.ts` → **0**.

**Not wrong:** the capacity arithmetic. Σ demand against 300/600 per minute is
mode-independent and correct.

**Note on a full fix:** porting the fluid simulation is **not fully groundable** —
`OVERFILL_USED_FOR_PRESSURE_PCT` and `PRESSURE_LOSS` are declared-only
**[header: FGFluidIntegrantInterface.h:61,65]** and appear in neither Docs.json
nor `usmap`.

### W4. A refreshed bundled catalog never reaches existing users

Staleness keys **solely** on `parser_version !== CATALOG_PARSER_VERSION`
(`catalog-store.ts:199-201`). `init()` takes the cache unconditionally on
`status: "hit"` (`store.ts:1321-1329`). `source_hash` is write-only —
`grep -an "source_hash" src/` (non-test) returns exactly 2 hits, the declaration
(`catalog-store.ts:139`) and the write (`:169`), no read. No `steamBuild`
comparison exists (0 hits).

So shipping a new `en-US.json` leaves every existing user on the old catalog
**forever** unless someone also hand-bumps `CATALOG_PARSER_VERSION`.

This is the scar already recorded at `catalog-store.ts:31-36` — the
`isRawResource` flag that "stayed invisible for existing users". Fixed then with
a one-off bump, not a mechanism, so the trap is live.

**This is not hypothetical: the installed game is build `24656030`, the bundle is
`23855724`.**

**Recommendation:** compare boot-fetched `provenance.steamBuild` against the
cached row's `source.steamBuild`; treat a difference as `stale`.

### W5. Blueprint view draws a Conveyor Splitter on fluid lanes

`layout.ts:194-200` emits `SPLITTER_FOOTPRINT` for every feed lane and
`MERGER_FOOTPRINT` for every output lane with **no branch on lane kind**. The
footprint provenance comment (`footprints.ts:37-40`) cites the Conveyor
Splitter/Merger specifically.

The game requires a Pipeline Junction there — *"Junction class for creating
splits in a pipeline network"*, deriving from `AFGBuildablePipelineAttachment`
which is itself an `IFGFluidIntegrantInterface`, i.e. **a junction is its own
fluid box** **[header: FGBuildablePipelineJunction.h:9-13,
FGBuildablePipelineAttachment.h:14]**. Cross splits 4 ways, T splits 3
**[docs]**.

**Gotcha:** the pipe-junction building dimensions are in **neither** source
(`mRadius = 65` is the *fluid* radius, not the footprint), so this needs a wiki
figure like the existing 40×40.

### W6. WITHDRAWN — the per-column junction layout is buildable

R2 initially claimed the layout draws an unbuildable structure (one junction
fanning out to a whole span, exceeding the 3-output cap). **The adversarial
reviewer refuted this and the refutation verifies against source:**
`buildJunctions` (`layout.ts:262-270`) emits one junction **per machine column**,
each a 1-in/2-out inline tap on a continuous bus — the canonical in-game
manifold, which never exceeds fan-out 3 regardless of span length. The module
docstring states this shape verbatim (`layout.ts:4-6`).

Withdrawn rather than deleted because W-numbers were circulated. The residual
true content — the *solver* does not enforce fan-out/fan-in ≤ 3 anywhere — is
already carried by A8 and open question 5.

---

## 3. ABSENT — real mechanics with no representation

Per Michael's directive, each carries a **To model it** line. None is closed.

### A1. Production amplification (Somersloop) — the largest functional gap

`Desc_WAT1_C` carries `mPowerShardType = PST_ProductionBoost`,
`mExtraProductionBoost = 1.0`. Manufacturers carry `mCanChangeProductionBoost`
(True on 10 of 11; False only on `Build_Packager_C`),
`mProductionShardSlotSize`, `mProductionShardBoostMultiplier`, and a **separate**
power exponent `mProductionBoostPowerConsumptionExponent = 2.0`.

Five greps — `somersloop`, `sloop`, `amplif`, `boost`, `shard` — return **zero**
mechanic hits.

**R1 got the derivation wrong and both reviewers caught it.** R1 claimed slot
size and multiplier are "reciprocal per building, so every machine caps at 2×".
`Build_SmelterMk1_C` has `mProductionShardSlotSize: "0"` × multiplier `1.000000`
= **0**, which would say "no boost" for a machine that takes one Somersloop for
2×. The shipped slot count is a **non-authoritative default** guarded by
`mOverrideProductionShardSlotSize: "False"`. The 2× ceiling is real but is
engine-default knowledge — the same category as the 250% clock cap, which R1
correctly flagged and then walked into.

**To model it:** per-stage `sloopCount` bounded by the effective slot size
(honouring the `mOverride...` flag, with the engine default supplied as a named
constant); output × `mBaseProductionBoost + sloops × mExtraProductionBoost ×
multiplier`; power raised by `mProductionBoostPowerConsumptionExponent`.

### A2. Resource Well Pressurizer — Nitrogen Gas cannot be planned

`Build_FrackingSmasher_C` (150 MW) does not match `NATIVE_BUILDING_REGEX`
(`docs-loader.ts:31-32`) and is absent from the catalog. Satellites *are*
modelled correctly (60/min, `topology: "resource-well"`).

A **documented, deliberate scope call** —
`features/extraction-planning/phase-1/brainstorm-spec.md:86` says Phase 1 does
not calculate Resource Well setups. Recorded because the consequence is larger
than the note implies: nitrogen is unplannable, and well-based oil or water plans
silently omit 150 MW per pressurizer.

Docs.json cannot supply the satellite count — `mSatelliteNodeCount` and
`mDefaultPotentialExtractionPerMinute` are zero placeholders — so well planning
must be user-input-shaped, like purity.

**R1's implementation gotcha was wrong on both counts.** Adding the class to
`NATIVE_BUILDING_REGEX` does **not** throw: `parseRawExtractor` is gated by the
*separate* `isExtractorNativeClass` (`docs-loader.ts:127`, defined `:273-277`),
so the result is a silent 150 MW machine with no extractor row. And if it *were*
routed there, the first failure is missing `mItemsPerCycle`
(`docs-loader.ts:288-292` → `:366-373`), not the forms regex — the class carries
no cycle fields at all.

**To model it:** admit the class via `isExtractorNativeClass`, supply satellite
count + per-satellite purity as user input × 60/min, add 150 MW to the ledger.

### A3. Headlift and pumps — **R1 reported this wrong; the data exists**

**R1 said headlift is unobtainable from game files. That was wrong in both
directions and is the most important correction in this revision.**

1. **The headers expose headlift as a first-class API.** `grep -rn "HeadLift"
   --include='*.h'` → **35 hits in exactly 2 files**
   (`FGBuildablePipelinePump.h`, `Hologram/FGPipelinePumpHologram.h`).
   `SetMaxHeadLift(float design, float max)` **[:78-80]**; `GetMaxHeadLift()` —
   *"the absolute maximum amount of meters up this pump can push fluid"*
   **[:82-84]**; `GetDesignHeadLift()` **[:86-88]**; `mIsExceedingHeadLift`
   **[:222]**. Design note verbatim: *"in our fluid model, pump pressure is
   measured in meters… Our calculations are simplified for pressure to only
   account for the height of the fluid column"* **[:68-76]**.
2. **Docs.json ships the values under different names — and the binding is
   header-STATED, not inferred.** The property declarations carry explicit unit
   comments: `mMaxPressure` — *"Maximum pressure this pump applies. [meters]"*;
   `mDesignPressure` — *"When the pump is working above this pressure, it's
   working outside of it's specifications… unit [meters]"*
   **[header: FGBuildablePipelinePump.h:155-160]**. `Build_PipelinePump_C`
   ships `20 / 22 / 4 MW`; `Build_PipelinePumpMk2_C` `50 / 55 / 8 MW` **[docs]**.
   So **`mDesignPressure`/`mMaxPressure` ARE the headlift pair, in metres** —
   R2's first draft labelled this an inference from the `SetMaxHeadLift(design,
   max)` signature; the adversarial reviewer found the direct declaration,
   upgrading it to header fact. R1's "`mMaxHeadLift` does not exist" was true of
   that exact *name* only, and misleading as a claim about availability.
3. **What is genuinely absent:** any pressure field on `AFGBuildablePipeline`
   itself — the 35 hits are in two files, neither of which is the pipeline. So
   *passive* pipe headlift and per-metre elevation cost remain unobtainable;
   *pump* headlift is fully obtainable.

`grep -raE 'headLift|headlift|HeadLift' src/` → **0**.

**To model it:** `netRiseMeters` per pipe lane (user-entered, or derived once
layout gains `z`); `pumpsRequired = ceil(netRise / designHeadLift)` with
`designHeadLift` from `mDesignPressure`; 4/8 MW per pump into the ledger; a
`head-lift-exceeded` finding when no unlocked tier covers a single rise.

### A4. Valve — a pump with zero head lift

**[docs]** `Build_Valve_C` has `NativeClass = FGBuildablePipelinePump` and
carries `mMinimumFlowPercentForStandby = 0.05`, with `mMaxPressure`,
`mDesignPressure` and `mPowerConsumption` all **present but `0.000000`** — a
pump with zero head lift and zero draw. Its function is named in the pump's own
API: `SetUserFlowLimit(float rate)` — *"Set the limited flow through this pump.
Set this to -1 to use the max limit, i.e. valve is fully opened. [m3/s]"*
**[header: FGBuildablePipelinePump.h:90-92]**.

`grep -raiE 'valve' src/` → **0**.

**To model it:** `LaneInput.flowCap?: Fraction` clamping effective lane capacity.
This also promotes the current unnamed percentage derate
(`transport-plan.ts:287-298`) into a **named building with an absolute m³/min
setting the user can actually place**.

**Note:** the valve is the fluid-side analogue of "inject what a stretch needs
and pass the rest on".

### A5. Fluid buffers

`mStorageCapacity` — *"The storage capacity in cubic meters"*
**[header: FGBuildablePipeReservoir.h:98-100]**; 400 and 2400 m³ **[docs]**.
`GetFlowLimit()` — *"The fill/drain limit, **this depends on the number of
connection components**"* **[:80-82]**, so throughput is not fixed.

No storage concept exists in `manifold.ts`; `solveStage` (`:181-233`) is a single
steady-state evaluation.

**To model it:** true modelling needs a time dimension the solver lacks. The
minimum useful version without one: a capacity advisory on any fluid lane with an
intermittent source, sized `burstRate × burstDuration`, naming which tank covers
it, with the connection-count caveat.

### A6. Smart / Programmable Splitter item filtering

**Not deferred — scoped.** Filtering by item needs a multi-item bus, which is the
largest single change in this audit: it moves `itemId` off `LaneInput`,
`FeedLaneResult`, `OutputLaneResult` and every `Finding` (`manifold.ts:86-118`),
plus `src/ui/layout.ts:84` and `src/layout/layout.ts:192`.

**There is no separate Programmable Splitter class.** `Build_ConveyorAttachment
SplitterProgrammable_C` sits under `NativeClass = FGBuildableSplitterSmart` with
`mMaxNumSortRules = 64` instead of 3. `mSortRules` is a **flat array**, so
multiple rules may share an `OutputIndex` and combine as OR; "one filter per
output" is a UI consequence of the cap **[inference from the array shape]**.
Precedence is header-stated: *"excludes wildcard outputs if there is a rule
specifically set for this item type"* **[header: FGBuildableSplitterSmart.h:129-130]**.

**To model it:** rule table `{itemClass: string|"any"|"any-undefined"|"overflow"|
"none", outputIndex}[]` with per-building `maxRules`, plus a resolver
implementing specific-beats-wildcard. **One implementation covers both
buildings.**

**Whether it belongs in this arc is an open question — Overflow does not need it.**

### A7. Priority Merger

R1 dismissed this because "no contended merge exists". **That was circular** — it
is only true because the current model chose disjoint output spans
(`manifold.ts:542-546`).

The headers give the complete resolution rule: `mInputPriorities` (an integer per
input, not a fixed order) **[header: FGBuildableMergerPriority.h:72-74]**;
`mInputIndicesPerPriority` — equal priorities **group** **[:76-77]**;
`mCurrentInputIndices` — round-robin **within** a group **[:79-81]**;
`mCurrentInputPriorityGroupIndex` — *"so that we do not switch the priority if
for one frame our current priority fails to deliver"*, i.e. one-frame hysteresis
**[:83-85]**. It derives from `AFGBuildableConveyorAttachment`, **not** the basic
merger — it reimplements merging **[:12-13]**.

`grep -raE 'priorityMerger|PriorityMerger' src/` → **0**.

**To model it:** a merge node `inputs: {rate, priority}[]` + `outputCapacity`;
resolve by priority desc, round-robin within equal groups, fill to capacity;
emit per-input `deliveredRate` and a `starved-input` finding when
`Σinputs > outputCapacity`. Hysteresis is tick-level with no steady-state
effect — document, don't simulate **[inference]**.

### A8. Basic splitter and merger behaviour

Both are round-robin: `mCurrentOutputIndex` — *"Cycles through the outputs"*
**[header: FGBuildableAttachmentSplitter.h:33-35]**; `mCurrentInputIndex`
**[header: FGBuildableAttachmentMerger.h:32-34]**. Both carry a 9-item buffer
**[header: FGBuildableConveyorAttachment.h:140-146]**.

**Neither carries any throughput field** — verified across all 16 Docs.json
`Splitter|Merger` classes (`mSpeed` absent from every one) and across the
headers. **A commonly cited "2000/min splitter throughput" figure is wiki-only
and unverified.** Fan-out/fan-in of 3 is stated only in `mDescription` prose and
on the wiki, **not** in any header field.

**A conflict worth recording:** the wiki says the merger has an internal
inventory of one item; **Docs.json says 9**. Docs.json wins.

**To model it:** `LaneInput.topology: "merged-bus" | "splitter-chain"`; under
chain each `FeedBelt` owns a disjoint span and `peakFlow = belt.capacity`,
replacing `manifold.ts:410`; enforce fan-out ≤ 3 by emitting a cascade count per
span; model backpressure (surplus throttles the source).

**The current model is an unnamed, uncapped merger.** Even keeping the merged
bus, it should gain the game's two constraints: fan-in ≤ 3, and output capped at
the outgoing belt's tier — under which today's `parallelCount = 2` becomes a
`segment-over-capacity` finding, i.e. a build error the user resolves rather than
a silently doubled belt.

### A9. Road-vehicle fuel burn and locomotive power

Both specified in the research doc, both available as structured fields, neither
in the code.

- `mManualFuelConsumption` — Truck 75, Tractor 55, Explorer 90. `grep -rnE
  "MANUAL_FUEL|FUEL_CONSUMPTION|fuelBurn"` → **0**. The truck path is asymmetric
  with the drone path, which does report per-trip energy.
- `Desc_Locomotive_C.mPowerConsumption = (Min=25, Max=110)`. Never lifted into
  `transport-facts.ts`; a train link's ledger covers stations and platforms only
  (`transport.ts:293-295`), understating by 25–110 MW per locomotive. **Model it
  as a range, not a point.**

### A10. Conveyor Throughput Monitor — the instrument that could settle this

`AFGBuildableConveyorMonitor : public AFGBuildableSplineSnappedBase` — **not a
factory building, cannot alter flow** **[header: FGBuildableConveyorMonitor.h:44]**.
`TOTAL_AVERAGE_DURATION = 60` seconds **[:184]**, `mCalculatedItemsPerMinute`
**[:164-165]**, `mConfidence` **[:172-174]**.

`grep -raE 'throughputMonitor|ConveyorMonitor' src/` → **0**.

**To model it:** one field on `BusSegment` (`manifold.ts:41-47`, which already
carries `peakFlow`) — "place a monitor here, expect X/min after 60 s".

**This is the only in-game way to falsify the app's predictions — including,
immediately, the eight `x2` runs.**

### A11. Per-machine clock and shard cost

`StageInput.clockPercent` is declared uniform (`manifold.ts:28`); clock varies per
*stage*, never per machine within one. The common pattern "N machines at 100%
plus one at 37.5%" is inexpressible — the user over-builds to an integer or
applies a fictional fractional clock to all.

Nothing converts a clock target into a Power Shard requirement
(`mExtraPotential = 0.5` per shard, unread). Note the slot count is **not**
derivable: `mPotentialShardSlots` is `0` on all 62 carrying classes, so the 250%
ceiling is engine-default knowledge.

### A12. Other logistics buildings

Present in the game, absent from the app. Each with what modelling it means.

| Building | To model it |
|---|---|
| **Conveyor Lifts** | Throughput identical to belts at all six marks — parse both native classes and **assert they agree**, turning coincidence into a test. Layout needs a `z` axis + the 48 m cap **[wiki; no header field]**. |
| **AWESOME Sink / Space Elevator** | The only true **infinite-capacity sink** — a terminal destination that never backs up. The cleanest way to state a lane's assumed downstream condition. |
| **Storage Containers** | A third answer to the residue (§1.1). Needs no new topology, only a note. |
| **Dimensional Depot** | Upload rate **unresolved**: `mTimeToUpload = 1.0` implies 60/min; the wiki says 15/min rising to 240/min. Needs measurement before encoding. |
| **Empty train platforms** | `carsPerTrain` (`transport.ts:206-208`) assumes every platform is cargo; empties break the 1:1. |
| **Railway / Buffer Stop / poles / passthroughs** | Build cost + geometry. Max unsupported span is in **neither** source. |
| **Personnel Elevator** | 20 MW, and it *transports power* between floor stops — a power-network element the app doesn't model. |
| **Hypertubes, Jump Pads, Portals** | **Carry no materials** — established from headers, Docs.json and wiki, not assumed. But they are real power load: 10 MW per Hypertube Entrance, 5 MW per Jump Pad, **2 × 250 MW plus Singularity Cells** per Portal pair. |
| **Hypertube Booster** | `FGBuildablePipeHyperBooster.h` exists with **no shipped `Build_` class** — header-only artefact. Do not model. |

---

## 4. RISK — correct for 1.2, drifts silently

Eight game-derived hardcodes were enumerated across `src/` via three sweeps
(numeric-literal arrays; UPPER_SNAKE consts in `core`/`data`; non-trivial
`Fraction` literals). **All eight are correct. None is a bug.** Named in full,
since R1 claimed eight and listed six:

1. transport tier table (`tiers.ts:10-13`)
2. stack-size enum map (`docs-loader.ts:426-432`)
3. building footprints (`footprints.ts:59-71`)
4. node purity multipliers (`extraction-plan.ts:196-199`, duplicated `:206-213`)
5. the 250% clock cap (`clock.ts:15-17`)
6. `DEFAULT_POWER_EXPONENT` (`docs-loader.ts:477`)
7. normalized class-name id literals (`packaging-pair.ts:44,56,84`;
   `extraction-plan.ts:182`; `GraphCanvas.tsx:323,504,581`)
8. the vehicle fact table (`transport-facts.ts`, 26 exports)

**Underivable — hardcoding is the only option.** Purity multipliers and the 250%
cap. Purity is proven absent: `mPurity`, `mResourceNodes`, `RP_*` each grep to
zero; the single `Purity` hit is a UI string on the portable miner. The cap is
worse than absent — `mMaxPotential` is `1.000000` on all 62 carrying classes, so
naive parsing yields a **wrong** 100%. *Comment both as unavoidable.*

**Derivable — and the tier table is now provably so.** **[CORRECTED]** R1 called
`tiers.ts` "correct by maintenance, not by construction". With
`static constexpr float ITEM_SPACING = 120.0f` — *"Spacing between each conveyor
item, from origo to origo"* **[header: FGBuildableConveyorBase.h:329]** — that is
no longer true. Items/min = `mSpeed / 120 × 60`, exact for all six marks. Pipes
are `mFlowLimit × 60`. Two wrinkles: dedupe the two cosmetic `_NoIndicator_`
variants, and sort — the `Classes` array is not in Mk order (observed Mk1, Mk5,
Mk6, Mk4, Mk3, Mk2).

`docs-loader.ts:267` stamps `TIER_TABLE` onto **every** catalog including a
user's fresh upload. The only test asserts `cat.tiers).toBe(TIER_TABLE)`
(`docs-loader.test.ts:156-158`) — it **pins the hardcode rather than validating
it**.

The stack-size map is likewise derivable from `mCachedStackSize`, **but needs a
carve-out**: 15 of the 750 items are `SS_FLUID` where `mCachedStackSize` is
**50000**, while `parseStackSize` deliberately returns `null`
(`docs-loader.ts:420-424`). A literal "derive it" would hand fluids 50000 per
slot. The pairing is exact for the 735 solids.

**Wiki-grounded, partly derivable.** Footprints are the **best-handled** hardcode
here: an unknown machineId falls through to a default *and emits an
`unknown-footprint` finding* (`footprints.ts:81-84`), so a new building surfaces.
A *changed* dimension still drifts. Clearance boxes are **not** the same quantity
as the wiki footprint — the Constructor disagrees (8×10 m vs 7.9×9.9 m) — so a
naive parse would be wrong.

**The sharper point is not any number: there is no drift detector at all.** See W4.

---

## 5. PASS — verified correct, recorded so it is not re-audited

- **Extraction rates are fully data-driven.** Running the app's own
  `parseDocsJson` over the 1.2 file yields miner Mk1/2/3 = 60/120/240, oil pump
  120, water pump 120, well satellite 60 — each matching `mItemsPerCycle × 60 ÷
  mExtractCycleTime` with the fluid ÷1000 (`docs-loader.ts:351-354`).
- **Node purity as user input is architecturally correct**, not a gap.
- **Vehicle transport constants contain no contradiction.** Every value with a
  structured counterpart matches exactly: 48/25/12/9/32 slots, 8 s / 9 s docking,
  20/50/50/100 MW, 24000 MJ + 6 MJ/m. All 26 exports carry a source docstring.
- **`TRAIN_LOCKOUT_SECONDS = 27.08` vs the game's 27.0 is a documented
  decision**, recorded at `transport-facts.md:176-183`. Flagged so no future
  audit reports it as a bug — though the 0.08 s has no support in the headers
  either, so it remains open (question 10).
- **Conveyor lifts need no throughput model** — `mSpeed` equals the belt tier at
  all six marks, verified pairwise.
- **The power exponent IS applied** (`machine-power.ts:44-45`), per stage.
- **Drone modelling is sound**, and `batteriesPerTrip` correctly returns `null`
  when distance is unknown rather than inventing one (`transport.ts:410-416`).

---

## 6. Housekeeping

- **Bundled catalog is one patch behind.** A field-by-field diff (not bytes)
  found **exactly 9 differences** across 2868 classes: `mFluidNames` ×4,
  `mCurrentFluid` ×4, plus `Desc_FreightWagon_C.mDescription` 1600 → 2400 m³. No
  output affected. **See W4 first** — a refresh alone will not reach existing
  users.
- **[CORRECTED]** R1 said the warnings at `transport-facts.ts:47-50` and
  `transport-facts.md:156` "now read as wrong". **They do not.** Both are
  explicitly scoped to the *bundled* file, which still says 1600. They are
  correct as written and become obsolete only *after* a refresh. R1's phrasing
  invited deleting a still-accurate "never parse `mDescription`" hazard note.
- **One stale comment, not two. [CORRECTED]** `types.ts:45-46` ("never applied in
  this phase") is stale. `types.ts:76` says "Stored, not applied **here**" —
  scoped to the parse layer, and **still true**.
- **Three hardcoded item-id literals**, correct today: `!== "nitrogen_gas"`
  (`GraphCanvas.tsx:581`, where the data-driven `candidates.length === 0` is
  already in scope), `=== "water"` (`extraction-plan.ts:182`), and the auto-seed
  pair (`GraphCanvas.tsx:323`).
- **Name collision.** `Blueprint.tsx` (a floor-plan view) shares a name with the
  game's Blueprint Designer, which it has nothing to do with. "designer" appears
  nowhere in `src/` (0 hits). It cost two audits a round of disambiguation.
- **Drone dock time.** `DRONE_DOCK_SECONDS_PER_PORT = 51` is not the game's shape
  — the game uses `mTransferSpeed` (s/stack) × stacks, and the shipped value is
  `0.000000`, i.e. Blueprint-set and not recoverable. Record it so 51 stops
  looking file-derived.
- **Truck station queueing upgrades from "ungroundable" to "shape known".**
  `transport.ts:19-21` calls it "NOT wiki-groundable". The header names the
  quantity — `GetMaximumStackTransferRate()`, *"combined max stacks per second"*
  **[header: FGBuildableDockingStation.h:173-177]** — but the shipped value is
  `0.000000`. Shape known, value unshipped.
- **Drone port queueing is now groundable.** `mStationHasDronesInQueue`,
  `mDroneQueueRadius`, `mDroneQueueSeparationRadius`,
  `mDroneQueueVerticalSeparation` **[header: FGBuildableDroneStation.h:242-276]**.
- **#141** — Propose defaults Limestone to the Converter and Water to Unpackage.
  Filed separately.

---

## 7. Corrections to revision 1

Listed rather than silently fixed, because R1 was circulated.

| # | R1 said | Actually |
|---|---|---|
| 1 | Headlift unobtainable from game files | **Wrong.** Headers expose 35 references; Docs.json ships values as `mDesignPressure`/`mMaxPressure`. Only *passive pipe* headlift is absent. |
| 2 | Smart/Programmable/Priority "no change needed until mixed-item buses exist" | **Closed items Michael opened**, on a premise Overflow refutes. |
| 3 | Overflow outputs | **Never audited.** Named in the ticket, skipped entirely. |
| 4 | `tiers.ts` "correct by maintenance, not construction" | Derivable by construction via `ITEM_SPACING = 120`. |
| 5 | Parse variable power when the recipe supplies the fields | Would report Ballistic Warp Drive at 500–1500 MW instead of 55. Gate on the **building class**. |
| 6 | Somersloop: slot size × multiplier is "reciprocal, so 2×" | Yields **0** for the Smelter. Needs the `mOverride...` carve-out. |
| 7 | Adding the pressurizer to the regex "will throw" | It won't. Different gate; and the real first failure is missing `mItemsPerCycle`. |
| 8 | `transport-facts` warnings "now read as wrong" | They are correct — scoped to the bundled file. |
| 9 | Two stale comments in `types.ts` | One. `:76` is correctly scoped. |
| 10 | Audit ran against "Steam build 23855724" | That is the **bundled** build. The install is **24656030**. |
| 11 | Derive the stack-size map from `mCachedStackSize` | Needs an `SS_FLUID` carve-out or fluids get 50000/slot. |
| 12 | "Eight hardcodes", six listed | All eight now named. |
| 13 | Blueprints "correctly out of scope" | **Not my call.** Restated as an open question. |
| 14 | `headlift|pressure|elevation` grep returns 6 hits | Returns **0**. Conclusion unchanged, number wrong. |

Citation drift also corrected: `RawRecipe` is `:43-50`; `FOOTPRINTS` is
`:59-71`; the stale comment is `types.ts:45-46`; disjoint output spans are
`manifold.ts:543-544`; `peakFlow` is assigned at `:417` (`:410` is `available`).

---

## 8. Open questions for Michael

None of these is resolved here.

1. **Which topology should a feed lane assume by default** — Overflow chain
   (residue routed), basic-splitter chain (residue backs up, source throttles),
   or in-line storage (residue absorbed)? Different builds, different delivered
   rates.
2. **Assumption the planner states, or a per-lane user choice?** Does `LaneInput`
   gain a `topology` field?
3. **What replaces the `x2` mark?** It currently drives `Schematic.tsx:81,165-183`,
   `format.ts:135-144`, `SummaryCards.tsx:33`, `layout.ts:206-209`. Under an
   overflow chain they go silent. Show the trunk's decreasing carry (`S − i·d`),
   the attachment count per span, or nothing?
4. **Surface the buffer cost?** A 20-machine overflow stretch holds ~180 items
   standing in splitters.
5. **Should the solver enforce fan-out/fan-in ≤ 3?** The layout's
   one-junction-per-column shape is buildable (see withdrawn W6), but nothing in
   the *solver* checks the limit if a future topology change needs it.
6. **Parse the tier table, or keep the literal?** Parsing makes `B` provable and
   closes the drift risk; it adds a Docs.json dependency to a value the app owns.
7. **Suppress `parallelCount` on pipe lanes now**, independently of the rest?
   It is physically false there today.
8. **Does the multi-item bus belong in this arc at all?** Largest change in the
   audit, and **Overflow does not need it**.
9. **How far should fluid modelling go** — (a) stop reusing the belt path and say
   so, (b) add elevation + pump head, (c) port the fluid-box simulation? Note (c)
   is not fully groundable.
10. **`TRAIN_LOCKOUT_SECONDS`** — change to 27 and cite the field, or re-source
    the 0.08?
11. **Dimensional Depot upload rate** — settle by in-game measurement, or leave
    absent?
12. **Add a "verify with a Throughput Monitor" annotation?** The only thing that
    can falsify the app's numbers in-game, starting with the eight `x2` runs.
13. **Do non-flow logistics buildings** (poles, passthroughs, supports, buffer
    stops, empty platforms) belong in scope as build-cost/geometry, or only as
    named gaps? Most need a `z` axis first.
14. **Do player-transport buildings get modelled for power and inputs** — 10 MW
    per Hypertube Entrance, 5 MW per Jump Pad, 2 × 250 MW plus Singularity Cells
    per Portal pair, 20 MW per Elevator — or excluded as non-material?
15. **Does A2 (Resource Wells) stay in this arc or become its own ticket?** It
    reopens a documented Phase-1 scope call.
16. **Do W1, W2, W4 land independently?** They are self-contained defect fixes
    with no design content and no dependency on the model rework.
