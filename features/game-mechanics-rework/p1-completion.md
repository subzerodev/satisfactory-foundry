# P1 completion report — solver overflow-chain core (#151, child of #140)

**Merged:** `feature/phase-p1` → `develop`, `--no-ff`, 2026-08-19 (six commits
`be199ba..3e54235`; a net-negative diff, +784/−866).
**Spec:** `p1-brainstorm-spec.md`, frozen at r3 (`3109992`), prose-corrected at
the diff review.
**Trunk state after merge:** 1178 tests green, `npm run check` clean (verified
after worktree removal).

## What landed

- **The overflow-chain core (D1).** `BusSegment` reports `entryFlow`
  (residue-in + belt capacity — the ribbon's reset thickness) and
  `handoffResidue` (trunk carry past the last machine) instead of
  `peakFlow`/`parallelCount`. The drain arithmetic is bit-identical to the
  old model (adversarially verified line-by-line) — the change surfaces
  already-computed values and retires the false x2 claim. The
  `segment-over-capacity` finding's field renamed to `flow`; it fires only
  on an explicit over-B override.
- **Hardware + cascades (D2, c24797).** Per belt feed lane: splitter count
  (one per flow-receiving machine, partial included), seam-merger count
  (stretches with residue-in > 0), and 3-way cascade counts/tiers for the
  lane head fan-out (`cascadeFor`: junctions = ceil((ways−1)/2), tiers by
  repeated ×3). Output lanes get the merger mirror (`collectionCascade`).
- **Standing buffer (D3, c24796).** `standingBufferItems = 9 × splitters`,
  the one table line.
- **Pipe Level-1 honesty (D4, c24770).** Pipe feed lanes emit no segments,
  no hardware, no buffer; an undersupplied pipe lane emits ONE unordered
  `lane-undersupplied` finding with the nominal-ceiling caveat. Belt lanes
  keep ordered starvation (the drain order is the physical order).
- **The x2 surface retired (D5).** Schematic highlights, the "N parallel
  lines ×" copy, "bus up to 2 parallel", "supports one bus line" (#139's
  self-contradictory pairing — RESOLVED by removal), Blueprint's "x2 max"
  marker, `firstLockedTierForOneLine`, the layout parallel fields, and five
  dead CSS rules. `parallel-feed-belts.test.tsx` replaced by a single-lane
  smoke with a RETIRED-string blacklist anchored on positive render pins.
- **8411 verified end-to-end:** 17 belts, residues alternating 60/0, the
  eight old x2 artifacts are now exactly eight seam mergers; splitters 106,
  buffer 954, headCascade {17 ways, 8 junctions, 3 tiers}.

## Review trail

- **Design:** 3 rounds (r1–r3) + zero-finding simplify. r1 caught the
  blast-radius under-enumeration (both reviewers) and produced one REJECTED
  adversarial claim (the ≥ d residue — refuted by the mod invariant, three
  independent re-derivations on record). r2/r3 closed the sweep to seven
  pin files.
- **Diff:** code-reviewer APPROVED_WITH_NITS + adversarial
  APPROVED_WITH_NITS; simplify APPROVED zero findings. Nits folded
  (`3e54235`): five dead CSS selectors (the string-only sweep gate missed
  class names — gate extended), and the spec's worked-example prose error.
- **Bidirectionality:** `p1-verification.log` — six behaviours
  mutation-proven with compiling mutants and genuine FAILs; no green
  mutants.

## The terminal-residue adjudication (both reviewers, on the record)

The implementer surfaced (not improvised) the one spec conflict: the frozen
prose said the 8411 terminal hand-off is 0; the mechanism computes **30**
(Mk3 270 capacity − 240 tail demand). Adjudicated correct-as-implemented:
the old model already computed the same terminal `survived = 30` (the diff
changed nothing semantically), and the spec's own D1 principle ("honest
surplus") sanctions it. The prose conflated tail demand with tail capacity;
corrected in the spec.

## P2 hand-off caveats (MUST be honored in the P2 design)

1. **Terminal endpoint ≠ hand-off residue.** The terminal stretch's
   `handoffResidue` is UNUSED CAPACITY (30 in the 8411 case), a different
   quantity from decision c24769's ribbon "final 0" (onward flow — always 0
   on a demand-met lane). P2's ribbon must not render terminal surplus as
   "30/min leaves the lane". Options for P2: draw the taper to the
   flow-conserving 0 and show surplus separately, or annotate the surplus
   distinctly.
2. **`segTooltip` still says "peak".** D5 was mechanical silencing only; the
   tooltip copy ("machines X–Y · peak N/min of M/min") is stale against the
   entry/hand-off vocabulary — P2's format pass owns the rewrite (pins at
   format.test.ts + smoke.test.tsx re-pin then).

## Acceptance criteria

All five met: zero parallel-line claims with entryFlow ≤ B on auto lanes and
the eight seams (1), ribbon-ready endpoints + hardware + cascades + buffer
(2), pipe honesty (3), the x2 vocabulary gone repo-wide including class
names (4), suite + lint green (5).
