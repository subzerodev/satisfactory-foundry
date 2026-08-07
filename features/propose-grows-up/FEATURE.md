# Propose grows up: info + customization (Stage 20 arc)

**Started:** 2026-08-06
**Status:** COMPLETE 2026-08-07 — all four phases shipped on develop
**Epic:** #98 (board #21, Stage 20 milestone 91)
**Directive:** Michael 2026-08-06 — "we can give more info and customisation
there" → the full option menu → **"all of them as one arc."**

## Phase status

- **P0 (#99) — info layer**: DONE 2026-08-06 (merge on develop; 782
  tests, +9). Design v3 FROZEN after 4 review rounds (r1 caught a wrong
  signature + a false walk premise; simplify widened proposalMetrics
  with the varies bounds; r3 pinned the degenerate envelope). Boundary
  APPROVED+APPROVED (0); diff-simplify APPROVED (0); 4-behavior
  bidirectionality log. Walk: cost sheet 928 MW exact == TitleBlock
  Σ ≈ 928 MW (within-1-MW check); tiers T0-T3; fan-out feeds; recipe
  chips; both themes.
- **P1 (#100) — customization core**: DONE 2026-08-07 (merge on develop;
  814 tests, +32). Design v7 FROZEN after SIX correctness rounds (r1
  stage-deletion trap; r2 honesty gaps; r3 chip contradiction; r4
  reachability dead-end; r5-r6 layering coherence) + simplify (one
  collapse rejected → #103). Boundary r1: both reviewers converged on a
  real classifier defect (alternate-only collapse mislabeled "natural",
  recovery dead-coded) — fixed, cycle-7 logged; r2 APPROVED×2; simplify
  fold merged the two propose paths. Walk: alternate pick re-proposed
  live; override cleared on default-back; RAW toggle + strip; Smelter
  exclusion → Copper Ingot constrained with LIVE inline recovery →
  returned as Foundry ×3; Apply landed the customized chain; both
  themes. Field note: converter-only ores (Iron/Copper Ore, Crude Oil)
  honestly classify "constrained" — polish question parked as #104.
- **P2 (#101) — solver extensions**: DONE 2026-08-07 (merge on develop;
  834 tests trunk-verified, +27 in-phase). Design v4 FROZEN after 4 rounds: r1
  BLOCKER killed the byproduct ROUTE-toggle rider (duplicate-lane
  apply-path defect + contested partial-supply reconciliation) →
  routing descoped to #105, suggestions display-only; simplify caught
  routing-residue payload fields; r3 caught the two-producers key
  collision that narrowing regressed; r4 approved aggregate-then-match.
  Implementation: zero drift, 5 commits. Boundary r1: adversarial MAJOR
  — stale-clock at Apply (live clockText read; propose@100 → edit 150 →
  Apply seeded 150 on 100-sized counts) — fixed via Preview clockText
  snapshot; r2 APPROVED×2; diff-simplify APPROVED (0). 9-behavior
  bidirectionality log. Walk: Computer 10/min — 100% byte-stable
  (928 MW exact == P0 baseline); 150% counts drop (Manufacturer ×4→×3,
  hand-checked ceil(10/3.75)=3), Σ POWER ≈ 1122.9; snapshot immunity
  live (edit to 200 post-propose, applied node solves at 150 —
  ≈282.0 MW = 55×3×1.5^1.321929); TitleBlock Σ ≈ 1123 agrees; Aluminum
  Ingot chain renders both suggestion lines (Water 120/min → Alumina
  Solution, Silica 100/min → Aluminum Ingot) display-only with
  aggregated rates; no-match chain shows no line; both themes.
- **P3 (#102) — persistence + gating**: DONE 2026-08-07 (merge on
  develop; 896 tests trunk-verified, +62 in-phase). Research gate
  cleared by measurement: `tiers.ts` is TRANSPORT tiers, not
  progression — the real data is 574 `FGSchematic` entries in the
  bundled Docs.json, which the loader ignored. Design v12 FROZEN after
  EIGHT rounds plus a post-freeze amendment with its own review.
  The gate caught four SILENT failure modes before any code existed:
  (1) schematic refs end in an apostrophe and the repo's normalizer
  splits on it, so a whole ref yields `""` — gating would have matched
  nothing, hidden behind the design's own "no unlock data ⇒ no gating"
  tolerance; (2) `recipeUnlocks` is parsed data but the catalog cache
  is field-whitelisted, and its halves fail asymmetrically (revive is
  tsc-forced, serialize is not) — gating would have worked on first
  load and died silently on every boot after, the same bug this repo
  already paid a parser bump for with `isRawResource`; (3) two untyped
  test fixtures are not tsc-forced, one of which would have kept
  passing while losing the coverage it is named for; (4) a clamp I
  added mid-loop would have persisted `-Infinity` and gated out
  everything on a later boot. It also proved the `:441` seam
  behaviourally unobservable and recorded the proof so no later round
  re-adds a phantom pin.
  Implementation: the agent HALTED before coding on a genuine
  design-grounding failure — spec 8 required rendered-output
  assertions for seams unreachable in this repo's node/SSR posture.
  Resolved by scoping jsdom to one seam file (alternatives recorded as
  rejected); the agent then corrected two of the amendment's own
  mechanics BY MEASUREMENT (jsdom has no localStorage — opaque origin;
  the TIER value binding is a client-DOM no-op that would have been
  pinned non-discriminatingly).
  Boundary: four rounds. r1 found the phase's HEADLINE feature
  unpinned (the prefs mirror-backs — the sole assertion matched the
  seeded value) and a CSS class collision; the diff-simplify MEDIUM
  collapsed the two gated derivation sites onto the preview record,
  dissolving the r4-r6 memo-placement argument and removing a real
  skew; r3 found a ledger mutation that no longer COMPILED after that
  refactor, recording a crash's 16 red rows as stronger evidence where
  the true bite was 1 — and the regression a maintainer would actually
  write failed nothing, so the property was genuinely unpinned. r4
  APPROVED ×2, zero findings.
  SIX tests that passed whether the code worked or not were found and
  fixed across the phase; final ledger 48 behaviors, 46 pinned, 2
  proven no-ops, none unpinned.

## Grounding (verified 2026-08-06 at arc start)

- `src/core/chain-builder.ts` selectProducer already takes a validated
  per-item `overrides` map (Stage 8 P4) — unused by the Propose UI.
- `src/ui/chain-builder-adapter.ts` alt-compare machinery already computes
  chain metrics (power/machines/raw cost); `EXCLUDED_MACHINE_IDS` is a
  hardcoded module constant; `previewRowText` renders the flat row.
- `src/ui/ChainBuilder.tsx` (167 lines): item select + rate input +
  Propose/Apply; preview is component-local ephemeral state.
- `src/data/tiers.ts` exists (P3 design verifies what it carries).

## Decisions log

- 2026-08-06 (Michael, epic #98): all improvements, one arc; sequencing
  info → customization → solver → persistence (cost/dependency order).
