# Stage 0 — bootstrap scaffold (brainstorm + spec)

Date: 2026-08-03
Status: approved by Michael (design presented + accepted); ticket #1
Tier: 2 (single feature) — branch `feature/stage0-bootstrap`

## Purpose

Stand the project up: a runnable, test-green Vite + React + TypeScript scaffold
with the `src/core/` purity boundary mechanically enforced and the `Fraction`
exact-rational foundation implemented and tested. This is the ground Stage 1
(the manifold visualizer, `2026-08-03-manifold-visualizer-design.md`) builds on.

## Already settled — do NOT re-litigate

From the v1 design spec + `CLAUDE.md` (locked):

- Stack: React + TypeScript + Vite; Zustand for state; Vitest for tests.
- `src/core/` is pure TS — no React, no DOM, no IndexedDB.
- All solver math in exact rational arithmetic (`Fraction`), never floats.
- Directory architecture: `src/core/`, `src/data/`, `src/state/`, `src/ui/`.

Decided in this brainstorm (Michael, 2026-08-03):

- **Fraction is hand-rolled, BigInt-backed** — no fraction.js dependency.
  `src/core` stays zero-dependency; API shaped to the solver's needs.
- **ESLint flat config + tsc** — `check` = typecheck + lint; purity boundary
  enforced via `no-restricted-imports` (the planner's no-linter habit is
  deliberately not carried over).

## Design

### Scaffold

- `npm create vite@latest` react-ts template, then trim the demo: minimal
  `src/main.tsx`, empty-shell `src/App.tsx` (renders an app title only).
- Only `src/core/` materializes in Stage 0. The other v1-architecture
  directories (`src/data/`, `src/state/`, `src/ui/`) arrive with their first
  real file in Stage 1 — empty stubs are inert structure, and the architecture
  is already recorded here and in the v1 spec.
- `zustand` installed as a dependency now (locked stack) — no store written.

### TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true` (solver indexes machine
  arrays; out-of-bounds must surface as `undefined` in types).
- Target ES2022 (BigInt literals require ≥ES2020).

### Lint / format

- ESLint flat config (`eslint.config.js`): typescript-eslint recommended, with
  `ignores: ["dist"]` (flat config does not auto-ignore build output).
- Purity boundary, scoped to `src/core/**` — an **allowlist**, not a denylist
  (core is zero-dependency, so *all* package imports are banned, not a named
  few — future deps can never silently leak in):
  - `@typescript-eslint/no-restricted-imports` with `patterns` entries using
    the explicit **`regex` property** (NOT the glob-matched `group` property —
    the two coexist in the rule's schema and confusing them leaves the ban
    inert):
    - `^[^.]` — ban every bare-specifier (package) import;
    - a depth-robust escape ban on `state`/`ui`/`data` (matches `../state`,
      `../../state/foo`, etc. at any nesting depth).
    The acceptance criterion ("a react import in core fails `check`") is the
    live backstop that the patterns actually fire.
    Type-only imports are banned too (`allowTypeImports` stays false — core
    must not even type-depend on the other layers).
  - `no-restricted-syntax` on `ImportExpression` — closes the dynamic-import
    hole (`no-restricted-imports` covers static imports only).
  - `no-restricted-globals` with `checkGlobalObject: true`: ban `document`,
    `window`, `indexedDB`, `localStorage`, `sessionStorage`, `fetch`,
    `navigator`, `location` (the option also catches `globalThis.document`-style
    access, not just bare identifiers). Unlike the import side, this is a named
    denylist — accepted asymmetry: the import allowlist carries the airtight
    guarantee; the globals list covers the leak classes the v1 architecture
    names plus common host I/O, and core math has no reason to touch the rest.
- Prettier, default config, **scoped to `src`** (`prettier --check src` /
  `prettier --write src`): hand-authored markdown (`CLAUDE.md`, `docs/`) is
  never Prettier's business — an unscoped `--check .` fails `check` on day one
  and an unscoped `--write .` would rewrite the design specs. Scoping to `src`
  also makes a `.prettierignore` unnecessary.

### Scripts (package.json)

| script | command |
|---|---|
| `dev` | `vite` |
| `build` | `vite build` |
| `test` | `vitest run` |
| `test:watch` | `vitest` |
| `check` | `tsc -b && eslint . && prettier --check src` |
| `format` | `prettier --write src` |

`check` uses `tsc -b`, not plain `tsc --noEmit`: the Vite react-ts template
ships a root `tsconfig.json` of project references with `files: []`, which
plain `tsc --noEmit` "checks" as an empty program and exits 0 regardless of
type errors. `tsc -b` walks the references (each has `noEmit`-safe settings)
and actually typechecks `src/`.

`CLAUDE.md` `## Workflow commands` updated to `lint: npm run check`,
`test: npm test`.

### Fraction (`src/core/fraction.ts`)

