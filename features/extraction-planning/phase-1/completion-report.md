# Extraction Planning Phase 1 Completion Report

**Ticket:** Forgejo #112
**Branch:** `feature/s22-112-extraction-p1-design`
**Status:** implementation complete; cumulative correctness review pending

## Delivered

- Parsed and cached exact extractor rates, topology, and raw-resource applicability for miners, Oil Extractor, Water Extractor, and Resource Well Extractor.
- Added exact Normal-purity derivation for extractor count, supply, spare rate, power, and per-extractor belt/pipe saturation.
- Added plan v6 persistence for extractor intent and required placement origin, with v1-v5 migration and prototype-safe raw-item keys.
- Made raw feed cards native buttons carrying live exact demand and opening a labeled non-modal extraction dialog.
- Added persisted extractor/clock controls, Water/Oil first-open seeding, explicit Resource Well/Nitrogen handling, Normal-purity labeling, unavailable states, and focus lifecycle.
- Consolidated notice and extraction content into one bounded top-right stack.
- Added a checked-in Vite plus system-Chromium/CDP browser gate using the production stack, panel, and real `GraphCanvas`.

## Acceptance Evidence

- Limestone 12,720/min at Miner Mk.3 100%: 53 extractors, 12,720/min supplied, 0 spare, 2385 MW.
- Limestone at 250%: 22 extractors, 600/min each, 13,200/min supplied, 480 spare; Mk4-only warns for Mk5 per extractor without comparing total demand to one belt.
- Water 10,600/min at 100%: 89 extractors, 10,680/min supplied, 80 spare, 1780 MW.
- Resource Well selections and cross-item standalone selections produce no stale count or power. Nitrogen names the pressurizer/satellite topology and shows no Miner estimate.
- Raw demand remains a `Fraction` from solve to panel and recomputes while open.
- Plan v6 survives save/load, import, bundle, rename/save-over, and export paths through the existing persistence matrix.
- Nine browser geometry rows pass at 360px, 720px, and 1280px with a measured 340px canvas, chain power present, and notice-only, extraction-only, and combined states. Three interaction rows exercise Limestone, Water, Crude Oil, and Nitrogen at every width.
- Native pointer, Enter, and Space activation each open exactly once; replacement, close focus restoration, auto-seed persistence, and raw disappearance are exercised in Chromium.

## Verification

- `npm test`: 39 files, 1024 tests passed.
- `npm run check`: passed.
- `npm run build`: passed with only the existing 500 kB chunk-size advisory.
- `git diff --check develop...HEAD`: passed.
- Mutation evidence: `r2-verification.log` records seven genuine production break/restore probes.
- Browser screenshots were inspected under `/tmp/satisfactory-foundry-112-browser`.

## Commits

- `1fc4361 feat(112): parse extractor capabilities`
- `5bcd381 feat(112): derive extraction requirements`
- `40e4f72 feat(112): persist extraction selections`
- `b937bfc feat(112): open extraction planning from raw feeds`
- `254e1ae feat(112): add extraction planning panel`

## Residual Scope

- Purity mixing remains Phase 2, using the already verified exact multipliers 1/2, 1, and 2.
- Resource Well satellite allocation remains intentionally unavailable without map/well inputs; Phase 1 does not invent a satellite count.
- The browser gate depends on `/usr/bin/chromium` and uses CDP directly; it does not add a Playwright dependency.
