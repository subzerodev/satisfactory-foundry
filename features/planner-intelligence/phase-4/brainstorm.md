# Stage 8 / Phase 4 — alternate-recipe comparison across a chain (ticket #40) — brainstorm v3 (FROZEN)

**Goal.** For an item with alternate recipes, compare the alternatives on
what a builder weighs — total power, machine count, raw-resource draw —
across the AFFECTED SUBTREE (a swap changes upstream inputs), as
comparable rows (the trainOptions precedent: options, no "best"), with an
apply that swaps the recipe through the normal editable graph.

## Already settled — do NOT re-litigate

- Epic #36 P3 decision binds hard: **P4 must not fork a second
  traversal** — the comparison reuses proposeChain's machinery.
- The ticket pins: subtree re-derivation (not single-stage deltas);
  metrics = power / machines / raw draw, exact math; comparable rows,
  no ranking; apply through the ordinary graph.
- P3 shapes are frozen: proposeChain's selection policy (non-alternate,
  converter/packager-excluded, ascending-id), ChainProposal (stages/
  links/rawInputs/byproducts), applyChainProposal additive-only,
  proposals session-ephemeral.
- P1 decision: named-stage selection writes go through
  applyStageSelection; the active setters are its activeStageId case.
- Power display discipline (S6): exact Fractions to the labeled float
  boundary; variable-power machines carry the varies suffix; the ≈
  formatter for non-terminating rates.
- All-Claude roster; full gate; browser walk.

## Axis 1 — the engine: proposeChain grows ONE seam, a recipe override

**Pick: `proposeChain` gains an optional
`overrides?: ReadonlyMap<string, string>` (itemId → recipeId), consulted
BEFORE the default policy in producer selection: if the map names a
recipe for X and that recipe primary-produces X, it IS the producer
(bypassing the isAlternate/exclusion filters — an override is the user's
explicit opt-in); the cycle/self-consume guard still applies (an
overridden recipe that cycles demotes to RAW, same silent semantics).
Everything downstream of the override resolves by the unchanged default
policy.**

- This is the epic-mandated reuse: one traversal, one demand model, one
  guard — the comparison is just N runs of the SAME builder with N
  different overrides. No comparison-specific solver.
- Map over a single {itemId, recipeId} pair (simplify fold, v3 — the
  reasoning recorded): the consult is one `overrides.get(itemId)` either
  way, so the map costs nothing, while a pair would hard-code the
  single-override assumption into the ENGINE seam — the "only one
  override" fact belongs to the caller (the adapter passes {X:
  candidate}); the empty-map default also reads cleanest for the
  byte-identical guarantee.
- Absent-overrides ≡ today byte-identically (the P3 suite pins it — the
  parameter defaults to an empty map; every existing call site
  unchanged).
- Candidates for item X = ALL recipes with `primaryOutputId === X` and
  machine ∉ {converter, packager} — the isAlternate filter is LIFTED for
  candidacy (that is the entire point of this phase) but the
  converter/packager exclusion stands (resource conversion and
  packaging are not production alternatives; recorded P3 rationale).
  Ordered ascending recipe id with the DEFAULT (non-alternate) candidate
  listed first (it is the baseline row).

## Axis 2 — what a row measures: the candidate's full subtree at the compared demand

**Pick: for the compared item X at demand rate R, each candidate row runs
`proposeChain(X, R, recipes, excluded, overrides={X: candidate})` and
reports metrics computed FROM the returned proposal: machines =
Σ machineCount; power = Σ machineCount × the stage machine's `power.mw`
(exact; a row containing any variable-power machine carries the
established varies/≈ labeling); raw draw = the proposal's own
`rawInputs` (already aggregated exact totals). Computed in the UI
adapter (it has the catalog for machine power; core stays
power-agnostic — BuilderRecipe is untouched).**

- The subtree definition falls out for free: the proposal IS the
  affected subtree (everything needed to make X at R via the candidate,
  down to raw). No delta arithmetic, no whole-chain diffing — the rows
  are absolute costs of the same job, directly comparable (the
  trainOptions shape: same rate, different configurations).
- R = the compared stage's CURRENT primary-output rate — the PRIMARY
  output LANE's totalOutput (per-lane, no scalar; the exact lookup in
  Axis 4). "To make what this stage currently makes via candidate C,
  the whole job costs …". Unsolved stage ⇒ no comparison (the
  solved-only discipline everywhere else).
