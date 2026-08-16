# #112 Phase 1 design correctness review r1

Review the candidate design at:

`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-112-extraction-p1-design/features/extraction-planning/phase-1/brainstorm-spec.md`

Also read:

- `features/extraction-planning/FEATURE.md`
- Forgejo #112 and epic #114
- the live source files cited by the design
- `public/bundled-docs/en-US.json` for every data claim

This is a Tier 3 design review, not an implementation review. No production
files have changed. Return line-cited findings tagged BLOCKER, IMPORTANT, or NIT,
then one verdict: APPROVED, APPROVED_WITH_NITS, NEEDS_REWORK, or BLOCKED.

Hard requirements:

1. Do not reopen the settled two-phase, requirement-first direction. Phase 1 is
   normal purity with selected extractor, clock, and saturation; Phase 2 purity
   mixing is deferred.
2. Verify that the proposed normal rates and resource applicability come from
   structured Docs.json fields, not descriptions or remembered constants.
3. Verify exact arithmetic, fluid unit normalization, clock limits, count/
   surplus, and the reuse of the existing labeled power approximation boundary.
4. Attack the saturation semantics. It must compare one extractor's output with
   one belt/pipe, never total raw demand with one line.
5. Verify that Water, Crude Oil, Nitrogen Gas, and the Resource Well topology
   cannot be misclassified as miners.
6. Check the parser/cache schema, plan v6 migration/validation, catalog
   replacement behavior, and all enumerating serialization sites against live
   source.
7. Check React Flow interaction, focus restoration, panel lifecycle, and raw-node
   non-interactivity invariants for contradictions.
8. Enforce the deferred-plans rule: reject any Phase 2 implementation design
   beyond the already verified provenance and scope lock.
9. Identify any unsupported product promise around Resource Wells. An honest
   explicit refusal is preferable to a fabricated satellite count, but the
   ticket must not imply that Nitrogen was modeled as a standalone extractor.

Pay particular attention to claims that look plausible but are not implied by
the installed data. Verify every cited source seam rather than trusting this
prompt.
