# S20 P2 — Propose solver extensions (brainstorm + spec)

**Ticket:** #101 · **Epic:** #98 · **Milestone:** 91 · **Status:** v4 — FROZEN (review of record: r4 APPROVED + APPROVED_WITH_NITS)

## Purpose

Two solver-level upgrades to Propose: a **clock-percent target** (plan the
whole chain at, say, 150% — machine counts and power follow honestly) and
**byproduct feed suggestions** (when a proposed stage's byproduct could
feed another proposed stage, say so — display-only in P2; explicit routing
is its own follow-up ticket).

## Already settled — do NOT re-litigate

- Epic #98: P2 = these two; persistence/tier gating is P3. "Suggestion
  only, never auto-routed silently" (epic scope on byproducts).
- 100% stays the default and must remain byte-stable with today's output
  (epic acceptance).
- P1's shipped surfaces (picker/raw/exclusions, cause lines, one propose
  path) are the base; the ephemeral posture holds (no store surface).
- The S6/advice.ts float-display discipline: exact Fractions at 100%
  clock; float + `≈` beyond it (irrational powers) — established, reused.

## Ground truth (verified this session)

- **Research gate CLEARED in-repo:** `MachinePower.exponent: Fraction`
  (`src/data/types.ts:63-67`) carries `mPowerConsumptionExponent`
  verbatim per machine (`src/data/docs-loader.ts:227-228`,
  `DEFAULT_POWER_EXPONENT` at :217 when omitted). The exponent is **per-machine and non-uniform** in
  the bundled snapshot (1.321929 and 1.6 both occur) — "stored but never
  applied". Measured data, not assumption.
- `src/ui/advice.ts stagePowerText` (:87-112): exact branch at clock
  100; otherwise float `fractionToNumber(mw) × (clock/100)^exponent`
  with the `≈` idiom — the ONE approved float boundary for clock power.
- Core `proposeChain`: per-machine rates from `BuilderIO.perMinute` at
  100% clock; `ProposedStage.outputRate = machineCount × primary
  perMinute` (chain-builder.ts:40-49). Counts via ceilDiv — exact.
- `ChainProposal.byproducts: ItemRate[]` — non-primary outputs, reported
  never routed (chain-builder.ts:75-80). `ProposedLink` carries only
  primary feeds. (Whether/how a byproduct StageLink enters the applied
  graph is the routing ticket's question, not P2's.)
- `applyChainProposal` (store.ts:~819) seeds every applied stage
  `clockPercentText: "100"`.
- Stage solving (manifold) accepts per-stage clock already
  (clockPercentText) — an applied chain at clock C is a normal graph.
- P1's `repropose` single path builds options + preview — the natural
  place a clock value joins.

## Decision axes

### Axis 1 — Where the clock enters the solve

Options: (a) adapter pre-scales recipe `perMinute` values by clock/100
before calling the core; (b) core gains `clockPercent: Fraction = 100`
and scales internally.

