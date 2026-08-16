# Diff review r1 — S21 P2 (#106), closing won't-do

Repo `/home/subzerodev/workspace/satisfactory-foundry`, branch `develop`
@ `bc2b435`. Uncommitted diff (Tier 1 — no feature branch, comment-only).

**Stage: DIFF.** The design (`features/branded-gated-catalog/brainstorm-spec.md`
v3) went through two full correctness rounds; both r1 and r2 returned
NEEDS_REWORK ×2, and the outcome is that **#106 closes won't-do**. What ships is
one doc comment plus the evidence docs.

## What changed

`src/ui/chain-builder-adapter.ts` — the `gateCatalog` doc comment. Diff at
`/tmp/claude-1000/-home-subzerodev-workspace-satisfactory-foundry/78d7d7a8-7929-4fa7-9357-e78884a0e550/scratchpad/s21p2.diff`
(1 file, +17/−3). No code, no behaviour, no test change. `npm run check` clean;
912 tests green.

Also landing (untracked, part of the same commit):
`features/branded-gated-catalog/brainstorm-spec.md` (the measurement report),
`seam-detection.sh` (the harness), and the three review prompts.

## Why the comment had to change regardless

It previously read "the wiring is pinned by tests, not by the compiler (a
branded type is ticket #106)" — a pointer to a ticket now closing. Leaving it
would send the next reader to a closed ticket for a rationale that has since
been measured and reversed.

## A. Every claim in the new comment is countable — check each

This is the whole review. The comment asserts:

1. **"of the eight call sites where both worlds are in lexical scope, seven
   already go red in `ChainBuilder.gating.test.tsx` when swapped"** — verify the
   count of eight (is it eight? are all eight really both-worlds-in-scope?) and
   the seven-red claim. The harness is `features/branded-gated-catalog/seam-detection.sh`;
   its recorded output is in the design doc's `## The measurement`.
2. **"The eighth (`byproductSuggestions`) is green because that slip is
   behaviour-preserving: it reads only `items` (shared by reference) and recipes
   of stages the gated solve already produced."** Verify against
   `chain-builder-adapter.ts:841-874`, `:674`, and `src/core/chain-builder.ts`.
   Is "reads only `items` and recipes of stages" exhaustive of its catalog use?
3. **"`preview?.gated ?? catalog` subtype-reduces to plain `Catalog`"** — is the
   mechanism stated correctly, and is naming `ChainBuilder.gating.test.tsx:465`
   as the guard for that idiom accurate?
4. **"`as GatedCatalog` mints one from any module"** — the comment references a
   type that does not exist in the codebase. Is a comment that reasons about a
   hypothetical type appropriate here, or is it explaining a road not taken at
   too much length?

I have a documented history of exactly this error class: universal and
uniqueness claims ("the only", "every", "exactly N") that a grep refutes are my
highest-frequency doc defect, and I have made four of them in this ticket alone.
Treat every number in that comment as guilty until grepped.

## B. Proportionality

The comment grows from 3 lines to 17. Is that proportionate for a function whose
existing comment was already 13 lines? Name specific sentences to cut if it is
padded. The bar: a future reader deciding whether to brand this type, or
deciding whether the jsdom rows are safe to delete, should get their answer —
nothing more.

## C. The decision itself

The comment now encodes "closed won't-do" as settled. If you think the diff
should not ship because the *decision* is wrong — that #106 should build the
smaller S1/S2/S4 version both r2 reviewers offered as a fallback — say so as a
BLOCKER with reasoning. The design doc's `## Why not the smaller ticket` states
the case for declining; attack it.

## D. Anything else

Stale references; a claim in the design doc contradicted by the comment or vice
versa; the harness script's correctness (it produced a false all-clear twice —
once from line-number drift, once from `pipefail` inverting the pass/fail read;
both are now guarded, but check the guards actually hold).

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings.

Do NOT spawn nested verification agents; verify yourself and return your verdict
directly.
