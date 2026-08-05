# Review request — Stage 10 / P1 brainstorm v3 (r3, scoped to the r2 fold)

Artifact: `/home/subzerodev/workspace/satisfactory-foundry/features/canvas-ergonomics/phase-1/brainstorm.md` (now v3)
Worktree: `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`)

History: r1 both NEEDS_REWORK (6 findings, folded → v2). r2: code-reviewer APPROVED_WITH_NITS (numbering, folded); adversarial NEEDS_REWORK — one IMPORTANT: the v2 "userPlaced not persisted / seed from position-presence" design broke after one save→load round-trip, because the save path writes `position: s.positions[id]` unconditionally (src/state/store.ts:1464, source-verified), so re-saved auto slots would seed as user-placed and be permanently exempt from direction switches.

## The v3 fold to verify

The v5 plan-file stage entry now carries an optional `userPlaced?: true` flag:
- save writes positions unconditionally as today (exact restore stands) + the flag only for user-placed stages;
- a v5 load seeds the store's `userPlaced` set from the flag;
- v1–v4 loads fall back to `entry.position !== undefined` (conservative pinning of pre-v5 layouts, stated as a cost);
- test plan pins the save→load→switch cycle both ways (auto stays auto, dragged stays pinned);
- ledger item 9 records the store.ts:1464 premise; items renumbered 1–9; cite-shorthand header note added.

Check: (a) does the flag design actually close the round-trip hole with no NEW hole (consider: multiple save/load cycles, v5→v5 re-saves, stage remove + re-add, the builder's added stages, switching direction between save and load); (b) is the v1–v4 fallback coherent with Axis 2's migration story; (c) any inconsistency the fold introduced elsewhere in the artifact (Axis 2 wording, test plan, ledger).

Scoped re-check — the rest of the artifact converged in r2 (fitView timing, memo deps, four call sites, transpose, grip mitigation all confirmed sound under refutation; do not re-litigate absent a genuine new defect).

Verdict: one of APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED, with severity-tagged line-cited findings.
