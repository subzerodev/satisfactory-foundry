# Stage 17 — drawn-distance goes two-site; the chain engine retires (ticket #89) — brainstorm v2

**Goal.** Michael's #81 decision (2026-08-05, recorded there and on
the epic trail): the Transport panel's drawn-distance becomes a pure
TWO-SITE measure — only the two endpoint stages' positions and
footprints matter; moving any other stage must not change it. The
chain-layout engine retires. Supersedes the S15 keep decision on #77.

*Cites: chain-view = src/ui/chain-view.ts; engine =
src/layout/layout.ts.*

## Already settled — do NOT re-litigate

- The semantics change itself (Michael's explicit #81 call — values
  on multi-stage plans change BY DESIGN). The LinkInspector surface
  keeps its signatures (drawnDistanceDm/drawnMeters/
  applyDrawnDistance/isEstimatedLink). All S12–S16 decisions stand.

## Grounded current state (this session + the S15/S16 record)

1. **Today's path:** drawnDistanceDm (chain-view.ts:112-129) →
   solvedStageIds + buildChainSites (per-stage layoutStage + name)
   → buildChain (:97-104: arrangement from positions → layoutChain)
   → siteWorldBox (:29, chain placement origin + local foundation
   box) → nearestEdgeConnector. layoutChain (engine :356+) = Step 1
   fanCoincident (coincidence fan-out), Step 2 K = max
   requiredScaleForPair over ALL pairs clamped K_MIN=1 (:319), Step
   3 ceilTo10 grid rounding of scaled origins. The S15 coupling pin
   (chain-view.test.ts) pins 80dm→240dm BECAUSE of the global K.
2. **Survivors vs retirees:** `ceilTo10` ALSO serves layoutStage's
   pitch (:118) — STAYS. `requiredScaleForPair` (:502-521) is the
   pair primitive — STAYS (exported or moved). `layoutStage`,
   footprints, `nearestEdgeConnector` (kept test), the LinkInspector
   four — STAY. RETIRE: layoutChain, fanCoincident, the K loop, the
   chain-specific rounding step, ChainLayout + ChainArrangement
   types, buildChain, the chain-assembly half of buildChainSites,
   siteWorldBox's chain-placement form, and their layout.test.ts /
   chain-view.test.ts blocks (incl. the S15 coupling pin, REPLACED
   below).
3. **The de-export scope note on #77/#81** (solvedStageIds/
   buildChainSites/buildChain internalized in S15) discharges here:
   buildChain dies; the others shrink to what the two-site path
   needs.

## The two-site measure (the pick)

`drawnDistanceDm(linkId, catalog, stages, stageOrder, links,
positions)` — signature unchanged:

1. Resolve the link; BOTH endpoints must be solved, else null
   (unchanged posture). **Signature posture (r1 adversarial
   IMPORTANT):** the 6-arg signature stays for caller stability
   (LinkInspector.tsx:145-152 passes all six), but `stageOrder`
   becomes unused in the two-site body — with noUnusedParameters on
   (tsconfig.app.json:23) it is renamed `_stageOrder` with a
   one-line "retained for caller stability" comment. Solvedness is
   checked directly on the two endpoint stages (no solvedStageIds
   pass).
2. For each endpoint: `layoutStage(...)` → its foundation bbox
   (local origin + w/h dm) — the per-stage half of today's
   buildChainSites, kept as a small private `siteFor(stage)`.
3. **Pairwise scale:** `k = requiredScaleForPair(posA, layoutA,
   posB, layoutB)` — the SAME primitive the old K loop maximized,
   applied to just this pair (it clamps to K_MIN internally). The
   "collision-free placement" spirit survives; the global coupling
   dies. **NO coincident guard needed (r1 BOTH reviewers — v1's
   divide-by-zero premise was FALSE):** requiredScaleForPair is
   TOTAL — each axis guards independently (dx > 0 ? … : Infinity,
   engine :516-517) and the all-Infinity case returns K_MIN (:520).
   Exactly-coincident positions therefore yield k = 1, both boxes at
   the same origin, and nearestEdgeConnector on identical boxes
   returns 0 dm NATURALLY — no special case in the code at all.
   **The limit behavior, stated honestly (r1 adversarial
   IMPORTANT):** as the canvas delta shrinks toward zero, k grows
   but the scaled separation k×delta converges to the pair's
   required clearance (leftWidth + CHAIN_GUTTER) — so near-coincident
   stages read a FLOOR distance (~80 dm for smelter-width sites),
   NOT a smooth approach to 0; exactly-coincident then snaps to 0.
   This gutter-enforced floor is INHERITED from the old flow (same
   behavior there), and the pins below encode it so nobody expects
   distance→0 continuity.
4. **No grid rounding:** the ceilTo10 origin-snapping was a
   chain-canvas aesthetic for a drawn view that no longer exists;
   the two-site measure uses the k-scaled origins directly. (Values
   change anyway by decision; stating the drop explicitly so it is
   a decision, not an accident.)
