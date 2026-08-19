# Review request — #143 design (r1): clock validation unification

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/clock-validation/brainstorm-spec.md` (uncommitted)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `ae266b1`)
**Stage:** design (Tier 2 brainstorm+spec). No diff exists yet.

## A. Current-state anchors — verify against live source

- `src/core/clock.ts` (19 lines): `parseClockText` — bare `Fraction.parse`, `lte(0)` reject, `gt(250)` reject; messages "clock % must be a number in (0, 250]" / "must be greater than 0" / "must be at most 250".
- `src/state/store.ts:500-517`: the stage-solve derive's inline clock parse — its own `Fraction.parse` try/catch + `lte(Fraction.from(0))`, emitting `{status:"invalid", reason:"bad-clock", detail:...}` with `JSON.stringify(selection.clockPercentText)`.
- `parseClockText` call sites (should be exactly four + definition + one re-export): `src/core/link-plan.ts:114`, `src/ui/extraction-plan.ts:118`, `src/ui/ChainBuilder.tsx:199` and `:262` (re-export at `:48`).
- `src/core/manifold.ts:196-201`: solver's `nonpositive-clock` finding (the spec declares it untouched).
- Message expectations in tests: `src/ui/ChainBuilder.test.tsx:54,76`, `src/ui/GraphCanvas.dom.test.tsx:611`, `src/ui/extraction-plan.test.ts:420-421`. Also `src/core/reconcile.test.ts:170,181` — the spec claims this one is an OPAQUE FIXTURE (the string is passed through `interstepProblem`, not produced by a validator); verify that claim by reading `src/core/reconcile.ts:26,55,78-82`.
- Settled decisions the spec builds on: ticket #143 body; gap-report W2 (`features/game-mechanics-audit/gap-report.md`, committed at `ae266b1`); the audit facts `mMinPotential = 0.010000` and `mMaxPotential = 1.000000` on all 62 carrying classes (decoded game file at `/tmp/claude-1000/-home-subzerodev-workspace-satisfactory-foundry/da41eba2-e960-41df-ac0a-bdaefc64bc6a/scratchpad/game-docs-utf8.json` if you want to re-derive).

## B. Claims/design to verify

1. **D1** — floor `< 1` rejects, exactly `1` legal, `lte(0)` branch subsumed; message changes as specified. Check: is the boundary right (game 1% = value `1` here, since the field is a PERCENT text)? Is subsuming `lte(0)` into `< 1` behaviour-safe for all callers?
2. **D2** — the store derive delegates to `parseClockText`; error mapping preserves reason/detail conventions. Check against the real derive shape (does anything downstream depend on the exact old detail strings?).
3. **D3** — solver backstop deliberately unchanged; ControlsStrip deliberately unchanged. Is the one-owner rationale sound, or does leaving the solver at `>0` while the UI enforces `[1,250]` create a NEW inconsistency of the same kind the fix removes? (The spec's position: core is a total contract, not a UI validator. Attack that.)
4. **D4** — saved plans with out-of-range clock text flip to invalid on load, no migration. Is that actually the full blast radius? (Consider: plan-store revive path, link intents with persisted `clockPercentText`, extraction selections.) NOTE: `src/data/plan-store.ts` contains a raw NUL byte — plain grep silently returns no matches on that file; use `grep -a`.
5. **Scope**: does the spec re-litigate anything settled (250 cap parsing, the fix landing pre-arc), or contradict any recorded decision on #140?

Return your standard verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED) with severity-tagged (BLOCKER/IMPORTANT/NIT), line-cited findings.
