# #157 — completion note

Merged to develop @ f7c3c60 (`Merge feature/packaging-build-view`), 2026-08-19.
Trunk verified post-merge (worktree removed first): 49 files / 1240 tests, check green.

## What landed

- `src/core/packaging-stage-input.ts` — the pure A1 adapter (`packagingStageInputs(plan, clockPercent, capacities)`; the spec's unused `catalog` param dropped, adjudicated faithful-and-better at diff r1).
- `src/ui/App.tsx` — drawing-subject selector (stage + one entry per packaging chain), stacked packager/unpackager Schematic + Machines rendering with per-group power, Blueprint disabled (non-interactive) for packaging subjects with the #158 note (carryover path shows the note in the pane; `view` never reset), LaneOverrides/FindingsPanel hidden under packaging subjects.
- `src/ui/transport-text.ts` + `src/ui/graph-flow.ts` — belt routes chip "N belts" (edgeChip belt case + the mode-half lift of the transportChipFor guard; unconfigured belt links stay chipless).
- Tests: adapter suite (decorrelated package/unpackage fixture), App.packaging.dom suite, chip re-derivations per the sweep map; `r2-verification.log` carries six compiling-mutant bidirectionality proofs (B1-B6).

## What the reviewers caught

- Design r1 (both NEEDS_REWORK): the "belt counts appear everywhere" claim was false — the graph-flow guard precedes edgeChip (fixed by lifting its mode half); a second belt-null test pin missed by the sweep.
- Design simplify: the Blueprint hedge was undecided work — decided stage-only, #158 spawned; label floor added.
- Diff r1 (adversarial NEEDS_REWORK): the Blueprint tab was still interactive — the frozen non-interactive clause was half-implemented and a DOM test had pinned the wrong half; plus the symmetric adapter fixture and the stage-panels leak, both folded.
- Diff simplify: 2 advisory NITs rejected with rationale (test-idiom collapse deferred to next touch; the Object.hasOwn guard is the #28 repo idiom).

## Acceptance criteria

- Packaging manifolds drawable as their own subject: DONE (Schematic + Machines; Blueprint → #158).
- Belt lane counts surfaced: DONE (chips + route summaries; the panel presentation is #156's).
- #156 feed ready: containerItemId, cargo rates, `runs` counts, per-group power all reachable from the plan + adapter.
