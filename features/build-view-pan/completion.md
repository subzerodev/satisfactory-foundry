# #154 completion note — build view pans at readable pitch

**Merged:** `feature/build-view-pan` → `develop`, `--no-ff`, 2026-08-19
(six commits `a270550..2d77488`; 12 files, +696/−547).
**Spec:** `brainstorm-spec.md` @ `82bb7dc` — five correctness rounds +
simplify, with the deletion-sweep contract itself review-hardened
(authority inverted to a case-insensitive grep gate after the manual
enumeration under-counted twice).

## What landed

Michael's field report, both findings: the 24px readable pitch floor with
scroll-when-wider and grab-drag panning (`useGrabScroll`, shared by the
build and Machines views; N≤38 pixel-identical); and the ruler's legend
entry (ConventionEntry: tall tick = stretch boundary, short tick = the
number's machine). Band mode retired — its fit-to-width premise died with
the floor; the Machines view shows rects + an always-visible ×N caption
as #138's neutral baseline (coordination comment posted there).

## Review trail

Design: r1-r5 + simplify + two scoped re-runs (the rounds caught two
pitch-8-keyed fixture files the sweeps missed, a trigger inversion, the
case-blind gate, and two of the team lead's own silent no-op edits —
all on the record). Diff: APPROVED + APPROVED_WITH_NITS (the hook's
release-outside click-swallow and text-selection nits folded); simplify
folded the vestigial alias; every fold verified by a scoped pair. The
implementer surfaced a THIRD pitch-keyed fixture file
(`coincident-feed-marks.test.tsx`) and re-derived it per the spec's
governing principle — endorsed at the diff gate.

Bidirectionality: 6 behaviours mutation-proven; the 66-hit sweep
disposition table (zero undispositioned) in `r2-verification.log`.

## Recorded, no action

The hover-on-ruler discoverability aid was dropped as past-requirement
(the legend is the app's convention home) — Michael's product call if he
ever wants it. The overlapping N=38 pins are deliberate distinct-AC
coverage.
