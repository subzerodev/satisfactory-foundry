# Phase 1 spec — src/core manifold solver (ticket #3, epic #2)

Date: 2026-08-03 · Status: v1, design dual-review pending
Provenance: brainstorm v4 (frozen, `features/manifold-visualizer/phase-1/brainstorm.md`);
math per the frozen v1 spec `docs/superpowers/specs/2026-08-03-manifold-visualizer-design.md`
§Core math + §Validation (cited, not restated — the formulas there are
authoritative).

## Deliverable

`src/core/manifold.ts` (+ colocated `manifold.test.ts`): the pure manifold
solver. Exports: `solveStage`, `solveFeedLane`, `solveOutputLane`, and all
types below. No other modules; no changes to `fraction.ts`; the `src/core`
purity allowlist applies unchanged.

## Types (the locked Phase 2–4 contract)

```ts
import { Fraction } from './fraction';

export type LaneKind = 'belt' | 'pipe';

export interface LaneInput {
  itemId: string;                  // opaque label, passed through
  kind: LaneKind;
  perMachineRate: Fraction;        // base rate at 100% clock, per minute
  overrides?: (Fraction | null)[]; // per-belt capacity override by auto-slot
                                   // index; null = keep auto. Unclamped (may
                                   // exceed B); never silently fixed.
}

export interface StageInput {
  machineCount: number;            // validated integer ≥ 0
  clockPercent: Fraction;          // uniform; d = perMachineRate × clockPercent/100
  capacities: { belt: Fraction[]; pipe: Fraction[] }; // unlocked tiers, ascending (validated, not sorted)
  feeds: LaneInput[];
  outputs: LaneInput[];
}

export interface FeedBelt {
  index: number;                   // 0-based along the manifold
  capacity: Fraction;              // assigned (or overridden) capacity
  overridden: boolean;
  entersAfterMachine: number;      // 0 = at the head, before machine 1
}

export interface BusSegment {
  fromMachine: number;             // 1-based inclusive span
  toMachine: number;
  peakFlow: Fraction;              // span maximum (feed: at head; output: at tail)
  beltIndex: number;               // attribution: the belt whose entry/break-out starts this span
}

export interface FeedLaneResult {
  itemId: string; kind: LaneKind;
  perMachineDemand: Fraction;      // d
  totalDemand: Fraction;           // D = N × d
  belts: FeedBelt[];
  segments: BusSegment[];
  findings: Finding[];
}

export interface BreakoutBelt {
  index: number;                   // 0-based along the collection bus
  capacity: Fraction;              // smallest unlocked tier ≥ load
  startsAfterMachine: number;      // 0 = collects from machine 1
  load: Fraction;                  // total flow this belt carries (= Σ its span emissions)
}

export interface OutputLaneResult {
  itemId: string; kind: LaneKind;
  perMachineOutput: Fraction;      // p (clock-scaled)
  totalOutput: Fraction;           // N × p
  breakouts: BreakoutBelt[];
  segments: BusSegment[];
  findings: Finding[];
}

export interface StageSolveResult {
  feeds: FeedLaneResult[];
  outputs: OutputLaneResult[];
  findings: Finding[];             // stage-global invalid-input only (the four
                                   // pre-solve validations). All lane-scoped
                                   // findings — including the lane-local
                                   // invalid-input 'overrides-exceed-belt-count'
                                   // — live on their lane's findings array.
}

export type Finding =
  | { type: 'infeasible-machine-demand'; itemId: string; demand: Fraction; topCapacity: Fraction }
  | { type: 'segment-over-capacity'; itemId: string; fromMachine: number; toMachine: number;
      peakFlow: Fraction; busCapacity: Fraction }
  | { type: 'starved-machines'; itemId: string;
      partial?: { machine: number; received: Fraction; shortfall: Fraction };
      starvedFrom?: number; starvedTo?: number }
  | { type: 'invalid-input';
      reason: 'capacities-not-ascending' | 'negative-rate' | 'nonpositive-clock'
            | 'bad-machine-count' | 'overrides-exceed-belt-count';
      detail: string };
```

Emission invariants (from the frozen brainstorm): a `starved-machines` finding
always carries at least one of `partial` / the run; `starvedFrom` present iff
`starvedTo`; run shortfall is `d` per machine. Machine indices are `number`,
converted from `Fraction.floorDiv`/`ceilDiv` bigints via a guard that throws
past `Number.MAX_SAFE_INTEGER` (never truncates).

