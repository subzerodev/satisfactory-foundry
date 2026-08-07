# Boundary review r2 (delta-scoped) — S20 P3 (#102)

Re-review after the r1 fold. Worktree:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s20-p3`
(branch feature/s20-p3, now 15 commits over develop).

At r1: code-reviewer NEEDS_REWORK (2 IMPORTANT + 3 NITs); adversarial
APPROVED_WITH_NITS (1 MINOR — the same CSS defect — + 5 NITs). The
adversarial's refutation of the full eight-round scar list FAILED (every
trap survived, every jsdom row hand-verified discriminating); the
findings were things that attack was not aimed at.

## The delta (5 commits, `93444d3..HEAD`)

Delta diff: `features/propose-grows-up/p3-boundary-r2-delta.diff`
(cumulative, if needed: `p3-boundary-r2.diff`)

1. **CSS collision** — `.chain-builder-tier` (which was already the
   depth marker) → `.chain-builder-tier-select`, with a comment
   recording why the old name is taken.
2. **Unpinned mirror-backs** — three discriminating rows added: the
   recipe-choice mirror, the exclusion mirror (both directions), and
   the overrides SEED (asserted via machine name, since a seeded
   `r_c_alt` runs on Refinery where the unseeded default runs on
   Smelter). Log claim corrected + ledger entries added.
3. **Carve-out row** — now asserts the TOTAL checkbox count (4).
4. **Real-snapshot pin** — four structural assertions on the parsed
   bundled snapshot, deliberately not exact-value, incl. an
   end-to-end one (tier 0 removes a share of the real catalog, `null`
   removes none).
5. **`parseTechTier`** — normalized to a non-negative integer.
6. **Citations** — v11 → v12 everywhere.
7. **`aria-label`** — dropped; the new class is the test hook.
8. **Two-pass ordering** — fixture with the schematic group FIRST.

## Claims to verify

- Each of the 8 items actually landed, and each new/changed test
  DISCRIMINATES (would fail if its target were reverted). This
  design's signature failure across nine rounds is tests that pass
  either way — it has produced five so far. Hunt them here hardest,
  especially in the three new mirror-back rows and the four
  real-snapshot assertions.
- The renamed CSS class collides with nothing else, and the TIER
  select's styling is now what the block intends.
- Dropping `aria-label` did not regress the control's accessible
  name (it must still be named by its wrapping label).
- **The implementer self-reported breaking its own commit**: running
  the mutation harness over UNCOMMITTED work let a `git checkout --`
  silently revert the `parseTechTier` fix, so that commit initially
  shipped tests without the fix. It re-applied and amended the tip.
  **Verify the fix is actually present in the final tree** and that
  nothing else was lost the same way — check the delta for any test
  whose production counterpart is missing.
- The log now claims 43 behaviors / 41 pinned / 2 proven no-ops /
  none unpinned, and explicitly scopes out three classes
  (presentation, the structural two-pass guard, comments). Is that
  scoping honest, or does it excuse a pin that could have been
  written?
- 893/893 green + check clean (re-run if you have shell).

Do NOT re-litigate anything approved at r1. Do NOT spawn nested
verification agents. Return exactly one verdict (APPROVED /
APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED) with severity-tagged,
line-cited findings.
