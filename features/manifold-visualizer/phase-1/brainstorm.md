# Phase 1 brainstorm — src/core manifold solver (ticket #3, epic #2)

Date: 2026-08-03 · Status: v1, design dual-review pending

## Already settled — do NOT re-litigate

From the frozen v1 spec (`docs/superpowers/specs/2026-08-03-manifold-visualizer-design.md`),
CLAUDE.md, and the epic #2 decisions:

- All solver math is exact rational (`Fraction`), never floats; solver lives in
  `src/core/` (pure TS, purity allowlist enforced).
- The math itself (§Core math + §Validation): per-lane; `d = rate × clock%`;
  `D = N×d`; `B` = highest unlocked tier; `k = ceil(D/B)`; combination =
  `k−1` top-tier + smallest unlocked tier ≥ remainder; entry after machine
  `floor(S/d)` (belt 1 at head; integral `S/d` → immediately after machine
  `S/d`); output mirror: break-out after `floor(T/p)`, count `ceil(N×p/T)`,
  each break-out belt = smallest unlocked tier ≥ its segment load; validation
  computes actual steady-state flow on every bus segment; never render a broken
  manifold silently.
- Belts and pipes share the math; only the capacity table differs; capacities
  come from the catalog, never hardcoded.
- Per-belt manual override of any individual feed belt.
- Degenerate inputs (0 machines, no-solid-input, fluid-only) produce empty
  lanes, no crashes. Solver is "pure functions over Fraction, tested
  table-driven."
- Growth path must not be structurally blocked (chained stages, layout layer).
- Stage 0 boundary: capacities enter as `Fraction`s
  (`floorDiv`/`ceilDiv` are `Fraction ÷ Fraction → bigint`).

## Purpose

Lock the solver's public API, input/output types, findings model, and module
layout — the contract Phases 2–4 build against — and implement it fully tested.

## Decision axes

### Axis 1 — Entry-point shape

Options: (a) one pure function `solveStage(input): StageSolveResult` with
per-lane helpers exported for table-driven testing; (b) a `ManifoldSolver`
class; (c) only per-lane functions, caller assembles.

**Pick: (a).** The v1 spec says "pure functions over Fraction"; a class adds
state where none exists. Per-lane functions `solveFeedLane` / `solveOutputLane`
are the natural table-driven test units and are exported; `solveStage` maps
lanes and aggregates findings. (c) pushes assembly into the store — wrong layer.

### Axis 2 — Where clock % applies

Options: (a) caller pre-scales rates; (b) solver takes base per-machine rate +
`clockPercent` and computes `d = rate × clock/100` itself.

**Pick: (b).** The spec's formula owns the scaling ("d = recipe rate ×
clock %"); keeping it in the solver keeps the store thin and makes the worked
examples read exactly like the spec. `clockPercent` is a `Fraction` (e.g.
`Fraction.parse("150")` for 150%), uniform across the stage (spec).

### Axis 3 — Input types (the Phase 2 contract)

```ts
type LaneKind = 'belt' | 'pipe';

interface LaneInput {
  itemId: string;           // opaque label, passed through to results/findings
  kind: LaneKind;
  perMachineRate: Fraction; // base rate at 100% clock, per minute
  overrides?: (Fraction | null)[]; // per-belt capacity override by belt index; null = auto.
                                   // Values are deliberately UNCLAMPED — an
                                   // override may exceed the bus cap B; the
                                   // solver never silently fixes it, the
                                   // segment-over-capacity finding reports it.
}

interface StageInput {
  machineCount: number;     // integer ≥ 0 (validated; out-of-range → invalid-input 'bad-machine-count')
  clockPercent: Fraction;   // uniform across the stage
  capacities: { belt: Fraction[]; pipe: Fraction[] }; // unlocked tiers, ascending
  feeds: LaneInput[];       // one per input item
  outputs: LaneInput[];     // one per output item (byproducts included)
}
```

