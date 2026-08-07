# S21 P0 — Ore constrained-vs-natural UX (brainstorm + spec)

**Ticket:** #104 · **Epic:** #108 · **Milestone:** 92 · **Status:** v5 — **FROZEN** (review of record: r4 APPROVED_WITH_NITS ×2, nits folded)

## Purpose

Basic extraction resources render on the "RAW (no eligible producer)" line
with an exclusions-recovery pointer, instead of the plain RAW line. Decide
whether that is right, and if not, fix it precisely.

Michael delegated the call ("do them", 2026-08-07), so this doc makes it —
grounded in measurement, not in the ticket's framing.

## Already settled — do NOT re-litigate

- The S20 P1 classifier semantics are review-pinned (design v7 + the boundary
  r1 fix): `constrained` ⇔ `hasAnyProducer(ungated)` ∧
  `effectiveDefaultRecipe(gated, exclusions) === null`. The **alternate-only
  collapse must keep classifying constrained with live recovery** — that fix
  exists because the earlier classifier dead-coded the recovery line.
  **This design NARROWS that biconditional and says so** (r1 — v1 restated
  the pin and then silently amended it). Amended form:
  `constrained ⇔ hasAnyProducer(ungated) ∧ effectiveDefaultRecipe(gated,
  exclusions) === null ∧ ¬(isRawResource ∧ producerRecipesFor(ungated, ·,
  EXCLUDED_MACHINE_IDS).length === 0 ∧ producerRecipesFor(ungated, ·,
  liveExclusions).length === 0)`. The alternate-only sub-pin is untouched:
  none of those items is raw-flagged, so the new conjuncts cannot reach them.
- S20 P3's four-cell lever matrix and the both-worlds split stand.
- `EXCLUDED_MACHINE_IDS` (converter, packager) is the default exclusion set
  and is user-editable in the MACHINE EXCLUSIONS panel.

## Ground truth (MEASURED this session against the bundled catalog)

The ticket says the problem is "Iron Ore, Copper Ore, Crude Oil". It is not:

- `CatalogItem.isRawResource` exists (`types.ts:28`, set at
  `docs-loader.ts:102`); **13 items** carry it.
- **32 items** classify `constrained` under the default exclusions.
  **12 are raw-flagged**, 20 are not.
- The 12: `ore_iron`, `ore_copper`, `ore_gold`, `ore_bauxite`, `ore_uranium`,
  `coal`, `stone`, `raw_quartz`, `sulfur`, `liquid_oil`, `water`,
  `nitrogen_gas`. (The 13th raw item, `sam`, is not affected.)
- Their producers, measured: **converter and/or packager only** — both
  excluded — **except `coal`**, which also has two `constructor_mk1`
  ALTERNATES (Charcoal, Biocoal).
- The 20 non-raw affected items (packaged fluids, fuels, `polymer_resin`,
  `heavy_oil_residue`, `time_crystal`, `ficsite_ingot`, `dark_energy`,
  `quantum_energy`) are genuinely constrained; several are the alternate-only
  case the P1 boundary fix established.

## Decision axes

### Axis 1 — Which option (the ticket offered three)

- **(a) special-case `isRawResource`** — flag exists, so it is viable.
- **(b) treat converter-only producer sets as "no producer"** — hardcodes a
  machine identity into the classifier.
- **(c) accept as-is.**

**Pick a REFINED (a).** Not the blanket rule the ticket implies, because the
measurement kills it: `coal` is raw-flagged AND has eligible constructor
alternates, so "raw ⇒ natural" would delete a genuinely useful recovery
("you can make coal from biomass") — a real regression in the name of polish.

Write `P(S) ≔ producerRecipesFor(ungated, itemId, S).length === 0` — "no
producer survives excluding the machines in `S`".

**The rule (v3): `natural` ⇔ `isRawResource` ∧ `P(EXCLUDED_MACHINE_IDS)` ∧
`P(liveExclusions)`** — BOTH vacuity tests must hold. Note this is the
CONJUNCTION of two emptiness tests, not `P(CONST ∪ live)`: the union is
weaker (implied by either conjunct) and would re-admit the coal regression.

