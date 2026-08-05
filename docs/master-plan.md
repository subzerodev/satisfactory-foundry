# Master plan

The plan layer of the operating model: Stages own the why / what / sequence and
the locked decisions. Each Stage maps to a Forgejo milestone (see
`.forgejo-ops.toml` `[stages]`).

## Stage 0 — Bootstrap

**Status: delivered** (ticket #1, merged to `develop` 2026-08-03; completion
note at `features/stage0-bootstrap/completion.md`).

- **Goal:** stand the project up — Vite + React + TypeScript scaffold, Vitest,
  lint/check tooling, `src/core/` purity boundary in place.
- **Deliverables:** runnable dev/build/test/check commands (recorded in
  `CLAUDE.md`), `src/core/` with the `Fraction` exact-arithmetic foundation
  (70-test suite).
- **Decisions** (mirrored from ticket #1 `decision:` audit comments):
  - `Fraction` is hand-rolled + BigInt-backed (no fraction.js dependency).
  - Lint tooling = ESLint flat config + `tsc -b`; core purity enforced as a
    package-import allowlist + globals ban; Prettier scoped to `src`.
  - Stage 0 spec frozen after 4-round dual-review + simplify pass:
    `docs/superpowers/specs/2026-08-03-stage0-bootstrap-design.md`.

## Stage 1 — Manifold visualizer (v1)

- **Goal:** ship v1 = the manifold visualizer, per
  `docs/superpowers/specs/2026-08-03-manifold-visualizer-design.md`.
- **Deliverables:** the manifold solver in `src/core/` (exact rational
  arithmetic) + the visualizer UI on top of it.
- **Decisions:** design decisions locked in the v1 spec (see its
  "Decisions made during brainstorming" section).
- **Status: SHIPPED 2026-08-03** — epic #2 (children #3–#6, all Done);
  released via PR #7 (`develop → main`, merge 8875c4a); 208/208 tests.
  Record: `features/manifold-visualizer/final-report.md`.
- **Post-release follow-on:** #9 bundled default catalog (decision #8 —
  boot-ready without an upload; not part of the Stage 1 release). SHIPPED
  2026-08-03 via PR #10 (merge 7de608a); 226/226 tests.

## Growth-path sequence (Stages 2–5)

