# Review request — #157 implementation diff (r1)

**Artifact:** the cumulative diff `develop...feature/packaging-build-view` (4 commits), written to
`/tmp/claude-1000/-home-subzerodev-workspace-satisfactory-foundry/da41eba2-e960-41df-ac0a-bdaefc64bc6a/scratchpad/157-impl.diff` (1386 lines).
**Read the changed files directly in the implementation worktree:** `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/packaging-build-view` (branch `feature/packaging-build-view`; base develop @ 7a16eec).
**Frozen spec (the contract):** `features/packaging-build-view/brainstorm-spec.md` (r3, in the worktree).
**Stage:** Tier-2 diff review (phase boundary — gates the merge to develop).

State: `npm test` 49 files / 1239 tests green; `npm run check` green (both in the worktree).

## A. Verify spec compliance (the five Changes items)

1. `src/core/packaging-stage-input.ts` — the A1 adapter: exact lane mapping (packager: fluid pipe + container belt feeds → packaged belt output; unpackager: the mirror from unpackage* fields), Fraction-exact, core purity (no React/DOM), null cases. **Adjudicate the implementer's one deviation:** the spec's A1 signature listed a `catalog` first param; the mapping never uses it, so the implementation is `packagingStageInputs(plan, clockPercent, capacities)`. Is dropping the dead param faithful-and-better, or does anything in the spec genuinely need catalog data here?
2. `src/ui/App.tsx` + `App.packaging.dom.test.tsx` + `app.css` — the A2 subject selector (absent with no chains; enumerates extraction `packaging` + link `interstep`; label floor), A3 stacked Schematic + Machines with group headings + per-group power, Blueprint disabled per the frozen clause (non-interactive tab; active-blueprint pane shows the #158 note; `view` not reset).
3. `src/ui/transport-text.ts` — belt chip via `runs`, singular/plural, stale comments gone.
4. `src/ui/graph-flow.ts` — ONLY the mode half of the :521 guard lifted; undefined half intact; comments updated.
5. The sweep: re-run the spec's greps yourself over the worktree's test files and check EVERY hit against the implementer's disposition map (in the completion summary; the known-now entries are in the spec). Flag any undispositioned or wrongly-dispositioned hit.

## B. Bidirectionality log

`features/packaging-build-view/r2-verification.log` (worktree) must contain, per behaviour (adapter mapping, belt chip, guard lift, subject/stacked render): a PASS run, a COMPILING mutant (check the claimed tsc verification), a genuine vitest FAIL line naming the diff's new tests, and the restore + green. NEEDS_REWORK if missing or if any FAIL is not genuine.

## C. Beyond the spec

Anything in the diff the spec doesn't authorize; regressions in untouched behavior (the stacked render's effect on existing stage-subject rendering; selector absence when no chains); test quality (fixture degeneracy — the chip fixtures claim N≥2; decorrelated fields in the adapter tests).

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, file:line-cited findings.
