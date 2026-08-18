# Design review r2 — #133 packaging for a raw input (Stage 23)

**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry`
**Artifact:** `features/raw-packaging/brainstorm-spec.md` (design r2)
**Ticket:** #133 · **Epic:** #136 · design stage, no `src/` file modified.

r1's verdicts and the full disposition are at #133 comment 24696.

## What changed in r2 — spend your effort here

1. **The plan file now bumps to v9.** r1 proposed adding an optional field with no
   `format_version` bump; r1's two reviewers **contradicted each other** on this and
   it was resolved against source: `plan-store.ts:22-35` states the rule twice, and
   the mechanism was verified (`isPlanFileV8` exact-matches `format_version` at
   `:713` and delegates to the named-field-only `isStageV7Shape` at `:1091-1117`),
   with a real old reader (PWA, `registerType: 'prompt'`, `vite.config.ts:15-35`).
   **Check the version work itself:** is freezing `ExtractionSelectionV7` and adding
   `PlanStageV8`/`PlanFileV9` the right shape? Does `isStageV8Shape` leave genuine-v8
   acceptance unchanged? Is `migrateV8` correct? Is anything else keyed to
   `format_version` that r2 misses (save path, export, import, IndexedDB records)?

2. **The validator now uses the existing `isPackagingInterstepShape`**
   (`:780-797`) rather than a hand-rolled check. Verify it validates the whole
   payload, including the illegal-route refusal.

3. **The control moved inside the `planned` block, gated `selection !== null`.**
   This also resolves the `nitrogen_gas` case (raw-feed card, no standalone
   extractor, so `selection` is permanently null while a packaging pair exists).
   **Is that gate right, and is the Resource Well consequence acceptable** given
   Michael's decision that packaging sits under the extractor plan?

4. **Visibility gained the second arm** (`pairs.length > 0 || packaging !== undefined`),
   mirroring `packagingOptionsFor` (`LinkInspector.tsx:98-104`).

5. **`setMachine`, `copyExtractionSelection`, and the second `ExtractionSelection`
   declaration** are now all named as carry sites. Are there others? Grep for every
   place an `ExtractionSelection` is constructed or copied field-by-field.

6. **The test plan replaced "the existing suite is the pin"** with six specific
   tests, after both reviewers showed `link-plan.test.ts` is degenerate on
   `unlockedTiers` and never exercises the null-demand branch. **Are the six
   sufficient to pin the refactor?** What behaviour could still change silently?

## Anchors

`src/core/link-plan.ts` (`:21-46`, `:75-93`, `:95-195`, `:198-238`);
`src/core/link-transport.ts` (`:34-41`, `:167-191`); `src/core/packaging-pair.ts`;
`src/ui/LinkInspector.tsx` (`:98-104`, `:151`, `:194-216`);
`src/ui/GraphCanvas.tsx` (`:299-589`, esp. `:330-339`, `:362-372`, `:424`, `:477-580`, `:581`);
`src/ui/extraction-plan.ts` (`:7-11`, `:35-66`, `:159-163`);
`src/state/store.ts` (`:101-120`, `:136-143`, `:630`, `:754-759`, `:1968-1980`);
`src/data/plan-store.ts` (`:22-35`, `:180-232`, `:302-322`, `:423`, `:494-506`,
`:705-720`, `:780-797`, `:1062-1117`); `vite.config.ts`;
`src/core/link-plan.test.ts` (`:182`, `:199-242`).

## Also check

- Every `file:line`, against live source. r1 carried a ledger row marked
  **Verified** that was wrong (`copyHistoricalExtraction` "pre-v5-only" — it is
  reachable for any ≤v6 file). r2 corrects it; check it is now right, and check the
  other rows earn their labels.
- Any claim that inverts its own evidence — r1's root error was recording
  "validators do not reject unknown fields" as the reason **not** to bump.
- Whether r2 is bigger than it needs to be.

## Verdict contract

Return exactly one of `APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` /
`BLOCKED` **in your final message**, severity-tagged, citing verified source. If a
nested check does not report, state the finding marked unconfirmed and
source-derived — do not withhold it and do not wait.

Approve if a determined attack finds nothing real. Be explicit about severity; if
what you find is cosmetic, say so and approve. This is a lean spec by choice — do
not request restored narrative unless its absence would cause the change to be
built or verified incorrectly.
