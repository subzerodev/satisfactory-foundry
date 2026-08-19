# Simplify review — design stage

**Artifact under review:** `/home/subzerodev/workspace/satisfactory-foundry/features/extraction-panel-restructure/brainstorm-spec.md`
**Stage:** design (Tier-2 merged brainstorm+spec for #156 — the extraction panel's packaging block gets a chain visual + structured info; LinkInspector mirrors)
**Worktree (read source here to ground every proposal):** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD cb194af)

This artifact has **ALREADY passed correctness review** (code-reviewer + adversarial-reviewer, degraded same-vendor roster — converged at r2, nit folded). **Do NOT re-check correctness** and do not re-litigate the revision history.

Your **sole job**: find **over-engineering** and propose the **simplest correct shape**. Cite lines, name the concrete simpler shape, say why it stays correct.

**If it is already as simple as it should be, say so — do NOT invent work.**

Fair game, for example: the shared `PackagingChainStrip` component (is a shared SVG component with endpoint-label props leaner than two thin local strips — or is even an SVG more than the 340px panel needs vs styled HTML rows with a drawn return arrow?); the A3 figures block's breadth (per-group power AND combined AND total — three power figures in a 340px panel; does Michael need all three?); the new total-power helper (worth a helper + unit tests, or an inline two-branch expression?); the A4 pointer line (earning its place?); the sweep section's size.

NOT fair game (correctness-settled or user-decided): the panel-vs-drawing split (#156 c24987), the chain-visual-with-return-loop itself (Michael approved the mockup direction), the container naming, the belt counts, the routeSummary lift, the bidirectionality-log requirement.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with line-cited findings.
