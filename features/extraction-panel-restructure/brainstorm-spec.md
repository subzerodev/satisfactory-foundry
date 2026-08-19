# #156 — Extraction panel: the packaging chain gets a visual + structured info (brainstorm+spec, r1)

Ticket: #156. Tier 2. Base: develop @ cb194af (#157 landed — belt chips + the
packaging build view exist).
Field report (Michael, 2026-08-19, screenshot of Extraction — Water):
*"i feel like i should get a visual of the packagers and unpackagers or
something and the info feeling like its missing something or needs a better
structure"* — direction confirmed on a rendered mockup (sectioned panel, chain
strip with the return loop, totals row).

## Already settled — do NOT re-litigate

- **The split** (#156 c24987): the PANEL carries the numbers + a compact chain
  visual; the manifold DRAWING lives in the build view (#157, landed: the
  subject selector + stacked groups). This ticket must not duplicate the
  drawing.
- **#157's A4**: belt routes now chip "N belts" (`edgeChip`,
  `src/ui/transport-text.ts`) and the panel's `routeSummary`
  (`src/ui/GraphCanvas.tsx:840-847`, consumed at `:827-830`) already surfaces
  them — the numbers exist; this ticket structures their presentation.
- **#133**: `derivePackagingPlan`/`DerivedLinkPlan` is the single sizing
  source; the panel reads, never re-derives.

## The gap, grounded (post-#157 state)

The packaging result block (`GraphCanvas.tsx`, `PackagingEditor` result:
machines line, rates line, `Forward: … · Return: …`) is three flat prose lines
inside a flat prose panel (`.extraction-panel`, 340px wide, 12px type,
`app.css:1422-1431`). The loop shape is invisible; the container item is never
named on screen (`plan.containerItemId`/`plan.packagedItemId` exist,
`src/core/link-plan.ts:49-50`); power is split across blocks with no total;
the baseline/purity/packaging blocks run together without sectioning.

## Decision axes

### A1 — Panel structure: three labeled sections

**Pick:** the panel gains light sectioning (a muted 11px section label + top
hairline, drafting idiom): **Extraction** (a NEW small label above the existing
baseline result, content unchanged) and **Package for transport** (NO new text
element — the existing checkbox `<label>` + its "Package for transport" span
(`GraphCanvas.tsx:695-703`) STAYS EXACTLY AS IS structurally and is merely
STYLED as the section head, so the checkbox keeps its visible label, the
`aria-label` is untouched, and no duplicate text appears; controls unchanged;
the RESULT block restructures per A2/A3). Header + "required" line unchanged.
No control moves — presentation only, no store or derive changes.

**Rejected:** tabs/accordions (hides plan data the drafting idiom wants visible;
overkill at 340px).

### A2 — The chain strip (the visual)

**Pick: a shared compact SVG strip component, `PackagingChainStrip`,** rendered
in the packaging result block. Two node boxes at panel width (viewBox scaled,
`width: 100%`): "N × Packager" and "N × Unpackager", with:

- a left-entering feed label (extraction case: the fluid at `materialDemand`
  rate — e.g. "10600/min Water"),
- the forward edge: cargo rate + container name + route ("10600/min
  Packaged Water · 9 belts"). **Route-text source, both call sites:**
  `routeSummary` is today a PRIVATE function in `GraphCanvas.tsx:840-847`
  with no LinkInspector equivalent — it LIFTS to `src/ui/transport-text.ts`
  (exported, beside `edgeChip`/`routeEdgeChip` which it already builds on),
  and both call sites derive their route-text props from it. Post-#157 it
  carries belt counts; trains/drones/pipes show their existing chips,
- a right-exiting label (the delivered fluid),
- the RETURN LOOP drawn as a dashed under-path right→left: container-return
  rate + empty-container name + route ("10600/min Empty Canister · 9 belts").

Node/text styling uses the panel's existing CSS vars (`--fg`, `--border`,
`--bg-panel` family) — no new color system; 11-12px text matching the panel.
All figures come off the `DerivedLinkPlan` (`packageMachines`,
`unpackageMachines`, `cargoDemand`, `containerReturnRate`,
`packagedItemId`/`containerItemId` → display names via `catalog.items`). When
counts/rates are null (unsized), the strip renders boxes with "—" figures —
never invents numbers.

