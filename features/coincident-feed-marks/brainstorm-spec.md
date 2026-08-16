# Coincident feed marks: bounded render grouping

Forgejo #123 | Tier 2 single feature | design v5

## Problem and source-grounded scope

The solver deliberately preserves every feed slot, including zero-capacity and
oversized overrides. Two valid paths can therefore put several slots at the
same boundary:

- `overrides: [0, null]` leaves feed 1 and the following automatic feed at the
  head (`entersAfterMachine = 0` for both); and
- an oversized earlier override can push the cumulative quotient past `N`, so
  every later entry is clamped to `N`.

`src/core/manifold.ts` emits one `FeedBelt` per slot and explicitly carries
capacity through empty spans. Both layout engines preserve that truth:
`src/ui/layout.ts` emits one arrow per belt at its boundary x, while
`src/layout/layout.ts` emits one `BeltMark` per belt and documents coincident
marks as legal. `Schematic.tsx` and `Blueprint.tsx` currently render those raw
arrays one element at a time. Equal coordinates consequently overpaint all but
the last arrow, circle, label, and pointer target.

This ticket changes presentation only. It does not change solver arithmetic,
entry boundaries, slot count/order, override persistence, starvation or
capacity findings, bus segments, foundations, or output marks.

Implementation starts only after #120 has landed and this branch has been
rebased onto that `develop`. #120 establishes the focus-capable, single custom
tooltip mechanism in `Schematic`; #123 must reuse it rather than introducing a
second tooltip or reverting to SVG `<title>`.

## Approaches considered

### 1. Group equal anchors (selected)

Keep every raw mark, but form render-only groups by exact x coordinate. A
singleton renders exactly as today. A collision renders one truthful anchor,
a bounded count/aggregate label, and one focusable semantic group.

This keeps the machine boundary exact, scales to any slot count, and gives both
views the same grouping rule without changing layout contracts.

### 2. Fan or displace each mark

Offsetting marks gives every slot separate ink and pointer area, but a naked
offset falsely claims a different entry boundary. Leader lines would restore
truth at the cost of fan geometry whose width or height grows with slot count,
crosses neighboring lanes, and still needs label collision handling. Rejected.

### 3. Show only the last mark and add a warning

This is the current accidental behavior with explanatory copy. It still hides
valid slots and does not provide a keyboard or nonvisual representation.
Rejected.

## Chosen data boundary

Add one small pure UI helper, `groupCoincidentMarks`, in
`src/ui/coincident-feed-marks.ts`. It accepts an ordered array and a numeric
coordinate selector and returns groups in first-occurrence order, with members
in original order. Equality is exact (`Map<number, ...>`); both layouts produce
integer coordinates from the same integer machine boundary, so no epsilon or
rounding policy is needed.

The helper does not deduplicate, sort, sum, format, or know about React,
`FeedBelt`, Blueprint, or Schematic. Both renderers use it only for feed marks.
Output breakouts remain unchanged. The raw `LaneTrack.belts` and
`LaneLayout.marks` arrays remain one member per logical slot; the existing
layout test that asserts distinct coincident indices remains authoritative.

For a coincident group, member indices are consecutive. This follows from
nonnegative capacities and cumulative entry positions: entry boundaries never
move backwards, so once a later boundary is reached, an earlier equal boundary
cannot recur. Rendering nevertheless derives the displayed first/last indices
from actual members rather than assuming arithmetic continuity.

## Bounded group semantics

Add a pure `feedGroupLabel` formatter for non-singleton `FeedBelt` groups:

```text
Feeds 1-2 - 2 slots - 120/min total capacity - enter at head
Feeds 2-4 - 3 slots - 1440/min total capacity - enter after machine 60
```

These ASCII strings are the exact contract; `formatRate` does not add digit
grouping. The fields are fixed in number: slot range, count, exact summed capacity, and
the shared entry boundary. The formatter never concatenates one label per
member, so tooltip, accessible name, and visible labels do not grow linearly
with slot count. `Fraction` addition and `formatRate` retain exact rate
formatting. The zero slot remains represented by the range and count; its exact
override value remains visible in the existing per-slot override row.

`feedGroupLabel` is used as the Schematic tooltip and `aria-label`. Blueprint
uses the same string as its `aria-label`, while its on-drawing label is a bounded
count token: exact `x<count>` through 99, then `x99+`. Thus every logical slot is
represented exactly in the accessible range/count/total while the visible token
never grows beyond four characters.

## Schematic rendering and interaction

Inside each feed `LaneG`, group `track.belts` by `arrow.x` and resolve members
through their unchanged belt indices.

- Singleton groups render the current `.belt-arrow` line unchanged, including
  tier color, pipe dash, hover tooltip, and key.
- A group of two or more renders one `.feed-mark-group` at the exact shared x,
  one fixed-width double-stem group glyph, and no coincident duplicate lines.
- The grouped arrow uses a neutral foreground stroke, not one member's tier
  color. A collision may mix zero/custom, automatic, and overridden capacities;
  assigning one tier color would be false. Pipe groups retain the existing
  dashed treatment.
