# #124 Phase 2 post-simplify correctness review r3

Review only the one-shot simplify fold delta `e40efe5...HEAD` in:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-124-extraction-p2-purity`.

This is a delta-scoped correctness recheck after the cumulative simplify lens.
The simplify lens is complete and must not rerun. Do not reopen cumulative r2
areas outside this delta except where needed to verify unchanged behavior at a
changed interface.

## One-shot simplify disposition

The one-shot lens returned `APPROVED_WITH_NITS` with two findings. Both were
accepted and folded:

1. `ExtractionPanel` defines one local typed tuple in exact
   Impure/Normal/Pure order and maps one markup block for all three number
   inputs. The map retains each field's raw value, `min="0"`, `step="1"`, exact
   aria-label, field-specific or aggregate invalid association, and callback.
2. Purity derivation computes the highest-present output once using Pure 2x,
   then Normal 1x, then Impure 1/2x, then no output. It makes one
   `transportForOutput` call when output exists and returns the direct `none`
   status otherwise.

`FEATURE.md` records cumulative r2 correctness convergence and the one-shot
parsimony disposition. Simplify must not be dispatched again after this fold;
only correctness verdicts are requested here.

## Observed verification

- Focused baseline before the refactor: 2 files / 36 tests passed.
- Focused post-refactor: 2 files / 36 tests passed.
- Full suite: 40 files / 1067 tests passed.
- TypeScript, ESLint, and Prettier passed via `npm run check`.
- Chromium/CDP passed nine geometry rows and three production interaction rows
  at 360px, 720px, and 1280px with exact control order/editing, purity math,
  persistence, responsive containment, and all Phase 1 checks retained.

Check the delta for tuple typing/order, exact rendered attributes and values,
field/aggregate ARIA behavior, callback identity, transport precedence, exact
Fraction multipliers, one-helper-call/no-output structure, and truthful review
ledger wording. Run a whitespace diff check over the delta. Return
severity-tagged exact file:line findings and exactly one final verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
