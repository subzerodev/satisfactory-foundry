# P0 — data foundations: parsed tier table + train-lockout correction

**Arc:** #140 Phase 2 (FEATURE.md P0). **Merged brainstorm+spec, lean** — both
items' design substance is already dual-reviewed (gap-report RISK section +
PASS section @ ae266b1) and decision-locked (#140 comments 24779, 24796).
Anchors verified against `develop` @ 64a8fcf.

## Already settled — do NOT re-litigate

- Tier table parsed from the game file: belts `mSpeed ÷ 2`, pipes
  `mFlowLimit × 60`; dedupe the cosmetic `_NoIndicator_` pipe variants; sort
  ascending (the `Classes` array is not in Mk order — observed Mk1, Mk5, Mk6,
  Mk4, Mk3, Mk2). Grounded by `ITEM_SPACING = 120`
  (`FGBuildableConveyorBase.h:329`) — items/min = mSpeed/120×60, exact for
  all six marks (decision 24779; audit + adversarial re-derivation).
- `TRAIN_LOCKOUT_SECONDS` 27.08 → 27, cited to the game field
  `mTimeToCompleteLoad = 27.000000`; the 0.08 s has no support in headers or
  Docs.json (decision 24796; `transport-facts.md:176-183` documents the old
  choice and is updated).

## Design

### D1 — where the parse lives and what falls back

`parseDocsJson` (docs-loader) gains a tier-table branch: admit
`FGBuildableConveyorBelt` and `FGBuildablePipeline` classes, read
`mSpeed`/`mFlowLimit` via the existing lenient decimal parse, derive
belt = mSpeed × (1/2), pipe = mFlowLimit × 60 as exact Fractions, dedupe by
value, sort ascending. The parsed table replaces the stamp at the single
site where `TIER_TABLE` is attached to a catalog today.

### D1b — single source of truth: the constant's direct consumers reroute
(adversarial r1 IMPORTANT fold — the bifurcation)

Parsing `catalog.tiers` alone would FORK the app: four load-bearing
consumers read the `TIER_TABLE` constant directly and would stay on curated
values while the display path (`colors.ts:24`, `link-plan.ts:184-192`,
`extraction-plan.ts:273`, `graph-flow.ts:457/493`, `GraphCanvas.tsx:601`)
uses the parsed table — divergent tier values inside one plan for any
non-curated-equal file, which AC1 makes an intended input. The four
reroute through `catalog.tiers`:

- `stage-input.ts:69` `sliceTier` — takes the table from the `catalog`
  already passed to `toStageInput`;
- `store.ts:1140` `clampTier`, its two call sites, and the `store.ts:430-431`
  default seed — **single-owner clamp at the ready transition (r3 fold —
  supersedes r2's two-stage shape, whose merge-site constant clamp was a
  confirmed silent-loss defect: clampTier is down-only,
  `store.ts:1144-1146`, so a persisted 7 from a modded 7-tier catalog died
  to 6 on every reboot, contradicting this spec's own 7-tier promise)**.
  The persist-`merge` site (`store.ts:2386`) runs synchronously during
  `createAppStore`, BEFORE any catalog exists (`store.ts:1341-1349`) — it
  cannot see the real table, so it stops bounding ABOVE entirely: it keeps
  only the validity floor (integer, ≥ 1 — junk like -5/"x" still
  sanitizes). Nothing consumes the count pre-ready (no solve without a
  catalog; the tier strip does not render on the initializing /
  needs-upload screens), so an out-of-range count parked in state until
  ready is inert. The READY transition is the sole upper clamp, against
  the live `catalog.tiers` lengths — loss-free by construction: persisted
  7 + 7-tier catalog keeps 7; persisted 7 + 6-tier catalog correctly
  clamps to 6.

  **Merge semantics, complete (r4 fold — the "unobservable today" claim
  was FALSE, two existing tests pin the deleted behaviour):**
  - MISSING value (`undefined` at the sanitizer) → the full FALLBACK
    table lengths (today's default-seed semantics, `store.ts:429-431` —
    no catalog exists yet, so the constant is the only available default;
    the ready clamp adjusts it if the live table differs). Path
    precision (r6 fold): a whole-row CORRUPT-JSON persist never reaches
    the merge at all — `JSON.parse` throws inside `createJSONStorage`'s
    `getItem` and zustand's `toThenable` short-circuits straight to the
    hydration `.catch`, so `options.merge` is never invoked and the seed
    default survives untouched; `store.test.ts:850-860` keeps passing
    unchanged via THAT no-merge path. The sanitizer's `undefined` branch
    is exercised by the missing-FIELD case (a valid-JSON row whose
    `unlockedTiers.belt`/`.pipe` is absent → `tiers?.belt === undefined`
    at `store.ts:2384-2387`).
  - Present integer ≥ 1 → kept AS-IS (no upper bound). The existing pin
    `store.test.ts:862-874` ("out-of-range persisted tiers are clamped on
    hydration", belt 99 → 6, asserted WITHOUT any init/ready transition)
    asserts exactly the deleted bound: it is REWRITTEN to the deferred
    semantics — pre-ready the 99 persists (assert 99 + pipe floors to 1),
    and the clamp is asserted at a driven ready transition (folding into
    the non-vacuous/loss-free pins below).
  - Present but corrupt scalar ("x", 3.5, -5) → the validity floor (see
    the junk pin).

  The authoritative clamp fires at every catalog→ready transition: one
  helper applied inside the same `set()` that installs a ready catalog
  (init's hit branch, the loadBundled applies, `uploadDocsText`, the #144
  refresh apply), re-clamping `unlockedTiers` against the new table's
  lengths. This is MANDATORY for totality, not polish: `sliceTier` throws
  a RangeError on count > table length (`stage-input.ts:71`, a shape-error
  contract this spec keeps), so a persisted 6 against a 5-tier parsed
  table would otherwise crash the first solve.

  **Clamp placement, pinned (r4 fold): BEFORE THE SOLVE, not merely "in
  the same set()".** At the two ready sites whose install-set also maps
  selections and derives immediately (`:1521` #144 refresh, `:1588`
  upload — their mapSelection callbacks touch only recipeId/overrides),
  the clamp is composed INTO the `mapSelection` callback (each stage's
  `selection.unlockedTiers`), ahead of `deriveStage` — the top-level
  `state.selection` mirror needs no separate clamp because `mirrorActive`
  (`store.ts:595-597`) re-derives it from the clamped active stage at the
  end of `deriveAllStages`; a post-derive clamp inside the same set would throw the
  very RangeError it exists to prevent. At `:1441`/`:1463` (install
  without an in-set derive; the identity-mapper derive follows at
  `:1483`) it is a plain pre-clamp before that derive. The user-action clamp
  (`setUnlockedTiers`, `store.ts:1692`) reroutes to the live table
  directly (catalog reachable inside its `set`, ready-status guarded).
  The plan-stamping paths (`rebuildFromPlan` `store.ts:726/:803`,
  `applyProposalToSlice` `store.ts:854`) need no clamp of their own:
  they copy `slice.selection.unlockedTiers` — the live in-memory value,
  never a persisted/file copy (stored plan tiers are dead-on-read,
  `store.ts:702`) — and both require a ready catalog, so every value
  they copy has already passed the ready clamp (transitive safety,
  adversarial r5 clearance).
  Two precision notes (adversarial r2): `sliceTier` gains a table
  parameter (a local signature change inside `toStageInput`, not a
  freebie), and the store's unreachability comment at `store.ts:541-544`
  ("tier-range is unreachable — clamped at the setter") is UPDATED — its
  claim survives only via the ready-transition re-clamp once the two
  tables can diverge;
- `ControlsStrip.tsx:31` selector max — a NEW PROP cascaded through BOTH
  components (`ControlsStrip` and its inner `TierToggles`, props at
  `ControlsStrip.tsx:5-15,22-30` — neither sees the catalog today) from
  `App.tsx:393` where the catalog is in scope (r2 fold, stated as the
  prop cascade it is).

`TIER_TABLE` remains ONLY the parse fallback + test fixture. Consequence,
stated: a modded/patched file with a 7th belt tier now genuinely works
end-to-end (solver slices 7, selector offers 7); `TIER_COLORS` has 6
entries, so tier 7 renders in the existing unmatched-capacity
`OVERRIDE_COLOR` degrade (`colors.ts` behaviour today) — acceptable, noted,
not silently wrong.

**Fallback, load-bearing:** if the file yields NO belt tiers or NO pipe tiers
(old export, malformed), the catalog keeps the curated `TIER_TABLE` for that
kind — parse-else-curated per kind, never a rejection (the parseMachinePower
posture). `TIER_TABLE` therefore remains in `tiers.ts` as the fallback and
the test fixture, no longer the primary source. A partial parse (some tiers)
still wins if non-empty: the derivation is all-or-nothing per kind only in
the sense of non-emptiness — malformed individual entries are skipped
leniently.

### D2 — persistence

The catalog's `tiers` field already exists on `Catalog`; today it is
re-stamped on every revive ("Tiers are always the curated table, never
round-tripped"). That comment and behaviour change: tiers become part of the
parsed catalog and MUST round-trip (else a cached bundled catalog silently
reverts to curated values after the parse ships — the isRawResource scar
class again). `StoredCatalogData` gains the serialized tier table
(Fraction toString / parseRational, the established idiom);
`CATALOG_PARSER_VERSION` bumps 7 → 8.

**Deletion sweep (version literal INCLUDED, per the extended memory rule):**
`catalog-store.test.ts` pins `toBe(7)` (two sites, updated by #142) and the
stale-fixture `parser_version: 6` — all three move with the bump (7→8,
fixture retargets to 7-stale-under-8). TWO reference-identity pins exist (r1
review correction — grep, not assumption): `docs-loader.test.ts:158` and
`catalog-store.test.ts:115` (`toBe(TIER_TABLE)` inside the save→load
round-trip). BOTH assert the OLD stamping behaviour: the first is REPLACED
by the derivation assertion (below); the second converts to value-equality
(the revive now rebuilds tiers from the stored row, value-equal but not
reference-identical).
`colors.test.ts` checks `TIER_COLORS.length === TIER_TABLE.length` — remains
valid (fallback table unchanged, and the parsed table for the real file has
the same six/two lengths). UI tier-count selectors read `catalog.tiers`
generically — no pins on identity.

### D3 — the guard test the audit demanded

A test parses `public/bundled-docs/en-US.json` — the real file; unit-scope
reads of it are established precedent (`packaging.test.ts:12`,
`store.test.ts:140`, three `?raw` importers; r1 review resolved the hedge)
— and asserts
the derived table EQUALS the curated `TIER_TABLE` value-for-value. This is
the loud-failure guard: a future game patch changing a belt speed fails this
test instead of silently desyncing — exactly the drift detector the audit
found missing.

### D4 — the lockout correction

`transport-facts.ts:72`: `TRAIN_LOCKOUT_SECONDS` becomes `Fraction.from(27)`
with the docstring citing `Build_TrainDockingStation_C.mTimeToCompleteLoad =
27.000000` (game field) and noting the wiki's 27.08 was retired (#140
decision 24796).

**Sweep scope widened (r1 review correction — the class that has now bitten
FOUR times): `grep -rn "27.08|2708|0.4513" src/ docs/`** — docs/ included.
Named sites beyond the constant:

- `docs/research/transport-facts.md` — the FACT-TABLE row `:169`
  ("27.08 s (0.4513 min)") and the directive `:182` ("Use the wiki's
  27.08 s") both contradict decision 24796 post-change and are updated;
  plus the stale prose at `:178-179`, `:189-190`, `:203`, `:279`, `:284`,
  `:286`, `:368`, `:378` (the 0.4513-min derived figures move to
  27/60 = 0.45 exactly).
- `src/core/transport.ts` docstrings at `:225,:232,:263,:264,:310` embed
  "27.08 s" in the ceiling-formula prose — updated alongside the constant.
- Test literals (`transport.test.ts:158,251,252,271`,
  `transport-plan.test.ts:257,264`) fail loudly on the change and re-pin
  on 27 — self-catching, enumerated so the implementer expects them.

### Tests

- Derivation unit: scrambled-order fixture → sorted, deduped, exact values;
  belts-only file → pipes fall back curated (and vice versa); malformed
  entry skipped.
- The D3 guard test against the real bundled file.
- Round-trip: tiers survive serialize → revive exactly.
- Version pins: 7→8 retargets (enumerated in D2).
- Lockout: the sweep's derived constants are RE-DERIVED, not find-replaced.
  **Enumeration corrected AGAIN (r3 IMPORTANT fold): a grep for the
  constant's own digits (27.08|2708|0.4513) structurally CANNOT find the
  DERIVED values — `1431.13`, `1168`, `414.16`, a rewritten `6708` literal
  — because they don't contain those substrings. The sweep for a changed
  constant must target its arithmetic consequences, and the authoritative
  method here is: re-derive EVERY assertion in the docking/lockout describe
  blocks of both files from 27.** Executable-assertion sites, from source:
  `src/core/transport.test.ts` :158 (`6708/100` → 6700/100), :252
  (`"1431.13"` — the 800000/559 2-dp value, recomputed), :271 (`1168/100`
  → 1200/100: (30−27)/30 × 120), :284 (an INDEPENDENT `6708/100` literal,
  moved separately from :158); comment/derivation prose at :23, :154-155,
  :238-242, :259, :268. `src/ui/transport-plan.test.ts` :264
  (`"414.16"` → `"414.00"`, 360 + 2×27 — r1's citation was REAL and r3
  wrongly dropped it) with the knock-on `perPlatformCeiling.eq` at
  :271-272, plus the comment at :257.
- D1b reroute pins: a fixture catalog with a 7-tier belt table drives
  sliceTier/clampTier/selector-max end-to-end; and — NON-VACUOUS by
  construction (adversarial r2) — a persisted unlockedTiers of 6 loading
  against a PARSED table of 3 belt tiers (shorter than the fallback)
  clamps at the ready transition and solves cleanly instead of throwing
  sliceTier's RangeError into a mislabeled invalid stage. Pinning against
  the fallback-length table would pass vacuously and miss exactly this
  regression.
- **Loss-free reboot pin (r4):** persisted `belt: 7` + a 7-tier parsed
  catalog → after reboot the count is STILL 7 (the merge no longer bounds
  above; the ready clamp sees max 7). This is the pin that kills a
  regression back to any constant-bounded merge clamp.
- Junk sanitization pin: persisted `belt: -5` / non-integer (a CORRUPT
  value, e.g. "x" or 3.5) → the merge floor yields 1. **Deliberate
  divergence from clampTier's current convention (r4 nit fold; premise
  corrected r5 — the adversarial IMPORTANT):** clampTier maps
  non-integers to max (`store.ts:1141-1142`); the sanitizer maps
  PRESENT-but-corrupt values to the minimal 1 instead — fail-minimal,
  because "corrupt" ≠ "missing". The MISSING case (`undefined`) DOES
  reach the merge and keeps mapping to max — but via the missing-FIELD
  path only (path corrected r6): a missing *row* first-boots through the
  default seed (`store.ts:429-431`) without calling the merge, and a
  whole-row corrupt-JSON persist ALSO never calls the merge (the
  `JSON.parse` throw aborts hydration before `options.merge`; the seed
  default survives — which is how `store.test.ts:850-860` passes). What
  DOES flow through `tiers?.belt === undefined` (`store.ts:2384-2387`)
  into the sanitizer is a valid-JSON row whose field is absent (or a
  null/array container). The sanitizer is therefore:
  `undefined` → max (full fallback lengths, trichotomy bucket 1);
  present positive integer → kept (bucket 2); present anything else → 1
  (bucket 3). Fail-minimal applies ONLY to the present-but-corrupt
  branch; the `undefined → max` disposition is RETAINED.
- **Missing-field pin (r7 fold — bucket 1 was pinned by NOTHING):** a
  persisted VALID-JSON row with one field absent — e.g.
  `{ state: { unlockedTiers: { pipe: 1 } }, version: 0 }` — hydrates
  with `belt` → the full fallback length (6) VIA THE MERGE, and `pipe: 1`
  kept. This is the missing-FIELD twin of the junk pin: every existing
  persistence fixture supplies BOTH fields (`store.test.ts:833,865,942,
  963,993,1016`), so without this pin a sanitizer routing
  `undefined → 1` — the exact literal-reading regression the r6 fold
  warned against — would pass every enumerated test. The corrupt-JSON
  pin `:850-860` cannot cover it (no-merge path, above); this pin drives
  the sanitizer's `undefined` branch through the merge itself.

## Acceptance criteria

1. Bundled + uploaded catalogs derive tiers from the file; values equal the
   curated table for the current build (the D3 guard proves it).
2. A file with missing/malformed tier classes falls back to the curated
   table per kind — never a rejection.
3. Tiers round-trip through the cache; `CATALOG_PARSER_VERSION` is 8.
4. `TRAIN_LOCKOUT_SECONDS` is exactly 27, cited to the game field.
5. `npm test` + `npm run check` green.

## Assumptions ledger

- mSpeed÷2 / mFlowLimit×60 reproduce the curated values exactly for the
  current build — grounded: derived pairwise in the audit, adversarially
  re-verified, and re-proven continuously by the D3 guard.
- No consumer needs `catalog.tiers` to be reference-identical to
  `TIER_TABLE` — grounded by GREP (r1 correction of a false "only" claim):
  exactly two `toBe(TIER_TABLE)` pins exist (`docs-loader.test.ts:158`,
  `catalog-store.test.ts:115`), both named in D2; `colors.test.ts` compares
  lengths only.
- The bundled file is available to the test runner — grounded: it lives in
  `public/` in-repo and unit-scope reads are precedented
  (`packaging.test.ts:12`, `store.test.ts:140`).

## Revision history

- **r1 → r2** (design review r1, code-reviewer NEEDS_REWORK: 2 IMPORTANT +
  2 NITs, all verified and folded): (1) a SECOND toBe(TIER_TABLE) identity
  pin at catalog-store.test.ts:115 — the ledger's "only identity pin" was a
  false absolute (fourth instance of the absolute-claims class; grep now
  cited); (2) the D4 sweep excluded docs/ and missed the fact-table row
  :169 + the "use 27.08" directive :182 + eight further stale sites — scope
  widened to src/ + docs/ with all sites named; (3) the D3 real-file hedge
  dropped (precedented); (4) transport.ts docstring sites enumerated.
  Adversarial verdict pending at fold time.
- **r2 (adversarial r1 folded in):** adversarial-reviewer NEEDS_REWORK —
  its first IMPORTANT was the same second identity pin (independently
  found; already folded). Its second IMPORTANT was NEW and deeper: the
  TIERS BIFURCATION — four consumers (sliceTier, clampTier, the seed,
  ControlsStrip max) read the constant directly, forking solver-vs-display
  values for divergent files. Folded as D1b: all four reroute through
  catalog.tiers (option (a), the full fix — scoping out divergent files
  would have contradicted AC1's spirit); the 7-tier consequence and
  TIER_COLORS degrade stated; new reroute pins added. NIT folded: the three
  derived 27.08 constants enumerated for re-derivation. Its refutations
  (round-trip reversal + 7→8 bump sound; #144 heal does not substitute;
  the adapter's tiers pass-through pin survives) recorded. r2 goes to both
  correctness reviewers.
- **r2 → r3** (design review r2, code-reviewer NEEDS_REWORK: 1 BLOCKER +
  1 IMPORTANT + 1 NIT, all verified and folded): (1) BLOCKER — the
  persist-merge clampTier site runs pre-catalog and cannot reroute; D1b now
  specifies the TWO-STAGE clamp (merge keeps the constant as pre-catalog
  best-effort; the authoritative re-clamp fires at every catalog→ready
  transition), and names why it is totality-mandatory (sliceTier's
  RangeError contract); (2) IMPORTANT — the D4 test-literal enumeration was
  wrong (r1 lines carried without re-grepping — :251/:252/:271 don't exist,
  six real sites missed); corrected from a fresh grep, including the
  transport-plan.test.ts src/ui/ path; (3) NIT — the ControlsStrip reroute
  stated as the new prop-thread it is. Adversarial r2 verdict pending at
  fold time.
- **r3 amended (adversarial r2 folded in):** adversarial-reviewer r2
  NEEDS_REWORK — both IMPORTANTs are the SAME clamp-timing defect the
  code-reviewer blocked on (independently confirmed: no catalog-ready path
  re-clamps today; the :1483 derive uses an identity mapper while
  :1524/:1591 map recipeId/overrides only — none touches unlockedTiers,
  so a stale count survives; r4 corrected this line's earlier
  identity-mapper mischaracterization), already folded as the two-stage
  clamp. Its
  increments folded: (1) the clamp-on-load pin must use a parsed table
  SHORTER than the persisted count or it passes vacuously; (2) the
  store.ts:541-544 unreachability comment is updated (its claim now rests
  on the ready-clamp); (3) sliceTier's local signature change and the full
  TierToggles+ControlsStrip prop cascade stated plainly. Its confirmations
  (no fifth consumer; colors degrade accurate; display path already
  uniformly on catalog.tiers) recorded. r3 goes to both correctness
  reviewers.
- **r3 → r4** (design review r3, code-reviewer NEEDS_REWORK: 1 IMPORTANT):
  the "re-grepped" D4 enumeration was STILL incomplete — the grep pattern
  targeted the constant's digits, which derived values (1431.13, 1168,
  414.16, an independent 6708 literal) do not contain; and r3 wrongly
  dropped the REAL r1 citation transport-plan.test.ts:264. Folded: the
  enumeration now lists the executable-assertion sites from source and the
  method is stated as "re-derive every assertion in the docking describe
  blocks", not a digit grep. Memory rule extended (derived-value sweep).
  Verified sound by the same review: the four ready-transition sites are
  COMPLETE (:1441,:1463,:1521,:1588 — one-to-one with D1b), the totality
  citation, the unreachability-comment update, the non-vacuous pin
  fixture, and the prop-cascade/signature notes. Adversarial r3 pending.
- **r4 (adversarial r3 folded in):** adversarial-reviewer NEEDS_REWORK — 1
  IMPORTANT, nested-verifier CONFIRMED: the r2/r3 two-stage clamp's
  merge-site constant bound silently destroyed a legitimate persisted 7
  (down-only clampTier never restores), contradicting the spec's own
  modded-7-tier promise. Folded with a THIRD resolution simpler than
  either offered: the merge site drops its upper bound entirely (validity
  floor only), making the ready transition the SOLE upper clamp — loss-
  free by construction, one less mechanism. Grounding: nothing consumes
  the count pre-ready (verified: no solve without a catalog, no tier strip
  on pre-ready screens; partialize is pull-based per the same review's
  part-(b) clearance). New loss-free reboot pin + junk floor pin added.
  Also recorded clean from the same review: the ready-site enumeration is
  COMPLETE (:1441,:1463,:1521,:1588), no same-set ordering hazard, and the
  D4 enumeration fold verified correct (its own prior objection
  withdrawn). r4 goes to both correctness reviewers.
- **r4 → r5** (design review r4: code-reviewer APPROVED_WITH_NITS — the
  junk-floor convention divergence, folded; adversarial NEEDS_REWORK — 2
  IMPORTANT + 1 NIT, all folded): (1) the "unobservable today" claim was
  FALSE — store.test.ts:850-860 and :862-874 pin the merge behaviour
  (sixth sweep-class instance); merge semantics now enumerate
  missing→fallback-full (test unchanged) vs present-integer→kept-as-is
  (test rewritten to deferred semantics with a driven ready transition);
  (2) clamp placement pinned to BEFORE THE SOLVE — composed into
  mapSelection at :1521/:1588, plain pre-clamp before :1483 for
  :1441/:1463; (3) the r3 history's identity-mapper mischaracterization
  corrected. Recorded clean by the same review: the pre-ready-consumer
  premise (App early-returns, pull-based partialize, no junk-999 path
  into storage) and the full D4 enumeration. r5 goes to both correctness
  reviewers.
- **r5 → r6** (design review r5: code-reviewer APPROVED_WITH_NITS — 2
  wording NITs; adversarial NEEDS_REWORK — 1 IMPORTANT, verified against
  live merge code before folding): (1) IMPORTANT + the code-reviewer's
  first NIT, same lines — the junk-pin note's premise "a genuinely
  missing field never reaches the merge" was FALSE (`tiers?.belt` yields
  `undefined` for missing-field AND corrupt-JSON rows, `store.ts:2384-2387`;
  `store.test.ts:850-860` rides that path), and its "must not carry
  missing→max" instruction, applied literally, would route `undefined → 1`
  and fail that pinned test — the note now states the exact three-branch
  sanitizer with `undefined → max` RETAINED and fail-minimal scoped to
  present-but-corrupt only; (2) second code-reviewer NIT — "plus the
  global field" was redundant; the placement pin now says the top-level
  mirror is propagated by `mirrorActive` (`store.ts:595-597`), not
  separately clamped; (3) the adversarial's non-gating documentation gap —
  the transitive-safety argument for the plan-stamping paths
  (`rebuildFromPlan`/`applyProposalToSlice` copy live, ready-clamped
  values) — written in. Cleared by the same round: trichotomy exhaustive
  over the real value space (string "6" → floor; array/null container →
  `undefined` → full), both test citations, all four placement sites, the
  history correction, the sliceTier totality citation. r6 goes to both
  correctness reviewers.
- **r6 → r7** (design review r6: code-reviewer APPROVED; adversarial
  NEEDS_REWORK — 1 IMPORTANT, a direct factual divergence from the
  code-reviewer, resolved by reading zustand source myself before
  folding): the r6 note claimed the corrupt-JSON pin
  `store.test.ts:850-860` "rides exactly" the `tiers?.belt === undefined`
  sanitizer path. FALSE — verified in
  `node_modules/zustand/esm/middleware.mjs`: `JSON.parse` throws inside
  `createJSONStorage.getItem`, `toThenable` catches and short-circuits
  every subsequent `.then` to the terminal `.catch`, so `options.merge`
  is NEVER called for corrupt JSON; the test passes via the untouched
  seed default (`store.ts:429-431`) — the same no-merge path as a
  missing row. The sanitizer's `undefined → max` branch is exercised by
  the missing-FIELD case (valid JSON, absent field). Both the trichotomy
  bucket 1 and the junk-pin note now state the correct path; the
  three-branch disposition itself is UNCHANGED (the same round verified
  an implementer following it keeps :850-860 and :862-874-as-rewritten
  green). Cleared by the same round: the mirror clarification (no ready
  site clamps while skipping deriveAllStages) and all four
  transitive-safety citations. r7 goes to both correctness reviewers.
- **r7 → r8** (design review r7: code-reviewer APPROVED — traced the
  toThenable throw path clause-by-clause, confirmed both corrections and
  that the store registers no onRehydrateStorage so the error path is
  inert; adversarial NEEDS_REWORK — 1 IMPORTANT, verified and folded):
  the reworded bucket 1 reassigned `undefined → max` coverage to the
  missing-FIELD case, but NO test exercises that case — every persistence
  fixture supplies both fields, so a sanitizer routing `undefined → 1`
  would pass every enumerated test while silently regressing full-unlock
  to 1 (the fixture-degeneracy class). Folded: a new enumerated
  missing-field pin (valid JSON, `belt` absent → 6 via the merge,
  `pipe: 1` kept) — the symmetric twin of the junk pin under the same
  malformed-persisted-row threat model. Cleared by the same round: both
  path-precision sentences exact against zustand mechanics (including
  set() never firing and the null/array-container prose). r8 goes to
  both correctness reviewers.
