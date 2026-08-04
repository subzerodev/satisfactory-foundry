# Stage 6 / Phase 1 brainstorm — data groundwork (ticket #25, epic #24)

Date: 2026-08-04
Status: v5 FROZEN — correctness converged (r4); simplify dispositioned
Inputs: live `src/data/` (types.ts CatalogMachine "Id + name only — no
power" comment; docs-loader.ts machine extraction; catalog-store.ts
CATALOG_PARSER_VERSION=1 with mismatch→re-parse at :103; plan-store.ts
PlanFileV2 + loadPlan validation; db.ts), `src/state/store.ts` plan-op
chain + PlansBar wiring, the pickup grounding of the bundled Docs.json
power fields (epic #24 / FEATURE.md): `mPowerConsumption`,
`mPowerConsumptionExponent`, and for variable-power machines
`mPowerConsumption: 0` + `mEstimatedMininumPowerConsumption` /
`mEstimatedMaximumPowerConsumption` (the game's own "Mininum" typo).

## Already settled — do NOT re-litigate

1. Sequential posture (Michael 2026-08-04); all-Claude roster; opus
   implementer; per-phase gates.
2. Two-phase decomposition (epic #24): this phase is DATA ONLY — no
   helper UI (match-demand/hints/power display are #26).
3. PlanFileV2 semantics are frozen (S3P3): validation pins, migrateV1,
   the save-over model (same name overwrites, createdAt preserved), the
   plan-op chain discipline.
4. Exactness ethos: parsed game numbers are Fractions; no float math on
   rates. The catalog cache re-parses on CATALOG_PARSER_VERSION
   mismatch (existing mechanism, verified live).
5. Rendering/consumption of power is #26's design; this phase only pins
   what the catalog STORES.

## Axis 1 — Catalog power shape: one struct, variable-power honest

`CatalogMachine` gains:

```ts
power: {
  mw: Fraction;        // constant draw at 100% clock — or the min/max
                       // MIDPOINT for variable-power machines
  variable: boolean;   // true ⇒ mw is the cycle AVERAGE estimate
  minMw?: Fraction;    // the exact bounds are a PARSE OUTPUT — the
  maxMw?: Fraction;    // midpoint is lossy, so the catalog retains
                       // both (simplify fold: data-phase rationale,
                       // independent of any renderer)
  exponent: Fraction;  // mPowerConsumptionExponent verbatim, PER
                       // MACHINE — the snapshot is non-uniform
                       // (observed: 1.6 majority, 1.321929 minority;
                       // simplify fold — a module constant would be
                       // silently wrong). Stored, not applied here.
}
```

- Parse rule (provenance = the grounded fields; r1+r2 folds — the
  machines map is NOT manufacturers-only, and the branch families are
  now enumerated from the REAL snapshot):
  1. `mPowerConsumption > 0` → constant (`mw` = that value, variable
     false) — every real manufacturer AND every powered extractor:
     miners Mk1/2/3 draw 5/15/45 MW and the Oil Extractor 40 MW
     (r2 fold — extractors are NOT a zero-draw family; the r2-caught
     mislabel is corrected).
  2. Both estimates present → variable (`mw = (min+max)/2` exact,
     minMw/maxMw kept) — the variable-power manufacturers (exemplar:
     Particle Accelerator, class Build_HadronCollider_C — r2 nit).
  3. Otherwise → `mw: 0, variable: false` — **the ZERO-DRAW branch,
     whose SOLE admitted tenants (r3 fold, source-resolved) are the
     GENERATORS: they carry `mPowerConsumption` PRESENT with value
     "0.000000" (key present, value 0 — falls through branch 1's > 0
     check; NOT "no key"). They burn fuel and PRODUCE power;
     `mPowerProduction` is deliberately NOT parsed (no consumer this
     arc; generation planning is Stage-7+ material with its own
     ticket). The fracking (Resource Well) extractor and the Water
     Pump are BOTH unadmitted by the loader regex (the alternative
     must immediately follow "FGBuildable" — "Fracking…"/"WaterPump"
     don't match) and are outside the catalog entirely (r3 fold — the
     r2 fracking-tenant claim retracted).** The r1 "never exhibits"
     premise stays retracted; the branch is real and tested.
- The exponent is stored VERBATIM as a Fraction, never applied in this
  phase. The known truth that overclocked power
  (`base × (clock/100)^exponent`) is irrational for most clocks is
  #26's display problem — recorded here so the reviewers don't re-derive
  it: the catalog stays exact because it stores only base values and
  the rational exponent; any approximation happens (labeled) at render.
- The "no power" comment in types.ts is superseded WITH citation (this
  brainstorm), same discipline as prior supersessions.

## Axis 2 — Parser + cache + bundled snapshot

- docs-loader's machine extraction gains the three-field read with the
  verbatim game key names (incl. "Mininum"); values parsed through the
  existing exact decimal→Fraction path used for rates.
- `CATALOG_PARSER_VERSION` 1 → 2 — one constant bump riding the
  existing mismatch path. **Stated plainly (r1 fold — "upgrades" was
  misleading): the bump DISCARDS every cached PARSE — no raw source
  text is stored (only a one-way hash), so there is no re-parse-from-
  source. Bundled-catalog users re-parse invisibly on next boot (the
  bundled Docs.json is fetched fresh). A user who UPLOADED a Docs.json
  silently falls back to the bundled snapshot (the bundled banner
  reappears — visible) or to needs-upload if bundled is unavailable,
  and re-uploads once to restore their file. Accepted cost, now
  honest.**
- Failure surface unchanged: a Docs.json that parses today still parses
  (the new fields are read with safe fallbacks per Axis 1's rule —
  never a new rejection reason).

## Axis 3 — Plan export

- PlansBar row gains a per-plan "Export" control. **Seam (r1 fold —
  the store is headless, PlansBar presentational): a new store action
  `exportPlan(id): Promise<string | null>` returns
  `JSON.stringify(plan, null, 2)` of the stored (or migrated) file —
  headless-testable, no DOM; App's handler awaits it and does the
  Blob → anchor download.** Filename: `<plan name>.foundry-plan.json`
  (name sanitized for filesystem: /\\:*?"<>| → "-").
- A v1-era stored row exports as its MIGRATED v2 form (loadPlanFile
  already migrates in memory — consistent with the S3P3 read-side
  model; the export is what a load would see, which is the honest
  export).
- No new validation: what's stored was validated at save.

## Axis 4 — Plan import

- PlansBar gains an "Import" file input (single .json). Pipeline:
  `file.text()` — CORRECT here, plan files are OUR OWN UTF-8 JSON
  exports, not the game's UTF-16 Docs (the S5 decode lesson applies to
  Docs.json only; stated so nobody "fixes" this into decodeBytes) →
  `JSON.parse` (failure → planError) → the EXISTING validation
  (isPlanFileV2, else isPlanFileV1→migrateV1 — the exact loadPlanFile
  acceptance) → **the NAME GUARD (r1 fold — imports were never
  validated by OUR name rules): trim the payload's name; empty after
  trim → planError refusal, nothing written; the trimmed form is what
  is saved AND what collision-matches** → SAVE via the save-over model
  (same trimmed name = overwrite that row; new = new row) → list
  refresh. Import does NOT auto-load the plan (saving ≠ switching your
  working graph — the user loads explicitly; least surprise).
  **Importing over the ACTIVE plan's name overwrites the stored row
  while the live graph keeps its current content — the same divergence
  save-over already permits (saving never re-loads); stated, accepted
  (r1 fold).**
- All inside the plan-op chain (total-op discipline: catch-into-
  planError inside the body, fresh list read, inline refresh).
- Timestamps (r1 fold — aligned to the savePlanAs precedent EXACTLY):
  `updatedAt` = now; `createdAt` = now for a NEW name (savePlanAs gives
  new rows now — an imported payload's timestamp is untrusted foreign
  data), and the EXISTING row's createdAt on overwrite. The
  "history travels" idea is dropped.

## Axis 5 — Testing posture

- Parser rows (docs-loader.test): constant manufacturer (Constructor
  4 MW, exponent 1321929/1000000 exact); **constant EXTRACTOR (r2 fold
  — the coverage the mislabel hid): Miner Mk1 → mw 5, branch 1 (a
  loader regression zeroing a miner must FAIL a test)**; variable
  machine (Particle Accelerator, Build_HadronCollider_C → mw 875 =
  (250+1500)/2 exact, minMw/maxMw kept, variable true); a real
  GENERATOR row → mw 0, variable false (branch 3); bundled-catalog spot
  pins with values read from the snapshot at implementation and cited.
- catalog-store row: a version-1 cached row is treated as stale
  (mismatch → "stale" classification — the existing path, re-pinned
  against version 2).
- plan-store/store rows: exportPlan returns the stored JSON verbatim
  (v2) and the migrated form for a v1 row; import round-trip (export →
  import under a new name → identical content, fresh id, createdAt =
  now); import overwrite preserves the EXISTING row's createdAt;
  **name-guard rows: empty/whitespace name → planError, nothing
  written; untrimmed "  Foo  " collision-matches an existing "Foo"
  (r1 fold)**; corrupt JSON / failed validation → planError, store
  untouched; import does not change the live graph (incl. the
  import-over-active-name divergence row).
- Filename sanitization table row.
- Bidirectionality log per family (parser fields, version bump, export
  shape, import validation/collision).
- Browser walk: power visible in nothing yet (data-only phase — walk
  verifies NO UI change beyond the two PlansBar controls), export a
  plan, re-import it, corrupt-file refusal.

## Assumptions ledger

1. The grounded power fields exist with those exact names/typo across
   the ADMITTED building families (r2+r3 folds): mPowerConsumption on
   manufacturers, ResourceExtractors (miners/oil), AND generators
   (present-as-0 on every generator — r3 source resolution of a
   reviewer contradiction), the estimate pair on
   FGBuildableManufacturerVariablePower; the fracking extractor and
   Water Pump are unadmitted — grounded by direct reads of
   public/bundled-docs/en-US.json (epic #24 + r1-r3 review evidence).
2. CATALOG_PARSER_VERSION mismatch → stale-with-NO-catalog is the live
   mechanism (no stored source text; the fallback chain is bundled →
   needs-upload) — grounded (catalog-store.ts:20,55-63,117-119) and
   stated honestly in Axis 2 (r1 fold).
3. Plan exports are UTF-8 JSON we produce — file.text() is correct for
   import (the UTF-16 hazard is Docs.json-specific) — grounded in the
   export path defined here.
4. loadPlanFile migrates v1 in memory (S3P3, shipped) — export-as-v2
   for old rows follows — grounded.
5. The decimal→Fraction parse path used for rates accepts the power
   decimals ("4.000000", "1.321929") exactly — grounded (same textual
   form as rate fields the parser already reads).

## Revision history

- **r1 correctness (2026-08-04):** code-reviewer NEEDS_REWORK (1 BLOCKER
  + 1 IMPORTANT + 1 NIT); adversarial NEEDS_REWORK (2 MAJOR + 2 MINOR +
  1 NIT). Folded in v2:
  1. **The generator branch** (the BLOCKER): the zero branch is the
     deliberate Generator/Extractor branch — 0 MW DRAW is correct
     semantics; mPowerProduction deliberately unparsed (Stage-7+, own
     ticket); the false "never exhibits" premise retracted; a real
     generator test row added.
  2. **Version-bump honesty** (adversarial MAJOR): the bump DISCARDS
     cached parses; custom uploads visibly fall back to bundled and
     need one re-upload — stated as an accepted cost; ledger reworded.
  3. **Import name guard** (adversarial MAJOR): trim + refuse-empty
     mirroring savePlanAs; collisions match on the trimmed form.
  4. **createdAt aligned to precedent** (code-reviewer IMPORTANT): new
     name → now; overwrite → existing row's value; foreign timestamps
     untrusted.
  5. **exportPlan store action** (adversarial NIT): headless JSON
     string from the store; App owns the Blob/anchor DOM step.
  6. Import-over-active divergence stated+accepted; guessed test
     constants dropped.
  Refuted-and-held r1: machines ARE built from building class rows
  (power rides displayName's source — no structural parser change);
  Collider midpoint = the wiki convention for a monotonic ramp; stored
  plans contain zero Fraction objects (stringify-safe); file.text()
  correct for our own UTF-8 exports.
- **r2 correctness (2026-08-04):** code-reviewer NEEDS_REWORK (2
  IMPORTANT + 1 NIT); adversarial NEEDS_REWORK (1 IMPORTANT + 1 MINOR)
  — the same root found independently. Folded in v3:
  1. **Branch 3 relabeled the ZERO-DRAW branch** with its real tenants
     enumerated (generators + the fracking extractor); powered
     extractors (miners 5/15/45 MW, Oil Extractor 40 MW) named as
     branch-1 machines; Water Pump noted as not-admitted.
  2. **Miner Mk1 branch-1 test row added** — a loader regression
     zeroing a miner must fail the suite.
  3. Exemplar renamed Particle Accelerator (Build_HadronCollider_C);
     ledger #1 broadened to the admitted families.
  Refuted-and-held r2: exportPlan object re-serialization deterministic;
  the name-guard refusal exactly mirrors the savePlanAs planError
  precedent; folds 2-5 verified exact.
- **r3 correctness (2026-08-04):** both NEEDS_REWORK (1 each) — and
  MUTUALLY CONTRADICTORY on the generator key; resolved by the team
  lead's direct source read (the divergence-table rule). Folded in v4:
  1. Generators carry mPowerConsumption PRESENT-AS-0 (code-reviewer
     correct; "no key" retracted).
  2. The fracking extractor is UNADMITTED by the loader regex
     (adversarial correct; the r2 tenant claim retracted) — branch 3's
     sole admitted tenants are the generators.
  Held: miner values, Water Pump exclusion, Miner Mk1 test row,
  Particle Accelerator rename all verified sound by both.
- **Simplify pass (2026-08-04, one-shot): APPROVED_WITH_NITS (2 NIT,
  both doc-only, both FOLDED).** (1) The exponent comment now states
  per-machine non-uniformity (observed 1.6 majority / 1.321929
  minority — the pass verified the snapshot and FORECLOSED the
  make-it-a-constant simplification factually); (2) minMw/maxMw
  rationale reframed data-phase-native (exact bounds are a parse
  output; the midpoint is lossy) instead of forward-referencing #26.
  Affirmed already-simple: the export/import seams (thinnest headless
  shapes over existing precedent), import-does-not-auto-load (the
  simpler SEMANTIC), sanitization set, zero test-row redundancy.
- **v5 FROZEN (2026-08-04).**
