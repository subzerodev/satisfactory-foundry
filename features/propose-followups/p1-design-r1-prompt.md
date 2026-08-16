# Design review r1 — S21 P1 (#103), adapter consolidation

Review `features/propose-followups/p1-brainstorm.md` (v1) in the repo at
`/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`).

Stage: **DESIGN**. Nothing is implemented yet. Your job is to find what is
wrong with the design BEFORE an implementer builds it.

## A. Current-state anchors — verify these against live source yourself

Do not take the design's citations on trust. Read each and confirm:

- `src/ui/chain-builder-adapter.ts:546-562` — `candidateRecipesFor` (the
  function to be deleted): filter, the `< 2 ⇒ []` gate, the grouped sort.
- `src/ui/chain-builder-adapter.ts:607-623` — `producerRecipesFor` (the
  survivor): same filter, no gate, default-first-then-ascending sort.
- `src/ui/chain-builder-adapter.ts:581-595` — `effectiveDefaultRecipe`, which
  `producerRecipesFor` uses to decide what leads.
- `src/ui/chain-builder-adapter.ts:109-113` — the `candidateCount` docstring +
  field, asserting "0 or ≥2 by construction".
- `src/ui/chain-builder-adapter.ts:341` — where `candidateCount` is computed.
- `src/ui/chain-builder-adapter.ts:935-950` — `candidateRowsFor` and its
  docstring.
- `src/ui/AltCompare.tsx:80-81` — the call site AND the pre-existing
  `if (candidates.length < 2) return null` gate.
- `src/ui/ChainBuilder.tsx:697-734` — `RecipePicker`: the affordance gate at
  `:724` and the chip branches at `:729-734`.
- `src/state/store.ts:289` — `unlockedTier` inside `ProposePrefs`.
- The test file `src/ui/chain-builder-adapter.test.ts` at every line the spec's
  item 6 lists — in particular `:815`, `:841`, and `:1098-1105`.

## B. Claims to verify

### B1. The measured probe (the design's foundation)

The design claims a probe over all 195 catalog items found **0 set differences**
and **exactly 3 order-only differences** (`liquid_fuel`, `plastic`, `rubber`,
positions 2/3 only), plus **63 items with exactly one eligible producer**.

The probe file was deleted after running. **Re-derive the claim by reasoning
over the two functions' sort comparators**, and say whether the claimed shape is
possible/necessary given those comparators. If you believe the numbers cannot be
checked without re-running, say so plainly rather than rubber-stamping them —
but DO check that the three named items' orderings follow from the comparators
and the recipe ids involved.

### B2. Axis 3 — the claim that the rendered output is unchanged

The design's central safety argument: `candidateCount` changes from `{0} ∪ [2,∞)`
to `{0,1} ∪ [2,∞)` for **63 items**, but nothing user-visible changes because the
sole consumer branches on `candidateCount >= 2` and both `0` and `1` are below it.

Attack this. Specifically:
- Is `RecipePicker` genuinely the ONLY consumer? Hunt for any other read of
  `candidateCount` — sorting, filtering, conditional rendering, a test that
  asserts a total, serialization, anything.
- Does the affordance gate at `:724` interact with the count in a way the design
  missed?
- Is there a path where `candidateCount === 1` reaches a `> 0` or `!== 0` or
  truthiness test rather than `>= 2`?

### B3. Axis 2 — accepting the order change

The design accepts that `rubber` will compare as `[residual_rubber,
alternate_recycled_rubber, rubber]` (an alternate above a standard recipe),
justified by display names carrying an `Alternate: ` prefix so grouping is
redundant.

- Is that justification sound, or is it rationalizing a regression?
- Verify the `Alternate: ` prefix claim reaches the RENDERED string — trace
  `mDisplayName` through the parser into `CandidateRow.recipeName` and confirm
  the prefix is not stripped anywhere.

### B4. The test-migration judgment calls

Spec item 6 says `:841` must be REWRITTEN to pin the chip rather than the count,
and `:1098-1105` restated. Read both tests.
- Is the design's reading of what each test currently pins correct?
- Would its proposed replacement actually FAIL if the production change were
  reverted or mis-implemented? Name any proposed row that would pass either way.
- Is any other listed test line a judgment call the design has mis-classified as
  mechanical?

### B5. The load-bearing-gate risk

The design says `AltCompare.tsx:81` transitions from dead code to the only thing
preventing a one-row comparison table, and adds a test row for it. Is that
characterization right, and is one test row sufficient?

### B6. Anything the design missed

Especially: an exported-symbol removal breaking something outside `src/`; a
`Preview`/proposal snapshot path that carries `candidateCount`; the S21 P2 (#106)
`GatedCatalog` work that is blocked-by this ticket and may depend on the surface
being removed.

## Known-and-accepted (do NOT report as findings)

- That the ticket carries a `refactor` label while the change is not purely
  behaviour-preserving — the design states this explicitly and corrects it.
- That tier-labeling for AltCompare is not built here — deliberately split to
  #115, which is open and linked.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged (`BLOCKER` / `IMPORTANT` / `NIT`), line-cited
findings. Do not manufacture findings; if it is sound, approve it honestly.

Do NOT spawn nested verification agents; verify yourself and return your verdict
directly.
