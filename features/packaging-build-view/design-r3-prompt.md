# Review request — #157 design (r3, scoped re-run on simplify folds)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/packaging-build-view/brainstorm-spec.md` (uncommitted, r3)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD ccc90fb)
**Stage:** scoped correctness re-run after the simplify-pass folds. r2: both reviewers APPROVED. Simplify: APPROVED_WITH_NITS (2), both folded. Per the dual-review contract, only the correctness pair re-runs after a simplify fold, scoped to the folds.

## The r2 → r3 delta to verify (scope STRICTLY to this — two text folds)

1. **A3 Blueprint decision** (was a hedge, now decided): Blueprint is stage-only for packaging subjects this ticket; the tab disables with a one-line note; per-group Blueprint is #158 (a real forge ticket, blocked on #157). Verify: (a) the stated ground (`Blueprint` takes a single `machineId`, `App.tsx:492`; a chain is two machine kinds) is true; (b) the fold left A3/Changes coherent (Changes item 2 now says Schematic + Machines stack, Blueprint disables); (c) disabling a tab for a subject introduces no correctness problem the spec ignores (e.g. what the tab shows if a packaging subject is active — the spec's "one-line note" is the answer; is that sufficient as specified?).
2. **A2 label floor** (new sentence): disambiguation-only floor, composed phrasing refinable under #156. Verify it contradicts nothing settled (the own-view decision, the selector-over-tabs rationale) and introduces no ambiguity about what the implementer must build (is "the item name suffices when chains don't collide" implementable as specified, and is the collision case's fallback the composed label?).

Settled at r1/r2 (do not re-litigate): everything else — the adapter, the guard lift, the sweep map, the citations.

This is a scoped round; the delta is two text folds from an advisory lens. If they are faithful and coherent, an honest APPROVED ends the loop — do not manufacture.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
