# Stage 6 / Phase 2 brainstorm — helper surfaces (ticket #26, epic #24)

Date: 2026-08-04
Status: v5 FROZEN — correctness converged (r4); simplify dispositioned
Inputs: the LANDED P1 power shape (CatalogMachine.power — mw/variable/
minMw/maxMw/exponent per machine, develop 94891c9), live src/core/
reconcile.ts (LinkFinding union with exact shortfall/surplus), src/core/
manifold.ts (Finding union: segment-over-capacity carries peakFlow +
busCapacity; infeasible-machine-demand carries demand + topCapacity),
src/data/docs-loader.ts (catalog.tiers = TIER_TABLE, the FULL fixed
belt/pipe table from tiers.ts — not just unlocked), src/ui/graph-flow.ts
(edge label vocabulary), src/ui/FindingsPanel.tsx ({solve, findings,
itemName}), src/ui/SummaryCards.tsx ({result, itemName}),
src/ui/GraphCanvas.tsx (store-wired, colorMode prop), the P1-recorded
irrationality note (overclocked power = base × (clock/100)^exponent).

## Already settled — do NOT re-litigate

1. Sequential posture; all-Claude roster; opus implementer.
2. The P1 power shape is FROZEN AND LANDED — this phase only CONSUMES
   it. No parser/catalog/store-persistence changes.
3. Exactness ethos: all rate/count math in Fractions. The recorded
   irrationality: clock^exponent is irrational for most clocks — any
   approximation happens at DISPLAY, labeled. **The float boundary
   lives in advice.ts BY DECISION (r1 fold): format.ts stays the
   exact-only renderer, and its "Fractions become strings here and
   nowhere else" header comment is AMENDED in this diff to name
   advice.ts as the second, approximation-labeled boundary — the old
   invariant must not silently go stale.**
4. Edge-label vocabulary (S3P2 frozen): absence=ok; under-supply exact
   shortfall; over-supply muted surplus; dangling per end. This phase
   EXTENDS labels, never changes the base vocabulary.
5. Findings are never invented: a hint appears only when computable.

## Axis 1 — One pure helpers module: `src/ui/advice.ts`

Three table-tested pure functions (no store, no DOM):

- `suggestSupply(demand: Fraction, perMachine: Fraction) →
  { machines: number; surplus: Fraction } | null` — the ceil of an
  exact division (null when perMachine is zero/invalid). The live case:
  demand 140, perMachine 7.5 → { machines: 19, surplus: 5/2 }.
  `Fraction.ceilDiv` exists (fraction.ts:194, returns bigint; r2 nit)
  — the bigint→number narrowing follows the solver's guarded toIndex
  precedent (manifold.ts:127).
- `tierFixHint(peak: Fraction, kind: LaneKind, binding: Fraction,
  table: TierTable) → { capacity: Fraction; tierIndex: number } | null`
  — **`binding` is the FINDING's own busCapacity (r1 fold — the
  code-reviewer proved best-unlocked makes the override branch
  unreachable: output-side findings fire against an overridden-DOWN
  capacity that can sit below best-unlocked)**: the smallest tier in
  the FULL table with capacity ≥ peak AND capacity > binding; null
  when none (no invented fixes — a peak beyond the top tier gets NO
  hint).
- `stagePowerText(power: MachinePower, machineCount: number,
  clock: Fraction) → string` — the ONE approximation boundary (the
  clock Fraction is parsed from selection.clockPercentText at the call
  site — a re-parse graphToFlow/App performs; r1 nit, assumption 4
  amended):
  - 100% clock: exact — `count × mw` as a Fraction, formatted via the
    existing formatRate-style exact renderer, "80 MW".
  - other clocks: `count × mw × (clock/100)^exponent` computed in
    FLOATS (Number conversions INSIDE this function only), rendered
    "≈ 61.7 MW" (one decimal, always the ≈ prefix — the label IS the
    honesty).
  - variable machines: the mw midpoint drives the number; suffix
    "(varies 250–1500 MW)" from the exact bounds; count-scaled.

## Axis 2 — Match-demand on the canvas edges

