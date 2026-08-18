# Review request — #143 design (r2): clock validation unification

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/clock-validation/brainstorm-spec.md` (uncommitted, revision r2)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `ae266b1`)
**Stage:** design re-review after fold. r1 verdicts: code-reviewer APPROVED_WITH_NITS (3 nits), adversarial-reviewer NEEDS_REWORK (1 IMPORTANT, 2 NITs). All findings folded; dispositions in the spec's `## Revision history`.

## What changed r1 → r2 (the delta to verify)

1. **Tests section rewritten** (the IMPORTANT): now enumerates the four surviving assertions of the deleted `"clock % must be greater than 0"` message — `ChainBuilder.test.tsx:83` ("0"), `:90` ("-10"), `extraction-plan.test.ts:422` ("0"), `:423` ("-1") — routing them to the below-floor message and repurposing the non-positive cases as floor cases. Verify those four line citations against live source and that no FIFTH assertion of that string survives anywhere in `src/` (note: `src/data/plan-store.ts` contains a raw NUL byte; use `grep -a`).
2. **D4 gains the second persisted surface**: packaging-interstep intents (`plan-store.ts:787`) → `parseClockText` at `link-plan.ts:114` → `status: "unavailable"` at `link-plan.ts:116`. Verify those three citations.
3. **D1 message-routing paragraph + D3 additions** (advice.ts `parseClock` acknowledgement, smoke.test fixture note) — carried from r1.1.

## Anchors (unchanged from r1)

`src/core/clock.ts` (19 lines); `src/state/store.ts:500-517`; call sites `link-plan.ts:114`, `extraction-plan.ts:118`, `ChainBuilder.tsx:199,262` (+ re-export `:48`); solver backstop `manifold.ts:196-201` (spec: untouched); opaque fixtures `reconcile.test.ts:170,181` and `smoke.test.tsx:915,927`.

## Verdict basis

r1's core theses were verified sound by both reviewers (D1 boundary, D2 mapping, D3 one-owner-of-range-policy, D4 no-migration). Re-review the DELTA plus any interaction it creates; do not re-litigate the survived theses without new evidence. Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
