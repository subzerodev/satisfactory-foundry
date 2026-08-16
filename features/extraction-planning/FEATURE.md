# Extraction planning (Stage 22 arc)

**Started:** 2026-08-16
**Status:** IN PROGRESS - Phase 1 implementation complete; cumulative review pending
**Current phase:** Phase 1 cumulative implementation review
**Epic:** #114 (board #21, Stage 22 milestone 93)
**Feature ticket:** #112

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

- **Status:** implementation complete; cumulative correctness review pending
- **Scope:** structured extractor data, clickable raw inputs, selected extractor,
  clock, exact count/surplus, estimated power, per-extractor belt/pipe saturation,
  and per-plan persistence of the user's extractor choice
- **Candidate:** `phase-1/brainstorm-spec.md`
- **Review prompt:** `phase-1/design-r6-prompt.md`
- **Implementation plan:** `phase-1/implementation-plan.md` frozen at r8 after
  correctness convergence and one-shot parsimony disposition
- **Production edits:** `1fc4361`, `5bcd381`, `40e4f72`, `b937bfc`, `254e1ae`
- **Verification:** 39 files / 1024 tests, checked-in Chromium/CDP geometry and
  interaction gate, and seven canonical mutation break/restore probes
- **Completion report:** `phase-1/completion-report.md`

### Phase 2 - purity mix

- **Status:** deferred until Phase 1 lands and is observed
- **Scope lock only:** use the shipped Impure/Normal/Pure multipliers
  0.5/1.0/2.0 to adjust the normal-purity requirement into a user-edited purity
  mix
- **No implementation plan exists.** This is deliberate under the deferred-plans
  rule.

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

## Resumption Contract

On resume:

1. Read #112 and #114 before this file; the board wins on disagreement.
2. Resume Phase 1 at cumulative implementation review using
   `phase-1/completion-report.md` and `phase-1/r2-verification.log`.
3. Do not write a Phase 2 plan until Phase 1 has merged and its phase report has
   been accepted.
4. Keep Resource Wells explicit. A later decision to build a full well planner
   is new scoped work and must be ticketed rather than hidden in Phase 2.

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
