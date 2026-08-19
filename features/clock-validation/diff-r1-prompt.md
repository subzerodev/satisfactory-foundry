# Review request — #143 diff (r1): clock validation unification

**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry`, branch `feature/clock-validation` @ `cbb716a` (parent `develop` @ `1b58e11`).
**Diff:** `features/clock-validation/diff-r1.diff` (the `src/` diff of `git diff develop...HEAD`; the branch additionally adds `features/clock-validation/r2-verification.log`, the bidirectionality log).
**Frozen spec:** `features/clock-validation/brainstorm-spec.md` (r2 — correctness APPROVED + APPROVED, simplify APPROVED no findings). The diff must implement the spec exactly; deviation from the frozen spec is a finding even if the deviation is defensible.

## A. Current-state anchors

- The spec's D1–D4 and Tests sections define the expected shape: floor + two message edits + cap comment in `src/core/clock.ts`; derive swap + import in `src/state/store.ts`; enumerated test updates in `ChainBuilder.test.tsx`, `extraction-plan.test.ts`, `GraphCanvas.dom.test.tsx`, `smoke.test.tsx`, `store.test.ts`.
- Acceptance criteria (spec §Acceptance): identical accept/reject on all four surfaces; 1000 → bad-clock; 0.5 rejected / 1 and 250 accepted; `src/core/manifold.ts` untouched; test+lint green.

## B. What to verify

1. **Spec conformance.** Every D1–D4 item lands and nothing else does. Confirm `manifold.ts` is absent from the diff. Confirm no production file beyond `clock.ts` + `store.ts` changed.
2. **The floor check.** `value.lt(Fraction.from(1))` — boundary: does `"1"` pass and `"0.99…"` fail? Is the old `lte(0)` behaviour fully subsumed (no input that previously errored now succeeds)?
3. **The derive swap.** Reason stays `"bad-clock"`; detail = `` `${error}; got ${JSON.stringify(text)}.` ``; `clockPercent` flows on the ok path identically to before (same downstream usage).
4. **Test honesty.** New tests are real pins, not tautologies: check `features/clock-validation/r2-verification.log` exists and contains genuine `FAIL` lines, captured with production code stashed, that reference the diff's new test names ("rejects a sub-1% clock…", the extended store bad-clock case). Return NEEDS_REWORK if the log is missing or shows no genuine FAIL.
5. **Message-string sweep.** After this diff, zero occurrences of `"clock % must be greater than 0"` and zero non-fixture occurrences of `"(0, 250]"` should remain in `src/` (the `reconcile.test.ts` fixture and `link-transport.ts:37` doc comment are the allowed survivors per spec — verify that claim rather than assuming it; use `grep -a` where `plan-store.ts` is involved).
6. **Run the suite yourself if in doubt**: `npm test` (1145 passing at commit time), `npm run check` clean.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
