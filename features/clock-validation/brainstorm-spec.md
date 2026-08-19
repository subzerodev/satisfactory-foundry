# #143 — Clock percent: one validator, game floor enforced

**Tier 2 · brainstorm+spec (merged, lean).** The design substance was already
dual-reviewed as gap-report W2 (`features/game-mechanics-audit/gap-report.md`
@ `ae266b1`, reviewed APPROVED_WITH_NITS + APPROVED) and the fix shape was
approved by Michael (#140 comment 24744; ticket #143). This spec pins the
remaining implementation choices; it does not re-derive the defect.

## Already settled — do NOT re-litigate

- The defect and fix shape: route the store's stage-clock derive through
  `parseClockText`; add the 1% floor (#143, from W2).
- The **250 cap stays hardcoded**. Game `mMaxPotential` is `1.000000` on all 62
  carrying classes — parsing it naively yields a wrong 100% cap (gap-report
  RISK section; audit-verified). The cap gets a comment saying exactly that.
- The **1% floor is a game fact**: `mMinPotential = 0.010000`, uniform across
  all 62 carrying classes (audit-verified, adversarially re-derived).
- Lands ahead of the #140 arc as a standalone fix (#140 comment 24744).

## Purpose

One validator owns the clock range so the same string cannot be legal on one
surface and illegal on another. Today `parseClockText`
([clock.ts:3-19](../../src/core/clock.ts)) enforces `(0, 250]` for the chain
builder, extraction panel and packaging intent, while the stage-solve derive
([store.ts:500-517](../../src/state/store.ts)) does its own bare
`Fraction.parse` + `lte(0)` — so a 1000% stage solves and reports counts and
power for a factory the game cannot build. The game's 1% floor is enforced
nowhere.

## Design

### D1 — floor semantics

`parseClockText` gains a floor check after the existing non-positive check is
REPLACED by it: value `< 1` → error. Boundary: exactly `1` is legal (game
`mMinPotential = 0.01` = 1%). The old `lte(0)` branch is subsumed (anything
`≤ 0` is also `< 1`). Messages:

- unparsable: `clock % must be a number in [1, 250]` (was `(0, 250]`)
- below floor: `clock % must be at least 1 (the game's minimum clock)`
- above cap: `clock % must be at most 250` (unchanged), with a new comment on
  the constant: 250 is a gameplay fact deliberately NOT parsed — the file's
  `mMaxPotential` is 1.0 and would yield a wrong 100% cap.

The floor applies to ALL `parseClockText` callers (chain builder
`ChainBuilder.tsx:199,262`, extraction `extraction-plan.ts:118`, packaging
`link-plan.ts:114`) — intended: it is a game-wide rule, and those surfaces
previously accepting 0.5% were accepting an unbuildable value.

Message routing for existing test cases, explicitly: inputs `"0"` and `"-1"`
(previously "must be greater than 0") now emit the **below-floor** message
(`clock % must be at least 1 …`), NOT the unparsable `[1, 250]` message —
only non-numeric input gets the unparsable wording. The diff updates
`extraction-plan.test.ts:422-423` and `ChainBuilder.test.tsx:81-90`
accordingly.

### D2 — store integration

The derive's inline parse block ([store.ts:500-517](../../src/state/store.ts))
is replaced by one `parseClockText(selection.clockPercentText)` call:

- `ok: false` → `{ status: "invalid", reason: "bad-clock", detail:
  `${result.error}; got ${JSON.stringify(selection.clockPercentText)}.` }` —
  keeps the derive's existing got-text convention, sources the rule text from
  the single validator.
- `ok: true` → `clockPercent = result.value`, flow unchanged.

`src/state/store.ts` already sits above core; importing from
`../core/clock.ts` follows the existing dependency direction (store already
imports core modules).

### D3 — what does NOT change

- **The solver backstop stays.** `manifold.ts:196-201` keeps rejecting only
  non-positive clock. Core is a total, UI-independent contract; its
  `nonpositive-clock` finding is an internal-consistency backstop, not user
  validation. Range policy lives in `clock.ts` (one owner), not two.
- The opaque `interstepProblem` passthrough in `reconcile.ts` (its
  "(0, 250]" string appears only in a test fixture) — untouched.
- `advice.ts:212-220` holds a third, private `parseClock` — a `>0` null-guard
  on the chain-power DISPLAY path, running only on already-`solved` stages. It
  is not a range validator (no floor, no cap) and is deliberately left alone;
  "one owner" means one owner of **range policy**, not one parser in the repo.
- `smoke.test.tsx:911-928` hardcodes a literal `bad-clock` SolveState whose
  detail string no producer will emit after D2. Harmless (FindingsPanel
  renders `detail` verbatim; the fixture never invokes the derive) — the diff
  updates the fixture string to the new shape so it does not mislead.
- `ControlsStrip.tsx` — no `max` attribute added; the store-driven invalid
  state already surfaces the message. (Cheap, but it would be a second place
  encoding the range — declined for the same one-owner reason.)

### D4 — accepted behaviour change

A SAVED plan whose stage clock text is, e.g., `0.5` or `1000` flips from
"solved" to the `bad-clock` invalid state on next load. No migration: the
stored text field is unchanged, the plan stays loadable and editable, and the
previous solved state described an unbuildable factory. This is the fix
working, not a regression; noted here so the diff reviewer does not flag it as
unintended.

The blast radius has a SECOND persisted surface: packaging-interstep intents
also persist `clockPercentText` (`PackagingInterstep`, `plan-store.ts:787`)
and validate through `parseClockText` at `link-plan.ts:114` — a saved sub-1%
value there flips to `status: "unavailable"` (`link-plan.ts:116`), a
different status via a different path. Same no-migration reasoning applies.

### Tests

- Floor: `0.5` and `0.99` rejected with the floor message; `1` accepted;
  `250` accepted; `250.01` rejected (existing).
- Store: a `1000` stage derive → `invalid`/`bad-clock`; a `100` derive
  unchanged; the detail text carries the validator message + got-text.
- **Unparsable-message updates** (`(0, 250]` → `[1, 250]`):
  `ChainBuilder.test.tsx:76`, `GraphCanvas.dom.test.tsx:611`,
  `extraction-plan.test.ts:420-421`.
- **Deleted-message updates** — four assertions of the removed
  `"clock % must be greater than 0"` string flip to the below-floor message:
  `ChainBuilder.test.tsx:83` (`"0"`) and `:90` (`"-10"`),
  `extraction-plan.test.ts:422` (`"0"`) and `:423` (`"-1"`). Their
  "rejects zero / rejects negative" cases are REPURPOSED as floor cases
  (a distinct non-positive branch no longer exists).
- **Stale fixture refresh**: `smoke.test.tsx:915,927` — literal `bad-clock`
  detail updated to a post-fix shape (fixture never invokes the derive; the
  update is for honesty, not to keep it green).
- `reconcile.test.ts`'s fixture string is opaque — untouched.

## Acceptance criteria

1. The same clock string is accepted or rejected identically by the chain
   builder, extraction panel, packaging intent, and the stage-solve derive.
2. `1000` as a stage clock produces `invalid`/`bad-clock`, not a solve.
3. `0.5` is rejected on every surface; `1` and `250` are accepted.
4. `src/core/manifold.ts` is untouched by the diff.
5. `npm test` and `npm run check` green.

## Assumptions ledger

- `mMinPotential = 0.010000` uniform on all 62 carrying classes — grounded:
  audit + adversarial re-derivation (gap-report, verified 2026-08-18).
- 250% ceiling remains the correct in-game max including shards — grounded:
  engine-default knowledge; `mPotentialShardSlots` is 0 on all 62 classes so
  the file cannot supply it (gap-report A11 / RISK).
- No caller depends on `parseClockText` accepting sub-1% values — grounded:
  all four callers enumerated above are user-facing clock inputs; grep shows
  no other consumer (`grep -rn "parseClockText" src/` — 4 call sites + the
  definition + a re-export).

## Revision history

- **r1 → r1.1** (design review, code-reviewer APPROVED_WITH_NITS, 3 nits, all
  folded): (1) D1 now states explicitly that `"0"`/`"-1"` route to the
  below-floor message, not the unparsable one, naming the two test files to
  update; (2) D3 acknowledges the third private `parseClock` in
  `advice.ts:212-220` (display-path null-guard, not a range validator — left
  alone) so "one owner" reads as one owner of range policy; (3) D3 adds the
  stale `smoke.test.tsx:911-928` fixture — diff updates its literal detail
  string. Adversarial verdict pending at time of fold.
- **r1.1 → r2** (design review r1, adversarial-reviewer NEEDS_REWORK: 1
  IMPORTANT + 2 NITs; both its B3/B4 refutation attempts failed and are
  recorded as sound). Folded: (1) IMPORTANT — Tests section now enumerates the
  four surviving assertions of the deleted "greater than 0" message
  (ChainBuilder.test.tsx:83,:90; extraction-plan.test.ts:422,:423) and
  repurposes the non-positive cases as floor cases — acceptance criterion 5
  was unsatisfiable as previously written; (2) NIT — D4 names the second
  persisted surface (packaging-interstep intents → status "unavailable" via
  link-plan.ts:116); (3) NIT — smoke.test fixture refresh was already in
  r1.1, now also listed under Tests. r2 goes back to both correctness
  reviewers.
