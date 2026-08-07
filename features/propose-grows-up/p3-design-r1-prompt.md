# Design review r1 — S20 P3 (#102): Propose persistence + gating

Review `features/propose-grows-up/p3-brainstorm.md` (v1) in the repo at
`/home/subzerodev/workspace/satisfactory-foundry` (develop). This is a
DESIGN review — no diff exists yet.

## A. Current-state anchors (verify against live source)

- `src/state/store.ts:937-1010` — the persisted-slice machinery:
  PERSIST_KEY `satis_foundry:tiers`, `PersistedShape { unlockedTiers }`,
  `clampTier` read-validation, injectable `storageProvider`,
  synchronous hydrate-during-creation.
- `src/data/catalog-store.ts:32,163` — `CATALOG_PARSER_VERSION = 4`,
  mismatch → re-parse from stored raw text.
- `src/data/docs-loader.ts:157` — catalog `{items, machines, recipes,
  tiers}`; NO FGSchematic parse today. `src/data/tiers.ts` = transport
  tiers only.
- `src/ui/ChainBuilder.tsx:114-122` — P1 controls as component state;
  the single `repropose` options path (:138-187); P2's Preview
  clockText snapshot.
- `src/ui/chain-builder-adapter.ts` — P1 seam surfaces
  (candidateRecipesFor / effectiveDefaultRecipe / producerRecipesFor /
  pickerOptionsFor, all taking excludedMachineIds); the constrained
  cause classification + recovery wiring.
- The bundled snapshot `public/bundled-docs/en-US.json` — FGSchematic
  claims (574 entries; EST_Milestone/Alternate/MAM counts; mTechTier;
  BP_UnlockRecipe_C.mRecipes refs ending `.Recipe_<X>_C'`). Spot-check
  with a script if you have shell; otherwise verify the artifact's
  claims are labeled as measured.

## B. Claims to verify (the v1 design)

1. **Axis 1** — persistence home: the persisted localStorage slice
   extended with `proposePrefs` (overrides + excludedMachineIds +
   unlockedTier); rawItemIds and clock deliberately ephemeral. Is the
   global-vs-per-plan call sound? Is the supersession of P1's
   ephemeral pin legitimately design-recorded (epic sequencing) rather
   than a silent contradiction?
2. **Axis 2** — seed + mirror shape: component state stays the per-run
   truth; prefs seed initial state and receive writes in the existing
   handlers. Any hydration-order trap (persist hydrates during store
   creation; ChainBuilder mounts later — verify the seed can never
   read pre-hydration state)? Any path where a per-run override
   mutates prefs when it shouldn't (per-run overridability pin)?
3. **Axis 3** — tier model: parse ALL schematic mTypes,
   BP_UnlockRecipe_C only, trailing-class-name match, MIN-tier merge,
   source tag; `recipeUnlocks` on the Catalog; parser version 5.
   Attack the data claims and the merge rule.
4. **Axis 4** — gating as catalog projection (`gateCatalog`), identity
   at null, core signature frozen, totality via validate-and-ignore.
   The constrained-recovery message distinguishing tier-gated from
   machine-excluded (ungated-nonempty ∧ gated-empty). Attack: does the
   projection interact correctly with EVERY adapter surface (chips,
   pickers, suggestions, compare — compare is pinned at 100% clock but
   does it see the gated or ungated catalog, and which is honest?);
   does gating break the P2 byproductSuggestions scan; does the
   projection respect the byte-stable default.
5. **Axis 5** — TIER select (null default, 0-max derived), machines
   explicitly NOT gated (rationale), alternates gated by their tier
   labels, no separate toggle.
6. Spec/tests/walk completeness for all of the above; the assumptions
   ledger's grounding.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS /
NEEDS_REWORK / BLOCKED) with severity-tagged, line-cited findings.