**Why both, and why neither alone (two rules died here — record the
shape).** Each single-keyed rule is the exact negation of one of P3's
levers, so each swallows a matrix cell:

| rule | swallows | concrete failure |
|---|---|---|
| v1 — live set only | the `machine` cell | user ticks Constructor → `coal` vacuous → loses its picker AND its "edit MACHINE EXCLUSIONS" hint |
| v2 — constant only | the `tier` cell | user UN-ticks Converter below tier 9 → `ore_iron`'s only producer (`iron_limestone`, unlocked at `mTechTier` 9) is tier-gated, so "raise TIER" is a REAL recovery — suppressed |
| **v3 — both** | nothing | each lever's precondition falsifies its own conjunct |

The conjunction is right because it means exactly *"nothing could make this
under EITHER policy currently in play"*. If the default policy alone would
allow a producer, the user's exclusion is what is blocking it and the
`machine` lever must speak; if the user's policy alone would allow one, the
tier gate is what is blocking it and the `tier` lever must speak. Only when
both policies independently yield nothing is the recovery genuinely vacuous.

Checked against every case on the shipped data:

- `ore_iron`, defaults → `P(CONST)` ✓, `P(live)` ✓ → **natural** (the fix).
- `ore_iron`, Converter un-excluded, TIER ≤ 8 → `P(live)` FALSE
  (`iron_limestone` survives) → **constrained**, `tier` lever. Preserved.
- `coal`, defaults → `P(CONST)` FALSE (charcoal/biocoal are outside the
  constant) → **constrained** + picker. Preserved.
- `coal`, Constructor excluded → `P(CONST)` FALSE → **constrained**,
  `machine` lever. Preserved.
- `water`, Packager un-excluded → `P(live)` FALSE, so the rule does not
  fire and control falls through — landing on **`natural` anyway**, because
  `effectiveDefaultRecipe(catalog, water, {converter})` resolves
  `unpackage_water` (non-alternate) and is therefore non-null. **Unchanged
  from today** (r3 corrected v3 here: the row said "constrained" and called
  the rule "conservative by construction" — both wrong; the rule is not
  conservative in this cell, it is simply silent). A constrained line
  appears here only at a TIER that gates `unpackage_water` out.
  `nitrogen_gas` behaves identically.
- **`ore_iron`, DEFAULT exclusions, TIER ≤ 8** → `iron_limestone` is
  tier-gated but sits on the converter, which is excluded under BOTH
  policies, so both conjuncts hold → **natural**. This is the cell v3's
  first checklist omitted (r3). The answer is right — no single lever
  recovers, since at tier 9 the converter is still excluded — but record
  the delta honestly: **today this row renders a constrained line with
  `lever: "both"`; under this rule it renders no CONSTRAINED line — the item
  moves to the plain RAW line, rate and all** (`ChainBuilder.tsx:463-468`;
  r4 — "no line at all" was an overstatement that would have licensed a test
  asserting Iron Ore renders nowhere, which `chain-builder-adapter.test.ts:
  208-209` already contradicts). That is the intended outcome of Axis 1
  (the joint recovery is "enable the converter", the degenerate advice this
  design exists to stop giving), stated rather than discovered.

Measured effect: 11 of the 12 become `natural`; `coal` stays `constrained`
and keeps its Charcoal/Biocoal picker. The 20 non-raw stay untouched.

Rejected (b): the classifier would name `converter` explicitly, coupling
solver semantics to one machine id, and it would still mishandle `coal` —
and it would miss the PACKAGER cases entirely (`water` and `liquid_oil` are
packager-only; `nitrogen_gas` is mixed), which is 3 of the 11 (r1 NIT: v1's
converter-only gloss understated the set). Those are equally degenerate: the
"recovery" for Water is to enable the Packager and build a
package/unpackage 2-cycle, which the core's cycle guard demotes back to raw
anyway.
Rejected (c): the line is noise on ordinary chains — a fresh Propose of
anything iron-based shows a "no eligible producer" line whose only recovery
is to enable a machine the default deliberately excludes. (r1 NIT: v1 said
"two lines"; Iron Plate draws exactly one raw. Two needs an iron+limestone
target such as Encased Industrial Beam.)

