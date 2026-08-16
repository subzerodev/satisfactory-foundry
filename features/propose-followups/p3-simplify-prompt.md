# Simplify review — implementation diff at the diff stage

**Artifact under review:**
`/home/subzerodev/workspace/satisfactory-foundry/features/propose-followups/p3-boundary-r8.diff`
**Stage:** diff
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry`

This artifact has **ALREADY passed correctness review**: the final independent
correctness pair returned APPROVED / APPROVED on r8. Do not re-check
correctness, missing cases, or design intent.

Your sole job is to find over-engineering and name the simplest correct shape.
For each finding:

1. Cite exact `file:line` locations.
2. Name the concrete simpler replacement.
3. Explain why it preserves the frozen #105 requirements, grounded in source.

Look specifically for needless wrappers or indirection, duplicated logic that
can reuse an existing helper, defensive branches beyond the requirement, and
generality introduced without a caller. Required collision, stale-payload,
catalog-snapshot, and ambiguity guards are part of the approved contract, not
optional defensive machinery.

If the implementation is already as simple as it should be, return APPROVED
with no findings. Do not invent work.

Return severity-tagged findings and exactly one final verdict line:
`APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` / `BLOCKED`.

This is the one-shot diff-stage simplify pass. It is degraded same-vendor
review because the third-party reviewer is unavailable by user directive; tag
the result `(degraded: same-vendor, third-party reviewer unavailable)`.