**Decision (Michael, 2026-08-03):** run all four v1 growth-path arcs
sequentially — save/load → chained stages → physical layout → polish — with
opus/sonnet implementation-agent dispatch (opus for design-judgment tasks,
sonnet for mechanical; review roster stays all-Claude per epic #2). Order
rationale: serialization de-risks chaining; layout builds on the chained
canvas; polish lands last on the finished surface.

## Stage 2 — Plan save/load

- **Goal:** serialize the store to named, locally-persisted factory plans
  (save/list/load/rename/delete), exactness preserved, format forward-open
  for Stage 3's stage graphs.
- **Ticket:** #11 (milestone 73). **Status: SHIPPED 2026-08-03** — merged
  to develop (264/264 tests; 6-round design gate + first-try boundary
  convergence); released via the Stage 2 PR.

## Stage 3 — Chained stages (graph editor)

- **Goal:** the endgame — a factory graph of linked manifold stages (React
  Flow node editor); one stage's outputs feed the next; supersedes the
  third-party Modeler. Tier-3 multi-phase arc; decomposition at pickup.
- **Epic:** #12 (milestone 74). Blocked-by Stage 2.
- **Status: SHIPPED 2026-08-04** — three phases (graph model #16, canvas
  #17, plans-carry-graph #18), all Done; 347/347 tests; released via the
  Stage 3 PR. Record: `features/chained-stages/FEATURE.md`.

## Stage 4 — Physical layout layer

- **Goal:** geometry over the solve — footprints, splitter placement,
  foundation alignment; the schematic becomes a buildable blueprint view.
- **Ticket:** #13 (milestone 75). Blocked-by Stage 3.
- **Status: SHIPPED 2026-08-04** — two phases (layout engine #20,
  blueprint view #21), both Done; 377/377 tests; released via the
  Stage 4 PR. Record: `features/physical-layout/FEATURE.md`.

## Stage 5 — Polish round

- **Goal:** UX batch on the finished surface (styled tooltips, drag-drop
  upload, dark mode, large-N labels + accumulated small items).
- **Ticket:** #14 (milestone 76). Blocked-by Stage 4.
- **Status: SHIPPED 2026-08-04** — the pinned batch (tooltips, drag-drop
  with correct UTF-16 decode, dark mode, pipe-lane distinction) all
  landed; large-N decluttering was found already-implemented at design
  review (labelStep, Stage 1 P4) and verified in the walk. 395/395
  tests; released via the Stage 5 PR. Record: `features/polish/`.
  **All growth-path stages (2–5) are now shipped — the 2026-08-03
  sequential directive is fully discharged.**

## Post-plan sequence (Stages 6–7)

**Decision (Michael, 2026-08-04):** from the post-plan options, run the
chain-aware helpers batch now ("all except 3"), then grow the deferred
combined-blueprint item into a full logistics arc. Sequential, same
process (all-Claude roster, opus implementers, per-phase gates).

## Stage 6 — Chain-aware helpers

- **Goal:** the chain explains itself — match-demand suggestions on
  links, computed fix hints on capacity findings, plan export/import as
  files, exact per-stage + chain power totals (power enters the catalog:
  parser + cache work).
- **Epic:** #24 (milestone 77; children #25 data groundwork, #26 helper
  surfaces). Blocked-by Stage 5.
- **Status: SHIPPED 2026-08-04** — both phases Done; 454/454 tests;
  released via the Stage 6 PR. Record: `features/chain-helpers/`.

## Stage 7 — Logistics: combined blueprint + transport planning

- **Status: SHIPPED 2026-08-04** — all four phases Done (#30 research,
  #31 core math, #32 transport UI, #33 combined blueprint); 567/567
  tests; released via the Stage 7 PR. Record: `features/logistics/`.

- **Goal:** factories span locations — the combined multi-stage
  blueprint (deferred from Stage 4) plus per-link transport planning:
  mode (belt/pipe/truck/train/drone) + distance/trip time → how many
  vehicles sustain the rate; train cars-per-train vs more-trains
  tradeoffs. Vehicle facts are wiki-grounded (research-gate flagged).
- **Epic:** #27 (milestone 78). Blocked-by Stage 6.

## Stage 8 — Planner intelligence: hygiene, quick-apply, auto-chain + alt-recipe compare

- **Goal:** Michael's 2026-08-04 batch ("all of these next except the
  vehicle parser or sharing"): the two backlog hygiene tickets; one-click
  apply for match-demand suggestions; combined-view site focus; per-end
  train-station overrides + a user-facing pipe derate; the AUTO-CHAIN
  BUILDER (target item + rate → a proposed multi-stage chain with
  recipes, machine counts and links); alternate-recipe comparison across
  a chain (power / machines / resource cost).
- **Epic:** #36 (milestone 79). Sequential phases: P0 hygiene (#28 +
  #34) → P1 interaction polish (quick-apply + site focus) → P2 transport
  refinements (per-end stations, pipe derate) → P3 auto-chain builder →
  P4 alt-recipe compare (leverages P3's enumeration machinery).
  Excluded by directive: vehicle catalog admission, sharing/PWA.
- **Status: SHIPPED 2026-08-05** — all five phases Done (#28 #34 #37
  #38 #39 #40); 703/703 tests; released to main via PR #41; full gate
  per phase (dual-review + simplify at design and boundary, browser
  walks, R2 logs).

## Stage 9 — Drawing identity: the FICSIT engineering-drawing UI

- **Goal:** the app's first designed visual identity (approved on #42):
  a FICSIT drafting document — vellum sheet (light) and a true cyanotype
  blueprint (dark; the theme toggle is a medium change), Big Shoulders
  display + IBM Plex Mono numbers, title-block chrome carrying real plan
  data, dimension-line edges, inspection-stamp findings, a
  line-conventions legend. Behavior-frozen: presentation only, the test
  suite stays green.
- **Epic:** #43 (milestone 80). Phases: P0 tokens + type + sheet chrome
  → P1 canvas (plates, dimension lines, stamps) → P2 panels + schedules
  + both-mode polish walks.
- **Status: SHIPPED 2026-08-05** — all three phases Done (#44 #45
  #46); 707/707 tests; behavior-frozen throughout; released via the
  Stage 9 PR.

## Stage 10 — Canvas ergonomics + theming stragglers

- **Goal:** Michael's feedback on the live Stage 9 identity: controls
  outside the P2 panel groups (Recipe select, stage inputs, view
  toggle, inspector trip fields) join the medium; the graph area grows
  and becomes user-resizable; a flow-direction option lands
  (left-to-right vs top-to-bottom — handles + auto-placement).
- **Epic:** #48 (milestone 81). P0 theming stragglers (fix, #49) → P1
  resizable canvas + flow direction (behavior, #51; plan-file v5) → P2
  spacing pass (#50, added from live feedback).
- **Status:** SHIPPED (2026-08-05). P0 (base control rules) → P1
  (f7ab3ec — CSS resize seam, per-plan LR/TB direction, plan-file v5
  with the userPlaced flag, 728 tests) → P2 (5a86002 — measured spacing
  pass: panel insets, canvas button gap, tier-chip separation).
  Release: PR #52 (develop → main, merged 2026-08-05).

## Stage 11 — Views join the drawing + visible raw feeds

- **Goal:** Michael's 2026-08-05 round-2 feedback on the live Stage 10
  build: (1) the Schematic / Blueprint / Combined views get the full
  drawing treatment — theming + spacing inside the SVGs, which S9P2
  Axis 3 explicitly deferred "unless a walk demands it" (it has);
  (2) raw extraction feeds (Crude Oil, Copper Ore, …) become VISIBLE in
  the chain flow — the builder correctly stops at raw leaves, but the
  graph draws nothing for them, so a one-craft-step branch looks
  rootless next to a multi-step one.
- **Epic:** #53 (milestone 82). P0 views theming + spacing → P1 visible
  raw feeds (behavior; full design loop — source nodes vs feed
  annotations, LR/TB, persistence implications).
- **Status:** SHIPPED (2026-08-05). P0 (3a3feae — views theming +
  #55 sticky title block) → P1 (055d3dc — visible raw feeds: derived
  supply cards, ground-truth isRawResource classification, 741 tests).
  Release: PR #58 (develop → main, merged 2026-08-05).

## Stage 12 — Field fixes: catalog refresh, views at scale, clarity

- **Goal:** Michael's field report on the deployed Stage 11 build:
  (1) the raw-feed cards never appeared for cached users — the S11P1
  no-bump decision assumed a re-parse trigger that doesn't exist;
  (2) the Blueprint/Schematic/Combined views are unreadable at real
  scale (161 machines): label/lane overlap, dash-noise; (3) the
  per-belt override inputs are unlabeled; (4) the unsolved-stage
  wording is inconsistent across surfaces.
- **Epic:** #59 (milestone 83). P0 catalog version bump (#60, fix) →
  P1 views at scale (#62, full design loop) → P2+P3 combined clarity +
  navigation (#65 + #64, per Michael's "fix all issues now" — the
  re-evaluate-before-P3 gate dropped by epic decision).
- **Status:** all phases merged (started + finished 2026-08-05). P0
  merged + released early (PR #61). P1 merged + released (PR #63; the
  boundary gate caught a sub-cap enlargement the six design rounds
  missed). P2+P3 merged `93298d2`: override-panel headings, calm
  skip-note wording, Blueprint lane-name gutter (DETAIL-only,
  sizer-twin width — a boundary-caught CSS intrinsic-sizing bug),
  [FIT|DETAIL] toggle in both blueprint views opening floored plans
  at DETAIL. 767 tests. **SHIPPED** — release PR #66 merged to main 2026-08-05.

## Stage 13 — Field fixes round 2: remove schematic, blueprint overlap, override table

- **Goal:** Michael's field report on the Stage 12 build (2026-08-05,
  verbatim): "remove schematic view its not working also blueprint
  still has overlapping issues and the belt load stuff is not aligned
  at all and needs to be better displayed". Three items: (A) DELETE
  the schematic view (user directive) + stop the view switcher
  presenting the NEXT view's name as the current one (his screenshot
  shows the schematic under a "View: Blueprint" button); (B) grounded
  Blueprint overlap audit (rate marks vs machines/marks/grid) + fix
  what's real; (C) the override panel becomes one aligned table
  (per-lane grids can't share columns today).
- **Epic:** #67 (milestone 84; children #68 A, #69 B, #70 C).
  Combined cycle per the S12 P2+P3 precedent. Blocked-by Stage 12.
- **Status:** merged to develop 2026-08-05 (`bafae8c`, 749 tests,
  +421/−1150 — the schematic surface deleted whole). Walk: the #69
  collision scan 35 → ZERO at both zooms/themes; 66 override inputs
  one aligned column. **SHIPPED** — release PR #72 merged to main
  2026-08-05. Follow-up: #71 (test-only format helpers adjudication).

## Stage 14 — Correction: restore schematic, remove combined view

- **Goal:** Michael's correction (2026-08-05, verbatim): "no you
  removed the wrong one i liked the first view and dont want this
  combined one". Root cause: the pre-S13 next-view toggle labelling
  meant his "remove schematic view" (spoken on the Combined view
  under a "View: Schematic" button) named COMBINED; S13 deleted the
  real schematic. Correct: (A) restore the schematic from ba35744,
  first + default, tabs [SCHEMATIC | BLUEPRINT]; (B) remove
  ChainBlueprint + its exclusive chain-view/layoutChain machinery
  (LinkInspector's transport surface and Blueprint's shared scale/
  zoom machinery stay); (C) fix the restored schematic's output-lane
  name-on-bus garble (bus y+8 vs name y+12 — his "Cable" screenshot)
  + halo. Resolves #71 by restoring the helpers' consumer.
- **Epic:** #73 (milestone 85; children #74 A, #75 B, #76 C).
  Blocked-by Stage 13.
- **Status:** merged to develop 2026-08-05 (`3d69405`, 751 tests,
  +1268/−1182 — restore byte-exact vs ba35744 except the label lift).
  Walk: schematic default, zero text-on-ink at Wire ×28 + Plastic
  ×161 both themes; Blueprint intact; no Combined. Follow-ups: #77
  (chain-engine collapse), #78 (pre-existing band index-label
  crowding). **SHIPPED** — release PR #79 merged to main 2026-08-05.

## Stage 15 — Follow-ups: chain-engine collapse + band label declutter

- **Goal:** Michael's call-up ("ok work on that 77 and 78"): (#77)
  the chain-layout engine behind LinkInspector's drawn distance —
  pickup grounding killed the deletion premise (the collision-scale K
  maximizes over ALL site pairs, so distances depend on every stage's
  position; byte-identical ⇒ internalize + pin + record, full
  deletion is a Michael-call semantics change); (#78) the schematic
  band's index labels crowd at dense breakout patterns (85 measured
  crossings at Plastic ×161) — thin the LABELS by the existing
  labelPitch with finding-referenced machines always kept; every
  tick stays.
- **Epic:** #80 (milestone 86; children #77 + #78). Combined cycle.
  Blocked-by Stage 14.
- **Status:** merged to develop 2026-08-05 (`02490dc`, 759 tests).
  Walk: Plastic ×161 clean solve 85 → ZERO label crossings, both
  themes; the nine-pair starving residual pinned exactly; the
  drawn-distance live twin green. #81 (semantics decision) awaits
  Michael. **SHIPPED** — release PR #87 merged to main 2026-08-05.

## Stage 16 — Field polish: rates, names, honest numbers

- **Goal:** Michael's four screenshot asks: (#83) the alt-recipe
  compare table shows OUTPUT /min (per-row actuals from the primary
  ProposedStage.outputRate, guarded "—" for demoted candidates);
  (#84) canvas tiles name the building ("×65 Refinery"); (#85) the
  blueprint's machine numbers were 0-BASED against the 1-based
  solver vocabulary — the off-by-one behind his "breaks out after
  machine 12 but this says before" report (display-only fix, the
  geometry was right); (#86) schematic numbers centered under their
  cells, both modes, ticks unchanged.
- **Epic:** #82 (milestone 87; children #83 #84 #85 #86). Combined
  cycle under the clear-the-board directive. Blocked-by Stage 15.
- **Status:** merged to develop 2026-08-05 (`a0ebb29`, 770 tests).
  THREE design rounds (the wrong output formula, then an unguarded
  deref, both caught pre-code). Walk: all four axes verified live.
  **SHIPPED** — release PR #88 merged to main 2026-08-05.