- Byproducts are NOT a metric column (they're a bonus, not a cost);
  the row notes them compactly when present (honesty, not ranking).

## Axis 3 — the surface: a compare block on the ACTIVE stage

**Pick: a new thin `AltCompare` block rendered with the active stage's
controls (near the Recipe select), visible only when the active stage is
SOLVED and its recipe's primary item has ≥2 candidates. A table in the
trainOptions idiom: one row per candidate — recipe name, machines,
power, raw draw (compact "Iron Ore 780/min · Coal 240/min" text) — the
current recipe's row marked as current; each other row carries an Apply
button.**

- Why per-stage and not a chain-wide report: the decision a player makes
  is "which recipe for THIS item"; the chain-wide report is P-future
  scope creep with no recorded ask. The active stage is where the recipe
  select already lives — the comparison is its natural neighbor.
- The rows derive on render from the store's catalog + the active
  stage's solve (pure helper → rows; the component stays thin,
  node-testable via exported helpers — the applyBlockFor precedent).
  Catalog-sized proposeChain runs × ~a few candidates are cheap and
  synchronous (P3's measured posture).

## Axis 4 — apply semantics: swap THIS stage's recipe, resize its count, nothing else

**Pick: Apply on a row goes through ONE new small exposed store action —
`applyRecipeSwap(stageId, recipeId, machineCount)` — whose body is a
single applyStageSelection write of the FULL composed selection:
`{ ...selection, recipeId, machineCount, overrides: { feeds: {},
outputs: {} } }` (r1 fold — applyStageSelection takes a whole
Selection; the overrides clear IS part of the payload, matching
selectRecipe's recipe-change posture exactly). The action is new
because NO existing action writes recipeId + machineCount together
(r1 Major: selectRecipe preserves machineCount; the count setters
write count only; applyStageSelection itself is an internal helper the
UI cannot call) — and the swap must be ATOMIC: a two-write
selectRecipe-then-setMachineCount sequence would derive an
intermediate wrong-sized state. The P1 setStageMachineCount precedent
is the shape (a thin exposed stageId case over applyStageSelection).
The upstream chain is NOT rebuilt, links are NOT touched:
the reconciliation immediately shows which feeds went short/surplus/
dangling-irrelevant, and the S8P1 apply button + the P3 builder are the
user's repair tools. Recorded, not a gap: a full subtree rebuild-on-swap
would silently replace user-built stages — exactly what the P3
append-only decision refused.**

- machineCount = ceilDiv(R, candidate's primary perMinute) — the stage
  keeps producing (at least) what it produced, the comparison's premise.
  Ceil per the arc's integer rule. R is the PRIMARY OUTPUT LANE's
  totalOutput — `solve.result.outputs` is per-lane
  (OutputLaneResult.totalOutput, manifold.ts:69); there is no scalar
  (r1 fold): R = outputs.find(o => o.itemId === primaryOutputId)
  .totalOutput.
- Works identically on P3-proposed and hand-built stages (they are
  indistinguishable by design — P3's "ordinary stages" invariant is
  what makes this ONE code path).
- Input overrides (feeds/outputs) are per-recipe user data referencing
  the OLD recipe's items: cleared on swap — SETTLED at r1 (both
  reviewers read selectRecipe, store.ts:1105-1115: clears overrides,
  preserves clock; the payload above encodes it — no drift-hunt item
  remains).

## Axis 5 — non-goals

- No optimization/ranking, no "best" badge, no sort-by-metric.
- No chain-wide multi-swap report; no what-if pinning; no persistence
  of comparisons (session-ephemeral, the P3 posture).
- No converter/packager candidacy (recorded above).
- No subtree auto-rebuild on apply (recorded above).
- No sink/byproduct valuation.
- No store surface beyond the ONE new thin applyRecipeSwap action (r1
  correction — v1 claimed zero new actions, which was inconsistent
  with the atomic-swap requirement) and no core changes beyond the ONE
  override seam.

## Test plan sketch

Core (the seam): overrides select the named recipe (alternate included)
for the target item; deeper items resolve by default policy; an
override naming a non-primary/unknown recipe is IGNORED (falls back to
default — validate-and-fall-back keeps the solver total); the guard
still demotes a cycling override; absent-overrides byte-identical
(existing 15 rows re-run unmodified). Adapter/metrics: machines/power
sums exact on a synthetic proposal (variable-power flag propagates);
raw draw passes rawInputs through; candidate enumeration (default
first, alternates ascending, converter/packager never listed; <2
candidates ⇒ no rows). Bundled-catalog row: an item with real
alternates (Iron Ingot: the default + its four bundled alternates —
Iron Alloy, Basic, Leached, Pure Iron; the enumeration surfaces all
four — r3 fix, the r2 fold had not landed on this line) yields
plausible distinct rows. Apply helper: the full composed-Selection
payload from a row (ceil at the compared rate, overrides cleared); the
swap through the new applyRecipeSwap action re-derives.
Bidirectionality log per the R2 rule.
Browser walk: compare Iron Ingot alternates on a live chain, apply one,
watch the stage re-derive + findings surface, undo by re-applying the
default row.

## Assumptions ledger

1. proposeChain's selection is a single function (`selectProducer`,
   chain-builder.ts:90-106, r1 cite fix) called at one site (:175) —
   the override consult wraps exactly that site; the guard (:176-181)
   applies to the chosen recipe regardless of how it was chosen
   (r1-verified).
2. CatalogMachine.power carries `mw` exact + `variable` flag +
   `minMw/maxMw` (types.ts:39-55); the adapter can sum count × mw and
   propagate the variable flag per the S6 display discipline
   (src/ui/advice.ts's stagePowerText precedent, :87-112 — r1 cite
   fix).
3. applyStageSelection(slice, stageId, next) exists as the ONE
   named-stage re-derive helper (store.ts:521; the active setters
   delegate, :535-539) — but it is INTERNAL, not an exposed action
   (r1 Major): the apply needs the new thin applyRecipeSwap action
   over it (Axis 4).
4. The compared stage's current output rate is the PRIMARY output
   lane's totalOutput (per-lane OutputLaneResult, manifold.ts:69 —
   r1 precision fix; no scalar field exists; the lane lookup is by
   primaryOutputId ≡ outputs[0]).