Immutable, always-normalized (gcd-reduced; sign carried on the numerator;
denominator > 0), BigInt-backed.

API (shaped to the manifold solver's needs — feed math is
ceil-division and boundary comparison over rational rates):

- construct: `Fraction.from(int | bigint)`,
  `Fraction.of(num: int | bigint, den: int | bigint)`,
  `Fraction.parse("37.5")` (decimal strings, exact — string-tokenized, never
  `parseFloat`/`Number` round-tripping; throws on malformed input). **Guards:** `from`/`of` throw a clear domain error on a non-integral
  or non-safe-integer `number` — (`BigInt(1.5)` already throws `RangeError`;
  the explicit guard exists to give a named, intent-documenting error and to
  block any `Math.trunc`-style implementation, since accepting floats is
  exactly the leak the type exists to prevent); `of(_, 0)` throws (the
  `denominator > 0` invariant requires zero-denominator construction to be
  impossible).
- arithmetic: `add`, `sub`, `mul`, `div` (div by zero throws).
- compare: `compare` (returns `-1 | 0 | 1`), `eq`, `lt`, `lte`, `gt`, `gte`,
  `isZero`, `isNegative`.
- integer ops: `floorDiv(other): bigint`, `ceilDiv(other): bigint`,
  `floor(): bigint`, `ceil(): bigint` — exact-boundary correct (an integral
  quotient ceils to itself, not itself+1) and correct for negative values
  (floor toward −∞, ceil toward +∞).
- display: `toString()` exact (`"75/2"`, integers without `/1`),
  `toDecimalString(dp)` for UI — rounds half-up, display-only, never used in
  solver math.

