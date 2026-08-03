# Phase 2 brainstorm — src/data Docs.json parser + catalog (ticket #4, epic #2)

Date: 2026-08-03 · Status: v1, design dual-review pending
Grounding: port inventory read from live `~/workspace/satisfactory-planner`
source — `src/data/docs-loader.ts` (206 ln), `src/data/catalog.ts`,
`src/persistence/catalog-store.ts`, `src/persistence/db.ts`,
`src/core/types.ts` §Catalog, `src/core/transport.ts` (a Svelte repo; the
planner's "data layer" spans data/ + persistence/ + parts of core/).
File:line citations below are into that repo.

## Already settled — do NOT re-litigate

- Parser is a **port of the planner's proven parser, trimmed to what v1
  reads**; parsed catalog cached in IndexedDB; upload-time failure messages,
  never solve-time crashes (v1 spec §Architecture + §Validation).
- Exactness boundary (epic #2 decisions): rates reach the solver as
  `Fraction`s built from **original decimal strings**, never JSON floats;
  capacities lift to `Fraction` at this boundary; solver contract =
  `StageInput` (live on develop, `src/core/manifold.ts`).
- `src/data` sits outside the core purity allowlist (DOM/IndexedDB legal
  here); core stays untouched.
- Power calculations are a **v1 non-goal** (v1 spec §Non-goals).

## Purpose

Deliver `src/data/`: Docs.json → exact-`Fraction` catalog (recipes, items,
machines, tiers) + IndexedDB cache + the catalog→`StageInput` mapping helper
Phase 3 will call.

## Decision axes

### Axis 1 — Port scope (what of the planner's layer comes over)

**Pick — port, trimmed:**
- `docs-loader.ts` parsing structure: NativeClass regex filters (:13-22),
  item extraction (:45-61), building extraction (:62-85), recipe extraction +
  post-processing (:86-137), the ingredient-list regex (:185-196), the
  validation/filter rules (skip recipes with unknown buildings/missing
  outputs), and the embedded `DOCS_FRAGMENT` test-fixture approach.
- `catalog-store.ts` + `db.ts` shape: raw-IDB promise wrapper (no library),
  single `catalog` store keyed `'current'`, `parser_version` invalidation +
  SHA-256 source hash, `{hit|stale|empty}` load statuses.
- **Trimmed out** (with the inventory as evidence): ALL power extraction
  (`mPowerConsumption` :71, min/max fallback :74-75 — power is a v1
  non-goal); `stack_size`/`fluid_stack_size_m3` (logistics-only); the
  planner's `plans` store, modeler import/export, solver/derive/logistics/
  block/graph layers (never part of this port).

### Axis 2 — Number exactness (the load-bearing conversion)

Docs.json stores every numeric as a **string** (`"mManufactoringDuration":
"6"`, `Amount=1.5` inside the serialized ingredient list). The planner calls
`parseFloat` at exactly five sites (:71, :74-75, :95, :189) and computes
`per_min = amount*60/duration` in floats (:195).

**Pick:** every ex-`parseFloat` site that survives the trim becomes
`Fraction.parse(sameString)`; the rate formula becomes
`Fraction.parse(amount).mul(60).div(Fraction.parse(duration))`; the fluid
liters→m³ normalization (:194) becomes exact `.div(1000)`. Duration `≤ 0` or
malformed numeric string → upload-time parse error. The planner's silent
defaults are NOT ported: the surviving one is the **duration** site's
`?? '1'` (:95) plus the `duration ≤ 0 → per_min 0` fallback (:195) — both
replaced by loud upload errors (the `?? '0'` defaults are on the power sites,
which the trim removes entirely). Since Docs.json numerics are strings, the
"never JSON.parse'd floats" constraint is satisfied structurally — no float
ever exists in the pipeline.

### Axis 3 — Belt/pipe tier source

The planner **hardcodes** tiers (transport.ts :4-17: belts 60/120/270/480/
780/1200, pipes 300/600) — it never parses them from Docs.json. The v1 spec
says "capacities come from the catalog, never hardcoded."

Options: (a) parse belt/pipe classes (FGBuildableConveyorBelt / Pipeline
`mSpeed`) out of Docs.json — new, unproven parsing the port source never had,
plus community-folklore unit semantics; (b) a curated tier table **in the
data layer**, exported as part of the catalog module's output
(`Fraction` capacities, ascending).

**Pick: (b).** Reading the v1 lock in context (it sits in §Core math), its
force is that the **solver** never embeds capacities — they arrive as input
from the data layer, which this satisfies: `src/core` has zero capacity
knowledge; the catalog module owns the table and hands ascending `Fraction`
lists to `StageInput.capacities`. (b) is the port-proven shape (transport.ts
is part of the proven article); (a) adds unproven parsing for zero v1 value
— tier VALUES change ~never, and when they do, the curated table is a
one-line data change. If the reviewers read the lock as requiring (a), that
is a user-escalation, not a silent re-interpretation — flagged here
deliberately.

### Axis 4 — Catalog types (foundry shapes)

```ts
// src/data/types.ts — all rates/capacities are Fraction
interface CatalogItem { id: string; displayName: string; isFluid: boolean }
interface CatalogMachine { id: string; displayName: string }
interface RecipeIO { itemId: string; perMinute: Fraction }  // per machine @100%
interface CatalogRecipe {
  id: string; displayName: string; machineId: string; isAlternate: boolean;
  inputs: RecipeIO[]; outputs: RecipeIO[]; primaryOutputId: string;
}
interface TierTable { belt: Fraction[]; pipe: Fraction[] } // ascending
interface Catalog {
  items: Record<string, CatalogItem>;
  machines: Record<string, CatalogMachine>;
  recipes: Record<string, CatalogRecipe>;
  tiers: TierTable;
}
```

Planner field names camelCased to repo idiom; id normalization scheme ported
as-is (ClassName → snake ids). No power, no stack sizes.

### Axis 5 — Catalog→StageInput mapping location

**Pick: `src/data/stage-input.ts`** — a pure helper
`toStageInput(recipe, catalog, opts): StageInput` mapping recipe
inputs→feeds / outputs→outputs (lane kind from `item.isFluid`), slicing
`catalog.tiers` by the unlocked-tier selection into ascending capacity lists.

```ts
interface StageOptions {
  machineCount: number;
  clockPercent: Fraction;
  unlockedTiers: { belt: number; pipe: number }; // prefix count per kind
  overrides?: {                                   // lane-addressed by itemId
    feeds?: Record<string, (Fraction | null)[]>;
    outputs?: Record<string, (Fraction | null)[]>;
  };
}
```

Overrides are **lane-addressed** (the solver's `LaneInput.overrides` is
per-lane; a flat array cannot say which lane it belongs to) — the helper
distributes each entry onto the matching lane's `overrides`. The itemId
keying rests on a stated precondition: **at most one lane per (itemId,
side)** — the v1 spec's own "one lane per input item" premise, true of every
real Docs.json recipe (no recipe repeats an ingredient). The helper asserts
distinctness when building lanes, so a modded/duplicate-item recipe surfaces
as a loud error, never a silent last-write-wins override collision. Rationale: the
mapping needs catalog knowledge (data layer), keeps Phase 3's store thin,
and is integration-testable against the live solver now — the phase's key
exit proof. Unlocked-tier selection: prefix count per kind
(`{ belt: 4, pipe: 1 }` = tiers[0..n)) — tiers unlock cumulatively in game
(mk4-without-mk3 is unreachable), so a prefix is sufficient for v1.

### Axis 6 — Cache serialization (Fraction survives IndexedDB)

**Pick:** store a JSON-safe `StoredCatalog` where every `Fraction` is
serialized as its exact `toString()` (`"75/2"` / `"120"`), revived on load
via a `Fraction`-rational reviver; plus `source_hash` (SHA-256),
`cached_at`, `parser_version` (start at 1). Structured-clone of bigint-backed
class instances is avoided entirely — the stored form is plain JSON-shaped
data, robust across browsers and future Fraction changes. Reviver failure or
version mismatch → `stale` → re-upload prompt (planner's flow, ported).
`Fraction.parse` is decimal-only (it does not accept `"75/2"`), so the data
layer carries a tiny `parseRational(s)` helper: split on `/`, then
`Fraction.of(BigInt(num), BigInt(den))` for the two-part form and
`Fraction.from(BigInt(s))` for the integer form (`Fraction.of` takes
`number | bigint`, never a `Fraction`) — NO core change.

**IndexedDB identity (pinned):** database name **`satis_foundry`** — NOT the
planner's `satis_planner`. Both apps could run on the same origin; sharing
the planner's db/store/key would cross-write incompatible `StoredCatalog`
shapes (the planner stores floats + power at `parser_version: 2`) with
undefined reviver behaviour in both directions. Distinct database, own
versioning, zero interaction.

### Axis 7 — Module layout

`src/data/`: `docs-loader.ts` (parse), `types.ts`, `tiers.ts` (curated
table), `stage-input.ts` (mapping), `catalog-store.ts` (cache orchestration),
`db.ts` (IDB wrapper) + colocated tests. Vitest stays node-env: `db.ts` is
tested with `fake-indexeddb` (the planner's own proven test approach —
it ships `fake-indexeddb` in devDeps) — the ONE new devDependency this phase
adds.

## Out of scope (Phase 2)

Store/UI (Phases 3–4); upload screen UI (Phase 4 — this phase exposes
`parseCatalogFromText` + cache API only); belt-class parsing from Docs.json
(Axis 3); power; any core change.

## Assumptions ledger

- **Port inventory is accurate** — grounded by direct read of the live
  planner source this session (file:line cites above).
- **Docs.json numerics are strings** — verified in the planner's test
  fixture (`"mManufactoringDuration": "6"`, `Amount=12` regex capture) and
  parser code (every numeric site goes through parseFloat-on-string).
- **`Fraction` API suffices with zero core changes** — parse (decimal
  strings), of (bigint pairs), mul/div; the rational-string reviver lives in
  src/data.
- **fake-indexeddb works under Vitest node env** — the planner's own db.test.ts
  proves the pattern (46 lines, green in that repo).
- **No Docs.json sample ships in either repo** — tests use ported/extended
  DOCS_FRAGMENT-style embedded fixtures; a real-file smoke test is manual
  (documented in the completion report, not CI).
- **Tier values** (60/120/270/480/780/1200; 300/600) — from the planner's
  transport.ts, matching the v1 spec's own example numbers.

## Revision history

**Round 1 design review** (code-reviewer: NEEDS_REWORK, 1 IMPORTANT + 1 NIT;
adversarial-reviewer: APPROVED_WITH_NITS, 1 MEDIUM + 2 LOW). All folded;
none rejected:

- `parseRational` internals corrected (both reviewers; nested-verifier
  confirmed): `Fraction.of(BigInt(num), BigInt(den))` / integer form via
  `Fraction.from(BigInt(s))` — `Fraction.of` never accepts a `Fraction`.
  Zero-core-change conclusion unchanged.
- IndexedDB database name pinned to `satis_foundry` (adversarial MEDIUM):
  distinct from the planner's `satis_planner`; same-origin cross-writes of
  incompatible StoredCatalog shapes eliminated.
- Duration-default citation fixed (both): the surviving default is `?? '1'`
  at docs-loader.ts:95 (+ the `≤0 → 0` rate fallback at :195); the `?? '0'`
  defaults are on trimmed power sites. Loud-failure decision unchanged.
- `toStageInput` overrides pinned lane-addressed by itemId (adversarial
  spec-must-resolve promoted into the axis).
- Grounding header corrected to the planner's real directory layout
  (data/ + persistence/ + core/transport.ts).

**Round 2 design review** (code-reviewer: APPROVED_WITH_NITS, 1;
adversarial-reviewer: APPROVED_WITH_NITS, 1 — the same finding). Folded:
the one-lane-per-(itemId, side) precondition behind the override keying is
now stated in Axis 5 with a distinctness assertion in the helper (v1 spec
"one lane per input item" premise; true of all real recipes; modded
duplicates fail loudly). **Correctness pair converged.**

**Simplify pass** (one-shot, post-convergence — claude-simplify-reviewer:
APPROVED_WITH_NITS, 2 LOW):

- LOW 1 (`overrides` premature for Phase 2 — "design now, wire later")
  **rejected with rationale**: the design cost is already paid (lane
  addressing + distinctness were reviewer-mandated and converged); shipping
  the optional param now lets this phase's solver-integration test cover the
  full mapping surface once, avoiding a Phase-3 re-review of a changed
  data-layer API. Omitting it at call sites remains the solver's default
  path.
- LOW 2 (legacy dual cache-read wrapper correctly not ported) —
  informational, no action; trim confirmed deliberate.

Brainstorm FROZEN.
