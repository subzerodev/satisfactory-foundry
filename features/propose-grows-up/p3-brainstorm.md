# S20 P3 — Propose persistence + gating (brainstorm + spec)

**Ticket:** #102 · **Epic:** #98 · **Milestone:** 91 · **Status:** v12 — FROZEN (design r8 APPROVED_WITH_NITS ×2; spec-8 amendment reviewed + two of its mechanics corrected BY MEASUREMENT at implementation; simplify pass consumed at v4)

## Purpose

Two closing upgrades to Propose: **persistent preferences** (the P1
picker/exclusion choices survive restart and seed every future Propose,
still overridable per-run) and **tier gating** (only propose recipes the
player has unlocked, from real schematic data — never faked).

## Already settled — do NOT re-litigate

- Epic #98: P3 = these two; the arc's last phase. Ticket #102 pins:
  persistence home decided at design; gating from real catalog data or
  explicitly parked (it is NOT parked — gate cleared, below);
  preferences overridable per-run.
- **P1's "ephemeral posture (no store surface)" pin is superseded BY
  DESIGN here** — the epic sequenced persistence to P3 from day one
  (2026-08-06 epic decision); P1's pin scoped that phase, not the arc.
- P2 shipped surfaces (clock snapshot posture, display-only
  suggestions) are the base; routing is #105's; byte-stability of the
  no-customization default Propose remains pinned.
- All-Claude degraded roster; walk per phase.

## Ground truth (verified this session — measured, not assumed)

