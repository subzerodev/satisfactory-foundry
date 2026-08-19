# Review request — #150 P0 implementation, phase-boundary cumulative diff (r1)

**Artifact:** the cumulative diff `develop...feature/phase-p0`, saved at
`/home/subzerodev/workspace/satisfactory-foundry/features/game-mechanics-rework/p0-phase-diff.diff`
(17 files, +873/−112; five commits ae29e08/edc1289/7b08ba3/5087fa9/84542ce).
**Worktree (live implementation source):** `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/phase-p0` (branch `feature/phase-p0`)
**Spec (frozen, the contract):** `features/game-mechanics-rework/p0-brainstorm-spec.md` in the same worktree (frozen at r8 after eight design rounds + a zero-finding simplify pass — do not re-litigate the design; review the diff AGAINST it).
**State:** `npm test` 1177 passed, `npm run check` clean (independently re-run by the team lead in the worktree).

## A. Current-state anchors

Read in the worktree: `src/data/docs-loader.ts`, `src/data/catalog-store.ts`, `src/data/stage-input.ts`, `src/data/tiers.ts`, `src/state/store.ts` (merge sanitizer, ready-clamp sites, setUnlockedTiers), `src/ui/ControlsStrip.tsx`, `src/App.tsx`, `src/core/transport-facts.ts`, `src/core/transport.ts`, the test files the diff touches, and `docs/research/transport-facts.md`.

## B. What to verify

1. **Spec conformance, item by item** (D1 parse + per-kind fallback; D1b four-consumer reroute + single-owner ready clamp at all four sites with before-the-solve placement + three-branch sanitizer exactly as specified (`undefined` → full, positive integer → kept no-upper-bound, else → 1) + setUnlockedTiers reroute + unreachability-comment update; D2 round-trip + 7→8 + the enumerated deletion sweep; ControlsStrip/TierToggles prop cascade from App; D3 real-file guard; D4 lockout 27 with re-derived assertions). The spec's Tests section enumerates required pins — confirm each exists and asserts what the spec says (especially: the non-vacuous 3-tier clamp pin, the loss-free reboot pin, the junk pin, the missing-field pin, and the rewritten out-of-range hydration test).
2. **Bidirectionality log:** `features/game-mechanics-rework/r2-verification.log` in the worktree must exist and show, per behaviour, a PASS, a compiling mutant, a genuine framework FAIL line referencing the diff's tests, and a restore-green. NEEDS_REWORK if missing or if any FAIL is not genuine.
3. **The two reported deviations** — judge each:
   (a) `src/ui/transport-text.test.ts` had a lockout-derived assertion the spec's enumeration missed; the implementer re-chose the fixture (RtD 120→140) to keep the pair ceiling non-terminating (2260/7 ≈ 322.9) and preserve the test's ≈-rendering intent. Is the arithmetic right and the intent genuinely preserved?
   (b) `docs/research/transport-facts.md`: all factual/formula sites updated to 27, but two revision-history occurrences of 27.08 left intact as audit record. Correct call?
4. **No scope creep, no unrelated edits, no weakened tests** (a rewritten assertion must not be loosened beyond what the spec's deferred-semantics rewrite prescribes).

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
