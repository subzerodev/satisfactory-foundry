# Forgejo #123 implementation summary

The frozen v5 design is implemented at the render boundary. Exact-coordinate
groups preserve every solver and layout member while Schematic and Blueprint
draw one bounded, focusable feed mark for coincident entries. Single feed marks
and all output marks retain their prior rendering paths.

Acceptance coverage is in `src/ui/coincident-feed-marks.test.tsx`. Mutation
evidence is in `r2-verification.log`.

Final branch verification on 2026-08-16 passed 994/994 tests across 38 files,
`npm run check`, `npm run build`, and `git diff --check`.

System Chromium inspected real-component harnesses at 1440x1000 and 390x844.
Schematic head/tail groups remained coherent at both widths; its dense token was
suppressed without hiding the double stem, and focus exposed the exact custom
tooltip. Blueprint DETAIL and FIT kept grouped head/tail marks separate from
adjacent labels, retained horizontal navigation on mobile, and showed the
dedicated focus stroke. The temporary harness was removed after inspection.