5. The recipe-change precedent is settled (r1 — both reviewers read
   selectRecipe, store.ts:1105-1115): it clears overrides and
   preserves machineCount/clock. applyRecipeSwap follows: overrides
   cleared in the same write, clock preserved, machineCount set to the
   ceil'd resize (the one deliberate divergence — the swap's premise
   is same-output).
6. Candidate counts are small (bundled catalog: a handful of alternates
   per common item) — N proposeChain runs per render are cheap
   (P3's synchronous posture extends).

## Revision history

- v1 (2026-08-05): initial, grounded in this session's reads of
  chain-builder.ts (selectProducer + the single call site, guard,
  ChainProposal), types.ts MachinePower, advice.ts power discipline,
  store.ts applyStageSelection, and the P3/P1/epic decision records.
- v2 (2026-08-05): dual-review r1 — [code-reviewer]
  APPROVED_WITH_NITS (4); [adversarial-reviewer] NEEDS_REWORK (1 Major
  + 1 Minor + 2 Nits). All folded:
  - The Major: v1's "one applyStageSelection write" + "no new store
    actions" could not both be true (applyStageSelection is internal;
    no exposed action writes recipeId + machineCount together;
    selectRecipe preserves count). RESOLVED: one new thin
    applyRecipeSwap(stageId, recipeId, machineCount) action — atomic
    single write of the full composed selection (two sequential writes
    would derive an intermediate wrong-sized state); Axis 5's non-goal
    restated honestly.
  - The payload now spells the full Selection incl. the overrides
    clear (selectRecipe's posture, verified by both reviewers).
  - R made precise: the PRIMARY output lane's totalOutput (per-lane
    OutputLaneResult; no scalar exists).
  - The test example's alternates named; citation ranges tightened
    (selectProducer :90-106; stagePowerText :87-112).
  Verified clean by the reviewers: the override seam's guard-preserving
  layering (mechanism/policy split), the affected-subtree-=-upstream-
  closure reading, the power-sum discipline, the byte-identical P3
  suite (15 rows, 4-arg call sites), Iron Ingot's real ≥2 candidacy.
- v2-r2 (2026-08-05): scoped re-check — [code-reviewer] NEEDS_REWORK
  (1 IMPORTANT + 1 NIT); [adversarial-reviewer] APPROVED_WITH_NITS
  (1 — the SAME finding; it also verified folds 1-3 hold and the
  residue sweep clean). The
  IMPORTANT was a verify-before-relay failure in the v2 fold itself:
  r1's "no Iron Alloy alternate exists" claim was FALSE
  (Recipe_Alternate_IngotIron_C "Alternate: Iron Alloy Ingot" is in the
  bundled catalog, Foundry-produced, a VALID candidate under this
  design's own rule — team-lead re-verified against en-US.json before
  this fold). The example now names all four Iron Ingot alternates
  (Iron Alloy, Basic, Leached, Pure Iron); the false rationale removed;
  the MachinePower cite path qualified (src/data/types.ts). Folds 1-3
  (applyRecipeSwap atomicity, R per-lane precision, Assumption #5
  settled) verified CLEAN by the r2 conformance pass.
- v2-r3 (2026-08-05): scoped re-check of the example fold —
  [adversarial-reviewer] APPROVED (exhaustive catalog sweep: exactly
  five producers of Iron Ingot — the default + the four named
  alternates, all primary, none converter/packager; no false claim
  found); [code-reviewer] NEEDS_REWORK (1 IMPORTANT, correct: the r2
  example rewrite had NOT landed — the replace missed and :162-163
  still carried the two-alternate "r1 fix" text, contradicting the
  v2-r2 history). Folded: the example now names all four alternates
  in the body (matching the history); the apply-helper sentence
  updated to the composed-Selection payload + applyRecipeSwap naming.
  Correctness CONVERGED (the surviving defect was the un-landed edit
  itself, now landed and verified against the adversarial sweep's
  ground truth).
- v3 (2026-08-05): simplify pass (one-shot, post-convergence)
  APPROVED_WITH_NITS (3, all affirmations-with-recording). Dispositions:
  Nit 1 FOLDED (the map-over-pair defense now recorded in Axis 1);
  Nit 2 recorded-no-change (stageId parameter affirmed — the
  setStageMachineCount precedent's named-stage-without-cursor-steal
  reason applies verbatim to a table-row Apply); Nit 3 recorded-no-
  change (three cost columns + byproduct-as-note affirmed; a fourth
  column would falsely imply byproducts rank against costs). Test plan
  affirmed clean (no double-pins, no scaffolding). FROZEN.
