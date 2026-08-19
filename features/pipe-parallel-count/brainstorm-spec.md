# #145 — Pipe lanes stop claiming "2 parallel lines"

**Tier 2 · brainstorm+spec (merged, lean).** Design substance dual-reviewed as
gap-report W3(b) (`features/game-mechanics-audit/gap-report.md` @ `ae266b1`);
fix shape approved by Michael (#140 comment 24760; ticket #145). This spec
pins implementation choices only.

## Already settled — do NOT re-litigate

- The defect: `parallelCount = ceil(peak/B)` is computed without a
  `lane.kind` branch, so a pipe lane whose merge peak exceeds the tier renders
  "2 parallel lines" — physically false: parallel pipes share a pressure
  network and do not add (headers `FGPipeNetwork.h:42-43`, `FFluidBox`
  `PressureGroup`).
- The fix shape: for pipes, `parallelCount` stays 1 and the over-tier peak
  emits the existing `segment-over-capacity` finding (#145).
- **Belt behaviour byte-identical.** The belt-side `x2` is being redesigned in
  the #140 arc (overflow chain, decision 24742); this ticket does not touch it.
- Lands ahead of the arc, standalone (#140 comment 24760).

## Purpose

Stop shipping a physically false claim on fluid lanes. Today a Mk1-pipe feed
lane whose `survivedIn + capacity` peak exceeds 300/min renders "2 parallel
lines × 300/min" (`format.ts:144`) and draws a doubled bus (`Schematic.tsx`).
The honest statement is the one the solver already knows how to make: the
segment is over capacity.

## Design

### D1 — the one production change site

`solveFeedLane`'s segment loop (`manifold.ts:422-443`). Current shape:
`bundleEligible = belt.capacity.lte(B)`; bundle-eligible segments compute
`parallelCount = ceil(peak/B)` (bounded 1|2); non-eligible (oversized
override) segments keep `parallelCount = 1` and emit `segment-over-capacity`
when `peakFlow > B`.

New shape — the bundle path becomes belt-only:

```
const bundleEligible = lane.kind === "belt" && belt.capacity.lte(B);
```

and the finding condition widens from `!bundleEligible && peakFlow.gt(B)` to
`!bundleEligible && peakFlow.gt(B)` — UNCHANGED TEXTUALLY, because a pipe
lane with an over-tier peak now falls into `!bundleEligible` and therefore
emits the existing finding. One-line predicate change; the finding emission
line does not move.

Two stale comments are updated in the same edit:

- the block comment at `manifold.ts:418-421` ("…peak is <2B, so ceil division
  is bounded to 1|2") justifies bundling purely by capacity with no kind
  distinction — it gains one sentence: bundling is belt-only, parallel pipes
  share a pressure group and do not add (#145);
- the `BusSegment.parallelCount` type comment at `manifold.ts:46`
  ("feed 1|2, output always 1") becomes "belt feed 1|2; pipe feed and all
  output always 1".

Consequences, by construction:

- **Belt lanes:** `lane.kind === "belt"` leaves every belt path identical —
  byte-identical results (acceptance criterion 1).
- **Pipe lanes, peak ≤ B:** `parallelCount = 1` as before (ceil would have
  been 1 anyway); no finding. Identical results.
- **Pipe lanes, peak > B, slot capacity ≤ B (auto-sized OR overridden at/below
  B — `.lte` is ≤):** previously bundle-eligible, `parallelCount = 2`, no
  finding. Now `parallelCount = 1` + `segment-over-capacity`. THE fix.
- **Pipe lanes, oversized override (> B):** already `!bundleEligible`;
  identical.

### D2 — the output side needs nothing

`solveOutputLane` hardcodes `parallelCount: 1` (`manifold.ts:564`) and emits
`segment-over-capacity` on undersize overrides only. No pipe-specific defect
exists there. Untouched.

### D3 — UI consumers need no code change

All bundle UI keys off `parallelCount === 2` / `> 1`: `Schematic.tsx:81,165-183`
(doubled bus + capacity label), `format.ts:135-144` ("N parallel lines ×"),
`SummaryCards.tsx:33`, `layout.ts:207` (`maxParallelCount`). With pipes never
exceeding 1, these branches simply stop firing for pipes. The
`segment-over-capacity` finding already renders on pipe lanes
(`FindingsPanel.tsx:86`, `Schematic.tsx:64` marks the segment errored) — the
error presentation is the established one users already know from oversized
overrides. Verified consumer-by-consumer; no dead code created (all branches
remain live for belts).

### D4 — behaviour change, stated

A plan with an over-tier pipe lane flips from a silent doubled-pipe render to
an explicit red `segment-over-capacity` finding. That is the decision
(24760): a build error the user resolves (split the lane / raise the tier /
lower the clock), not a silently doubled pipe. No persistence impact — solve
results are derived, never stored (`plan-store` persists selections, not
solves).

### Tests

- **One existing PIPE fixture asserts the OLD behaviour and is REWRITTEN in
  place:** `manifold.test.ts:361-374` ("applies the same exact bundle rule to
  a non-divisible pipe lane") solves a pipe lane to peak 850 > B=600 and
  asserts `parallelCount === 2` + NO finding. Under the fix both assertions
  flip. It becomes the new pipe pin: same fixture, renamed ("a pipe lane
  never bundles — over-tier peak is a finding"), asserting
  `parallelCount === 1` on every segment AND one `segment-over-capacity`
  finding with `busCapacity = B`. Without this rewrite `npm test` cannot go
  green — acceptance criterion 5 is unsatisfiable.
- **A SECOND pre-existing pipe-bundling test, UI layer, is REWRITTEN in
  place:** `parallel-feed-belts.test.tsx:177-214` ("keeps bundled pipes
  dashed…"). Its pipe sub-render (overrides `[1, 600]`, peak 601 > B=600)
  asserts the class `"parallel-rail seg-error lane-pipe"` at `:201` — under
  the fix the rail branch (`Schematic.tsx:183`) no longer fires for pipes and
  the class becomes `"bus-seg seg-error lane-pipe"` (`Schematic.tsx:221`;
  `seg-error` persists — the fixture starves AND now also carries
  `segment-over-capacity`). Re-anchor the assertion to the `bus-seg` class
  and rename the case ("an over-tier pipe renders as a single errored dashed
  line — pipes never bundle"). The test's belt sub-render
  (`minimalParallelResult(115)`, hand-built `parallelCount: 2` BELT segment)
  is untouched and keeps the rail/short-label styling coverage.
- **Belt invariance guard: NO new test.** The behaviour "belt over-peak →
  `parallelCount = 2`, no finding" is already pinned three times over, most
  directly by `manifold.test.ts:311-333` (Michael's 106-refinery plan: eight
  x2 spans at peak 840, `segment-over-capacity` asserted absent). Those
  fixtures stay untouched and ARE the guard. (A new belt pin was specified in
  r3 and removed by the simplify pass: it was redundant, and it could never
  satisfy the bidirectionality rule — the fix is belt-invariant by
  construction, so no belt assertion can fail on revert.)
- **Bidirectionality log** per the workflow rule: the TWO rewritten pipe
  pins (core `manifold.test.ts:361-374`, UI
  `parallel-feed-belts.test.tsx:201`) must FAIL with the one-line predicate
  reverted. Belt fixtures are expected NOT to fail on revert — that is the
  byte-identity claim, not a coverage hole.

## Acceptance criteria

1. Belt lanes: solver output byte-identical — no BELT fixture changes in the
   diff. (Exactly TWO pipe fixtures are rewritten per Tests:
   `manifold.test.ts:361-374` and the pipe sub-render of
   `parallel-feed-belts.test.tsx:177-214`; no other fixture changes.)
2. A pipe lane with peak > tier: every segment `parallelCount === 1`, one
   `segment-over-capacity` finding per offending segment.
3. A pipe lane with peak ≤ tier: output identical to before.
4. PRODUCTION diff touches `src/core/manifold.ts` only; the test diff touches
   `manifold.test.ts` and `parallel-feed-belts.test.tsx` only.
5. `npm test` + `npm run check` green.

## Assumptions ledger

- Parallel pipes share a pressure group and do not add capacity — grounded:
  headers `FGPipeNetwork.h` (audit, adversarially verified).
- No consumer depends on receiving `parallelCount = 2` for pipes — grounded:
  consumer sweep in D3 (grep enumerated all non-test consumers; each keys off
  the value generically, none is pipe-specific).
- `segment-over-capacity` renders acceptably on pipe lanes today — grounded:
  the finding is already emitted for pipe lanes with oversized overrides
  (`manifold.ts:434-443` has no kind branch) and FindingsPanel handles it.

## Revision history

- **r1 → r2** (design review r1, code-reviewer NEEDS_REWORK: 1 IMPORTANT +
  1 NIT, both verified against source and folded): (1) IMPORTANT — an
  existing PIPE fixture (`manifold.test.ts:361-374`) asserts the old
  bundle-on-pipe behaviour and flips under the fix; Tests now rewrites it in
  place as the new pipe pin, and acceptance criteria 1/4/5 are reworded to
  account for it (criterion 5 was unsatisfiable as written — the same
  test-inventory error class the #143 r1 review caught). (2) NIT — D1 now
  updates the stale bundle-rationale comment at `manifold.ts:418-421`.
  Adversarial verdict pending at time of fold.
- **r2 (adversarial r1 folded in):** adversarial-reviewer NEEDS_REWORK — its
  MAJOR was the SAME manifold.test.ts:361-374 fixture (independently found by
  both reviewers; already folded above). Its B1/B3/B4/B5 refutation attempts
  all failed and are recorded sound (empty-span carry, entry-clamp, at-B
  override, degenerate paths all covered; no UI consumer assumes
  parallelCount 2 ⇒ belt). Three further nits folded: (1) the
  BusSegment.parallelCount type comment at manifold.ts:46 added to D1's
  comment touch-up; (2) the consequence enumeration now names the
  overridden-at-B pipe slot (`.lte` is ≤) instead of implying auto-only;
  (3) D2's output-side citation corrected :563 → :564. r2 goes to both
  correctness reviewers.
- **r2 → r3** (design review r2: code-reviewer APPROVED; adversarial-reviewer
  NEEDS_REWORK, 1 MAJOR — a SECOND pre-existing pipe-bundling test, the UI
  twin the core sweep missed: parallel-feed-belts.test.tsx:201 asserts the
  "parallel-rail seg-error lane-pipe" class, which becomes
  "bus-seg seg-error lane-pipe" under the fix; verified against source
  including the full solver trace, overrides [1,600] → peak 601 > 600).
  Folded: Tests gains the rewrite disposition (re-anchor to the bus-seg
  class, keep the belt sub-render's rail coverage); AC1/AC4 name both test
  files. The reviewer's exhaustive sweep of all remaining pipe fixtures
  (smoke, extraction-plan, LinkInspector, manifold degenerate) found no
  third. r3 goes to both correctness reviewers.
- **r3 → r4** (post-convergence simplify pass, claude-simplify-reviewer
  NEEDS_REWORK — advisory, one finding, FOLDED): the r3 "new belt regression
  pin" was (a) redundant — manifold.test.ts:311-333 (the 106-refinery plan)
  plus two adjacent fixtures already pin belt-over-peak → x2 + no finding —
  and (b) internally contradictory: the fix is belt-invariant by
  construction, so no belt assertion can fail with the predicate reverted,
  making the r3 bidirectionality clause unsatisfiable for it. Tests now
  cites the existing fixture as the standing guard and scopes the
  bidirectionality obligation to the two pipe pins. Angles 1-2 cleared
  (structure proportionate; rewrite-in-place is the simpler path). Per the
  dual-review contract this fold re-runs the CORRECTNESS pair only (r4);
  the simplify pass is one-shot and not re-invoked.