**Override semantics (pinned — makes the by-index shape coherent):** the
solver always computes the automatic combination first — `k = ceil(D/B)` belts
with auto-assigned tiers. Overrides then replace the *capacity* of the
auto-computed slot at that index; they never re-run the combination and never
change the belt count `k`. Entry points are recomputed from the overridden
capacities (cumulative `S` uses actual capacities), and validation reports any
breakage (`segment-over-capacity` / `starved-machines`) rather than
"fixing" it. So `overrides[i]` always names auto-slot `i` of a stable-count
belt list — this is exactly the v1 spec's flow ("tool computes fewest belts /
best combination; per-belt manual override" + "Manual override breaks the
manifold: recompute flows, report"). An `overrides` array longer than `k` is
an `invalid-input` finding. Adding/removing belts (changing `k`) is not an
override — it is out of v1 scope.

Rationale: the solver is item-agnostic (`itemId` opaque) — no catalog
knowledge leaks into core, so Phase 2 maps catalog → `StageInput` without core
changes, and chained stages later compose `StageInput`s without core changes.
`capacities` ascending is a stated precondition (solver validates, does not
sort — a sorted-input contract keeps the solver deterministic and the
validation honest).

### Axis 4 — Result types

```ts
interface FeedBelt {
  index: number;            // 0-based along the manifold
  capacity: Fraction;       // assigned (or overridden) tier capacity
  overridden: boolean;
  entersAfterMachine: number; // 0 = at the head (before machine 1)
}

interface BusSegment {
  fromMachine: number;      // 1-based, inclusive span [fromMachine..toMachine]
  toMachine: number;
  peakFlow: Fraction;       // the MAXIMUM steady-state flow within this span.
                            // Flow is NOT constant across a span under
                            // head-first draw: on the feed side it steps down
                            // by each machine's draw (peak = at the head, just
                            // after the belt entry); on the output side it
                            // steps up by p per machine (peak = at the tail,
                            // just before the break-out). peakFlow is the
                            // span's load level — the hover value and exactly
                            // the quantity the bus-cap check compares to B.
                            // The per-machine profile is derivable from the
                            // model; starvation detail lives in findings.
  beltIndex: number;        // the feed belt (or output break-out belt) this
                            // segment is attributed to — solver-authoritative,
                            // so the UI's segment coloring never re-derives
                            // the partitioning (spec §UI: "bus is colored by
                            // which feed belt supplies each segment").
                            // Attribution rule (pinned): the MOST-RECENT
                            // entrant — the belt whose entry point starts this
                            // segment (output side: the break-out belt
                            // collecting the span). The cumulative span flow
                            // (`peakFlow` at the head) may sum several belts'
                            // input; beltIndex is the coloring attribution,
                            // not a claim of sole supply.
}

interface FeedLaneResult {
  itemId: string; kind: LaneKind;
  perMachineDemand: Fraction;  // d
  totalDemand: Fraction;       // D
  belts: FeedBelt[];
  segments: BusSegment[];
  findings: Finding[];
}

interface BreakoutBelt {
  index: number;               // 0-based along the collection bus
  capacity: Fraction;          // smallest unlocked tier ≥ this belt's segment load
  startsAfterMachine: number;  // machine after which this break-out belt begins
                               // (belt 0 starts at machine 1's side, value 0)
  load: Fraction;              // total flow this break-out belt carries
}

interface OutputLaneResult {
  itemId: string; kind: LaneKind;
  perMachineOutput: Fraction;  // p (clock-scaled)
  totalOutput: Fraction;       // N × p
  breakouts: BreakoutBelt[];
  segments: BusSegment[];      // beltIndex = the break-out belt collecting the span
  findings: Finding[];
}

interface StageSolveResult {
  feeds: FeedLaneResult[];
  outputs: OutputLaneResult[];
  findings: Finding[];      // stage-level (aggregated lane findings + input validation)
}
```

Machine indices are JS `number` (converted from `floorDiv` bigints with a
range guard — machine counts are UI-entered small integers; the guard throws
on overflow rather than silently truncating). Flows/capacities stay `Fraction`.

### Axis 5 — Findings model

Options: (a) message strings composed in core; (b) a typed discriminated union
with exact `Fraction` amounts, UI composes words.

**Pick: (b).** Core stays presentation-free (purity in spirit, not just
imports); the UI owns wording; tests assert structured data, not prose.

