# Simplify review — diff at the diff stage

**Artifact under review:** the cumulative diff `develop...feature/build-view-pan` (13 files; commits a270550..494a183). Read the touched files in the worktree.
**Stage:** diff (#154 implementation of the frozen spec `features/build-view-pan/brainstorm-spec.md` @ 82bb7dc)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/build-view-pan`

This diff has **ALREADY passed correctness review** (code-reviewer APPROVED + adversarial APPROVED_WITH_NITS, both hook nits folded @ 494a183). **Do NOT re-check correctness.**

Your **sole job**: find **over-engineering** and name the **simplest correct shape**. Cite lines, name the concrete simpler shape, say why it stays correct.

**If it is already as simple as it should be, say so — do NOT invent work.**

Diff-stage lens: helpers a direct expression would serve (the hook's isBackground; the Machines caption); duplicated logic between Schematic and Machines post-band; guards beyond spec requirements; test scaffolding heavier than the pins require (useGrabScroll.dom.test.tsx's 5 pins; the re-derived fixtures' comments); dead code the deletions should have taken but didn't.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with line-cited findings.