**Stage 1 boundary constraints (recorded now so they aren't rediscovered):**

- the Docs.json parser must feed `Fraction.parse` the *original decimal
  string* from the file, never a `JSON.parse`'d float — exactness is otherwise
  lost at the boundary before the solver sees the value;
- catalog belt/pipe capacities enter the solver as `Fraction`s (lifted via
  `Fraction.from` at the data boundary) — `floorDiv`/`ceilDiv` take `Fraction`
  arguments, so `D/B`-style math is `Fraction ÷ Fraction → bigint`.

### Testing (Vitest, node environment)

Tests are colocated (`src/core/fraction.test.ts`) and run with **Vitest
globals**: `test: { globals: true }` in the Vite config +
`"types": ["vite/client", "vitest/globals"]` in the tsconfig covering `src`
(listing both explicitly — a `types` array excludes unlisted ambient types, so
`vite/client` must be named once the array exists). Test files use
`describe`/`it`/`expect` with **no `vitest` import** — so the core purity
allowlist applies to test files unchanged (no carve-out, no hole through which
a test could import `../state` either).

Table-driven suite for Fraction:

- normalization (reduction, sign, zero forms);
- arithmetic identities and mixed-sign cases;
- `parse` round-trips including `"37.5"`-class fractional rates;
- `ceilDiv`/`floorDiv` exact-multiple boundaries (entry-point math depends on
  the integral-quotient case being exact) **and negative operands** (floor
  toward −∞ / ceil toward +∞ — the subtle half of the correctness claim);
- a BigInt-magnitude case (values past `Number.MAX_SAFE_INTEGER` — proves the
  backing);
- comparisons (`compare`/`eq`/`lt`/`lte`/`gt`/`gte`/`isZero`/`isNegative` —
  tier sorting depends on these) and `toString` exactness (integers without
  `/1`, negative forms);
- `toDecimalString` cases (exact, rounded half-up, `dp` edge);
- construction guards (non-integral `number`, zero denominator),
  division-by-zero, and malformed-parse errors.

No jsdom, no UI tests in Stage 0 — core is DOM-free by construction.

## Acceptance criteria (mirrors ticket #1)

- `npm run dev` / `build` / `test` / `check` all pass and are recorded in
  `CLAUDE.md`.
- `src/core/` purity boundary enforced by ESLint (a react import in core fails
  `check`).
- `Fraction` implemented + table-driven tests green.
- Tier-2 flow: this doc dual-reviewed; diff dual-reviewed; merged `--no-ff`.

## Assumptions ledger

- **Vite react-ts template is current best scaffold** — community idiom;
  `npm create vite` is the Vite-documented entry point.
- **No Fraction exists to port** — verified: no `Fraction` (or equivalent
  rational) *type* exists in `~/workspace/satisfactory-planner/src`; the
  planner's math is floats + `javascript-lp-solver` (its `package.json`).
  (A loose grep for `fraction` does hit incidental prose in comments — the
  claim is about a portable type, not the word.)
- **BigInt suffices for solver magnitudes** — rates are game-data rationals
  (minutes-denominated, small denominators); BigInt removes overflow concern
  entirely, no arbitrary-precision-decimal need.
- **ESLint can express the core allowlist** — regex `patterns` on
  `@typescript-eslint/no-restricted-imports` and per-files scoping are
  flat-config native; `no-restricted-globals`' `checkGlobalObject` option
  exists in current ESLint v9 (verify at implementation — if the installed
  version predates it, the `globalThis.*` escape must be closed via
  `no-restricted-syntax` instead).
- **Stage 1 consumes this unchanged** — solver + `src/data` parser port arrive
  in Stage 1 tickets; nothing here pre-builds them (YAGNI).

## Revision history

**Round 1 design dual-review** (codex: APPROVED_WITH_NITS, 12 findings;
code-reviewer: NEEDS_REWORK, 3 findings). All findings folded; none rejected:

- `check` switched `tsc --noEmit` → `tsc -b` (codex I1 — the template's
  project-references root tsconfig makes plain `--noEmit` a silent no-op).
- Purity boundary rewritten as an allowlist banning all package imports
  (codex N6, subsuming I4 subpaths); relative-escape ban made depth-robust via
  regex (codex I3); dynamic-import guard added via `no-restricted-syntax`
  (code-reviewer #2 + codex N3); type-only imports explicitly banned
  (code-reviewer #2); `checkGlobalObject: true` (code-reviewer #1);
  `localStorage`/`sessionStorage` added to the globals ban (codex I2).
- ESLint flat-config `ignores: ["dist"]` + `.prettierignore` added (codex N2).
- Fraction construction guards specified — non-integral `number` throws,
  zero-denominator `of` throws (codex I5); `compare` return type and
  `toDecimalString` rounding pinned (codex N7); negative floor/ceil semantics
  stated explicitly.
- Tests extended: negative floorDiv/ceilDiv, BigInt magnitude,
  `toDecimalString`, construction guards (codex N5).
- Stage 1 parser decimal-string constraint recorded (codex N4).
- Assumptions ledger: planner-grep wording made precise (codex N1); ESLint
  assumption updated for the allowlist + `checkGlobalObject` version note.
- Prose describing `check` aligned with the scripts table (code-reviewer NIT).

**Round 2 design dual-review** (codex: NEEDS_REWORK, 3 findings;
code-reviewer: NEEDS_REWORK, 3 findings). Both independently found the same
IMPORTANT defect introduced by the round-1 allowlist fold. All folded; none
rejected:

- **Vitest-import collision** (codex F1 = code-reviewer IMPORTANT): colocated
  `src/core/fraction.test.ts` would import `vitest`, which the `^[^.]`
  allowlist bans → `check` red on green code. Fixed via Vitest globals
  (`globals: true` + `vitest/globals` types — codex's preferred option): no
  `vitest` import needed, purity rules apply to tests with no carve-out.
- Globals-ban asymmetry noted + `fetch`/`navigator`/`location` added; residual
  denylist nature recorded as accepted with rationale (codex N1).
- `from` guard rationale reworded — `BigInt(1.5)` throws, it does not
  truncate; the guard is for a named domain error + blocking trunc-style
  implementations (codex N2).
- `parse` malformed-input throw stated in its API bullet (code-reviewer NIT).
- Capacity-lifting note added: catalog capacities become `Fraction`s at the
  data boundary; `floorDiv`/`ceilDiv` are `Fraction ÷ Fraction → bigint`
  (code-reviewer NIT).

**Round 3 design dual-review** (codex: APPROVED_WITH_NITS, 6 findings;
code-reviewer: APPROVED, 0 findings) — correctness converged; codex nits
folded, none rejected:

- Import-ban patterns pinned to the rule's explicit `regex` property (not the
  glob `group` property), with the acceptance criterion named as the live
  backstop (codex I1).
- Prettier scoped to `src` — `check`/`format` no longer touch hand-authored
  markdown; `.prettierignore` dropped as unnecessary, superseding the round-1
  fold that introduced it (codex I2).
- tsconfig `types` lists `vite/client` alongside `vitest/globals` (a `types`
  array excludes unlisted ambients) (codex N1).
- Test list gains comparisons + `toString` exactness rows (codex N2).
- `parse` pinned to string tokenization, never `parseFloat` (codex N3).
- `of` parameter types stated (codex N4).

**Simplify pass** (one-shot, post-convergence — simplify-reviewer:
APPROVED_WITH_NITS, 2 findings):

- NIT 1 **folded**: empty `index.ts` stubs dropped; only `src/core/`
  materializes in Stage 0, the other directories arrive with their first real
  file in Stage 1.
- NIT 2 **rejected with rationale**: `toDecimalString(dp)` stays — its Stage 1
  UI consumer is certain (v1 spec `## UI`, rates like "120/min" rendered
  decimally), the method is one small function, and pinning rounding semantics
  now avoids re-opening a frozen core API in Stage 1. (The reviewer's own
  "defensible to keep" note anticipated exactly this disposition.)
