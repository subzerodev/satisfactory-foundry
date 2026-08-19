# Review request — #144 design (r2): catalog staleness self-heal

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/catalog-staleness/brainstorm-spec.md` (uncommitted, revision r2)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `a40687e`)
**Stage:** design re-review after fold. r1 verdicts: code-reviewer NEEDS_REWORK (1 IMPORTANT + 1 NIT), adversarial-reviewer APPROVED_WITH_NITS (2 NITs, one identical to the IMPORTANT). All folded; dispositions in `## Revision history`.

## The r1 → r2 delta to verify (scope to this)

1. **D1's differs-branch is now specified as an EXTRACTION:** the bundled load+parse+save sequence (`store.ts:1340-1383`) becomes a helper parameterized by its FAILURE fallback — needs-upload tail for the non-hit caller (behaviour unchanged), set-ready-on-cached-catalog for the stale-bundled-hit caller. Verify the cited line ranges bracket the right sequence and that the parameterization cleanly covers both callers (including the `unavailable` no-save nuance INSIDE that sequence at `store.ts:1361-1373` — does the helper boundary as drawn keep that behaviour intact for the non-hit caller, given `unavailable` is always false for the hit caller?).
2. **Tests note** now names the single-build-constant dependency and requires a harness comment.
3. **D4.2** now grounds the offline no-skew claim in the Workbox mechanism with a `vite.config.ts:15,35-40` citation — verify those lines say what is claimed.

r1-survived theses (never-evict walk, second seam justification, deletion sweep incl. the store2 reboot at store.test.ts:887, unavailable non-interaction, no re-litigation) are settled — do not re-litigate without new evidence.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
