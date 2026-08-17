# #112 Phase 1 design correctness review r2

Review the current candidate at:

`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-112-extraction-p1-design/features/extraction-planning/phase-1/brainstorm-spec.md`

Also read the sibling `FEATURE.md`, Forgejo #112/#114, live source, and bundled
Docs.json. This is a Tier 3 design review; no production code changed.

## Delta from r1

Both r1 reviewers returned `NEEDS_REWORK`. R2 folds every finding:

1. v6 introduces a semantic placement-origin signal true for stored v5/v6,
   keeping auto/userPlaced behavior; v1-v4 alone retain legacy fallback;
2. extractor restriction booleans parse exact `"True"`/`"False"`, with strict
   non-empty valid resources for restricted extractors;
3. raw node data carries exact `stageId`, `itemId`, and `Fraction` demand, while
   the open panel re-resolves that identity from current derived nodes;
4. raw XYFlow wrappers explicitly enable pointer events and disable wrapper
   focus so the inner button is the sole tab stop; and
5. notice and extraction share one vertically stacked top-right Panel.

Verify these resolutions against source and attack all original Phase 1
requirements: structured rates/applicability, exact count/clock/power,
per-output saturation, plan/cache migrations, Resource Well honesty, panel
lifecycle, and the Phase 2 deferred-plan boundary.

Return line-cited findings tagged BLOCKER, IMPORTANT, or NIT, then exactly one
verdict: `APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