## Behaviour

### `solveStage(input: StageInput): StageSolveResult`

1. **Stage validation** (violations → `invalid-input` findings on the
   **stage** array, solve aborts with empty lanes — garbage in, findings
   out, never a crash for bad *values*; malformed *types* are the caller's
   bug): `machineCount` a non-negative safe integer; `clockPercent > 0`;
   each capacity list strictly ascending and positive; every
   `perMachineRate ≥ 0`. These four are stage-global — none can yield a
   meaningful partial solve.
   (`overrides.length ≤ k` is NOT here — it is lane-local by construction,
   since `k` only exists once the lane's combination is computed; see the
   lane solve below.)
2. **Degenerate inputs** (v1 spec §Validation): `machineCount === 0` or an
   empty/zero-rate lane → the lane solves to empty arrays, no findings.
   **The degenerate short-circuit precedes the lane solve**: a zero-machine
   stage emits no findings, oversize-overrides included (there is nothing to
   warn about; the stale-overrides finding fires only when a lane actually
   solves, i.e. `N > 0` — pins the `N=0` × oversize-overrides precedence).
3. Map `solveFeedLane` / `solveOutputLane` over lanes; aggregate lane
   findings onto lanes, stage-level `invalid-input` onto the stage.

### `solveFeedLane` — per the v1 spec's feed steps 1–6, with these pinned resolutions

- `d = perMachineRate × clockPercent/100`; `D = N × d`; `B` = highest
  unlocked tier for the lane's kind.
- **Infeasibility**: `d > B` → `infeasible-machine-demand`, lane solves to
  belts/segments empty (never render a broken manifold).
- **Combination**: `k = D.ceilDiv(B)`; `k−1` top-tier belts + smallest
  unlocked tier ≥ remainder. Overrides then replace capacities of auto slots
  by index (count `k` never changes). **`overrides.length > k` → an
  `invalid-input 'overrides-exceed-belt-count'` finding on THIS LANE's
  `findings` array** (the lane solves to empty belts/segments; sibling lanes
  are unaffected — this is the one lane-local `invalid-input`, reachable in
  the live UI when machine count drops before the store trims overrides).
- **Entry points**: belt `j` enters after machine `floor(S/d)` where `S` =
  Σ capacities of belts `0..j−1` (actual, post-override); belt 0 at the head
  (0). (The v1 spec's exact-boundary rule — integral `S/d` → after machine
  `S/d` exactly — is already subsumed by `floor`; noted only so the test
  plan's boundary rows read back to it.)
- **Segments**: partitioned by entry points; segment `beltIndex` = the belt
  entering at its head. `peakFlow` = flow just after that entry under the
  **nominal-delivery, head-first-draw model** (pinned): each belt delivers
  its full capacity onto the bus; machines draw `min(d, available)`
  head-first; `peakFlow(span) = survivedIntoSpan + beltCapacity`.
- **Validation**: any `peakFlow > B` → `segment-over-capacity`. Under-supply
  → per-span `starved-machines` per the emission invariants (at most one
  partial machine, then a fully-starved run, until the next entry
  replenishes).

### `solveOutputLane` — the v1 spec's output mirror

- `p = perMachineRate × clockPercent/100`; `T` = highest unlocked tier.
- `p > T` → `infeasible-machine-demand` (mirror semantics: one machine's
  output exceeds the best belt).
- Break-outs: bus fills as it passes machines; break out after machine
  `floor(T/p)` cumulatively (belt `b` covers machines until its span load
  would exceed `T`); count = `ceil(N×p / T)`. Each break-out belt's
  `capacity` = smallest unlocked tier ≥ its `load`; `load` = its span's
  total emissions. Output overrides apply to break-out belt capacities by
  index, same pinned semantics (never move break-out positions, never change
  count); an override below its span load → `segment-over-capacity` on that
  span with `busCapacity` = the overridden belt's capacity (the binding
  limit). **`busCapacity` is defined as the span's binding carrying limit**:
  the bus cap `B`/`T` normally, or the break-out belt's overridden capacity
  when that is the binding constraint — one variant, one meaning ("what this
  span is allowed to carry"), two sources.
- Segments: partitioned by break-out spans; `peakFlow` at the tail (just
  before break-out / lane end); `beltIndex` = the collecting break-out belt.
- No starvation on the output side (machines always emit); the failure mode
  is over-capacity only.

## Test plan (table-driven, Vitest, exact `Fraction` expectations)

1. **20-smelter worked example** (v1 spec §UI, hand-verified): N=20, d=30,
   tiers 60/120/270/480, clock 100%. Feed: k=2, belts [480, 120@after-16]
   (exact-boundary entry), segments [1..16]@480 / [17..20]@120, no findings.
   Output mirror: breakouts after 16, loads 480/120, capacities 480/120.
2. **Fractional rates** (37.5-class): N=13, d=75/2 → D=487.5: k=2, remainder
   7.5 → 60-tier second belt; entry `floor(480 ÷ 37.5)` = after machine 12
   (non-integral floor); exact segment flows.
3. **Exact-multiple boundary**: D an exact multiple of B (600/480 above
   already covers entry; add D=960, B=480 → k=2, remainder 480 → top tier).
4. **Clock scaling**: 150% and 66⅔% cases scale d exactly (no floats).
5. **Override breaks manifold**: single-belt auto solve overridden down
   (240 vs D=300) → machines 9–10 starved (exact boundary, no partial);
   251.25 supply case → partial machine with exact received/shortfall.
6. **Override exceeds bus cap**: B=270, override→480 → `segment-over-capacity`
   with peakFlow 480 / busCapacity 270.
7. **Oversize overrides array** → `invalid-input 'overrides-exceed-belt-count'`
   asserted on the offending **lane's** `findings` (lane empty; sibling lanes
   solved normally; stage `findings` empty).
