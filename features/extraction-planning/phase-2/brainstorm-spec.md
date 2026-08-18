# Extraction Planning Phase 2 - Purity Mix Design

**Ticket:** #124 (child of #112 and epic #114)
**Stage:** 22
**Status:** frozen after r2 correctness convergence and one-shot simplify approval
**Date:** 2026-08-16

## Goal

Keep Phase 1's requirement-first answer, then let the user replace its
all-Normal assumption with the Impure, Normal, and Pure resource nodes they
intend to use. The panel reports exact supply, spare or shortfall, machine
power, and the transport needed by the highest-output extractor in that mix.

The feature applies to Miner-fed solids and Crude Oil. Water Extractors do not
use node purity. Resource Wells remain explicit and unestimated because their
satellite topology is map-specific.

## Grounded Inputs

- Phase 1 persists extractor intent as raw user text in
  `ExtractionSelection` and derives exact rates in `src/ui/extraction-plan.ts`.
- The installed Satisfactory build 24656030 supplies multipliers in enum order:
  Impure `0.5`, Normal `1`, Pure `2`. Reproduction evidence is retained in
  `features/extraction-planning/FEATURE.md`.
- Plan v6 is the current writer. Older builds accept v6 while ignoring unknown
  selection fields, so extending v6 in place would permit silent data loss.
- The existing extraction panel is bounded and scrollable at mobile widths; the
  browser gate already measures that boundary and exercises keyboard focus.

## Approaches Considered

### A. Optional persisted node inventory (selected)

Keep the Phase 1 Normal baseline visible. A checkbox enables a three-field node
inventory and seeds it as `0 Impure / baseline Normal / 0 Pure`. Counts persist
with the plan. This directly follows the requirement-first decision, keeps
existing plans unchanged until the user opts in, and models what the user has
without inventing an optimizer.

### B. Always-on three-field inventory

Show the fields immediately and make them the only answer. This is visually
smaller but replaces the rough Normal requirement that Michael explicitly
wanted first. It also forces a migration default to masquerade as user intent.

### C. Combination optimizer

Generate several mixes by minimizing node count, power, or overclock. This
would be speculative: no optimization objective is settled, and map node
availability is user knowledge. It is excluded from this phase.

## State And Persistence

`ExtractionSelection` gains an optional raw-text shape:

```ts
interface PurityMixText {
  impure: string;
  normal: string;
  pure: string;
}

interface ExtractionSelection {
  machineId: string;
  clockPercentText: string;
  purityMix?: PurityMixText;
}
```

Absent `purityMix` means the unchanged Phase 1 baseline. Enabling it seeds the
three strings from the current exact baseline count. Disabling it removes the
field. Changing extractor or clock keeps an existing explicit mix because it is
the user's node inventory; the baseline and coverage recompute around it.

Plan persistence bumps to v7. A new frozen `ExtractionSelectionV6` contains
only `machineId` and `clockPercentText`, and `PlanStageV6` uses that historical
type instead of the widened live-state type. `PlanStageV7` uses the current
selection with optional `purityMix`. `migrateV6` constructs each v7 selection
by explicitly copying the two historical fields, so an unknown extra field in
a hand-authored v6 cannot be smuggled through or silently treated as v7 intent.
v1-v5 continue through their existing migrations and then v6-to-v7. The v7
validator requires all three mix keys to be strings when the optional object is
present and rejects nulls and arrays. Save/export/bundle writers emit v7. This
makes old builds reject the newer file instead of accepting and erasing purity
intent.

## Exact Derivation

Each count must be a base-10 non-negative integer. Blank, decimal, negative,
and exponential values are invalid and identify the offending field. Parse the
three values exactly as `BigInt`, sum them exactly, and reject either an
individual value or the aggregate when it exceeds `Number.MAX_SAFE_INTEGER`.
Only after that aggregate guard converts all counts to numbers for the existing
power helper. Validation happens at derive time; raw text remains persisted.

Let `r` be the selected extractor's exact Normal output after clock scaling and
let `(i, n, p)` be the three counts:

```text
weighted nodes = i/2 + n + 2p
supply         = r * weighted nodes
machine count  = i + n + p
balance        = supply - demand
power          = existing extractor power model at machine count and clock
```

