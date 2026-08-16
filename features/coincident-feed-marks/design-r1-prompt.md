# Forgejo #123 design review r1

Review `features/coincident-feed-marks/brainstorm-spec.md` as a hard-gate design
artifact for the Tier 2 fix "Group coincident feed inlet marks without hiding
slots."

## Ticket contract

Zero overrides can leave a following automatic feed at the same boundary, and
oversized overrides can clamp several later feed entries to `N`. Schematic and
Blueprint currently overpaint equal-coordinate arrows/marks, hiding earlier
labels and pointer targets. The fix must preserve every logical slot and all
override semantics while providing collision-safe visible, keyboard, and
nonvisual presentation in both views. Pin zero-followed-by-auto and multiple
clamped entries. Avoid broad tooltip systems and unbounded labels.

## Sequencing

Implementation is intentionally after #120. Its frozen v11 design establishes
one focus-capable custom tooltip state in Schematic and forbids nested SVG
`<title>`. Review #123 on the stated prerequisite that its branch is rebased
after #120 lands; flag any duplicated or conflicting tooltip mechanism.

## Source anchors to inspect

- `src/core/manifold.ts:362-457`: slot replacement, monotone cumulative entry
  positions, clamp to `N`, and legal empty spans.
- `src/core/manifold.test.ts:390-440,475-540`: oversized and zero override
  behavior.
- `src/ui/layout.ts:212-243`: Schematic feed arrows remain one per belt.
- `src/layout/layout.ts:44-61,174-205`: Blueprint marks remain one per belt and
  explicitly permit coincidence.
- `src/layout/layout.test.ts:180-220`: raw coincident marks preserve indices.
- `src/ui/Schematic.tsx:63-163,247-266`: current arrow rendering and sole custom
  tooltip.
- `src/ui/Blueprint.tsx:213-221,262-302`: current mark rendering and labels.
- `src/ui/format.ts:65-92`: existing per-belt labels and exact rate formatting.
- `src/ui/app.css:680-705,749-780,983-1005`: tooltip, arrow, and mark styling.
- `features/parallel-feed-belts/brainstorm-spec.md` on #120's branch: frozen v11
  focus-tooltip and unchanged-Blueprint-inlet decisions that #123 follows.

## Review questions

1. Does render-only exact-coordinate grouping preserve solver/layout slot
   identity, order, entry boundaries, and saved override semantics?
2. Are the two real-solver fixtures reachable and arithmetically correct,
   especially `[0,0]` for `[0,null]` and `[0,60,60,60]` after the 1800/min
   override?
3. Is the bounded slot-range/count/total/boundary summary sufficient and
   truthful for mixed capacities without introducing an unbounded member list?
4. Do mouse, keyboard, touch-visible, and nonvisual users retain a coherent
   representation in both views? Is any sighted-keyboard detail missing?
5. Does the neutral Schematic group avoid false tier semantics while retaining
   pipe distinction and visible focus?
6. Is one small shared grouping helper justified, or can the same invariant be
   expressed more simply without letting the views drift?
7. Are singleton feeds and all outputs demonstrably unchanged, including
   existing geometry, labels, tooltips, and classes?
8. Do the tests prove both no hidden duplicate render targets and no data-layer
   deduplication? Identify any missing mutation direction or edge boundary.
9. Does the design accidentally require layout/foundation changes, label
   measurement, expansion state, a second tooltip, or another subsystem it
   claims to avoid?

Return findings first with severity and exact spec/source citations. End with
exactly one verdict: `APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or
`BLOCKED`.
