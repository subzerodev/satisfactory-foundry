# Design review r1 - bigint feed-entry clamp (#122)

Worktree:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-122-bigint-entry-clamp`

Artifact:
`features/bigint-entry-clamp/brainstorm-spec.md`

Review the frozen candidate against Forgejo #122 and the live code, especially:

- `src/core/manifold.ts`: `toIndex`, `solveStage`, `solveFeedLane`, the entry
  clamp, segment construction, and `drainSpan`.
- `src/core/fraction.ts`: exact parsing and `floorDiv` behavior.
- `src/core/manifold.test.ts`: existing over-B entry-clamp regression and direct
  lane test helpers.
- `src/state/store.ts` and `src/data/plan-store.ts`: override parsing, plan load,
  and exact string persistence.
- `src/state/store.test.ts`: the existing 20-smelter fixture and plan-lifecycle
  round trip.

Settled scope: compare/clamp the exact following-slot quotient against
`BigInt(N)` before number narrowing. Preserve huge positive saved overrides; do
not redesign override validation or persistence.

Attack the `>= N` boundary, MAX_SAFE and larger arithmetic, test discrimination,
direct-caller preconditions, exact finding values, save/load re-derivation, and
whether any proposed test can pass without fixing the conversion order. Flag
scope creep beyond the single solver expression plus focused core/store tests.

Return severity-tagged, file/line-cited findings and exactly one final verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
