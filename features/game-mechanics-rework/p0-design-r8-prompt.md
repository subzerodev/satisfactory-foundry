# Review request — #140 arc P0 design (r8)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/game-mechanics-rework/p0-brainstorm-spec.md` (uncommitted, revision r8)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `64a8fcf`)
**Stage:** design re-review after fold. r7 verdicts: code-reviewer APPROVED (path-precision corrections traced and confirmed); adversarial NEEDS_REWORK (1 IMPORTANT — the sanitizer's `undefined → max` bucket was pinned by zero tests; folded).

## The r7 → r8 delta to verify (scope to this — ONE added test pin)

**The missing-field pin** (new bullet in the Tests section, directly after the junk pin): a persisted valid-JSON row `{ state: { unlockedTiers: { pipe: 1 } }, version: 0 }` hydrates with `belt` → 6 via the merge and `pipe: 1` kept. Verify:

1. The fixture shape actually drives the merge (valid JSON parses, `deserializedStorageValue` truthy, version matches → `options.merge` runs with `tiers?.belt === undefined`) — i.e. this pin genuinely exercises the sanitizer's bucket 1, unlike the corrupt-JSON pin.
2. The cited fixture list (`store.test.ts:833,865,942,963,993,1016` all supplying both fields) is accurate — is there any EXISTING test that already drives a single-field/null/array `unlockedTiers` through the merge, which would make this pin redundant?
3. The pin's assertions are consistent with the three-branch sanitizer and the surrounding pins (junk pin, loss-free reboot pin, the rewritten :862-874) — no contradiction introduced.

Settled across r1-r7 (do not re-litigate): everything in the prior settled lists plus both path-precision corrections (traced clause-by-clause against zustand middleware in r7 by both reviewers).

This is round eight; the delta is one test bullet. If it is sound, an honest APPROVED ends the loop — do not manufacture.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
