# Packaging Intersteps Completion Report

**Ticket:** #113
**Epic:** #114
**Date:** 2026-08-16
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
  keeps stale intent recoverable after catalog replacement.
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

`r2-verification.log` records four temporary `apply_patch` mutations and their
named failing tests, exact restore patches, and green reruns:

- pair/derive machine math;
- the v8-saveable store route guard;
- combined graph diagnostic precedence;
- inspector default intent and exact rendering.

No mutation remains in the worktree.

## Final Branch Verification

```text
npm test
Test Files  44 passed (44)
Tests  1135 passed (1135)

npm test -- --run src/data/plan-store.test.ts src/data/packaging.test.ts src/ui/LinkInspector.test.ts src/ui/LinkInspector.dom.test.tsx
Test Files  4 passed (4)
Tests  117 passed (117)

npm run check
TypeScript, ESLint, and Prettier passed.

npm run build
230 modules transformed; PWA generated; build passed.
The existing >500 kB application-chunk advisory remains non-fatal.

git diff --check
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
  zero-logic `src/data/packaging.ts` facade was removed. These are refactors only,
  so no behavior test or `r2-verification.log` mutation row was added.
- The post-simplify correctness rerun and merge remain parent-workflow actions.
