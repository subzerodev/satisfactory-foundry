# Boundary diff review r6 — S21 P3 (#105): split ambiguity/fan-out counts

Re-review the cumulative implementation diff in
`features/propose-followups/p3-boundary-r6.diff` for the worktree
`/home/subzerodev/workspace/satisfactory-foundry`.

This review is degraded because the third-party Claude reviewer is unavailable
by user directive. You are a fresh Codex agent copying the requested reviewer
role. Return exactly one verdict:

`APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` / `BLOCKED`

with severity-tagged, line-cited findings. Tag your verdict as
`(degraded: same-vendor, third-party reviewer unavailable)`.

## Prior r5 verdicts

Both reviewers returned NEEDS_REWORK on the same interaction: self candidates
must count toward multi-source display ambiguity, but self-consumption is not a
possible routed consumer and must not count as source fan-out.

## r6 fold to verify

1. Candidate construction still includes self candidates.
2. `displayCounts` counts every candidate, including self, so a self emitter
   plus another emitter suppresses the false single-source route into the self
   consumer.
3. `sourceCounts` counts only non-self candidates, so a self-emitting source
   with one external consumer retains that one legal route.
4. The final eligibility chain still removes every self route.
5. Red-first tests pin both interactions: `scrap water silica` stays suppressed,
   while `silica water solution` remains routeable.

## Review focus

- Verify the split count semantics against all five frozen eligibility rules.
- Check interactions with primary collisions and source fan-out.
- Re-check the cumulative implementation and verification log against #105.
