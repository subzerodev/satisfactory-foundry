# Boundary review r1 — Stage 19 (#92): plan durability implementation

Review the CUMULATIVE implementation diff against the frozen design.
Worktree (review against THIS tree):
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/plan-durability`
(branch feature/plan-durability, 4 commits over develop at 1a3df5f).

Diff (811 lines):
`/home/subzerodev/workspace/satisfactory-foundry/features/plan-durability/boundary-r1.diff`

## A. Contract anchors

- Frozen contract: `features/plan-durability/brainstorm.md` (v3 FROZEN, in
  the worktree) — spec items 1-5. Item 6 (docs) is deliberately absent; do
  not flag.
- PINNED contract points (any violation = rework): within-bundle duplicate
  names resolve last-entry-wins into ONE row via a per-entry-fresh
  collision view (a hoisted single listPlanFiles() read is forbidden);
  bundle loop in ONE enqueue slot, commented "serialized w.r.t. other plan
  ops" (no rollback claims); exportAllPlans enqueued with the
  torn-snapshot divergence comment (vs exportPlan's no-enqueue at ~:1705);
  single-file import arm byte-identical incl. the live
  "import failed: "-prefixed error strings (the implementer corrected a
  spec-summary drift here — verify the live strings were preserved
  exactly, and that the correction is the right reading of the contract);
  partial message exactly "imported N of M plans (K invalid skipped)" only
  when K>0; zero-valid/empty → "import failed: no valid plans in bundle",
  nothing written; no auto-load; one doRefresh; envelope
  kind/format_version/exportedAt/plans; sniff on kind; persistence helper
  never throws, typeof-navigator guard, console.info, no UI anywhere;
  EXPORT ALL button selection-independent, shown with ≥1 plan.

## B. Claims to verify

1. Every hunk against the contract — scope creep, dead code, rejected
   options (reminder UI, FS-Access, backend, persistence-state UI)
   sneaking in.
2. Implementer claims: 773/773 green + check clean in the worktree —
   re-run both if you have shell. The 9 new tests cover the seven spec
   families; existing single-file import tests untouched.
3. `src/ui/smoke.test.tssx` was modified (+8 lines) — the report did not
   explain this. Inspect: is it a legitimate accommodation (e.g. the new
   button appearing in static markup) or a test weakened to pass? Any
   other test-file modification beyond additions?
4. The bidirectionality log `features/plan-durability/r2-verification.log`
   — confirm it exists and each of the 4 breaks is a REAL production-code
   break with a genuine vitest FAIL line naming the new tests, then a
   restore + green. NEEDS_REWORK if any break is cosmetic or the FAIL is
   not genuine.
5. The shared-helper refactor: does the single-file arm genuinely route
   through it with byte-identical behavior (error strings, createdAt
   rules, no-auto-load, doRefresh timing), or did behavior drift?
6. React/UI details: EXPORT ALL button idiom vs siblings; App handler
   null-guard; boot useEffect fire-and-forget correctness.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings.