- Schematic uses the same bounded count token as Blueprint (`xN` through 99,
  then `x99+`). A pure lane-level placement helper processes grouped marks in
  increasing anchor order. For each 28px token it tries the right interval with
  a 4px gap, then the left interval. A candidate must remain inside the lane,
  contain no other mark anchor, and not intersect an interval already reserved
  by an earlier grouped token. If neither candidate is clear, suppress the
  token. This deterministic reservation rule prevents two nearby groups from
  choosing inward-facing labels that overlap each other. The double-stem glyph
  always remains, so a dense group is still visibly distinct from a singleton.
  Exact count/range/total remains in the tooltip and accessible name. No text
  box may cover an adjacent arrow or another group token.
- The group is `tabIndex={0}`, `role="img"`, and has the bounded
  `feedGroupLabel` as its exact `aria-label`.
- Mouse enter/move shows that label through the existing component-local
  custom tooltip. Focus shows the same tooltip anchored from the grouped
  glyph's bounding rectangle; blur and mouse leave hide it. This reuses #120's
  focus/blur tooltip path and state. No SVG `<title>`, second tooltip state,
  click-to-expand behavior, or member-list tooltip is added.
- `:focus-visible` increases the grouped arrow/count contrast without changing
  geometry. The focus state must be visible in both belt and dashed-pipe forms.

Touch users see the count at the exact entry boundary when placement is clear.
When density forces suppression, the fixed double-stem glyph discloses that the
anchor represents multiple slots; exact per-slot values remain in the existing
touch-operable override rows. Keyboard users can focus the group and read the
exact bounded tooltip. Nonvisual users receive the same label through the
accessible name. The design deliberately makes no exact-count-on-tap promise
for a suppressed token; adding a reliable touch-sized SVG target without
overpainting adjacent 8px-pitch marks would create a conflicting hit region.

## Blueprint rendering and interaction

`Marks` uses a discriminated prop shape: the `side="feed"` arm receives the feed
lane's original `FeedBelt[]` alongside the existing layout marks, while the
`side="output"` arm has no feed-belts prop. This prevents an output call from
accidentally entering grouping logic. Feed marks are grouped by `mk.at.x` at
render time; output calls retain their current loop.

- Singleton feed marks and every output mark retain today's circle and exact
  rate label.
- A coincident feed group renders one circle at the exact shared point and one
  bounded count token (`x2` ... `x99+`). Exact count and summed capacity remain
  in `feedGroupLabel`; the sum is capacity, not demand or carried segment flow.
- The group is `tabIndex={0}`, `role="img"`, and uses `feedGroupLabel` as its
  `aria-label`. A dedicated `:focus-visible` stroke on the existing circle
  provides a reliable SVG focus indication.
- Blueprint does not gain tooltip state, SVG `<title>`, expansion, or a slot
  list. The compact visible count token and bounded accessible name are enough;
  exact per-slot override values remain in the unchanged override controls.
- Group labels retain `MARK_LABEL_DY`, the existing halo, and existing overflow
  posture. Use a fixed 12dm x-offset and compact mono style whose four-character
  maximum is at most 28dm wide. The physical layout's minimum machine pitch is
  60dm, so a grouped token ends before the next boundary's existing rate label
  begins. No measurement, displacement, foundation expansion, or lane spacing
  is required.

The group circle remains accent-colored as Blueprint marks are today; unlike
Schematic arrows, Blueprint marks do not currently encode tier by color.

## Test-first implementation

Write failing tests before production edits.

1. Pure grouping tests pin stable first-occurrence order, original member
   order, exact-coordinate grouping, singleton retention, and no input
   mutation.
2. Formatter tests pin the exact head and clamped-tail strings, including a
   zero-plus-auto total and a three-slot mixed-capacity total. Add a mutation
   check showing count/range/total/boundary assertions all fail when omitted or
   computed from only the last member.
3. Use the real solver for the zero-followed-by-auto fixture:
   `N=20`, `d=30`, unlocked belt top `480`, overrides `[0, null]`. Assert belts
   remain indices `[0,1]`, entries `[0,0]`, and capacities `[0,120]` before
   rendering.
4. Render that fixture in Schematic. Assert one grouped feed arrow at the head,
   visible `x2`, bounded group `aria-label`, no two overpainted feed arrows, no
   native `<title>`, and unchanged findings/override semantics.
5. Render the same fixture in Blueprint. Assert raw layout still has two marks,
   while markup has one grouped circle, compact `x2`, and the same bounded
   accessible name including `120/min` total.
6. Use a second real-solver fixture for multiple clamped entries:
   `N=60`, `d=30`, top `480`, four automatic slots, override slot 1 to `1800`.
   Assert entries `[0,60,60,60]`; the tail group is slots 2-4 with three raw
   marks and exact summed capacity `480 + 480 + 480 = 1440/min` from the emitted
   belts.
7. Pin the clamped fixture in both Schematic and Blueprint: one tail anchor,
   visible `x3`, correct slot-range/count/total/boundary accessible name, and no
   hidden duplicate pointer glyphs.
