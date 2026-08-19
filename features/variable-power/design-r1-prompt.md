# Review request — #142 design (r1): recipe-level variable power

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/variable-power/brainstorm-spec.md` (uncommitted)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `016cc54`)
**Stage:** design (Tier 2). No diff yet. Last of the four pre-arc fixes (#140 comment 24744).

## A. Current-state anchors — verify against live source

- `src/data/docs-loader.ts:43-50` (`RawRecipe`), `:131-149` (recipe extraction), `:486-507` (`parseMachinePower`, branch 2 = variable), the post-processing that builds `CatalogRecipe`.
- `src/core/machine-power.ts` (30 lines: `MachinePowerInput`, `machinePowerProjection`).
- Call sites: `src/ui/advice.ts:88,113-124,189`; `src/core/link-plan.ts:165`; `src/ui/chain-builder-adapter.ts` power/metrics path (audit cited `:799/:806` — locate the live lines).
- `src/data/catalog-store.ts:50` (`CATALOG_PARSER_VERSION = 6`), `:71-82` (`StoredRecipe`), serialize/revive, and the scar comment `:31-36`.
- The deletion-sweep claims: `machine-power.test.ts`, `advice.test.ts:154,170`, `chain-builder-adapter.test.ts:461-486,778`, `docs-loader.test.ts:719-720` — verify these are ALL the variable-power pins and that none carries recipe fields.
- Settled: ticket #142; gap-report W1 + its §7 row 5 correction; #140 decision 24744.

## B. Claims to verify

1. **D2's central equivalence:** `power.variable === true` ⇔ produced by one of the three `FGBuildableManufacturerVariablePower` classes. Branch 2 fires on BOTH `mEstimated*` keys being present+parseable (`docs-loader.ts:497-501`) — is there any OTHER admitted building class that could carry both keys (sweep the decoded game file at `/tmp/claude-1000/-home-subzerodev-workspace-satisfactory-foundry/da41eba2-e960-41df-ac0a-bdaefc64bc6a/scratchpad/game-docs-utf8.json` if needed)? If a generator or extractor carried them, the gate would over-fire.
2. **D3's caller inventory:** are those four genuinely ALL the `machinePowerProjection` consumers (grep), and does each really have the recipe in scope at the call? Check `advice.ts` signatures (`stagePowerTextFor` takes `MachinePower` — threading the recipe changes its signature; enumerate the knock-on callers of THESE functions too).
3. **D4:** is the parser-version bump genuinely required (vs. the #144 steamBuild heal covering it)? The spec argues yes — attack that. Also: does `reviveCatalog` FORCE the new field (the recipeUnlocks precedent, `types.ts` REQUIRED-not-optional note) or is optional acceptable here? The spec chose optional — is that the scar risk again, or is optional-with-parser-bump sound?
4. **Deletion sweep completeness** — re-run it; `grep -a` where plan-store.ts is involved.
5. **The 875→500 example end-to-end:** with D1–D3 as specced, would the bundled catalog actually produce "500 MW (varies 250–750 MW)" for 1 Particle Accelerator on Plutonium Pellet at 100%? Trace the arithmetic.
6. Any re-litigation of settled decisions.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
