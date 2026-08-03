# Design review — Stage 0 bootstrap scaffold (brainstorm+spec) — ROUND 4 (scoped)

Correctness converged at round 3 (codex APPROVED_WITH_NITS — nits folded;
code-reviewer APPROVED). The post-convergence simplify pass then folded ONE
change into the spec: the empty `index.ts` stubs for `src/data|state|ui` were
dropped — only `src/core/` materializes in Stage 0; the other directories
arrive with their first real file in Stage 1 (see `## Revision history`,
"Simplify pass").

This round is SCOPED: verify that this single fold (a) is faithfully applied,
(b) introduces no contradiction elsewhere in the spec (directory references,
purity-boundary scoping, scripts, acceptance criteria), and (c) breaks nothing
the correctness rounds already settled. Do not re-litigate settled findings.

Review the design document at
`/home/subzerodev/workspace/satisfactory-foundry/docs/superpowers/specs/2026-08-03-stage0-bootstrap-design.md`
(worktree root: `/home/subzerodev/workspace/satisfactory-foundry`).

This is a **design-stage** review (no implementation diff exists yet). Verify
the spec is internally consistent, correctly grounded, and implementable as
written. Return exactly one verdict — APPROVED / APPROVED_WITH_NITS /
NEEDS_REWORK / BLOCKED — with severity-tagged (BLOCKER / IMPORTANT / NIT),
line-cited findings.

## A. Current-state anchors (verify against live source)

- `/home/subzerodev/workspace/satisfactory-foundry/CLAUDE.md` — locked stack
  (React + TypeScript + Vite, Zustand, Vitest; `src/core/` pure TS, exact
  rational arithmetic, never floats) and the `## Workflow commands` stanza
  (currently `lint: none` / `test: none`, to be wired by this work).
- `/home/subzerodev/workspace/satisfactory-foundry/docs/superpowers/specs/2026-08-03-manifold-visualizer-design.md`
  — the approved v1 design this scaffold serves. Its "Decisions made during
  brainstorming" table and `## Architecture` block (src/core, src/data,
  src/state, src/ui) are locked; the Stage 0 spec must not contradict them.
- `/home/subzerodev/workspace/satisfactory-foundry/docs/master-plan.md` §Stage 0
  — the Stage this ticket delivers.
- The repo currently has NO package.json / src / tooling — the scaffold is
  greenfield; nothing existing can break.
- Forge ticket #1 audit trail records two decisions (hand-rolled BigInt-backed
  Fraction; ESLint flat + tsc + Prettier) — the spec's "Already settled" section
  mirrors them.

## B. Claims to verify (the design under review)

Verify, at minimum:

1. **Consistency with the locked v1 spec** — directories, stack, exact-rational
   mandate, "nothing in v1 may structurally block the growth path".
2. **Fraction API adequacy** — is the listed API (`from/of/parse`, arithmetic,
   comparisons, `floorDiv/ceilDiv/floor/ceil`, `toString/toDecimalString`)
   sufficient for the v1 solver math in the manifold spec (feed count
   `k = ceil(D/B)`, entry points `floor(S/d)` with the exact-boundary rule,
   output break-outs `floor(T/p)`, per-segment flow validation)? Flag anything
   missing or anything speculative beyond need (YAGNI).
3. **Fraction semantics soundness** — normalization invariants (gcd-reduced,
   sign on numerator, denominator > 0), BigInt backing, `parse("37.5")`
   exactness, div-by-zero behaviour, floor/ceil correctness for negative values
   and exact-integral quotients.
4. **Purity-boundary enforcement** — will ESLint flat-config
   `no-restricted-imports` + `no-restricted-globals` scoped to `src/core/**`
   actually catch the banned imports/globals as specified? Any holes (e.g.
   dynamic import, type-only imports, transitive escape via `../state`)?
5. **Tooling/scripts coherence** — the scripts table, tsconfig choices
   (strict, noUncheckedIndexedAccess, ES2022), Vitest node environment, and the
   CLAUDE.md workflow-commands update.
6. **Assumptions ledger** — each assumption is actually grounded as claimed.

Scope guard: Stage 0 only — solver, Docs.json parser, store, and UI are Stage 1;
flag any scope creep in either direction (missing foundation vs pre-building).