5. Boxes: each endpoint's foundation bbox `{x: pos.x × k,
   y: pos.y × k, w: cols × FOUNDATION_TILE, h: rows ×
   FOUNDATION_TILE}` — exactly siteWorldBox's shape with the
   k-scaled canvas position substituted for the chain placement
   origin. NOTE (r1 code IMPORTANT, v1 corrected): siteWorldBox
   does NOT apply any local foundations.origin offset — the box
   x/y IS the placement origin (chain-view.ts:38-43, parallel to
   the engine's siteBox :325-330); the two-site transplant adds NO
   origin term.
6. `nearestEdgeConnector(boxA, boxB).distanceDm` — unchanged.

**Pins:**
- The S15 three-stage COUPLING pin is REPLACED by a DECOUPLING pin:
  same fixture (A, B, C smelters), assert A↔B is IDENTICAL for
  C=(0,300) and C=(50,5) — the exact inversion of the old test,
  with the new pinned value (the pair-driven case: the A-B pair
  drove K in the old world, so the new value should equal the old
  80dm modulo the dropped rounding — the implementer pins the
  actual).
- A pair-only value pin (two stages, known geometry, exact dm —
  possibly NOT a multiple of 10 now that the chain rounding is
  gone; the pin and the walk must not assume round readouts, r1
  adversarial nit).
- The coincident-pair pin (same position → 0 dm, no special-case
  code — it falls out of the total primitive).
- The FLOOR pin (r1 adversarial): two nearly-coincident stages pin
  the gutter-enforced floor value (≈ leftWidth + CHAIN_GUTTER —
  the implementer pins the actual), documenting that the measure
  does NOT approach 0 smoothly.
- drawnMeters/applyDrawnDistance/isEstimatedLink tests untouched.

## Non-goals

- No LinkInspector UI changes (the readout just gets the new
  number); no store changes; no Blueprint/schematic changes;
  layoutStage and everything the Blueprint consumes untouched;
  no transport-plan math changes.

## Test plan sketch

- The four pins above (decoupling, pair value, coincident 0-dm,
  the near-coincident floor).
- Deleted-surface sweep: zero references to layoutChain/
  fanCoincident/ChainLayout/ChainArrangement/buildChain outside
  intentional comments; layoutStage + ceilTo10 + requiredScaleForPair
  still consumed.
- The kept chain-view tests (nearestEdgeConnector, drawnMeters,
  applyDrawnDistance, isEstimatedLink) green untouched.
- Bidirectionality log — features/two-site-distance/
  r2-verification.log (the decoupling pin's break = reintroduce a
  C-dependent term; the floor pin's break = drop the pairwise k;
  each break verified to genuinely fail).
- Walk: build a 3-stage chain (the Computer flow), select a link,
  read the distance; MOVE an unrelated stage → the readout must NOT
  change (the #81 acceptance); move an endpoint → it changes.

## Assumptions ledger

1. requiredScaleForPair's exact signature/semantics (engine
   :502-521) — verified by the S15 reviews; the implementer
   re-verifies the parameter shapes (canvas points + site layouts)
   at the drift hunt.
2. ceilTo10 is layoutStage-shared (:118) — grep-verified this
   session; only the CHAIN rounding step dies.
3. The old A-B pair-driven value (80dm) should survive modulo
   rounding — if the actual differs (rounding contributed), the
   implementer pins the actual and notes the delta (the values are
   new by decision; continuity where cheap is a nicety, not a
   contract).
4. siteWorldBox's local-origin offset math is reused verbatim in
   the two-site placement (only the chain placement origin is
   replaced by the k-scaled canvas position).

## Revision history

- v1 (2026-08-05): initial — grounded in the #81 decision, the S15
  engine map (K loop, fanCoincident, rounding), the ceilTo10
  shared-consumer check, and the S15/S16 review record.
- v2 (2026-08-06): r1 BOTH NEEDS_REWORK ([code] 2 IMPORTANT + 1 nit;
  [adversarial] 2 IMPORTANT + 2 nits), all folded: (1) the v1
  coincident "guard" premise was FALSE — requiredScaleForPair is
  total (per-axis Infinity guards, K_MIN on all-Infinity), and the
  0-dm coincident value falls out naturally with NO special case —
  the guard is DELETED from the design; (2) the near-coincident
  limit stated honestly — k×delta converges to the pair clearance,
  so nearby stages read a gutter-enforced floor (~80 dm), inherited
  from the old flow, now pinned explicitly; (3) siteWorldBox's math
  corrected (no local-origin offset — the box x/y IS the placement
  origin; the transplant adds no origin term); (4) the stageOrder
  unused-parameter posture stated (_stageOrder rename under
  noUnusedParameters, 6-arg caller stability); (5) fractional-dm
  readouts acknowledged (no round-number assumptions in pins/walk);
  buildChain cite :93. Both reviewers confirmed: single-axis-zero
  pairs are fine (per-axis guards), the retirement sweep is
  complete, the decoupling pin is decisive (80≠240 under old code),
  drawnMeters/applyDrawnDistance contracts absorb fractional dm,
  and the 80 dm A-B continuity is EXACT on the S15 fixture
  (rounding is a no-op there).
