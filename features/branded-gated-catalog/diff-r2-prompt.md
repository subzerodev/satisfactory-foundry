# Diff review r2 (delta-scoped) — S21 P2 (#106), closing won't-do

Repo `/home/subzerodev/workspace/satisfactory-foundry`, branch
`feature/s21-p2-wontdo` at `d1f26b7` plus the current r2 folds.
Base `develop` is `bc2b435`. Review the current cumulative diff
`git diff develop...HEAD` plus any uncommitted wording fold in this worktree.
Pre-review hygiene just passed: `npm run check` clean; `npm test` clean
(33 files, 912 tests).

**Stage: DIFF.** r1 returned NEEDS_REWORK ×2 with the same BLOCKER. Review the
delta.

**r2a note:** the first r2 rerun had `code-reviewer` APPROVED and
`adversarial-reviewer` NEEDS_REWORK. Folded: `features/HANDOFF.md` no longer
tells a fresh agent to avoid Codex after Michael's latest instruction to copy the
Claude reviewer roles into Codex sub-agents; #117 is now called an "untested
gap" rather than a defect; and the handoff count was aligned with the
then-current value-passing wording.

**r2b note:** the second rerun had NEEDS_REWORK ×2. Folded:
`features/HANDOFF.md` no longer says r2 verdicts do not exist; and the
`repropose(catalog, ...)` callers are now measured as R0-R4. Result: 15
value-passing places, 9 RED, 6 green. R4 (`onTierChange`) is RED; R0-R3 are
green and split to #118.

**r2c note:** the third rerun had NEEDS_REWORK ×2. Folded: the
`ChainBuilder.gating.test.tsx` header now says 9 of 15 value-passing slips, and
`brainstorm-spec.md`/`features/HANDOFF.md` then called the report v5.

**r2d note:** the fourth rerun had `code-reviewer` APPROVED_WITH_NITS and
`adversarial-reviewer` NEEDS_REWORK. Folded: the report no longer claims that no
brand can catch `recipeLabel`; it now says the measured five-seam brand catches
zero gaps, while a sixth `recipeLabel(catalog: GatedCatalog, ...)` narrowing
could catch #117 only. Also folded the stale `candidateRecipesFor` wording and
board/source drift: #117 is assigned to Stage 21/project and queued before #118.

## What the BLOCKER was, and what changed

Both reviewers refuted the comment's headline count: "the eight call sites where
both worlds are in lexical scope" counted two object-literal fields as call sites
and **omitted two real ones** — `effectiveDefaultRecipe` (`ChainBuilder.tsx:293`)
and `recipeLabel` (`:556`).

Both were then measured and added to the harness:

- **S7 `effectiveDefaultRecipe` → RED.** A ninth already-caught seam.
- **S8 `recipeLabel` → green, UNDETECTED.** A real, untested gap — and unlike
  `byproductSuggestions`, nothing proves it inert. **Split to #117.**

The count is now stated as fifteen swap-legal **value-passing** places (thirteen
call sites + two object-literal fields), nine red, six green with the green
families explicitly distinguished.

## A. Re-check the count — this is the third time it has been wrong

The comment now claims **fifteen value-passing places** where the swap compiles
and **nine** that turn `ChainBuilder.gating.test.tsx` red. Sweep `ChainBuilder.tsx`
yourself and say whether fifteen is right. The harness rows are in
`features/branded-gated-catalog/seam-detection.sh`; its recorded output is in the
report's `## The measurement`.

Note the r1 reviewers listed three bare property reads (`catalog.items` at `:167`,
`catalog.recipeUnlocks` at `:360`, `catalog.items[s.itemId]` at `:609`) as also
sitting with both worlds in scope under a literal reading. They are excluded as
not being *value passes*. Is that scoping honest now that the comment says
"value-passing places"?

## B. The green claims: S8/#117 and R0-R3/#118

The comment now says `recipeLabel` "is a genuine gap" and that a narrower
`recipeLabel` type could catch this one, but a focused test is the direct fix.
Verify:

- that no test selects `.chain-builder-constrained select` or its options;
- that the report's reason the two worlds can differ there is sound (the
  `(default)` tag resolves via `effectiveDefaultRecipe`; the option list uses the
  **live** exclusion set while the `constrained` cause used the **solved** one);
- that calling it "not provably inert" is the honest framing rather than
  overclaiming a defect. #117 explicitly allows "it turns out inert, close it
  with the trace" as a valid outcome;
- that the updated report is honest about the type option: current production
  `recipeLabel` paths are gated, so a sixth narrowing could catch #117, but it
  would not catch #118's `preview?.gated ?? catalog` laundering slips.

The comment now also says four `repropose` callers are green, not proven inert,
and split to #118. Verify:

- that R0-R3 compile and remain green under the harness;
- that R4 (`onTierChange`) is red;
- that `preview?.gated ?? catalog` is the same brand-laundering form already
  measured, so #118 is not a reason to revive #106's branded-type build.

## C. The other r1 folds

- `ChainBuilder.gating.test.tsx:22` — the stale "deferred to #106" is replaced.
  Does the replacement say the right thing without overclaiming?
- `features/propose-followups/FEATURE.md` — P1 was stale ("DESIGN v1 in review")
  and is now DONE; P2 is now CLOSED won't-do. Verify P1 really did land
  (`0805af0`) and that the P2 entry's 15/9/6 numbers match the comment and the
  report.
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
while its report cites tickets (#117/#118) created from its own measurements is
coherent.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings.

Do NOT spawn nested verification agents; verify yourself and return your verdict
directly.
