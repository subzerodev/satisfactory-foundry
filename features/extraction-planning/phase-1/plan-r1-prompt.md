# #112 Phase 1 implementation-plan review r1

Review `features/extraction-planning/phase-1/implementation-plan.md` in:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-112-extraction-p1-design`.

The design is frozen at `brainstorm-spec.md` r6 after correctness convergence
and one-shot parsimony approval. This is a plan review; production code is still
unchanged.

Verify the plan against the frozen design and current source. In particular:

1. Every test is written failing before production behavior, with exact commands
   and representative bidirectional mutation evidence at phase completion.
2. Parser/catalog/cache tasks cover strict structured fields, source-order-
   independent applicability, parser version 6, and every catalog literal.
3. Pure derivation validates both standalone topology and current-item
   applicability before count/power, and compares one extractor output to one
   transport line.
4. Plan v6 embeds required `userPlaced` before every rewrite path, removes the
   transient source-version flag, and persists raw extraction intent.
5. The raw node carries exact live `Fraction` demand and identity; the canvas
   does not parse display text or persist ephemeral panel state.
6. The panel is accessible, visibly says Normal purity, handles Resource Wells
   and Nitrogen honestly, and is bounded away from all canvas controls.
7. No Phase 2 purity editor or fabricated Resource Well count is pulled forward.

Return line-cited BLOCKER/IMPORTANT/NIT findings and exactly one verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
