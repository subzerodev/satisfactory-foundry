# Review request — #140 arc P0 design (r1): parsed tier table + lockout correction

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/game-mechanics-rework/p0-brainstorm-spec.md` (uncommitted)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `64a8fcf`)
**Stage:** design (Tier-3 arc P0). No diff yet.

## A. Current-state anchors — verify against live source (post-#142/#144 develop, NOT the gap report's line numbers)

- `src/data/tiers.ts` (the curated table), `src/data/docs-loader.ts` (the `tiers: TIER_TABLE` stamp site + `parsePowerField`/lenient-parse idioms + `NATIVE_BUILDING_REGEX` admission), `src/data/catalog-store.ts` (StoredCatalogData, the revive re-stamp + its "never round-tripped" comment, `CATALOG_PARSER_VERSION = 7` post-#142).
- The pins the D2 sweep names: `catalog-store.test.ts` version pins (post-#142 values), `docs-loader.test.ts` `toBe(TIER_TABLE)`, `colors.test.ts` length check.
- `src/core/transport-facts.ts:72` (TRAIN_LOCKOUT_SECONDS 2708/100) + its consumers (`transport.ts`, `transport-plan.ts`) + `docs/research/transport-facts.md:176-183`.
- Settled: #140 decisions 24779 (parse) + 24796 (lockout); gap-report RISK/PASS sections @ ae266b1.

## B. Claims to verify

1. **D1 fallback semantics** — parse-else-curated PER KIND, lenient skip per entry: is that implementable at the stamp site as described, and is there any catalog consumer that breaks when `tiers` is parsed rather than the module constant (reference-identity assumptions beyond the one named pin)? Sweep for `TIER_TABLE` imports.
2. **D2's round-trip reversal** — the spec claims NOT round-tripping parsed tiers would revert cached users to curated values. Trace the revive path and confirm; also confirm 7→8 is required (vs the #144 steamBuild heal covering it — same argument class as #142's D4, but verify it holds for tiers).
3. **D3 guard test** — is reading `public/bundled-docs/en-US.json` (5.3 MB) in a vitest unit acceptable in this suite (any precedent?), or should the spec commit to the trimmed-fixture variant?
4. **D4 sweep** — run `grep -rn "27.08\|2708" src/ docs/` and confirm the spec's edit list is complete; check transport tests pinning docking arithmetic on 27.08-derived values (deletion sweep completeness — the class that has bitten three times).
5. **Uploaded catalogs**: D1 says uploads also derive tiers. The upload path parses via the same parseDocsJson — confirm, and confirm the user-visible consequence (an old-export upload falls back per kind) is stated honestly.
6. Any re-litigation of settled decisions.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
