# Review request — #157 implementation diff (r2, scoped re-run on the diff-r1 folds)

**Artifact:** the cumulative diff `develop...feature/packaging-build-view` (7 commits), refreshed at
`/tmp/claude-1000/-home-subzerodev-workspace-satisfactory-foundry/da41eba2-e960-41df-ac0a-bdaefc64bc6a/scratchpad/157-impl.diff`.
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/packaging-build-view` (branch `feature/packaging-build-view`, base develop @ 7a16eec).
**Frozen spec:** `features/packaging-build-view/brainstorm-spec.md` (r3 + the diff-r1 fold ledger entry).
**Stage:** scoped diff re-review. r1 verdicts: code-reviewer APPROVED_WITH_NITS (1 NIT); adversarial NEEDS_REWORK (1 IMPORTANT + 2 NIT). All three folded in commits 4657039 / 2e316f7 / 2cd9b54.

State: `npm test` 49 files / 1240 tests green; `npm run check` green (worktree).

## The r1 → r2 delta to verify (scope STRICTLY to the three folds)

1. **The Blueprint tab disable (the IMPORTANT):** verify `disabled={packagingSubject !== null}` + `aria-disabled` on the tab, the `.view-tab:disabled` style, and — critically — the TEST re-derivation: the old test clicked the tab to reach the note (pinning the divergent behavior); the new pair must (a) assert the tab is disabled and a click does NOT activate it, and (b) reach the #158 pane note ONLY via the frozen carryover path (blueprint active first, then subject switch, view not reset). Confirm no remaining test clicks the disabled tab to reach the note.
2. **The adapter fixture decorrelation:** all six pair rates now distinct ({240,30,60} package / {720,90,180}-shaped unpackage per the report) with the pair's legal ratios preserved — verify a wrong-side rate-source swap would now fail the adapter's own suite (the assertions must pin the distinct unpackage values, not re-derive them from the package side).
3. **The stage-panels hide:** LaneOverrides + FindingsPanel render only when the stage subject is active; the stacked-render test pins their absence under a packaging subject; the spec's Revision history carries the diff-r1 fold entry.

Also confirm the verification log's new B5/B6 entries are genuine (compiling mutants, real FAIL lines naming the re-derived tests) and B1/B4 were honestly re-verified against the changed fixtures/tests.

Settled at r1 (do not re-litigate): the five Changes items' compliance, the catalog-param adjudication, the sweep map, B1-B4's original structure.

This is a scoped round on three folds. If they are faithful, an honest APPROVED ends the loop — do not manufacture.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, file:line-cited findings.