**Pick (b).** The clock changes the SOLVE (counts), not just display —
core-owned keeps the invariant "ProposedStage.outputRate = machineCount ×
scaled perMachine rate" self-consistent and testable in exact arithmetic:
per-machine rate at clock C = `perMinute × C/100` (LINEAR, exact
rational — the game scales item rates linearly with clock; only POWER is
non-linear). Counts = ceilDiv(demand, scaled rate) — still exact. Default
`Fraction(100)` ⇒ byte-identical today (regression-pinned). Clock is
GLOBAL for the proposal (one input; per-stage clocks are post-Apply
editing, already supported by the graph).
Validation: clock ∈ (0, 250] (the game's max with power shards);
non-numeric/out-of-range → the rate-input error idiom.

### Axis 2 — Power display at clock ≠ 100

The cost sheet's Σ POWER and metrics must follow the honest discipline:
at clock 100 the exact Fraction path (unchanged); at any other clock,
per-machine power = `mw × (C/100)^exponent` is irrational in general —
so `proposalMetrics` gains `clockPercent` and, when ≠ 100, computes the
float figure **per stage with THAT stage's own exponent** — the snapshot
exponents are non-uniform (1.321929 vs 1.6), so the sum is
`Σ over stages of machineCount × fractionToNumber(mw) ×
(C/100)^fractionToNumber(that stage's power.exponent)` — NOT one
chain-wide exponent, and NOT via the existing `subtreePowerText` helper
(chain-builder-adapter.ts:600-617), which flattens `exponent = 1` and
pins clock 100 (harmless today only because the exact branch ignores the
exponent at 100%). Cost sheet renders `Σ POWER ≈ N MW` (the ≈ idiom).
`powerMw`/`minMw`/`maxMw` stay the exact 100%-basis figures; a new
optional `powerAtClockMw: number | null` (null at 100) carries the float
figure. The compare path is UNTOUCHED (always 100% — alternates are
compared at standard clock; pinned).

### Axis 3 — Applied clock

`applyChainProposal` seeds `clockPercentText` with the CHOSEN clock text
(not hardcoded "100") — the applied graph then solves each stage at that
clock natively (existing per-stage clock support). Format: the raw user
text validated at propose time (e.g. "150"), preserving the
user-intent-text idiom (Selection stores raw text).

### Axis 4 — Byproduct feed suggestions (DISPLAY-ONLY in P2)

The scan (`byproductSuggestions(proposal, catalog): { itemId, rate,
toItemId, toItemName }[]`) runs in two steps:

1. **Aggregate byproducts per item** — `ChainProposal.byproducts` is
   emitted one-entry-per-(producing-stage, non-primary-output) with NO
   per-item merge (chain-builder.ts:328-334), so the same byproduct B
   can appear in multiple entries; sum those rates exactly (Fraction
   add) into one total per distinct B.
2. **Match consumers** — for each aggregated B@total: find proposed
   stages whose RECIPE INPUTS include B (the adapter has the recipes —
   pure scan); emit ONE suggestion per (B, consumer) pair.

The output is therefore unique on `(itemId, toItemId)` **by
construction** — that pair is the stable list key. The two multiplicity
directions both resolve: one byproduct feeding two stages → two entries
differing in toItemId; two producers of one byproduct feeding one stage
→ pre-aggregated into one entry (whose summed rate is also the more
truthful display figure). The display line consumes
itemId/rate/toItemName; no source-stage field — that was routing
payload and routing is #105's. Render under the byproducts line:
`B R/min could feed <StageItem>` — an informational line, **no toggle,
no proposal mutation, no store surface, no apply payload**. Suggestions
recompute per re-propose (pure derivation from the fresh proposal —
nothing kept, so nothing can go stale).

**v1 had an explicit ROUTE toggle here; v2 removes it.** Both r1
reviewers converged on the routed-link mechanics being defective as
specified: `applyProposalToSlice` builds links via a plain `.map`
(store.ts:838-843) with no duplicate-(toStageId, itemId) refusal, unlike
`addLink`/`canLink` (store.ts:1497-1501, 917-920) — the sole enforcers
of one-feed-lane-per-(to, item) — so routing B into a consumer whose
B-input already has its dedicated producer link appends a SECOND lane
the store forbids everywhere else, and per-link-local reconciliation
(store.ts:574-590; reconcile.ts one-finding-per-link) then emits two
findings comparing two different supplies against the same demand. The
reviewers *diverged* on whether the remaining clean case's finding is
honest or false — which is itself the tell that routing semantics
(partial-supply lanes, lane-collision policy, eventual demand feedback)
need their own design, not a rider on P2. The epic's scope line is
literally "suggestion only" — P2 ships that; explicit routing is now its
own tracked ticket (see Out of scope).

## Spec (file-by-file)

1. **`src/core/chain-builder.ts`** — `clockPercent: Fraction =
   Fraction.from(100)` param (7th positional; the core stays positional
   — both production callers live in the adapter, and only
   `proposeChainForCatalog` (chain-builder-adapter.ts:62) threads the
   clock via the ProposeOptions bag; the compare-path caller
   (candidateRowsFor, :652) stays on the 100% default, which is exactly
   what pins compare at standard clock with zero edits — a core options
   bag for one param is churn; recorded as the disposition of the r1
   NIT); per-machine
   rate scaling `perMinute × clockPercent/100` in BOTH the demand-walk
   and the count-fix pass; outputRate consistency preserved; default ⇒
   byte-identical (regression-pinned).
2. **`src/ui/chain-builder-adapter.ts`** — ProposeOptions gains
   `clockPercent?: Fraction`; proposalMetrics gains the clock +
   `powerAtClockMw: number | null` (per-stage-exponent float sum per
   Axis 2); byproduct suggestion scan `byproductSuggestions` per Axis 4.
3. **`src/state/store.ts`** — `applyChainProposal` accepts the clock
   text; seeds `clockPercentText` with it (was hardcoded "100").
4. **`src/ui/ChainBuilder.tsx`** — CLOCK % input beside Rate (default
   "100", validated (0,250]); suggestion lines under the byproducts
   line (display-only); cost sheet ≈ rendering at ≠100.
5. **`src/ui/app.css`** — suggestion-line styles from existing tokens.
6. **Tests** (core + adapter + store, node env): clock scaling exact
   (150% → counts recompute, e.g. ceil(120/(30×1.5)) = 3 not 4);
   default-100 byte-identical; clock validation; powerAtClockMw
   per-stage exponents (two stages with DIFFERENT exponents → sum uses
   each stage's own; null at 100); byproductSuggestions (a chain where
   a byproduct matches another stage's input; none → empty; TWO
   producing stages emitting the same byproduct toward one consumer →
   ONE suggestion with the exact summed rate, keys unique; ONE
   byproduct feeding TWO consumers → two suggestions with distinct
   toItemId keys); applied
   clockPercentText seeding; **bidirectionality log**
   `features/propose-grows-up/p2-r2-verification.log`.
7. **Docs at merge (team lead).**

## Explicitly out of scope

**Explicit byproduct ROUTING** (the toggle + applied StageLink) — its
own follow-up ticket, carrying both r1 analyses (lane-collision
invariant, partial-supply reconciliation semantics, eventual
demand-reduction feedback loop) as design input; byproduct-aware demand
reduction (part of that ticket's design space); per-stage clocks at
propose time; persistence (P3); compare-path clock support (pinned at
100).

## Test + verification plan

Per spec item 6 + the log; trunk verify after worktree removal.
**Walk:** propose Computer 10/min at 150% → counts drop vs 100%
(cross-check one stage by hand), cost sheet shows `Σ POWER ≈` (float
idiom); Apply → applied stages carry clock 150 and the TitleBlock's
float Σ agrees within its rounding; propose a chain with a real
byproduct match (e.g. a refinery byproduct vs a consumer in the closure
— else a synthetic walk via alternates that produce byproducts) → the
`could feed` suggestion line renders; a chain with no match → no line.
Both themes.

## Assumptions ledger

- Item rates scale LINEARLY with clock; only power follows the exponent
  — grounded: the game's documented overclock model; the repo's own
  advice.ts applies the exponent to POWER only, and manifold solving
  uses linear clock scaling for rates (existing per-stage clock).
- The exponent is per-machine measured data — grounded: parsed verbatim
  from Docs.json (docs-loader.ts:227), default only when omitted.
- Clock (0,250] matches the game's shard-boosted max — grounded: game
  facts; the bound is a UI validation, not solver math (the solver is
  total for any positive rational).

## Revision history

- v1 (2026-08-07): initial merged brainstorm+spec.
- v2 (2026-08-07): r1 fold (both reviewers NEEDS_REWORK).
  **Adversarial BLOCKER + code-reviewer IMPORTANT (routed-link
  mechanics: duplicate-(to,item) lane past the no-dedup apply path;
  contradictory/false reconciliation findings) — FOLDED by removing
  routing from P2 entirely**: Axis 4 is now display-only suggestions
  (the epic's literal "suggestion only" scope); explicit routing spun
  off to its own ticket with both analyses attached. The reviewers'
  divergence on the clean case's finding honesty is thereby mooted here
  and preserved as that ticket's open design question. **Adversarial
  MAJOR (stale ROUTE-toggle posture unspecified) — mooted**: no toggles
  remain; suggestions are pure per-propose derivation. **Code-reviewer
  NIT (per-stage exponent) — FOLDED**: Axis 2 + spec item 6 now pin the
  per-stage-exponent sum and forbid reusing `subtreePowerText`.
  **Code-reviewer NIT (path prefixes) — FOLDED**: ground truth cites
  `src/data/…`. **Adversarial NIT (7th positional vs options bag) —
  REJECTED with rationale** in spec item 1: the adapter bag is the
  ergonomic layer; a core options bag for one param is churn. Dropped
  the now-moot StageLink-itemId assumption from the ledger.
- v2 nits folded (2026-08-07): r2 = APPROVED_WITH_NITS from both
  reviewers. Code-reviewer NIT: default-exponent citation tightened
  :212 → `DEFAULT_POWER_EXPONENT` at :217. Adversarial NIT: spec item
  1's "single production caller" corrected to the true count — two
  adapter callers, only `proposeChainForCatalog` (:62) threads the
  clock; `candidateRowsFor` (:652) stays on the 100% default, which is
  itself what pins the compare path. Correctness pair CONVERGED.
- v3 (2026-08-07): simplify pass (claude-simplify-reviewer,
  APPROVED_WITH_NITS, 1 finding) — **FOLDED**: suggestion payload
  narrowed from `{itemId, rate, fromItemId, toItemId, toItemName}` to
  `{itemId, rate, toItemId, toItemName}`; `fromItemId` was a StageLink
  key serving only the descoped routing feature (no display consumer
  reads it); `toItemId` retained solely as the stable list key (two
  suggestions can share an itemId when one byproduct feeds two stages).
  Reviewer confirmed already-minimal: `powerAtClockMw` nullable field
  (recompute-at-render would duplicate the per-stage loop), (0,250] via
  the existing rate-input error idiom, no other routing residue.
  Correctness pair re-run on this delta per the fold contract.
- v4 (2026-08-07): r3 fold (both reviewers NEEDS_REWORK on the same
  collision, independently). v3's uniqueness rationale covered only the
  one-byproduct-feeds-two-stages direction; the inverse — two producing
  stages emitting the same byproduct B toward one consumer — collides
  on (itemId, toItemId) because `ChainProposal.byproducts` has no
  per-item merge (chain-builder.ts:328-334), and the removed fromItemId
  had been that case's disambiguator. **FOLDED via the reviewers'
  fix-direction (a)**: the scan now aggregates byproduct rates per item
  (exact Fraction sum) BEFORE consumer matching, making (itemId,
  toItemId) unique by construction and the rendered rate the true
  total; spec item 6 adds the two-producers-one-consumer test pinning
  ONE summed suggestion.
- v4 FROZEN (2026-08-07): r4 delta re-run = code-reviewer APPROVED
  (uniqueness airtight against the one-plan-per-item Map; summed rate
  honest — fungible by itemId; determinism preserved via the sorted
  upstream) + adversarial APPROVED_WITH_NITS (1 NIT — FOLDED: spec item
  6 also pins Direction 1, one byproduct feeding two consumers → two
  suggestions with distinct toItemId keys). Correctness pair CONVERGED;
  simplify pass already consumed at v3 (one-shot). Design of record.
