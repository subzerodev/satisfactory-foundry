# Review request — #154 implementation, diff gate (r1)

**Artifact:** the cumulative diff `develop...feature/build-view-pan` (12 files, +687/−546; commits a270550/d4adc46/b92def8/5c35ae7). Generate it in the worktree or read the touched files.
**Worktree (live source):** `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/build-view-pan` (branch `feature/build-view-pan`)
**Spec (frozen, the contract):** `features/build-view-pan/brainstorm-spec.md` (frozen @ 82bb7dc — five correctness rounds + simplify + a hardened deletion sweep; the revision history is binding, incl. the N=114 DELETE and the dropped hover).
**State:** `npm test` 1227 passed (47 files), `npm run check` clean (team-lead re-verified).

## A. Current-state anchors

Read in the worktree: `src/ui/layout.ts` (the 24 floor, scrolled rule, deletions), `src/ui/Schematic.tsx` (the Ruler post-band, the hook wiring), `src/ui/Machines.tsx` (the rewrite), `src/ui/useGrabScroll.ts` + its dom test, `src/ui/Legend.tsx`, `src/ui/app.css`, the swept tests (`layout.test.ts`, `smoke.test.tsx`, `p2-drawing.test.tsx`, `coincident-feed-marks.test.tsx`), `features/build-view-pan/r2-verification.log` (incl. the sweep disposition table).

## B. What to verify

1. **Spec conformance A1-A6/Changes item by item** — incl. the exact deletions (grep bandMode/labeledSignificant/labelStep/MachineBand → zero identifier hits), the ConventionEntry legend text, NO ruler hover, the N=114 test DELETED (not re-pinned), the :221/:234 tombstone pins deleted with the class="machine" siblings kept.
2. **The re-derived fixtures — the highest-risk surface. Re-derive BOTH yourself:**
   (a) the p2-drawing left-fallback fixture: does the new geometry genuinely force the LEFT candidate at 24px, and does the re-pinned test still discriminate the suppression rule (would it fail if the suppression were removed)?
   (b) the coincident-feed-marks re-derivations (the implementer-surfaced THIRD pitch-keyed file): the inward-token-overlap test (groups moved to machines 113/115, `adjacent x1` 32→48) — is the re-forced collision real at 24px, does the test still pin the same BEHAVIOUR it pinned at pitch 8 (not a weakened cousin), and is the near-edge suppression still exercised?
3. **The sweep disposition table** in the verification log: 66 hits, zero undispositioned — spot-check a sample against the spec's map, and confirm the two map-only files' dispositions match the spec's final history (DELETE for :616-624, DELETE for the tombstones).
4. **The grab-drag implementation vs the design:** background-only start, 4px threshold, interactive children unaffected (the dom test's 5 pins — do they genuinely exercise the gate, or could the handler start drags from segments?), cursors in CSS.
5. **The verification log:** six behaviours + compiling mutants + genuine FAILs + restore-green; no green mutants.
6. **No scope creep, no weakened tests** beyond the dispositioned deletions.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
