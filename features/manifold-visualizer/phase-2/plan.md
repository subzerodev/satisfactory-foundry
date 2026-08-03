# Phase 2 implementation plan — src/data parser + catalog (ticket #4)

Date: 2026-08-03 · Status: v1, plan dual-review pending · Branch: `feature/phase-2.0`
Spec: `features/manifold-visualizer/phase-2/spec.md` (FROZEN — the contract;
this plan adds no design). Worktree: `.worktrees/phase-2.0/`.
Port source: `~/workspace/satisfactory-planner/src/` (read-only reference —
the implementer PORTS from it; never modifies it).

## Shape

One implementation agent, one worktree, three sequential TDD tasks, one
commit each. `npm test` + `npm run check` green before every commit;
bidirectionality log at the end.

**Pre-impl drift hunt (mandatory first step):** verify against live source —
foundry `src/core/fraction.ts` (parse/of/from/mul/div/toString signatures)
and `src/core/manifold.ts` (`StageInput`/`LaneInput` exact shapes); the port
source files the spec cites (`src/data/docs-loader.ts` incl. the NativeClass
regexes :13-22 and ingredient regex :185, `src/persistence/catalog-store.ts`,
`src/persistence/db.ts`, `src/core/transport.ts` tier values); foundry
`eslint.config.js` (core-scoped rules only — src/data unrestricted) and
`tsconfig`/vitest config. Any spec-vs-source drift → stop and report.

## Task 1 — types + tiers + parser (`docs-loader.ts`, `catalog.ts`)

- `src/data/types.ts` (spec types verbatim), `src/data/tiers.ts`
  (`TIER_TABLE` as ascending `Fraction`s), `src/data/docs-loader.ts` ported
  per the spec's five pinned deltas (exactness via `Fraction.parse`; loud
  `DocsParseError`s; ported filters; power/stack removed; `primaryOutputId =
  outputs[0].itemId`), `src/data/catalog.ts` (`parseCatalogFromText`).
- Tests (spec rows 1–4): DOCS_FRAGMENT-style embedded fixture (port +
  extend), fluid ÷1000 exactness (`Amount=10000`/dur `"6"` → exactly 100),
  fractional exactness (`"2.5"`/`"4"` → 75/2), loud failures, ported filters.
- Commit: `feat(data): Docs.json parser + catalog types — exact-Fraction port`.

## Task 2 — toStageInput + parseRational (`stage-input.ts`)

- Per the spec: lane mapping (kind from isFluid), tier-prefix slicing,
  lane-addressed overrides with the distinctness assertion, the
  throw-vs-finding boundary (all listed throw cases), `parseRational`.
- Tests (spec rows 5–6): the live-solver integration proof (fixture recipe
  reproducing the Phase 1 20-smelter worked example — dur `"2"`, ingredient
  `Amount="1"` → d=30 AND product `Amount="1"` → p=30, so the output mirror
  (breakouts after 16, loads 480/120) reproduces too; assert the solver's
  known belts/segments both sides), pipe-lane capacities,
  tier slicing, override landing/throw cases, `parseRational` round-trips.
- Commit: `feat(data): catalog→StageInput mapping + rational reviver`.

## Task 3 — cache (`db.ts`, `catalog-store.ts`)

- Per the spec: raw-IDB wrapper, database `satis_foundry` v1, store
  `catalog` key `'current'`; `StoredCatalog` with `toString()`-serialized
  Fractions + SHA-256 `source_hash` + `parser_version`; `saveCatalog` /
  `loadCatalog` never-throw `{hit|stale|empty}`.
- Add devDependency `fake-indexeddb` (the ONE allowed dep change).
- Tests (spec row 7, `fake-indexeddb/auto`): save→load hit with
  Fraction-equal catalog; version bump → stale; corrupted shape → stale;
  hash recorded.
- Commit: `feat(data): IndexedDB catalog cache (satis_foundry, versioned)`.

## Definition of done

1. `npm test` green (all existing 100 + new data tests); `npm run check`
   green; `npm run build` green.
2. Core purity untouched: `git diff` shows NOTHING under `src/core/`;
   `eslint.config.js`/tsconfigs unchanged; `package.json` delta =
   `fake-indexeddb` devDep only.
3. Bidirectionality log `features/manifold-visualizer/phase-2/r2-verification.log`
   (worktree): per behaviour class (exact rate math, loud-failure boundary,
   ported filters, toStageInput mapping/overrides, parseRational round-trip,
   cache stale/hit) — PASS → break → genuine referenced vitest FAIL →
   restore → green.
4. Three commits as named, co-author trailer, no push, no merge, `develop`
   untouched, planner repo untouched.

## Out of scope (hard guardrails)

No `src/core` changes; no store/UI; no upload screen; no belt-class parsing
from Docs.json; no deps beyond `fake-indexeddb`; spec is frozen —
contradictions are stop-and-report.

## Assumptions

- Spec test expectations are implementation-ready (both reviewers hand-verified
  the exactness rows + the d=30 integration fixture hint).
- Node ≥ 20 (`crypto.subtle` global) — repo toolchain satisfies.