- **Research gate CLEARED** (decision audit on #102): the bundled
  Docs.json (`public/bundled-docs/en-US.json`) carries **574
  `FGSchematic`** entries: 42 `EST_Milestone` (with `mTechTier` +
  `BP_UnlockRecipe_C` unlock entries listing recipe class refs), 109
  `EST_Alternate` (of which 107 carry recipe refs), 120 `EST_MAM` (of
  which 77 carry recipe refs) — the Axis 3 totals are the full type
  populations; these fractions are the ref-bearing subsets. Refs end
  `.Recipe_<X>_C'`; the trailing segment is the RAW class name, which
  must be normalized to the catalog id (Axis 3).
- `src/data/tiers.ts` is TRANSPORT tiers (belt/pipe throughput) —
  unrelated to progression. The epic's grounding line pointed at the
  wrong kind of tier; recorded so no one "finds" progression data
  there.
- `src/data/docs-loader.ts` ignores `FGSchematic` today; the catalog it
  builds is `{items, machines, recipes, tiers}` (:157).
- `src/data/catalog-store.ts:32` — `CATALOG_PARSER_VERSION = 4`; a
  mismatch marks the cache `stale` (:163). There is NO stored raw Docs
  text — only a SHA-256 `source_hash` (:103) — so a bump means:
  bundled-catalog users re-fetch + re-parse the bundled asset;
  uploaded-Docs users fall back to bundled (loud banner) and re-upload
  once (the recorded precedent, :16-19). Corrected at r1 — v1 falsely
  claimed in-place re-parse/self-heal.
- Store persistence pattern (S10, extended S19): zustand `persist`,
  localStorage key `satis_foundry:tiers`, partialized projection
  `{ unlockedTiers }` only, injectable `storageProvider`, synchronous
  hydrate-during-creation, clamp/normalize-on-read (`clampTier`,
  store.ts:937-1010). The established home for user-global,
  progression-flavored state.
- Plan files: IDB, `PlanFileV5` latest, versioned with loud-reject
  discipline (plan-store.ts header). Bumping is possible but heavy.
- P1 controls live as ChainBuilder component state (`overrides`,
  `rawItemIds`, `excludedMachineIds`, ChainBuilder.tsx:114-120), all
  threaded through the single `repropose` options path; core totality
  is validate-and-ignore for stale ids (P1 frozen).
- P1's exclusion seam: `candidateRecipesFor` / `effectiveDefaultRecipe`
  / `producerRecipesFor` / `pickerOptionsFor` all take
  `excludedMachineIds` (chain-builder-adapter.ts); constrained-cause
  classification is `effectiveDefaultRecipe === null` with
  `hasAnyProducer` (P1 boundary fix).

## Decision axes

### Axis 1 — Persistence home + scope for preferences

Options: (a) the persisted store slice (localStorage, beside
`unlockedTiers`); (b) per-plan (PlanFileV6); (c) a new IDB store.

**Pick (a).** The ticket's own framing — "applied to every future
Propose" — makes preferences USER-GLOBAL, not per-plan; (b) would make
them vary by open plan (contradicts the framing) and costs a format
bump; (c) invents a second persistence idiom for data that is exactly
the shape `unlockedTiers` already models (small, user-global,
progression-flavored, clamp-on-read). The persisted projection becomes
`{ unlockedTiers, proposePrefs }` with
`proposePrefs: { overrides: Record<string, string>, excludedMachineIds:
string[], unlockedTier: number | null }` (unlockedTier is Axis 3's).

**Scope: overrides + machine exclusions persist; rawItemIds and clock
do NOT.** Overrides are the ticket's named subject ("preferred
recipes"); machine exclusions are progression-flavored user-global
state (what you haven't built). Raw markings are a per-plan boundary
intent ("I make this elsewhere" — about a factory, not the user) and
the clock is a per-run target; both stay ephemeral. Localstorage
values are validated on read: overrides must be string→string,
exclusion ids strings — anything else drops to empty (the clampTier
discipline); STALE ids need no validation at all (core
validate-and-ignore, P1 frozen). **`unlockedTier` is validated on read
to a NON-NEGATIVE INTEGER or `null`:
`Number.isInteger(v) && v >= 0 ? v : null`** — a catalog-INDEPENDENT
predicate (module-level facts only, so none of the hydration-order
problem below), matching the value-validation its two sibling prefs
already get. **This half is NOT optional (r7):** a persisted `-1`,
`2.5` or `NaN` would otherwise pass, render as "all" (none is among
the derived options) while `gateCatalog` gates out every
unlock-bearing recipe — display lying about the world, and STICKY,
since nothing writes back and the user cannot clear it by picking
"all" (the control already shows "all", so there is no DOM change and
no `onChange`). What is dropped is only the CATALOG-DERIVED bound:

**Why no clamp (r6 — the clamp was a v6 addition and BOTH reviewers
refuted it; it is now DROPPED, not re-placed).** It failed three ways:
`clampTier`'s bound is a module CONSTANT available synchronously,
whereas a catalog-derived bound does not exist at merge time (persist
hydrates during `createAppStore` with `catalog: {status:
"initializing"}`; the real catalog lands later in `init()`); an empty
`recipeUnlocks` makes the derived max `Math.max()` = `-Infinity`,
which the Axis-2 mirror would PERSIST, so a later boot with good data
would gate out every unlock-bearing recipe — a sticky silent
regression traded for a cosmetic one; and a seed-time clamp misses
its own named trigger (a mid-session Docs.json re-upload). The defect
it addressed is genuinely cosmetic: a too-high tier gates nothing, so
it already behaves as "all".

**Instead, normalize at RENDER, where the data exists and nothing is
written back:** the TIER `<select>` derives its options per render; if
`unlockedTier` is not among them (too high, or `recipeUnlocks` empty
so the only option is "all"), the control renders "all" — matching
the behaviour a too-high tier already has. No persistence write, no
`-Infinity`, no empty-case special rule, no hydration-order
dependency.

### Axis 2 — How preferences reach the controls

The store gains a `proposePrefs` slice + one action
`setProposePrefs(patch)` (partial update, persisted via the existing
middleware). ChainBuilder SEEDS its component state from
`proposePrefs` (lazy useState initializers — replacing the current
`new Map()` / `EXCLUDED_MACHINE_IDS` seeds) and MIRRORS every change
back via `setProposePrefs` in the same handlers that already call
`repropose`. **Why seed-and-mirror rather than store-backed controls**
(the strictly smaller shape — no local copy at all): `rawItemIds`
must stay ephemeral (Axis 1), so store-backing the other two would
split the three P1 controls into two store-backed + one local, losing
their uniformity and enlarging the diff into frozen P1 code. Recorded
so a later reader does not re-open it. The component state remains
the live per-run truth;
prefs are the seed + sink. **The ticket's "overridable per-run" pin is
REINTERPRETED, not trivially honored (r1 NIT, recorded):** every
change persists — there is no scratch-vs-saved separation; "per-run"
freedom means the user edits the live controls at will, and the epic's
"applied to every future Propose" framing makes the persisted set the
same thing the user is editing. No new propose path; the P1/P2
single-path invariant is untouched. The default seed when no stored
prefs exist: overrides empty, exclusions = `EXCLUDED_MACHINE_IDS`
(today's behavior, byte-stable).

### Axis 3 — Tier data model in the catalog

`docs-loader` parses `FGSchematic`: for each `BP_UnlockRecipe_C` entry
in `mUnlocks`, extract recipe class names from `mRecipes` and
**normalize each via `normalizeClassName(seg, "Recipe_")`** — the SAME
normalizer that keys `catalog.recipes` (docs-loader.ts:126, :261-270:
`Recipe_IronPlate_C` → `iron_plate`). The raw trailing segment is NOT
the catalog id (r1 CRITICAL — a literal-key parse gates nothing);
refs that normalize to no catalog recipe (building/cosmetic recipes)
are skipped silently by design.

**`seg` MUST be the bare class name, with the trailing apostrophe
excluded (r4 — a verified SILENT TOTAL FAILURE mode).** `mRecipes`
refs read `…'…/Recipe_<X>.Recipe_<X>_C'` — they END in `'`, and
`normalizeClassName` splits on `[./']` then `.pop()`, so handing it a
whole ref returns the EMPTY STRING (verified this session:
`ref.split(/[./']/).pop()` → `""`), every id collapses to `""`, and
gating silently no-ops behind the ledger's tolerant "empty ⇒ the
select collapses to all" framing. Extract with a quote-excluding
capture (e.g. `/\.(Recipe_[A-Za-z0-9_]+_C)'/g`) and pin it with a
test asserting a real ref yields a real catalog id (never `""`).

Record per catalog recipe id the MIN unlock tier — a plain number,
nothing else: tier = the schematic's `mTechTier` (number-parsed, 0 on
absence/garbage). **Parse ALL schematic mTypes** — the snapshot's full
set (measured): EST_Milestone 42, EST_Alternate 109, EST_MAM 120,
EST_Custom 93 (incl. `Schematic_StartingRecipes_C`),
EST_ResourceSink 173, EST_Customization 30, EST_Tutorial 6,
EST_HardDrive 1 — with no per-type labelling (the mType is read only
to be counted, never stored). This is safe because it was MEASURED,
not assumed: zero
catalog production recipes get a LOWER min-tier from a non-progression
type (ResourceSink/Customization/Tutorial unlock only
building/cosmetic recipes, which the unmatched-ref skip drops), and
the `BP_UnlockRecipe_C`-only filter already skips tape/info unlocks.
**A recipe unlocked by several schematics takes the MINIMUM tier**
(earliest availability — the honest gate). Catalog gains
**`recipeUnlocks: Record<string, number>`** — recipe id → min unlock
tier, nothing more (absent key = no schematic unlocks it → always
available). **No `source` field (simplify MAJOR):** nothing in this
design reads provenance — gating reads the tier alone, alternates are
gated by their own tier labels like everything else, and acquisition
tracking is explicitly out of scope; the one distinction a `source`
could serve already exists as `CatalogRecipe.isAlternate`
(types.ts:80). Dropping it also removes an undefined question (which
source survives a min-tier collision). The parser still visits every
mType — it just stops labelling them. Machines are NOT modeled
(Axis 5 scope).
`CATALOG_PARSER_VERSION` → 5. **Bump cost, disclosed honestly (r1
MAJOR):** a version mismatch marks the cache `stale` — there is NO
stored raw Docs text (only a SHA-256 hash), so nothing "re-parses in
place": a BUNDLED-catalog user self-heals via the bundled re-fetch;
an UPLOADED-Docs user falls back to the bundled catalog (banner flips)
and must re-upload once — the exact cost catalog-store's own version
history records for prior bumps (catalog-store.ts:16-19). Accepted:
the precedent exists, the fallback is loud (banner), and uploaded
Docs.json carries FGSchematic identically (same export format), so
the re-upload lands with full tier data.

### Axis 4 — Where the gate enters the solve

Options: (a) core `proposeChain` gains an `excludedRecipeIds` param;
(b) derive a GATED CATALOG (recipes whose
`recipeUnlocks[id] > unlockedTier`; an ABSENT key means no schematic
gates it ⇒ always available) and feed it to the propose surfaces.

**Pick (b), DERIVED ONCE and passed explicitly** (mechanism corrected
by the simplify pass — v3 threaded `unlockedTier` through the options
bags and gated inside each adapter entry point, which would have
forced the tier into five more ChainBuilder-facing signatures with a
whole-map projection each). Gating is a catalog projection —
`gateCatalog(catalog, unlockedTier)`, pure, exact,
`unlockedTier === null` returns the catalog UNCHANGED (same
reference — byte-stable identity, regression-pinned). ChainBuilder
derives it ONCE per propose (`const gated = gateCatalog(catalog,
unlockedTier)`, trivially memoizable given reference-stability at
null) and passes `gated` wherever the gated world is wanted,
`catalog` wherever the ungated world is wanted. `unlockedTier` stays
OUT of `ProposeOptions` and the preview options entirely — it lives
in one place (`proposePrefs`).

**Where `gated` is derived, and how the FRESH tier reaches it (r4
IMPORTANT ×2 — v4 asserted a desync-immunity it did not deliver for
the one control this phase adds).** Two consequences of moving gating
out of the options bags must be stated, not assumed:

1. **Derive in the ChainBuilder COMPONENT BODY, not inside
   `repropose`.** ALL FIVE gate-sensitive sites are outside that
   function (`repropose` spans ChainBuilder.tsx:145-187 and touches
   the catalog only through its `cat` parameter): `:237` is the sibling `chooseRecipe`, `:418` is the
   JSX body, and `:526`/`:569`/`:578` live in MODULE-SCOPE helpers
   (`recipeLabel` takes `catalog` as a PARAMETER, `RecipePicker` as a
   PROP) that cannot close over anything. So the derivation is a
   component-body `const`, and the plumbing edits are explicit:
   `RecipePicker`'s `catalog=` prop at `:387`, and `recipeLabel`'s
   `catalog` argument at its two call sites `:441` and `:615`, all
   become `gated`. The adapter's four helper signatures stay
   unchanged; three ChainBuilder-internal seams change hands. (These
   are **NOT compile-forced** — r5 refuted v5's claim that they were:
   `gateCatalog` returns `Catalog`, so `catalog={catalog}` and
   `catalog={gated}` typecheck identically, and a missed seam is a
   SILENT behavioural regression. They are therefore pinned by TESTS
   (spec 8 — per OBSERVABLE seam; note "absent from the label" is
   NOT among them: r6/r7 proved that formulation non-discriminating,
   and the label is pinned via the `(default)` tag instead), not by
   the compiler. Naming
   them here also stops the implementer re-deriving `gateCatalog`
   locally at each site.)
2. **The tier change must ride the `repropose` PATCH, like every
   other control.** P1's patch parameter exists precisely because a
   React binding is stale within the tick (ChainBuilder.tsx:154-156
   says so verbatim); a `gated` derived from the `unlockedTier` state
   would gate at the OLD tier on the very propose the change
   triggers — and unlike P1's controls that skew is dangerous, since
   the stale preview's stage recipe can be ABSENT from the new world,
   defeating `pickerOptionsFor`'s force-include and leaving the
   picker `<select>` with no matching option. So `patch` gains
   `unlockedTier?: number | null`, `repropose` computes
   `const tier = patch.unlockedTier !== undefined ?
   patch.unlockedTier : unlockedTier` and derives `gateCatalog(cat,
   tier)` for that call (note `!== undefined`, not `??` — `null` is
   the meaningful "all" value). Pinned by a test asserting the
   re-propose after a tier change uses the NEW tier's world.

**There are exactly TWO derivation sites, with distinct inputs, and
they cannot disagree (r5 NIT — v5's "one derivation per propose" was
wrong):**
- the component-body `const`, from the `unlockedTier` binding —
  serves the RENDER seams (`:237`, `:418`, `:387`, `:441`, `:615`);
- `repropose`'s own `gateCatalog(cat, tier)`, from the PATCH-resolved
  tier — serves that one propose, whose fresh tier the render binding
  cannot yet see.

They cannot diverge because the patch-borne value is exactly what the
state becomes: the commit render that follows recomputes the body
derivation from the same tier. Note the body derivation runs per
RENDER, not per propose — at a non-null tier it filters the whole
recipe map on every keystroke in the Rate/Clock inputs, so memoize it
on `[catalog, unlockedTier]` (`excludableMachines` at `:276` is the
existing per-render O(recipes) precedent, and it allocates no map).
**The memo MUST sit ABOVE `ChainBuilder.tsx:131`'s
`if (catalog === null) return null` guard and tolerate a null
catalog** (r6 NIT): every existing body derivation sits BELOW that
guard, so the natural placement is a CONDITIONAL hook, and the
toolchain carries no `eslint-plugin-react-hooks` to catch it
(`Blueprint.tsx:14-17` records this same hazard).
Desync is then prevented by construction — each propose is fed the
fresh value — rather than by an invariant about where gating happens. The core signature stays frozen
(no 8th param); totality holds for free (an override pointing at a
gated-out recipe is a stale id — validate-and-ignore, P1 frozen).
**The both-worlds requirement (r1-r3 folds) survives**: the preview
options gain `ungatedCatalog?: Catalog` (absent ⇒ the passed catalog,
so null-tier callers are byte-identical), which is what causeOf's
`hasAnyProducer` and the lever matrix read.

**Consumers, precisely (r1 IMPORTANT/MAJOR fold):**
- Solve (`proposeChainForCatalog`), picker options, and candidate
  chips run on the GATED world (the proposal itself came from it).
  The P2 `byproductSuggestions` scan reads only proposal-supplied ids
  + `items`, so it is world-INVARIANT and keeps `catalog` (below).
- **Cause classification (causeOf) uses BOTH:** `hasAnyProducer` runs
  on the UNGATED recipes ("natural" = no producer exists in the DATA
  at all); "constrained" ⇔ hasAnyProducer(ungated) ∧
  `effectiveDefaultRecipe(gated, itemId, exclusions) === null`.
  Without this split, an item whose every producer is tier-gated
  would misclassify "natural" and silently lose its recovery line.
  At `unlockedTier === null` gated ≡ ungated ⇒ byte-identical P1
  classification (regression-pinned).
- **Constrained recovery keeps P1's structure, then names the true
  lever(s) via a total matrix (r1 MAJOR; predicates corrected at r2 —
  both reviewers showed the effectiveDefaultRecipe-based v2
  predicates were ALTERNATE-BLIND while the branch entry is
  alternate-inclusive, dropping the line P1 emits today for
  alternate-only items):** if `producerRecipesFor(gated, exclusions)`
  is non-empty → the P1 inline pick-recipe recovery, unchanged. Else
  compute two ALTERNATE-INCLUSIVE predicates — "recovery" here means
  the inline picker becomes non-empty again, P1's actual affordance,
  which alternates participate in — `tierLever` =
  `producerRecipesFor(ungated, exclusions).length > 0` (raising the
  tier alone restores producers); `machineLever` =
  `producerRecipesFor(gated, ∅).length > 0` (clearing exclusions
  alone restores producers) — and word the line by exactly which
  levers recover: machineLever only → the existing MACHINE EXCLUSIONS
  wording; tierLever only → "locked behind the TIER gate; raise TIER
  to recover"; both true → "raise TIER or edit MACHINE EXCLUSIONS"
  (either alone recovers); neither → "blocked by BOTH the TIER gate
  and MACHINE EXCLUSIONS; change both". **Totality is provable, not
  asserted:** in the else branch the item is constrained, so
  `hasAnyProducer(ungated)` holds, so
  `producerRecipesFor(ungated, ∅)` is non-empty — the joint recovery
  always exists, and the four wordings partition the two booleans
  exhaustively. No cell defers to the picker branch (which by
  construction did not fire), and the alternate-only-all-gated case
  gets its honest TIER (or EXCLUSIONS, or both) line instead of v2's
  silence.
- **Compare (AltCompare) stays UNGATED — scoped out with rationale
  (r1 IMPORTANT/MAJOR):** it is a SEPARATE surface serving the
  APPLIED graph, where a stage may legitimately run a recipe above
  the propose tier — gating it could hide the very recipe the stage
  currently uses. P1 already pinned AltCompare untouched (hardcoded
  exclusions deferred to #103); tier-awareness for compare joins
  #103's consolidation scope (comment posted there). The "one
  consistent world" claim is therefore scoped to the PROPOSE surfaces
  listed above, which all flow through the one options path.

Gated-out recipes vanish from pickers and chips (no "(locked)" label
— future polish if field use wants it).

**Two call sites deliberately keep the UNGATED catalog** (r4 — stated
so a later reader does not "complete the sweep"):
- `excludableMachines(catalog)` (ChainBuilder.tsx:276) — it scans the
  recipe map to build the MACHINE EXCLUSIONS checkbox list, so gating
  it would DELETE the checkbox for an already-excluded high-tier
  machine, stranding that id in `excludedMachineIds` with no way to
  clear it — and the lever matrix would then point at a control the
  user cannot reach. Ungated, always.
- `byproductSuggestions` (ChainBuilder.tsx:490) — provably
  world-INVARIANT: it reads `items` (untouched by gating) and
  `recipes[stage.recipeId]` for stages that were already solved from
  the gated world, so both catalogs give byte-identical output. Left
  as `catalog` for that reason, not by oversight.

### Axis 5 — Gating UI + scope

A TIER control in the ChainBuilder controls row: a select with "all"
(null — default, no gating) and tiers 0..max, where max is DERIVED
from `recipeUnlocks` at render — never hardcoded (the snapshot's
mTechTier range is illustrative only, and the max tier actually
present among unlock-bearing schematics may be lower).
Persisted in `proposePrefs.unlockedTier` (Axis 1). Default null ⇒
byte-stable. **Machines are NOT gated in P3**: machine availability is
already the user's explicit MACHINE EXCLUSIONS panel (P1); deriving
machine locks from building-recipe schematics is real but separate
work — recorded as out of scope with this rationale, not silently
dropped. Alternates: gated by their own tier labels like everything
else (measured: 107/109 alternates carry tiers + recipe refs); no
separate alternates toggle in P3.

## Spec (file-by-file)

1. **`src/data/types.ts`** — Catalog gains
   `recipeUnlocks: Record<string, number>` (recipe id → min unlock
   tier), **REQUIRED, not optional** (spec 3 explains why the
   `isRawResource` optional precedent must NOT be followed here). No
   source union, no wrapper interface.
2. **`src/data/docs-loader.ts`** — FGSchematic parse (all mTypes;
   BP_UnlockRecipe_C entries; trailing-class-name extraction +
   **`normalizeClassName(seg, "Recipe_")`** before keying; unmatched
   refs skipped; min-tier merge; number-parse mTechTier with a 0
   default on absence/garbage).
3. **`src/data/catalog-store.ts`** — `CATALOG_PARSER_VERSION = 5`
   **AND the cache round-trip for `recipeUnlocks` (r5 IMPORTANT ×2 —
   a verified SILENT TOTAL FAILURE on the dominant runtime path).**
   The cache is FIELD-WHITELISTED: `StoredCatalogData` (:84-88)
   declares `{items, machines, recipes}`, `serializeCatalog`
   (:182-208) enumerates exactly those, and `reviveCatalog`
   (:238-283) returns them plus `tiers: TIER_TABLE` — `tiers` is
   re-attachable only because it is a CONSTANT, which `recipeUnlocks`
   is not. The two halves fail ASYMMETRICALLY: revive's return is
   tsc-forced (so an implementer satisfies it with
   `recipeUnlocks: Object.create(null)`) while serialize is NOT
   (it builds a `StoredCatalogData` literal with no such field) — so
   every boot after the first would load an EMPTY unlock map, and by
   Axis 4's absent-key rule everything reads "always available":
   gating silently no-ops, disguised by the ledger's own "empty ⇒ the
   select collapses to all" tolerance. This is the recorded scar at
   catalog-store.ts:46-50 (`isRawResource`, ticket #57: "Without it in
   all three enumerating functions the flag silently vanishes on the
   second boot (a cache hit)"). So: add `recipeUnlocks` to
   **`StoredCatalogData`**, **`serializeCatalog`**, and
   **`reviveCatalog`** (null-prototype per spec 5) — **plus
   `reviveCatalog`'s field-by-field SHAPE GUARD (:239-247)**, so a
   malformed row fails loudly through the existing catch → `"stale"`
   path rather than reviving a half-catalog — with the spec-8
   round-trip pin.

   **The field is REQUIRED on `Catalog`, and the fan-out is
   INTENDED** (r6 — state it, because `types.ts:16-28` records the
   OPPOSITE precedent: `isRawResource` was made optional expressly to
   avoid fixture churn, and an implementer following that precedent
   would make `recipeUnlocks` optional, which un-forces revive and
   VOIDS this delta's own safety argument). Required means tsc names
   every construction site; update them all: the production literal
   at `GraphCanvas.tsx:353-358`, and the typed `Catalog` fixtures
   (`catalog-store.test.ts:16`, `stage-input.test.ts:16`,
   `chain-builder-adapter.test.ts:249`/`:988`, `graph-flow.test.ts`,
   `AltCompare.test.tsx`, `smoke.test.tsx`). One further site,
   `chain-view.test.ts:186-188`, constructs via
   `as unknown as Catalog` and so is NOT flagged — verified INERT
   (`siteFor` reads only `recipes[id].machineId`), no edit needed;
   recorded so a later sweep does not re-derive the question.

   **TWO sites are NOT tsc-forced and MUST be updated by hand
   (r7 — v7 claimed one):**

   **(i) `catalog-store.test.ts:145-160`** — an inline untyped stored
   shape (`catalog: { items: {}, machines: {}, recipes: { bad: null }
   }`) whose test, "returns stale (never throws) on a corrupted
   stored shape", exists to exercise the REVIVER choking on a
   malformed recipe payload. Once the shape guard also checks
   `recipeUnlocks`, this row throws at the GUARD before `recipes` is
   ever walked: the test stays GREEN (it asserts only `"stale"`)
   while the coverage it names silently disappears. Add
   `recipeUnlocks: {}` so it still reaches the corrupt-recipe path.
   **This is the delta's own failure mode landing inside the fold —
   a silent loss behind a still-green assertion.**

   **(ii) `serializedSample()` (`catalog-store.test.ts:253-290`)** —
   the untyped stored-shape factory seeding a legacy row the test at
   `:212-231` expects to revive as a HIT; once revive reads
   `recipeUnlocks` that row throws → `"stale"` → red test.

   **For both: fix the fixture, do NOT make revive tolerant**
   (`data.recipeUnlocks ?? {}` would re-open exactly the empty-map
   path this whole delta exists to close, and the version bump
   already makes real legacy rows stale before revive ever sees
   them).
4. **`src/state/store.ts`** — persisted projection gains
   `proposePrefs` (shape per Axis 1) with read-validation; action
   `setProposePrefs(patch: Partial<ProposePrefs>)`; hydration follows
   the existing synchronous-storage discipline.
   **A non-tsc-forced pin breaks here and must be updated by hand
   (r8, both reviewers):** `store.test.ts:588-598` asserts
   `expect(parsed.state).toEqual({ unlockedTiers: … })` on
   `JSON.parse` output — untyped, so widening `partialize` to the
   two-key projection turns it red at runtime with nothing at compile
   time. Update the ASSERTION, the comment at `:593-594`, and the
   TEST TITLE ("stored value is exactly {unlockedTiers}" / "carries
   ONLY the projected slice" both encode the superseded invariant).
   **Do NOT narrow `partialize` to keep it green** — that would
   silently deviate from the specced projection (and spec 8's
   prefs round-trip row would catch it anyway). Unlike the two cache
   fixtures this failure is LOUD, hence a nit rather than the silent
   class spec 3 guards.
5. **`src/ui/chain-builder-adapter.ts`** — `gateCatalog(catalog,
   unlockedTier: number | null): Catalog` (identity — SAME REFERENCE —
   at null; otherwise recipes filtered by unlock tier;
   recipeUnlocks/items/machines untouched). **The filtered `recipes`
   map MUST be seeded `Object.create(null)` (r4 IMPORTANT, #28
   discipline):** every existing construction of that map is
   null-prototype with a loud rationale (docs-loader.ts:124,
   catalog-store.ts:252) and is pinned at the parse/revive boundaries
   (catalog-store.test.ts:234-243) — `gateCatalog` is a THIRD
   construction site that a natural `Object.fromEntries`/spread would
   silently regress for every non-null tier, and NO existing pin
   covers it. Same for the new `recipeUnlocks` map (spec item 2).
   `PreviewOptions` gains
   `ungatedCatalog?: Catalog` (defaults to the passed catalog);
   causeOf's hasAnyProducer reads the UNGATED recipes; the
   constrained-recovery **four-cell** lever matrix per Axis 4
   surfaced to the UI as a discriminated cause detail. NO
   `unlockedTier` in ProposeOptions/PreviewOptions (Axis 4:
   derive-once). `candidateRecipesFor` / `effectiveDefaultRecipe` /
   `producerRecipesFor` / `pickerOptionsFor` signatures UNCHANGED —
   they simply receive the gated catalog. AltCompare surfaces
   UNTOUCHED (Axis 4 carve-out).
6. **`src/ui/ChainBuilder.tsx`** — seed overrides/exclusions **and
   the tier** from `proposePrefs`, mirror changes back (the TIER
   control follows Axis 2's seed-and-mirror pattern like the other
   two PERSISTED controls — it is component state, not a direct store
   read, which is what the Axis 4 resolution expression's
   `unlockedTier` binding refers to); TIER select (all + 0-max, max
   DERIVED from recipeUnlocks — never hardcoded); derive `gated` at
   the TWO sites Axis 4 names — the component body (memoized on
   `[catalog, unlockedTier]`) for the render seams, and inside
   `repropose` from the patch-resolved tier — passing the latter to
   `proposeChainForCatalog` + `toProposalPreview` (which also
   receives `ungatedCatalog: catalog`). **The five direct
   gate-sensitive call sites must receive `gated`, not `catalog`**
   (verified live): `:237` effectiveDefaultRecipe (override-vs-default
   clear rule), `:418` producerRecipesFor (constrained inline
   recovery), `:526` effectiveDefaultRecipe, `:569` pickerOptionsFor,
   `:578` producerRecipesFor (force-include check) — this is what
   makes "gated-out recipes vanish from pickers and chips" true;
   reaching the module-scope three requires the `RecipePicker`
   `catalog=` prop (`:387`) and both `recipeLabel` call sites
   (`:441`, `:615`) to pass `gated` (Axis 4). `:276
   excludableMachines` and `:490 byproductSuggestions` deliberately
   keep `catalog` (Axis 4 carve-outs). Tier changes re-propose like
   the P1 controls (discrete select — the P1 auto-repropose idiom,
   not the Rate/Clock text idiom) and MUST carry the new tier through
   the `repropose` patch (Axis 4); recovery wording per the four-cell
   matrix.
7. **`src/ui/app.css`** — tier-select styles from existing tokens.
8. **Tests** (data + state + adapter + UI — node env throughout,
   EXCEPT the one jsdom-scoped seam file the amendment below adds):
   schematic parse
   (**normalization to catalog ids** — a ref keyed raw must NOT
   match, **a real `mRecipes` ref (trailing apostrophe and all) must
   yield a real catalog id — never `""`** (the r4 silent-total-failure
   guard), min-tier merge across schematic types, garbage tier → 0,
   absent unlocks → empty map, unmatched refs skipped,
   **`recipeUnlocks` has a null prototype**); update the
   pinned version literal at `catalog-store.test.ts:128` (the
   mismatch→stale behavior is already covered generically at :132 —
   no new row); prefs persist round-trip (write → new store instance on
   same storage → hydrated), corrupt-prefs drop to defaults;
   gateCatalog identity at null (SAME REFERENCE — byte-stable pin),
   filtering at tier N, **the gated `recipes` map has a null
   prototype (#28, no existing pin covers this third construction
   site)**; cause classification with gating: every-
   producer-tier-gated → "constrained" NOT "natural" (the ungated
   hasAnyProducer split); the FULL lever matrix — tier-only,
   machine-only, either (producers split across the two levers),
   both-required (compound: machine-excluded producer whose recipe is
   ALSO tier-gated → the "both" wording, never a lone
   MACHINE EXCLUSIONS hint), **alternate-only with all alternates
   tier-gated → the TIER wording renders (v2's silent-drop cell) and
   raising the tier restores the inline picker** (the alternate-only
   UNGATED case needs no new row — already pinned at
   `chain-builder-adapter.test.ts:1258`); null-tier byte-identical P1
   classification regression **and null-tier recovery-WORDING
   regression (a machine-excluded constrained raw at tier=null renders
   P1's exact "every producer's machine is excluded; edit MACHINE
   EXCLUSIONS to recover" string — the reduction is provable, this
   pins it against future drift)**;
   TIER select re-propose **using the NEW tier's world on that same
   propose** (the r4 staleness pin — set a tier, assert the resulting
   preview reflects it, not the previous value); **catalog cache
   round-trip: save → load → `recipeUnlocks` is NON-EMPTY and
   null-prototype** (the r5 second-boot pin — the existing
   `catalog-store.test.ts:234-249` revive pin does not cover a field
   the serializer never wrote); **the render seams are pinned
   BEHAVIOURALLY since nothing compiles them — one row per
   OBSERVABLE edit** (`:615` reads `RecipePicker`'s own prop, so
   fixing `:387` fixes it for free; the edits are `:387`, `:418`,
   `:441`, `:237`, of which `:441` is provably unobservable and so
   gets no row — see below):
   - `:387` → a tier-gated recipe is ABSENT from the rendered picker
     options;
   - `:418` → at a tier where every producer is gated out, the
     constrained row renders the TIER hint and **NO** recovery
     `<select>` (an ungated `:418` would offer gated recipes whose
     selection the gated solve then validate-and-ignores — a dead
     control contradicting the matrix's own "raise TIER" wording);
   - `:441` → **NO ROW. This edit is a provable behavioural NO-OP and
     must NOT be given a pin** (r7, both reviewers, same proof —
     recorded here so r8+ does not re-add a phantom assertion).
     `recipeLabel` uses its catalog for one thing: `dflt =
     effectiveDefaultRecipe(catalog, …)` (`:526`). `:441` executes
     ONLY inside `constrainedRaws.map` (`:417`), and a row is
     constrained exactly when `effectiveDefaultRecipe(gated, …) ===
     null` — so under correct wiring NO option can carry `(default)`.
     Under the missed edit `dflt` = the ungated default D; but
     constrained implies D is gated out, and the options come from
     `producerRecipesFor(gated, …)`, so D ∉ options and the tag still
     never fires. Rendered output is byte-identical either way.
     Change `:441` for consistency; pin it nowhere.
   - **The `(default)` tag IS pinned where D′ exists** — a NORMAL
     stage row's picker (fed by `:387` → `:615`), where the gated
     default is non-null by construction: at a tier that gates out
     the ungated default D, the rendered option for the gated default
     D′ carries `(default)`.
   - `:237` → the clear-rule resolves against the GATED default —
     **a TWO-STEP assertion, since one step cannot discriminate**
     (r7): choosing D′ sets no override under correct wiring but sets
     `itemId → D′` under the missed edit, and both then re-propose to
     the same stage recipe with identical rendered output. Step two
     makes it observable: raise TIER back to "all" — correct returns
     the stage to D, the missed edit stays pinned to D′ by the
     spurious override.
   Each row is written at the UI level (a rendered-output assertion);
   an adapter-level test exercises none of these seams.

   **HOW they are written (v10 amendment — the design specified this
   requirement for eight rounds without verifying the repo could
   satisfy it; the implementer's drift hunt caught it).** The
   toolchain is `environment: 'node'` globally (`vite.config.ts:46`)
   with NO jsdom/happy-dom/testing-library, and every UI test is
   `renderToStaticMarkup` SSR smoke by deliberate posture
   (`ChainBuilder.test.tsx:2-6`: "Interactive propose→preview→apply
   is the browser walk"). All five gate-sensitive sites are reachable
   ONLY THROUGH (`:418` is lexically inside; `:237`, `:526`, `:569`,
   `:578` are function bodies called only from within)
   `{preview !== null && view !== null && …}` (`ChainBuilder.tsx:338`)
   — `preview` is component-local state set only by the Propose click
   handler — so SSR renders initial state and NEVER reaches them.
   The rows as specced were unimplementable.

   **Resolution: add `jsdom` as a devDependency, scoped to the new P3
   seam-test file ONLY** via a per-file `@vitest-environment jsdom`
   pragma; drive React with `createRoot` + `act` (both already
   available — no testing-library; a plain
   `el.value = x; el.dispatchEvent(new Event("change",
   {bubbles:true}))` DOES fire React's `onChange` for a `<select>`,
   verified — the value-tracker short-circuit that makes
   testing-library necessary for text inputs does not apply). The
   global node env and every existing test file stay UNTOUCHED, so
   the repo's SSR-smoke posture is unchanged everywhere else; the new
   file's docblock states why it departs.

   **Three mechanics the implementer must not have to rediscover:**
   - **Set `globalThis.IS_REACT_ACT_ENVIRONMENT = true`** in the new
     file. There are no `setupFiles`, and testing-library (which
     normally sets it) is deliberately not used, so React otherwise
     logs "The current testing environment is not configured to
     support act(...)".
   - **NEVER write the literal pragma string in any other file's
     comments.** Vitest matches it against the WHOLE FILE CONTENT
     (a bare `content.match(/@(?:vitest|jest)-environment\s+…/)`),
     not a leading docblock — so a file merely *mentioning* it flips
     environment silently and still passes. The likeliest violation
     is cross-referencing this decision from
     `ChainBuilder.test.tsx:2` ("Node env, no jsdom"): describe it in
     prose, never quote the pragma.
   - **jsdom supplies NEITHER `localStorage` NOR `indexedDB`**
     (v12 — MEASURED at implementation; my v11 claim that it gives a
     real `localStorage` was WRONG: jsdom serves `about:blank`, an
     opaque origin, so touching `localStorage` throws
     `SecurityError: localStorage is not available for opaque
     origins`). The file must install an in-memory stand-in, and it
     must do so in `vi.hoisted` — `createJSONStorage` resolves the
     storage ONCE, eagerly, at import, and guards only a throw, not
     `undefined`. Any catalog path needing IDB injects
     `fake-indexeddb` as the existing suites do.

   **Why not the alternatives** (both were offered; recorded so this
   is not re-opened): extracting an exported pure `ChainPreview`
   would relocate Axis 4's component-body derivation site — the exact
   thing r4/r5/r6 fought over, including r6's "memo above the null
   guard" ruling — i.e. trading a design the gate approved eight
   times for an unreviewed restructure. Routing the rows to the
   browser walk leaves them unenforced in CI, which directly voids
   the r5 finding this whole mechanism rests on ("a missed seam is a
   SILENT behavioural regression"; `gateCatalog` returns `Catalog`,
   so the wiring is not compile-forced).

   **TWO further rows belong in this jsdom file — my first sweep
   named only the five seams and missed both** (amendment review,
   one found by each reviewer):
   - **the null-tier recovery-WORDING row**: the P1 string "every
     producer's machine is excluded; edit MACHINE EXCLUSIONS to
     recover" exists at exactly one place in the tree,
     `ChainBuilder.tsx:451-455`, inside the same `preview !== null`
     block, and is UI-rendered by design (spec 5 surfaces only a
     discriminated cause detail; spec 6 assigns the wording to the
     component);
   - **the r4 STALENESS row** ("TIER re-propose uses the NEW tier's
     world on that same propose"): it requires driving the TIER
     select AND asserting against `preview`, and it is NOT
     adapter-testable either — the defect it pins is the
     patch-carries-the-just-computed-value idiom that lives solely in
     the un-exported `repropose` (`ChainBuilder.tsx:145-187`, the
     rationale comment at `:154-156`).

   So the jsdom file's scope is: the four observable seam rows, the
   null-tier recovery-wording row, the staleness row, and the
   TIER-select row below.

   **TIER select renders "all"** when the persisted tier has no
   matching option (the Axis 1 render-normalization — no clamp, no
   write-back). **This row is ALSO DOM-dependent, and spec 6 must
   make the binding explicit** (amendment review): React's server
   renderer marks `selected` only on an option matching the select's
   `value`, so for an above-range integer the SSR string contains NO
   selected option — an "all renders" assertion would be red, and
   weakening it to "an 'all' option exists" would be green-and-
   non-discriminating (the exact failure mode already eaten twice, at
   the r6 label row and the r7 fixture). Therefore spec 6 binds it
   explicitly — `value = options.includes(t) ? String(t) : ""`.

   **That binding CANNOT be pinned on `select.value === ""`, or on
   any client-DOM assertion at all** (v12 — MEASURED at
   implementation and independently re-verified by the team lead; my
   v11 fold of the reviewer's finding was itself wrong). In the REACT
   path, `value=""` and `value="999"` produce byte-identical DOM —
   `value:""`, `selectedIndex:0`, identical `innerHTML` — because
   React sets `option.selected` flags rather than `select.value`, so
   when nothing matches, no option is flagged and the DOM's own reset
   algorithm selects the FIRST option, which IS "all". (A raw-DOM
   probe assigning `.value` directly DOES diverge —
   `selectedIndex: -1` — which is exactly why this looked pinnable;
   that is not the path React takes.) The divergence is real only in
   React's SERVER renderer, which this SPA never uses. So: KEEP the
   explicit binding (it is the honest expression of intent), pin the
   USER-VISIBLE outcome instead, and record the binding expression as
   a PROVEN NO-OP alongside `:441` — never give it a phantom
   assertion.

   *Future work, NOT for P3 — tracked as **#106**, created now (the
   operating model requires the ticket, not an "if wanted" park):* a
   branded `GatedCatalog` return type would make the FORGOT-TO-GATE
   direction a COMPILE error rather than a tested one. **Not
   "strictly better than any test"** (amendment review corrected my
   overclaim): a brand is still assignable to `Catalog`, so it would
   NOT catch the reverse mistake — the Axis-4 carve-outs that must
   receive the UNGATED catalog (`excludableMachines`,
   `byproductSuggestions`, AltCompare's `candidateRecipesFor`) would
   silently accept a gated one. And it is not a cheap swap: it
   collides with this spec's frozen "helper signatures UNCHANGED"
   pin and would touch ~12 existing adapter-test call sites. Both
   facts STRENGTHEN the deferral — it is a signature redesign, not a
   type annotation.

   **bidirectionality log**
   `features/propose-grows-up/p3-r2-verification.log`.
9. **Docs at merge (team lead).** Arc-close docs follow (separate
   step, epic #98).

## Explicitly out of scope

Machine gating from building-recipe schematics (rationale in Axis 5);
"(locked)" labeled picker options (future polish); per-plan preference
sets; MAM/alternate acquisition tracking (a tier NUMBER is the whole
model — no "which hard drives do I have" inventory); routing (#105).

## Test + verification plan

Per spec item 8 + the log; trunk verify after worktree removal.
**Walk:** with prefs empty, propose Computer 10/min → baseline
byte-stable; pick an alternate + exclude a machine → reload the page →
propose again → both choices seeded and visible (chips/labels); set
TIER to 0 → propose something tier-locked (e.g. Computer — Manufacturer
recipes sit above tier 0) → constrained rows with tier-worded recovery;
TIER back to "all" → recovered; per-run override of a persisted choice
does not corrupt the stored prefs (change → reload → original pref
back? NO — mirrors write back by design; verify instead that Discard
does NOT strip prefs and a fresh propose still seeds them). Both
themes.

## Assumptions ledger

- FGSchematic carries the tier/unlock truth for recipes — grounded:
  measured this session (574 schematics, all 8 mTypes enumerated in
  Axis 3) on the bundled snapshot; the parse tolerates absence (empty
  recipeUnlocks ⇒ gating select collapses to "all" only).
- Non-progression schematic types cannot under-gate — grounded:
  MEASURED this session: zero catalog production recipes take a lower
  min-tier from EST_ResourceSink/Customization/Tutorial than from
  progression types (their BP_UnlockRecipe_C refs are
  building/cosmetic recipes, dropped by the unmatched-ref skip).
- User-uploaded Docs.json carries FGSchematic identically — grounded:
  same game-export format as the bundled file (which IS a Docs.json);
  the loader's existing tolerant-parse discipline extends to it.
- Schematic refs map to catalog ids ONLY via
  `normalizeClassName(seg, "Recipe_")` — grounded: measured; the raw
  trailing segment (`Recipe_IronPlate_C`) is NOT the catalog id
  (`iron_plate`, docs-loader.ts:126). (v1 falsely claimed equality —
  corrected at r1.)
- localStorage is the right durability tier for prefs — grounded:
  `unlockedTiers` precedent (S10 frozen Axis 5), and S19's IDB persist
  work targeted PLANS, not user prefs.

## Revision history

- v1 (2026-08-07): initial merged brainstorm+spec.
- v2 (2026-08-07): r1 fold (both reviewers NEEDS_REWORK; findings
  converged on keying + compare, adversarial added three more).
  **CRITICAL/IMPORTANT (both): ref keying — FOLDED**: Axis 3 + spec
  item 2 mandate `normalizeClassName(seg, "Recipe_")`; ledger's false
  "both sides" equality corrected; a raw-key must-not-match test
  added. **IMPORTANT/MAJOR (both): compare — FOLDED by carve-out**:
  AltCompare stays ungated with rationale (applied-graph surface; a
  stage may run a gated recipe; P1 precedent pinned it untouched);
  tier-awareness joins #103's consolidation scope; "one consistent
  world" re-scoped to the propose surfaces. **MAJOR (adversarial):
  compound-cause false recovery — FOLDED**: threading redesigned
  (unlockedTier in the options bag, adapter gates internally, both
  worlds available); causeOf splits hasAnyProducer (ungated) from
  effectiveness (gated) so pure-tier-gated items classify constrained;
  recovery worded by the total tierAlone/machineAlone/joint lever
  matrix; full-matrix tests specced. **MAJOR (adversarial): false
  self-heal claim — FOLDED**: ground truth + Axis 3 now state the real
  stale semantics (no stored raw text; uploaded-Docs users fall back
  to bundled + re-upload once) as a disclosed, accepted cost with the
  catalog-store precedent cited. **MAJOR (adversarial): mType
  honesty — RESOLVED BY MEASUREMENT**: all 8 types enumerated; zero
  production recipes under-gated by non-progression types (new ledger
  entry). **NITs — FOLDED**: "overridable per-run" recorded as
  reinterpreted; derive-the-max rule authoritative (0-9 gloss
  removed); both-catalogs threading is the Axis 4 redesign.
- v3 (2026-08-07): r2 fold (both reviewers NEEDS_REWORK on the same
  cell, independently + nested-verified). **IMPORTANT (both): the v2
  lever predicates were effectiveDefaultRecipe-based (alternate-blind)
  while the branch entry is producerRecipesFor-based
  (alternate-inclusive) — an alternate-only item with all alternates
  tier-gated fell through every cell with NO line, regressing the
  message P1 always emits. FOLDED**: predicates redefined
  alternate-INCLUSIVE (`tierLever`/`machineLever` =
  producerRecipesFor non-emptiness on the respective world; recovery
  ≡ the picker returns, P1's actual affordance); four wordings
  partition the booleans (machine / tier / either / both); totality
  PROVEN from constrained ⇒ hasAnyProducer(ungated) ⇒ the joint
  recovery exists. **NITs — FOLDED**: the v2 silent-drop cell added to
  the spec-8 test matrix explicitly; ground truth cross-references the
  ref-bearing-subset fractions (107/109, 77/120) against the full
  type populations.
- v3 nits folded (2026-08-07): r3 = code-reviewer APPROVED (0) +
  adversarial APPROVED_WITH_NITS (1). Both independently verified the
  totality premise as an exact SET EQUALITY (`producerRecipesFor(
  ungated, ∅)` ≡ `hasAnyProducer` — the tier dimension enters only via
  which catalog is passed) and walked every cell incl. the r2 failing
  one; both confirmed the null-tier path collapses to exactly ONE
  reachable cell (machine-only) rendering P1's existing string —
  an exact reduction, not a refinement. **NIT FOLDED**: spec item 8
  now pins the null-tier recovery WORDING (not just classification)
  against future drift. Correctness pair CONVERGED.
- v4 (2026-08-07): design simplify pass (claude-simplify-reviewer,
  NEEDS_REWORK advisory — non-gating; every finding dispositioned).
  **MAJOR (dead sub-model) — FOLDED**: `recipeUnlocks` narrowed to
  `Record<string, number>`; `RecipeUnlockSource`/`RecipeUnlock`
  deleted — nothing read `source`, `CatalogRecipe.isAlternate`
  (types.ts:80, verified) already carries the only distinction it
  could serve, and dropping it removes an undefined min-tier-collision
  question. **MEDIUM (threading mechanism) — FOLDED after verifying
  the correctness folds survive**: v3's "tier in the options bag,
  adapter gates internally" would have forced `unlockedTier` into the
  five ChainBuilder-facing helpers (verified live at ChainBuilder.tsx
  :237, :418, :526, :569, :578) with a whole-map projection each;
  replaced by derive-once (`gateCatalog` at the top of the propose
  path) + explicit passing, with `PreviewOptions.ungatedCatalog?`
  carrying the second world that causeOf and the lever matrix need
  (r1-r3 folds intact; five helper signatures unchanged;
  `unlockedTier` out of both options bags). **NITs — FOLDED**:
  redundant test rows replaced by pointers to the existing pins
  (`catalog-store.test.ts:128/:132`,
  `chain-builder-adapter.test.ts:1258`, both verified); spec 5 now
  says "four-cell matrix per Axis 4" instead of a second three-name
  vocabulary; Axis 2 records why seed-and-mirror beat store-backed
  controls. **Reviewer's "do NOT simplify" list respected**: the
  four-cell matrix, `gateCatalog` as a projection, and the prefs
  read-validation stay as designed (it pressured and justified each).
  Correctness delta re-run dispatched per the fold contract.
- v5 (2026-08-07): r4 fold (both NEEDS_REWORK; the r1-r3 both-worlds
  folds were CONFIRMED intact through the swap — these are the swap's
  own unstated consequences). **IMPORTANT (both): tier staleness —
  FOLDED.** v4 claimed desync "prevented BY CONSTRUCTION" but gave
  the fresh tier no carrier: React bindings are stale in-tick (the
  documented reason P1's `patch` exists), so `gated` would gate at
  the OLD tier on the very propose a tier change triggers — and worse
  than P1's skew, since the stale stage recipe can be ABSENT from the
  new world, defeating force-include and leaving the picker
  `<select>` with no matching option. `patch` now carries
  `unlockedTier?`, with `!== undefined` (not `??`) since `null` is
  the meaningful "all"; test row pins it. **IMPORTANT (both):
  derivation scope — FOLDED**: derive in the COMPONENT BODY (not
  `repropose`); the three module-scope seams are named explicitly
  (`RecipePicker` prop `:387`, `recipeLabel` args `:441`/`:615`) —
  verified live that `recipeLabel` takes catalog as a param and
  `RecipePicker` as a prop, so neither can close over a derived
  const. **IMPORTANT (code-reviewer): #28 null-prototype — FOLDED**:
  verified `Object.create(null)` at docs-loader.ts:124 +
  catalog-store.ts:252 with pins only at the parse/revive boundaries
  (catalog-store.test.ts:234-243); `gateCatalog` is a third
  construction site, so the clause + a test row are now specced (same
  for `recipeUnlocks`). **IMPORTANT (both): delta-1 residue —
  FOLDED**: Axis 3's normative `{tier, source}` sentence and Axis 4's
  `unlock.tier` access rewritten to the narrowed model.
  **Out-of-delta advisory (adversarial) — FOLDED, and it was a real
  SILENT TOTAL FAILURE**: verified this session that
  `normalizeClassName` on a whole `mRecipes` ref (they end in `'`;
  it splits on `[./']` then `.pop()`) returns `""` — every id would
  collapse and gating would no-op invisibly behind the "empty ⇒ all"
  framing; Axis 3 now mandates a quote-excluding capture and a test
  pinning a real ref → a real id. **NITs — FOLDED**: explicit
  keep-ungated carve-outs for `excludableMachines` (gating it would
  strand a persisted exclusion behind a deleted checkbox) and
  `byproductSuggestions` (world-invariant, verified), resolving the
  Axis-4-vs-spec-6 contradiction.
- v6 (2026-08-07): r5 fold (both NEEDS_REWORK; deltas 1/4/5/6 of v5
  survived refutation — these are gaps the folds themselves left).
  **IMPORTANT (both): the catalog CACHE ROUND-TRIP — FOLDED, and it
  was a second verified silent-total-failure, on the DOMINANT runtime
  path.** `recipeUnlocks` is parsed data, but the cache is
  field-whitelisted (`StoredCatalogData` :84-88, `serializeCatalog`
  :182-208, `reviveCatalog` :238-283 — verified), and `tiers` is
  re-attachable ONLY because it is a constant. The halves fail
  asymmetrically: revive is tsc-forced, serialize is not — so the
  natural fix yields an empty map on every boot after the first,
  gating no-ops invisibly, disguised by the ledger's own "empty ⇒
  all" tolerance. This is verbatim the scar at catalog-store.ts:46-50
  (`isRawResource`, ticket #57). Spec 3 now names all three
  enumerating functions; spec 8 adds the save→load pin.
  **IMPORTANT (both): spec 6 still carried v4's "derive in the single
  repropose path" — FOLDED** (it is the file-by-file contract an
  implementer follows, so it would have reproduced the r4 defect
  verbatim); it now names both derivation sites.
  **IMPORTANT (adversarial): "these are compile-forced" was FALSE —
  FOLDED.** `gateCatalog` returns `Catalog`, so passing `catalog` vs
  `gated` typechecks identically; a missed seam is silent. The seams
  are now pinned by TESTS (gated recipe absent from picker options
  and label; clear-rule resolves gated) — without which the headline
  "gated-out recipes vanish from pickers and chips" claim had no
  enforcement at all. **NITs — FOLDED**: all five sites are outside
  `repropose` (not four); the design has TWO derivation sites with
  distinct inputs, stated with why they cannot diverge and with
  memoization guidance (the body derivation runs per RENDER — every
  Rate/Clock keystroke — not per propose); the TIER control is
  component state seeded-and-mirrored like the other two persisted
  controls; `unlockedTier` clamps to the derived max on read
  (`clampTier` precedent).
- v7 (2026-08-07): r6 fold (both NEEDS_REWORK; v6's deltas 1-6 all
  SURVIVED refutation — the findings are gaps those folds left plus
  one defect the team lead introduced). **IMPORTANT (both): the
  clamp-on-read (a v6 team-lead addition) — DROPPED, not re-placed.**
  It failed three ways: `clampTier`'s bound is a module CONSTANT
  while a catalog-derived bound does not exist at merge time (persist
  hydrates during `createAppStore` with `catalog: "initializing"`);
  an empty `recipeUnlocks` gives `Math.max()` = `-Infinity`, which
  the Axis-2 mirror PERSISTS, so a later good-catalog boot would gate
  out every unlock-bearing recipe — a sticky silent regression traded
  for a cosmetic one; and a seed-time clamp misses its own named
  trigger (mid-session re-upload). Replaced by RENDER-LEVEL
  normalization (a tier with no matching option renders "all" —
  which is what a too-high tier already does), with no write-back, no
  empty-case rule, and no hydration dependency. **IMPORTANT (both):
  the cache fold was not exhaustive — FOLDED**: spec 3 now also names
  `reviveCatalog`'s shape guard, the REQUIRED-ness of the field (with
  why the `isRawResource` optional precedent must NOT be followed —
  optional un-forces revive and voids the delta's own safety
  argument), the tsc-forced fan-out incl. the production literal at
  `GraphCanvas.tsx:353-358`, and the one NON-forced site
  (`serializedSample()`, `catalog-store.test.ts:253-290`) with an
  explicit "fix the fixture, do NOT make revive tolerant" ruling.
  **IMPORTANT (code-reviewer) + nested verification: the label row
  could not pin its seam — FOLDED**: `recipeLabel` only decides the
  `(default)` tag, so an absent-from-list assertion passes even with
  the ungated catalog; the row now pins the tag itself. Spec 8 is
  restructured to one row per GENUINELY separate edit (`:387`,
  `:418`, `:441`, `:237` — `:615` inherits from `:387`), each at the
  UI level. **NITs — FOLDED**: `:418` added (an ungated one renders a
  dead recovery select contradicting the matrix); the memo must sit
  ABOVE the null-catalog guard and tolerate null (no react-hooks lint
  in the toolchain to catch the conditional hook).
- v8 (2026-08-07): r7 fold (both NEEDS_REWORK, converging on the same
  three items with the same proofs). **IMPORTANT (both): the `:441`
  seam is provably UNOBSERVABLE — FOLDED by removing its pin, not by
  rewording it.** A constrained row has `effectiveDefaultRecipe(gated)
  === null` by construction, so no option can carry `(default)` under
  correct wiring; and the ungated default is necessarily gated out
  (else the row would not be constrained), so it is absent from
  `producerRecipesFor(gated)` too — rendered output is byte-identical
  either way. The proof is now recorded IN the spec so a later round
  does not re-add a phantom assertion; the `(default)` pin moves to a
  normal stage row's picker, where the gated default is non-null by
  construction. **IMPORTANT (code-reviewer) / NIT (adversarial): the
  `:237` row could not discriminate in one step — FOLDED** to the
  two-step assertion (choose the gated default, then raise TIER back
  to "all": correct reverts to D, the missed edit stays pinned to D′
  by the spurious override). **IMPORTANT (code-reviewer) / NIT
  (adversarial): render normalization was unsound BELOW the option
  range — FOLDED.** Dropping the clamp at v7 also dropped the
  CATALOG-INDEPENDENT half of validation: a persisted `-1`/`2.5`/
  `NaN` renders "all" while `gateCatalog` gates out everything, and
  it is sticky (no write-back, and picking "all" fires no `onChange`
  because the control already shows it). Restored as
  `Number.isInteger(v) && v >= 0 ? v : null` — module-level facts
  only, so none of the hydration-order problem that killed the clamp.
  **IMPORTANT (adversarial): the cache sweep's "one non-tsc-forced
  site" was FALSE — FOLDED.** `catalog-store.test.ts:145-160` is a
  second untyped stored shape whose corrupted-recipe test would begin
  throwing at the new shape guard BEFORE reaching the path it names —
  staying green while its coverage vanishes. That is this delta's own
  failure mode occurring inside the fold; both fixtures now carry the
  explicit instruction. **NIT — FOLDED**: `chain-view.test.ts`'s
  `as unknown as Catalog` site recorded as verified-inert.
- v9 FROZEN (2026-08-07): r8 = **APPROVED_WITH_NITS ×2 — the
  correctness pair CONVERGED after eight rounds.** Both re-derived
  all four v8 folds from live source: the `:441` no-op proof is
  correct AND complete (the option key/value come from `o.id`, so the
  label text is the only thing that site could perturb — "byte
  identical" is literal), the relocated `(default)` pin discriminates
  at a normal stage row, the two-step `:237` assertion diverges at
  step two (the spurious override is a VALID ungated id, so
  validate-and-ignore does not rescue it), `Number.isInteger(v) &&
  v >= 0` closes every below-range/non-integer case with no catalog
  dependency, and the cache-fixture sweep is complete (every other
  stored row either comes from the real save path or dies at the
  version check before revive). **NITs FOLDED**: dropped the "absent
  from the label" residue in Axis 4 (the formulation r6/r7 proved
  non-discriminating); spec 4 now names `store.test.ts:588-598` — an
  untyped `JSON.parse` exact-equality pin on the persisted projection
  that widening `partialize` turns red, with the ruling to update the
  assertion/comment/title and NOT to narrow the projection.
  Design of record; implementation may proceed.
- v10 (2026-08-07): **implementation-time amendment (team-lead call,
  under delta review).** The implementer's drift hunt found that
  spec 8's UI seam rows were UNIMPLEMENTABLE in this toolchain — a
  design-grounding failure of my own: I specced "rendered-output
  assertions" for eight rounds without verifying the repo could write
  them (node env, no DOM library, and all five seams sit inside the
  `preview !== null` block SSR never reaches). Resolved by adding
  `jsdom` scoped to the new seam-test file via a per-file pragma,
  leaving the global env and every existing test untouched. The two
  alternatives are recorded as rejected in spec 8 with reasons
  (restructuring trades a gate-approved design for an unreviewed one;
  the browser walk leaves the r5 silent-regression finding unenforced
  in CI). A branded `GatedCatalog` — which would make wrong wiring a
  compile error — is noted as a future ticket, deliberately NOT taken
  unreviewed at implementation time. Items 1-7 are unaffected.
- v11 (2026-08-07): amendment delta review = NEEDS_REWORK ×2; the
  MECHANISM was endorsed by both (diagnosis independently verified,
  no SSR route to the seams exists, the pragma genuinely isolates,
  `act` available, DOM already in tsconfig lib, and both rejected
  alternatives correctly rejected) — the rework was localised.
  **IMPORTANT (both): my paste ORPHANED live requirements** (the
  TIER row + the bidirectionality-log pointer) into the "NOT for P3"
  paragraph — FOLDED, split back out. **IMPORTANT (both): the sweep
  was incomplete — FOLDED**: the null-tier recovery-WORDING row
  (code-reviewer) and the r4 STALENESS row (adversarial) are in the
  same unimplementable class and neither is adapter-testable; both
  now named for the jsdom file. **IMPORTANT (code-reviewer): the
  TIER-renders-"all" row is itself DOM-dependent — FOLDED**: SSR
  marks `selected` only on a value match, so above-range yields NO
  selected option (assertion red, or weakened to
  green-and-non-discriminating — the failure mode already eaten
  twice); spec 6 now binds the value explicitly and the row is
  pinned on `select.value === ""`. **IMPORTANT (adversarial): the
  #106 park violated the own-ticket rule — FOLDED**, ticket created
  and cited. **NITs — FOLDED**: `IS_REACT_ACT_ENVIRONMENT` (no
  setupFiles, no testing-library); **the pragma is matched against
  WHOLE FILE CONTENT**, so no other file may quote the literal
  string or it silently flips environment; jsdom's ambient
  consequences (real `localStorage` ⇒ the store singleton hydrates
  for real, reset between tests; no `indexedDB` ⇒ inject
  `fake-indexeddb`); spec-8 header no longer says "node env"
  unqualified; "live inside" → "reachable only through"; and the
  `GatedCatalog` rationale corrected — a brand catches only the
  forgot-to-gate direction and collides with the frozen
  signatures-unchanged pin, which strengthens the deferral rather
  than weakening it.
- v12 (2026-08-07): **two of the v11 amendment's mechanics were
  wrong, and the IMPLEMENTER caught both by measurement** (team lead
  independently re-verified each before folding — the second one
  reversed my own first probe):
  - **jsdom supplies NO `localStorage`** — it serves `about:blank`,
    an opaque origin, so the call throws `SecurityError`. v11 claimed
    the opposite and told the implementer to "reset storage between
    tests". Corrected: install an in-memory stand-in, and do it in
    `vi.hoisted`, because `createJSONStorage` resolves storage once
    eagerly at import and guards only a throw, not `undefined`.
  - **The TIER `value` binding is a client-DOM NO-OP** — in React's
    path `value=""` and `value="999"` render byte-identically
    (`value:""`, `selectedIndex:0`, same `innerHTML`), because React
    flags `option.selected` rather than setting `select.value`, and
    an unmatched value leaves the DOM's reset algorithm to select the
    first option, which IS "all". v11's `select.value === ""` pin
    would therefore have been NON-DISCRIMINATING — the same failure
    class this spec has now caught four times (r6 label row, r7
    fixture, and two of the implementer's own tests). Binding kept;
    outcome pinned; expression recorded as a proven no-op.
  The implementer also self-caught two tautological tests of its own
  during the bidirectionality sweep (the TIER-normalization row and
  an unpinned `unlockedTier` memo dependency — dropping the dep
  leaves the propose correct while freezing the render seams
  forever), fixing both before writing the log.