```ts
type Finding =
  | { type: 'infeasible-machine-demand'; itemId: string; demand: Fraction; topCapacity: Fraction }
  | { type: 'segment-over-capacity'; itemId: string; fromMachine: number; toMachine: number; peakFlow: Fraction; busCapacity: Fraction }
  | { type: 'starved-machines'; itemId: string;
      partial?: { machine: number; received: Fraction; shortfall: Fraction };
      starvedFrom?: number; starvedTo?: number }
    // Emission invariants: at least one of `partial` / the starved run is
    // present (an empty starved-machines finding is never emitted);
    // starvedFrom is present iff starvedTo is (the run is all-or-nothing);
    // the run's shortfall is d per machine.
  | { type: 'invalid-input'; reason: 'capacities-not-ascending' | 'negative-rate' | 'nonpositive-clock' | 'bad-machine-count' | 'overrides-exceed-belt-count'; detail: string };
```

**Steady-state distribution model (pinned — an explicit v1 modeling
decision):** undersupply resolves by **sequential head-first draw**. Machine
`i` receives `min(d, supply remaining at its splitter)`; the deficit therefore
concentrates at the tail of each supplied span. This is the correct
*steady-state* model for Satisfactory manifolds — machine input buffers fill
from the head, so at equilibrium head machines run at full rate and the tail
starves — and it matches the spec's "actual steady-state flow" language and
player-facing intuition ("the end of the manifold starves"). Splitter-halving
transients (the bufferless geometric distribution) are explicitly out of
scope: this is a logical planner, not a simulation.

Under this model, each supplied span (between belt entries) starves as: a
fully-fed head run, at most **one partially-fed machine** (exact `received` +
`shortfall`), then a fully-starved run (shortfall = `d` each) until the next
belt entry replenishes. One `starved-machines` finding is emitted per affected
span, carrying exactly those parts — which names the exact machines and exact
shortfalls for every topology, including override-induced mid-manifold
starvation that recovers at a later entry point.

