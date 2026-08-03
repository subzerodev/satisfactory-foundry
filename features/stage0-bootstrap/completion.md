# Completion — Stage 0 bootstrap scaffold (ticket #1)

Date: 2026-08-03
Branch: `feature/stage0-bootstrap` → merged `--no-ff` into `develop` (worktree
and branch removed post-merge).

## What landed

- Vite + React + TypeScript scaffold, demo-trimmed (minimal `main.tsx`,
  empty-shell `App.tsx`); only `src/core/` materializes; `zustand` installed,
  no store.
- Toolchain: tsconfig strict + `noUncheckedIndexedAccess` + ES2022 +
  `types: ["vite/client","vitest/globals"]`; scripts per spec
  (`check` = `tsc -b && eslint . && prettier --check src`).
- Purity boundary (`eslint.config.js`, scoped `src/core/**`): package-import
  allowlist via `regex` patterns (`^[^.]`), depth-robust layer-escape ban,
  dynamic-import guard, `no-restricted-globals` with `checkGlobalObject` on
  the full banned list. Mechanically proven (react import → `check` fails).
- `src/core/fraction.ts`: immutable, normalized, BigInt-backed exact-rational
  `Fraction` per the frozen spec API, with all construction/division guards.
- `src/core/fraction.test.ts`: 70-case table-driven suite;
  test-bidirectionality proven across five behaviour classes in
  `r2-verification.log`.
- `CLAUDE.md` workflow commands wired (`lint: npm run check`, `test: npm test`).

## What the reviewers caught

- **Design (4 rounds + simplify):** the `tsc --noEmit` false-green trap with
  Vite's project-references tsconfig (→ `tsc -b`); the vitest-import/allowlist
  collision (both reviewers independently; → Vitest globals); denylist→
  allowlist purity upgrade; `checkGlobalObject`; Fraction float-leak
  construction guards; Prettier scope-to-src; plus precision nits. Simplify:
  index-stub removal folded, `toDecimalString` kept with rationale.
- **Diff (1 round + scoped fold re-check + simplify):** latent escape-regex
  over-match on `./state`-style siblings (tightened); unused `globals` dep
  (dropped); unreachable parse guard + no-op `ONE *` (simplify fold, proven
  behaviour-identical by both reviewers).

## Acceptance criteria — final status

- `dev`/`build`/`test`/`check` all pass and are recorded in `CLAUDE.md` — **met**.
- `src/core/` purity boundary enforced by ESLint — **met, mechanically proven**.
- `Fraction` implemented + table-driven tests green — **met** (70/70).
- Tier-2 flow (spec dual-reviewed, diff dual-reviewed, merged `--no-ff`) — **met**.
