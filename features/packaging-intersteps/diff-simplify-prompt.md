# Simplify review — #113 packaging intersteps at the diff stage

**Artifact under review:** `/tmp/satisfactory-foundry-113-diff-final.patch`
**Stage:** `diff`
**Worktree (read source here to ground every proposal):** `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-113-intersteps`

This artifact has **ALREADY passed correctness review**: the fresh conformance
and adversarial correctness reviewers both returned `APPROVED` on the repaired
final state. Do **not** re-check correctness. Bugs, missing cases, and
design-intent disputes are outside this pass.

Your sole job is to find over-engineering and propose the simplest correct
shape. For each finding:

1. Cite exact `file:line` locations.
2. Name the concrete simpler replacement.
3. Explain why it preserves the frozen design and current behavior, grounded in
   live source.

If the implementation is already as simple as it should be, say so and do not
invent work.

Focus on:

- needless wrappers, indirection, or dispatch;
- duplicated logic that can reuse an existing verified helper;
- guards, branches, or error handling beyond the frozen requirement;
- abstractions or parameters introduced without a real caller.

The explicit pair validator, exact material/cargo split, closed-world v8
validator, runtime action canonicalization, independent forward/return routes,
phase-aware disable recovery, and browser evidence are correctness-approved
requirements, not optional complexity.

Return exactly one verdict as the final uppercase line:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.

This pass is advisory-with-teeth. Findings carry `BLOCKER`, `IMPORTANT`, or
`NIT` plus exact citations. `NEEDS_REWORK` findings must be dispositioned but do
not independently gate; `BLOCKED` requires user escalation.
