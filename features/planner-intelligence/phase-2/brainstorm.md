# Stage 8 / Phase 2 — transport refinements: per-end station overrides + pipe derate (ticket #38) — brainstorm v3 (FROZEN)

**Goal.** Two recorded transport-refinement hooks land: (1) per-end
train-station power overrides — a route with an asymmetric end (e.g.
unload-only sharing an existing station) can override the symmetric
`2 × (50 + 50c)` assumption (the S7P1 spec's Assumption #6 pointer); (2) a
user-facing pipe derate — the fact table's sloshing caveat becomes an
optional percentage the pipe fleet math applies, clearly labeled as the
user's own assumption (the fact table records no groundable number:
"a user-facing derate factor is a UX choice, not a wiki-grounded number").

## Already settled — do NOT re-litigate

- Both hooks were RECORDED deferrals, not new scope: Assumption #6 in the
  S7P1 brainstorm ("P2 may expose per-end overrides if wanted" — this
  ticket is that P2) and the fact table's §Pipelines planner caveat.
- The Stage 8 epic (#36) decisions bind: all five transport surfaces
  resolve through `planForLink(link, catalog, stages)` (P0), and named-
  stage selection writes go through `applyStageSelection` (P1). This
  phase's config rides INSIDE `link.transport`, so `planForLink`'s
  signature does not change — and this phase writes no stage selections.
- The LinkTransport union's shape discipline is frozen (S7P2): raw user
  text in the config, `Fraction.parse` at derive time in transport-plan.ts
  with `TransportError` surfacing (the clock-error precedent); illegal
  pairings unrepresentable by arm shape, not runtime checks.
- The file validator's strictness posture (S7P2, simplify-affirmed):
  invalid transport on an otherwise-valid link FAILS validation — no
  silent dropping.
- Wording lives in transport-text.ts (pure, testable); LinkInspector stays
  thin. Caveats are provable-claim sentences.
- All-Claude roster; full gate; browser walk (this phase is UI-visible).

## Axis 1 — schema home: plan-file v4, not v3-additive

**Pick: bump `format_version` to 4 (`PlanFileV4` = v3 + the two optional
transport extensions), with a mechanical identity `migrateV3` — the v2→v3
precedent applied again.**

- The tempting alternative — extend v3 in place (both new fields are
  optional; old v3 files stay valid under the extended validator) — fails
  the strictness posture on the ROLLBACK direction: today's `isPlanFileV3`
  ignores unknown extra fields (`belt`/`pipe` arm returns `true` bare;
  the vehicle arm checks only the trip), so a file carrying a derate read
  by a pre-P2 build would validate and silently DROP the user's derate —
  the plan renders with different meaning than it was saved with. A v4
  header makes the old build reject the file loudly (load → null) instead
  of silently reinterpreting it. That is exactly the argument recorded
  when v3 was affirmed over v2-additive ("the validator's strictness makes
  it the simplest correct shape").
- Mechanics mirror v2→v3 verbatim: `PlanLinkV4 extends PlanLinkV3` (same
  optional `transport`, now the extended union); `isPlanFileV4` = the v3
  checks + the new optional-field validations (below); `migrateV3` maps
  links to themselves (the new fields are absent by construction);
  `validatePlanFile` tries v4 → v3 → v2 → v1; save always writes 4. The
  full store.ts retype set (r1 fold — v1 undercounted this): the two
  `format_version: 3` LITERALS live in savePlanAs (:1294, :1304), but
  `savePlanFile` has THREE more call sites whose plans inherit the version
  via spread — renamePlan (`PlanFileV3` annotation :1369) and importPlan
  (:1439, :1449) — and the load side types `rebuildFromPlan` (:561, doc
  :538) plus the type import (:37). All seven `PlanFileV3` annotations
  move to `PlanFileV4` when `savePlan`/`loadPlan`/`validatePlanFile` widen
  (they stop compiling otherwise — the compiler enforces the sweep); only
  the two literals change value.
- State and file keep sharing the ONE `LinkTransport` union (the S7P2
  "verbatim between state and file" invariant) — the extensions are made
  on the union itself, so there is nothing to map at the boundary.

## Axis 2 — the per-end override's shape: shared-end flags, not MW entry

**Pick: the train arm gains an optional `sharedEnds` field —
`sharedEnds?: { from?: true; to?: true }` — where a flagged end means
"this end's station set already exists / is billed elsewhere; exclude its
`50 + 50c` from THIS link's station power". Core: `trainOptions` gains
`opts.countedEnds?: 0 | 1 | 2` (default 2) replacing the hard-coded
`× 2`.**

- Why exclusion flags and not a free MW text: the only recorded scenario
  (Assumption #6's own example) is an end SHARING an existing station —
  the physical station set at that end is unchanged (a consist still needs
  its c platforms to unload), the question is whose power ledger carries
  it. A per-end boolean captures that intent exactly and stays exact
  arithmetic; a free MW override would invite unanchored numbers with no
  in-game meaning (there is no "half a station"), and nothing recorded
  asks for it. If a future need arises, the flag field extends without
  conflict.
- Why per-end named flags and not a bare counted-ends number in the
  config: the config records USER INTENT ("the unload end is shared") —
  `from`/`to` name the link's ends (the producer end and the consumer
  end, the StageLink's own direction). The derive layer collapses them to
  `countedEnds = 2 − (flagged ends)` for the core call. Core takes the
  count (it has no concept of link direction); the UI keeps the names.
- JSON honesty: absent field ⇒ symmetric (today's exact meaning — every
  existing plan unchanged); `{ from: true }` / `{ to: true }` /
  `{ from: true, to: true }` are the three override states. Validator:
  when present, `sharedEnds` must be an object whose `from`/`to`, when
  present, are literally `true` (the absent-or-true idiom keeps the JSON
  minimal — no `false` noise; a `false` write is refused as a shape
  violation, same strictness as everywhere else).
- `stationPowerMw`'s doc comment (and Assumption #6's "P2 may expose"
  pointer) update to name the override; the field stays "for the counted
  ends".

## Axis 3 — where the override shows: the option rows, plus a footnote

**Pick: the override flows into `trainOptions` and therefore changes the
`station MW` COLUMN in the cars-vs-trains table (it is per-row — `c`
scales it); ONE parameterized asymmetry-note footnote names the flagged
end(s) — a single string parameterized by the flags, not three
hand-written variants (simplify fold, v3; exact wording at
implementation). The chain footer is
untouched (trains are already omitted-with-note from the transport-power
sum, frozen S7P3 Axis 4).**

- Why the rows and not display-only: the column IS the power display for
  trains — there is no separate train station-power line to adjust
  (`vehicleStationLine` is road-only). A display-only adjustment would
  mean the table lying against the footer. `throughput` /
  `perPlatformCeiling` / `nTrains` are NOT touched by the override — a
  shared station still loads/unloads at the same rates; only the power
  attribution changes. The `station MW` header keeps its meaning via the
  footnote (no USER-FACING "both ends" wording exists in the train table
  today; the footnote carries the asymmetry note only when an override is
  active). Doc-comment drift list (r1 fold): the `TrainRow` doc's
  "station MW (both ends)" (transport-text.ts:140) and
  `TrainOption.stationPowerMw`'s "for BOTH route ends"
  (transport.ts:211-214) update to the counted-ends wording when
  `countedEnds` lands.
- The unsustainable-train finding is unaffected (its predicate reads
  `perPlatformCeiling`/`carsPerTrain` only).
- The edge chip is unaffected (counts only).

## Axis 4 — the pipe derate: config text, derive-time application, honest label

**Pick: the `pipe` arm of the union splits out and gains
`deratePercentText?: string` (belt stays bare — sloshing is a pipeline
phenomenon; belts are deterministic). At derive time `continuousPlan`
parses it ((0, 100] — `Fraction.parse`, > 0, ≤ 100; else a labeled
`TransportError`) and derates the lane rate: `laneRate × pct / 100` fed to
the UNCHANGED `continuousRuns` (the caller-supplied-laneRate seam is
already the design's extension point — no core change for the derate).
`TransportContinuous` gains `deratePercent: Fraction | null` so wording
can label it.**

- The math this buys, honestly: `runs = ceil(rate / (tierRate × pct/100))`
  — more pipes for the same rate, and the per-pipe sustained line shows
  the DERATED rate (it echoes `ContinuousResult.laneRate`, which is now
  the derated value — no second display path).
- Wording (transport-text.ts): with a derate active, `caveatFor`'s static
  pipe sentence is REPLACED by a derate line naming provenance —
  "derated to N% of nominal — your assumption, not a game constant"
  (shape final at spec time). Without one, today's
  "nominal ceiling — manifolds can sustain less" renders unchanged. The
  static `caveatFor(mode)` signature can't carry the plan-dependent line,
  so the pipe caveat moves to a plan-aware helper beside `continuousLine`
  — the sole non-test `caveatFor` call site is LinkInspector.tsx:239-240
  (r1 verified). Confirmed-safe narrowing sites for the pipe-arm split
  (r1 fold — enumerated, not left to grep): the
  `Exclude<LinkTransport, { mode: "belt" | "pipe" }>` sites
  (LinkInspector.tsx:504, chain-view.ts:277 — an extra optional property
  does not defeat assignability, so both new arms still exclude) and the
  joint `case "belt": case "pipe":` in computeLinkTransport
  (transport-plan.ts:214-216).
- Bounds honesty: 100 means "no derate" (allowed — it parses and applies
  as ×1); > 100 is a boost, not a derate, and is refused at derive
  (labeled error) AND at the file validator (strictness posture). 0 or
  negative refused likewise. The empty string in the UI field means
  ABSENT (the field is stripped from the config, not stored as "") — the
  optional-field idiom, so plans stay clean.
- The derate applies ONLY to pipe-mode links: not to belts (no recorded
  phenomenon), not to the train `beltFeed` (a station feed, not a
  manifold claim), not to fluid-truck/train tank math (batch transport
  doesn't slosh in the recorded sense). Each exclusion is the fact
  table's own scoping, not caution.

## Axis 5 — the editing UI (LinkInspector)

**Pick: both controls live in the existing per-mode config area of the
LinkInspector — a "derate %" number field for pipe mode (beside where
trip fields render for vehicle modes), and two labeled checkboxes for
train mode ("station at producer end is shared" / "consumer end"),
writing through the existing `setLinkTransport(linkId, next)` (whole-
config replace, the established write path — no new store actions).**

- The checkbox → config mapping enforces the absent-or-true idiom
  (unchecked ⇒ key stripped). The derate field's empty ⇒ stripped
  likewise. Mode switches drop the fields naturally (`defaultTransportFor`
  builds bare configs — unchanged; r1 name fix, LinkInspector.tsx:75).
- Labels name the ends by the link's actual stage names where cheap
  (the inspector already renders the identity line with both names) —
  final wording at spec time.
- No new selectors, no store shape change: `StageLink.transport` already
  carries the union; the union's extension IS the state change.

## Axis 6 — non-goals

- No truck-station per-end override (the recorded pointer is train-only;
  the road `stationPowerMw` line keeps its fixed "both ends" wording).
- No numeric MW overrides, no per-platform-count overrides.
- No belt derate, no beltFeed derate, no global default derate (per-link
  only — a link IS the route, the S7P2 rationale).
- No derive-blocking on extreme-but-legal derates (e.g. 1%): the number
  is the user's own assumption, applied visibly.
- No chain-footer change (trains stay omitted-with-note).

## Test plan sketch

Core: `trainOptions` `countedEnds` rows (0/1/2 — station MW column halves
/ zeroes; throughput/ceiling/nTrains invariant across the three).
transport-plan: derate parse errors (0, negative, > 100, garbage) as
labeled `TransportError`s; a valid derate derates `laneRate` and raises
`runs` (exact Fraction rows); absent derate ≡ today; `sharedEnds` →
`countedEnds` collapse (from/to/both). plan-store: v4 round-trip; v3→v4
migration (identity, fields absent); validator accept/reject matrix
(valid derate text; out-of-range derate FAILS the file; `sharedEnds`
non-`true` values FAIL; both fields absent still valid; v3 files still
load via migration). transport-text: the derate line's wording + the
nominal caveat's unchanged default; the shared-end footnote strings.
Inspector: field presence per mode; checkbox/field → config round-trip
through `setLinkTransport` (absent-or-true stripping). Bidirectionality
log per the R2 rule. Browser walk: configure a pipe link with a derate
and watch the run count rise + the label state the assumption; flag a
train end shared and watch the station MW column drop with the footnote.

## Assumptions ledger

1. The v3 validator ignores unknown extra fields on transport arms
   (verified this session: `isTransportShape`'s belt/pipe arm returns
   `true` bare at plan-store.ts:372-375; the vehicle arm checks only
   `trip` at :377-387) — the rollback-silent-drop argument in Axis 1
   rests on this.
2. `continuousRuns` takes a caller-supplied `laneRate` and core holds no
   tier numbers (verified: transport.ts:68-78) — the derate lands in
   transport-plan.ts's `continuousPlan` (:231-252) without touching core.
3. `trainOptions` hard-codes the `× 2` at transport.ts:282-284
   (`.mul(Fraction.from(2))`) — the `countedEnds` option replaces exactly
   that factor; no other field references the end count.
4. The train table renders `stationMw` as a per-row column
   (LinkInspector.tsx:472, transport-text.ts:142-165) and the chain
   footer omits trains from the power sum with a note
   (chain-view.ts:344-366) — Axis 3's "rows plus footnote, footer
   untouched" rests on these.
5. The two `format_version: 3` LITERALS live in STORE.TS's savePlanAs
   (:1294, :1304 — all Assumption-#5 line refs are store.ts; the
   validator lives in plan-store.ts — simplify precision fold, v3), but
   they are NOT the only persistence sites (r1 correction):
   `savePlanFile` is also called from renamePlan (:1374) and importPlan,
   whose plans spread the version from a loaded/validated file; the seven
   `PlanFileV3` type annotations (:37 import, :561 rebuildFromPlan,
   :1293, :1303, :1369, :1439, :1449) all retype to `PlanFileV4` — the
   compiler enforces the sweep once savePlan/loadPlan/validatePlanFile
   widen.
6. The sole non-test `caveatFor` call site is LinkInspector.tsx:239-240
   (r1 verified) — the pipe-caveat re-point touches exactly one caller;
   the wording module is pure so the change is node-testable.

## Revision history

- v1 (2026-08-04): initial, grounded in this session's reads of
  transport.ts, transport-plan.ts, transport-text.ts, plan-store.ts
  (isPlanFileV3/isTransportShape), store.ts (LinkTransport union + save
  sites), LinkInspector.tsx, chain-view.ts, the fact table §Pipelines +
  §Trains, and the S7P1 Assumption #6 / S7P2 schema-bump records.
- v2 (2026-08-04): dual-review r1 — [code-reviewer] APPROVED_WITH_NITS
  (1 IMPORTANT + 2 NITs); [adversarial-reviewer] NEEDS_REWORK (1
  IMPORTANT + 2 NITs) — the IMPORTANT was shared, all folded (each
  verified against store.ts source before folding):
  - The serialize-site enumeration was WRONG (the shared IMPORTANT):
    savePlanAs's two `format_version: 3` literals are not the only
    persistence path — renamePlan (:1374) and importPlan also call
    `savePlanFile` with spread-inherited versions, and seven `PlanFileV3`
    type annotations (incl. rebuildFromPlan :561 and the :37 import)
    must retype. Axis 1 mechanics + Assumption #5 rewritten with the
    full set; the compiler-enforced-sweep note added.
  - `freshTransportFor` did not exist — the real symbol is
    `defaultTransportFor` (LinkInspector.tsx:75); name fixed in Axis 5.
  - Drift-hunt items enumerated instead of deferred: the two
    `Exclude<…>` narrowing sites + the joint belt/pipe case verified
    SAFE under the pipe-arm split (optional property doesn't defeat
    assignability); the sole `caveatFor` caller named (Assumption #6
    rewritten); the two "both ends" DOC-comment sites added to Axis 3's
    drift list (transport-text.ts:140, transport.ts:211-214).
  Both reviewers verified clean: the rollback-silent-drop argument (both
  new fields ignored by today's validator — one v4 bump serves both),
  countedEnds touching only the ×2 power factor (all other row fields
  end-count-independent), the derated-laneRate display coherence (no
  tier label renders near the continuous line), planForLink signature
  unchanged, and no re-litigation of settled epic decisions.
- v2-r2 (2026-08-04): scoped re-check of the folds — [code-reviewer]
  APPROVED (0; all five folds verified against source, residue sweep
  clean); [adversarial-reviewer] APPROVED_WITH_NITS (1: the retype list
  was labeled "six" while naming seven annotation sites — the
  enumeration itself was exhaustive; count corrected to seven, FOLDED).
  Correctness CONVERGED.
- v3 (2026-08-04): simplify pass (one-shot, post-convergence)
  APPROVED_WITH_NITS. Dispositions:
  - Nit 1 (deratePercent on TransportContinuous derivable from config?)
    — the reviewer's own analysis concluded KEEP: re-parsing the raw
    text in the wording layer would duplicate the derive-time parse and
    break the single-parse invariant. Recorded, no change.
  - Nit 2 (footnote surface) FOLDED: one asymmetry-note string
    parameterized by the flagged ends, not three hand-written variants;
    exact wording at implementation (Axis 3).
  - Citation-hygiene note FOLDED: Assumption #5 now names store.ts
    explicitly (the validator lives in plan-store.ts; the annotation
    sweep in store.ts).
  Affirmed minimal without change: the v4 bump (silent-reinterpret →
  loud reject is the floor, not overshoot), the sharedEnds/countedEnds
  split (named intent vs bare count — two facts, not one stored twice),
  the absent-or-true idiom (smaller state space), the pipe-arm split
  (type fact beats runtime refusal), (0,100] + labeled error (reuses
  the existing parse/error seam), non-goals + test plan (no speculative
  scaffolding). No BLOCKED-level concern. FROZEN.
