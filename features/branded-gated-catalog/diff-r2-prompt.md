# Diff review r2 (delta-scoped) — S21 P2 (#106), closing won't-do

Repo `/home/subzerodev/workspace/satisfactory-foundry`, branch `develop`
@ `bc2b435`. Uncommitted diff (Tier 1). Diff file:
`/tmp/claude-1000/-home-subzerodev-workspace-satisfactory-foundry/78d7d7a8-7929-4fa7-9357-e78884a0e550/scratchpad/s21p2.diff`
(3 files, +45/−9). `npm run check` clean; 912 tests green.

**Stage: DIFF.** r1 returned NEEDS_REWORK ×2 with the same BLOCKER. Review the
delta.

## What the BLOCKER was, and what changed

Both reviewers refuted the comment's headline count: "the eight call sites where
both worlds are in lexical scope" counted two object-literal fields as call sites
and **omitted two real ones** — `effectiveDefaultRecipe` (`ChainBuilder.tsx:293`)
and `recipeLabel` (`:556`).

Both were then measured and added to the harness:

- **S7 `effectiveDefaultRecipe` → RED.** A ninth already-caught seam.
- **S8 `recipeLabel` → green, UNDETECTED.** A real, untested gap — and unlike
  `byproductSuggestions`, nothing proves it inert. **Split to #117.**

The count is now stated as ten swap-legal places (eight call sites + two
object-literal fields), eight red, two green with the two greens explicitly
distinguished.

## A. Re-check the count — this is the third time it has been wrong

The comment now claims **ten** places where the swap compiles and **eight** that
turn `ChainBuilder.gating.test.tsx` red. Sweep `ChainBuilder.tsx` yourself and
say whether ten is right. The harness rows are in
`features/branded-gated-catalog/seam-detection.sh`; its recorded output is in the
report's `## The measurement`.

Note the r1 reviewers listed three bare property reads (`catalog.items` at `:167`,
`catalog.recipeUnlocks` at `:360`, `catalog.items[s.itemId]` at `:609`) as also
sitting with both worlds in scope under a literal reading. They are excluded as
not being *value passes*. Is that scoping honest, or does the comment need to say
"ten value-passing places"?

## B. The new S8 claim and #117

The comment now says `recipeLabel` "is a genuine gap, simply untested". Verify:

- that no test selects `.chain-builder-constrained select` or its options;
- that the report's reason the two worlds can differ there is sound (the
  `(default)` tag resolves via `effectiveDefaultRecipe`; the option list uses the
  **live** exclusion set while the `constrained` cause used the **solved** one);
- that calling it "not provably inert" is the honest framing rather than
  overclaiming a defect. #117 explicitly allows "it turns out inert, close it
  with the trace" as a valid outcome.

## C. The other r1 folds

- `ChainBuilder.gating.test.tsx:22` — the stale "deferred to #106" is replaced.
  Does the replacement say the right thing without overclaiming?
- `features/propose-followups/FEATURE.md` — P1 was stale ("DESIGN v1 in review")
  and is now DONE; P2 is now CLOSED won't-do. Verify P1 really did land
  (`0805af0`) and that the P2 entry's numbers match the comment and the report.
- `brand-probe.patch` now ships so the harness's BRAND column is reproducible.
- The harness's green verdict now requires a summary line to be present.
- The `as GatedCatalog` bullet was cut from the comment (r1 NIT, both reviewers).

**One r1 finding was REJECTED:** that the `bc2b435` provenance anchor was
unverifiable. `git log` confirms HEAD is `bc2b435`; the reviewer's session
snapshot predated two commits. Recorded in the report's revision history. Say if
you disagree.

## D. Proportionality and anything new

The comment is 20 lines on a function whose prior comment was 13. Name specific
sentences to cut if padded. Also: anything the fold broke, any claim in the
report contradicted by the comment or by `FEATURE.md`, and whether closing #106
while its report cites a ticket (#117) created from its own measurements is
coherent.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings.

Do NOT spawn nested verification agents; verify yourself and return your verdict
directly.
