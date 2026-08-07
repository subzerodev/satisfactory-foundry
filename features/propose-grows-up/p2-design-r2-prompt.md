# Design review r2 — S20 P2 (#101): Propose solver extensions

Review `features/propose-grows-up/p2-brainstorm.md` (v2) in the repo at
`/home/subzerodev/workspace/satisfactory-foundry` (develop). This is a
DESIGN review — no diff exists yet.

## A. Current-state anchors (verify against live source)

- `src/data/types.ts:63-67` — `MachinePower.exponent: Fraction`,
  per-machine, non-uniform in the snapshot (1.321929 / 1.6).
- `src/data/docs-loader.ts:227-228` (+ default at :212) —
  `mPowerConsumptionExponent` parsed verbatim.
- `src/ui/advice.ts:87-112` — `stagePowerText` exact at clock 100,
  float + `≈` otherwise.
- `src/core/chain-builder.ts:40-49` (rates/ceilDiv), :75-80
  (byproducts reported never routed), :262-272 (primary links).
- `src/ui/chain-builder-adapter.ts:548-585` (proposalMetrics),
  :600-617 (`subtreePowerText` — flattens exponent to 1, pins clock
  100; v2 forbids reusing it for `powerAtClockMw`).
- `src/state/store.ts:819` (`clockPercentText: "100"` seed), :838-843
  (apply-path link `.map`), :917-920 / :1497-1501 (canLink/addLink lane
  invariant), :574-590 (per-link reconciliation).
- `src/core/manifold.ts:233-235` — linear exact clock scaling of rates.

## B. Claims to verify (the v2 design)

This is r2. Both r1 reviewers returned NEEDS_REWORK; the v2 fold:

1. **Byproduct routing REMOVED from P2** (Axis 4): suggestions are now
   display-only (`byproductSuggestions` pure scan, informational line,
   no toggle / no proposal mutation / no store surface / no apply
   payload). Explicit routing descoped to ticket #105 carrying both r1
   analyses. Verify: does v2's Axis 4, spec, tests, and walk contain
   ZERO residual routing surface? Does display-only actually satisfy
   the epic #98 P2 scope line ("suggestion only, never auto-routed
   silently")? Is the pure per-propose derivation genuinely immune to
   the staleness concern (nothing kept ⇒ nothing stale)?
2. **Per-stage exponent pinned** (Axis 2 + spec item 6): the float sum
   uses each stage's OWN `power.exponent`; `subtreePowerText` reuse
   forbidden; tests require two stages with DIFFERENT exponents.
   Verify the formula against advice.ts's per-stage discipline.
3. **Clock axes unchanged from r1** (both reviewers verified them
   sound): core `clockPercent: Fraction = 100` 7th positional param,
   linear exact rate scaling, default byte-identical, (0,250]
   validation; `powerAtClockMw: number | null` (null at 100); applied
   `clockPercentText` seeded with the chosen text. Re-verify only if
   the v2 edits touched them.
4. **The rejected NIT**: v2 keeps the 7th positional core param
   (rationale in spec item 1: single production caller; the adapter
   ProposeOptions bag is the ergonomic layer). Judge the rationale.
5. Already-settled list (do NOT re-litigate): epic #98 P2 scope; 100%
   default byte-stable; P1 surfaces as base; ephemeral posture; the
   advice.ts float discipline; the #105 descope decision (recorded on
   the board with both r1 analyses — re-opening it needs new evidence,
   not preference).

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS /
NEEDS_REWORK / BLOCKED) with severity-tagged, line-cited findings.
