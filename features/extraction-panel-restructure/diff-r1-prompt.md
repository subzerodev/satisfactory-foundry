# Review request — #156 implementation diff (r1)

**Artifact:** the cumulative diff `develop...feature/extraction-panel-restructure` (5 commits), at
`/tmp/claude-1000/-home-subzerodev-workspace-satisfactory-foundry/da41eba2-e960-41df-ac0a-bdaefc64bc6a/scratchpad/156-impl.diff` (937 lines).
**Read the changed files directly in the worktree:** `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/extraction-panel-restructure` (branch `feature/extraction-panel-restructure`; base develop @ 0c6f1a8).
**Frozen spec (the contract):** `features/extraction-panel-restructure/brainstorm-spec.md` (r5, in the worktree — its Revision history carries the reviewer-settled decisions).
**Stage:** Tier-2 diff review (gates the merge to develop).

State: `npm test` 50 files / 1247 tests green; `npm run check` green (worktree).

## A. Verify spec compliance

1. **`PackagingChainStrip.tsx`** — the A2 strip: node boxes, feed/forward/exit/return-loop labels with rates + display names + route texts, "—" unsized fallback, panel CSS vars, viewBox scaling. **Adjudicate the implementer's noted structural addition:** an `endpoints: {left, right}` prop threaded `ExtractionPanel → PackagingControls → PackagingEditor`. The spec designs endpoint-label props on the strip (A2/A5); is threading them through the two intermediaries faithful, or does it smuggle in what r5 relocated out (it must NOT carry the power inputs)?
2. **The routeSummary lift** (`transport-text.ts`) — pure move, GraphCanvas imports it; both call sites derive route texts from it.
3. **`GraphCanvas.tsx`** — A1 sectioning (the "Extraction" label; the checkbox label styled as section head, structurally intact — no duplicate text); the figures line (combined packaging power only); the pointer line naming the DRAWING selector; **the Total line in `ExtractionPanel` below `<PackagingControls/>`** — verify the r5 contract exactly: inputs (extractor machine power via catalog.extractors→machines, `result.count`, `parseClockText(selection.clockPercentText)` from core/clock.ts), inline two-branch sum, bounds dropped, hidden when `selection.purityMix !== undefined`, and NO derive change anywhere.
4. **`LinkInspector.tsx`** — the strip mirror in the interstep summary; the advisories block untouched; no Total line there.
5. **The sweep** — re-run the spec's grep (use `grep -Ein`, the implementer notes the bare-pipe pattern silently matches nothing without -E) over the three files and check every hit against the implementer's disposition map; flag anything undispositioned or wrongly dispositioned.

## B. Bidirectionality log

`features/extraction-panel-restructure/r2-verification.log`: 9 claimed compiling mutants (M1-M9) each with genuine vitest FAILs naming the diff's tests. Spot-verify the mutants compile and the FAIL lines are genuine; NEEDS_REWORK if any is not.

## C. Beyond the spec

Anything unauthorized; regressions (the panel's non-packaging states — no packaging pairs, pick-extractor, invalid clock, purity flows; LinkInspector's plan-unavailable branch); test quality (fixture degeneracy, decorrelation).

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, file:line-cited findings.
