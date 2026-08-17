# Packaging Intersteps Completion Report

**Ticket:** #113
**Epic:** #114
**Date:** 2026-08-17
**Branch:** `feature/s22-113-intersteps`

## Delivered

- Discovers reversible Packager recipes from exact catalog IO and keeps the
  chain solver free of Packager cycles.
- Adds opt-in packaging intent to fluid/gas links with exact Packager,
  Unpackager, power, packaged-cargo, and empty-container return calculations.
- Gives forward cargo and empty returns independent solid transport routes,
  including train shared-end handling on the physical link sides.
- Keeps material reconciliation in original fluid/gas units while projecting
  transport into packaged units; material and interstep diagnostics coexist.
- Persists raw editable intent in plan v8, canonicalizes v7 transport data, and
  keeps stale intent recoverable after catalog replacement. Historically valid
  v7 array-shaped, inherited, and non-enumerable transports and trips migrate to
  exact plain v8 objects.
- Preserves source-version migration semantics: v3-ignored v4 transport
  extensions are stripped before the v3-to-v4 boundary, while v4-v7 retain
  legitimately admitted pipe derates and train shared ends.
- Canonicalizes public transport/interstep setter input field-by-field, stripping
  wider runtime properties and refusing malformed required structure before it
  can enter strict-v8 state.
- Rejects non-positive rates on every package/reverse recipe arm before any
  reciprocal calculation, so malformed uploaded catalog data cannot crash pair
  discovery.
- Adds a responsive production `LinkInspector` browser gate driven through
  system Chromium/CDP pointer, key, and text events only.

## Browser Evidence

Command: `node scripts/packaging-intersteps-browser-check.mjs`

```text
PASS geometry 360px activation=package_water panel=336x472 controls=5 document=360/360 wrapping=2
PASS geometry 720px activation=package_water panel=696x384 controls=5 document=720/720 wrapping=2
PASS geometry 1280px activation=package_water panel=1256x384 controls=5 document=1280/1280 wrapping=2
PASS workflow 1280px enable, clock=125, forward=train/900m, return=truck/750m, stale error, Tab+Space recovery=pipe, panel=1256x928, no JS value assignment
```

Screenshots were generated and visually inspected at:

- `/tmp/satisfactory-foundry-113-browser/geometry-360.png`
- `/tmp/satisfactory-foundry-113-browser/geometry-720.png`
- `/tmp/satisfactory-foundry-113-browser/geometry-1280.png`
- `/tmp/satisfactory-foundry-113-browser/workflow-1280.png`
- `/tmp/satisfactory-foundry-113-browser/stale-1280.png`
- `/tmp/satisfactory-foundry-113-browser/recovered-1280.png`

The 360px view keeps every control inside the inspector and viewport. The full
desktop screenshot shows independent train and truck routes. The stale view
keeps the checked recovery control and exact error visible; Tab+Space removes
the stale intent and restores the ordinary pipe editor.

The existing extraction browser gate also passed all 9 geometry rows and all 3
interaction rows at 360, 720, and 1280px, including document width 360/360,
720/720, and 1280/1280.

## Bidirectional Evidence

`r2-verification.log` records eleven temporary mutations and their named failing
tests. Sections 1-9 additionally record an exact `apply_patch` restore and a green
rerun per cycle; §10's two cycles share a single restore-and-green capture. Nine landed
in sections 1-9 during the original arc:

- pair/derive machine math;
- the v8-saveable store route guard;
- combined graph diagnostic precedence;
- inspector default intent and exact rendering;
- non-positive packaging-rate rejection;
- public setter canonicalization;
- historical v7 array transport/trip canonicalization;
- historical v7 inherited/non-enumerable property lookup canonicalization;
- historical v3 source-version extension stripping.

Section 10 adds two more under #127, decorrelating the v3 stripping fixture:

- valid `deratePercentText` still stripped at a v3 source (cycle 10a);
- valid `sharedEnds` still stripped at a v3 source (cycle 10b).

No mutation remains in the worktree.

## Final Branch Verification

```text
npm test
Test Files  44 passed (44)
Tests  1138 passed (1138)

npm test -- src/data/plan-store.test.ts
Test Files  1 passed (1)
Tests  82 passed (82)

npm run check
TypeScript, ESLint, and Prettier passed.

npm run build
230 modules transformed; PWA generated; build passed.
The existing >500 kB application-chunk advisory remains non-fatal.

git diff --check develop...HEAD
No output (passed).
```

## Constraints