8. Add the reachable adjacent-mark fixture `N=5`, `d=250`, top `480`, overrides
   `[0,null,null]`: capacities `[0,480,480]`, boundaries `[0,0,1]`. Blueprint
   renders bounded `x2` at the head and the existing `480/min` singleton at the
   next 60dm boundary; pin the 12dm offset / <=28dm token bound so they cannot
   overlap. The grouped accessible name still reports exact 480/min total.
9. Add the dense Schematic fixture `N=115`, `d=480`, top `480`, with a zero first
   override followed by automatic slots. Its head group and boundary-1 singleton
   are 8px apart. Assert the fixed group glyph remains, bounded text is
   suppressed because neither side has 32px clearance, the adjacent arrow stays
   unobscured, and exact group text remains in tooltip/ARIA. Also pin right-side,
   left-side, and `x99+` placement-helper rows.
10. Add the reachable facing-group fixture `N=115`, `d=30`, top `480`, overrides
   `[3300,0,300,null,null,null,null,null]`. Assert grouped anchors at boundaries
   110 and 115 (40px apart), the first reserves its right-side token interval,
   the tail group does not place an overlapping left-side token, and every
   visible token interval is pairwise disjoint. Pin the deterministic fallback
   or suppression result rather than relying on DOM order.
11. A jsdom interaction test focuses a Schematic group, observes the existing
   custom tooltip with exactly the `aria-label` text at a deterministic
   glyph-relative position, then blurs and observes removal. Mouse hover remains
   covered. A render assertion pins the always-painted double-stem glyph in the
   suppressed-token fixture, while existing override-row tests remain the
   touch path to exact slot values. CSS selectors pin visible focus treatment
   for both views.
12. Regression cases pin that separated feed marks remain byte-for-byte in the
   existing singleton structure, output marks are untouched, pipe grouping
   keeps its dashed class, and raw layout arrays are never grouped or deduped.

Run focused helper/format/layout/UI tests, `npm run check`, the full suite,
`npm run build`, and `git diff --check`. Record bidirectional mutation evidence
for grouping and render assertions. Visually inspect both fixtures in
Schematic and Blueprint at DETAIL and FIT widths; verify head/tail labels do
not overlap adjacent lane names or leave the SVG incoherently.

## Expected file surface

- `src/ui/coincident-feed-marks.ts` and focused unit test: shared pure grouping.
- `src/ui/format.ts` and test: bounded feed-group label.
- `src/ui/Schematic.tsx`: grouped feed arrows using #120's tooltip path.
- `src/ui/Blueprint.tsx`: grouped feed circles and compact aggregate label.
- `src/ui/app.css`: count halo and SVG focus-visible treatment.
- UI smoke/interaction tests for both real solver fixtures.
- Feature verification log and completion note after implementation.

No production edit is expected in `src/core`, either layout module, state,
serialization, findings, override controls, or output rendering.

## Acceptance criteria

- Zero-followed-by-auto and three clamped tail slots are visibly grouped in
  both views at their exact original boundary.
- Every logical slot remains in solver/layout data and is represented by the
  group's slot range and count; override rows and semantics are unchanged.
- Coincident groups have one coherent pointer target, keyboard-visible focus,
  and a bounded nonvisual name. Schematic focus exposes the same bounded text
  visibly through its existing tooltip.
- No member-list label, fan-out geometry, broad tooltip system, native
  Schematic `<title>`, or tier-colored mixed group is introduced.
- Singleton feeds and all outputs retain current behavior and appearance.

## Revision history

- **v1:** selected render-only grouping with bounded semantic summaries.
- **v2:** replaces the collision-prone Blueprint count-plus-total drawing with a
  four-character bounded count token and pins a grouped-plus-adjacent fixture;
  exact total remains in the accessible name and Schematic tooltip.
- **v3:** applies the bounded token to Schematic, always draws a fixed group
  glyph, and conditionally places or suppresses text from exact adjacent/edge
  clearance, including the reachable 8px-pitch fixture.
- **v4:** makes label placement lane-global with reserved intervals for nearby
  groups, and attempted suppressed-count touch activation through the existing
  focus-tooltip path (removed in v5 after hit-testing review).
- **v5:** corrects fixture capacities to the solver's selected unlocked tiers
  and narrows the dense-touch contract to visible grouped-state disclosure plus
  the existing exact override controls.

## Assumptions ledger

- **Coincidence is legal:** grounded in solver empty-span handling and the
  existing physical-layout test/comment that preserves distinct coincident
  indices.
- **Exact numeric grouping is safe:** grounded in both layout engines deriving
  integer x from integer machine boundaries; no float rate enters geometry.
- **Coincident indices are contiguous:** grounded in cumulative nonnegative
  feed capacity, which makes entry boundaries monotone; negative overrides are
  rejected before layout.
- **A neutral Schematic group is truthful:** capacities in one collision can
  differ, so no single tier color describes the group. Blueprint mark color is
  already capacity-independent.
- **Bounded summaries preserve topology:** slot range, count, total capacity,
  and shared boundary represent the whole group without a label proportional
  to member count; exact slot values remain available in existing override
  rows.
- **#120 tooltip reuse is available:** implementation is explicitly sequenced
  after #120 lands; rebase is a prerequisite, not an assumed hidden API.
