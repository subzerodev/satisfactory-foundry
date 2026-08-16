# Parallel feed buses: model buildable unlocked-tier bundles (#120)

Status: Frozen after correctness convergence and one-shot simplify approval.

## Purpose

Michael's Wet Concrete plan has 106 Refineries consuming Limestone at 120/min.
The solver correctly supplies 12,720/min with 17 incoming Mk5-or-lower belts,
but models each carried span as one bus and emits eight false `840 > 780`
errors whose only advice is to unlock Mk6.

The factory is buildable with parallel Mk5 bus lines. Model and show that exact
topology without changing incoming feed slots or explicit override meaning.

## Settled decisions

- Parallel unlocked-tier belts/pipes are valid; a higher tier is optional.
- Preserve exact `Fraction` arithmetic, feed combination, entry positions,
  starvation, saved overrides, and output behavior.
- A single machine whose demand exceeds the best unlocked line remains
  infeasible.
- #121 rejects negative overrides; zero remains valid.
- An override edits **one belt/pipe slot's load**, matching the visible copy
  `type a rate to override a belt's load`. It does not silently create more
  inlet lines. An explicit slot load above top capacity keeps its existing
  `segment-over-capacity` finding and presentation.

## Exact reproduction

- Demand: `106 * 120 = 12,720/min`.
- Incoming feeds: `ceil(12,720/780) = 17`: sixteen 780 loads plus one 270.
- Aggregate supply: `16*780 + 270 = 12,750`, leaving 30/min headroom.
- Entry positions remain
  `0,6,13,19,26,32,39,45,52,58,65,71,78,84,91,97,104`.
- After six machines, 60/min survives; the next 780 feed makes 840/min across
  machines 7-13. This repeats for exactly eight spans.

The missing datum is bus cardinality, not source throughput.

## Design correction after v2-v7

Earlier drafts allowed an explicit oversized override to become multiple
physical inlet lines. That choice forced new inlet cardinality, mixed-tier
coincident marks, unbounded counts, bigint summary aggregation, long grouped
tooltips, and new cross-view accessibility state. It also contradicted the
current UI's one-slot/one-belt wording.

Reject that expansion. Preserve existing oversized-override behavior and add
parallel cardinality only when the associated incoming slot itself fits one
unlocked line. This is the smallest model that fixes Michael's automatic plan.

## Core model

Extend `BusSegment` with:

```ts
parallelCount: number;
```

For a feed segment whose associated `FeedBelt.capacity <= B`:

```text
parallelCount = max(1, ceil(peakFlow / B))
```

Use exact `Fraction.ceilDiv`, then convert directly to number. No safe-index
guard is needed: head-first drain leaves `0 <= survivedIn < d`, the existing
single-machine guard proves `d <= B`, and the incoming slot proves
`capacity <= B`; therefore `peakFlow = survivedIn + capacity < 2B` and the
result is exactly `1` or `2`.

For an explicit slot with `capacity > B`, set `parallelCount=1` and preserve the
existing feed `segment-over-capacity` finding. Do not reinterpret the slot,
change its arrow/tier/color, or legalize its load.

Every output segment sets `parallelCount=1`; output solving and findings remain
unchanged.

Remove feed-side `segment-over-capacity` only for bundle-eligible
`capacity <= B` segments. Starvation findings remain authoritative even when a
valid `x2` segment also starves later machines.

## Presentation

### Summary cards

Keep the existing physical inlet count (`lane.belts.length`). If any eligible
feed segment is parallel, append:

```text
17 x belt - bus up to 2 parallel
```

All-single-line lanes keep the current terse count. No bigint aggregation or
logical/physical inlet distinction is introduced. Scan every tier above the
best unlocked tier and select the first whose capacity carries the lane's
highest bundled peak on one line. When one exists, append a
non-error alternative such as `Mk6 supports one bus line`. This is optional
planning information, never a recovery instruction or finding. Because the
selected tier carries the lane's highest bundled peak, it necessarily carries
every lower bundled peak in that lane.