**Shared with LinkInspector (A5):** the component takes the left/right endpoint
labels as props (extraction: the extractor bank; link: the from/to stage
names), so both intersteps render one idiom.

**Rejected:** reusing the build-view Schematic in miniature (it draws manifold
geometry, wrong tool for a 340px summary); HTML-only rows (the loop is the
point — a return path needs drawing).

### A3 — The figures row

**Pick:** under the strip, a compact figures block replacing the old three
prose lines:

- machines: "177 Packager · 89 Unpackager · <combined packaging power>" —
  the SINGLE combined figure the plan actually carries (`plan.power`,
  `link-plan.ts:63,181-185`, rendered via the existing `packagingPowerText`).
  NO per-group packaging power: the plan fuses both groups into one
  projection (simplify fold — the #157 per-group idiom belongs to the
  drawing's stage groups, not this block).
- a **Total power** line (extraction panel only): extractors + packaging.
  **Computed and rendered in `ExtractionPanel`'s scope — NOT in
  `PackagingEditor`** (r4 fix: the editor's props are
  `catalog/pairs/intent/plan` only, `GraphCanvas.tsx:718-730`, and the tree
  is strictly prop-driven — the inputs are unreachable there). All three
  inputs live in `ExtractionPanel`: `result` (from `deriveExtractionPlan`,
  `GraphCanvas.tsx:357`), `selection`, `catalog`. `ExtractionPanel` emits the
  Total line directly BELOW `<PackagingControls/>` as the packaging section's
  last figures line, when the packaging plan is ready. Baseline projection:
  the existing `machinePowerProjection` with the extractor machine's power
  (`catalog.extractors[selection.machineId].machineId` →
  `catalog.machines[…].power`, per `src/ui/extraction-plan.ts:97-121`),
  `result.count`, and the extractor clock re-parsed with `core/clock.ts`'s
  `parseClockText(selection.clockPercentText)` — the EXACT function the
  derive uses (`src/ui/extraction-plan.ts:123-127`; NOT `advice.ts`'s
  divergent `parseClock`). `deriveExtractionPlan` itself is untouched (it
  exposes only `powerText`, `src/ui/extraction-plan.ts:169`; A1's no-derive
  promise holds). The sum is an INLINE two-branch expression, not a helper:
  both exact → exact Fraction total; otherwise "≈" float (`chainPowerText`
  precedent, `src/ui/advice.ts:133-140`); `variableBoundsMw` dropped. No
  standalone helper, no helper unit tests — the rendered total is pinned by
  the DOM tests + bidirectionality log. **Hidden when a purity mix is
  active** (`selection.purityMix !== undefined` — the purity block carries
  its own power; a baseline-based total would mislead there; water never
  activates purity so the water case always shows it).
- the forward/return route lines are ABSORBED into the strip's edge labels
  (A2) — the old `Forward: … · Return: …` prose line is deleted.

**Not included (honest):** "canisters in circulation" from the mockup — sizing
the standing loop inventory needs belt-length geometry the plan does not have.
Out of scope, noted in the panel by nothing (no placeholder).

### A4 — The drawing pointer

**Pick:** one muted line at the packaging section's foot when the plan is
ready: "Manifolds: pick 'Packaging: <item>' in the DRAWING selector" — naming
the real control (#157 renders the selector labeled DRAWING, aria "Drawing
subject", `App.tsx:675-677`; its options begin "Packaging: <item> — …",
`App.tsx:257,272`). Static text, no navigation wiring (the selector is in
another component tree; wiring cross-tree focus is scope creep).

### A5 — LinkInspector mirror

**Pick: yes, same component.** LinkInspector's interstep result block
(`LinkInspector.tsx:209-214` region, the `InterstepEditor`) replaces its
equivalent prose lines with `PackagingChainStrip` + the A3 figures (minus the
extraction-baseline total, which is extraction-only). The generalization is
exactly the endpoint-label props (A2).

## Changes

1. **`src/ui/PackagingChainStrip.tsx`** (new): the shared strip (pure
   presentational; props = the plan fields + endpoint labels + route texts).
   DOM tests: renders both boxes/counts, names both items, shows the belt
   counts in the edge labels, renders the return loop path, "—" when unsized.
2. **`src/ui/GraphCanvas.tsx`**: PackagingEditor's result block → strip +
   figures (machines + combined packaging power) + pointer line; the
   **Total-power line renders in `ExtractionPanel` below
   `<PackagingControls/>`** (its inputs live only there — r4); the
   Extraction/Package section labels. The old machines/rates/routes prose
   lines deleted.
3. **`src/ui/LinkInspector.tsx`**: InterstepEditor result block → the same
   strip + figures.
4. **`src/ui/app.css`**: section-label + strip styles under `.extraction-panel`
   / the inspector's interstep block.
5. Tests + bidirectionality log (`features/extraction-panel-restructure/
   r2-verification.log`), compiling mutants per new behaviour. (The former
   item 5 — a standalone total-power helper — was cut by the simplify pass;
   the total is an inline expression per A3.)

## Deleted-behaviour sweep (grep is the authority)

At implementation:
`grep -rin "packager|unpackager|package ·|unpackage|/min packaged|empty containers|forward|return|mw" src/ui/GraphCanvas.dom.test.tsx src/ui/LinkInspector.dom.test.tsx src/ui/smoke.test.tsx` —
EVERY hit dispositioned (keep / re-derive / delete). The lowercase
`package ·`/`unpackage` tokens are REQUIRED: the two call sites render
DIFFERENT prose idioms — GraphCanvas "N Packager · N Unpackager"
(`GraphCanvas.tsx:817`) but LinkInspector lowercase "N package · N unpackage"
(`LinkInspector.tsx:333`), and the r1 token set missed the LinkInspector pins.
Known now:

- `GraphCanvas.dom.test.tsx` packaging plan-math pins (e.g. `:782`
  "2 Packager") → RE-DERIVE. The NUMBERS carry over verbatim (plan-math
  untouched) but the SUBSTRINGS change (e.g. "2 Packager" → "2 × Packager"
  in the strip's markup) — assertions update, not merely survive.
- `LinkInspector.dom.test.tsx:286-287` — the lowercase "1 package" /
  "1 unpackage" machine-count pins → RE-DERIVE onto the strip/figures markup.
- `LinkInspector.dom.test.tsx:288` — the "20 MW" packaging-power pin sits on
  the SAME restructured summary line (`LinkInspector.tsx:333-334`) →
  RE-DERIVE into the A3 figures' packaging-power. (The `mw` grep token exists
  for exactly this pin; the r2 adversarial caught it interleaved between two
  dispositioned lines.)
- `LinkInspector.dom.test.tsx:289-290` rate pins → RE-DERIVE (same numbers,
  strip markup).
- `GraphCanvas.dom.test.tsx` extraction-baseline power pins surfaced by the
  `mw` token (`:239` "2385 MW", `:357` "270 MW", `:426` "0 MW") → KEEP: they
  pin the untouched baseline "Power:" line, not the packaging block (which
  carries no power assertion at `:782-785`).
- `LinkInspector.dom.test.tsx:291-292` — the return advisories ("seed the
  loop with containers" / "provide a separate return path",
  `LinkInspector.tsx:369-370`) live in the `link-inspector-advisories` block
  OUTSIDE the restructured summary → KEEP.
- `smoke.test.tsx` — reviewer-confirmed clear of packaging-prose pins; sweep
  scope is the two DOM files (the grep still runs over it as a guard).

## Assumptions ledger

- `ReadyLinkPlan` carries every figure the strip needs — VERIFIED
  (`link-plan.ts:48-66`; #157 shipped against it).
- `routeSummary` post-#157 yields "N belts" for continuous belt routes —
  VERIFIED (the #157 r2 adversarial traced it; `GraphCanvas.tsx` routeSummary
  → `edgeChip`).
- Panel width 340px / 12px type — VERIFIED (`app.css:1422-1431`); the strip
  designs to ~320px inner width.
- No projection-sum helper exists (reviewer-grepped, r1) and NONE is written —
  the Total is an inline expression in `ExtractionPanel` per A3 (r4).
- LinkInspector's interstep result block is prose-line shaped like the
  extraction one — grounded at `LinkInspector.tsx:209-214,269-278`; exact
  lines confirmed at implementation (drift hunt).

## Out of scope

The build-view drawing (#157, landed), Blueprint per-group (#158), canisters-
in-circulation sizing, cross-tree focus/navigation wiring, any solver/derive
change, multi-item bus (#146).

## Revision history

- r1 — initial draft (team lead), grounded against develop @ cb194af.
- r2 — fold of the r1 degraded-pair review (code-reviewer NEEDS_REWORK 2
  IMPORTANT + 5 NIT; adversarial APPROVED_WITH_NITS 3 low, overlapping).
  Folded: (1) the sweep token set gained lowercase `package ·`/`unpackage`
  (both reviewers: the LinkInspector `:286-287` pins escaped the r1 pattern)
  + the full known-now disposition list incl. the `:291-292` advisory KEEPs
  and the substring-change note ("2 Packager" → "2 × Packager");
  (2) A1 disambiguated: the checkbox label stays structurally intact and is
  styled as the section head — no duplicate text, no orphaned checkbox;
  (3) A2 names the link case's route-text source: `routeSummary` LIFTS from
  GraphCanvas (private, `:840-847`) to transport-text.ts, both call sites
  consume it; (4) A3 pins the bounds contract (total drops `variableBoundsMw`,
  the `chainPowerText` precedent) and records no-sum-helper-exists as
  reviewer-verified; (5) A4 names the real DRAWING selector; (6) the
  routeSummary citation fixed (:840-847, not :855-862). Adversarial
  refutations that HELD: the supply/demand asymmetry is inert to the strip
  (all strip figures are demand-derived, `link-plan.ts:161-186`); the "—"
  unsized fallback matches the all-null branch; the A4 label prefix is
  accurate.
- r3 — CONVERGED: code-reviewer APPROVED (0 findings; re-ran the widened
  sweep itself, all pins dispositioned, the lift confirmed a pure move);
  adversarial APPROVED_WITH_NITS (1 NIT, folded: the interleaved
  `LinkInspector.dom.test.tsx:288` "20 MW" pin added to the known-now list
  as RE-DERIVE + the `mw` grep token added so the sweep authority genuinely
  covers it, with the three GraphCanvas baseline-power KEEPs it also
  surfaces). Spec FROZEN at this revision pending the simplify pass.
- r4 — simplify pass (claude-simplify-reviewer, degraded): NEEDS_REWORK
  (advisory), 2 findings. (1) per-group packaging power → FOLDED FULLY: the
  plan carries one fused projection (`link-plan.ts:181-185`); the figures
  block shows the combined figure only. (2) "cut the Total line + helper" →
  FOLDED IN PART, REJECTED IN PART: the helper + its unit tests are cut and
  the hidden derive-change cost is eliminated (local `machinePowerProjection`
  recompute + inline two-branch sum, purity-mix hides the line) — but the
  Total line itself STAYS, rejection rationale: it was part of the mockup
  direction Michael confirmed and was named to him as the concrete "4440 MW
  never shown" gap in the field-report response; cutting it would reopen a
  user-facing commitment. Correctness pair re-runs scoped to the A3 rewrite
  (the simplify pass is one-shot and does not re-run).
- r5 — fold of the r4 scoped re-run (both NEEDS_REWORK on ONE defect: the
  Total-line recompute named `PackagingEditor`'s scope, whose props —
  `catalog/pairs/intent/plan`, `GraphCanvas.tsx:718-730` — carry none of the
  three inputs, and the tree is strictly prop-driven). Fixed by RELOCATING
  the Total line's computation + render to `ExtractionPanel` (all inputs
  native: `result` @ `GraphCanvas.tsx:357`, `selection`, `catalog`), emitted
  below `<PackagingControls/>`; the clock re-parse pinned to `core/clock.ts`
  `parseClockText` (the derive's own function — the r4 reviewers verified
  zero drift); the stale helper-UNVERIFIED ledger line replaced (the helper
  is cut, r4); `src/ui/` path qualifications fixed. r4 refutations that HELD:
  clock re-parse determinism; the purity-hide rule well-defined across all
  three purity states; the combined-figure fold clean; Changes item 5
  coherent.
