# S20 P1 — Propose customization core (brainstorm + spec)

**Ticket:** #100 · **Epic:** #98 · **Milestone:** 91 · **Status:** v7 FROZEN 2026-08-07
(six correctness rounds r1-r6 — traps → honesty → coherence — then
simplify; all reviews degraded: same-vendor, all-Claude roster)

## Purpose

The proposal becomes shapeable before Apply: pick the recipe per stage
(including alternates), mark items as externally supplied (treat-as-raw),
and edit which machines the proposer may use. Every change re-proposes
deterministically; Apply is unchanged.

## Already settled — do NOT re-litigate

- Epic #98: P1 = these three controls; clock/byproducts are P2;
  persistence of choices is P3 (P1 state is per-session, component-local).
- The ephemeral-preview posture (frozen Stage 8 Axis 6, reaffirmed at P0):
  no store surface for the builder's inputs; the store only gains nothing
  in P1.
- Core override semantics (Stage 8 P4, frozen): a validated override
  BYPASSES the isAlternate + machine-exclusion filters (explicit opt-in);
  an invalid override falls back silently (totality).
- P0's shipped preview (tiers, feeds, chips, cost sheet) is the surface
  these controls hang on; the "N recipes" chip is the picker affordance.

## Ground truth (verified this session)

- `src/core/chain-builder.ts` — `proposeChain(targetItemId, rate, recipes,
  excludedMachineIds, overrides = new Map())` (:170-176). selectProducer
  consults overrides first (validate-and-fall-back), then the default
  policy (non-alternate, non-excluded, ascending id). The DFS cycle guard
  demotes self/path-revisiting producers to raw.
- `src/ui/chain-builder-adapter.ts`:
  - `proposeChainForCatalog(catalog, targetItemId, rate)` (:42-53) passes
    the module constant `EXCLUDED_MACHINE_IDS` and NO overrides.
  - `candidateRecipesFor(catalog, itemId)` (:288-303) filters on the
    MODULE-CONSTANT exclusion set internally (:292) — P1 must
    parameterize this or the picker's candidate list will ignore the
    user's edited exclusions.
  - `PreviewRow.candidateCount` + the "N recipes" chip shipped in P0.
- `src/ui/ChainBuilder.tsx` — component-local `preview` state; Propose
  builds it, Apply clears it; `parseRateText` at propose time.
- Raw leaves today: an item with NO eligible producer lands in
  `rawInputs` (selectProducer → null). There is no user-forced-raw hook.

## Decision axes

### Axis 1 — Core: treat-as-raw

Options: (a) filter recipes in the adapter before calling proposeChain
(remove all producers of raw-marked items); (b) a new core param
`rawItemIds: ReadonlySet<string> = new Set()` consulted before
selectProducer.

**Pick (b).** (a) is O(catalog) re-filtering per call and misrepresents
intent (the item is not producerless — the USER stopped the chain);
(b) is one guard in the closure walk (`rawItemIds.has(itemId)` → plan
with `recipe: null`, demand aggregates into rawInputs exactly like a
natural leaf), default-empty so every existing call site and test is
untouched. **The target is never forced raw**: the core ignores
`targetItemId ∈ rawItemIds` (a chain that produces nothing is not a
chain; the guard keeps the function total and the UI honest). Overrides
lose to raw for the same item (raw is the stronger, later user intent —
precedence pinned: raw > override > default policy).

### Axis 2 — Adapter surface

`proposeChainForCatalog` gains an optional options argument
`{ overrides?, rawItemIds?, excludedMachineIds? }` (defaults: empty map,
empty set, `EXCLUDED_MACHINE_IDS`) — existing callers unchanged.
`candidateRecipesFor` gains an optional `excludedMachineIds` parameter
(default: the module constant — AltCompare and P0 callers unchanged);
the picker passes the CURRENT exclusion set so candidates match what
Propose would actually use. **`toProposalPreview` gains an optional options argument
`{ excludedMachineIds?, rawItemIds? }` (defaults: module constant, empty
set — P0 callers/tests unchanged): `candidateCount` computes with the
CURRENT exclusions (design r1: otherwise chip and picker disagree), and
`rawItemIds` feeds the cause annotator (design r2: without it the
"forced" class is UNCOMPUTABLE — the core emits every raw leaf as a bare
{itemId, rate} with no marker, so cause is reconstructed adapter-side).
Cause precedence PINNED (design r2): evaluated **forced first** —
forced > constrained > natural — mirroring the core's raw > override >
default; a forced item that also has no eligible producer is "forced"
(the strip carries its recovery ×), never "constrained". Forced raws are
EXCLUDED from the natural/constrained display lines (the strip is their
sole surface — no double display).**
New: `effectiveDefaultRecipe(catalog, itemId, exclusions)` (the picker's
clear rule, Axis 4) and `producerRecipesFor(catalog, itemId, exclusions)`
(the constrained-row recovery list — all primary producers on
non-excluded machines, no ≥2 gate; Axis 4). New pure helper
`excludableMachines(catalog): { machineId, displayName }[]` — machines
referenced by ≥1 recipe's machineId, name-resolved, sorted by name (the
exclusions panel's list; machines no recipe uses are noise).
**Complete adapter surface (r5 — the earlier "no other surface changes"
closing was false after the fold rounds): proposeChainForCatalog options
arg; candidateRecipesFor exclusions param; toProposalPreview options
arg { excludedMachineIds?, rawItemIds? }; excludableMachines;
effectiveDefaultRecipe; producerRecipesFor; pickerOptionsFor; the
rawInputs cause annotation. Nothing else.**

