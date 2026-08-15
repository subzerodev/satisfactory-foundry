# Design review r2 (delta-scoped) — S21 P2 (#106) branded `GatedCatalog`

Artifact: `features/branded-gated-catalog/brainstorm-spec.md` (**v2**) in
`/home/subzerodev/workspace/satisfactory-foundry`, branch `develop` @ `bc2b435`,
working tree clean.

**Stage: DESIGN.** r1 returned NEEDS_REWORK from both reviewers. v2 folded every
finding. Review the delta — do not re-derive v1.

## What changed, and why it matters

r1's central finding (raised by both of you, from different angles) was that v1's
claims about **what the existing test suite already catches** were wrong. Rather
than re-argue, v2 **measured** it: seven one-token slips, each applied to
`ChainBuilder.tsx`, each run through `npx tsc -b` + the full 912-test suite,
before and after the brand. The matrix is in `## The measurement everything else
rests on`.

The measurements **changed the design**:

- The suite already catches **6 of 7** slips. `byproductSuggestions` (S6) is the
  only uncovered one — so it is now the ticket's only unique contribution, and
  v2's Axis 1 is rewritten on that basis.
- **S3 (`toProposalPreview`) is DROPPED** — 21 test edits to duplicate coverage
  that already exists and passes.
- A hole in the mechanism was found that neither r1 reviewer raised:
  **`preview?.gated ?? catalog` subtype-reduces to `Catalog` and defeats the
  negative brand.** This partially disarms S5.

## A. Attack the measurements — they are now the entire foundation

If a row of the matrix is wrong, the design is wrong. Reproduce what you can:

1. **The 6-of-7 claim.** Verify at least the two that decide Axis 1: that the S6
   slip (`byproductSuggestions(preview.proposal, preview.gated)`) leaves the
   suite **green**, and that the U1 slip leaves it **red**. Note the tree is
   clean — you have Read/Grep, not Bash, so where you cannot execute, verify by
   **tracing the code path** and say which you did.
2. **The laundering claim (iii).** `preview?.gated ?? catalog` typed as
   `Catalog`, not `GatedCatalog | Catalog`. Is that the right explanation
   (TypeScript subtype-reduces the union) — and is the stated boundary right,
   that it launders **only** when the left operand is nullable?
3. **The S3/S4 trace** in (i): the S3 slip reaching `causeOf` →
   `effectiveDefaultRecipe(catalog, …)` at `adapter:416`, and the S4 slip
   reaching `hasAnyProducer` at `adapter:366-369`, both ending at `"natural"` and
   a vanished `<p class="chain-builder-constrained">`. Read `causeOf` and confirm
   or refute the paths.
4. Is "**zero test files changed**" (spec item 4, acceptance) actually
   achievable? Find a test that would break under the five narrowings.

## B. The S5 judgment call — the one I am least sure of

`excludableMachines` is narrowed to `UngatedCatalog` **knowing it catches only
the direct slip, not the `preview?.gated ?? catalog` form that
`ChainBuilder.gating.test.tsx:465` names as "the plausible regression"** — with a
comment saying exactly that.

Take a position: is a half-guard-documented-as-a-half-guard worth having, or is
it worse than no annotation (a reader sees `UngatedCatalog` and assumes the seam
is closed)? Say plainly which, and if you say drop it, say what replaces it.

## C. Is the ticket still worth doing

v2 concedes that Axis 1 option (c) — **close won't-do** — is now defensible, and
takes the ticket anyway on three grounds: S6 is uncovered; prevention localises
four more; types do not rot into pass-either-way the way this repo's tests have
nine times. **Argue the other side.** One uncovered seam, closed by a new
exported type pair plus a documented-hole annotation — is that the right trade,
or should this close as won't-do with a comment on `gateCatalog` instead?

## D. What v2 may have broken while fixing v1

Every number and citation in v2 was rewritten. Check them fresh:

- the 11 `producerRecipesFor` sites and their world attribution;
- `effectiveDefaultRecipe`'s four sites and the direct-vs-transitive distinction;
- `pickerOptionsFor`'s single production site + six test sites;
- `:300`, `:663`, `:674`, `:676-685`, `:1527-1532`, `types.ts:103-121`,
  `:458-478`, `:335-478`, `gating.test.tsx:370`, `:465`;
- the `): Catalog` count (13 total / 4 non-test);
- the grep-checked mint invariant in the acceptance list — is the grep as
  written (`as GatedCatalog\|as UngatedCatalog`) sufficient, or is there another
  way to mint one?

## E. Anything v2 still asserts without grounding

Absolute or uniqueness claims a grep refutes — v2 makes several ("the only
uncovered seam", "no other signature changes", "the only two files carrying
`@vitest-environment jsdom`"). Check them.

## Do NOT re-litigate (settled at r1)

- That the negative brand transfers to the real `Catalog` (no index signature) —
  both of you verified it; v2 additionally re-ran the probe under
  `tsconfig.app.json`.
- That the identity-at-null pin survives (`toBe` is loosely typed).
- That re-reading the P3 v11 correction as scoped to a positive-only brand is
  legitimate rather than re-litigation.
- That Axis 4 retires no jsdom row.
- The Axis-3 fixture-builder prohibition (both verified the collision is real).

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings.

Do NOT spawn nested verification agents; verify yourself and return your verdict
directly.
