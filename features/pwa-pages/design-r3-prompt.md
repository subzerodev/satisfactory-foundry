# Design review r3 — Stage 18 (#56): simplify-fold delta only

Correctness converged at r2 (both reviewers APPROVED, 0 findings) on
brainstorm v2. The one-shot simplify pass then returned 2 advisory NITs; both
were folded, producing v3. Per the dual-review contract, this round re-checks
CORRECTNESS of the fold delta ONLY — do not re-review the r2-settled design.

Artifact: `/home/subzerodev/workspace/satisfactory-foundry/features/pwa-pages/brainstorm.md` (v3).

## The delta (all in Axis 6 + spec item 4 + revision history)

1. `maskable-512.png` dropped. The source SVG is authored with the glyph
   inside the maskable safe zone (inner 80%); `pwa-512.png` is declared
   `purpose: "any maskable"`; three PNGs ship (192, 512, apple-touch-180).
   An escape hatch is recorded: if the crop genuinely diverges at authoring
   time, the implementer may split it.
2. `scripts/generate-icons.sh` reduced from an idempotent PASS/FAIL script to
   a minimal rsvg-convert recorder (regen provenance only).

## Verify

- Is a single `purpose: "any maskable"` 512 icon CORRECT (not merely
  simpler) for install surfaces (Chromium install prompt, Android maskable
  crop, and the manifest spec's treatment of multi-purpose icons)? Is
  anything materially lost vs a dedicated maskable icon, given the stated
  full-bleed-field + safe-zone-glyph authoring constraint?
- Does the v3 wording keep the spec internally consistent (Axis 6 vs spec
  item 4 vs walk plan — no leftover references to the dropped PNG)?
- Does the reduced script still satisfy its stated purpose (committed PNGs +
  regeneration provenance)?

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings.
