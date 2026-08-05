# Review r1 — Stage 13 combined brainstorm v1 (tickets #68 + #69 + #70)

Artifact: /home/subzerodev/workspace/satisfactory-foundry/features/field-fixes-2/brainstorm.md (v1, develop c3d97d2).
Worktree: /home/subzerodev/workspace/satisfactory-foundry (read-only for you).

User directive (verbatim, not reviewable): "remove schematic view its not working also blueprint still has overlapping issues and the belt load stuff is not aligned at all and needs to be better displayed."

## A. Current-state anchors (verify against live source)

- src/ui/App.tsx — View type + VIEW_CYCLE (:64-71), default "schematic" (:171), next-view toggle comment (:414-421), Schematic render branch (:451).
- src/ui/Schematic.tsx — sole consumer of src/ui/layout.ts (imports computeLayout + types).
- src/ui/layout.ts — computeLayout/bandMode/significantMachines/LAYOUT; src/ui/layout.test.ts tests it.
- src/ui/svg-scale.ts — imports LAYOUT for REF_W = LAYOUT.viewW (:14-17 comment); svg-scale.test.ts also imports LAYOUT.
- src/ui/Blueprint.tsx — Marks (:262-276): circle r=8 at mk.at, label at x=at.x+12, y=at.y+4; junction rects (:245-253) from lane.junctions (j.x/j.y/j.w/j.h); BELT_LANE=20 (:39).
- src/layout/layout.ts — LANE_SPACING=60 (:77); junction geometry the layout engine emits (verify the junction rect's y-extent about the lane).
- src/ui/LaneOverrides.tsx + app.css — per-lane grid .lane-overrides-lane (:862), .override-row display:contents (:869), .lane-overrides-item span (:848), head/sub (:827/:837).
- Ticket #69's audit comment (mirrored in the brainstorm §Grounded 2): 35 mark-label/junction crossings at DETAIL on Wire ×28; label 36×13 at 134-170 vs junction 40×40 at 141-181.

## B. Claims/design to verify

1. **Axis A deletion surface**: is the consumer map complete (anything else importing ui/layout.ts or Schematic)? Is inlining REF_W=960 into svg-scale.ts truly value-preserving (LAYOUT.viewW === 960)? Is the two-tab current-view switcher the right minimal replacement, and is defaulting to "blueprint" sound (anything depending on the schematic default — persisted plans, tests, deep links)?
2. **Axis B lift constants**: verify the junction rect's actual vertical extent about the lane from the layout engine's emitted geometry (the brainstorm assumes ±20 about busY — ledger #3 flags it). Do y = at.y − 24 (feed) / at.y + 32 (output) actually clear the band, circle, and junction while staying clear of the neighbor lane at LANE_SPACING 60? Any case where marks sit at different y than the bus (at.y ≠ busY)? Does the below-bus output label rely on overflow:visible in a way the sheet PAD already covers?
3. **Axis C grid hoist**: does display:contents on .lane-overrides-lane preserve the data-item pin surface and the heading span semantics (grid-column 1/-1 now against the panel grid)? Anything else styled against .lane-overrides-lane as a box (padding/margins/borders) that display:contents would drop? Head/sub outside the grid — does .lane-overrides currently carry non-grid styling that conflicts with becoming the grid?
4. **Test plan honesty**: the CSS-only aspects (grid hoist) are declared walk-verified, not SSR-pinned — acceptable, or is there a cheap structural pin? Any existing pin that the deletion churns (schematic smoke tests get deleted — is anything else asserting on schematic markup)?
5. **Loop-done judgment**: is v1 implementable as written, or what is load-bearing and missing?

Verdict: exactly one of APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED, severity-tagged, line-cited findings.