### Axis 2 — Where the rule lives

Options: (i) in `causeOf` (the adapter classifier); (ii) at the render layer
(classify as today, suppress the line).

**Pick (i).** The cause IS the semantic answer; suppressing at render would
leave `rawInputs[].cause` saying `constrained` while the UI says otherwise,
and the P3 lever matrix reads the cause. One source of truth.

Concretely, in `causeOf` (chain-builder-adapter.ts), before the constrained
branch — **this is the ONE EXECUTABLE statement of the predicate, and the
only place to edit code from** (r2/r3 BLOCKERs: both prior revisions left a
dead form in whichever paragraph the implementer reads).

**Three PROPOSITIONAL restatements exist deliberately, all reviewer-mandated,
all semantically identical to this block — and ALL must move with it:** the
amended classifier biconditional under "Already settled" (r1), the `P(…)`
form in Axis 1 (r2), and the algebraic form in Axis 3 (r3). (r4 caught that
"once and nowhere else" was overstated — and then caught that my first fix
named only ONE of the three. Naming them all is the point: the absolute
claim is the safety mechanism a future folder will trust, so it has to be
true.):

```ts
ungated.items[itemId]?.isRawResource === true &&
producerRecipesFor(ungated, itemId, EXCLUDED_MACHINE_IDS).length === 0 &&
producerRecipesFor(ungated, itemId, excludedMachineIds).length === 0
```