The mix reports `spare` when balance is non-negative and `shortfall` otherwise.
All arithmetic stays in `Fraction`; only the validated counts cross through
safe JavaScript integers for the existing power helper.

Transport uses the greatest per-extractor output among purities with a nonzero
count: Pure `2r`, else Normal `r`, else Impure `r/2`. An all-zero mix has no
output transport requirement and says so directly. The Phase 1 baseline keeps
its Normal transport result. Aggregate supply is never compared with one belt
or pipe.

## Panel Interaction

For a planned purity-bearing resource, the result order is:

1. `Normal baseline` count, per-extractor rate, supplied/spare, transport, power.
2. `Use node mix` checkbox.
3. When checked, three compact numeric inputs labeled Impure, Normal, Pure.
4. Exact mix summary: total nodes, supplied, spare or shortfall, transport, power.

The checkbox is the binary setting control; the count inputs use
`type="number"`, `min="0"`, and `step="1"`. Labels remain visible and no
placeholder carries meaning. Invalid text shows one inline error and no stale
mix totals. Water shows the existing Phase 1 result with no purity controls.
Closing and reopening restores the persisted mix. Keyboard focus continues to
land on the extractor select, with existing close-focus restoration unchanged.

The panel remains within the established responsive stack, and the browser gate
must prove the new controls do not overlap chain controls.

*Superseded by Stage 23 / #134:* this paragraph originally read "Its body already
scrolls at the measured 170px mobile cap; the browser gate must prove the new
controls are reachable **by scrolling** at 360px." That 170px cap no longer
exists and the scroll container is now the top-right wrapper, not the panel body.
At the default 560px canvas the controls are reachable **without** scrolling —
which the gate now asserts — while the 340px minimum canvas still scrolls.

## Error And Lifecycle Rules

- No extractor or invalid clock follows Phase 1 behavior and does not render a
  mix editor.
- An unavailable stored extractor may retain its raw purity text but renders no
  stale totals.
- A malformed persisted v7 mix rejects the whole file at the file boundary.
- Uploading new catalog data retains user extraction intent under the existing
  stage lifecycle; derive-time availability remains authoritative.
- Resource Wells and Nitrogen never receive the standalone purity editor.

## Verification

- Pure derivation tests for exact weighted supply, shortfall/spare, power, and
  highest-present-purity transport.
- Parser tests for zero, blanks, decimals, negatives, exponent notation,
  individual safe-integer overflow, and aggregate safe-integer overflow.
- Store tests for enable/edit/disable, extractor/clock preservation, and
  prototype-like raw item keys.
- Plan v7 save/load/import/export/bundle tests, strict malformed-mix rejection,
  and v1-v6 migration to v7 without fabricated mix intent.
- DOM tests proving Water has no editor and solids/Oil do; invalid values remove
  stale totals.
- Browser geometry and interaction checks at 360, 720, and 1280 widths,
  including mobile scroll reachability and reopen persistence.

## Refusals

- No automatic mix optimizer or map-node inventory database.
- No purity for Water Extractors.
- No standalone approximation for Resource Wells.
- No aggregate-demand-versus-one-line transport warning.
- No silent v6 extension.

## Assumptions Ledger

| Assumption | Grounding |
|---|---|
| Multipliers are exactly 1/2, 1, 2 | Installed build 24656030 config and enum evidence recorded in `FEATURE.md` |
| Water has no purity; Crude Oil does | Settled #112/#114 product direction and game extractor topology |
| Node counts are whole non-negative values | Resource nodes are discrete user inventory; fractional node counts are not buildable |
| Purity changes output, not extractor power at a fixed clock | Existing machine power model is per extractor and purity is a resource-node output multiplier |
| v7 is required | Live v6 validator accepts the existing selection shape and older writers would drop an unknown mix field |
| User inventory survives clock/extractor edits | The counts describe available nodes, while those controls describe how the selected machine uses them |

## Design Review Disposition

- **r1:** folded both findings. Counts are exact-parsed before conversion and
  the aggregate is bounded for the existing power API. Plan v6 now has a
  distinct frozen extraction-selection type; v6-to-v7 migration copies only its
  two known fields.
- **r2:** correctness converged with both reviewers `APPROVED` after the r1
  findings were folded.
- **simplify:** the one-shot simplify review returned `APPROVED` with no
  findings. The design was frozen after this approval.
