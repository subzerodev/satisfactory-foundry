# Simplify review — diff stage

**Artifact under review:** the cumulative diff `develop...feature/extraction-panel-restructure` (6 commits), at
`/tmp/claude-1000/-home-subzerodev-workspace-satisfactory-foundry/da41eba2-e960-41df-ac0a-bdaefc64bc6a/scratchpad/156-impl.diff`.
**Worktree (read the changed files here):** `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/extraction-panel-restructure`.
**Stage:** diff (Tier-2 implementation of #156 — the extraction panel's packaging chain visual + structured info; frozen spec `features/extraction-panel-restructure/brainstorm-spec.md`).

This diff has **ALREADY passed correctness review** (degraded pair — r1 APPROVED_WITH_NITS ×2, both nits folded). **Do NOT re-check correctness.**

Your **sole job**: find **over-engineering in the code** and name the simplest correct shape. Cite file:line, name the concrete simpler shape, say why it stays correct.

**If it is already as simple as it should be, say so — do NOT invent work.**

Fair game, for example: the PackagingChainStrip's internal geometry (hand-positioned SVG coordinates vs anything simpler); the 82 lines of app.css (dead or duplicated selectors?); the Total-line closure's shape in ExtractionPanel; the DOM test files' setup duplication; the endpoints-prop threading (leaner as two direct props?).

NOT fair game (spec-mandated or correctness-settled): the strip's existence and its return loop, the Total line's existence and its ExtractionPanel scope, the purity-hide, the combined-only packaging power, the routeSummary lift, the sweep re-derivations, the bidirectionality log.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with line-cited findings.
