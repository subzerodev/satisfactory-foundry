# #156 — completion note

Merged to develop, 2026-08-19 (merge commit follows 0c6f1a8; trunk verified
post-merge, worktree removed first: 50 files / 1247 tests, check green).

## What landed

- `src/ui/PackagingChainStrip.tsx` (+ DOM tests) — the shared compact SVG chain
  strip: packager/unpackager boxes, feed/forward/exit edge labels with rates +
  container display names + route texts (belt counts included), the dashed
  empty-container return loop, "—" unsized fallback.
- `src/ui/GraphCanvas.tsx` — Extraction / Package-for-transport sectioning
  (the checkbox label styled as the section head, structurally intact); the
  packaging result block → strip + figures line (combined packaging power) +
  the DRAWING-selector pointer; the Total-power line in `ExtractionPanel`
  (local baseline recompute via `machinePowerProjection` + the derive's own
  `parseClockText`; inline two-branch sum; hidden under a purity mix).
- `src/ui/LinkInspector.tsx` — the same strip + figures in the interstep
  summary (advisories untouched; no Total line).
- `src/ui/transport-text.ts` — `routeSummary` lifted from GraphCanvas (pure
  move), consumed by both call sites.
- Sweep fully dispositioned (incl. the lowercase package/unpackage idiom and
  the interleaved "20 MW" pin); 9-mutant bidirectionality log, all killed.

## What the reviewers caught

- Design r1: the sweep tokens missed LinkInspector's lowercase prose idiom;
  the section-label/checkbox ambiguity; the unnamed link-side route-text
  source (→ the routeSummary lift).
- Design simplify: per-group packaging power had no plan backing (folded);
  the Total line's hidden derive-change cost (folded to a local recompute —
  the Total itself kept on the user-commitment rationale).
- Design r4 (both reviewers): the local recompute's inputs were unreachable
  in the scope the fold named — relocated to `ExtractionPanel` (r5).
- Diff r1: a dead ternary branch + a shortcut lookup (folded); diff simplify:
  the float-branch one-liner reshaped to a named coalesce (folded, M5
  re-killed).

## Acceptance criteria

- Chain visual with the return loop, both call sites: DONE.
- Container items named on screen: DONE.
- Belt counts in the panel's route labels: DONE (via #157's chips).
- Sectioned panel + total power: DONE (total hidden under purity mixes;
  canisters-in-circulation honestly excluded).