### Axis 3 — UI state + re-propose semantics

Three component-local pieces of state in ChainBuilder: `overrides:
Map<string,string>`, `rawItemIds: Set<string>`, `excludedMachineIds:
Set<string>` (seeded from `EXCLUDED_MACHINE_IDS`). Any control change
while a preview exists → synchronous re-propose with the current
target/rate/choices (the same call Propose makes — deterministic, no
debounce needed; the solver is a catalog-sized DFS already run per
keystroke-free click). Propose itself uses the current choices too.
**Stale entries are kept, not pruned**: an override or raw mark whose
item has left the closure is inert by the core's validate-and-ignore
totality; pruning would add bookkeeping for zero behavioral gain, and a
choice "comes back" correctly if the item re-enters. Discard clears the
preview but KEEPS the choices (they are the user's session intent);
Apply clears the preview per the frozen posture and also keeps choices.

### Axis 4 — Controls UI (drawing idiom, minimal)

- **Recipe picker:** the P0 "N recipes" chip becomes a `<button>`;
  clicking toggles an inline row-scoped `<select>` whose options come
  from `pickerOptionsFor(catalog, itemId, currentExclusions,
  currentRecipeId)` (r5 — the select's SOLE option source; labels
  applied on that unified list: "(alt)" on alternates, "(default)" on
  the effective default when non-null, "(machine excluded)" on the
  force-included current; **labels COMPOSE (r6)** — an excluded-machine
  alternate override reads "(alt) (machine excluded)"; the other two
  pairings are impossible by construction), current selection = the
  stage's recipeId. **Override
  set/clear rule (REWRITTEN at design r1 — the v1 "first entry is the
  default" rule could silently DELETE a stage):** the adapter gains
  `effectiveDefaultRecipe(catalog, itemId, exclusions):
  CatalogRecipe | null` — EXACTLY selectProducer's default policy
  (non-alternate, non-excluded, ascending id; alternates NEVER default).
  Choosing a recipe SETS the override UNLESS the chosen id equals the
  effective default's id, in which case the override is CLEARED (the map
  holds only true deviations). If the effective default is null under
  current exclusions, EVERY choice is an explicit override — nothing
  clears. This guarantees clearing an override can never change the
  proposal away from what the picker shows: the "(default)" tag in the
  list marks the effective default only (absent when null).
  **Truthful-selection rule (design r2, REBUILT at r4 — the gated list
  dropped a lone eligible candidate and the chip-gated affordance left
  an excluded override unreachable):** the option list is built by the
  pure adapter helper `pickerOptionsFor(catalog, itemId, exclusions,
  currentRecipeId)` = `producerRecipesFor(catalog, itemId, exclusions)`
  (the UNGATED eligible list — all primary producers on non-excluded
  machines, alternates included; ordering: the effective default first
  WHEN NON-NULL, else plain ascending id — the null-default case
  degenerates cleanly, r5) PLUS, when `currentRecipeId` names a catalog recipe that is
  absent from that list, the current recipe force-included and labeled
  "(machine excluded)". **Totality (r4):** `currentRecipeId` undefined,
  or not a catalog recipe id → the bare ungated eligible list, no
  force-include, no fabricated entry. The select's value always has a
  matching, honestly-labeled option. **Affordance reachability rule
  (r4):** the row's picker button renders iff
  `pickerOptionsFor(...).length ≥ 2 OR the current recipe is
  force-included` — never gated on the chip count — so an excluded
  override is ALWAYS visible and fixable from its stage row. **Chip
  semantics unchanged from P0** ("N recipes" when candidateCount ≥ 2);
  when the affordance must render without a ≥2 chip, it renders as a
  "machine excluded" chip in the notice styling. The chip is a COUNT
  display; the picker's reachability and contents are governed by
  pickerOptionsFor alone (r4 kills the chip==picker coupling for good). One open picker at a time (component-local
  `pickerItemId: string | null`).
- **Treat-as-raw:** a small "RAW" toggle button per row (except the T0
  target row); active state marks the item raw → re-propose. A raw-marked
  item's row disappears from stages (it moves to the RAW line) — the
  affordance to UNDO lives in a compact "RAW OVERRIDES: item ×, item ×"
  strip under the cost sheet listing user-forced raws with a remove ×
  each (visible only when nonempty; this is also where a stale raw mark
  can be removed).
- **Constrained-raw honesty (NEW at design r1 — closes the silent-trap
  findings):** the adapter annotates each rawInputs row with
  `cause: "natural" | "forced" | "constrained"` — "forced" =
  user-raw-marked; "constrained" = the catalog HAS ≥1 producer recipe
  for the item but none is eligible under the current exclusions +
  default policy (i.e. the item became raw because of exclusions /
  alternate-only availability); "natural" otherwise. The RAW line
  renders natural raws as today; constrained raws render on their OWN
  line "RAW (no eligible producer): Item N/min …" in the notice styling,
  naming the cause; forced raws are covered by the RAW OVERRIDES strip
  (and never appear on these lines — precedence above). **Constrained
  recovery (design r2 — the exclusions panel alone cannot recover the
  alternate-only sub-case):** each constrained row carries an inline
  "pick recipe" affordance listing `producerRecipesFor(catalog, itemId,
  currentExclusions)` — a NEW helper returning ALL primary-producer
  recipes on non-excluded machines (no ≥2 gate, alternates included) —
  choosing one sets an override → the item returns as a stage. When that
  list is empty (every producer's machine excluded), the row's text
  points at the exclusions panel instead — the one case where exclusions
  ARE the recovery. Acknowledged limitation (r3): a raw produced by the
  core's cycle-guard/malformed-primary backstops classifies "natural"
  (the adapter-side reconstruction cannot see solver demotions) — accepted:
  the bundled catalog is acyclic with converter/packager excluded and the
  guard is a pinned backstop, not a common path. Every USER-DRIVEN
  collapse class is visible, named, and has a WORKING recovery surface. There is NO error path — over-exclusion
  degrades to constrained raws, honestly labeled (the v1 walk copy
  claiming the chain "honestly errors" was wrong and is retracted).
- **Machine exclusions:** a `<details>` disclosure "MACHINE EXCLUSIONS
  (n)" under the builder controls; checkbox list from
  `excludableMachines`; checked = excluded; seeded from the constant;
  changes re-propose. No persistence (P3).

## Spec (file-by-file)

1. **`src/core/chain-builder.ts`** — `rawItemIds: ReadonlySet<string> =
   new Set()` 6th param; guard in the closure walk before producer
   selection (`itemId !== targetItemId && rawItemIds.has(itemId)` →
   raw leaf); precedence raw > override; doc comment states the pinned
   precedence + target immunity.
2. **`src/ui/chain-builder-adapter.ts`** — `proposeChainForCatalog`
   options arg; `candidateRecipesFor` optional exclusions param;
   `excludableMachines(catalog)`; the complete surface list lives in Axis 2 (r5).
3. **`src/ui/ChainBuilder.tsx`** — the three state pieces + pickerItemId;
   re-propose-on-change; picker select; RAW toggles + the RAW OVERRIDES
   strip; the exclusions disclosure. Apply/Discard semantics per Axis 3.
4. **`src/ui/app.css`** — `.chain-builder-picker`, `.chain-builder-rawtoggle`,
   `.chain-builder-rawstrip`, `.chain-builder-exclusions` from existing
   tokens, both themes.
5. **Tests** (core + adapter, node env):
   - core: rawItemIds forces a mid-chain item raw (its subtree demand
     lands in rawInputs, subtree stages vanish); target immunity; raw >
     override precedence; default-empty = byte-identical proposals
     (regression).
   - adapter: options plumbing end-to-end (an override + a raw + an
     exclusion each change the proposal deterministically);
     candidateRecipesFor with a custom exclusion set (an excluded
     machine's alternate drops out; default arg = old behavior);
     excludableMachines (only recipe-referenced machines, sorted, named);
     effectiveDefaultRecipe (matches selectProducer's pick incl. the
     null case under exclusions); toProposalPreview candidateCount with
     current exclusions (chip == candidateRecipesFor length, P0
     semantics unchanged); pickerOptionsFor as a pure TOTAL helper (r4):
     builds on the UNGATED producerRecipesFor (a lone eligible candidate
     IS listed); excluded-machine override force-included + labeled;
     in-list current adds nothing; undefined currentRecipeId → bare
     list; catalog-absent id → bare list; REACHABILITY pin — at
     eligible 0 or 1 with an excluded-machine override the affordance
     predicate (length ≥ 2 or force-included) is TRUE (the r4 dead-end
     cannot recur); rawInputs cause
     annotation (natural vs forced vs constrained; the OVERLAP case —
     forced item with no eligible producer — reports "forced", design
     r2; forced items excluded from natural/constrained rows);
     producerRecipesFor (no ≥2 gate, alternate-only item returns its
     alternates, fully-excluded item returns []).
   - **Bidirectionality log** `features/propose-grows-up/`
     `p1-r2-verification.log` — per new production behavior.
6. **Docs at merge (team lead):** FEATURE.md, changelog, completion note.

## Explicitly out of scope

Clock/byproduct routing (P2); persistence of overrides/raws/exclusions
(P3); any store surface; changing Apply's shape; AltCompare changes
beyond the default-arg compatibility.

## Test + verification plan

- Unit tests per spec item 5 + bidirectionality log; `npm test` +
  `npm run check` green in worktree AND trunk after worktree removal.
- **Walk:** propose Computer 10/min → open a picker on a "N recipes"
  chip, choose an alternate → chain re-proposes (machine counts/power
  change, cost sheet updates); choose the default back → override
  cleared. Mark a mid-tier item (e.g. Circuit Board) RAW → its subtree
  vanishes, RAW line gains it, RAW OVERRIDES strip appears; remove via ×
  → subtree returns. Exclude a machine (e.g. Assembler) in the
  disclosure → re-propose reflects it; an unbuildable item degrades to a
  labeled "RAW (no eligible producer)" row with its inline pick-recipe
  affordance (no error path — v2 retraction). Exclusion-while-overridden
  case (v2, restored at v5 — the original edit missed): override an item
  to an alternate, exclude the default's machine, reopen the picker and
  re-choose the SAME alternate → the override is KEPT (effective default
  is null — nothing clears) and the stage survives. Excluded-override
  visibility (r4): with the override's OWN machine excluded and ≤1 other
  eligible producer, the row still shows the "machine excluded" chip and
  the picker opens with the labeled current entry. Un-force a
  fully-excluded raw via the strip × → it resurfaces as "constrained"
  with its recovery surface — here the exclusions-panel pointer, since
  the inline list is empty (v3, restored at v5; phrasing r5). Both themes.
  Verify Apply applies the CUSTOMIZED chain (canvas machines match the
  picked recipes).

## Assumptions ledger

- The core's override-validation totality makes stale entries inert —
  grounded: selectProducer's validate-and-fall-back (read this session);
  raw marks are set-membership checks, absent items never consulted.
- Synchronous re-propose per click is affordable — grounded: Propose
  already runs the same DFS synchronously on click (Stage 8 P3 frozen
  design called it "a synchronous catalog-sized DFS").
- candidateRecipesFor's default-arg change is invisible to AltCompare —
  grounded: default = the module constant it uses today; its tests pin
  behavior.
- A chain rendered unbuildable by exclusions degrades via the EXISTING
  no-producer path (items become raw leaves) — grounded: selectProducer
  returns null → raw; no new failure mode is introduced.

## Revision history

- v1 (2026-08-06): initial merged brainstorm+spec.
- v2 (2026-08-06): design r1 fold. code-reviewer NEEDS_REWORK (3
  IMPORTANT + 1 NIT), adversarial NEEDS_REWORK (2 HIGH + 1 MEDIUM +
  1 LOW) — both degraded: same-vendor. Axis-1 core mechanics (raw param,
  precedence, target immunity) survived both attacks unchanged.
  - **FOLDED (HIGH, adv):** override-clear rule rewritten around
    `effectiveDefaultRecipe` — clearing can never change the proposal
    away from the shown selection; null-default ⇒ nothing clears. The
    v1 first-list-entry "default" could silently delete a stage.
  - **FOLDED (HIGH adv + IMPORTANT cr):** constrained-raw cause
    annotation + dedicated labeled RAW line — every collapse class
    (natural/forced/constrained) visible, named, recoverable.
  - **FOLDED (MEDIUM adv + IMPORTANT cr):** walk copy retracted the
    nonexistent "honestly errors" claim; degradation is labeled
    constrained raws.
  - **FOLDED (LOW adv + IMPORTANT cr):** toProposalPreview
    parameterized so the chip count always equals the picker list.
- v3 (2026-08-06): design r2 fold (both NEEDS_REWORK on the v2-added
  surfaces; the effectiveDefaultRecipe clear rule survived the re-run of
  the r1 trap unchanged).
  - **FOLDED (IMPORTANT adv):** rawItemIds plumbed into toProposalPreview
    (options arg) — "forced" computable, no double display.
  - **FOLDED (IMPORTANT cr + NIT adv):** cause precedence pinned
    forced > constrained > natural; overlap test added.
  - **FOLDED (IMPORTANT both):** truthful-selection rule — the picker
    force-includes the current recipe labeled "(machine excluded)".
  - **FOLDED (IMPORTANT cr):** constrained-row inline "pick recipe"
    affordance via new producerRecipesFor (no ≥2 gate); exclusions-panel
    pointer only when that list is empty.
- v4 (2026-08-06): design r3 fold (cr APPROVED_WITH_NITS 2, adv
  NEEDS_REWORK 1 HIGH + 1 NIT).
  - **FOLDED (HIGH adv):** the r2 force-include contradicted the r1
    chip==picker invariant — REDEFINED: chip = eligible candidates;
    picker = eligible + (current-excluded ? 1 : 0), via the new pure
    helper pickerOptionsFor; pinned test reworded accordingly.
  - **FOLDED (NIT cr):** pickerOptionsFor is a pure adapter helper with
    its own tests (the force-include rule is no longer untested UI).
  - **FOLDED (NIT cr):** cycle-demoted raws → "natural" acknowledged as
    an accepted limitation (acyclic catalog; backstop path).
  - **FOLDED (NIT adv):** un-force → constrained transition added to the
    walk as an explicit criterion.
- v5 (2026-08-06): design r4 fold (both NEEDS_REWORK — the r3
  redefinition traded the count contradiction for a reachability
  dead-end).
  - **FOLDED (HIGH adv + IMPORTANT cr):** pickerOptionsFor rebuilt on the
    UNGATED producerRecipesFor (lone eligible candidates listed);
    affordance reachability decoupled from the chip (renders iff
    options ≥ 2 or current force-included, with a "machine excluded"
    notice chip when the ≥2 count chip is absent); reachability pinned
    by test.
  - **FOLDED (IMPORTANT cr):** pickerOptionsFor made TOTAL — undefined /
    catalog-absent currentRecipeId → bare list; both cases tested.
  - **FOLDED (NIT cr):** the second surviving "honestly errors" phrase
    replaced with the retracted-correct wording.
  - Chip semantics ("N recipes" at ≥2) explicitly unchanged from P0 —
    no P0 regression surface.
- v6 (2026-08-06): design r5 fold (coherence round — no mechanism
  defects; all findings editorial layering artifacts).
  - **FOLDED (IMPORTANT cr):** the picker bullet's stale
    candidateRecipesFor-as-select-source line rewritten —
    pickerOptionsFor is the sole option source, labels on the unified
    list.
  - **FOLDED (MEDIUM adv):** spec item 2's false "no other surface
    changes" replaced with the complete 8-surface adapter enumeration.
  - **FOLDED (NIT adv ×2):** producerRecipesFor null-default ordering
    made explicit (default first when non-null, else ascending); the
    fully-excluded un-force walk names its actual recovery surface.
- v7 (2026-08-07): design r6 CONVERGED (cr APPROVED 0; adv
  APPROVED_WITH_NITS 1). FOLDED: labels compose — "(alt) (machine
  excluded)" is the one reachable pairing; the others impossible by
  construction.
- v7-simplify (2026-08-07): claude-simplify-reviewer APPROVED_WITH_NITS
  (2, one actionable).
  - **REJECTED (NIT 1) with rationale:** retiring candidateRecipesFor in
    favor of producerRecipesFor forces AltCompare call-site edits — P1's
    pinned out-of-scope boundary ("AltCompare changes beyond the
    default-arg compatibility") exists to protect the shipped P0/P4
    regression surface; an advisory one-export gain does not justify
    widening it mid-arc. Tracked instead as backlog ticket #103
    (post-arc consolidation, incl. the catalog non-null-default
    verification the lens named).
  - **RECORDED (NIT 2 + at-floor confirmations):** three-cause
    annotation, the three UI surfaces, effectiveDefaultRecipe/
    producerRecipesFor/pickerOptionsFor separations — all confirmed
    minimal; not to be re-questioned. FROZEN.
