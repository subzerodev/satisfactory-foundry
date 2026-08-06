# Design review r1 — Stage 19 (#92): plan durability (persist() + export-all)

Review the merged brainstorm+spec at
`/home/subzerodev/workspace/satisfactory-foundry/features/plan-durability/brainstorm.md`
against the live repo at `/home/subzerodev/workspace/satisfactory-foundry`
(branch `develop`; `features/plan-durability/` is the only untracked dir).

## A. Current-state anchors (verify against live source)

- `src/state/store.ts:1707-1711` exportPlan; `:1713-1770` importPlan (parse →
  validatePlanFile → trim/refuse-empty → collision-overwrite keeping prior
  createdAt → no auto-load → doRefresh; planError strings); `:972` enqueue
  serialization comment; all plan actions run through `enqueue`.
- `src/data/plan-store.ts` — PlanFileV1..V5 ladder, save-writes-latest,
  read-accepts-all via migrations, `listPlans()`.
- `src/ui/PlansBar.tsx:4-15` props, `:64-93` button row, `:108` file input.
- `src/ui/App.tsx:112-121` downloadTextFile; `:260-266` per-plan export
  filename idiom.
- Decision trail on #92: Michael picked options 1+2; nudge/FS-Access/backend
  rejected. The spec must not smuggle any of those back in.

## B. Claims / design choices to verify

1. **Axis 1:** persist() as an App-boot fire-and-forget helper
   (`src/ui/persistence.ts`), feature-detected, console-only reporting, no
   UI. Is the layering claim right (db.ts/store stay browser-chrome-free),
   and is "no UI on denial" sound given the rejected-nudge decision?
2. **Axis 2:** the bundle envelope (`kind`/`format_version`/`exportedAt`/
   `plans[]` of EXACT per-plan file objects) — does reusing validatePlanFile
   per entry really keep one migration surface? Any hole (e.g. exportPlan
   writes v5 objects — confirm bundle entries therefore re-validate)?
3. **Axis 3:** single importPlan sniffing `kind === "foundry-plan-bundle"`;
   per-entry skip policy with "imported N of M" planError, zero-valid →
   error; atomicity via one enqueue slot; single-file arm byte-identical.
   Attack the failure semantics: partial import vs all-or-nothing for a
   RECOVERY artifact; message wording vs existing planError idiom;
   name-collisions WITHIN one bundle (two entries, same trimmed name — what
   happens, is it deterministic, is it acceptable?).
4. **Axis 4:** EXPORT ALL button semantics (enabled on ≥1 plan, independent
   of selection), `exportAllPlans` in one enqueue slot, the
   `.foundry-plans.json` double-extension filename.
5. **Test plan:** are the six listed test families sufficient and honestly
   bidirectional (the log requirement)? Is the walk's persist() assertion
   honest (asserting the call+log, not a universal grant)?
6. **Scope:** nothing re-opens rejected options; per-plan format untouched;
   no auto-load regression.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings.