### Schematic

- Eligible `parallelCount=2` segments use a fixed two-rail glyph. Both bus
  rails use the best unlocked lane tier's color, independently of the incoming
  arrow's tier/color. A lower-tier remainder feed may therefore enter a pair of
  top-tier bus rails; the rails truthfully represent their own capacity.
- Adjacent `x2` segments form one contiguous marker run. Render one fixed-width
  `x2` label at its midpoint only when the run is at least 20px wide; otherwise
  the two-rail glyph carries the visual detail.
- Tooltip: `machines 7-13 - peak 840/min - 2 parallel lines x 780/min`.
- Scan every tier above the best unlocked tier and select the first whose
  capacity carries that segment peak on one line. When one exists, append e.g.
  `Mk6: 1 line` to its tooltip. A locked tier that still needs two lines is
  skipped. This remains optional information and does not create a finding.
- Each bundled segment glyph is one focusable SVG group with `role="img"`, an
  exact `aria-label` matching its tooltip, and a visible `:focus-visible`
  treatment across both rails. Do not add an SVG `<title>`: the existing custom
  tooltip remains the sole tooltip mechanism. Mouse enter/move anchors that
  tooltip at the pointer as today. Focus anchors the same tooltip beside the
  grouped glyph using its bounding rectangle; blur hides it. Reuse the one
  existing component-local tooltip state for hover and focus, with no second
  tooltip state or mechanism. Keyboard users can therefore read the visible
  exact text, nonvisual users receive the same text through `aria-label`, and
  touch users retain the unmistakable fixed two-rail glyph. No long member-list
  tooltip is introduced.
- Parallel cardinality alone is not an error. Existing starvation-based
  `segmentErrored` styling still colors a bundled span when applicable.
- Explicit oversized override segments keep their current single-line error
  styling, arrow, tier/color, and advice.
- Pipes retain their dashed treatment on both rails.

Because bundle cardinality is bounded to the fixed text `x2`, marker-run width
and the 20px floor are sufficient; unbounded label measurement is unnecessary.

### Blueprint

Carry `maxParallelCount` on `LaneLayout`, derived from feed segments and
defaulting to `1` when the segment list is empty; output is always one. A feed
ribbon whose maximum is two renders a fixed `x2 max` marker
only when that fixed label fits inside the bus extent; otherwise suppress the
text while retaining the existing ribbon. Blueprint inlet marks are unchanged.
No tier-table prop, per-mark cardinality, grouped tooltip, or segment geometry
is added.

### Findings

No new finding sentence is needed for a valid automatic bundle. The false Mk6
recovery advice disappears because the corresponding capacity findings no
longer exist. The optional higher-tier summary/tooltip remains when it reduces
parallel cardinality. Existing advice remains for explicit oversized override
slots and output breakouts.

## Compatibility

- Feed count, `FeedBelt`, capacities/loads, slot indices, entry positions, and
  saved override arrays are unchanged.
- `BusSegment.parallelCount` and `LaneLayout.maxParallelCount` are derived and
  not serialized.
- Plan format remains unchanged.
- Existing explicit oversized override, zero override, starvation,
  single-machine infeasibility, and output behavior remain unchanged.

## Test-first implementation

RED before production edits:

1. Michael regression: `N=106`, `d=120`, tiers through Mk5. Expect 17 feeds,
   exactly eight 840/min segments with `parallelCount=2`, every other segment
   one, no feed capacity finding or sole-recovery wording, and an optional Mk6
   one-line alternative in summary/tooltips.
2. Exact boundaries for eligible slots: `peak=B -> 1`, `peak=B+epsilon -> 2`,
   and `peak<2B`; prove every eligible result is one or two.
