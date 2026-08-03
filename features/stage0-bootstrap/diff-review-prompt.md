# Diff review — Stage 0 bootstrap scaffold implementation (ticket #1, Tier 2)

**Artifact:** the cumulative diff `develop...feature/stage0-bootstrap`, saved at
`/home/subzerodev/workspace/satisfactory-foundry/features/stage0-bootstrap/stage0-diff.diff`
(1566 lines; `package-lock.json` is excluded from the diff file — it adds 2525
generated lines and is reviewable in the worktree if needed).

**Worktree (the implemented state — read source here):**
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/stage0-bootstrap`

Return exactly one verdict — APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED — with severity-tagged (BLOCKER / IMPORTANT / NIT), line-cited findings.

## A. Current-state anchors (verify against live source)

- **The frozen spec** (authoritative; the diff must implement it exactly):
  `/home/subzerodev/workspace/satisfactory-foundry/.worktrees/stage0-bootstrap/docs/superpowers/specs/2026-08-03-stage0-bootstrap-design.md`
- The v1 design it serves:
  `docs/superpowers/specs/2026-08-03-manifold-visualizer-design.md` (same repo)
- Pre-review hygiene already verified by the team lead in the worktree:
  `npm run check` green (tsc -b + eslint + prettier), `npm test` 70/70 passed.
- Recorded implementation deviations (assess each): (1) the current Vite
  template ships oxlint + target es2023 — oxlint was removed and the ESLint
  stack installed per spec, target set ES2022; (2) installed ESLint is v10.8.0,
  `checkGlobalObject` verified present + firing; (3) `@types/node` kept from
  the template for vite.config typing.

## B. What to verify

1. **Spec fidelity** — every spec section is implemented as written: scaffold
   trim (minimal main.tsx, empty-shell App.tsx, only src/core materializes,
   zustand installed with no store); tsconfig (strict, noUncheckedIndexedAccess,
   ES2022, types array ["vite/client","vitest/globals"]); scripts table
   (check = `tsc -b && eslint . && prettier --check src`); Vitest node env +
   globals with no vitest import in test files; CLAUDE.md workflow stanza.
2. **Purity boundary correctness** — eslint.config.js: the `regex` property
   (not glob `group`) on @typescript-eslint/no-restricted-imports scoped to
   src/core/**; `^[^.]` package ban; the depth-robust escape regex actually
   matches `../state`, `../../state/foo` etc. AND does not over-match legal
   relative imports within core; ImportExpression guard; no-restricted-globals
   with checkGlobalObject + the full banned list.
3. **Fraction correctness** — normalization invariants (gcd, sign on
   numerator, den > 0) hold on EVERY construction path; arithmetic; compare;
   floorDiv/ceilDiv/floor/ceil exact-boundary + negative semantics (floor
   toward −∞, ceil toward +∞); parse string-tokenization exactness (no
   parseFloat anywhere); toDecimalString half-up incl. negatives; guards
   (non-integral/unsafe number throws, of(_,0) throws, div-by-zero throws,
   malformed parse throws); immutability.
4. **Test quality + bidirectionality** — the 70-case suite covers the spec's
   test list; confirm `features/stage0-bootstrap/r2-verification.log` exists
   in the worktree and contains genuine vitest `FAIL` lines referencing the
   diff's test blocks, captured with production code broken, for each distinct
   behaviour class, plus the purity-boundary proof (react import in core →
   check fails citing the restricted-import rule). Return NEEDS_REWORK/BLOCKED
   if the log is missing or shows no genuine FAIL.
5. **Scope** — nothing beyond Stage 0 (no solver/parser/store/UI, no
   src/data|state|ui); no unrelated dependencies beyond the recorded ones;
   commits are logical with conventional prefixes.
