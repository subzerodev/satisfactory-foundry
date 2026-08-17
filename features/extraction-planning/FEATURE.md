# Extraction planning (Stage 22 arc)

**Started:** 2026-08-16
**Status:** both extraction phases merged; **review gate incomplete** (#130)
**Current phase:** implementation complete; release blocked on #130
**Epic:** #114 (board #21, Stage 22 milestone 93)
**Feature ticket:** #112
**Phase 2 child:** #124

## Settled Product Direction

Michael's 2026-08-15 decisions on #112 govern this arc and are not open for
reconsideration:

1. The flow is requirement-first. The planner first answers how many extractors
   are needed at normal purity using the extractor the user selects.
2. Extraction clocking is in scope, up to 250%.
3. Extractor output must be checked against the same belt and pipe capacities
   used by the rest of the planner.
4. Purity mixing is a second phase. It is not part of the Phase 1 design or
   implementation plan.
5. The interaction begins on the clickable raw-input cards in the chain canvas.
6. Nitrogen Gas and Resource Wells must be named and handled explicitly. They
   must never fall through to a miner estimate.

## Phase Status

### Phase 1 - normal-purity requirement

- **Status:** merged to `develop` at `3ca5f71`; its post-simplify round **r11 was
  never run** before that merge — retroactive gate tracked as #130
- **Scope:** structured extractor data, clickable raw inputs, selected extractor,
  clock, exact count/surplus, estimated power, per-extractor belt/pipe saturation,
  and per-plan persistence of the user's extractor choice
- **Candidate:** `phase-1/brainstorm-spec.md`
- **Review prompt:** `phase-1/design-r6-prompt.md`
- **Implementation plan:** `phase-1/implementation-plan.md` frozen at r8 after
  correctness convergence and one-shot parsimony disposition
- **Production edits:** `1fc4361`, `5bcd381`, `40e4f72`, `b937bfc`, `254e1ae`
- **Verification:** 39 files / 1028 tests, checked-in Chromium/CDP geometry and
  interaction gate, and ten canonical mutation break/restore probes
- **Completion report:** `phase-1/completion-report.md`

### Phase 2 - purity mix

- **Status:** merged to `develop` at `d5649c2`; its post-simplify round **r3 was
  never run** before that merge — retroactive gate tracked as #130
- **Scope:** exact Impure/Normal/Pure 0.5/1.0/2.0 node inventories,
  coverage/shortfall, power and transport results, plan v7 persistence, and
  production-control browser coverage
- **Spec:** `phase-2/brainstorm-spec.md` frozen after r2 correctness convergence
  and one-shot simplify approval with no findings
- **Implementation plan:** `phase-2/implementation-plan.md` frozen at r6 after
  both reviewers approved the r5 folds; its one-shot parsimony review had
  already run and was not rerun
- **Branch:** `feature/s22-124-extraction-p2-purity`
- **Implementation commits:** `5098796`, `f8f7f89`, `03b9d97`, `8094126`,
  `e076398`, `b15d550`, `73379cd`, `e40efe5`, `43caf18`
- **Phase verification:** 40 files / 1067 tests; TypeScript, ESLint,
  Prettier, and build pass; the checked-in Chromium/CDP gate passes nine
  geometry rows and three interaction rows at 360px, 720px, and 1280px
- **Completion report:** `phase-2/completion-report.md`

## Dependency Shape

```text
Phase 1: exact normal-purity extractor requirement
    |
    +-- observed UI and persisted configuration contract
    v
Phase 2: purity-mix adjustment using verified 0.5 / 1.0 / 2.0 values
```

Phase 2 depends on the Phase 1 result/configuration shape and on observing how
the raw-card interaction works in the shipped application. Designing both at
once would pre-commit an editing model before its base workflow exists.

## Phase 2 Purity Provenance

The multiplier research gate is resolved. These are not remembered wiki values
or inferred constants.

### Installed build

- Steam app manifest:
  `/home/subzerodev/.local/share/Steam/steamapps/appmanifest_526870.acf`
- App ID: `526870`
- Branch: `public`
- Installed build ID: `24656030`
- Install root:
  `/home/subzerodev/.local/share/Steam/steamapps/common/Satisfactory`

The manifest evidence is reproducible with:

```bash
rg -n 'appid|buildid|BetaKey' \
  /home/subzerodev/.local/share/Steam/steamapps/appmanifest_526870.acf
```

### Enum order and config field

Installed archive:
`CommunityResources/Headers.zip`

```bash
unzip -p \
  /home/subzerodev/.local/share/Steam/steamapps/common/Satisfactory/CommunityResources/Headers.zip \
  'Source/FactoryGame/Public/Resources/FGResourceNode.h' | nl -ba | sed -n '23,31p'

unzip -p \
  /home/subzerodev/.local/share/Steam/steamapps/common/Satisfactory/CommunityResources/Headers.zip \
  'Source/FactoryGame/Public/FGResourceSettings.h' | nl -ba | sed -n '63,70p'
```

The installed generated headers establish:

- `EResourcePurity` index 0 = `RP_Inpure` (display name `Impure`)
- index 1 = `RP_Normal`
- index 2 = `RP_Pure`
- `UFGResourceSettings::mPurityMultiplier` is a fixed-size config array whose
  comment assigns indexes 0/1/2 to poor/normal/rich.

### Shipped multiplier values

Source pak:
`FactoryGame/Content/Paks/FactoryGame-Windows.pak`

Extraction tool:

- repak CLI `0.2.3`
- source commit `355b5f62f51959c7cc6dd5a51708646ef483065d`
- checkout used at `/tmp/satisfactory-foundry-112-tools/repak`
- built binary:
  `/tmp/satisfactory-foundry-112-tools/repak/target/release/repak`

Reproduction commands:

```bash
git -C /tmp/satisfactory-foundry-112-tools/repak rev-parse HEAD
cargo build --release --package repak_cli \
  --manifest-path /tmp/satisfactory-foundry-112-tools/repak/Cargo.toml

mkdir -p /tmp/satisfactory-foundry-112-tools/purity-proof
/tmp/satisfactory-foundry-112-tools/repak/target/release/repak unpack \
  -q -f \
  -o /tmp/satisfactory-foundry-112-tools/purity-proof \
  -i FactoryGame/Config/DefaultGame.ini \
  -i FactoryGame/Config/Windows/DefaultGame.ini \
  -i FactoryGame/Config/WindowsEditor/DefaultGame.ini \
  /home/subzerodev/.local/share/Steam/steamapps/common/Satisfactory/FactoryGame/Content/Paks/FactoryGame-Windows.pak

rg -n -A3 '\[\/Script/FactoryGame\.FGResourceSettings\]|mPurityMultiplier' \
  /tmp/satisfactory-foundry-112-tools/purity-proof/FactoryGame/Config
```

`FactoryGame/Config/DefaultGame.ini`, section
`[/Script/FactoryGame.FGResourceSettings]`, contains in order:

```ini
+mPurityMultiplier=0.500000
+mPurityMultiplier=1.000000
+mPurityMultiplier=2.000000
```

The Windows and WindowsEditor variants contain no replacement for this setting.
The installed Paks directory contains only the signed stock
`FactoryGame-Windows.pak` content pair plus its IO-store files, and the Proton
user config has no `Game.ini`; no local config or additional mod pak override
was found. Phase 2 may therefore use exact `Fraction`s 1/2, 1, and 2 with this
provenance.

## Completion Contract

Both extraction phases are merged on `develop` and no *resume* action remains —
the implementation is done. **Two implementation-diff reviews do remain:** Phase
1's r11 and Phase 2's r3 were never run before their merges, and #130 runs both
retroactively (see the two **Diff** Parsimony Dispositions below for the evidence —
not the Plan one). Until
#130 closes, this arc is implementation-complete but not review-complete, and the
Stage 22 release is blocked.

Keep Resource Wells explicit. A later decision to build a full well planner is new
scoped work and must be ticketed rather than hidden in this arc.

## Plan Parsimony Disposition

The one-shot plan simplifier proposed replacing Task 6's post-implementation
mutation probes with the initial TDD red runs. Rejected with counter-evidence:
the canonical bidirectionality gate requires the verification artifact to name
an exact revert/break command and capture a genuine failure with production code
removed or broken, followed by restoration. Initial pre-code reds are useful but
do not satisfy that contract. Task 6 therefore remains unchanged.

## Phase 1 Diff Review Disposition

- **r1:** folded complete-list validation for `mAllowedResources` and
  null-prototype extractor serialization, each with a failing regression test.
- **r2:** folded all findings. Cache serialization now preserves the matching
  machine for a valid `__proto__` extractor ID, and the corrupt-recipe fixture
  reaches its intended path. The browser gate now asserts actual scrolling,
  covers desktop plus 360/720 widths, and exercises Limestone, Water, Crude
  Oil, and Nitrogen at every width. The stale counts were updated. The proposed
  220px mobile cap was not retained: direct measurement proved it overlaps
  controls by 49px, so the frozen design and plan now document the measured
  170px maximum and the gate pins both the cap and collision boundary.
- **r3:** folded the final-identity evidence mismatch and the one-candidate
  solid auto-seed defect. Only Water and Crude Oil may auto-seed; a dedicated
  jsdom regression and every Chromium width now prove Limestone remains
  unselected until the user chooses a Miner.
- **r4:** folded Water/Oil clear-option lifecycle and clock-error wording. The
  initial auto-seed is now attempted once per open raw identity, so clearing is
  stable; Propose and extraction planning share one exact clock parser.
- **r5:** folded malformed v6 extraction-array rejection and removed the
  duplicated pipe noun from exact output guidance.
- **r6:** correctness converged; folded the remaining documentation nit by
  updating all cited persistence comments from v5-current to v6-current.
- **r7:** folded the reviewers' additional stale-comment citations and swept
  every current persistence description to v6 terminology; historical version
  declarations remain explicitly labeled as historical writer shapes.
- **r8:** folded the last current-shape test labels and generalized the shared
  validator comment to v3-v6; remaining v5 references describe v5 migration
  inputs and validators only.
- **r9:** folded the final historical v2/v3 fixture labels and corrected the
  shared validator comment's unmatched parenthesis. Runtime code remained the
  correctness-approved r6 artifact.

## Phase 2 Diff Review Disposition

- **r1:** code-reviewer returned `APPROVED_WITH_NITS`; adversarial-reviewer
  returned `NEEDS_REWORK`. Both grounded findings were accepted. Purity
  validation now carries the offending field for field-local parse/overflow
  errors and `null` for aggregate overflow, so the panel associates its stable
  live error only with the offending input or with all three inputs for an
  aggregate failure. The controlled DOM regression enters blank Normal text
  through the rendered input and callback/rerender path, and separately proves
  aggregate all-field association with no stale totals. The four historical
  v2-v5 writer comments now describe current reads as migrating to plan v7.
  Correctness recheck continued with a delta-scoped r2 prompt; at that point the
  one-shot Phase 2 diff simplify lens had not yet run.
- **r2:** code-reviewer and adversarial-reviewer both returned `APPROVED` on the
  r1 fold delta. Correctness converged before the separate one-shot cumulative
  simplify lens ran.

## Phase 1 Diff Parsimony Disposition

The one-shot diff simplifier returned five nits; all five were verified and
folded. Extraction transport now reads the catalog tier table and exposes no
test-only candidate/tier-index payload, the panel focus ref targets only its
reachable select, v4-to-v6 migration maps stages once, invalid-clock cases use
one exact-error table, and the browser harness shares one CDP key helper. The
new catalog-tier regression failed against the prior global-table lookup before
the fold. Full verification after the fold passes 39 files / 1028 tests, checks,
build, nine geometry rows, and all three interaction suites. The simplify lens
was not rerun. **The post-simplify round r11 has no recorded verdict** —
`phase-1/diff-r11-prompt.md` was committed in `c8828d2`, and `3ca5f71` merged that
branch to `develop` 4m31s after `c8828d2`, with no commits between. (The Phase 1
disposition list above also stops at r9, but that alone proves nothing — r10 is
absent from it too and is nonetheless recorded as approved, per the convention
below.) An
earlier version of this line asserted that recheck converged before merge; that
claim has no evidence and is retracted. Tracked as #130.

Scope precisely: **r10 is not part of the gap.** It was a documentation-only fold
of r9's two nits (`phase-1/diff-r10-prompt.md:12` — "Runtime code remains the
correctness-approved r6 artifact"), and its approval *is* recorded, by this repo's
convention that round N's verdict heads round N+1's prompt
(`phase-1/diff-r11-prompt.md:6` — "Delta from correctness-approved r10"). The
simplify lens first appears in r11. So exactly one Phase 1 round is unaccounted
for, not two.

## Phase 2 Diff Parsimony Disposition

The one-shot cumulative simplify lens returned `APPROVED_WITH_NITS` with two
findings; both were verified and folded. `ExtractionPanel` now renders the
Impure/Normal/Pure controls from one local typed tuple and one mapped markup
block while preserving order, values, numeric constraints, accessibility
state, and callbacks. Purity transport now computes the highest-present output
once and makes one `transportForOutput` call, or returns the direct no-output
status. Existing focused derivation/DOM tests remain green after both folds.
The simplify lens was not rerun. **The delta-scoped post-simplify correctness
round r3 has no recorded verdict** — `phase-2/diff-r3-prompt.md` was committed in
`43caf18`, the Phase 2 disposition list above stops at r2 (whose entry says
convergence happened *before* the simplify lens ran), and `d5649c2` merged that
branch to `develop` 2m44s after `43caf18`, with no commits between. An earlier version of this line asserted that recheck
converged before merge; that claim has no evidence and is retracted. Tracked
as #130.
