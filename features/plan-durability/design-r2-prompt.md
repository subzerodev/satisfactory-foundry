# Design review r2 — Stage 19 (#92): plan durability (brainstorm v2)

Review the REVISED brainstorm+spec at
`/home/subzerodev/workspace/satisfactory-foundry/features/plan-durability/brainstorm.md`
(v2) against the live repo at `/home/subzerodev/workspace/satisfactory-foundry`.

Round 1 (degraded same-vendor): code-reviewer NEEDS_REWORK (1 IMPORTANT +
2 NIT), adversarial APPROVED_WITH_NITS (2 NIT + 1 note). The v2
`## Revision history` records every disposition, including one
rejected-with-rationale (the filename token repetition). Focus on the fold
delta ONLY — do not re-litigate what r1 settled.

## The delta

1. **Within-bundle duplicate names PINNED** (Axis 3): per-entry-fresh
   collision view (re-read `listPlanFiles()` per entry OR thread the
   running name→id map), last-entry-wins into ONE row, hoisting the list
   read above the loop explicitly FORBIDDEN; new dedicated test family
   (one row survives, last content, count proves no duplicate).
2. **Atomicity wording corrected**: serialized w.r.t. other plan ops; each
   entry its own IDB put; no mid-loop rollback (skip-invalid covers the
   expected failure path).
3. **Partial-success message** re-framed as an extension of the error
   channel mirroring uploadError's precedent (store.ts:1097/1189), red
   banner accepted.
4. **persistence.ts guard** now `typeof navigator !== "undefined" &&
   navigator.storage?.persist`; the assumptions ledger credits test
   immunity to "suites never call the helper", feature-detect as defense
   in depth.
5. **exportAllPlans enqueue divergence** from exportPlan's no-enqueue
   comment (store.ts:1705) made explicit; implementation must comment it.
6. **Filename NIT rejected** with the two-audiences rationale (Axis 4).

## Verify

- Is the pinned duplicate-name contract complete and implementable as
  stated (both allowed mechanisms genuinely yield last-entry-wins given
  awaited IDB transactions)? Any remaining ordering ambiguity?
- Does the new test family actually enforce the pin bidirectionally (would
  a hoisted-read implementation FAIL it)?
- Are the corrected wordings accurate against source
  (store.ts:1705, 1097/1189; app.css error banner)?
- Is the filename rejection rationale sound, or does it dodge a real
  problem?
- Any internal inconsistency introduced by the v2 edits?

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings.
