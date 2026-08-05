# Stage 14 combined — restore schematic, remove combined, labels off the ink (tickets #74 + #75 + #76) — brainstorm v1

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
2. **Combined deletion surface (grepped):** ChainBlueprint.tsx (+ its
   test) is imported ONLY by App.tsx (:22, :434). chain-view.ts is
   SHARED: LinkInspector.tsx (:28-33, transport planning — STAYS)
   imports drawnDistanceDm, drawnMeters, applyDrawnDistance,
   isEstimatedLink; store.test.ts uses applyDrawnDistance. The
   ChainBlueprint-only derivations (buildChainSites, buildChain,
   chainConnectors + ChainConnector, chainTransportPower +
   ChainPowerFooter, solvedStageIds — each re-verified by grep at
   implementation) die with the view; `layoutChain`
   (src/layout/layout.ts:356) has chain-view's buildChain as its
   only consumer → dies too (+ its layout.test.ts blocks);
   `layoutStage` STAYS (Blueprint). The chain-bp CSS blocks die.
   SHARED SURVIVORS (S12-mapped): .bp-scroll, .bp-svg, svg-scale,
   blueprint-zoom (Blueprint remains its consumer), the S13 tabs.
3. **The garble mechanism (old schematic, decisive):** feed lanes
   draw the name at `y = track.y + 12` with the bus at
   `track.y + 48` (laneH 56 − 8) — 36px clear, matching Michael's
   screenshot where "Wire" reads fine. OUTPUT lanes put the bus at
   `track.y + 8` and the name baseline at `track.y + 12`
   (`ba35744:src/ui/layout.ts` feedTrack/outputTrack;
   `Schematic.tsx:97` lane-name at x=4) — the name's bbox
   (≈ y+1…y+12 at 11px) CROSSES the bus stroke → "Cable" ON the
   purple lane, exactly his original screenshot. Seams span
   busY ± 6.

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
  stays.
- svg-scale.ts UNTOUCHED (keeps local REF_W = 960; the restored
  ui/layout.ts LAYOUT simply is no longer imported by it — no
  re-coupling).
- format.ts `segTooltip`/`beltLabel` regain their production
  consumer → close #71 as resolved-by-restore at merge.

## Axis B — remove the Combined view (#75)

**Pick: partial-surface deletion per the grounded map.**
- DELETE: ChainBlueprint.tsx, ChainBlueprint.test.tsx, the chain-bp
  CSS blocks, the App import/render branch, and the
  ChainBlueprint-only chain-view exports (buildChainSites,
  buildChain, chainConnectors, ChainConnector, chainTransportPower,
  ChainPowerFooter, solvedStageIds — each confirmed
  consumer-free by grep before deletion) + their chain-view.test
  blocks; `layoutChain` + its helpers/tests (keep layoutStage and
  everything Blueprint uses).
- KEEP in chain-view.ts: drawnDistanceDm, drawnMeters,
  applyDrawnDistance, isEstimatedLink, nearestEdgeConnector +
  isVehicleModeLink IF they are dependencies of the kept four
  (verify direction at implementation) — the LinkInspector transport
  surface is untouched.
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
  tests go with their exports; store.test.ts applyDrawnDistance
  untouched.
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
2. The chain-view consumer split (LinkInspector four + store.test
   one vs ChainBlueprint-only rest) grepped this session; the
   internal dependency direction (nearestEdgeConnector etc.)
   verified at implementation before deletion.
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
