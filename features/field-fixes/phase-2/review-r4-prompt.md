# Review r4 — Stage 12 P2+P3 combined brainstorm v5 (tickets #65 + #64)

Artifact: `/home/subzerodev/workspace/satisfactory-foundry/features/field-fixes/phase-2/brainstorm.md` (v5, develop `0f36e97`).
Worktree: `/home/subzerodev/workspace/satisfactory-foundry` (read-only for you).

r3 history: code-reviewer APPROVED (0) on v4; adversarial NEEDS_REWORK (2 IMPORTANT) on v4 —
(1) Axis C never scoped the gutter to Blueprint-only while its mechanisms
(shared `.bp-scroll`, lane-name removal, the px formula) reach into
ChainBlueprint, where the formula omits the per-site translate term and a
single column can't represent 2D-stacked sites; (2) the r2
".bp-scroll → overflow-x: auto" change landed on the shared class
unconsidered. v5 folds both, plus one deliberate widening (below).

## A. Current-state anchors (verify against live source)

- `src/ui/Blueprint.tsx` — viewBox minY = origin.y − PAD (:84), scale = fitScale (:94),
  lane label anchors (:221-227), lane y = lane.bus.from.y (:188).
- `src/ui/ChainBlueprint.tsx` — same `.bp-scroll` wrapper (:102), fitScale at
  MAX_SVG_HEIGHT=640 (:90, :106-107), per-site `translate(originX − fx, originY − fy)`
  (:167), site chrome `chain-bp-name` (:204), skip note (:96-100), NO lane or
  lane-name rendering anywhere.
- `src/ui/app.css` — single shared `.bp-scroll { overflow: auto }` rule (:612-614),
  `.bp-svg { overflow: visible }` load-bearing (:616-622); no height cap on `.bp-scroll`.
- `src/ui/svg-scale.ts` — fitScale = max(min(REF_W/vbW, min(vbH,capH)/vbH), 0.06).
- `src/ui/LaneOverrides.tsx` (:63-79), `src/ui/App.tsx` itemName (:264).
- `src/ui/smoke.test.tsx` — smelter pins viewBox "-20 -100 200 280" +
  width 200 / height 280 (:384-392); label assertions are location-agnostic
  toContain (:404-406).

## B. Claims to verify (the v5 deltas — the r4 scope)

1. **C1 scope paragraph** (Axis C): gutter + lane-name `<text>` removal are
   Blueprint-ONLY; the stated reasons (no lanes/lane-name text in
   ChainBlueprint; 2D-stacked sites make a single column incoherent; the
   single-site formula omits the `originY − fy` translate term). Verify each
   reason against source. Does this fully resolve r3 finding (1)?
2. **Overflow revert**: `.bp-scroll` KEEPS `overflow: auto`; the r2 overflow-x
   edit is recorded as reverted because (a) it was unconsidered on a shared
   class and (b) it was a literal no-op per the CSS overflow computed-value
   rule (a lone `overflow-x: auto` computes `overflow-y` to `auto`). Verify
   (b) is correct CSS. Then verify the REPLACEMENT invariant actually holds:
   `.bp-scroll` has no height cap, the svg carries explicit px height, so the
   inner vertical scrollbar never engages; vertical pan is page scroll (moves
   the in-flow gutter too); horizontal pan is inside `.bp-scroll` with the
   gutter outside it. Is gutter/label alignment genuinely safe under BOTH
   pan axes and BOTH zoom modes?
3. **C2 widening — the NEW surface, press hard here**: the open-scale
   max(fit, 1) + [FIT|DETAIL] toggle now applies to BOTH Blueprint and
   ChainBlueprint (per-view presentation useState; ChainBlueprint gets the
   toggle WITHOUT a gutter). Is this widening justified (Michael's "the other
   views are not readable at all" + ticket #64 is views navigation) or scope
   creep? Is it implementable symmetric to Blueprint (same fitScale inputs,
   explicit px width/height at :106-107)? Any Combined-specific hazard at
   DETAIL = 1 px/dm — site chrome text scale, connectors, focus/keyboard
   handlers, footer, pin churn in smoke tests?
4. **Unchanged spine** (spot-check only, r3 already held it): Axis A headings
   + itemName pattern, Axis B phrase, the gutter px formula
   (laneY − minY) × scale with DETAIL-only rendering, pin-safety claims
   (all pinned fixtures open at fit ≥ 1, both views).
5. **Loop-done judgment**: after 4 rework rounds, is v5 converged — i.e. is
   any remaining issue genuinely load-bearing for an implementer, or nit-level?

Verdict contract: exactly one of APPROVED / APPROVED_WITH_NITS /
NEEDS_REWORK / BLOCKED, with severity-tagged, line-cited findings.
