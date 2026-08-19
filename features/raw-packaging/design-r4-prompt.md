# Review request — #133 P4 design (r4 gate + post-arc revalidation)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/raw-packaging/brainstorm-spec.md` (committed @ 1c8684f, revision r4)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `bee9544`)
**Stage:** the FRESH design gate the r2 disposition (#133 c24710) required for r4 and that was never run — combined with REVALIDATION: since the spec's anchors were taken (develop @ f494e75-era), the four pre-arc fixes (#142-#145) and the arc's P0/P1/P2 have landed. Line numbers HAVE shifted (verified: `setLinkInterstep` is now ~store.ts:2035, the save `format_version: 8` literals ~:2209/:2220) — re-locate every anchor by content; a shifted line is not a finding, a changed SEMANTIC is.

## History you must honor (from #133's audit trail)

- r1 gate: both NEEDS_REWORK — the v9 bump (code-reviewer BLOCKER, upheld against the adversarial's contrary claim), setMachine drop, visibility predicate, planned-block placement. All folded r2.
- r2 gate: both NEEDS_REWORK — the passthrough-migrateV8 BLOCKER (both independently; folded r3 as rebuild-not-passthrough incl. the migrateV7 stage hole) and the canonicalize-at-the-extraction-write defect (folded r4). The r2 round also carried a recorded freeze violation (code-reviewer reviewed r2 while r3 was being committed) — this round is the clean gate that closes it.
- Do NOT re-litigate what r1/r2 settled and r3/r4 folded: the v9 bump rationale, the rebuild idiom, the canonicalization requirement, the planned-block placement, the packagingOptionsFor-shaped gate, the Michael decision (packaging lives in the Extraction panel; StageLink untouched; reporting layer only).

## B. What to verify

1. **The r3/r4 folds themselves** (never gated): the migrateV8 rebuild + migrateV7 stage-rebuild sections and the canonicalize-the-extraction-write section — are they correct, complete, and implementable against live source (canonicalizePackagingInterstep now at store.ts ~:27 import/~:2045 use; link-transport.ts; plan-store.ts validators)?
2. **Post-arc revalidation — every anchor and claim, by content:**
   - store.ts moved substantially (P0's clamp work, #143/#144): the cited sites (copyExtractionSelection, setExtractionSelection, the shallow spread on plan load ~:758-era, the save format_version literals, setMachine in GraphCanvas.tsx:362-372-era, the planned-block boundaries GraphCanvas.tsx:477-580-era) — do they still exist with the claimed shapes? Flag any that changed semantically.
   - The test-pin enumeration (§Tests 8-9: the ~17 format_version:8 assertions with their line numbers; plan-store.test.ts + store.test.ts cites) — re-grep; line numbers have certainly moved, and P0-P2 added ~40 tests. Are there NEW pins on format_version 8 or on the extraction-selection shape that the sweep must now include (the memory-rule sweep class)?
   - Does anything P0/P1/P2 landed interact with this spec at all (catalog tiers in unlockedTiers reads — link-plan.ts:231-237's globalUnlockedTiers fallback; the extraction panel's surroundings from #134)? Name any interaction the spec must note, or state clean independence.
3. **Tier-2 leftovers:** the spec predates the arc (written as Tier 2 under epic #136). Its acceptance criteria say "both browser matrices green" and reference the r2-verification.log path `features/raw-packaging/r2-verification.log` — confirm these still map to the current workflow (npm test / npm run check; the bidirectionality log path is fine).

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