**Segment-over-capacity check target (pinned):** the invariant is the spec's
bus cap — "the manifold bus can never carry more than `B` past any single
point". Because flow within a span moves monotonically (down via draws on the
feed side, up via emissions on the output side), each segment's `peakFlow` IS
the span maximum — so validation flags any segment where `peakFlow` exceeds
**`B`** (the lane's bus capacity = highest unlocked tier), reported in
`busCapacity`. One quantity, one name — the check and the hover value are the
same `peakFlow`. An override may raise an individual belt's delivery capacity
above `B` (`overrides` values are deliberately unclamped — see the input
type); the bus still cannot carry the excess past the entry, and the finding
says so.

(The exact variant set is finalized in the spec; the principle — discriminated
union, Fractions inside, no prose — is the axis pick.)

### Axis 6 — Module layout

Options: (a) one `src/core/manifold.ts` (+ colocated test); (b) split
`types.ts` / `feed.ts` / `output.ts` / `validate.ts`.

**Pick: (a).** The whole solver is a few hundred lines of pure functions; the
Stage 0 precedent (`fraction.ts`) is single-module. Split only when it grows —
nothing in (a) blocks that.

## Out of scope (Phase 1)

Catalog/Docs.json shapes (Phase 2), store (Phase 3), UI/SVG (Phase 4),
chained stages, physical layout, per-machine underclock balancing (v1
non-goals).

## Assumptions ledger

- **`Fraction` API suffices** — verified against `src/core/fraction.ts` on
  develop: `mul`/`div`/`sub`/`add`, `ceilDiv`/`floorDiv` (Fraction ÷ Fraction
  → bigint, exact-boundary + negative correct), comparisons, `isZero`. No new
  Fraction methods needed.
- **No solver exists to port** — verified: satisfactory-planner has no manifold
  solver (its math is `javascript-lp-solver` over floats for a different
  problem — production-chain balancing).
- **The spec's math is complete for v1** — feed steps 1–6, output mirror, and
  the validation cases enumerate every behaviour; no formula is left to invent
  (worked example: 20 smelters / Iron Ingot / Mk4, spec §UI).
- **Machine indices fit JS `number`** — machine count is a UI-entered integer;
  the bigint→number conversion guard turns a pathological overflow into a
  thrown error, not silent truncation.
- **Ascending-capacities precondition** — Phase 2's catalog naturally provides
  sorted tiers; the solver validates and emits `invalid-input` rather than
  sorting, keeping garbage-in explicit.

## Revision history

**Round 1 design review** (all-Claude roster per epic #2 decision —
code-reviewer: APPROVED_WITH_NITS, 3 findings; adversarial-reviewer:
NEEDS_REWORK, 4 findings). All folded; none rejected:

- `BusSegment.beltIndex` added (both reviewers): segment→supplying-belt
  attribution is solver-authoritative; mirrored on the output side.
- Override semantics pinned (adversarial I2): overrides replace capacity of
  auto-computed slots only; never change belt count `k`; oversize `overrides`
  → `invalid-input 'overrides-exceed-belt-count'`.
- `OutputLaneResult` + `BreakoutBelt` written as full interfaces (adversarial
  NIT 3).
- `machineCount` input validation stated (adversarial NIT 4).
- Starvation findings pinned per-segment — uniform shortfall within a segment
  by construction, covering non-contiguous topologies (code-reviewer NIT).
  **[Superseded in round 2 — see below.]**
- FEATURE.md dependency-graph label fixed `StageSpec` → `StageInput`
  (code-reviewer NIT).

**Round 2 design review** (code-reviewer: APPROVED, 0 findings;
adversarial-reviewer: NEEDS_REWORK, 3 findings). All folded; none rejected:

- **Distribution model pinned** (adversarial I1, superseding the round-1
  starvation fold): steady-state **sequential head-first draw** — buffers
  saturate head machines, deficit concentrates at the tail; the round-1
  "uniform shortfall within a segment" claim assumed an unstated model that
  steady-state physics contradicts. `starved-machines` reshaped to carry the
  one partially-fed machine (exact received/shortfall) + the fully-starved
  run, per affected span. Splitter-halving transients declared out of scope
  (logical planner, not simulation).
- **Over-capacity check target pinned** (adversarial N1): validation checks
  cumulative segment flow against the bus cap `B` (field renamed
  `busCapacity`), per the spec's "never more than B past any single point"
  invariant — overrides can raise a belt's delivery, never the bus.
- **`beltIndex` attribution rule stated** (adversarial N2): most-recent
  entrant (the belt whose entry starts the segment); a coloring attribution,
  not a sole-supply claim.

**Round 3 design review** (code-reviewer: APPROVED_WITH_NITS, 2 findings;
adversarial-reviewer: NEEDS_REWORK, 1 major + 2 nits). All folded; none
rejected:

- **`BusSegment.flow` → `peakFlow`** (adversarial MAJOR): under head-first
  draw, flow is not constant within a span (steps down via draws on the feed
  side, up via emissions on the output side), so a single "flow on this span"
  value was self-contradictory. Pinned as the span **maximum** — feed peak at
  the head (just after entry), output peak at the tail (just before
  break-out). Monotonic movement within a span makes `peakFlow` exactly the
  bus-cap check quantity AND the natural hover value, resolving the naming
  collision with the former "nominal cumulative" over-capacity language
  (which is deleted); the finding field is now `peakFlow` too.
- **`starved-machines` emission invariants stated** (code-reviewer NIT ×2 +
  adversarial NIT): never emitted empty (≥1 of partial/run present);
  `starvedFrom` iff `starvedTo`; run shortfall = `d` per machine.
- **`overrides` unclamped note at the type site** (adversarial NIT): override
  may exceed `B`; never silently fixed; the finding reports it.

**Round 4 design review** (code-reviewer: APPROVED_WITH_NITS, 1;
adversarial-reviewer: APPROVED_WITH_NITS, 1 — the same stray pre-rename
`flow` backtick in the beltIndex comment). Folded (comment now says
"cumulative span flow (`peakFlow` at the head)"). **Correctness pair
converged.**

**Simplify pass** (one-shot, post-convergence — claude-simplify-reviewer:
APPROVED_WITH_NITS, 3 document-hygiene findings):

- NIT 1 (`overrides-exceed-belt-count` typed finding → precondition throw)
  **rejected with rationale**: the oversize state is reachable in the live UI
  flow (override set, then machine count lowered before the store trims), and
  the spec's "never silently render a broken manifold" posture wants a
  reported finding, not a crash; the variant was adversarial-mandated (r1 I2).
- NIT 2 (peakFlow type-site comment volume) + NIT 3 (settled-list restates
  spec math) **folded forward into the spec**: the spec carries one-line
  field semantics and cites the v1 spec's math instead of restating it; the
  brainstorm stands unedited as the review-audit record.
