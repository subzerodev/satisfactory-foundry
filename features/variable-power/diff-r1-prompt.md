# Review request — #142 diff (r1): recipe-level variable power

**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry`, branch `feature/variable-power` @ `a499668` (fix `a54f055`; parent `develop` @ `016cc54`; the `docs(144)` backfill commit is not part of this review).
**Diff:** `features/variable-power/diff-r1.diff` (the `src/` diff of `git diff develop...HEAD`).
**Frozen spec:** `features/variable-power/brainstorm-spec.md` (r2 — correctness AWN+AWN converged, simplify APPROVED no findings). Deviation from the frozen spec is a finding even if defensible.

## What to verify

1. **Spec conformance:** D1 parse (lenient both-or-absent, factor-0 legal, `parsePowerField` reuse); D2 helper exactly as specced (gate `!power.variable || undefined → identity`); D3 the two corrected surfaces (advice via `stagePowerOf` now returning `{power, variablePower}`, adapter in-loop correction AFTER the `power === undefined` guard with the `const recipe` binding) and the two pass-throughs UNTOUCHED (`link-plan.ts`, `extraction-plan.ts` — confirm absent from the diff); D4 persistence (StoredRecipe optional field, serialize/revive symmetric via `parseRational`, version 6→7); D5 untouched items.
2. **One deviation to adjudicate:** the spec's deletion sweep declared "no existing test file edited except by addition" (AC5), but the diff edits two existing `catalog-store.test.ts` version pins (`toBe(6)` → `toBe(7)`, and the v5-stale test retargeted to v6-stale-under-7). These literals pin the version constant itself — the sweep missed them because it swept variable-power terms, not the version literal. Judge: necessary consequence of AC4 (bump), or spec violation needing an r-round? (The sweep-miss itself should be named in your verdict either way — it is the third instance of the deleted-behaviour-pin class this session.)
3. **Bidirectionality log** `features/variable-power/r2-verification.log`: three mutations (gate-removed → the BWD pin fails; identity → 4 unit+integration FAILs; parse-drop → 2 parser FAILs), committed-before-mutating, green restored. Genuine?
4. **The adapter correction's placement** — verify against the live loop that the correction happens before all four sums AND the `powerVaries` flag read, and that `subtreePowerText`/candidate rows are untouched.
5. **Suite health:** 1165 green at commit, `npm run check` clean.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