(`excludedMachineIds` is the live set already bound in `causeOf`;
`EXCLUDED_MACHINE_IDS` is the module constant.) It must use the
ALTERNATE-INCLUSIVE `producerRecipesFor` (the P3 lever predicates' lesson) —
`effectiveDefaultRecipe` is alternate-blind and would wrongly natural-ize
`coal`.

### Axis 3 — Interaction with the OTHER two dimensions (tier, and user exclusions)

Two dimensions can also empty a producer set, and the rule must swallow
neither. Both are now enumerated (r1: v1 covered only tier):

**Stated algebraically, because two rules died on unqualified
dimension-by-dimension claims and v3's first attempt at this section was a
third** (r3, both reviewers — the rule was right, the reason was not):

Let `Prod(x)` be the machines carrying a primary-producing recipe for `x` in
the UNGATED catalog. `producerRecipesFor` filters `!excluded.has(machineId)`
(`chain-builder-adapter.ts:554-557`), so `P(S) ⟺ Prod ⊆ S`, and therefore

> **the rule fires ⟺ `isRawResource` ∧ `Prod ⊆ CONST ∩ live`.**

Two consequences, both exact, neither needing a case walk:

- **`P(live)` is DEFINITIONALLY `¬tierLever`** — `leverOf` computes
  `tierLever = producerRecipesFor(ungated, itemId, excludedMachineIds)
  .length > 0` (`:381`), the identical call with the identical three
  arguments. So **no row carrying an actionable TIER-ALONE recovery can ever
  natural-ize**, on any combination. That is the r2 hole closed airtight.
  ("Tier-alone" is `tierLever`'s own meaning — raising the tier by itself
  restores producers, `chain-builder-adapter.ts:379`. Say it explicitly, r4:
  the `both` cell DOES natural-ize, and it must, since there raising the
  tier alone recovers nothing — see the `ore_iron @ defaults @ TIER ≤ 8`
  row above. This doc has a history of right-answer/wrong-reason findings;
  the distinction is load-bearing.)
- **When the rule fires, `machineLever` can only point at a machine in
  `CONST`** (since `Prod ⊆ CONST`, and gated recipes are a subset of
  ungated). So the ONLY recovery the rule ever suppresses is "re-enable the
  converter/packager" — which is precisely Axis 1's decision, not an
  accident.

The two dimensions in prose, now correctly qualified:

- **TIER.** A tier-gated producer keeps the item `constrained` with the tier
  lever **only when that producer's machine is outside the live set** — if
  it is inside (the default case for all 11 targets), `P(live)` still holds
  and `natural` is correct, because raising the tier alone recovers nothing.
- **USER EXCLUSIONS.** A user-excluded producer outside `CONST` falsifies
  `P(CONST)`, so the item stays `constrained` — with the `machine` lever,
  or `both` if that producer is ALSO tier-gated.

**Cell reachability, argued properly** (r2 — v2's "the rule keys on neither
varying dimension" was a non-sequitur; a rule CAN be invariant in both
dimensions and still delete a fixed item set from the constrained
population, which is exactly what the `ore_iron @ defaults @ TIER ≤ 8` row
above shows it doing). The four `leverOf` cells survive because the rule can
only reach `isRawResource` items, and **the 20 non-raw constrained items are
untouched** — e.g. `packaged_water` at a gating tier realizes the `both`
cell. Independently, the synthetic matrix fixtures
(`ingotCatalog`/`gatedIngotCatalog`/`altOnlyIngotCatalog`) set no
`isRawResource`, so every cell keeps its existing pin.

On the shipped data the raw tier case is constructible as `coal @ TIER ≤ 2`
(Charcoal's minimum unlock tier is 3, measured at r1) and now also as
`ore_iron` with the Converter un-excluded at TIER ≤ 8 (`iron_limestone`
unlocks at tier 9, measured at r2).

## Spec (file-by-file)

1. **`src/ui/chain-builder-adapter.ts`** — in `causeOf`, ahead of the
   constrained determination, add **the predicate exactly as written in the
   Axis 2 code block above**. It is NOT restated here: r2 and r3 both
   BLOCKED on a half-applied fold that left a dead form in whichever
   paragraph the implementer reads, so the doc carries ONE copy and every
   other mention points at it. Notes that are not the predicate: it reads
   the ungated `items` map with the `=== true` truthiness idiom the flag's
   own comment mandates (`types.ts:20-22`) — `gateCatalog` carries `items`
   through untouched, so gated and ungated agree, but the source is pinned;
   it is alternate-inclusive by construction; and `forced` (raw-marked)
   precedence is unchanged and still wins.

   **FIVE invariant comments this change FALSIFIES and must update** (r1 +
   r2 — v2 said "three" and missed the two that DEFINE the taxonomy; this
   codebase's comments are load-bearing provenance):
   - `chain-builder-adapter.ts:126-136` — the **`RawCause` typedoc**, the
     canonical definition: `"constrained"` = "the catalog HAS ≥1 producer
     but NONE is eligible…", `"natural"` = "otherwise". After the change
     `ore_iron` satisfies the `constrained` wording verbatim while
     returning `"natural"`, and `"natural"` acquires a positive branch so
     it is no longer "otherwise";
   - `chain-builder-adapter.ts:329-332` — the block comment directly above
     `causeOf`, which repeats that definition;
   - `chain-builder-adapter.ts:251-253` and `:338-346` (r2 NIT: the
     asserting sentence is at `:338-339`, not `:340`), both asserting
     `"natural"` means "no producer exists in the DATA AT ALL" — now it
     also means "no producer under either policy in play";
   - `types.ts:20-27`, whose "the sole consumer reads
     `?.isRawResource === true`" / "the raw-feed display derive is its only
     reader" claims stop being true the moment `causeOf` becomes a second
     reader (today's only readers are `graph-flow.ts:551,588`).

2. **`src/ui/ChainBuilder.tsx`** — **v1 said "no change expected"; that was
   WRONG** (r1, both reviewers). `ChainBuilder.tsx:476` keys off
   `view.rawInputs.every((r) => r.cause === "natural")`. Proposing a
   natural-ized raw item **as the target** therefore flips from a
   constrained line reading `RAW (no eligible producer): Iron Ore 120/min`
   to the `Nothing to build — the target is a raw input.` message — **and
   the rate disappears entirely**, because the metrics `<dl>` that would
   otherwise carry it is gated on `!view.isEmpty` (`:453`, rate at `:466`).

   **Accepted deliberately, not a regression to fix:** "Nothing to build —
   the target is a raw input" is the honest answer to "propose me Iron Ore",
   and strictly better than today's "no eligible producer" pointer at a
   machine the default excludes on purpose. The lost rate is the number the
   user just typed. Recorded as a VISIBLE UI CHANGE so it is walked and
   tested rather than discovered.
3. **An EXISTING pinned test breaks and must be amended, not worked around**
   (r1 MAJOR): `src/ui/chain-builder-adapter.test.ts:212-234` ("marks an
   all-raw proposal empty") runs against the real catalog and pins
   `ore_iron` as `cause: "constrained", lever: "machine"`, with a recorded
   rationale at `:218-222`/`:229-231`. Under this rule it becomes
   `cause: "natural", lever: null`. Update the assertion AND its rationale
   comment. Verified at r1: this is the **only** existing break — every
   other cause/lever assertion uses synthetic catalogs carrying no
   `isRawResource`.

4. **Tests** (adapter + UI, node env). Assert **named sets, never counts**
   (the S20 lesson — a `length === 11` against the real catalog is the
   brittle form; the named-item form is not):
   - the vacuous raw items classify `natural` — pin `ore_iron` (converter
     case) AND `water` (packager case) against the REAL bundled catalog,
     since the claim is data-shaped;
   - **`coal` still classifies `constrained` and still offers its
     constructor alternates** — the regression this design exists to avoid;
     it MUST fail against a blanket `isRawResource ⇒ natural` rule;
   - **`coal` STILL classifies `constrained` when the user excludes
     Constructor**, with the `machine` lever — the r1 MAJOR pin; it MUST
     fail against a live-exclusion-keyed (v1) rule;
   - **`ore_iron` STILL classifies `constrained` with the `tier` lever when
     the user UN-excludes the Converter at TIER ≤ 8** — the r2 IMPORTANT
     pin; it MUST fail against a constant-only-keyed (v2) rule.
     (`iron_limestone` unlocks at tier 9.) These two rows are the design's
     load-bearing pair: each kills one of the two rejected rules, so
     neither can be reintroduced silently;
   - `coal @ TIER ≤ 2` classifies `constrained` with the `tier` lever (the
     Axis 3 tier pin — the only construction the shipped data allows, since
     Charcoal's minimum unlock tier is 3);
   - proposing `ore_iron` AS THE TARGET renders `Nothing to build` (the spec
     item 2 UI change);
   - the 20 non-raw affected items are unchanged — spot-pin `polymer_resin`;
   - the P1 alternate-only collapse still classifies constrained (S20
     behaviour, unchanged).

   **Bidirectionality log** at
   `features/propose-followups/p0-r2-verification.log` — every mutation must
   COMPILE against live source, and the failing SET is sanity-checked, not
   just the count (the Stage 20 lesson; a result that looks unexpectedly
   STRONG gets investigated, not recorded).
5. **Docs at merge (team lead).**

## Explicitly out of scope

Changing `EXCLUDED_MACHINE_IDS` itself; any change to the four-cell lever
matrix; the 20 non-raw constrained items; converter/packager UX generally.

## Test + verification plan

Per spec item 3 + the log; trunk verify after worktree removal.
**Walk:** propose Iron Plate 60/min → Iron Ore renders on the plain RAW line
(no "no eligible producer" pointer); propose something coal-fed → Coal STILL
renders constrained with a live Charcoal/Biocoal picker; **tick Constructor
in MACHINE EXCLUSIONS → Coal STILL constrained, now with the machine-lever
hint** (the r1 case); **UN-tick Converter with TIER ≤ 8 → Iron Ore STILL
constrained, with the TIER-lever hint** (the r2 case — the two together
demonstrate that neither rejected rule survives); set TIER ≤ 2 → Coal
constrained with the TIER lever; **propose Iron Ore ITSELF as the target →
the "Nothing to build" message** (the accepted UI change, spec item 2).
Both themes.

## Assumptions ledger

- `isRawResource` marks exactly the game's extraction resources — grounded:
  set from the raw-resource group at `docs-loader.ts:102`; 13 items, matching
  the game's resource list.
- The 12/20 split and the converter/packager-only producer sets are
  MEASURED this session against `public/bundled-docs/en-US.json`, not
  assumed — and the `coal` exception was found by that measurement, not
  anticipated by the ticket.
- A user-uploaded Docs.json carries the same raw-resource group — grounded:
  same export format; the rule degrades safely (no flag ⇒ today's behaviour).
- **No `CATALOG_PARSER_VERSION` bump is needed** — grounded: verified at r1
  that `isRawResource` already rides the full cache round-trip
  (`catalog-store.ts:59, :247, :333`) and parser version 5 postdates the
  flag. Worth stating because ticket #57's scar (`types.ts:104-110`) is
  exactly the failure a reader will worry about here.
- The 32/20 split is CONTEXT, not load-bearing — the argument rests on
  13 / 12 / the coal exception, all three independently re-derived by both
  r1 reviewers (the code-reviewer enumerated the 20 non-raw items by hand
  and reached 32).

## Revision history

- v1 (2026-08-07): initial merged brainstorm+spec, written against measured
  data that reframed the ticket's premise (32 affected items, not 3; the
  `coal` counterexample that kills the blanket rule).
- v2 (2026-08-07): r1 fold (both NEEDS_REWORK; both re-derived and CONFIRMED
  every measurement, so the central argument stood — the defects were
  elsewhere). **MAJOR (both): the vacuity test was EXCLUSION-RELATIVE**, so
  it was the exact negation of P3's `tierLever` and consumed the matrix's
  `machine` and `both` cells — one Constructor tick and `coal` lost both its
  picker and its recovery hint, reintroducing at the hero item the very
  regression the refinement exists to prevent. FOLDED: the test now keys on
  the `EXCLUDED_MACHINE_IDS` CONSTANT, making the classification a property
  of the catalog rather than the session; the converse (user un-excludes the
  Converter) is safe by construction, since the item then becomes a stage
  and never reaches `causeOf`. **MAJOR (adversarial): an existing pinned
  test breaks** (`chain-builder-adapter.test.ts:212-234`) — now named in the
  spec with its rationale comment, and recorded as the ONLY such break.
  **IMPORTANT (both): spec item 2's "no change expected" was false** —
  `ChainBuilder.tsx:476` reads `cause`, so proposing a natural-ized raw item
  as the TARGET flips to "Nothing to build" and drops the rate line; now
  recorded as a deliberately ACCEPTED visible UI change, walked and tested.
  **IMPORTANT (code-reviewer): three invariant comments are falsified** —
  named in spec item 1, including `types.ts`'s "sole consumer" claim.
  **NITs FOLDED**: the amended biconditional is now stated; the packager
  cases named (3 of 11) instead of a converter-only gloss; the "two lines"
  overstatement corrected; the tier pin identified as `coal @ TIER ≤ 2`
  (Charcoal's min unlock tier measured at 3); tests assert NAMED SETS not
  counts; the `items`-map source and `=== true` idiom pinned; the
  no-parser-bump fact added to the ledger.
- v3 (2026-08-07): r2 fold (both NEEDS_REWORK, converging).
  **BLOCKER (both): v1-rule RESIDUE in Axis 2** — the fold was half-applied,
  and the paragraph left carrying the dead live-set predicate was the one
  that tells the implementer what to write. FOLDED: the predicate is now
  stated ONCE, as code, in that paragraph, and nowhere else.
  **IMPORTANT (both): the constant-only rule swallowed the `tier` cell for
  all 11 targets** — "r1's MAJOR rotated one axis". Verified counterexample:
  `iron_limestone` unlocks at tier 9, so a user who UN-excludes the
  Converter below tier 9 has a real "raise TIER" recovery that v2 would
  suppress. The joint (tier ∧ user-exclusion) cell was the one Axis 3
  enumerated as two independent bullets and never their conjunction — the
  same un-enumerated-dimension shape as r1. **FOLDED by making the rule the
  CONJUNCTION of both vacuity tests** (`P(CONST) ∧ P(live)`): each lever's
  precondition falsifies its own conjunct, so no cell can be swallowed on
  any combination. Checked against all five cases on shipped data, both
  directions. Note it is the conjunction, NOT `P(CONST ∪ live)` — the union
  is weaker and would re-admit the coal regression.
  **IMPORTANT (code-reviewer): the falsified-comment enumeration said
  "three" and missed two** — including the `RawCause` typedoc that DEFINES
  the taxonomy being amended. Now five, with the `:338-339` citation fixed.
  **NIT (adversarial): "safe by construction" is literally false** — the
  cycle guard demotes a selected producer to raw and it DOES reach
  `causeOf` (traced: stone→sulfur→coal→ore_iron with the Converter
  enabled). The outcome is unchanged there, but the claim was the reason
  the doc dismissed the whole converse direction — which is where the
  IMPORTANT was hiding. Replaced with the real argument.
  **Cell reachability re-argued properly** (r2: v2's version was a
  non-sequitur) — from the untouched 20 non-raw items and the synthetic
  matrix fixtures, not from the rule's dimension-invariance.
  Two new test rows added as a load-bearing PAIR: one kills v1, one kills
  v2, so neither rejected rule can return silently.
- v4 (2026-08-07): r3 fold. **BOTH reviewers CONFIRMED the conjunction
  HOLDS** — neither could construct a counterexample, and the code-reviewer
  proved it algebraically (`P(S) ⟺ Prod ⊆ S`, so the rule fires ⟺
  `Prod ⊆ CONST ∩ live`). The findings were all bookkeeping — but one was
  serious. **BLOCKER (both): SPEC ITEM 1 still stated the dead v2 rule.**
  This is the THIRD half-applied fold in this doc (r2: Axis 2; r3: spec
  item 1) and the second time the dead form survived in the paragraph an
  implementer actually builds from — implementing it as written would have
  failed this doc's OWN v2-killer test row. FOLDED, and structurally this
  time: the predicate now exists in exactly ONE place (the Axis 2 code
  block); every other mention points at it and restates nothing. Verified
  by grep, not by assumption.
  **IMPORTANT (adversarial): the Axis 3 TIER bullet asserted a false
  invariant** — a tier-gated producer does NOT fail `P(live)` when its
  machine is excluded under both policies, which is the default case for
  all 11 targets. The rule's answer there is right; the stated reason was
  wrong, in the section whose whole job is proving no cell is swallowed.
  FOLDED by adopting the reviewers' stronger formulation: `P(live)` is
  DEFINITIONALLY `¬tierLever` (identical call, `:381`), so no row with an
  actionable tier recovery can natural-ize — no case analysis needed; and
  when the rule fires, `machineLever` can only point inside `CONST`, so the
  only suppressed recovery is the degenerate one Axis 1 decided to suppress.
  **IMPORTANT (code-reviewer): the `water` case row was self-contradictory**
  — it said `constrained` and called the rule "conservative by
  construction", but `effectiveDefaultRecipe` resolves the non-alternate
  `unpackage_water`, so the cell is `natural` today AND under the rule. The
  conclusion (unchanged) survives; the label and the reasoning did not.
  **The missing cell is now recorded**: `ore_iron @ defaults @ TIER ≤ 8`
  renders `lever: "both"` today and no line at all under the rule — the
  intended outcome of Axis 1, stated rather than discovered.
  **NITs FOLDED**: "conjunct" → "conjuncts"; the USER EXCLUSIONS bullet now
  admits `both` as well as `machine`.
- v5 FROZEN (2026-08-07): r4 = **APPROVED_WITH_NITS ×2 — "the design is
  ready to freeze."** Both re-verified the five r3 folds against source: the
  executable predicate exists exactly once with no dead v1/v2 form anywhere
  (both grepped it), the algebraic argument is transcribed faithfully in
  BOTH halves incl. `machineLever ⊆ CONST`, and both corrected rows match
  the bundled catalog. The adversarial specifically hunted a FOURTH
  half-applied fold and confirmed it is not there. 4 NITs, all folded:
  the "tier recovery" claim now says **tier-ALONE** (the `both` cell does
  natural-ize, and must — raising the tier alone recovers nothing there);
  the `ore_iron @ TIER ≤ 8` delta now says "no CONSTRAINED line — the item
  moves to the plain RAW line, rate and all" (the earlier "no line at all"
  would have licensed a test asserting it renders nowhere, contradicting an
  existing pin); and the uniqueness claim is narrowed to the EXECUTABLE
  form with all THREE propositional restatements named — my first attempt
  at that fix named only one of them, which the adversarial caught. Design
  of record; implementation may proceed.
