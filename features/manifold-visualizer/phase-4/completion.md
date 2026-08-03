# Phase 4 completion — src/ui React SVG schematic (ticket #6, epic #2)

Date: 2026-08-03
Branch: `feature/phase-4.0` → merged `--no-ff` into `develop` @ af0506a
(5 commits: plan ×2 + 3 impl + fold + simplify-fold; worktree + branch
removed). Trunk verified: 208/208 tests, `check` + `build` green.

## What landed

- `src/ui/` (12 source files + `app.css`): the complete v1 component layer —
  `App.tsx` (the sole store-connected shell), `UploadScreen` (UTF-16
  BOM-sniffing `decodeBytes` ported from the planner — `File.text()` would
  garble every real Docs.json), `ControlsStrip` (recipe select, machine
  count, clock %, prefix-count tier toggles, clear-overrides),
  `SummaryCards`, `Schematic` (SVG: machine row with compression + label
  stepping, feed/output lane bands, entry/break-out arrows, tier-colored bus
  segments with exact `peak … of …` hover titles, seam lines, error
  highlights), `LaneOverrides`, `FindingsPanel`, `Legend`, and the pure
  modules `layout.ts` / `format.ts` / `colors.ts` / `decode.ts`.
- 53 new tests (155 → 208): pure-module unit suites + `renderToStaticMarkup`
  smoke tests in the existing node env — zero new dependencies, zero config
  changes, exactly the pinned thin-UI posture.
- `src/main.tsx` boot line; `src/App.tsx` re-export. `src/core`, `src/data`,
  `src/state` untouched.

## What the gate caught

- **Spec r1 (NEEDS_REWORK ×2):** the label composition was self-contradictory
  (mockup's capacity slot missing / double-print risk); the segment tooltip
  had silently dropped its "of capacity" half; the stale-copy asserted a
  cause the data layer deliberately drops; vertical geometry had no formulas.
- **Plan r1:** the bidirectionality log was pointed at a nonexistent arc-root
  file — the spec's own §5 line was the typo; the plan now records the
  resolved divergence.
- **Boundary diff r1 (NEEDS_REWORK ×2, the arc's 5th-for-5th boundary
  catch):** the schematic tooltip printed `belt.capacity` as "peak" —
  `layout.ts` never passed `peakFlow` through — wrong on any under-filled
  span (the ordinary output case), masked by the worked example's exact-drain
  coincidence (480 = 480) making the only tooltip test a tautology. Folded:
  peakFlow threaded through (pure pass-through), `machineTop` exposed
  (killing a magic-number re-derivation), divergent N=17 tests added, spec
  §2.4 amended (its frozen type omitted the very field §3.4 renders).
- **Simplify (diff stage):** two cosmetic dead-weight folds (dead CSS rule,
  unstyled marker class), re-checked clean by the pair.
- **Team-lead dev-server walk:** real UTF-16 upload → Iron Ingot × 20 @ Mk4
  reproduced the worked example on screen (exact labels + tooltips);
  bad-clock and infeasible states render honestly; restore clean.

## Recorded interpretations / accepted deviations

- `LaneOverrides` rows omit the tier token (spec §3.5's pinned props admit no
  `TierTable`); full labels live in the schematic + summary. Judged honest by
  both boundary reviewers.
- `src/ui/fixtures.ts` is a standalone test-only module (plan said "inside
  the test files"); verified unimported by production code — accepted as the
  cleaner shape.
- The r2-verification log lives at the per-phase path (spec §5's arc-root
  line was a recorded typo).

## Acceptance criteria (ticket #6) — final status

- Brainstorm+spec dual-reviewed + frozen — **met** (brainstorm r1 converged;
  spec 2 rounds; plan 2 rounds; all simplify-dispositioned).
- Full v1 flow renders — **met** (dev-server walk + smoke suite).
- Everything re-renders from the store's derived solve; no UI-side math
  beyond integer-index geometry + exact-string formatting — **met**
  (adversarial purity grep: zero Fraction→number conversions).
- Honest degenerate/invalid/infeasible rendering — **met**.
- check + tests + build green; core purity untouched — **met** (208/208).
- Cumulative diff dual-reviewed; merged `--no-ff` — **met** (r1 folded → r2
  double-APPROVED; merge af0506a).

## Arc status

Phase 4 was the final phase: the v1 manifold visualizer is complete on
`develop`. Remaining: final feature report + the `develop → main` release PR.
