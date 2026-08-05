# Review r1 — Stage 15 brainstorm v1 (tickets #77 + #78)

Artifact: /home/subzerodev/workspace/satisfactory-foundry/features/followups-15/brainstorm.md (v1, develop 4b51f37).
Worktree: /home/subzerodev/workspace/satisfactory-foundry (read-only for you).

## A. Current-state anchors (verify against live source)

- src/ui/chain-view.ts — drawnDistanceDm (:112-129) calling solvedStageIds (:57)/buildChainSites (:66)/buildChain (:93)/nearestEdgeConnector; the export keywords on the three candidates; siteWorldBox.
- src/layout/layout.ts — layoutChain (:356+): fanCoincident step, the K = max-over-pairs loop (:389-399+), grid rounding; K_MIN; requiredScaleForPair.
- src/ui/layout.ts — SchematicLayout (:32-60: band, significant, machines[].labeled, labelStep), significantMachines (:103-143 incl. the finding collection), LAYOUT.labelPitch = 20 (:23), bandMode (:89-91).
- src/ui/Schematic.tsx — MachineBand (:177-215): tick + label per significant index, xOf, the ×N count text (:188-190); the non-band label row (machines[].labeled) rendering (~:295-302).
- src/ui/chain-view.test.ts — which exports the KEPT tests import (the brainstorm claims nearestEdgeConnector yes, the three candidates no).
- #77's audit trail (mirrored in the brainstorm): the K-coupling grounding.

## B. Claims/design to verify

1. **Axis A (#77)**: verify the K-coupling claim yourself against layoutChain's source — is it true that a third stage's position can change the A↔B distance (K is global)? Is the internalize+pin+record outcome the correct consequence of the byte-identical acceptance, and is superseding the ticket's "engine deleted" clause by decision comment legitimate process? Is the proposed three-stage pin well-formed (can a unit test actually demonstrate move-C-changes-A↔B — construct the reasoning)? Do the three candidates truly have zero external consumers INCLUDING tests?
2. **Axis B (#78)**: verify the crowding mechanics (pitch at N=161, breakout density, label widths). Is the two-tier rule (finding-priority + greedy-by-labelPitch) sound — does the greedy guarantee actually prevent adjacent-label overlap by construction, including around priority seeds (a greedy-kept label may sit < labelPitch from a PRIORITY label — does the rule as written check distance against ALL kept including priorities)? Is dropping the last-index anchor justified by the ×N count? Is the ticks-unchanged claim compatible with the significantMachines split refactor?
3. **Test plan**: is the SSR "more ticks than labels" pin meaningful; does anything existing pin the band's label count (churn risk); is the LinkInspector live-twin walk item actionable?
4. **Scope**: anything in the design beyond the two tickets, or anything the tickets need that's missing?
5. **Loop-done judgment**: implementable as written?

Verdict: exactly one of APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED, severity-tagged, line-cited findings.
