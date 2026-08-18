# #142 — Variable-power machines report the recipe's real draw

**Tier 2 · brainstorm+spec (merged, lean).** Design substance dual-reviewed as
gap-report W1 (`features/game-mechanics-audit/gap-report.md` @ `ae266b1`);
fix shape + the gating trap approved by Michael (#140 comment 24744; ticket
#142). This spec pins implementation choices only.

## Already settled — do NOT re-litigate

- The defect: `parseMachinePower` uses the building's all-recipes envelope
  midpoint (`src/data/docs-loader.ts:497-501`); the game puts real figures on
  recipes via `mVariablePowerConsumptionConstant`/`Factor`, unparsed. A
  Particle Accelerator on Plutonium Pellet reports 875 MW where the truth is
  250–750 mean 500 — corroborated by the game's own item description.
- The fix shape: parse the two fields onto `CatalogRecipe`; use
  `[const, const + factor]`, mean `const + factor/2`.
- **The gate is the PRODUCING BUILDING, never the recipe's fields** (the
  Ballistic Warp Drive trap, adversarially verified: 46 recipes carry a
  non-default factor, only 43 sit on the three variable-power buildings;
  field-gating would report BWD at 500–1500 MW instead of 55).
- Lands ahead of the #140 arc, standalone (#140 comment 24744).

## Purpose

The three `FGBuildableManufacturerVariablePower` buildings (Particle
Accelerator, Converter, Quantum Encoder) report per-recipe power instead of a
per-building envelope, everywhere power is shown or summed.

## Design

### D1 — parse (lenient, absent-tolerant)

`RawRecipe` (`docs-loader.ts:43-50`) gains `variablePowerConstant` and
`variablePowerFactor` (raw strings, carried like `duration`). Post-processing
attaches `CatalogRecipe.variablePower?: { constantMw: Fraction; factorMw:
Fraction }` ONLY when both fields are present and parse as decimal strings —
anything else means the field is absent (the `parseMachinePower` posture:
never a new rejection reason). `factorMw` of 0 is legal and attached
(`Recipe_SingularityCell_C` ships factor 0.000000 — inert anyway, its
building is not variable).

### D2 — the gate, materialized as data the catalog already has

New pure helper in `src/core/machine-power.ts`:

```
effectiveMachinePower(power: MachinePowerInput,
  recipeVariable?: { constantMw: Fraction; factorMw: Fraction },
): MachinePowerInput
```

Returns `power` unchanged UNLESS `power.variable === true` AND
`recipeVariable` is present, in which case:
`{ variable: true, mw: const + factor/2, minMw: const, maxMw: const + factor,
exponent: power.exponent }`.

`power.variable` IS the building-class gate: it is set exclusively by
`parseMachinePower`'s branch 2 (both `mEstimated*` bounds present —
`docs-loader.ts:495-501`), which only the three
`FGBuildableManufacturerVariablePower` classes trigger. So:

- **Ballistic Warp Drive** (Manufacturer, 55 MW constant): `variable: false`
  → fields IGNORED, reports 55 MW. The trap, closed by construction.
- Variable building + recipe fields: recipe truth (Plutonium Pellet:
  mean 500, varies 250–750).
- Variable building + recipe WITHOUT fields: today's envelope midpoint
  (honest fallback; no recipes regress).

### D3 — call sites: the THREE surfaces that can host a variable building

(r1 fold: the original "every consumer threads the recipe" was imprecise —
two consumers are structurally pass-through and are NOT touched.)

Corrected surfaces (the only ones where a variable-power building can
appear), each with its INTEGRATION MECHANISM stated precisely (r2 fold —
the adapter is not a projection consumer at all):

1. `src/ui/advice.ts` — a call-site swap. `stagePowerTextFor` (`:189`)
   resolves the recipe IN-PLACE (it already takes `(catalog, stage)` and
   holds `stage.selection.recipeId`; no signature change, so its callers
   `App.tsx:163` / `graph-flow.ts:550` are untouched); `chainPowerText`'s
   per-stage loop (`:113`, projection call `:124`) does the same. Two
   knock-ons this requires, stated so the diff is no surprise:
   `stagePowerOf` (`advice.ts:164-183`) currently DISCARDS the resolved
   recipe (returns only `machine.power`, `:182`) — it returns the recipe's
   `variablePower` alongside; and the structural `ChainCatalog.recipes`
   type (`advice.ts:158`) widens with the optional field.