- graph-flow's edge-label builder extends the under/over cases:
  under-supply → "Iron Ingot · short 30/min · ×19 covers it";
  over-supply → "Circuit Board · +2.5/min surplus" UNCHANGED (a surplus
  needs no suggestion).
  **THE FAN-OUT RULE (r1 fold — the BLOCKER): the suggestion must
  cover the producer's WHOLE outgoing load for the item, not one
  link's. One producer may legally link the same itemId to several
  consumers (only (toStageId,itemId) duplicates are refused), and each
  link's reconcile sees the full totalOutput — so
  N = ceilDiv( Σ demands of ALL the producer's outgoing links for
  this itemId, perMachineOutput ). graphToFlow HOLDS the links array
  (it is an argument), so the sibling-link sum is computable in place;
  each affected under-supplied edge shows the same aggregate ×N —
  **worded "×19 total" when the producer has MORE THAN ONE outgoing
  same-item link (simplify fold — kills the per-edge misread), plain
  "×19 covers it" for the single-consumer case.**
  Every sibling's demand reads UNIFORMLY from the consumer's
  `solve.result.feeds` totalDemand for the item (r2 fold — the
  finding's `demand` field is provably a cached copy of that same
  value, so one source serves all siblings; an unsolved/dangling
  sibling has no lane and is SKIPPED from the Σ — enumerated).** The
  per-machine output at current clock is the producer lane's
  `perMachineOutput` (clock-scaled, on the solve — no clock re-parse
  needed for the SUGGESTION; r1 nit noted for the POWER helper below).
  Null suggestion (recipe-less/unsolved producer) → base label
  unchanged.
- NO one-click-apply this phase: display-only (an apply button mutates
  another stage from an edge — a UX/undo question that earns its own
  ticket if wanted; recorded).

## Axis 3 — Fix hints in the FindingsPanel

- FindingsPanel gains `tiers: TierTable` + `unlocked: { belt: number;
  pipe: number }` (r1 fold — the COUNT pair, exactly Schematic's
  established prop shape; best-unlocked derives as
  tiers[kind][unlocked[kind] − 1]). For two finding types ONLY:
  - `segment-over-capacity`: hint = tierFixHint(peakFlow, kind,
    finding.busCapacity, tiers). Wording branch by comparing the hint
    tier against best-unlocked: hint ≤ best-unlocked → "— raising this
    lane's override to Mk2 (120/min) would put the bus above this
    peak" (the overridden-down case, now REACHABLE); hint >
    best-unlocked → "— unlocking Mk2 (120/min) would raise the bus
    above this peak". **The wording claims only the PROVABLE fact (r1
    fold — a tier change re-solves the whole manifold with different
    belts/entries/spans, so a "resolves"-style claim is unproven;
    "would raise the bus above this peak" is arithmetic).**
  - `infeasible-machine-demand`: tierFixHint(demand, kind,
    finding.topCapacity, tiers) — "— unlocking Mk3 (270/min) would
    cover this machine's demand" (again the provable per-machine
    claim, not a re-solve promise).
  - All other finding types: untouched.
- The hint is part of the finding ROW text (no new panel section, no
  new components).

## Axis 4 — Power display

- **SummaryCards** gains one more card when the ACTIVE STAGE IS SOLVED
  and the machine has power data (r2 fold — the solved-only rule,
  same as the canvas card and Σ): "Power · <stagePowerText>" — props
  extend with a prepared `powerText: string | null` (App computes via
  the helper; the card stays dumb).
