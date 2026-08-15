# Design review r1 — S21 P2 (#106) branded `GatedCatalog`

Artifact: `features/branded-gated-catalog/brainstorm-spec.md` (v1) in
`/home/subzerodev/workspace/satisfactory-foundry`, branch `develop` @ `bc2b435`.

**Stage: DESIGN.** No code is written yet. Review the document.

## What it proposes

`gateCatalog(catalog, tier)` returns a plain `Catalog`, so passing the ungated
world where the gated one is required typechecks identically today. The design
attaches a branded type pair to **four typed seams** (a struct field, a React
prop, an entry-point parameter, an options field) so those slips become `tsc`
errors.

## A. The claim that reverses the ticket — verify it hard

**#106 itself proposes narrowing the leaf helpers** (`producerRecipesFor`,
`pickerOptionsFor`, `effectiveDefaultRecipe`). The design declares that shape
**refuted**, on the measurement that `producerRecipesFor` has 12 production call
sites split across BOTH worlds — so narrowing it would forbid `AltCompare.tsx:80`,
the call P3's Axis-4 carve-out requires.

Verify that table against live source (`grep -rn "producerRecipesFor(" src/`).
If ANY row is miscounted or misattributed to the wrong world, say so — the
whole design turns on it. Specifically check the two rows I inferred rather than
read directly: `ChainBuilder.tsx:718` (gated *via the `catalog` prop*) and
`adapter:627,936` (world inherited from the caller).

## B. The tsc probe

The design's second load-bearing measurement is that a **negative** brand
(`Catalog & { readonly [b]?: never }`) rejects a `GatedCatalog` while accepting a
plain `Catalog`. This matters because `features/propose-grows-up/p3-brainstorm.md`
v11 recorded a review correction that a brand catches **only** the
forgot-to-gate direction. The design claims that correction is true of a
*positive-only* brand and does not rule out the pair.

- Is that reading of the settled correction legitimate, or is it re-litigating a
  settled decision under a new name? (The design lists it as settled item 1 and
  claims to revisit only the mechanism.)
- Does the probe actually establish what §Axis 2 uses it for? The probe file is
  at `/tmp/claude-1000/-home-subzerodev-workspace-satisfactory-foundry/78d7d7a8-7929-4fa7-9357-e78884a0e550/scratchpad/brand-probe.ts`
  and used a 2-property stand-in `Catalog`, not the real one. Does the real
  `Catalog` (`src/data/types.ts`) contain anything — an index signature, an
  optional member — that would change the assignability result?

## C. Identity-at-null

Spec item 2 casts the `tier === null` early return, claiming the frozen
same-reference pin (`adapter:659-663`) survives because the brand is erased at
runtime. Find the test that pins byte-stability/identity and confirm it is
unaffected. If the pin is asserted by reference equality against a value whose
declared type changes, say so.

## D. The seam set

Four seams (S1 `Preview.gated`, S2 `RecipePickerProps.catalog`, S3
`toProposalPreview`'s catalog param, S4 `PreviewOptions.ungatedCatalog`).

- **Is any real seam MISSING?** The design states plainly that a bare
  `producerRecipesFor(catalog, …)` written inside ChainBuilder where
  `preview.gated` was meant is NOT caught. Are there other uncovered carriers it
  failed to enumerate?
- **S4 is the negative brand's only production guard** (the design says so
  itself and offers Axis 2 option (a) as a fallback). Is one seam worth a second
  exported type? Take a position.
- Axis 3 pays **26 test-call-site wraps** for S3 and explicitly forbids the
  cheaper fixture-builder repair, on the grounds that the same fixtures are also
  passed as `ungatedCatalog:` where the negative brand would then reject them.
  **Verify that collision is real** — find a test that passes the same fixture
  to both parameters. If none exists, the prohibition is unfounded and the
  cheaper repair should be taken.

## E. The verification artifact

The change adds no runtime behaviour, so spec item 5 substitutes a **type-level**
bidirectionality log: per seam, write the slip, record the `tsc -b` error, restore.
Is that a legitimate substitute for a red/green revert, and is "an unchanged test
count of 912" the right acceptance signal — or does a refactor that changes no
test count hide something?

## F. Anything else

Stale line citations (the design cites many; #103 shipped a fix for exactly this
failure mode two phases ago). Absolute/uniqueness claims that a grep refutes.
A settled P3 decision the design contradicts. Scope creep.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings.

Do NOT spawn nested verification agents; verify yourself and return your verdict
directly.