2. `src/ui/chain-builder-adapter.ts` — an IN-LOOP correction, NOT a
   projection swap: `proposalMetrics` never calls `machinePowerProjection`
   (grep: zero matches in the file). Its per-stage loop reads
   `catalog.machines[…].power` directly and sums `mw/minMw/maxMw` + the
   `powerVaries` flag (`:794-808`); `subtreePowerText` (`:980-1000`) later
   synthesizes a `MachinePowerInput` from those sums. The fix: inside the
   loop, replace each stage's `power` with
   `effectiveMachinePower(power, recipe.variablePower)` BEFORE summing —
   which requires retaining the recipe object (the loop currently keeps only
   `machineId`): add `const recipe = catalog.recipes[stage.recipeId]`
   alongside the existing lookup (adversarial r2 nit fold) —
   (`stage.recipeId` is in scope at `:794`; the correction is inserted
   AFTER the existing `power === undefined` guard at `:797`, where `power`
   is known-defined); `subtreePowerText` is untouched — it consumes the
   corrected sums.

   **`powerVaries` semantics, stated affirmatively (r2 nit fold):** a
   corrected variable machine keeps `variable: true`, so `powerVaries`
   stays true and the "(varies A–B MW)" suffix remains — deliberately. The
   machine genuinely varies WITHIN the recipe (the game's own "250-750 MW
   (500 MW average)"); the fix makes the bounds exact per-recipe instead of
   the wrong all-recipes envelope. Do not drop the suffix.

Pass-through by construction (NOT edited — every machine on these surfaces
is constant-power, so `effectiveMachinePower` would be an identity):

- `src/core/link-plan.ts:165` — projects `packager.power` over a BLEND of
  the package and unpackage recipes (`:130,:166-167`); there is no single
  recipe to thread, and the packager is a constant-power Manufacturer.
  Unchanged.
- `src/ui/extraction-plan.ts:164,229` — extractor power text, no recipe
  context, extractors never variable. Unchanged.

The helper is the single owner of the gating rule; call sites contain no
conditional logic of their own.

### D4 — persistence (the isRawResource scar class)

`StoredRecipe` (`catalog-store.ts:75-83`) gains optional
`variablePower?: { constant: string; factor: string }` (Fraction toString
round-trip, like every stored rate); `serializeCatalog`/`reviveCatalog`
carry it. **`CATALOG_PARSER_VERSION` bumps 6 → 7** — without the bump a
cached catalog never regains the field and the fix silently no-ops for
existing users, the exact recorded scar (`catalog-store.ts:31-36`). The #144
steamBuild self-heal does NOT substitute: it fires on bundle refresh, not on
parser-schema change.

### D5 — what does NOT change

- `parseMachinePower` and the building-level envelope (still parsed, still
  the fallback and the bounds source for recipe-less display contexts).
- `machinePowerProjection` itself — the helper composes IN FRONT of it.
- The recipe-less "(varies A–B MW)" suffix semantics; only the numbers feed
  differently when a recipe carries fields.

### Deletion sweep (per the standing memory rule)

Swept `varies|variableBoundsMw|mEstimatedM|variable: true` across all test
files. Five files matched; `transport.test.ts:255` is a false positive
("ceilingBound varies per row", no power pin — inspected and excluded).
Every existing pin uses SYNTHETIC fixtures whose recipes carry no
variable-power fields — `machine-power.test.ts` (500–3000 bounds),
`advice.test.ts:154,170` ("1750 MW (varies 500–3000 MW)", overclock ≈ case),
`chain-builder-adapter.test.ts:461-486,778`, `docs-loader.test.ts:719-720`
(envelope parse pin). Under D2's absent-field fallback ALL remain valid and
UNTOUCHED — no existing assertion pins envelope output for a recipe WITH
fields. The only test-file edits are additions.

### Tests (new)

- Parser: both fields present → attached exactly; one missing / malformed →
  absent; factor 0 → attached.
- `effectiveMachinePower` unit: the three D2 cases, including the BWD pin
  (variable:false + fields → unchanged envelope input).
- Integration (advice): a variable-machine fixture whose recipe carries
  const 250 / factor 500 → `"500 MW (varies 250–750 MW)"` at 1 machine,
  100% clock; the same machine with a field-less recipe → today's envelope
  text (pins the fallback).
- Round-trip: `variablePower` survives serialize → revive (the scar pin).
- Bidirectionality log: gate mutation (helper returns `power`
  unconditionally) must fail the integration pin + the unit pins; the BWD
  pin must fail under a field-gated mutation (`recipeVariable` alone
  triggering).

## Acceptance criteria

1. A variable-power building running a field-carrying recipe reports
   `const + factor/2` MW with bounds `[const, const + factor]`, on every
   surface (stage advice, chain totals, packaging line, cost sheet/compare).
2. Ballistic Warp Drive (constant-power building, fields present) reports
   55 MW exactly as today.
3. Variable building + field-less recipe: byte-identical to today.
4. `CATALOG_PARSER_VERSION` is 7; a v6 cache row loads as stale and
   re-parses.
5. `npm test` + `npm run check` green; no existing test file edited except
   by addition — EXCEPT the version-pin retargeting AC4 forces
   (`catalog-store.test.ts` pins asserting `CATALOG_PARSER_VERSION` and the
   stale-under-current-version fixture must move with the bump; diff-review
   adjudication).

## Assumptions ledger

- `mVariablePowerConsumptionConstant`/`Factor` semantics are
  `[const, const+factor]` — grounded: Converter recipes uniformly 100/300
  against its 100–400 envelope; Plutonium Pellet 250/500 matches the game's
  own "250-750 MW (500 MW average)" description (adversarially verified,
  gap-report W1).
- `power.variable === true` ⇔ the three variable-power native classes —
  grounded: branch 2 requires both `mEstimated*` keys, which a Docs.json
  sweep found only on those classes (audit); and the 43/3 recipe split was
  re-derived exactly by two reviewers.
- No consumer reads `CatalogRecipe` shape positionally / exhaustively such
  that an optional field breaks it — grounded: recipes flow through
  structural typing only (`BuilderRecipe` picks named fields,
  `chain-builder.ts:29-37`).

## Revision history

- **r1 → r2** (design review r1, code-reviewer APPROVED_WITH_NITS: 1
  IMPORTANT-severity precision finding + 3 nits, all folded): D3 rewritten —
  "every consumer threads the recipe" was false; only THREE surfaces can
  host a variable building (stagePowerTextFor resolving in-place with no
  signature change, chainPowerText's loop, proposalMetrics), while
  link-plan (constant-power packager) and extraction-plan (extractors) are
  pass-through by construction and are NOT edited. Nits: StoredRecipe span
  :75-83; the stagePowerTextFor consumer-labeling clarified. The reviewer
  verified B1 (gate cannot over-fire: exactly 3 mEstimated* carriers in the
  game file, all variable-class), B3 (optional field matches the
  isRawResource precedent, not the recipeUnlocks one; bump 6→7 required),
  B4 (sweep complete), B5 (Plutonium arithmetic exact). Adversarial verdict
  pending at fold time.
- **r2 (adversarial r1 folded in):** adversarial-reviewer NEEDS_REWORK — its
  IMPORTANT deepened the code-reviewer's D3 finding: proposalMetrics is NOT
  a machinePowerProjection consumer (it sums power.* directly in its own
  loop; subtreePowerText synthesizes the input later), so the adapter fix
  is an IN-LOOP correction before summing, not a call-site swap; link-plan
  blends TWO recipes (package+unpackage) so "thread the recipe" was
  meaningless there; extraction-plan surfaces added to the pass-through
  list. Its NITs folded: the stagePowerOf discard + ChainCatalog.recipes
  type widening named as explicit knock-ons; the deletion sweep now records
  the inspected-and-excluded fifth match. Refutation attempts B1 (gate
  over-fire), B5 (arithmetic), D4 (optional+bump) all failed and are
  recorded sound. r2 goes to both correctness reviewers.
- **r2 amended (code-reviewer r2 folded in):** code-reviewer r2
  APPROVED_WITH_NITS — every r1→r2 mechanism verified implementable against
  source (in-loop shape, scope of stage.recipeId, zero projection calls in
  the adapter, both stagePowerTextFor callers untouched). Two nits folded:
  (1) powerVaries semantics stated affirmatively — the suffix stays, bounds
  become exact (do-not-drop note added to D3(b)); (2) the adapter insertion
  point pinned AFTER the power === undefined guard (:797). Adversarial r2
  verdict pending.
- **r2 final (adversarial r2 APPROVED_WITH_NITS):** all three attack fronts
  refuted — no null-recipeId edge (ProposedStage.recipeId is string), the
  missing-recipe case already continues before the correction point, every
  synthetic fixture is identity under the helper (zero existing expectation
  changes), the candidate-row surface flows through the SAME corrected loop,
  and the ChainCatalog widening breaks no consumer. Its one NIT folded: the
  `const recipe = …` binding named explicitly in D3(b). Correctness gate
  CONVERGED at r2 (AWN + AWN, all findings dispositioned).
- **r2 simplify pass (one-shot, APPROVED, no findings):** the separate
  helper proven structurally necessary — proposalMetrics sums power BEFORE
  any projection call, so a projection-parameter fold would arrive after
  recipe identity is destroyed; the bump-and-optional-field persistence is
  the recorded-scar-minimal path; the knock-on inventory judged
  proportionate given this repo's silent-drop history. DESIGN FROZEN at r2.
- **post-freeze amendment (diff review r1, code-reviewer
  APPROVED_WITH_NITS):** AC4 and AC5 were mutually unsatisfiable as
  written — bumping the version constant forces the two existing
  catalog-store.test.ts pins to move. AC5 amended to admit exactly that
  forced retargeting. Root cause recorded: the deletion sweep matched
  feature terms but not the VERSION LITERAL — third instance of the
  changed-pin class this session; a version bump must sweep the version
  literal too (memory updated). types.ts doc-comment phrasing harmonized
  (46 total / 43 variable / 3 inert).
