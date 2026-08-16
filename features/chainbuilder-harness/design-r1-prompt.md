# Design review r1 - shared ChainBuilder jsdom harness (#109)

Worktree: `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-109-chainbuilder-harness`

Artifact: `features/chainbuilder-harness/brainstorm-spec.md`

## Current anchors

- `src/ui/ChainBuilder.gating.test.tsx`
- `src/ui/ChainBuilder.rawtarget.test.tsx`
- `src/ui/ChainBuilder.output.test.tsx`
- `src/ui/ChainBuilder.byproduct-routing.test.tsx`
- `src/state/store.ts` eager persisted-storage initialization
- `vite.config.ts` global node test environment

## Review mandate

1. Verify the duplication measurement and all four migration targets.
2. Attack the `vi.hoisted`/module-evaluation claim and ensure the helper import
   cannot run before local storage installation.
3. Check the handle API removes real duplication without absorbing suite-owned
   state, fixtures, or domain helpers.
4. Verify selectors/event semantics match every current suite and cleanup is
   safe on mount/test failure.
5. Reject any test-coverage weakening, assertion/name drift, hidden singleton,
   global environment change, or speculative abstraction.
6. Confirm the verification/mutation plan can prove all four suites still drive
   the real shared proposal path.

Return severity-tagged, file/line-cited findings and exactly one final verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