- **Canvas cards**: graphToFlow's node data gains `powerText: string |
  null` (computed inside graphToFlow via the same helper — it holds
  catalog + stages already); StageNode renders it as a small line under
  the machine count. **Power renders ONLY for SOLVED stages — uniform
  across all three surfaces (r2 fold): recipe-less, idle, AND invalid
  stages → null on the card, null on SummaryCards, nothing in Σ. One
  rule, no card-vs-Σ disagreement; the bad-clock sub-case (unparseable
  clockPercentText) is subsumed — an invalid stage never reaches the
  clock parse.**
- **Chain total**: a small Panel line in GraphCanvas ("Σ ≈ 312 MW"):
  computed by `chainPowerText(stages, catalog) → string | null` in
  advice.ts — **the Σ is over SOLVED stages only; idle and invalid
  stages contribute nothing (they have no running machines to bill;
  r1 nit — stated, not implied)**; floats per term (each may be
  irrational); null when no solved stage has power. The Σ + ≈ labels
  carry the honesty.
- Dark mode: existing palette classes; no new colors.

## Axis 5 — Testing posture

- advice.test.ts (table-driven): suggestSupply exact rows (140/7.5 →
  19 + 5/2 surplus; exact-divide → surplus 0; zero perMachine → null);
  tierFixHint rows (Mk1-peak-80 → Mk2/120; peak beyond top tier →
  null; already-unlocked branch inputs); stagePowerText rows (100% →
  exact "80 MW" string; 150% → "≈" prefix with the float value pinned
  to 1 decimal; variable → midpoint + range suffix; count scaling).
- graph-flow.test rows: the under-supply label carries "×N covers it"
  with the exact N; over-supply label unchanged; recipe-less producer →
  base label.
- Smoke rows: FindingsPanel hint sentence for a segment-over-capacity
  fixture (locked-tier branch); SummaryCards power card renders the
  prepared text; StageNode power line present when powerText non-null.
- Browser walk: the LIVE cases from Michael's chain — Circuit Board
  short → "×19 covers it"; the Mk1 Plastic bus findings → "unlocking
  Mk2 (120/min) would raise the bus above this peak"; power cards on Smelter (4 MW exact)
  and an overclocked stage (≈); chain total; dark mode legibility.

## Assumptions ledger

1. The P1 power shape as merged (types.ts + catalog revival) —
   grounded, merged this session.
2. catalog.tiers is the FULL fixed table (docs-loader.ts:142 returns
   TIER_TABLE regardless of unlocks) — grounded, read this session.
3. The solver findings carry the exact fields the hints need
   (peakFlow/busCapacity; demand/topCapacity) — grounded
   (manifold.ts:85-116 read this session).
4. graphToFlow already holds catalog + stages (S3P2 r1 fold) — the
   suggestion and powerText computations add no new arguments —
   grounded.
5. Fraction supports the ceil-division and comparison ops needed
   (floorDiv exists in the solver; ge/le/eq used throughout) — the
   exact ceilDiv form verified at implementation against fraction.ts,
   cited in the diff.

## Revision history

- **r1 correctness (2026-08-04):** adversarial NEEDS_REWORK (1 BLOCKER
  + 1 IMPORTANT + 2 NIT); code-reviewer NEEDS_REWORK (2 IMPORTANT + 2
  NIT). Folded in v2:
  1. **The fan-out rule** (the BLOCKER): ×N aggregates the producer's
     outgoing same-item link demands (fan-out is legal; per-link ceil
     understates); links are already a graphToFlow argument.
  2. **tierFixHint binds to the finding's busCapacity** (code-reviewer
     proved best-unlocked made the override branch unreachable); the
     wording branch compares the hint tier to best-unlocked and both
     branches are now reachable.
  3. **Provable-claim wording** ("would raise the bus above this peak"
     / "would cover this machine's demand") — never "resolves" (a tier
     change re-solves the manifold).
  4. **unlocked prop = the {belt, pipe} count pair** (Schematic's
     shape); demand read off the finding; chain Σ solved-only stated;
     the advice.ts float boundary named as a decision with the
     format.ts header amendment enumerated.
- **r2 correctness (2026-08-04):** code-reviewer APPROVED_WITH_NITS
  (2 NIT); adversarial NEEDS_REWORK (1 IMPORTANT + 1 NIT). Folded in
  v3:
  1. **Power renders only for SOLVED stages, uniformly** (the
     adversarial IMPORTANT — the r1 Σ fold had left the card surfaces
     inconsistent): recipe-less/idle/invalid → null on card,
     SummaryCards, and Σ alike; the bad-clock sub-case subsumed.
  2. **Uniform sibling-demand source** (code-reviewer note): consumer
     totalDemand for every sibling (the finding's demand is a cached
     copy); unsolved/dangling siblings skipped, enumerated.
  3. Walk wording aligned to the provable claim; ceilDiv cited
     (fraction.ts:194) with the toIndex narrowing precedent named.
  Refuted-and-held r2: demand sources cannot disagree (same synchronous
  snapshot); both hint branches reachable across the two emitters; no
  unlocked-count off-by-one.
- **r3 correctness (2026-08-04):** code-reviewer APPROVED_WITH_NITS
  (1 NIT); adversarial NEEDS_REWORK (1 finding) — the SAME item: the
  browser-walk line still carried the banned "resolves this" string
  despite the r2 record claiming alignment. Folded in v4: the walk line
  now reads "would raise the bus above this peak" (both reviewers
  specified the target wording verbatim); a quotation of the REJECTED
  phrase in the Axis-3 rationale, mangled by the global replace, was
  repaired to reference the rejected claim without asserting it.
  Refuted-and-held r3: the solved-only rule cannot kill the suggestion
  (an under-supply finding provably requires both endpoints solved);
  the dangling-sibling skip is mandated by the no-invented-numbers
  invariant and updates live on recompute.
- **Simplify pass (2026-08-04, one-shot): APPROVED_WITH_NITS (3 NIT).**
  Dispositions: NIT 2 FOLDED — the fan-out label reads "×N total" when
  siblings exist (one word, kills the 19-per-edge misread); NIT 1
  resolved in the design's favor (suggestSupply earns its export — two
  call sites + the narrowing/null guards need a test-pinned home);
  NIT 3 recorded (test layering is right; no fourth row re-asserting
  the arithmetic). Affirmed already-simple: the advisory module
  boundary, the variable suffix, the Σ placement, the scope cuts.
  Prose-only fold — no correctness re-run.
- **v5 FROZEN (2026-08-04).**