8. **Infeasible single machine**: d=812 vs top 480 (spec's own numbers) →
   `infeasible-machine-demand`, empty lane render.
9. **Degenerate**: N=0; empty feeds (extractor); fluid-only lanes (pipes
   300/600 capacity table) — empty lanes, no crashes, pipes share the math.
10. **Validation inputs**: non-ascending capacities, negative rate,
    zero/negative clock, fractional machineCount → `invalid-input`.

Test-bidirectionality log per the workflow rule
(`features/manifold-visualizer/phase-1/r2-verification.log` at
implementation).

## Acceptance criteria (mirrors ticket #3)

- All types above exported from `src/core/manifold.ts` exactly as written.
- All ten test-plan rows green; `npm run check` + `npm test` green; purity
  allowlist untouched.
- The cumulative phase diff dual-reviewed; merged `--no-ff` to `develop`.

## Assumptions ledger

- **Fraction API suffices, unchanged** — verified against
  `src/core/fraction.ts` (brainstorm r1–r4 reviewers re-verified: `mul`,
  `div`, `add`, `sub`, `ceilDiv`/`floorDiv` → bigint, comparisons, `isZero`).
- **Nominal-delivery model is conservative and correct for a logical
  planner** — each feed belt modeled at full capacity for bus-load checks;
  real belts run under capacity when supply exceeds demand; over-capacity
  findings are thus conservative (never false-negative). Head-first draw is
  the correct steady-state starvation model (buffers saturate head-first) —
  settled in brainstorm r2–r4.
- **The v1 spec's formulas are complete** — every behaviour above cites
  §Core math / §Validation; nothing is invented beyond the pinned
  resolutions recorded in the frozen brainstorm.
- **Solver defines the contract; Phase 2 maps onto it** — locked at the epic
  (#2 decisions); capacities arrive as ascending `Fraction` lists from the
  catalog.

## Revision history

**Round 1 design review** (code-reviewer: NEEDS_REWORK, 3 findings;
adversarial-reviewer: APPROVED_WITH_NITS, 1 — both converging on the same
core defect). All folded; none rejected:

- **Oversize-overrides placement pinned** (both reviewers): removed from the
  stage-validation list (it is lane-local by construction — `k` doesn't exist
  pre-solve); now specified in the lane solve: finding on the offending
  lane's `findings` array, lane solves empty, siblings unaffected.
  `StageSolveResult.findings` comment reworded to the clean partition
  (stage-global invalid-input on stage; all lane-scoped findings on lanes);
  test row 7 pins the assertion target.
- Exact-boundary entry clause marked as subsumed by `floor` (code-reviewer
  NIT) — kept only as a read-back pointer to the v1 spec's phrasing.
- Adversarial round-1 attacks that failed (recorded for the implementer):
  row-2 fractional feasibility confirmed clean (span-2 supply 90 ≥ 37.5);
  busCapacity dual-source coherent; output side has no starvation mode;
  break-out positions independent of belt-capacity overrides.
