# Extraction Planning Phase 2 Completion Report

**Ticket:** Forgejo #124
**Branch:** `feature/s22-124-extraction-p2-purity`
**Status:** merged to `develop` at `d5649c2`. Its post-simplify round **r3 did not
run before that merge**; #130 ran it retroactively and it found no production
defect, though it did surface an unpinned purity-precedence guard pair, now closed.
The verdicts are recorded on #130.

## Delivered

- Added exact Impure/Normal/Pure node-mix derivation using multipliers 1/2, 1,
  and 2 from the verified installed-game provenance.
- Added exact supplied rate, spare/shortfall, extractor power, and
  highest-present-purity transport results while retaining the Phase 1 Normal
  baseline.
- Added plan v7 persistence and strict validation for all three raw purity
  strings, with explicit v6 migration that cannot inherit future live fields.
- Added production panel controls that seed `0 / Normal baseline / 0`, preserve
  mix intent across extractor and clock edits, and expose validation errors
  accessibly.
- Excluded Water from node mixing while retaining it for Crude Oil.
- Extended the checked-in Chromium/CDP gate through real production controls
  and store state without removing any Phase 1 geometry, pointer, Enter, Space,
  resource, replacement, live-update, disappearance, or focus assertions.
- Moved `border-box` sizing onto the production graph canvas so its 100% width
  includes its border and cannot create document-level horizontal overflow.

## Browser Gate

The Limestone fixture supplies an exact `1000/min` demand at Miner Mk.3 100%.
Each interaction row scrolls every new control fully into the visible panel,
checks all four rectangle edges, and focuses it with a CDP pointer click. The
Miner is selected through native ArrowDown/Enter input; each purity number uses
CDP Control+A plus text insertion, with no direct value assignment or prototype
setter. DOM and production store state are checked after every edit. The gate
verifies the seeded `0/5/0`, the edited `1/1/1`, and exactly `840/min supplied`
plus `160/min shortfall`. Closing and reopening the panel proves the three
values persist in production store state.

| Width | Notice geometry | Extraction geometry | Combined geometry | Interaction result |
|---:|---|---|---|---|
| 360px | top 49, bottom 91, height 42 | top 49, bottom 219, height 170 | top 49, bottom 219, height 170 | six expanded controls contained; extractor/toggle/Pure scroll 0/68/112; document 360/360; purity exact/persisted; Water no mix; Oil mix; Nitrogen refusal; all Phase 1 interactions pass |
| 720px | top 49, bottom 91, height 42 | top 49, bottom 219, height 170 | top 49, bottom 219, height 170 | six expanded controls contained; extractor/toggle/Pure scroll 0/68/112; document 720/720; purity exact/persisted; Water no mix; Oil mix; Nitrogen refusal; all Phase 1 interactions pass |
| 1280px | top 16, bottom 58, height 42 | top 16, bottom 276, height 260 | top 16, bottom 276, height 260 | six expanded controls contained; extractor/toggle/Pure scroll 0/0/22; document 1280/1280; purity exact/persisted; Water no mix; Oil mix; Nitrogen refusal; all Phase 1 interactions pass |

This is nine passing geometry rows and three passing interaction rows. The
interaction rows retain exact-once pointer/Enter/Space activation, Limestone's
explicit Miner choice, Water/Oil auto-seed persistence, replacement focus,
live demand recomputation to `1800/min`, raw disappearance closure, surviving
opener focus restoration, Oil's no-false-total-demand warning, and explicit
Resource Well-only Nitrogen handling.

## Verification

- TDD red: `node scripts/extraction-panel-browser-check.mjs` failed at
  `Limestone Normal baseline` while the old harness still supplied `900/min`.
- Quality-hardening TDD red: the expanded, realistic gate reached all controls
  and then failed because the unmasked 360px interaction document and body were
  `362px` wide against a `360px` client, both initially and after interaction.
- `node scripts/extraction-panel-browser-check.mjs`: passed all nine geometry
  rows and three realistic interaction rows. Every expanded geometry control
  is fully contained after internal scrolling; document/body width is at most
  client width at 360px, 720px, and 1280px.
- `npm test`: 40 files and 1067 tests passed.
- `npm run check`: TypeScript, ESLint, and Prettier passed.
- `npm run build`: 226 modules transformed; production and PWA build passed
  with only the existing chunk-size advisory; 18 entries were precached.
- `git diff --check develop...HEAD`: passed with no output.
- Browser screenshots were written under
  `/tmp/satisfactory-foundry-112-browser`; the fresh 360px expanded extraction
  screenshot was inspected with no clipping, horizontal spill, or overlap.

## Resource Well Refusal

Phase 2 does not convert Resource Wells into standalone purity nodes. Nitrogen
still renders the explicit Resource Well Pressurizer/satellite refusal with no
Miner estimate or extractor selector. Crude Oil may use the standalone Oil
Extractor purity mix, but its Resource Well alternative remains uncounted and
named as requiring a pressurizer plus a map-specific satellite set. A complete
Resource Well planner remains separately scoped work.
