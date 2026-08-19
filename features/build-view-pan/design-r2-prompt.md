# Review request — #154 design (r2)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/build-view-pan/brainstorm-spec.md` (uncommitted, r2)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `66f985a`)
**Stage:** design re-review after fold. r1 verdicts: both NEEDS_REWORK — the shared headline was the p2-drawing.test.tsx pitch-8 fixtures the sweep never named (with the adversarial's proof that the r3 left-fallback trigger INVERTS at 24px); plus the compression pins, the de-band instruction for the surviving flip pins, the #138 scope resolution, the sliver acceptance, and four precision NITs. All folded.

## The r1 → r2 delta to verify (scope to this)

1. **The completed sweep enumeration** — verify each newly named item against live source: the p2-drawing r3 fixture's double break (the 896 literal AND the trigger inversion — re-derive the 24px candidate arithmetic yourself: at the re-derived fixture, CAN a left candidate still be forced at 24px within a 960-or-wider lane? sanity-check that a forcing geometry exists, e.g. a stretch ending within 32px of laneEnd); the N=130/AC1 survival claims; layout.test.ts:104-119; the two de-band sites (:157-175/:163 and :189-203/:195); the Blueprint grep-noise note.
2. **The #138 resolution** — is "forced consequence + neutral placeholder + coordination comment at merge" an honest scope treatment, or does anything in A4 still make a content choice beyond the minimum the floor change forces (is the ×N caption itself a content addition #138 should own? adjudicate).
3. **The four NIT fixes** — the [102..114] range, the ConventionEntry idiom (verify against Legend.tsx and the legend-swatch count pin's location), the halo-free A1 arithmetic, the sliver-boundary pin values (N=38 → 960, N=39 → 984).

Settled in r1 (do not re-litigate): the 24px floor and its arithmetic, the scrolled simplification's equivalence, the confined blast radius with significant independent, the grab-drag shape (nothing to reuse), no width cap, the S12 P1 supersession framing, the ruler untouched.

This is round two. If the delta is faithful and no NEW defect exists in it, an honest APPROVED ends the loop — do not manufacture.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
