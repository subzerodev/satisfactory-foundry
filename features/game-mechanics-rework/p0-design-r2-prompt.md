# Review request — #140 arc P0 design (r2)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/game-mechanics-rework/p0-brainstorm-spec.md` (uncommitted, revision r2)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `64a8fcf`)
**Stage:** design re-review after fold. r1: code-reviewer NEEDS_REWORK (2 IMPORTANT + 2 NITs), adversarial NEEDS_REWORK (1 shared IMPORTANT + the bifurcation IMPORTANT + 1 NIT). All folded; dispositions in `## Revision history`.

## The r1 → r2 delta to verify (scope to this)

1. **D1b — the bifurcation fix:** all four constant consumers reroute through `catalog.tiers` (`stage-input.ts:69` via the catalog already in `toStageInput`'s signature; `store.ts:1140` clampTier + `:430-431` seed; `ControlsStrip.tsx:31` max). Verify each site's claimed reroute path is real (does ControlsStrip get its max from a store selector that has the catalog in scope? does clampTier run on catalog swap?); verify the stated 7-tier consequence (TIER_COLORS degrade at `colors.ts:24` is the existing unmatched behaviour, not new); check for a FIFTH direct consumer the fold missed (`grep -rn "TIER_TABLE" src/` excluding tiers.ts, tests, and the docs-loader fallback site).
2. **D2 sweep** now names both identity pins; the ledger's "only" corrected to a grep-cited "exactly two".
3. **D4 sweep** widened to docs/ with the fact-table row :169, directive :182, and eight further sites named; transport.ts docstrings enumerated; the three derived test constants (6708/100, 800000/559, 414.16) marked re-derive-not-replace.
4. **D3** commits to the real-file guard (hedge dropped, precedents cited).

Settled by r1 (do not re-litigate): round-trip reversal + 7→8 bump soundness, #144-heal non-substitution, the real-file read precedent, the adapter tiers pass-through pin surviving.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
