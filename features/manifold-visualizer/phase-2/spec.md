# Phase 2 spec — src/data Docs.json parser + catalog (ticket #4, epic #2)

Date: 2026-08-03 · Status: v1, design dual-review pending
Provenance: brainstorm (FROZEN, `features/manifold-visualizer/phase-2/brainstorm.md`
— its port inventory file:line citations into `~/workspace/satisfactory-planner`
are the port ground truth); solver contract = `src/core/manifold.ts` on develop.

## Deliverable

`src/data/` (all new; zero `src/core` changes):

| module | contents |
|---|---|
| `types.ts` | catalog types below |
| `docs-loader.ts` | `parseDocsJson(raw: unknown): Catalog` — ported parser |
| `catalog.ts` | `parseCatalogFromText(text: string): Catalog` (JSON.parse + parseDocsJson) |
| `tiers.ts` | curated `TIER_TABLE: TierTable` (Fractions, ascending) |
| `stage-input.ts` | `toStageInput(...)` + `parseRational(...)` |
| `db.ts` | raw-IDB promise wrapper, database **`satis_foundry`** v1, store `catalog` |
| `catalog-store.ts` | cache orchestration: save/load with version + hash |

Colocated tests per module. One new devDependency: `fake-indexeddb`.

## Types

```ts
import { Fraction } from '../core/fraction.ts';

export interface CatalogItem { id: string; displayName: string; isFluid: boolean }
export interface CatalogMachine { id: string; displayName: string }
export interface RecipeIO { itemId: string; perMinute: Fraction } // per machine @100% clock
export interface CatalogRecipe {
  id: string; displayName: string; machineId: string; isAlternate: boolean;
  inputs: RecipeIO[]; outputs: RecipeIO[]; primaryOutputId: string;
}
export interface TierTable { belt: Fraction[]; pipe: Fraction[] } // ascending
export interface Catalog {
  items: Record<string, CatalogItem>;
  machines: Record<string, CatalogMachine>;
  recipes: Record<string, CatalogRecipe>;
  tiers: TierTable;
}
```

`Catalog.tiers` is always `TIER_TABLE` (belts 60/120/270/480/780/1200, pipes
300/600 — the planner's transport.ts values, matching the v1 spec's examples).
No power, no stack sizes (trimmed per the frozen brainstorm).
`primaryOutputId = outputs[0].itemId` (the port's rule, restated for the
renamed field).

## Parser behaviour (`docs-loader.ts`) — ported, with pinned deltas

Ports the planner's structure (NativeClass regex filters; item/building/recipe
extraction; recipe post-processing) with these pinned deltas — everything not
listed here behaves as the port source does:

1. **Exactness**: the two surviving numeric sites read the ORIGINAL strings —
   `mManufactoringDuration` and the ingredient/product `Amount` regex capture
   — via `Fraction.parse`. Rate = `amount.mul(60).div(duration)`; fluids
   normalize liters→m³ via exact `.div(1000)`. No `parseFloat`, no
   `Math.*`, no float anywhere. **The ingredient regex is ported unchanged**
   (`[0-9.]+` capture): a NON-capture skips the entry exactly as the port
   does (extractors/empty lists stay silent skips); a CAPTURED string that
   `Fraction.parse` rejects (e.g. two dots — genuine corruption, no real
   recipe) throws.
2. **Loud failure replaces silent defaults**: missing/malformed/`≤ 0`
   duration → throw `DocsParseError` naming the recipe (the planner's
   `?? '1'` default and `duration ≤ 0 → per_min 0` fallback are NOT ported).
   Root value not an array → `DocsParseError`. `Fraction.parse` failures on a
   captured Amount → `DocsParseError` naming recipe + item.
3. **Ported filters kept**: skip cosmetic/vehicle descriptor classes; skip
   recipes whose producing building is unknown; skip recipes with zero
   outputs or outputs referencing unknown items; `Alternate:` display-prefix
   strip + `isAlternate` flag; ClassName→snake id normalization scheme.
4. **Power/stack extraction removed** (machines keep id + displayName only;
   items keep id + displayName + isFluid, from `mForm` RF_LIQUID/RF_GAS).
5. All parse failures surface as `DocsParseError` with a human-readable
   `message` — the upload UI (Phase 4) shows it verbatim; nothing reaches
   solve time (v1 spec §Validation).

## `toStageInput` (`stage-input.ts`)

```ts
export interface StageOptions {
  machineCount: number;
  clockPercent: Fraction;
  unlockedTiers: { belt: number; pipe: number };  // prefix count per kind, ≥ 1
  overrides?: {
    feeds?: Record<string, (Fraction | null)[]>;   // keyed by itemId
    outputs?: Record<string, (Fraction | null)[]>;
  };
}
export function toStageInput(recipe: CatalogRecipe, catalog: Catalog,
  opts: StageOptions): StageInput;
```

- Feeds = `recipe.inputs`, outputs = `recipe.outputs`; lane kind =
  `catalog.items[itemId].isFluid ? 'pipe' : 'belt'`; `perMachineRate` =
  `RecipeIO.perMinute` (base @100%; the solver applies clock).
- `capacities` = `{ belt: TIER_TABLE.belt.slice(0, unlockedTiers.belt),
  pipe: ...slice(0, unlockedTiers.pipe) }` (ascending by construction).
- Overrides distribute onto the matching lane's `LaneInput.overrides`.
  **Precondition (asserted): at most one lane per (itemId, side)** — duplicate
  itemIds on one side throw (modded-data guard; real Docs.json never has
  them). Unknown override itemIds (no matching lane) throw.
