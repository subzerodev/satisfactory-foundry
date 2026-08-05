# Stage 17 — drawn-distance goes two-site; the chain engine retires (ticket #89) — brainstorm v1

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
   (unchanged posture).
2. For each endpoint: `layoutStage(...)` → its foundation bbox
   (local origin + w/h dm) — the per-stage half of today's
   buildChainSites, kept as a small private `siteFor(stage)`.
3. **Pairwise scale:** `k = max(K_MIN, requiredScaleForPair(posA,
   layoutA, posB, layoutB))` — the SAME primitive the old K loop
   maximized, applied to just this pair. The "collision-free
   placement" spirit survives; the global coupling dies.
   **Coincident-pair guard (new, load-bearing):** the old flow
   guaranteed positive canvas deltas via fanCoincident; two-site
   must handle posA ≈ posB directly — if the canvas delta is zero
   on both axes, the boxes overlap at every scale → return 0 dm
   (an honest degenerate: the stages sit on top of each other).
   requiredScaleForPair must not divide by zero (guard before the
   call).
4. **No grid rounding:** the ceilTo10 origin-snapping was a
   chain-canvas aesthetic for a drawn view that no longer exists;
   the two-site measure uses the k-scaled origins directly. (Values
   change anyway by decision; stating the drop explicitly so it is
   a decision, not an accident.)
5. Boxes: each endpoint's foundation bbox at its k-scaled position
   (position × k, offset by the local foundation origin exactly as
   siteWorldBox does today, minus the chain placement indirection).
6. `nearestEdgeConnector(boxA, boxB).distanceDm` — unchanged.

**Pins:**
- The S15 three-stage COUPLING pin is REPLACED by a DECOUPLING pin:
  same fixture (A, B, C smelters), assert A↔B is IDENTICAL for
  C=(0,300) and C=(50,5) — the exact inversion of the old test,
  with the new pinned value (the pair-driven case: the A-B pair
  drove K in the old world, so the new value should equal the old
  80dm modulo the dropped rounding — the implementer pins the
  actual).
- A pair-only value pin (two stages, known geometry, exact dm).
- The coincident-pair pin (same position → 0 dm, no throw).
- drawnMeters/applyDrawnDistance/isEstimatedLink tests untouched.

## Non-goals

- No LinkInspector UI changes (the readout just gets the new
  number); no store changes; no Blueprint/schematic changes;
  layoutStage and everything the Blueprint consumes untouched;
  no transport-plan math changes.

## Test plan sketch

- The three pins above (decoupling, pair value, coincident guard).
- Deleted-surface sweep: zero references to layoutChain/
  fanCoincident/ChainLayout/ChainArrangement/buildChain outside
  intentional comments; layoutStage + ceilTo10 + requiredScaleForPair
  still consumed.
- The kept chain-view tests (nearestEdgeConnector, drawnMeters,
  applyDrawnDistance, isEstimatedLink) green untouched.
- Bidirectionality log — features/two-site-distance/
  r2-verification.log (the decoupling pin's break = restore the
  global-K path or perturb C-handling; the guard's break = remove
  it → throw).
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
