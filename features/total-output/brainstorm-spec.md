# #111 — Cost sheet total OUTPUT

## Status

Tier 2 single-feature design, written from #111's ticket and audit trail on
2026-08-16.

## Grounding

- `ChainBuilder.tsx` renders the cost sheet as `Σ POWER`, `Σ MACHINES`, and
  `RAW` inside `.chain-builder-metrics`.
- `PreviewRow.outputRate` already carries each proposed stage's actual primary
  output rate as an exact display string.
- Rows are depth-sorted, with `depth === 0` being the target row (`T0 = target`).
- The actual output can overshoot the requested rate because machine counts are
  ceil'd in the core proposal.
- Rate text does not re-propose on edit. The display must compare against the
  rate snapshot used to build the current preview, not the live input field.
- Byproducts already render separately as `Byproducts: ...`; #105 owns routing
  semantics, so this ticket must not fold byproducts into the OUTPUT metric.

## Design

Add a fourth cost-sheet metric after `RAW`:

```text
OUTPUT
<target actual>/min
```

When the target stage's actual output differs from the requested rate used for
the proposal, render:

```text
<target actual>/min (asked <requested>/min)
```

Keep the metric inside the existing `!view.isEmpty` cost-sheet block. A raw
target still renders the existing empty-state message and no cost sheet; that
preserves the S21 P0 accepted behavior that an all-raw target does not repeat the
typed rate.

Implementation shape:

- Add `rateText` to the component-local `Preview` snapshot, stored as
  `formatRate(parsed.value)` inside `repropose`.
- Add a small pure display helper, local to `ChainBuilder.tsx`, that finds the
  `depth === 0` row and formats:
  - `"—"` if no target row exists;
  - `"<actual>/min"` when actual equals the stored requested rate;
  - `"<actual>/min (asked <requested>/min)"` otherwise.
- Render `OUTPUT` after `RAW`, using that helper.

## Rejected alternatives

- **Actual only**: simpler, but it hides the exact overshoot #111's audit trail
  identifies as the useful part of the feature.
- **Compare against live `rateText`**: wrong after the user edits Rate without
  pressing Propose again; it would compare a solved preview against an unsolved
  input.
- **Include byproducts in OUTPUT**: risks double-speak with the existing
  byproducts line and crosses into #105's routing semantics.
- **Show an OUTPUT fallback for raw targets**: would reintroduce the typed rate
  line that S21 P0 deliberately removed for all-raw targets.

## Test plan

- Add a pure helper test for exact output: actual equals requested, so the string
  is just `<actual>/min`.
- Add a pure helper test for overshoot: actual differs from requested, so the
  string includes `(asked <requested>/min)`.
- Add a raw/no-target-row helper test returning `"—"` for totality.
- Add a jsdom render test that proposes a non-divisible rate and asserts the
  `.chain-builder-metrics` text contains `OUTPUT` and the overshoot wording.
- Add a jsdom drift test that proposes a non-divisible rate, edits the Rate input
  without pressing Propose again, and asserts `OUTPUT` still compares against the
  original requested-rate snapshot, not the live input text.
- Preserve the existing raw-target test that the all-raw target does not repeat
  the typed rate.
- Record bidirectionality by removing the OUTPUT render and showing the new
  render test fails, then restoring it.

## Revision history

- v1: Initial design. Settles actual-vs-requested output wording, excludes
  byproducts, and preserves the raw-target no-cost-sheet behavior.
- v2: Folded design r1 correctness finding from both reviewers: the test plan
  now pins the load-bearing stale-rate case by editing Rate after Propose and
  asserting the OUTPUT comparison still uses the solved preview's requested-rate
  snapshot.