- **Throw-vs-finding principle**: `toStageInput` throws on caller-bug SHAPE
  errors the solver's `Finding` union cannot express (duplicate lanes,
  unknown override keys, `unlockedTiers < 1` or beyond the table — an empty
  capacity list would pass the solver's validation yet crash its top-tier
  assert); VALUE errors remain the solver's findings-out contract. One
  boundary, two error channels, stated.
- Unknown `recipe.machineId`/item refs cannot occur post-parse (parser
  filters); `toStageInput` does not re-validate catalog integrity.

`parseRational(s: string): Fraction` — revives `Fraction.toString()` output:
split on `/` → `Fraction.of(BigInt(num), BigInt(den))`; no `/` →
`Fraction.from(BigInt(s))`. Throws on any other form. (Fraction emits sign on
the numerator only; `BigInt` accepts it. NO core change.)

## Cache (`db.ts` + `catalog-store.ts`)

- Database `satis_foundry`, version 1, single object store `catalog`,
  key `'current'`. Raw IndexedDB via a promise wrapper (ported shape);
  NOT the planner's `satis_planner` (pinned — cross-app collision).
- `StoredCatalog` = JSON-safe: the catalog with every `Fraction` serialized
  via `toString()`, plus `source_hash` (SHA-256 of the uploaded text,
  WebCrypto), `cached_at` (ISO), `parser_version` (const, starts 1).
- `saveCatalog(text, catalog)`; `loadCatalog(): {status:'hit',catalog} |
  {status:'stale'} | {status:'empty'}` — stale on version mismatch OR reviver
  failure (never throws to the caller); revive via `parseRational`. The
  port's stale-payload diagnostics (`cachedVersion`/`currentVersion`) are
  **deliberately dropped** — the Phase 4 UI shows a generic re-upload prompt.
  Note: the `{hit|stale|empty}` orchestration + hash path is newly tested
  here (the planner never tested catalog-store) — test row 7 carries that
  weight, not inherited proof.

## Test plan (Vitest; node env; `fake-indexeddb/auto` for db tests)

1. **DOCS_FRAGMENT parse** (ported + extended embedded fixture): items
   (solid/fluid/biomass-prefix classes), machine, 2 recipes → exact catalog
   shapes; Wet-Concrete-style fluid case asserts water `perMinute` exactly
   `100` m³/min from `Amount=10000`/dur `"6"` (exact `.div(1000)` path).
2. **Fractional exactness**: duration `"4"` + Amount `"2.5"` → `perMinute`
   exactly `75/2` (asserted via `eq`, not approximate).
3. **Loud failures**: zero/missing/malformed duration; non-array root;
   malformed Amount → `DocsParseError` with recipe-naming messages.
4. **Ported filters**: unknown-building recipe skipped; zero-output recipe
   skipped; cosmetic classes ignored; `Alternate:` strip + flag.
5. **toStageInput**: 20-smelter equivalent from a fixture recipe →
   `solveStage` on the REAL solver returns the Phase 1 worked-example result
   (integration proof); pipe lane gets pipe capacities; tier slicing
   (`{belt:4}` → [60,120,270,480]); lane-addressed override lands on the
   right lane; duplicate-itemId side throws; unknown-override-item throws;
   `unlockedTiers < 1` or beyond table length → throw.
6. **parseRational round-trip**: `"75/2"`, `"120"`, `"-3/4"`, `"0"` exact;
   garbage throws.
7. **Cache round-trip** (fake-indexeddb): save → load hit with
   Fraction-equal catalog; version bump → stale; corrupted stored shape →
   stale (not throw); hash recorded.

Bidirectionality log per the workflow rule
(`features/manifold-visualizer/phase-2/r2-verification.log` at implementation).

## Acceptance criteria (mirrors ticket #4)

- Parse produces exact-Fraction catalog; decimal-string exactness end-to-end.
- `toStageInput` integration-proven against the live solver.
- Cache hit/stale/empty flow works under fake-indexeddb; malformed uploads
  fail loudly at parse time.
- check + tests green; core purity untouched; only `fake-indexeddb` added.

## Assumptions ledger

- **Port citations are ground truth** — carried from the frozen brainstorm
  (verified twice: inventory read + both r1/r2 reviewers).
- **Docs.json numerics are strings** — verified in port source + fixtures;
  hence exactness is structural.
- **Fraction API unchanged suffices** — parse/of/from/mul/div/toString;
  `parseRational` lives in src/data (typechecked form per r1 fold).
- **`src/data` may import `../core/fraction.ts`** — the purity allowlist
  restricts `src/core/**` imports only; data→core direction is legal (and
  `../data` imports INTO core remain banned).
- **fake-indexeddb under node-env Vitest** — the planner's own db.test.ts
  proves the pattern.
- **`crypto.subtle` is a Node ≥ 20 global** — the repo toolchain satisfies
  this (`@types/node` v24); no shim needed for SHA-256 in node-env tests.

## Revision history

**Round 1 design review** (code-reviewer: APPROVED_WITH_NITS, 3;
adversarial-reviewer: APPROVED_WITH_NITS, 3 — converged round 1). All six
nits folded; none rejected:

- Regex-ported-unchanged + skip-vs-throw boundary made explicit at the
  exactness delta (adversarial): non-capture skips like the port; captured
  garbage throws; no real recipe wrongly rejected.
- Throw-vs-finding principle stated at `toStageInput` (adversarial), grounded
  in the empty-capacities solver-assert hazard it found.
- Cache-orchestration newly-tested note added (adversarial) — the planner
  never tested catalog-store; row 7 carries the proof.
- `primaryOutputId = outputs[0].itemId` pinned (code-reviewer).
- Stale-payload drop marked deliberate with the Phase 4 rationale
  (code-reviewer).
- Node ≥ 20 `crypto.subtle` floor added to the ledger (code-reviewer).
