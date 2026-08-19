# Review request — #152 P2 implementation, phase-boundary cumulative diff (r1)

**Artifact:** the cumulative diff `develop...feature/phase-p2`, saved at
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/phase-p2/features/game-mechanics-rework/p2-phase-diff.diff`
(14 files, +1516/−61; six commits cdc98db..fa6fce3).
**Worktree (live source):** `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/phase-p2` (branch `feature/phase-p2`)
**Spec (frozen, the contract):** `features/game-mechanics-rework/p2-brainstorm-spec.md` in the worktree (frozen at r4 + zero-finding simplify; review the diff AGAINST it, not the design).
**State:** `npm test` 1203 passed, `npm run check` clean (independently re-run by the team lead).

## A. Current-state anchors

Read in the worktree: `src/ui/Schematic.tsx` (ribbon polygon, endpoint labels, PipeConnector, halfPx/endpointsCollide), `src/ui/format.ts` (segTooltip three shapes + pipeConnectorTooltip), `src/ui/layout.ts`, `src/ui/SummaryCards.tsx`, `src/ui/Legend.tsx`, `src/layout/layout.ts` (junction kinds), `src/ui/Blueprint.tsx`, `src/ui/app.css` (new rules), the new `src/ui/p2-drawing.test.tsx`, the re-pinned tests, `features/game-mechanics-rework/p2-verification.log`.

## B. What to verify

1. **Spec conformance D1-D7 item by item**, including: RIBBON_MAX/MIN values and the terminal RIBBON_MIN rule; feed-only seam growth (output ±6 untouched); the one-baseline endpoint row with halo + BOTH collision rules (right-push, left-suppress); the scoped "peak" removal (exemptions intact: findingText format.ts, FindingsPanel hint, advice.ts params); pipe connector semantics (no ordered claims, lane-undersupplied colours it); card lines null-guarded; legend entries; junction kinds with the subtraction residue-in (NEVER segments[j-1]) incl. the empty-span counter-case test.
2. **The three reported judgment calls — adjudicate each:**
   (a) glyph-width-based thinning (`endpointsCollide`) instead of the spec's "~60px" estimate — the spec's controlling text was "too narrow for both its entry and hand-off glyphs (estimated width)"; is the implementation faithful to that, and do the two pinned directions (8411 renders all eight, dense fixture drops) actually discriminate?
   (b) `pipeConnectorTooltip` extracted to format.ts — consistent with the established string-ownership pattern?
   (c) `pipe-manifold` composed alongside `lane-pipe` — matches the spec's D4 + the known naming note?
3. **The verification log:** seven behaviours, compiling mutants, genuine FAILs naming the new tests, restore-green, no green mutants. NEEDS_REWORK if any FAIL is not genuine.
4. **No scope creep, no weakened tests, all spec test pins present** (the Tests section enumerates them — check each exists and asserts what the spec says, especially the left-fallback suppression pin, the no-text-below-busY pin, the halo class pin, and the terminal-rule pins).

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