- Packaging remains explicit user intent; Propose does not infer it.
- No graph stages are inserted and no container capital count is guessed.
- Pipe and fluid-truck remain illegal for packaged forward/return cargo.
- Route parse errors stay route-local; stale pair/clock failures suppress stale
  machine and transport results.
- Plan v7 is frozen; plan v8 is the first format that carries interstep intent.

## Review Disposition

- Design correctness converged at r13 after folding persistence, recovery,
  mutation-boundary, unit, and combined-diagnostic findings.
- The implementation plan correctness pair approved r5 after folding core
  ownership, atomic task boundaries, missing-item recovery, and browser/mutation
  evidence coverage.
- The one-shot plan simplification removed compatibility wrappers and reduced
  the browser matrix to one full workflow plus three responsive geometry rows.
- Cumulative implementation r1 returned `NEEDS_REWORK` from both correctness
  reviewers. Both findings were folded with TDD: all six non-positive recipe
  rates are guarded before division, and both public setters now canonicalize
  wider/type-erased input while refusing malformed required structure. Strict
  v8 exact-key validation was not weakened. Both correctness reviewers approved
  r2.
- The one-shot implementation simplify pass produced four findings, all folded:
  the browser gates now share only their CDP/Vite/Chromium mechanics; v7
  migration normalizes lenient `sharedEnds` and delegates to the core transport
  canonicalizer; intersteps skip the redundant ordinary link derivation; and the
  zero-logic `src/data/packaging.ts` facade was removed. That refactor itself did
  not add a behavior test or mutation row.
- Post-simplify correctness r3 found that the refactor rejected historically
  v7-valid arrays carrying own named transport/trip fields and that this report
  still described four mutations after six existed. Both findings were folded
  with a focused migration regression and a seventh break/fail/restore cycle.
- Post-simplify correctness r4 found that spread normalization still lost
  inherited/non-enumerable v7 fields and that v3-ignored v4 extensions crossed
  into later strict semantics. Both findings were folded with two focused tests
  and independent eighth/ninth mutation cycles. V8 validation remains unchanged.
- **The r5 post-fold correctness round did NOT run before the merge.** Its prompt
  was committed at `1b74dff` (2026-08-17 01:28:04) and `3c4324b` merged the
  feature to `develop` 4m34s later, with no commits between and no verdict
  recorded on #113 or here. Per Michael, the implementing session ran out of
  credits; the timestamp evidence above stands on its own regardless. An
  earlier version of this line claimed convergence; that claim had no evidence
  behind it and is retracted. Tracked as #127.
- **r5 ran retroactively under #127, post-merge**, on the same committed prompt
  (`diff-r5-prompt.md`) against the merged source: adversarial-reviewer
  `APPROVED_WITH_NITS`; code-reviewer `NEEDS_REWORK` whose sole IMPORTANT finding
  was the false convergence line above — not the code. Both reviewers
  independently re-derived and confirmed each of the five repair claims in
  `diff-r5-prompt.md` §B: (1) the `Object.create` view keeps
  inherited/non-enumerable and array-own fields visible while the canonicalizer
  sees a non-array record, nested trips included, with `defineProperty` overrides
  load-bearing against inherited non-writable properties; (2) `migrateV3` masks the
  two v4-only extensions at source version 3 while v4-v7 retain valid ones; (3) the
  focused tests fail on the prior code and pass now; (4) mutation cycles 8 and 9
  break the two behaviours independently with genuine named FAIL lines; (5) the
  cumulative feature is unaffected and the generalized throw label is wording-only.
  The reviewers also re-verified §A's standing anchor that strict closed-world v8
  validation is unchanged (`diff-r5-prompt.md:16-17`) — confirming it byte-identical
  — and, prompted by #127's dispatch rather than by `diff-r5-prompt.md`, that
  nothing in the delta touches `src/core/` or introduces float arithmetic (the
  repo-wide exact-arithmetic rule in `CLAUDE.md`, which that prompt does not
  mention). The mutation evidence cleared a guilty-until-proven check on four
  independent liveness signals.
- Nits folded under #127: the v3 stripping fixture is decorrelated with two
  v4-VALID rows plus two new mutation cycles (§10 of `r2-verification.log`), the
  log's pre-rename error captures and non-1:1 section numbering are annotated, and
  a misleading comment in the `migrateV3` header test is corrected. A raw NUL byte
  in `src/data/plan-store.ts` — which silently defeated `grep` on this arc's
  riskiest file — was found by the r5 adversarial lens and split to #129.
