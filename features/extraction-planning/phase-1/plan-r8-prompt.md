# #112 Phase 1 implementation-plan review r8

Review `features/extraction-planning/phase-1/implementation-plan.md` in:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-112-extraction-p1-design`.

R7 returned `APPROVED` / `NEEDS_REWORK` on one lifecycle contradiction. R8
requires raw-node disappearance to close without focus restoration because the
opener no longer exists. Explicit close still restores to a surviving opener;
raw-B replacement keeps focus in B and never restores to A.

Recheck the full plan against frozen r6 and live source. Return line-cited
BLOCKER/IMPORTANT/NIT findings and exactly one verdict: `APPROVED`,
`APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
