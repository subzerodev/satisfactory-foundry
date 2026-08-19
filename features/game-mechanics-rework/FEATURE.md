# FEATURE — #140 arc, Phase 2: the game-mechanics rework

**Epic:** forge #140 (the arc ticket; Phase 1 audit complete @ ae266b1).
**Trunk anchor:** all design anchors against `develop` — the four pre-arc
fixes (#142/#143/#144/#145) changed clock.ts, manifold.ts (bundleEligible),
store init, and machine-power since the gap report's line numbers.
**Release shape:** per #136 comment 24714 the model + #135 schematic +
#133 packaging + legend ship together — phases merge to `develop`
(unreleased) and the single `develop → main` PR carries them as ONE PR.
✓ CONFIRMED by Michael at USER GATE 1 (2026-08-19, #140 c24859):
continuous develop merges, one release PR.

## Locked decisions (from #140's decision index, comment 24798)

Overflow-chain default (24742) · ribbon + endpoint numbers (24769) ·
fan-in/out ≤3 with cascade counts (24797) · buffer cost one table line
(24796) · Level-1 fluid honesty (24770) · parsed tier table (24779) ·
train lockout 27.08→27 (24796) · deferred: #146 multi-item bus, #147 head
lift, #148/#149 on-demand only (24834/24836).

## Phases

| Phase | Scope | Status | Classification |
|---|---|---|---|
| P0 — data foundations | Parse the tier table from mSpeed÷2 / mFlowLimit×60 (dedupe + sort, derivation test); TRAIN_LOCKOUT_SECONDS 27.08→27 cited to mTimeToCompleteLoad | DONE (#150, merged cece96d) | READY — independent of the topology model |
| P1 — solver core: overflow-chain model | manifold.ts feed lanes become overflow chains: peak ≤ B invariant, belt parallelCount retired, trunk carry (S − i·d) per segment, attachment/cascade counts (≤3), standing-buffer figure, Level-1 fluid honesty (unordered pipe shortfall + nominal-ceiling caveat) | design in progress (#151) | READY — all decisions locked |
| P2 — drawing: ribbon + endpoints + legend | Schematic tapering ribbon + endpoint numbers, layout attachment kinds, tables (cascade counts + buffer line), the drawing's legend, format/SummaryCards text | pending | DESIGN after P1 spec freezes (consumes its result shape); plan deferred until P1 lands |
| P3 — schematic split (#135) | Separate views per #135 decision 24630; the r3 spec was built on the OLD model + the un-agreed 12px ruler — re-brainstorm required | pending | DEFERRED until P1+P2 land (must observe the new drawing) |
| P4 — raw packaging (#133) | Extraction-panel packaging per r4 spec (never implemented; v9 plan file, migrateV8 rebuild, canonicalized write) | pending | REVALIDATE r4 against post-P0/P1 develop; likely parallel to P2 |

## Child issues

- P0 = #150 (MERGED @ cece96d 2026-08-19; completion report p0-completion.md).
- P1 = #151 (design in progress 2026-08-19).
- P3 = #135, P4 = #133 (existing tickets are the children).
- P0/P1/P2: check-then-create at each phase start, anchored here.

## Status log

- 2026-08-18: manifest created; arc entered Phase 2 after the four pre-arc
  fixes landed (#142 61ac0e3, #143 b2403a5, #144 f008454, #145 8bb244a).
