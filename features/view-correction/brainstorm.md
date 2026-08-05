# Stage 14 combined — restore schematic, remove combined, labels off the ink (tickets #74 + #75 + #76) — brainstorm v3 — FROZEN 2026-08-05

> **FROZEN.** Correctness: r1 both NEEDS_REWORK (converged partition
> BLOCKER, folded v2); r2 APPROVED + APPROVED_WITH_NITS (folded v3).
> Simplify: APPROVED_WITH_NITS (1 LOW — the chain-engine deferral,
> recorded in ledger #2 + ticket #77). This is the implementation
> contract for tickets #74 + #75 + #76 (+ closes #71 by restore).

**Goal.** Michael's correction (2026-08-05, verbatim): "no you removed
the wrong one i liked the first view and dont want this combined one".
Root cause on record (#67 decision): the pre-S13 toggle named the
NEXT view, so his "remove schematic view" — spoken while ON the
Combined view under a "View: Schematic" button — named Combined; S13
deleted the real schematic he liked.

*Cites: view files = src/ui/…; old-schematic source = git
`ba35744:src/ui/…` (the pre-deletion develop commit).*

## Already settled — do NOT re-litigate

- The restore/removal split IS the directive (not a design fork):
  schematic BACK and first; Combined GONE; Blueprint STAYS; the S13
  honest current-view tabs STAY. All S12/S13 Blueprint decisions
  stand (gutter, mark lift, FIT|DETAIL toggle, override table).
  All-Claude roster; full gate; walks at Wire ×28 + Plastic ×161.

## Grounded current state (this session)

1. **Restore source:** `ba35744` holds the complete pre-deletion
   schematic surface: Schematic.tsx, src/ui/layout.ts,
   src/ui/layout.test.ts, the schematic CSS blocks (recoverable from
   the S13 diff), the schematic smoke tests. svg-scale.ts now carries
   its own `REF_W = 960` (S13) — the restore must NOT re-couple it to
   LAYOUT.
2. **Combined deletion surface (r1 CORRECTED — both reviewers
   converged on the v1 split being wrong):** ChainBlueprint.tsx
   (+ its test, + its component-local deriveChainView export) is
   imported ONLY by App.tsx (:22, :434). chain-view.ts is SHARED,
   and the KEPT `drawnDistanceDm` (LinkInspector.tsx:29,:145)
   TRANSITIVELY CALLS solvedStageIds (:133), buildChainSites (:134),
   buildChain (:135) and nearestEdgeConnector (:139) — so ALL of
   those STAY, and since buildChain survives, `layoutChain`
   (src/layout/layout.ts:356, buildChain its sole caller at
   chain-view.ts:114) ALSO stays with its layout.test.ts blocks.
   The v1 claim that these were "consumer-free" was the r1
   BLOCKER/HIGH. The TRUE casualties: chainConnectors +
   ChainConnector (consumed only by ChainBlueprint:285 + tests),
   chainTransportPower + ChainPowerFooter (ChainBlueprint:319 +
   tests; App's power footer uses advice.ts chainPowerText, NOT
   this), and isVehicleModeLink (consumed only by chainConnectors
   :230 — provably dead with it, r1 code nit settled). `layoutStage`
   STAYS (Blueprint). CSS: the chain-bp blocks die, EXCEPT one
   surgical case (r1 code IMPORTANT): app.css:1513-1518 is a GROUPED
   selector (`.bp-machine-label, .bp-mark-label, .chain-bp-power,
   .chain-bp-link-label`) — remove only the two chain-bp members,
   keep the two Blueprint survivors; app.css:709
   (`.chain-bp-site.selected .bp-foundation`) is a compound
   chain-bp-scoped rule that dies whole. SHARED SURVIVORS
   (S12-mapped): .bp-scroll, .bp-svg, svg-scale, blueprint-zoom
   (Blueprint remains its consumer — one-consumer is fine, its pure
   test consumes it too), the S13 tabs.
3. **The garble mechanism (old schematic, decisive — EVERY number
   below re-verified first-hand against `ba35744` source THIS
   session, r1 code IMPORTANT discharged):** feed lanes draw the
   name at `y = track.y + 12` with the bus at `track.y + 48`
   (feedTrack: `busY: bandY + LAYOUT.laneH - 8`, laneH 56) — 36px
   clear, matching Michael's screenshot where "Wire" reads fine.
   OUTPUT lanes put the bus at `track.y + 8` (outputTrack:
   `busY: bandY + 8`) and the name baseline at `track.y + 12`
   (`Schematic.tsx:97` lane-name at x=4) — the name's bbox
   (≈ y+1…y+12 at 11px) CROSSES the bus stroke → "Cable" ON the
   purple lane, exactly his original screenshot. Seams verified
   `y1 = busY − 6, y2 = busY + 6`. Belt arrows verified: feed
   arrows run `track.y + 16 → busY` (downward), output arrows
   `machineTopY → busY` (from the machine row above) — NOTHING
   renders below an output bus, and the feed name bbox (y+1…y+12)
   clears the feed-arrow start (y+16) by 4px. Constants verified:
   laneH 56, busH 28, machineH 40. And `Schematic.tsx` at ba35744
   imports + calls BOTH beltLabel (:136) and segTooltip (:108) —
   the #71 closure precondition holds.

## Axis A — restore the schematic, first and default (#74)

**Pick: git-restore + tab adaptation.**
- `git checkout ba35744 -- src/ui/Schematic.tsx src/ui/layout.ts
  src/ui/layout.test.ts`; re-add the schematic CSS blocks and the
  schematic smoke tests from the S13 diff (reverse-apply the
  relevant hunks; the app.css base has since gained the
  override-table rules, so re-add, don't blind-revert).
- App.tsx: View type back to "schematic" | "blueprint" (Combined
  removed by Axis B in the same change), default **"schematic"**;
  tabs [SCHEMATIC | BLUEPRINT] in the S13 .view-tab idiom (current
  view named, active marked). The S13 renamed boot test flips its
  name/comment back to a schematic-default framing — its
  bp-svg-absence assertion is view-independent (the SSR gate) and
  stays; its `not.toContain("schematic")` line (smoke.test.tsx:485)
  is REMOVED (r1 nit made explicit: it was the S13 deletion-sweep
  pin, semantically backwards in a schematic-default world even
  though the SSR boot path would let it pass) — its adjacent
  :483-484 comments ("the schematic surface is gone entirely")
  are swept in the same edit (r2 nit).
- svg-scale.ts UNTOUCHED (keeps local REF_W = 960; the restored
  ui/layout.ts LAYOUT simply is no longer imported by it — no
  re-coupling).
- format.ts `segTooltip`/`beltLabel` regain their production
  consumer → close #71 as resolved-by-restore at merge.

## Axis B — remove the Combined view (#75)

**Pick: partial-surface deletion per the r1-CORRECTED map (grounded
state §2).**
- DELETE: ChainBlueprint.tsx (incl. its deriveChainView export),
  ChainBlueprint.test.tsx, the chain-bp CSS blocks (with the
  app.css:1513 grouped-selector surgery and the :709 compound rule
  per §2), the App import/render branch, and ONLY these chain-view
  exports: chainConnectors, ChainConnector, chainTransportPower,
  ChainPowerFooter, isVehicleModeLink (+ their chain-view.test
  blocks). Each re-confirmed consumer-free by grep at
  implementation AFTER ChainBlueprint is gone.
- KEEP in chain-view.ts (the r1 converged correction): the
  LinkInspector four (drawnDistanceDm, drawnMeters,
  applyDrawnDistance, isEstimatedLink) AND their transitive
  dependencies solvedStageIds, buildChainSites, buildChain,
  nearestEdgeConnector — and therefore `layoutChain` +
  its layout.test.ts blocks (buildChain is its sole caller and
  survives). The LinkInspector transport surface is untouched.
- The S12 Axis B skip note and the ChainBlueprint zoom-toggle usage
  die with the view (Blueprint keeps its own toggle — blueprint-zoom
  stays two-consumer→one-consumer, still earned as the pure module
  its test consumes).
- Non-goal guard: graph canvas, transport planning, solver,
  Blueprint untouched.

## Axis C — restored schematic: labels off the lane ink (#76)

**Pick: move the OUTPUT lane name below its bus; keep the feed
posture; halo both.**
- Output lane name baseline moves from `track.y + 12` to
  `track.busY + 18` (= track.y + 26): bbox ≈ busY+7…+18 — clear of
  the bus stroke (±~2), the seams (busY ± 6), and well inside the
  56px row. Feed lanes stay at y + 12 (36px clear today — grounded,
  not broken, not touched).
- Defense-in-depth: the S12 paint-order halo (`paint-order: stroke`,
  --bg stroke) applied to `.lane-name` — same idiom as
  .bp-mark-label, so even edge cases (belt-arrow glyphs at x near 4)
  read cleanly.
- Acceptance = the collision scan (text vs non-own-container ink)
  extended to the schematic returns ZERO at Wire ×28 AND
  Plastic ×161, both themes.

## Non-goals

- No schematic redesign beyond the label fix (the view returns as
  Michael liked it); no Blueprint changes; no store/persistence
  changes (view stays presentation useState); no new views; no
  transport/solver changes.

## Test plan sketch

- App: default view = schematic (tab active on open); tabs render
  SCHEMATIC + BLUEPRINT; not.toContain sweep for ChainBlueprint/
  chain-bp/Combined markup in the App smoke.
- Restored schematic smoke tests return as at ba35744, adjusted only
  where the S13 tab markup replaced the toggle; layout.test.ts
  returns whole.
- Axis C: a pin for the output lane-name y (busY + 18 via the
  restored fixture's known track values) + a geometry assertion that
  the name bbox band clears busY ± 6 (seams) on output lanes; the
  feed-lane y pin unchanged at y + 12.
- chain-view.test.ts: kept-export tests survive; deleted-export
  tests go with their exports — AND the shared fixtures chainAt
  (:121), site (:108), solvedConsumer (:55), stage (:76) become
  unused once those blocks go (their only remaining consumers are
  the deleted describes), which noUnusedLocals turns into a hard
  tsc failure — delete the four fixtures with the blocks (r2
  adversarial LOW). store.test.ts applyDrawnDistance untouched.
- Deleted-surface sweep: zero references to ChainBlueprint/
  layoutChain/chain-bp classes outside intentional comments.
- Bidirectionality log per changed behavior (default view/tabs,
  output-name lift, deletion sweep pin) —
  features/view-correction/r2-verification.log.
- Both-media walk (Wire ×28 + Plastic ×161, both themes): schematic
  opens first; collision scan ZERO on schematic AND blueprint;
  Blueprint unchanged (spot pins); no Combined reachable; override
  table + gutter intact.

## Assumptions ledger

1. ba35744 is the correct restore point (last develop commit before
   the S13 merge; the schematic files there predate no other
   pending change — verified: S13 was the only arc touching them
   since S12P1 shipped).
2. The chain-view consumer split is the r1-corrected one (grounded
   state §2): the DELETE set is exactly {chainConnectors,
   ChainConnector, chainTransportPower, ChainPowerFooter,
   isVehicleModeLink, deriveChainView}; everything reachable from
   drawnDistanceDm stays. DELIBERATE DEFERRAL (simplify LOW): the
   kept buildChain/layoutChain engine is heavier than its one
   surviving consumer needs — retained here as proven surface
   (collapsing it is a behavior-touching refactor of the kept
   LinkInspector values, out of this corrective arc's scope);
   tracked as ticket #77. Re-confirmed by grep at implementation
   after the component deletion. Restore-side signature drift
   (itemName/beltLabel/segTooltip/store selectors vs today's
   shapes) is the implementer's mandatory pre-impl drift hunt
   (r1 adversarial LOW).
3. The output-lane garble geometry read from ba35744 source
   (busY = y+8 vs name baseline y+12); the +18 lift clears seams
   (±6) with ~1px margin over an 11px ascender — the geometry pin
   protects it (same posture as the S13 clearance test).
4. The schematic's own S12-era LOD band (bandMode > 114) returns
   with the restore and is out of scope beyond "unaffected".

## Revision history

- v1 (2026-08-05): initial — grounded in Michael's correction, the
  #67 root-cause decision, the ba35744 restore source, the grepped
  chain-view consumer split, and the decoded output-lane garble
  geometry (bus y+8 vs name y+12).
- v2 (2026-08-05): r1 BOTH NEEDS_REWORK, CONVERGED on the same core
  defect ([code] 1 BLOCKER + 3 IMPORTANT + 3 nits; [adversarial]
  1 HIGH + 1 LOW): the v1 DELETE list broke the kept LinkInspector
  surface — drawnDistanceDm transitively calls solvedStageIds/
  buildChainSites/buildChain/nearestEdgeConnector, so those (and
  therefore layoutChain) STAY; the true casualties are only the
  connector/power-footer derivations + isVehicleModeLink (settled
  dead, not hedged) + deriveChainView + the component/test/CSS.
  Also folded: the app.css:1513 grouped-selector surgery + the :709
  compound rule named explicitly; the boot test's
  not.toContain("schematic") line explicitly REMOVED; the Axis C
  geometry verification gap discharged by the team lead re-reading
  EVERY quoted number from ba35744 source this session (busY
  offsets, seams ±6, belt-arrow extents — nothing renders below an
  output bus; feed name clears arrow start by 4px) and the #71
  precondition verified (Schematic.tsx calls beltLabel :136 +
  segTooltip :108); restore-side signature drift assigned to the
  mandatory pre-impl drift hunt. Held by both reviewers: the
  ba35744 restore point, the svg-scale non-recoupling, the
  default/tab flip (no view-union coupling anywhere), the +18 lift's
  internal arithmetic with the non-optional geometry pin.
- v3 (2026-08-05): r2 pair CONVERGED — code-reviewer APPROVED (0),
  adversarial APPROVED_WITH_NITS (2 LOW + 1 nit), folded: the
  chain-view.test.ts shared fixtures (chainAt/site/solvedConsumer/
  stage) die with the deleted describes (noUnusedLocals would fail
  the check otherwise); the stale smoke.test :483-484 comments swept
  with the removed assertion. The unreachable-source LOW is
  DISCHARGED as already-mitigated: the geometry numbers were
  re-read first-hand from ba35744 by the team lead (recorded in
  grounded state §3) and the non-optional geometry pin protects the
  ~1px seam margin. Both reviewers confirmed the corrected partition
  exact in both directions, the CSS surgery complete (the only two
  mixed selectors are the named ones), and loop-done.