3. Non-divisible pipe case follows the same exact rule and dashed rendering.
4. An explicit override `capacity>B` retains `parallelCount=1`, its existing
   `segment-over-capacity` finding, arrow/tier/color, and override-table row.
5. Multi-feed undersupply still reports exact partial/starved machines.
6. A valid `x2` segment that also starves later machines remains error-colored.
7. Every output segment remains one and all output findings are unchanged.
8. Summary appends `bus up to 2 parallel` only when required.
9. Schematic two-rail glyph, top-unlocked-tier rail color independent of a
   lower-tier inlet arrow, `x2` run marker/short-run suppression, exact
   focusable semantics, optional higher-tier tooltip, pipe class, and
   error-class behavior are pinned, including 8px pitch. Include
   `N=87`, `d=638`, `B=780`: its 270/min remainder feed creates a bundled
   782/min span whose two rails are Mk5-colored while its inlet remains Mk3.
   Pin no nested SVG `<title>` and no duplicate native tooltip. Also pin a tier
   table where the first locked tier still needs two lines and a later tier is
   the first one-line alternative. Focus must show the same custom tooltip at a
   deterministic glyph-relative position and blur must hide it.
10. Blueprint carries maximum two, renders `x2 max` only when it fits, and
    leaves inlet marks unchanged. Empty/degenerate/infeasible lanes pin
    `maxParallelCount=1`.

Then run focused core/layout/UI tests, `npm run check`, the full suite, and
`npm run build`. New tests require bidirectional mutation evidence.

## Documentation

- Update manifold comments to define the bounded eligible bundle invariant.
- Add a deploy-facing changelog entry explaining the corrected Mk5 plan.
- Preserve prior review prompts as the audit trail for the rejected broad model.

## Acceptance criteria

- Michael's plan remains 17 incoming Limestone feeds and shows exactly eight
  `x2` Mk5 bus spans.
- It emits no false Limestone capacity finding or Mk6-only advice.
- Summary, Schematic, and Blueprint disclose the valid bus bundle without
  changing inlet topology.
- Explicit oversized overrides retain existing one-slot error semantics.
- Belts and pipes share exact bounded bundle math.
- Starvation, single-machine infeasibility, outputs, and serialization remain
  unchanged.
- Correctness converges and the one-shot simplify lens is dispositioned.

## Assumptions ledger

- **Seventeen feeds suffice:** exact aggregate calculation above, with 30/min
  headroom.
- **Parallel buses are buildable:** settled by Michael's field report.
- **Override is one slot's load:** grounded in `LaneOverrides` visible copy and
  current one-row-per-`FeedBelt` persistence.
- **Eligible cardinality is bounded to two:** proven from drain residual, the
  single-machine guard, and `capacity <= B`, not assumed from the screenshot.
- **Fixed markers are enough:** every new count label is literally `x2` or
  `x2 max`; no unbounded count enters rendering.

## Revision history

- **v1:** rejected 18-span redesign changed override topology.
- **v2-v7:** preserved 17 slots but incorrectly expanded oversized overrides
  into physical inlet bundles. Reviewer findings exposed the resulting
  cross-view and unbounded-state cost.
- **v8:** narrowed to bundle-eligible single-line input slots, preserving
  explicit oversized override errors and deleting the speculative inlet,
  bigint, grouped-tooltip, and accessibility subsystems.
- **v9:** pins top-tier bus-rail color independently from a remainder inlet,
  restores minimal per-segment SVG accessibility, defines the empty-lane
  maximum as one, and preserves a higher tier as optional one-line planning
  information rather than a false buildability recovery.
- **v10:** preserves the existing single custom-tooltip contract and makes the
  optional upgrade search select the first later tier that actually carries the
  relevant peak, skipping locked tiers that do not reduce cardinality.
- **v11:** reuses the existing custom-tooltip state on focus/blur so sighted
  keyboard users receive the exact segment details, and removes an unreachable
  partial-lane upgrade branch.
